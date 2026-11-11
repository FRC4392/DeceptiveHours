import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import { zonedDateParts } from "./timeZone"

export const studentGradeValidator = v.union(
  v.literal(6),
  v.literal(7),
  v.literal(8),
  v.literal(9),
  v.literal(10),
  v.literal(11),
  v.literal(12),
  v.literal("alumni"),
)

export const displayGradeValidator = v.union(studentGradeValidator, v.null())

export type StudentGrade = 6 | 7 | 8 | 9 | 10 | 11 | 12 | "alumni"

// School years roll over on July 1. For example, June 2027 is still the 2026
// school year, while July 2027 starts the 2027 school year.
//
// Evaluated in the team's zone: with the server's local date (UTC on Convex)
// the rollover landed on the evening of June 30 team-time, so for a few hours
// every year the backend advanced grades that the browser had not.
export function currentSchoolYear(now = Date.now()): number {
  const { year, month } = zonedDateParts(now)
  return month >= 7 ? year : year - 1
}

export function computeDisplayGrade(
  member: Pick<Doc<"teamMembers">, "type" | "studentGrade" | "studentGradeAsOfSchoolYear">,
  now = Date.now(),
): StudentGrade | null {
  if (member.type !== "student" || member.studentGrade === undefined) return null
  if (member.studentGrade === "alumni") return "alumni"
  const asOf = member.studentGradeAsOfSchoolYear ?? currentSchoolYear(now)
  const advanced = member.studentGrade + Math.max(0, currentSchoolYear(now) - asOf)
  return advanced > 12 ? "alumni" : (advanced as StudentGrade)
}
