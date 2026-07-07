import { mutation, query } from "./_generated/server"
import type { QueryCtx, MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"
import { requireMentor } from "./authz"
import type { Doc } from "./_generated/dataModel"

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
  status: v.optional(v.union(v.literal("open"), v.literal("closed"))),
})

function sessionStatus(session: Doc<"clockSessions">): "open" | "closed" {
  return session.status ?? (session.clockOut === undefined ? "open" : "closed")
}

function validateClockRange(clockIn: number, clockOut?: number) {
  if (!Number.isFinite(clockIn)) throw new Error("Clock in must be a valid time")
  if (clockOut !== undefined && !Number.isFinite(clockOut)) {
    throw new Error("Clock out must be a valid time")
  }
  if (clockOut !== undefined && clockOut <= clockIn) {
    throw new Error("Clock out must be after clock in")
  }
}

async function requireMember(ctx: QueryCtx | MutationCtx, id: Id<"teamMembers">) {
  const member = await ctx.db.get(id)
  if (!member) throw new Error("Member not found")
  return member
}

async function yearCompletedMs(
  ctx: QueryCtx,
  teamMemberId: Id<"teamMembers">,
): Promise<number> {
  const ys = yearStart()
  const sessions = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId_clockIn", (q) =>
      q.eq("teamMemberId", teamMemberId).gte("clockIn", ys),
    )
    .take(500)

  return sessions.reduce((acc, s) => {
    if (sessionStatus(s) === "closed" && s.clockOut) return acc + (s.clockOut - s.clockIn)
    return acc
  }, 0)
}

// Mentor-only (unlocked kiosk): completed hours this year + open session, if any.
export const getMemberStatus = query({
  args: { teamMemberId: v.id("teamMembers") },
  returns: v.object({
    completedMs: v.number(),
    currentSession: v.union(clockSessionDoc, v.null()),
  }),
  handler: async (ctx, { teamMemberId }) => {
    await requireMentor(ctx)
    await requireMember(ctx, teamMemberId)
    const completedMs = await yearCompletedMs(ctx, teamMemberId)
    const currentSession = await openSessionFor(ctx, teamMemberId)
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
      .take(500)
  },
})

// Returns the single open (not-yet-clocked-out) session for a member, or null.
// Scoped by the by_teamMemberId index; a member has at most a handful of rows.
async function openSessionFor(
  ctx: QueryCtx | MutationCtx,
  teamMemberId: Id<"teamMembers">,
) {
  const indexed = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId_and_status", (q) =>
      q.eq("teamMemberId", teamMemberId).eq("status", "open"),
    )
    .take(2)
  if (indexed.length > 1) throw new Error("Multiple open sessions found")
  if (indexed[0]) return indexed[0]

  // Backward-compatible rollout fallback for old rows missing `status`.
  const recent = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", teamMemberId))
    .order("desc")
    .take(200)
  const open = recent.filter((s) => sessionStatus(s) === "open")
  if (open.length > 1) throw new Error("Multiple open sessions found")
  return open[0] ?? null
}

async function assertNoOverlappingSession(
  ctx: QueryCtx | MutationCtx,
  args: {
    teamMemberId: Id<"teamMembers">
    clockIn: number
    clockOut?: number
    ignoreSessionId?: Id<"clockSessions">
  },
) {
  const existing = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId_clockIn", (q) => {
      const scoped = q.eq("teamMemberId", args.teamMemberId)
      return args.clockOut === undefined ? scoped : scoped.lte("clockIn", args.clockOut)
    })
    .order("desc")
    .take(500)

  const proposedEnd = args.clockOut ?? Number.POSITIVE_INFINITY
  const overlap = existing.find((session) => {
    if (session._id === args.ignoreSessionId) return false
    const existingEnd = session.clockOut ?? Number.POSITIVE_INFINITY
    return session.clockIn < proposedEnd && args.clockIn < existingEnd
  })
  if (overlap) throw new Error("Session overlaps an existing session")
}

// Mentor-only (unlocked kiosk): open a session if none is open.
export const clockIn = mutation({
  args: { teamMemberId: v.id("teamMembers") },
  returns: v.id("clockSessions"),
  handler: async (ctx, { teamMemberId }) => {
    await requireMentor(ctx)
    await requireMember(ctx, teamMemberId)
    const existing = await openSessionFor(ctx, teamMemberId)
    if (existing) throw new Error("Already clocked in")
    const clockIn = Date.now()
    await assertNoOverlappingSession(ctx, { teamMemberId, clockIn })
    return ctx.db.insert("clockSessions", { teamMemberId, clockIn, status: "open" })
  },
})

// Mentor-only (unlocked kiosk): close the open session.
export const clockOut = mutation({
  args: { teamMemberId: v.id("teamMembers") },
  returns: v.null(),
  handler: async (ctx, { teamMemberId }) => {
    await requireMentor(ctx)
    await requireMember(ctx, teamMemberId)
    const session = await openSessionFor(ctx, teamMemberId)
    if (!session) throw new Error("Not clocked in")
    await ctx.db.patch(session._id, { clockOut: Date.now(), status: "closed" })
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
    await requireMember(ctx, args.teamMemberId)
    validateClockRange(args.clockIn, args.clockOut)
    await assertNoOverlappingSession(ctx, args)
    return ctx.db.insert("clockSessions", {
      ...args,
      status: args.clockOut === undefined ? "open" : "closed",
    })
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
    validateClockRange(clockIn, clockOut)
    const session = await ctx.db.get(id)
    if (!session) throw new Error("Session not found")
    await assertNoOverlappingSession(ctx, {
      teamMemberId: session.teamMemberId,
      clockIn,
      clockOut,
      ignoreSessionId: id,
    })
    await ctx.db.patch(id, {
      clockIn,
      clockOut,
      status: clockOut === undefined ? "open" : "closed",
    })
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
