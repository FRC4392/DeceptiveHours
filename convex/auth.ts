import { internalMutation } from "./_generated/server"
import { v } from "convex/values"
import type { GenericMutationCtx } from "convex/server"
import type { DataModel } from "./_generated/dataModel"

type MutationCtx = GenericMutationCtx<DataModel>

const roleValidator = v.union(v.literal("student"), v.literal("mentor"))

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

async function findMember(ctx: MutationCtx, clerkUserId: string) {
  return ctx.db
    .query("teamMembers")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique()
}

async function deleteMember(ctx: MutationCtx, clerkUserId: string): Promise<void> {
  const member = await findMember(ctx, clerkUserId)
  if (!member) return
  const sessions = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", member._id))
    .take(500)
  if (sessions.length === 500) {
    throw new Error("Member has too many sessions to remove in one operation")
  }
  await Promise.all(sessions.map((s) => ctx.db.delete(s._id)))
  await ctx.db.delete(member._id)
}

export const upsertClerkUser = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: roleValidator,
  },
  returns: v.null(),
  handler: async (ctx, data) => {
    const existing = await findMember(ctx, data.clerkUserId)
    const fields = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      type: data.role,
    }

    if (existing) {
      await ctx.db.patch(existing._id, fields)
      return null
    }

    const memberId = await generateMemberId(ctx)
    await ctx.db.insert("teamMembers", {
      clerkUserId: data.clerkUserId,
      memberId,
      ...fields,
    })
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
