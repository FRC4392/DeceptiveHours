import { query, internalQuery } from "./_generated/server"
import { v } from "convex/values"
import { getCurrentMember, requireMentor } from "./authz"

/**
 * The current user's roster identity, safe to call while signed out.
 *
 * Returns `null` when there is no authenticated WorkOS identity, or when the
 * identity exists but has not yet been synced into `teamMembers` by the webhook.
 * `role` is `null` in the (transient) synced-but-unknown case. The client uses
 * this to decide routing, so it MUST NOT throw.
 */
export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      role: v.union(v.literal("student"), v.literal("mentor"), v.null()),
      firstName: v.string(),
      lastName: v.string(),
      email: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const member = await getCurrentMember(ctx)
    if (!member) return null
    return {
      role: member.type,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
    }
  },
})

/**
 * Internal mentor gate for use from Node actions (which have no `ctx.db`).
 * Throws unless the caller is an authenticated mentor. Returns the mentor's
 * workosUserId so callers can, e.g., avoid self-removal.
 */
export const assertMentor = internalQuery({
  args: {},
  returns: v.object({ workosUserId: v.string() }),
  handler: async (ctx) => {
    const member = await requireMentor(ctx)
    return { workosUserId: member.workosUserId }
  },
})
