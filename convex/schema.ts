import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  teamMembers: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    memberId: v.string(),
    type: v.union(v.literal("student"), v.literal("mentor")),
  })
    .index("by_memberId", ["memberId"])
    .index("by_workosUserId", ["workosUserId"]),

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
    .index("by_status", ["status"]),
})
