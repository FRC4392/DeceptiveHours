export type StudentGrade = 6 | 7 | 8 | 9 | 10 | 11 | 12 | "alumni"

export function currentSchoolYear(now = Date.now()): number {
  const d = new Date(now)
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
}

export function formatStudentGrade(grade: StudentGrade | null | undefined): string {
  if (grade === null || grade === undefined) return ""
  return grade === "alumni" ? "Alumni" : String(grade)
}
