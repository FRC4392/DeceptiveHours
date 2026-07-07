import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { requireMentor } from "./authz"
import type { Doc } from "./_generated/dataModel"

const teamMemberFields = {
  workosUserId: v.string(),
  email: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  memberId: v.string(),
  type: v.union(v.literal("student"), v.literal("mentor")),
}

const teamMemberDoc = v.object({
  _id: v.id("teamMembers"),
  _creationTime: v.number(),
  ...teamMemberFields,
})

// Shape returned by the two public (unauthenticated) lookups below.
// Deliberately excludes `email` and `workosUserId` — those queries are
// reachable by anyone who can guess a memberId, so PII and internal WorkOS
// identifiers must not ride along in the response even though the current
// UI doesn't render them.
const publicMemberDoc = v.object({
  _id: v.id("teamMembers"),
  firstName: v.string(),
  lastName: v.string(),
  memberId: v.string(),
  type: v.union(v.literal("student"), v.literal("mentor")),
})

function toPublicMemberDoc(member: Doc<"teamMembers">) {
  const { _id, firstName, lastName, memberId, type } = member
  return { _id, firstName, lastName, memberId, type }
}

// Public: used by the kiosk to resolve a scanned/typed 6-digit memberId.
export const lookupByMemberId = query({
  args: { memberId: v.string() },
  returns: v.union(publicMemberDoc, v.null()),
  handler: async (ctx, { memberId }) => {
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_memberId", (q) => q.eq("memberId", memberId))
      .unique()
    return member && toPublicMemberDoc(member)
  },
})

// Public: used by the kiosk to resolve a member by document id.
export const getById = query({
  args: { id: v.id("teamMembers") },
  returns: v.union(publicMemberDoc, v.null()),
  handler: async (ctx, { id }) => {
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
    return ctx.db.query("teamMembers").collect()
  },
})

// Mentor-only local correction of a synced roster row. The roster of record is
// WorkOS (via webhooks); this exists for on-the-spot fixes. `workosUserId` is
// immutable and never edited here.
export const update = mutation({
  args: {
    id: v.id("teamMembers"),
    firstName: v.string(),
    lastName: v.string(),
    memberId: v.string(),
    type: v.union(v.literal("student"), v.literal("mentor")),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...fields }) => {
    await requireMentor(ctx)
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_memberId", (q) => q.eq("memberId", fields.memberId))
      .unique()
    if (existing && existing._id !== id) throw new Error("Member ID already in use")
    await ctx.db.patch(id, fields)
    return null
  },
})

// Mentor-only local removal. Note: this does not delete the user in WorkOS; the
// next webhook sync may re-create the row. Use `api.workos.removeUser` to remove
// the user upstream. Cascade-deletes the member's clockSessions.
export const remove = mutation({
  args: { id: v.id("teamMembers") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireMentor(ctx)
    const sessions = await ctx.db
      .query("clockSessions")
      .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", id))
      .collect()
    await Promise.all(sessions.map((s) => ctx.db.delete(s._id)))
    await ctx.db.delete(id)
    return null
  },
})
