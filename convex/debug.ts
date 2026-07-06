import { query } from "./_generated/server"
import { v } from "convex/values"

// TEMPORARY: dumps whatever identity Convex resolves from the incoming
// WorkOS token (or null if Convex rejects/has none), so the client can log
// it during a real sign-in attempt. Remove once the auth issuer question is
// settled.
export const whoAmI = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    return identity ?? null
  },
})
