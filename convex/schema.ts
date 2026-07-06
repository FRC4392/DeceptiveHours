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
  })
    .index("by_teamMemberId", ["teamMemberId"])
    .index("by_teamMemberId_clockIn", ["teamMemberId", "clockIn"]),
})
