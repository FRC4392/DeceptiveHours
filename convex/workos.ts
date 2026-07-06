"use node"

import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { WorkOS } from "@workos-inc/node"

function getClient(): WorkOS {
  const apiKey = process.env.WORKOS_API_KEY
  if (!apiKey) throw new Error("WORKOS_API_KEY is not set")
  // clientId is optional for the management calls used here, but pass it when
  // present so the SDK is fully configured.
  return new WorkOS(apiKey, { clientId: process.env.WORKOS_CLIENT_ID })
}

/**
 * Mentor-only: invite a new user to the WorkOS org by email.
 *
 * `role` is a WorkOS Role slug ("student" | "mentor") applied to the
 * organization membership created when the invitation is accepted. This
 * requires `WORKOS_ORGANIZATION_ID` to be set (role is a property of the
 * membership, not the user) and "student"/"mentor" Roles to already exist in
 * your WorkOS org — see convex/auth.ts for how the resulting
 * `organization_membership.created` event syncs the role into `teamMembers`.
 *
 * The invited user is materialized into `teamMembers` (as "student", pending
 * role sync) when they accept and WorkOS fires `user.created` to our webhook.
 */
export const inviteUser = action({
  args: {
    email: v.string(),
    role: v.union(v.literal("student"), v.literal("mentor")),
  },
  returns: v.object({ invitationId: v.string() }),
  handler: async (ctx, { email, role }) => {
    await ctx.runQuery(internal.users.assertMentor, {})

    const workos = getClient()
    const organizationId = process.env.WORKOS_ORGANIZATION_ID

    const invitation = await workos.userManagement.sendInvitation({
      email,
      // Role slug is only honored when WorkOS Roles are configured; harmless
      // otherwise. Passing organizationId scopes the invite to your org.
      roleSlug: role,
      ...(organizationId ? { organizationId } : {}),
    })

    return { invitationId: invitation.id }
  },
})

/**
 * Mentor-only: permanently delete a user in WorkOS. WorkOS then fires
 * `user.deleted` to our webhook, which cascade-deletes the local `teamMembers`
 * row and its `clockSessions`. Guards against a mentor deleting themselves.
 */
export const removeUser = action({
  args: { workosUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { workosUserId }) => {
    const caller = await ctx.runQuery(internal.users.assertMentor, {})
    if (caller.workosUserId === workosUserId) {
      throw new Error("You cannot remove your own account")
    }

    const workos = getClient()
    await workos.userManagement.deleteUser(workosUserId)
    return null
  },
})
