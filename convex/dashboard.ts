import { query } from "./_generated/server"
import { v } from "convex/values"
import { requireMentor } from "./authz"
import type { Id } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
import { completedMsForRange, resolveHoursRange, sessionStatus } from "./hours"
import { computeDisplayGrade, displayGradeValidator, studentGradeValidator } from "./studentInfo"

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
  studentStartYear: v.optional(v.number()),
  studentGrade: v.optional(studentGradeValidator),
  studentGradeAsOfSchoolYear: v.optional(v.number()),
  displayGrade: displayGradeValidator,
  completedMs: v.number(),
  currentSession: v.union(clockSessionDoc, v.null()),
})

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

// Mentor-only: aggregate roster + hours for the authenticated dashboard.
export const getDashboardData = query({
  args: {
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
  },
  returns: v.object({
    members: v.array(memberWithStats),
    currentlySignedIn: v.array(memberWithStats),
    totalCompletedMs: v.number(),
    hoursRange: v.object({
      startAt: v.number(),
      endAt: v.optional(v.number()),
    }),
  }),
  handler: async (ctx, args) => {
    await requireMentor(ctx)

    const hoursRange = await resolveHoursRange(ctx, args)
    const members = await ctx.db.query("teamMembers").take(500)
    const membersWithStats = await Promise.all(members.map(async (member) => {
      const [currentSession, completedMs] = await Promise.all([
        openSessionFor(ctx, member._id),
        completedMsForRange(ctx, member._id, hoursRange),
      ])
      return {
        ...member,
        displayGrade: computeDisplayGrade(member),
        completedMs,
        currentSession,
      }
    }))
    membersWithStats.sort((a, b) =>
      b.completedMs - a.completedMs ||
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName) ||
      a.memberId.localeCompare(b.memberId),
    )

    const currentlySignedIn = membersWithStats.filter((m) => m.currentSession !== null)
    const totalCompletedMs = membersWithStats.reduce((acc, m) => acc + m.completedMs, 0)

    return { members: membersWithStats, currentlySignedIn, totalCompletedMs, hoursRange }
  },
})
