import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  teamMembers: defineTable({
    clerkUserId: v.optional(v.string()),
    authTokenIdentifier: v.optional(v.string()),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    memberId: v.string(),
    type: v.union(v.literal("student"), v.literal("mentor")),
    studentStartYear: v.optional(v.number()),
    studentGrade: v.optional(
      v.union(
        v.literal(6),
        v.literal(7),
        v.literal(8),
        v.literal(9),
        v.literal(10),
        v.literal(11),
        v.literal(12),
        v.literal("alumni"),
      ),
    ),
    studentGradeAsOfSchoolYear: v.optional(v.number()),
  })
    .index("by_memberId", ["memberId"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_authTokenIdentifier", ["authTokenIdentifier"]),

  // A shared tablet left running in the room. It holds a long-lived device
  // token instead of a mentor's Clerk session, so walking up to it grants the
  // clock screen and nothing else — no roster, no invites, no deletions.
  //
  // Only the SHA-256 of the token is stored: the plaintext is shown once, at
  // setup, and never again.
  kioskDevices: defineTable({
    name: v.string(),
    tokenHash: v.string(),
    createdByMemberId: v.id("teamMembers"),
    expiresAt: v.number(),
    lastSeenAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  }).index("by_tokenHash", ["tokenHash"]),

  appSettings: defineTable({
    key: v.string(),
    hoursRangeStart: v.optional(v.number()),
    hoursRangeEnd: v.optional(v.number()),
  }).index("by_key", ["key"]),

  clockSessions: defineTable({
    teamMemberId: v.id("teamMembers"),
    clockIn: v.number(),
    clockOut: v.optional(v.number()),
    // Optional during the widen-migrate-narrow rollout. New writes populate it;
    // old rows are interpreted from clockOut until backfilled.
    status: v.optional(v.union(v.literal("open"), v.literal("closed"))),
  })
    .index("by_teamMemberId", ["teamMemberId"])
    .index("by_teamMemberId_clockIn", ["teamMemberId", "clockIn"])
    .index("by_teamMemberId_and_status", ["teamMemberId", "status"])
    .index("by_status", ["status"])
    // `clockOut: undefined` is the definitive open-session marker for both new
    // and pre-`status` rows, so this index answers "is this member clocked in?"
    // exactly, without the bounded scan the status rollout used to need.
    .index("by_teamMemberId_clockOut", ["teamMemberId", "clockOut"]),
})
