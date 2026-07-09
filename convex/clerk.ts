"use node"

import { createClerkClient, type User } from "@clerk/backend"
import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

type ClerkRole = "student" | "mentor"

const CLERK_SYNC_PAGE_SIZE = 100

type SyncUsersResult = {
  scanned: number
  created: number
  updated: number
  deleted: number
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

export const syncUsers = action({
  args: {},
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    updated: v.number(),
    deleted: v.number(),
  }),
  handler: async (ctx): Promise<SyncUsersResult> => {
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
      throw new Error("Sync cancelled because the full Clerk user list could not be fetched")
    }

    const result: Omit<SyncUsersResult, "scanned"> = await ctx.runMutation(
      internal.auth.syncClerkUsers,
      {
        requiredClerkUserId: caller.clerkUserId,
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
