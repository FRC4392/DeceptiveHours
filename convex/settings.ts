import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { requireMentor } from "./authz"
import {
  HOURS_RANGE_SETTINGS_KEY,
  defaultHoursRange,
  validateHoursRange,
} from "./hours"

const hoursRangeDoc = v.object({
  startAt: v.number(),
  endAt: v.optional(v.number()),
})

export const getHoursRange = query({
  args: {},
  returns: hoursRangeDoc,
  handler: async (ctx) => {
    await requireMentor(ctx)
    const settings = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", HOURS_RANGE_SETTINGS_KEY))
      .unique()
    const fallback = defaultHoursRange()
    return {
      startAt: settings?.hoursRangeStart ?? fallback.startAt,
      endAt: settings?.hoursRangeEnd,
    }
  },
})

export const updateHoursRange = mutation({
  args: {
    startAt: v.number(),
    endAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMentor(ctx)
    validateHoursRange(args)
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", HOURS_RANGE_SETTINGS_KEY))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        hoursRangeStart: args.startAt,
        hoursRangeEnd: args.endAt,
      })
    } else {
      const fields: {
        key: string
        hoursRangeStart: number
        hoursRangeEnd?: number
      } = {
        key: HOURS_RANGE_SETTINGS_KEY,
        hoursRangeStart: args.startAt,
      }
      if (args.endAt !== undefined) fields.hoursRangeEnd = args.endAt
      await ctx.db.insert("appSettings", fields)
    }
    return null
  },
})
