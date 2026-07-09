import { internalMutation } from "./_generated/server"
import { v } from "convex/values"
import type { GenericMutationCtx } from "convex/server"
import type { DataModel } from "./_generated/dataModel"

type MutationCtx = GenericMutationCtx<DataModel>

const roleValidator = v.union(v.literal("student"), v.literal("mentor"))

const clerkUserForSyncValidator = v.object({
  clerkUserId: v.string(),
  email: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  role: roleValidator,
})

async function generateMemberId(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const suffix = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0")
    const memberId = `4392${suffix}`
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_memberId", (q) => q.eq("memberId", memberId))
      .unique()
    if (!existing) return memberId
  }
  throw new Error("Failed to generate a unique memberId")
}

function clerkAuthTokenIdentifier(clerkUserId: string): string | undefined {
  const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN
  return issuer ? `${issuer}|${clerkUserId}` : undefined
}

async function findMember(ctx: MutationCtx, clerkUserId: string) {
  const authTokenIdentifier = clerkAuthTokenIdentifier(clerkUserId)
  if (authTokenIdentifier) {
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_authTokenIdentifier", (q) =>
        q.eq("authTokenIdentifier", authTokenIdentifier),
      )
      .unique()
    if (member) return member
  }

  return ctx.db
    .query("teamMembers")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique()
}

async function deleteMember(ctx: MutationCtx, clerkUserId: string): Promise<boolean> {
  const member = await findMember(ctx, clerkUserId)
  if (!member) return false
  const sessions = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", member._id))
    .take(500)
  if (sessions.length === 500) {
    throw new Error("Member has too many sessions to remove in one operation")
  }
  await Promise.all(sessions.map((s) => ctx.db.delete(s._id)))
  await ctx.db.delete(member._id)
  return true
}

async function upsertMember(
  ctx: MutationCtx,
  data: {
    clerkUserId: string
    email: string
    firstName: string
    lastName: string
    role: "student" | "mentor"
  },
): Promise<"created" | "updated"> {
  const existing = await findMember(ctx, data.clerkUserId)
  const fields: {
    email: string
    firstName: string
    lastName: string
    type: "student" | "mentor"
    authTokenIdentifier?: string
  } = {
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    type: data.role,
  }
  const authTokenIdentifier = clerkAuthTokenIdentifier(data.clerkUserId)
  if (authTokenIdentifier) fields.authTokenIdentifier = authTokenIdentifier

  if (existing) {
    await ctx.db.patch(existing._id, fields)
    return "updated"
  }

  const memberId = await generateMemberId(ctx)
  await ctx.db.insert("teamMembers", {
    clerkUserId: data.clerkUserId,
    memberId,
    ...fields,
  })
  return "created"
}

export const upsertClerkUser = internalMutation({
  args: clerkUserForSyncValidator.fields,
  returns: v.null(),
  handler: async (ctx, data) => {
    await upsertMember(ctx, data)
    return null
  },
})

export const deleteClerkUser = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { clerkUserId }) => {
    await deleteMember(ctx, clerkUserId)
    return null
  },
})

export const syncClerkUsers = internalMutation({
  args: {
    users: v.array(clerkUserForSyncValidator),
    requiredClerkUserId: v.string(),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    deleted: v.number(),
  }),
  handler: async (ctx, { users, requiredClerkUserId }) => {
    let created = 0
    let updated = 0
    let deleted = 0
    const clerkUserIds = new Set(users.map((user) => user.clerkUserId))
    if (!clerkUserIds.has(requiredClerkUserId)) {
      throw new Error("Sync cancelled because the signed-in mentor was not found in Clerk")
    }

    for (const user of users) {
      const result = await upsertMember(ctx, user)
      if (result === "created") created++
      else updated++
    }

    const localMembers = await ctx.db.query("teamMembers").take(500)
    if (localMembers.length === 500) {
      throw new Error("Too many local users to sync in one operation")
    }

    for (const member of localMembers) {
      if (member.clerkUserId && !clerkUserIds.has(member.clerkUserId)) {
        if (await deleteMember(ctx, member.clerkUserId)) deleted++
      }
    }

    return { created, updated, deleted }
  },
})
