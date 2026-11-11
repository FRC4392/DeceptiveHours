import {
  TEAM_TIME_ZONE,
  instantInTeamZone,
  startOfDayInTeamZone,
  zonedDateParts,
  zonedDateTimeParts,
} from "@convex/timeZone"

// Clamped at zero: a negative duration (a clock-skewed device, or a legacy
// future-dated session written before the server rejected them) would otherwise
// render as "-1:-1:-5" rather than a time.
export function formatDuration(ms: number): string {
  const total = Math.max(0, ms)
  const h = Math.floor(total / 3_600_000)
  const m = Math.floor((total % 3_600_000) / 60_000)
  const s = Math.floor((total % 60_000) / 1_000)
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function formatTotalHours(ms: number): string {
  return (ms / 3_600_000).toFixed(1)
}

// Every date in the app is a team-calendar date, so all of these render and
// parse in TEAM_TIME_ZONE rather than the viewer's. For a mentor in the team's
// own zone this is identical to the previous browser-local behaviour; for
// anyone else it stops the displayed day drifting from the day the backend
// counted the session under.
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    timeZone: TEAM_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    timeZone: TEAM_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const pad = (n: number) => String(n).padStart(2, "0")

function parseDateInput(s: string) {
  const [year, month, day] = s.split("-").map(Number)
  return { year, month, day }
}

export function toDatetimeLocal(ts: number): string {
  const { year, month, day, hour, minute } = zonedDateTimeParts(ts)
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
}

export function fromDatetimeLocal(s: string): number {
  const [date, time] = s.split("T")
  const { year, month, day } = parseDateInput(date)
  const [hour, minute] = (time ?? "00:00").split(":").map(Number)
  return instantInTeamZone(year, month, day, hour, minute)
}

export function toDateInput(ts: number): string {
  const { year, month, day } = zonedDateParts(ts)
  return `${year}-${pad(month)}-${pad(day)}`
}

export function fromDateInput(s: string): number {
  const { year, month, day } = parseDateInput(s)
  return startOfDayInTeamZone(year, month, day)
}

// The UI's end date is inclusive while the stored range end is exclusive, so
// this is midnight the following day. `Date.UTC` normalizes a day past the end
// of the month, so no month/year rollover handling is needed here.
export function fromDateInputExclusiveEnd(s: string): number {
  const { year, month, day } = parseDateInput(s)
  return startOfDayInTeamZone(year, month, day + 1)
}
