import { mutation, query } from "./_generated/server"
import type { QueryCtx, MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"
import { requireMentor } from "./authz"

function yearStart(): number {
  const d = new Date()
  return new Date(d.getFullYear(), 0, 1).getTime()
}

const clockSessionDoc = v.object({
  _id: v.id("clockSessions"),
  _creationTime: v.number(),
  teamMemberId: v.id("teamMembers"),
  clockIn: v.number(),
  clockOut: v.optional(v.number()),
})

// Public (kiosk): completed hours this year + the open session, if any.
export const getMemberStatus = query({
  args: { teamMemberId: v.id("teamMembers") },
  returns: v.object({
    completedMs: v.number(),
    currentSession: v.union(clockSessionDoc, v.null()),
  }),
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

    const currentSession = sessions.find((s) => s.clockOut === undefined) ?? null
    return { completedMs, currentSession }
  },
})

// Mentor-only: full session history for a member, newest first.
export const getForMember = query({
  args: { teamMemberId: v.id("teamMembers") },
  returns: v.array(clockSessionDoc),
  handler: async (ctx, { teamMemberId }) => {
    await requireMentor(ctx)
    return ctx.db
      .query("clockSessions")
      .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", teamMemberId))
      .order("desc")
      .collect()
  },
})

// Returns the single open (not-yet-clocked-out) session for a member, or null.
// Scoped by the by_teamMemberId index; a member has at most a handful of rows.
async function openSessionFor(
  ctx: QueryCtx | MutationCtx,
  teamMemberId: Id<"teamMembers">,
) {
  const sessions = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", teamMemberId))
    .collect()
  return sessions.find((s) => s.clockOut === undefined) ?? null
}

// Public (kiosk): open a session if none is open.
// Member IDs are a 6-digit random suffix on a fixed "4392" prefix (~1M
// combinations) and this endpoint has no rate limiting. Accepted risk for a
// physical shared-kiosk app — anyone with the deployment URL could
// brute-force IDs or remotely clock members in/out. Revisit if this ever
// needs to be reachable outside the build space.
export const clockIn = mutation({
  args: { teamMemberId: v.id("teamMembers") },
  returns: v.id("clockSessions"),
  handler: async (ctx, { teamMemberId }) => {
    const existing = await openSessionFor(ctx, teamMemberId)
    if (existing) throw new Error("Already clocked in")
    return ctx.db.insert("clockSessions", { teamMemberId, clockIn: Date.now() })
  },
})

// Public (kiosk): close the open session. Same ID-enumeration risk as
// clockIn above — no rate limiting, accepted for a physical-kiosk app.
export const clockOut = mutation({
  args: { teamMemberId: v.id("teamMembers") },
  returns: v.null(),
  handler: async (ctx, { teamMemberId }) => {
    const session = await openSessionFor(ctx, teamMemberId)
    if (!session) throw new Error("Not clocked in")
    await ctx.db.patch(session._id, { clockOut: Date.now() })
    return null
  },
})

// Mentor-only: manual session entry.
export const addSession = mutation({
  args: {
    teamMemberId: v.id("teamMembers"),
    clockIn: v.number(),
    clockOut: v.optional(v.number()),
  },
  returns: v.id("clockSessions"),
  handler: async (ctx, args) => {
    await requireMentor(ctx)
    return ctx.db.insert("clockSessions", args)
  },
})

// Mentor-only: edit a session.
export const updateSession = mutation({
  args: {
    id: v.id("clockSessions"),
    clockIn: v.number(),
    clockOut: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { id, clockIn, clockOut }) => {
    await requireMentor(ctx)
    await ctx.db.patch(id, { clockIn, clockOut })
    return null
  },
})

// Mentor-only: delete a session.
export const deleteSession = mutation({
  args: { id: v.id("clockSessions") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireMentor(ctx)
    await ctx.db.delete(id)
    return null
  },
})
