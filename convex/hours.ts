import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import type { Doc } from "./_generated/dataModel"
import { SESSION_SCAN_LIMIT } from "./limits"
import { startOfTeamYear } from "./timeZone"
import { ConvexError } from "convex/values"

export interface HoursRange {
  startAt: number
  endAt?: number
}

const HOURS_RANGE_SETTINGS_KEY = "hoursRange"

// January 1 in the team's zone, not the server's. Convex runs in UTC, so the
// old local-`Date` version produced Jan 1 00:00 UTC, which the browser then
// rendered as "Dec 31" of the previous year — and re-saving the default from
// that prefilled field walked the start back a further day each time.
export function defaultHoursRange(now = Date.now()): HoursRange {
  return { startAt: startOfTeamYear(now) }
}

export function validateHoursRange(range: HoursRange) {
  if (!Number.isFinite(range.startAt)) throw new ConvexError("Start date must be valid")
  if (range.endAt !== undefined && !Number.isFinite(range.endAt)) {
    throw new ConvexError("End date must be valid")
  }
  if (range.endAt !== undefined && range.endAt <= range.startAt) {
    throw new ConvexError("End date must be after start date")
  }
}

export function sessionStatus(session: Doc<"clockSessions">): "open" | "closed" {
  return session.status ?? (session.clockOut === undefined ? "open" : "closed")
}

/**
 * The member's single open session, or `null`.
 *
 * Indexed on `clockOut` rather than `status`, which makes this exact for
 * pre-`status` rows too: every writer sets `clockOut` and `status` together, so
 * a missing `clockOut` is the open marker regardless of how old the row is.
 * The previous implementation checked the `status` index and then fell back to
 * scanning the 200 newest rows, so a stale open session buried under more
 * recent history was missed and the kiosk would open a second one.
 *
 * Throws on more than one, per the one-open-session-per-member invariant.
 * Shared by the kiosk, the clock mutations, and the dashboard so all three
 * agree — the dashboard previously kept its own copy that silently took the
 * first of a duplicate pair.
 */
export async function openSessionFor(
  ctx: QueryCtx | MutationCtx,
  teamMemberId: Id<"teamMembers">,
): Promise<Doc<"clockSessions"> | null> {
  const open = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId_clockOut", (q) =>
      q.eq("teamMemberId", teamMemberId).eq("clockOut", undefined),
    )
    .take(2)
  if (open.length > 1) throw new ConvexError("Multiple open sessions found")
  return open[0] ?? null
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
//
// Both range bounds go into the index so the scan limit applies to the range
// being reported on rather than to everything after `startAt`, and hitting the
// limit throws instead of quietly returning a short total — an under-reported
// hour count is worse than a visible error in an hours-tracking app.
export async function completedMsForRange(
  ctx: QueryCtx,
  teamMemberId: Id<"teamMembers">,
  range: HoursRange,
): Promise<number> {
  const sessions = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId_clockIn", (q) => {
      const scoped = q.eq("teamMemberId", teamMemberId).gte("clockIn", range.startAt)
      return range.endAt === undefined ? scoped : scoped.lt("clockIn", range.endAt)
    })
    .take(SESSION_SCAN_LIMIT)

  if (sessions.length === SESSION_SCAN_LIMIT) {
    throw new ConvexError(
      `More than ${SESSION_SCAN_LIMIT} sessions in this range — narrow the reporting range`,
    )
  }

  return sessions.reduce(
    (acc, s) =>
      sessionStatus(s) === "closed" && s.clockOut ? acc + (s.clockOut - s.clockIn) : acc,
    0,
  )
}

export { HOURS_RANGE_SETTINGS_KEY }
