import type { Doc } from "./_generated/dataModel"
import type { QueryCtx, MutationCtx } from "./_generated/server"

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
