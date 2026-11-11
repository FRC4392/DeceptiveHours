// The team's calendar boundaries — January 1 for the default reporting year and
// July 1 for the grade rollover — are wall-clock dates, not UTC instants.
//
// Both used to be built with local `Date` getters. Convex functions run in UTC
// while the browser runs in the viewer's zone, so the two disagreed: the
// unsaved default range resolved to Jan 1 00:00 UTC and rendered in the UI as
// "Dec 31" of the previous year, and the grade rollover fired in the evening of
// June 30 local time.
//
// Everything that needs one of these boundaries goes through this module so the
// frontend and backend compute the same instant. Change TEAM_TIME_ZONE if the
// team relocates; nothing else encodes a zone.

export const TEAM_TIME_ZONE = "America/Detroit"

type ZonedParts = { year: number; month: number; day: number }
type ZonedDateTime = ZonedParts & { hour: number; minute: number }

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

function formatted(ts: number) {
  const parts = partsFormatter.formatToParts(new Date(ts))
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  // `hour12: false` can render midnight as hour 24; normalize it to 0.
  const hour = value("hour") % 24
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour,
    minute: value("minute"),
    second: value("second"),
  }
}

/** The calendar date in the team's zone at a given instant. */
export function zonedDateParts(ts: number): ZonedParts {
  const { year, month, day } = formatted(ts)
  return { year, month, day }
}

/** Offset of the team's zone from UTC at a given instant, in ms. */
function zoneOffsetMs(ts: number): number {
  const p = formatted(ts)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // Round to the minute to absorb the second-level truncation in formatting.
  return Math.round((asIfUtc - ts) / 60_000) * 60_000
}

/**
 * The instant of midnight on a given calendar date in the team's zone.
 *
 * The offset depends on the instant, so this guesses with the UTC offset, then
 * corrects once. One pass is exact for the boundaries this app uses: US DST
 * transitions happen in March and November, so January 1 and July 1 are never
 * within a day of one.
 */
export function startOfDayInTeamZone(year: number, month: number, day: number): number {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0)
  return guess - zoneOffsetMs(guess)
}

/** January 1 of the team-zone year containing `now`, as an instant. */
export function startOfTeamYear(now: number): number {
  return startOfDayInTeamZone(zonedDateParts(now).year, 1, 1)
}

/** The wall-clock date and time in the team's zone at a given instant. */
export function zonedDateTimeParts(ts: number): ZonedDateTime {
  const { year, month, day, hour, minute } = formatted(ts)
  return { year, month, day, hour, minute }
}

/**
 * The instant at a given wall-clock date and time in the team's zone.
 *
 * Two correction passes, because a single pass picks the wrong offset for
 * times within an hour of a DST transition. Wall-clock times that do not exist
 * or occur twice on a transition day resolve to one of the two candidates
 * rather than erroring — acceptable for hand-entered clock corrections.
 */
export function instantInTeamZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0)
  let instant = target - zoneOffsetMs(target)
  instant = target - zoneOffsetMs(instant)
  return instant
}
