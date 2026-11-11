"use node"

import { createClerkClient, type User } from "@clerk/backend"
import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { ConvexError, v } from "convex/values"

type ClerkRole = "student" | "mentor"

const CLERK_SYNC_PAGE_SIZE = 100

type SyncUsersResult = {
  scanned: number
  created: number
  updated: number
  deleted: number
  removable: number
}

function getClient() {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set")
  return createClerkClient({ secretKey })
}

function primaryEmail(user: User) {
  return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? ""
}

function roleFromMetadata(user: User): ClerkRole {
  const metadata = user.publicMetadata as Record<string, unknown> | undefined
  return metadata?.role === "mentor" ? "mentor" : "student"
}

export const inviteUser = action({
  args: {
    email: v.string(),
    role: v.union(v.literal("student"), v.literal("mentor")),
  },
  returns: v.object({ invitationId: v.string() }),
  handler: async (ctx, { email, role }) => {
    await ctx.runQuery(internal.users.assertMentor, {})

    try {
      const invitation = await getClient().invitations.createInvitation({
        emailAddress: email,
        publicMetadata: { role },
      })
      return { invitationId: invitation.id }
    } catch (error) {
      // Clerk rejects a second invitation for the same address with a long
      // machine-readable payload. Re-inviting someone is a common mistake, so
      // it gets a sentence a mentor can act on.
      if (isDuplicateInvitationError(error)) {
        // `ConvexError` takes only its data payload, so the original is logged
        // here instead of attached as a `cause` — the Convex function logs keep
        // it for debugging while the mentor gets the readable sentence.
        console.error("Duplicate Clerk invitation", error)
        throw new ConvexError(
          `${email} already has a pending invitation. Revoke it below before sending a new one.`,
        )
      }
      throw error
    }
  },
})

function isDuplicateInvitationError(error: unknown): boolean {
  const parts: string[] = []
  if (error instanceof Error) parts.push(error.message)
  // Clerk surfaces the machine-readable reason in an `errors` array.
  const errors = (error as { errors?: Array<{ code?: string; message?: string }> })?.errors
  if (Array.isArray(errors)) {
    for (const entry of errors) {
      if (entry?.code) parts.push(entry.code)
      if (entry?.message) parts.push(entry.message)
    }
  }
  const text = parts.join(" ").toLowerCase()
  return text.includes("duplicate") || text.includes("already exists")
}

// Pending invitations are Clerk-side only — nobody has a roster row until they
// accept — so they are read straight from Clerk rather than mirrored locally.
export const listPendingInvitations = action({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      email: v.string(),
      role: v.union(v.literal("student"), v.literal("mentor")),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await ctx.runQuery(internal.users.assertMentor, {})

    const page = await getClient().invitations.getInvitationList({
      status: "pending",
      limit: 100,
    })
    return page.data.map((invitation) => {
      const metadata = invitation.publicMetadata as Record<string, unknown> | undefined
      return {
        id: invitation.id,
        email: invitation.emailAddress,
        role: metadata?.role === "mentor" ? ("mentor" as const) : ("student" as const),
        createdAt: invitation.createdAt,
      }
    })
  },
})

export const revokeInvitation = action({
  args: { invitationId: v.string() },
  returns: v.null(),
  handler: async (ctx, { invitationId }) => {
    await ctx.runQuery(internal.users.assertMentor, {})
    await getClient().invitations.revokeInvitation(invitationId)
    return null
  },
})

export const removeUser = action({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { clerkUserId }) => {
    const caller = await ctx.runQuery(internal.users.assertMentor, {})
    if (caller.clerkUserId === clerkUserId) {
      throw new ConvexError("You cannot remove your own account")
    }

    await getClient().users.deleteUser(clerkUserId)
    // Delete the roster row and its sessions here rather than waiting for the
    // `user.deleted` webhook. If that webhook is delayed or misconfigured the
    // person stayed on the roster with a working Member ID at the kiosk, while
    // the UI had already reported them removed. The webhook still runs and is
    // a no-op once this has taken effect.
    await ctx.runMutation(internal.auth.deleteClerkUser, { clerkUserId })
    return null
  },
})

// Roles live in Clerk `publicMetadata.role`, so a role change has to be written
// there — editing the roster row locally was silently undone by the next
// `user.updated` webhook.
export const updateUserRole = action({
  args: {
    teamMemberId: v.id("teamMembers"),
    role: v.union(v.literal("student"), v.literal("mentor")),
  },
  returns: v.null(),
  handler: async (ctx, { teamMemberId, role }) => {
    const caller = await ctx.runQuery(internal.users.assertMentor, {})
    const target = await ctx.runQuery(internal.users.memberClerkUserId, { teamMemberId })
    if (caller.clerkUserId === target.clerkUserId && role !== "mentor") {
      throw new ConvexError("You cannot remove your own mentor access")
    }

    // `updateUserMetadata` merges, so invitation metadata such as the person's
    // name survives; `updateUser` would replace `publicMetadata` wholesale.
    await getClient().users.updateUserMetadata(target.clerkUserId, {
      publicMetadata: { role },
    })
    await ctx.runMutation(internal.auth.setMemberRole, {
      clerkUserId: target.clerkUserId,
      role,
    })
    return null
  },
})

export const syncUsers = action({
  args: {
    // Off by default: pruning cascade-deletes clock sessions, so the mentor has
    // to ask for it explicitly after seeing the `removable` count.
    removeMissing: v.optional(v.boolean()),
  },
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    updated: v.number(),
    deleted: v.number(),
    removable: v.number(),
  }),
  handler: async (ctx, { removeMissing }): Promise<SyncUsersResult> => {
    const caller: { clerkUserId: string } = await ctx.runQuery(internal.users.assertMentor, {})

    const client = getClient()
    const users: User[] = []
    let offset = 0
    let totalCount: number
    let pageCount: number

    do {
      const page = await client.users.getUserList({
        limit: CLERK_SYNC_PAGE_SIZE,
        offset,
      })
      totalCount = page.totalCount
      pageCount = page.data.length
      users.push(...page.data)
      offset += pageCount
    } while (offset < totalCount && pageCount > 0)

    if (users.length < totalCount) {
      throw new ConvexError("Sync cancelled because the full Clerk user list could not be fetched")
    }

    const result: Omit<SyncUsersResult, "scanned"> = await ctx.runMutation(
      internal.auth.syncClerkUsers,
      {
        requiredClerkUserId: caller.clerkUserId,
        removeMissing,
        users: users.map((user) => ({
          clerkUserId: user.id,
          email: primaryEmail(user),
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          role: roleFromMetadata(user),
        })),
      },
    )

    return {
      scanned: users.length,
      ...result,
    }
  },
})
