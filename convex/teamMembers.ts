import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { auth } from "./auth"

export const lookupByMemberId = query({
  args: { memberId: v.string() },
  handler: async (ctx, { memberId }) => {
    return ctx.db
      .query("teamMembers")
      .withIndex("by_memberId", (q) => q.eq("memberId", memberId))
      .unique()
  },
})

export const getById = query({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id)
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("teamMembers").collect()
  },
})

export const add = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    type: v.union(v.literal("student"), v.literal("mentor")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error("Unauthorized")
    let memberId: string
    do {
      const suffix = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0")
      memberId = `4392${suffix}`
      const existing = await ctx.db
        .query("teamMembers")
        .withIndex("by_memberId", (q) => q.eq("memberId", memberId))
        .unique()
      if (!existing) break
    } while (true)
    return ctx.db.insert("teamMembers", { ...args, memberId })
  },
})

export const update = mutation({
  args: {
    id: v.id("teamMembers"),
    firstName: v.string(),
    lastName: v.string(),
    memberId: v.string(),
    type: v.union(v.literal("student"), v.literal("mentor")),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error("Unauthorized")
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_memberId", (q) => q.eq("memberId", fields.memberId))
      .unique()
    if (existing && existing._id !== id) throw new Error("Member ID already in use")
    await ctx.db.patch(id, fields)
  },
})

export const remove = mutation({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, { id }) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error("Unauthorized")
    const sessions = await ctx.db
      .query("clockSessions")
      .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", id))
      .collect()
    await Promise.all(sessions.map((s) => ctx.db.delete(s._id)))
    await ctx.db.delete(id)
  },
})
