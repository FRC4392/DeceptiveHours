/// <reference types="vite/client" />
import { describe, expect, test } from "vitest"
import { defaultHoursRange } from "./hours"
import { currentSchoolYear } from "./studentInfo"
import {
  TEAM_TIME_ZONE,
  instantInTeamZone,
  startOfDayInTeamZone,
  zonedDateParts,
  zonedDateTimeParts,
} from "./timeZone"

// Convex functions run in UTC, so every assertion here would have failed
// against the previous local-`Date` implementations.
describe("team time zone", () => {
  test("midnight in the team zone is not midnight UTC", () => {
    // 2026-01-01 00:00 in America/Detroit is 05:00 UTC (EST, UTC-5).
    const start = startOfDayInTeamZone(2026, 1, 1)
    expect(new Date(start).toISOString()).toBe("2026-01-01T05:00:00.000Z")
    expect(zonedDateParts(start)).toEqual({ year: 2026, month: 1, day: 1 })
  })

  test("the default reporting range starts on January 1 team-time", () => {
    const now = Date.UTC(2026, 5, 15, 12)
    const { startAt } = defaultHoursRange(now)
    expect(zonedDateParts(startAt)).toEqual({ year: 2026, month: 1, day: 1 })
    // The old version returned Jan 1 00:00 UTC, which renders as Dec 31 for any
    // negative-offset zone — the "Showing Dec 31, 2025 to now" bug.
    expect(
      new Date(startAt).toLocaleDateString("en-US", { timeZone: TEAM_TIME_ZONE }),
    ).toBe("1/1/2026")
  })

  test("the school year rolls over at July 1 team-time, not UTC", () => {
    // 2027-07-01 00:00 EDT is 04:00 UTC. In the four hours between, the old
    // UTC-based backend had already advanced every student's grade.
    const justBefore = Date.UTC(2027, 6, 1, 3, 59)
    const justAfter = Date.UTC(2027, 6, 1, 4, 1)
    expect(currentSchoolYear(justBefore)).toBe(2026)
    expect(currentSchoolYear(justAfter)).toBe(2027)
  })

  test("wall-clock round trips across a DST boundary", () => {
    for (const [month, day] of [
      [1, 15],
      [7, 15],
      [3, 8],
      [11, 1],
    ]) {
      const instant = instantInTeamZone(2026, month, day, 14, 30)
      expect(zonedDateTimeParts(instant)).toEqual({
        year: 2026,
        month,
        day,
        hour: 14,
        minute: 30,
      })
    }
  })

  test("an exclusive end date rolls over month and year boundaries", () => {
    expect(zonedDateParts(startOfDayInTeamZone(2026, 1, 32))).toEqual({
      year: 2026,
      month: 2,
      day: 1,
    })
    expect(zonedDateParts(startOfDayInTeamZone(2026, 12, 32))).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    })
  })
})
