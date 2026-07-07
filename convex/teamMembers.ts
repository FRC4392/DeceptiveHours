import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { requireMentor } from "./authz"
import type { Doc } from "./_generated/dataModel"
import {
  computeDisplayGrade,
  currentSchoolYear,
  displayGradeValidator,
  studentGradeValidator,
} from "./studentInfo"

const teamMemberFields = {
  clerkUserId: v.string(),
  email: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  memberId: v.string(),
  type: v.union(v.literal("student"), v.literal("mentor")),
  studentStartYear: v.optional(v.number()),
  studentGrade: v.optional(studentGradeValidator),
  studentGradeAsOfSchoolYear: v.optional(v.number()),
}

const teamMemberDoc = v.object({
  _id: v.id("teamMembers"),
  _creationTime: v.number(),
  ...teamMemberFields,
  displayGrade: displayGradeValidator,
})

// Shape returned by the two public (unauthenticated) lookups below.
// Deliberately excludes `email` and `clerkUserId` — those queries are
// reachable by anyone who can guess a memberId, so PII and internal Clerk
// identifiers must not ride along in the response even though the current
// UI doesn't render them.
const publicMemberDoc = v.object({
  _id: v.id("teamMembers"),
  firstName: v.string(),
  lastName: v.string(),
  memberId: v.string(),
  type: v.union(v.literal("student"), v.literal("mentor")),
  studentStartYear: v.optional(v.number()),
  studentGrade: v.optional(studentGradeValidator),
  studentGradeAsOfSchoolYear: v.optional(v.number()),
  displayGrade: displayGradeValidator,
})

function toPublicMemberDoc(member: Doc<"teamMembers">) {
  const {
    _id,
    firstName,
    lastName,
    memberId,
    type,
    studentStartYear,
    studentGrade,
    studentGradeAsOfSchoolYear,
  } = member
  return {
    _id,
    firstName,
    lastName,
    memberId,
    type,
    studentStartYear,
    studentGrade,
    studentGradeAsOfSchoolYear,
    displayGrade: computeDisplayGrade(member),
  }
}

function toTeamMemberDoc(member: Doc<"teamMembers">) {
  return {
    _id: member._id,
    _creationTime: member._creationTime,
    clerkUserId: member.clerkUserId ?? "",
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    memberId: member.memberId,
    type: member.type,
    studentStartYear: member.studentStartYear,
    studentGrade: member.studentGrade,
    studentGradeAsOfSchoolYear: member.studentGradeAsOfSchoolYear,
    displayGrade: computeDisplayGrade(member),
  }
}

const memberIdPattern = /^4392\d{6}$/

function validateMemberId(memberId: string) {
  if (!memberIdPattern.test(memberId)) {
    throw new Error("Member ID must be a 10-digit number starting with 4392")
  }
}

// Mentor-only: used by the unlocked kiosk to resolve a scanned/typed memberId.
export const lookupByMemberId = query({
  args: { memberId: v.string() },
  returns: v.union(publicMemberDoc, v.null()),
  handler: async (ctx, { memberId }) => {
    await requireMentor(ctx)
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_memberId", (q) => q.eq("memberId", memberId))
      .unique()
    return member && toPublicMemberDoc(member)
  },
})

// Mentor-only: used by the unlocked kiosk and member detail page.
export const getById = query({
  args: { id: v.id("teamMembers") },
  returns: v.union(publicMemberDoc, v.null()),
  handler: async (ctx, { id }) => {
    await requireMentor(ctx)
    const member = await ctx.db.get(id)
    return member && toPublicMemberDoc(member)
  },
})

// Mentor-only: full roster for the authenticated app area.
export const list = query({
  args: {},
  returns: v.array(teamMemberDoc),
  handler: async (ctx) => {
    await requireMentor(ctx)
    const members = await ctx.db.query("teamMembers").take(500)
    return members
      .map(toTeamMemberDoc)
      .sort((a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName) ||
        a.memberId.localeCompare(b.memberId),
      )
  },
})

// Mentor-only local correction of a synced roster row. The roster of record is
// Clerk (via webhooks); this exists for on-the-spot fixes. `clerkUserId` is
// immutable and never edited here.
export const update = mutation({
  args: {
    id: v.id("teamMembers"),
    firstName: v.string(),
    lastName: v.string(),
    memberId: v.string(),
    type: v.union(v.literal("student"), v.literal("mentor")),
    studentStartYear: v.optional(v.number()),
    studentGrade: v.optional(studentGradeValidator),
    studentGradeAsOfSchoolYear: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...fields }) => {
    await requireMentor(ctx)
    validateMemberId(fields.memberId)
    const member = await ctx.db.get(id)
    if (!member) throw new Error("Member not found")
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_memberId", (q) => q.eq("memberId", fields.memberId))
      .unique()
    if (existing && existing._id !== id) throw new Error("Member ID already in use")
    const patch: {
      firstName: string
      lastName: string
      memberId: string
      type: "student" | "mentor"
      studentStartYear?: number
      studentGrade?: 6 | 7 | 8 | 9 | 10 | 11 | 12 | "alumni"
      studentGradeAsOfSchoolYear?: number
    } = {
      firstName: fields.firstName,
      lastName: fields.lastName,
      memberId: fields.memberId,
      type: fields.type,
    }
    if (fields.type === "student") {
      if (fields.studentStartYear !== undefined) {
        if (!Number.isInteger(fields.studentStartYear)) throw new Error("Start year must be a whole year")
        patch.studentStartYear = fields.studentStartYear
      }
      if (fields.studentGrade !== undefined) {
        patch.studentGrade = fields.studentGrade
        patch.studentGradeAsOfSchoolYear =
          fields.studentGradeAsOfSchoolYear ?? currentSchoolYear()
      }
    } else {
      patch.studentStartYear = undefined
      patch.studentGrade = undefined
      patch.studentGradeAsOfSchoolYear = undefined
    }
    await ctx.db.patch(id, patch)
    return null
  },
})

// Mentor-only local removal. Note: this does not delete the user in Clerk; the
// next webhook sync may re-create the row. Use `api.clerk.removeUser` to remove
// the user upstream. Cascade-deletes the member's clockSessions.
export const remove = mutation({
  args: { id: v.id("teamMembers") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireMentor(ctx)
    const sessions = await ctx.db
      .query("clockSessions")
      .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", id))
      .take(500)
    if (sessions.length === 500) {
      throw new Error("Member has too many sessions to remove in one operation")
    }
    await Promise.all(sessions.map((s) => ctx.db.delete(s._id)))
    await ctx.db.delete(id)
    return null
  },
})
