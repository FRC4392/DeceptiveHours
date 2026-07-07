import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"

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

export function currentSchoolYear(now = Date.now()): number {
  const d = new Date(now)
  // School years roll over on July 1. For example, June 2027 is still the
  // 2026 school year, while July 2027 starts the 2027 school year.
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
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

export function formatGrade(grade: StudentGrade | null | undefined): string {
  if (grade === null || grade === undefined) return ""
  return grade === "alumni" ? "Alumni" : String(grade)
}
