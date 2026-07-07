import type { QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import type { Doc } from "./_generated/dataModel"

export interface HoursRange {
  startAt: number
  endAt?: number
}

const HOURS_RANGE_SETTINGS_KEY = "hoursRange"

export function defaultHoursRange(now = Date.now()): HoursRange {
  const d = new Date(now)
  return { startAt: new Date(d.getFullYear(), 0, 1).getTime() }
}

export function validateHoursRange(range: HoursRange) {
  if (!Number.isFinite(range.startAt)) throw new Error("Start date must be valid")
  if (range.endAt !== undefined && !Number.isFinite(range.endAt)) {
    throw new Error("End date must be valid")
  }
  if (range.endAt !== undefined && range.endAt <= range.startAt) {
    throw new Error("End date must be after start date")
  }
}

export function sessionStatus(session: Doc<"clockSessions">): "open" | "closed" {
  return session.status ?? (session.clockOut === undefined ? "open" : "closed")
}

export async function getConfiguredHoursRange(ctx: QueryCtx): Promise<HoursRange> {
  const settings = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", HOURS_RANGE_SETTINGS_KEY))
    .unique()
  const fallback = defaultHoursRange()
  const range = {
    startAt: settings?.hoursRangeStart ?? fallback.startAt,
    endAt: settings?.hoursRangeEnd,
  }
  validateHoursRange(range)
  return range
}

export async function resolveHoursRange(
  ctx: QueryCtx,
  override?: Partial<HoursRange>,
): Promise<HoursRange> {
  const configured = await getConfiguredHoursRange(ctx)
  const range = {
    startAt: override?.startAt ?? configured.startAt,
    endAt: override?.endAt ?? configured.endAt,
  }
  validateHoursRange(range)
  return range
}

// Range convention: clock-in must be >= startAt and < endAt when an end is set.
// Active sessions are omitted from completed-hour totals until they are closed.
export async function completedMsForRange(
  ctx: QueryCtx,
  teamMemberId: Id<"teamMembers">,
  range: HoursRange,
): Promise<number> {
  const sessions = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId_clockIn", (q) =>
      q.eq("teamMemberId", teamMemberId).gte("clockIn", range.startAt),
    )
    .take(500)

  return sessions.reduce((acc, s) => {
    if (range.endAt !== undefined && s.clockIn >= range.endAt) return acc
    if (sessionStatus(s) === "closed" && s.clockOut) return acc + (s.clockOut - s.clockIn)
    return acc
  }, 0)
}

export { HOURS_RANGE_SETTINGS_KEY }
