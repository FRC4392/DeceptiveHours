import { query } from "./_generated/server"
import { v } from "convex/values"
import { requireMentor } from "./authz"
import type { Doc, Id } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"

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

const memberWithStats = v.object({
  _id: v.id("teamMembers"),
  _creationTime: v.number(),
  workosUserId: v.string(),
  email: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  memberId: v.string(),
  type: v.union(v.literal("student"), v.literal("mentor")),
  completedMs: v.number(),
  currentSession: v.union(clockSessionDoc, v.null()),
})

function sessionStatus(session: Doc<"clockSessions">): "open" | "closed" {
  return session.status ?? (session.clockOut === undefined ? "open" : "closed")
}

async function openSessionFor(ctx: QueryCtx, teamMemberId: Id<"teamMembers">) {
  const indexed = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId_and_status", (q) =>
      q.eq("teamMemberId", teamMemberId).eq("status", "open"),
    )
    .take(2)
  if (indexed[0]) return indexed[0]

  const recent = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", teamMemberId))
    .order("desc")
    .take(200)
  return recent.find((s) => sessionStatus(s) === "open") ?? null
}

async function completedMsForYear(ctx: QueryCtx, teamMemberId: Id<"teamMembers">) {
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

// Mentor-only: aggregate roster + hours for the authenticated dashboard.
export const getDashboardData = query({
  args: {},
  returns: v.object({
    members: v.array(memberWithStats),
    currentlySignedIn: v.array(memberWithStats),
    totalCompletedMs: v.number(),
  }),
  handler: async (ctx) => {
    await requireMentor(ctx)

    const members = await ctx.db.query("teamMembers").collect()
    const membersWithStats = await Promise.all(members.map(async (member) => {
      const [currentSession, completedMs] = await Promise.all([
        openSessionFor(ctx, member._id),
        completedMsForYear(ctx, member._id),
      ])
      return { ...member, completedMs, currentSession }
    }))

    const currentlySignedIn = membersWithStats.filter((m) => m.currentSession !== null)
    const totalCompletedMs = membersWithStats.reduce((acc, m) => acc + m.completedMs, 0)

    return { members: membersWithStats, currentlySignedIn, totalCompletedMs }
  },
})
