import type { Doc } from "./_generated/dataModel"
import type { QueryCtx, MutationCtx } from "./_generated/server"

type Ctx = QueryCtx | MutationCtx

/**
 * Resolve the teamMembers row for the currently authenticated WorkOS identity,
 * or `null` if unauthenticated / not yet synced by the webhook.
 *
 * The WorkOS user id is the JWT `subject`, which matches `teamMembers.workosUserId`.
 */
export async function getCurrentMember(ctx: Ctx): Promise<Doc<"teamMembers"> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return ctx.db
    .query("teamMembers")
    .withIndex("by_workosUserId", (q) => q.eq("workosUserId", identity.subject))
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
