import { mutation, query } from "./_generated/server"
import type { QueryCtx, MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"
import { requireKioskOrMentor, requireMentor } from "./authz"
import type { Caller } from "./authz"
import {
  completedMsForRange,
  getConfiguredHoursRange,
  openSessionFor,
  validateHoursRange,
} from "./hours"
import { SESSION_SCAN_LIMIT } from "./limits"

const clockSessionDoc = v.object({
  _id: v.id("clockSessions"),
  _creationTime: v.number(),
  teamMemberId: v.id("teamMembers"),
  clockIn: v.number(),
  clockOut: v.optional(v.number()),
  status: v.optional(v.union(v.literal("open"), v.literal("closed"))),
})

// Tolerance for clock skew between the mentor's browser, which turns the
// datetime-local inputs into timestamps, and the server.
const FUTURE_TOLERANCE_MS = 5 * 60_000

function validateClockRange(clockIn: number, clockOut?: number) {
  if (!Number.isFinite(clockIn)) throw new Error("Clock in must be a valid time")
  if (clockOut !== undefined && !Number.isFinite(clockOut)) {
    throw new Error("Clock out must be a valid time")
  }
  if (clockOut !== undefined && clockOut <= clockIn) {
    throw new Error("Clock out must be after clock in")
  }
  // A future clock-in makes the live timers count down from a negative elapsed
  // time, and a future open session blocks every later clock-in for that
  // member, so neither bound may be scheduled ahead of now.
  const latest = Date.now() + FUTURE_TOLERANCE_MS
  if (clockIn > latest) throw new Error("Clock in cannot be in the future")
  if (clockOut !== undefined && clockOut > latest) {
    throw new Error("Clock out cannot be in the future")
  }
}

// Records that a kiosk is alive, so mentors can see on the devices list which
// tablet is actually in use before revoking one.
async function touchKiosk(ctx: MutationCtx, caller: Caller) {
  if (caller.kind !== "kiosk") return
  await ctx.db.patch(caller.device._id, { lastSeenAt: Date.now() })
}

async function requireMember(ctx: QueryCtx | MutationCtx, id: Id<"teamMembers">) {
  const member = await ctx.db.get(id)
  if (!member) throw new Error("Member not found")
  return member
}

// Kiosk tablet (device token) or a signed-in mentor: completed hours for the
// configured range plus the open session, if any.
export const getMemberStatus = query({
  args: { teamMemberId: v.id("teamMembers"), kioskToken: v.optional(v.string()) },
  returns: v.object({
    completedMs: v.number(),
    currentSession: v.union(clockSessionDoc, v.null()),
    hoursRange: v.object({
      startAt: v.number(),
      endAt: v.optional(v.number()),
    }),
  }),
  handler: async (ctx, { teamMemberId, kioskToken }) => {
    await requireKioskOrMentor(ctx, kioskToken)
    await requireMember(ctx, teamMemberId)
    const hoursRange = await getConfiguredHoursRange(ctx)
    const completedMs = await completedMsForRange(ctx, teamMemberId, hoursRange)
    const currentSession = await openSessionFor(ctx, teamMemberId)
    return { completedMs, currentSession, hoursRange }
  },
})

// Mentor-only: full session history for a member, newest first.
export const getForMember = query({
  args: {
    teamMemberId: v.id("teamMembers"),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
  },
  returns: v.array(clockSessionDoc),
  handler: async (ctx, { teamMemberId, startAt, endAt }) => {
    await requireMentor(ctx)
    const range = startAt === undefined ? await getConfiguredHoursRange(ctx) : { startAt, endAt }
    validateHoursRange(range)
    // Both bounds in the index, so the limit applies to the requested range.
    // The previous version took the newest 500 from `startAt` and filtered the
    // end in JS, which truncated the oldest rows while `completedMsForRange`
    // truncated the newest — the same member could show two different totals.
    const sessions = await ctx.db
      .query("clockSessions")
      .withIndex("by_teamMemberId_clockIn", (q) => {
        const scoped = q.eq("teamMemberId", teamMemberId).gte("clockIn", range.startAt)
        return range.endAt === undefined ? scoped : scoped.lt("clockIn", range.endAt)
      })
      .order("desc")
      .take(SESSION_SCAN_LIMIT)

    if (sessions.length === SESSION_SCAN_LIMIT) {
      throw new Error(
        `More than ${SESSION_SCAN_LIMIT} sessions in this range — narrow the reporting range`,
      )
    }
    return sessions
  },
})

async function assertNoOverlappingSession(
  ctx: QueryCtx | MutationCtx,
  args: {
    teamMemberId: Id<"teamMembers">
    clockIn: number
    clockOut?: number
    ignoreSessionId?: Id<"clockSessions">
  },
) {
  const proposedEnd = args.clockOut ?? Number.POSITIVE_INFINITY

  // An open session has no end, so it collides with anything starting after it
  // no matter how far back it began. It can sit anywhere in `clockIn` order, so
  // it is checked directly rather than left to the bounded walk below.
  const open = await openSessionFor(ctx, args.teamMemberId)
  if (open && open._id !== args.ignoreSessionId && open.clockIn < proposedEnd) {
    throw new Error("Session overlaps an existing session")
  }

  // Only sessions starting before the proposed end can overlap it. Walking
  // newest-first, the first closed candidate that starts at or before the
  // proposed start settles the question: sessions never overlap each other, so
  // anything earlier ends earlier still. That bounds this to a couple of reads
  // instead of the previous `.take(500)`, which could miss an overlap beyond
  // the window and silently accept a double-counted entry.
  const candidates = ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId_clockIn", (q) => {
      const scoped = q.eq("teamMemberId", args.teamMemberId)
      return args.clockOut === undefined ? scoped : scoped.lte("clockIn", args.clockOut)
    })
    .order("desc")

  for await (const session of candidates) {
    if (session._id === args.ignoreSessionId) continue
    if (session.clockOut === undefined) continue // open sessions handled above
    if (session.clockIn < proposedEnd && args.clockIn < session.clockOut) {
      throw new Error("Session overlaps an existing session")
    }
    if (session.clockIn <= args.clockIn) return
  }
}

// Kiosk tablet (device token) or a signed-in mentor: open a session if none
// is open.
export const clockIn = mutation({
  args: { teamMemberId: v.id("teamMembers"), kioskToken: v.optional(v.string()) },
  returns: v.id("clockSessions"),
  handler: async (ctx, { teamMemberId, kioskToken }) => {
    const caller = await requireKioskOrMentor(ctx, kioskToken)
    await touchKiosk(ctx, caller)
    await requireMember(ctx, teamMemberId)
    const existing = await openSessionFor(ctx, teamMemberId)
    if (existing) throw new Error("Already clocked in")
    const clockIn = Date.now()
    await assertNoOverlappingSession(ctx, { teamMemberId, clockIn })
    return ctx.db.insert("clockSessions", { teamMemberId, clockIn, status: "open" })
  },
})

// Kiosk tablet (device token) or a signed-in mentor: close the open session.
export const clockOut = mutation({
  args: { teamMemberId: v.id("teamMembers"), kioskToken: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { teamMemberId, kioskToken }) => {
    const caller = await requireKioskOrMentor(ctx, kioskToken)
    await touchKiosk(ctx, caller)
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
