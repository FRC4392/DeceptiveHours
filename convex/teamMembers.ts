import { mutation, query } from "./_generated/server"
import { ConvexError, v } from "convex/values"
import { requireKioskOrMentor, requireMentor } from "./authz"
import { ROSTER_LIMIT } from "./limits"
import { MEMBER_ID_HINT, isMemberId } from "./memberId"
import type { Doc } from "./_generated/dataModel"
import {
  computeDisplayGrade,
  currentSchoolYear,
  displayGradeValidator,
  studentGradeValidator,
} from "./studentInfo"

const teamMemberFields = {
  clerkUserId: v.string(),
  authTokenIdentifier: v.optional(v.string()),
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

// Shape returned by the two kiosk lookups below. Both are mentor-gated, but
// the kiosk is a shared screen that anyone can walk up to and type a memberId
// into, so `email`, `clerkUserId` and `authTokenIdentifier` are deliberately
// left out: PII and internal Clerk identifiers must not ride along in the
// response even though the current UI doesn't render them.
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

function validateMemberId(memberId: string) {
  if (!isMemberId(memberId)) throw new ConvexError(MEMBER_ID_HINT)
}

// Kiosk tablet (device token) or a signed-in mentor: resolve a scanned or
// typed memberId.
export const lookupByMemberId = query({
  args: { memberId: v.string(), kioskToken: v.optional(v.string()) },
  returns: v.union(publicMemberDoc, v.null()),
  handler: async (ctx, { memberId, kioskToken }) => {
    await requireKioskOrMentor(ctx, kioskToken)
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_memberId", (q) => q.eq("memberId", memberId))
      .unique()
    return member && toPublicMemberDoc(member)
  },
})

// Kiosk tablet (device token) or a signed-in mentor. Also backs the member
// detail page, which always calls it as a mentor.
export const getById = query({
  args: { id: v.id("teamMembers"), kioskToken: v.optional(v.string()) },
  returns: v.union(publicMemberDoc, v.null()),
  handler: async (ctx, { id, kioskToken }) => {
    await requireKioskOrMentor(ctx, kioskToken)
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
    const members = await ctx.db.query("teamMembers").take(ROSTER_LIMIT)
    if (members.length === ROSTER_LIMIT) {
      throw new ConvexError(`Roster exceeds ${ROSTER_LIMIT} members — pagination is required`)
    }
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
const MIN_START_YEAR = 2000
const MAX_START_YEAR = 2100

// `type` is deliberately absent: roles live in Clerk `publicMetadata.role` and
// every `user.updated` webhook overwrites this row's `type` from it, so a local
// role edit silently reverted — and nothing stopped a mentor demoting
// themselves out of the app. Use `api.clerk.updateUserRole` instead.
//
// The optional student fields follow the edit dialog, which always submits the
// member's full intended state: an omitted field means "clear it", not "leave
// it alone". Previously they could only ever be set, never unset.
export const update = mutation({
  args: {
    id: v.id("teamMembers"),
    firstName: v.string(),
    lastName: v.string(),
    memberId: v.string(),
    studentStartYear: v.optional(v.number()),
    studentGrade: v.optional(studentGradeValidator),
    studentGradeAsOfSchoolYear: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...fields }) => {
    await requireMentor(ctx)
    validateMemberId(fields.memberId)

    const firstName = fields.firstName.trim()
    const lastName = fields.lastName.trim()
    if (!firstName || !lastName) throw new ConvexError("First and last name are required")

    const member = await ctx.db.get(id)
    if (!member) throw new ConvexError("Member not found")
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_memberId", (q) => q.eq("memberId", fields.memberId))
      .unique()
    if (existing && existing._id !== id) throw new ConvexError("Member ID already in use")

    const patch: {
      firstName: string
      lastName: string
      memberId: string
      studentStartYear?: number
      studentGrade?: 6 | 7 | 8 | 9 | 10 | 11 | 12 | "alumni"
      studentGradeAsOfSchoolYear?: number
    } = {
      firstName,
      lastName,
      memberId: fields.memberId,
      studentStartYear: undefined,
      studentGrade: undefined,
      studentGradeAsOfSchoolYear: undefined,
    }

    if (member.type === "student") {
      if (fields.studentStartYear !== undefined) {
        const year = fields.studentStartYear
        if (!Number.isInteger(year) || year < MIN_START_YEAR || year > MAX_START_YEAR) {
          throw new ConvexError(`Start year must be a whole year between ${MIN_START_YEAR} and ${MAX_START_YEAR}`)
        }
        patch.studentStartYear = year
      }
      if (fields.studentGrade !== undefined) {
        patch.studentGrade = fields.studentGrade
        patch.studentGradeAsOfSchoolYear =
          fields.studentGradeAsOfSchoolYear ?? currentSchoolYear()
      }
    }

    await ctx.db.patch(id, patch)
    return null
  },
})
