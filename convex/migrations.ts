import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { mutation } from "./_generated/server"
import { requireMentor } from "./authz"

function clerkAuthTokenIdentifier(clerkUserId: string): string {
  const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN
  if (!issuer) throw new Error("CLERK_JWT_ISSUER_DOMAIN must be set")
  return `${issuer}|${clerkUserId}`
}

export const backfillClockSessionStatus = mutation({
  args: {
    paginationOpts: paginationOptsValidator,
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    patched: v.number(),
    scanned: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { paginationOpts, dryRun }) => {
    await requireMentor(ctx)

    const page = await ctx.db.query("clockSessions").paginate(paginationOpts)
    let patched = 0

    for (const session of page.page) {
      if (session.status !== undefined) continue
      patched += 1
      if (!dryRun) {
        await ctx.db.patch(session._id, {
          status: session.clockOut === undefined ? "open" : "closed",
        })
      }
    }

    return {
      patched,
      scanned: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    }
  },
})

export const backfillClerkAuthTokenIdentifiers = mutation({
  args: {
    paginationOpts: paginationOptsValidator,
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    patched: v.number(),
    scanned: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { paginationOpts, dryRun }) => {
    await requireMentor(ctx)

    const page = await ctx.db.query("teamMembers").paginate(paginationOpts)
    let patched = 0

    for (const member of page.page) {
      if (!member.clerkUserId) continue
      const authTokenIdentifier = clerkAuthTokenIdentifier(member.clerkUserId)
      if (member.authTokenIdentifier === authTokenIdentifier) continue
      patched += 1
      if (!dryRun) {
        await ctx.db.patch(member._id, { authTokenIdentifier })
      }
    }

    return {
      patched,
      scanned: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    }
  },
})

export const clearWorkosEraRoster = mutation({
  args: {
    confirmation: v.string(),
  },
  returns: v.object({
    deletedClockSessions: v.number(),
    deletedTeamMembers: v.number(),
  }),
  handler: async (ctx, { confirmation }) => {
    if (process.env.ENABLE_DESTRUCTIVE_MIGRATIONS !== "true") {
      throw new Error("ENABLE_DESTRUCTIVE_MIGRATIONS must be true")
    }
    if (confirmation !== "DELETE_WORKOS_ROSTER") {
      throw new Error("Invalid confirmation")
    }

    const sessions = await ctx.db.query("clockSessions").take(500)
    if (sessions.length === 500) {
      throw new Error("Too many clock sessions to clear in one run")
    }
    const members = await ctx.db.query("teamMembers").take(500)
    if (members.length === 500) {
      throw new Error("Too many team members to clear in one run")
    }

    await Promise.all(sessions.map((session) => ctx.db.delete(session._id)))
    await Promise.all(members.map((member) => ctx.db.delete(member._id)))

    return {
      deletedClockSessions: sessions.length,
      deletedTeamMembers: members.length,
    }
  },
})
