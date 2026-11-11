import { zonedDateParts } from "@convex/timeZone"

export type StudentGrade = 6 | 7 | 8 | 9 | 10 | 11 | 12 | "alumni"

// Clerk webhooks default a missing name to "", so indexing [0] blindly rendered
// an empty avatar. Falls back to the other name, then to a placeholder.
export function initials(firstName: string, lastName: string): string {
  const letters = `${firstName.trim()[0] ?? ""}${lastName.trim()[0] ?? ""}`
  return letters || "?"
}

// Mirrors `currentSchoolYear` in convex/studentInfo.ts — keep the two in sync.
// Both read the calendar date from the shared team-zone helper so the rollover
// instant cannot drift between the browser and the backend.
export function currentSchoolYear(now = Date.now()): number {
  const { year, month } = zonedDateParts(now)
  return month >= 7 ? year : year - 1
}

export function formatStudentGrade(grade: StudentGrade | null | undefined): string {
  if (grade === null || grade === undefined) return ""
  return grade === "alumni" ? "Alumni" : String(grade)
}
