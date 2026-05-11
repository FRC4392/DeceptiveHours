import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { auth } from "./auth"

function yearStart(): number {
  const d = new Date()
  return new Date(d.getFullYear(), 0, 1).getTime()
}

export const getMemberStatus = query({
  args: { teamMemberId: v.id("teamMembers") },
  handler: async (ctx, { teamMemberId }) => {
    const sessions = await ctx.db
      .query("clockSessions")
      .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", teamMemberId))
      .collect()

    const ys = yearStart()
    const completedMs = sessions.reduce((acc, s) => {
      if (s.clockOut && s.clockIn >= ys) return acc + (s.clockOut - s.clockIn)
      return acc
    }, 0)

    const currentSession = sessions.find((s) => !s.clockOut) ?? null
    return { completedMs, currentSession }
  },
})

export const getForMember = query({
  args: { teamMemberId: v.id("teamMembers") },
  handler: async (ctx, { teamMemberId }) => {
    return ctx.db
      .query("clockSessions")
      .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", teamMemberId))
      .order("desc")
      .collect()
  },
})

export const clockIn = mutation({
  args: { teamMemberId: v.id("teamMembers") },
  handler: async (ctx, { teamMemberId }) => {
    const existing = await ctx.db
      .query("clockSessions")
      .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", teamMemberId))
      .filter((q) => q.eq(q.field("clockOut"), undefined))
      .unique()
    if (existing) throw new Error("Already clocked in")
    return ctx.db.insert("clockSessions", { teamMemberId, clockIn: Date.now() })
  },
})

export const clockOut = mutation({
  args: { teamMemberId: v.id("teamMembers") },
  handler: async (ctx, { teamMemberId }) => {
    const session = await ctx.db
      .query("clockSessions")
      .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", teamMemberId))
      .filter((q) => q.eq(q.field("clockOut"), undefined))
      .unique()
    if (!session) throw new Error("Not clocked in")
    await ctx.db.patch(session._id, { clockOut: Date.now() })
  },
})

export const addSession = mutation({
  args: {
    teamMemberId: v.id("teamMembers"),
    clockIn: v.number(),
    clockOut: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error("Unauthorized")
    return ctx.db.insert("clockSessions", args)
  },
})

export const updateSession = mutation({
  args: {
    id: v.id("clockSessions"),
    clockIn: v.number(),
    clockOut: v.optional(v.number()),
  },
  handler: async (ctx, { id, clockIn, clockOut }) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error("Unauthorized")
    await ctx.db.patch(id, { clockIn, clockOut })
  },
})

export const deleteSession = mutation({
  args: { id: v.id("clockSessions") },
  handler: async (ctx, { id }) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error("Unauthorized")
    await ctx.db.delete(id)
  },
})
