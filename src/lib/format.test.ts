import { describe, expect, test } from "vitest"
import {
  formatDuration,
  fromDateInput,
  fromDateInputExclusiveEnd,
  fromDatetimeLocal,
  toDateInput,
  toDatetimeLocal,
} from "./format"
import { isStaleSession, STALE_SESSION_MS } from "./sessions"
import { initials } from "./student-info"
import { isMemberId } from "@convex/memberId"

describe("formatDuration", () => {
  test("formats hours, minutes and seconds", () => {
    expect(formatDuration(0)).toBe("0:00:00")
    expect(formatDuration(3_661_000)).toBe("1:01:01")
    expect(formatDuration(45_296_000)).toBe("12:34:56")
  })

  test("clamps negatives instead of rendering -1:-1:-5", () => {
    expect(formatDuration(-5_000)).toBe("0:00:00")
  })
})

describe("team-zone date inputs", () => {
  test("date inputs round trip", () => {
    expect(toDateInput(fromDateInput("2026-03-14"))).toBe("2026-03-14")
    expect(toDatetimeLocal(fromDatetimeLocal("2026-03-14T09:30"))).toBe(
      "2026-03-14T09:30",
    )
  })

  test("an inclusive end date becomes the following midnight", () => {
    const end = fromDateInputExclusiveEnd("2026-01-31")
    expect(toDateInput(end)).toBe("2026-02-01")
    // Displays subtract 1ms to show the inclusive day back to the user.
    expect(toDateInput(end - 1)).toBe("2026-01-31")
  })

  test("a date input is midnight team-time, not midnight UTC", () => {
    expect(new Date(fromDateInput("2026-01-01")).toISOString()).toBe(
      "2026-01-01T05:00:00.000Z",
    )
  })
})

describe("initials", () => {
  test("uses the first letter of each name", () => {
    expect(initials("Sam", "Student")).toBe("SS")
  })

  test("degrades gracefully when the webhook supplied an empty name", () => {
    expect(initials("", "Student")).toBe("S")
    expect(initials("Sam", "")).toBe("S")
    expect(initials("", "")).toBe("?")
    expect(initials("  ", " ")).toBe("?")
  })
})

describe("member IDs", () => {
  test("accepts only the team's ten-digit format", () => {
    expect(isMemberId("4392000001")).toBe(true)
    expect(isMemberId("4392")).toBe(false)
    expect(isMemberId("1234000001")).toBe(false)
    expect(isMemberId("43920000011")).toBe(false)
    expect(isMemberId("https://example.com")).toBe(false)
    expect(isMemberId("")).toBe(false)
  })
})

describe("stale sessions", () => {
  test("flags only sessions open past the threshold", () => {
    const now = Date.UTC(2026, 2, 14, 18)
    expect(isStaleSession(now - STALE_SESSION_MS + 1_000, now)).toBe(false)
    expect(isStaleSession(now - STALE_SESSION_MS, now)).toBe(true)
    expect(isStaleSession(now - 2 * STALE_SESSION_MS, now)).toBe(true)
  })
})
