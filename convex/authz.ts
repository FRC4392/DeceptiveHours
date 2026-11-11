import type { Doc } from "./_generated/dataModel"
import type { QueryCtx, MutationCtx } from "./_generated/server"
import { resolveKioskDevice } from "./kioskAuth"

type Ctx = QueryCtx | MutationCtx

/**
 * Resolve the teamMembers row for the currently authenticated Clerk identity,
 * or `null` if unauthenticated / not yet synced by the webhook.
 *
 * Prefer Convex's provider-scoped `tokenIdentifier` for auth-linked lookups.
 * The `subject` fallback supports Clerk rows created before
 * `authTokenIdentifier` was stored.
 */
export async function getCurrentMember(ctx: Ctx): Promise<Doc<"teamMembers"> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  const byToken = await ctx.db
    .query("teamMembers")
    .withIndex("by_authTokenIdentifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .unique()
  if (byToken) return byToken

  return ctx.db
    .query("teamMembers")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique()
}

/**
 * Assert the caller is an authenticated mentor and return their member row.
 * Throws for unauthenticated callers, callers not yet synced, and students.
 */
export async function requireMentor(ctx: Ctx): Promise<Doc<"teamMembers">> {
  const member = await getCurrentMember(ctx)
  if (!member) throw new Error("Unauthorized")
  if (member.type !== "mentor") throw new Error("Forbidden: mentors only")
  return member
}

export type Caller =
  | { kind: "kiosk"; device: Doc<"kioskDevices"> }
  | { kind: "mentor"; member: Doc<"teamMembers"> }

/**
 * Gate for the five clock-screen functions, which serve two very different
 * callers:
 *
 * - the shared tablet in the room, holding a long-lived device token and no
 *   Clerk session at all, so anyone who walks up to it can clock in and out
 *   but cannot reach the roster, invites or deletions; and
 * - a mentor clocking someone in from their own phone, with a normal Clerk
 *   session they keep.
 *
 * A supplied token is authoritative: if it is present but revoked or expired
 * the error says so instead of falling through to a confusing "Unauthorized".
 * Every other function in the app stays `requireMentor`-only.
 */
export async function requireKioskOrMentor(
  ctx: Ctx,
  kioskToken?: string,
): Promise<Caller> {
  if (kioskToken) {
    const device = await resolveKioskDevice(ctx, kioskToken)
    return { kind: "kiosk", device }
  }
  return { kind: "mentor", member: await requireMentor(ctx) }
}
