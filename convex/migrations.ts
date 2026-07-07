import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { mutation } from "./_generated/server"
import { requireMentor } from "./authz"

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
