"use node"

import { createClerkClient } from "@clerk/backend"
import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

function getClient() {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set")
  return createClerkClient({ secretKey })
}

export const inviteUser = action({
  args: {
    email: v.string(),
    role: v.union(v.literal("student"), v.literal("mentor")),
  },
  returns: v.object({ invitationId: v.string() }),
  handler: async (ctx, { email, role }) => {
    await ctx.runQuery(internal.users.assertMentor, {})

    const invitation = await getClient().invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role },
    })

    return { invitationId: invitation.id }
  },
})

export const removeUser = action({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { clerkUserId }) => {
    const caller = await ctx.runQuery(internal.users.assertMentor, {})
    if (caller.clerkUserId === clerkUserId) {
      throw new Error("You cannot remove your own account")
    }

    await getClient().users.deleteUser(clerkUserId)
    return null
  },
})
