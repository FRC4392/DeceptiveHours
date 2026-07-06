import { query } from "./_generated/server"
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
    const allSessions = await ctx.db.query("clockSessions").collect()

    const ys = yearStart()

    const membersWithStats = members.map((member) => {
      const sessions = allSessions.filter((s) => s.teamMemberId === member._id)
      const currentSession = sessions.find((s) => s.clockOut === undefined) ?? null
      const completedMs = sessions.reduce((acc, s) => {
        if (s.clockOut && s.clockIn >= ys) return acc + (s.clockOut - s.clockIn)
        return acc
      }, 0)
      return { ...member, completedMs, currentSession }
    })

    const currentlySignedIn = membersWithStats.filter((m) => m.currentSession !== null)
    const totalCompletedMs = membersWithStats.reduce((acc, m) => acc + m.completedMs, 0)

    return { members: membersWithStats, currentlySignedIn, totalCompletedMs }
  },
})
