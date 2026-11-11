/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
import { computeDisplayGrade, currentSchoolYear } from "./studentInfo"
import { SESSION_SCAN_LIMIT } from "./limits"

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"])
type TestBackend = ReturnType<typeof convexTest>

async function seedRoster(t: Pick<TestBackend, "run">) {
  return t.run(async (ctx) => {
    const mentorId = await ctx.db.insert("teamMembers", {
      clerkUserId: "mentor-user",
      email: "mentor@example.com",
      firstName: "Mira",
      lastName: "Mentor",
      memberId: "4392000001",
      type: "mentor",
    })
    const studentId = await ctx.db.insert("teamMembers", {
      clerkUserId: "student-user",
      email: "student@example.com",
      firstName: "Sam",
      lastName: "Student",
      memberId: "4392000002",
      type: "student",
    })
    return { mentorId, studentId }
  })
}

function setup() {
  const t = convexTest(schema, modules)
  return {
    t,
    mentor: t.withIdentity({ subject: "mentor-user" }),
    student: t.withIdentity({ subject: "student-user" }),
  }
}

describe("clock sessions", () => {
  test("kiosk lookup and clock actions require a mentor identity", async () => {
    const { t, mentor, student } = setup()
    const { studentId } = await seedRoster(t)

    await expect(
      t.query(api.teamMembers.lookupByMemberId, { memberId: "4392000002" }),
    ).rejects.toThrow("Unauthorized")
    await expect(
      student.query(api.teamMembers.lookupByMemberId, { memberId: "4392000002" }),
    ).rejects.toThrow("Forbidden")
    await expect(
      student.mutation(api.clockSessions.clockIn, { teamMemberId: studentId }),
    ).rejects.toThrow("Forbidden")

    const member = await mentor.query(api.teamMembers.lookupByMemberId, {
      memberId: "4392000002",
    })
    expect(member?._id).toBe(studentId)
  })

  test("clock in and out write open and closed status", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)

    const sessionId = await mentor.mutation(api.clockSessions.clockIn, {
      teamMemberId: studentId,
    })
    let session = await t.run((ctx) => ctx.db.get(sessionId))
    expect(session?.status).toBe("open")

    await expect(
      mentor.mutation(api.clockSessions.clockIn, { teamMemberId: studentId }),
    ).rejects.toThrow("Already clocked in")

    await mentor.mutation(api.clockSessions.clockOut, { teamMemberId: studentId })
    session = await t.run((ctx) => ctx.db.get(sessionId))
    expect(session?.status).toBe("closed")
    expect(session?.clockOut).toBeTypeOf("number")
  })

  test("manual sessions validate ranges, members, and overlaps", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)
    const missingMemberId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("teamMembers", {
        clerkUserId: "missing-user",
        email: "missing@example.com",
        firstName: "Missing",
        lastName: "Member",
        memberId: "4392000003",
        type: "student",
      })
      await ctx.db.delete(id)
      return id
    })

    await expect(
      mentor.mutation(api.clockSessions.addSession, {
        teamMemberId: missingMemberId,
        clockIn: 1,
        clockOut: 2,
      }),
    ).rejects.toThrow("Member not found")
    await expect(
      mentor.mutation(api.clockSessions.addSession, {
        teamMemberId: studentId,
        clockIn: 2,
        clockOut: 1,
      }),
    ).rejects.toThrow("Clock out must be after clock in")

    await mentor.mutation(api.clockSessions.addSession, {
      teamMemberId: studentId,
      clockIn: 1_000,
      clockOut: 2_000,
    })
    await expect(
      mentor.mutation(api.clockSessions.addSession, {
        teamMemberId: studentId,
        clockIn: 1_500,
        clockOut: 2_500,
      }),
    ).rejects.toThrow("Session overlaps")
  })

  test("dashboard and status reads include legacy rows missing status", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)
    const now = Date.now()

    await t.run(async (ctx) => {
      await ctx.db.insert("clockSessions", {
        teamMemberId: studentId,
        clockIn: now - 3_600_000,
        clockOut: now,
      })
      await ctx.db.insert("clockSessions", {
        teamMemberId: studentId,
        clockIn: now - 60_000,
      })
    })

    const status = await mentor.query(api.clockSessions.getMemberStatus, {
      teamMemberId: studentId,
    })
    expect(status.completedMs).toBeGreaterThan(0)
    expect(status.currentSession?.teamMemberId).toBe(studentId)

    const dashboard = await mentor.query(api.dashboard.getDashboardData, {})
    const member = dashboard.members.find((m) => m._id === studentId)
    expect(member?.completedMs).toBeGreaterThan(0)
    expect(member?.currentSession?.teamMemberId).toBe(studentId)
  })

  test("member ID and migration backfill validation", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)

    await expect(
      mentor.mutation(api.teamMembers.update, {
        id: studentId,
        firstName: "Sam",
        lastName: "Student",
        memberId: "123",
      }),
    ).rejects.toThrow("Member ID")

    const sessionId = await t.run((ctx) =>
      ctx.db.insert("clockSessions", {
        teamMemberId: studentId,
        clockIn: 1_000,
        clockOut: 2_000,
      }),
    )
    const result = await mentor.mutation(api.migrations.backfillClockSessionStatus, {
      paginationOpts: { numItems: 10, cursor: null },
      dryRun: false,
    })
    expect(result.patched).toBeGreaterThanOrEqual(1)
    const session = await t.run((ctx) => ctx.db.get(sessionId))
    expect(session?.status).toBe("closed")
  })

  test("overlap check finds an open session buried beyond the old 500-row window", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)

    // Stale open session, then far more recent rows than the previous
    // `.take(500)` overlap window could hold. The old code only inspected the
    // newest 500 and so let a second open session through.
    await t.run(async (ctx) => {
      await ctx.db.insert("clockSessions", {
        teamMemberId: studentId,
        clockIn: 1_000,
        status: "open",
      })
      for (let i = 0; i < 520; i++) {
        const clockIn = 10_000_000 + i * 10_000
        await ctx.db.insert("clockSessions", {
          teamMemberId: studentId,
          clockIn,
          clockOut: clockIn + 1_000,
          status: "closed",
        })
      }
    })

    await expect(
      mentor.mutation(api.clockSessions.addSession, {
        teamMemberId: studentId,
        clockIn: 900_000_000,
      }),
    ).rejects.toThrow("overlaps")
    await expect(
      mentor.mutation(api.clockSessions.clockIn, { teamMemberId: studentId }),
    ).rejects.toThrow("Already clocked in")
  })

  test("overlap check still accepts a gap between existing sessions", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)

    await mentor.mutation(api.clockSessions.addSession, {
      teamMemberId: studentId,
      clockIn: 1_000,
      clockOut: 2_000,
    })
    await mentor.mutation(api.clockSessions.addSession, {
      teamMemberId: studentId,
      clockIn: 5_000,
      clockOut: 6_000,
    })
    // Slots cleanly into the gap, and abuts without overlapping.
    await mentor.mutation(api.clockSessions.addSession, {
      teamMemberId: studentId,
      clockIn: 2_000,
      clockOut: 5_000,
    })
    await expect(
      mentor.mutation(api.clockSessions.addSession, {
        teamMemberId: studentId,
        clockIn: 1_500,
        clockOut: 5_500,
      }),
    ).rejects.toThrow("overlaps")

    const sessions = await mentor.query(api.clockSessions.getForMember, {
      teamMemberId: studentId,
      startAt: 0,
    })
    expect(sessions).toHaveLength(3)
  })

  test("session reads past the scan limit throw instead of under-reporting", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)

    await t.run(async (ctx) => {
      for (let i = 0; i < SESSION_SCAN_LIMIT; i++) {
        const clockIn = 1_000_000 + i * 10_000
        await ctx.db.insert("clockSessions", {
          teamMemberId: studentId,
          clockIn,
          clockOut: clockIn + 3_600_000,
          status: "closed",
        })
      }
    })

    await expect(
      mentor.query(api.clockSessions.getForMember, { teamMemberId: studentId, startAt: 0 }),
    ).rejects.toThrow("narrow the reporting range")

    // The kiosk and dashboard read through the configured range, so point it at
    // the fixture rather than the Jan-1 default to exercise that path too.
    await mentor.mutation(api.settings.updateHoursRange, { startAt: 1 })
    await expect(
      mentor.query(api.clockSessions.getMemberStatus, { teamMemberId: studentId }),
    ).rejects.toThrow("narrow the reporting range")
    await expect(mentor.query(api.dashboard.getDashboardData, {})).rejects.toThrow(
      "narrow the reporting range",
    )

    // A range covering only part of the history stays under the limit, and the
    // end bound is applied in the index rather than after the page is taken.
    const narrowed = await mentor.query(api.clockSessions.getForMember, {
      teamMemberId: studentId,
      startAt: 1_000_000,
      endAt: 1_000_000 + 10 * 10_000,
    })
    expect(narrowed).toHaveLength(10)
  })

  test("open-session lookup finds a legacy row with no status at any depth", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)

    // Pre-rollout shape: no `status` at all. The old fallback only scanned the
    // 200 newest rows, so this was invisible once enough history piled up.
    await t.run(async (ctx) => {
      await ctx.db.insert("clockSessions", { teamMemberId: studentId, clockIn: 1_000 })
      for (let i = 0; i < 250; i++) {
        const clockIn = 10_000_000 + i * 10_000
        await ctx.db.insert("clockSessions", {
          teamMemberId: studentId,
          clockIn,
          clockOut: clockIn + 1_000,
        })
      }
    })

    const status = await mentor.query(api.clockSessions.getMemberStatus, {
      teamMemberId: studentId,
    })
    expect(status.currentSession?.clockIn).toBe(1_000)
    await expect(
      mentor.mutation(api.clockSessions.clockIn, { teamMemberId: studentId }),
    ).rejects.toThrow("Already clocked in")
  })

  test("sessions cannot be dated in the future", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)
    const hourFromNow = Date.now() + 3_600_000

    await expect(
      mentor.mutation(api.clockSessions.addSession, {
        teamMemberId: studentId,
        clockIn: hourFromNow,
      }),
    ).rejects.toThrow("Clock in cannot be in the future")
    await expect(
      mentor.mutation(api.clockSessions.addSession, {
        teamMemberId: studentId,
        clockIn: Date.now() - 1_000,
        clockOut: hourFromNow,
      }),
    ).rejects.toThrow("Clock out cannot be in the future")
  })

  test("student start year and grade can be cleared", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)

    await mentor.mutation(api.teamMembers.update, {
      id: studentId,
      firstName: "Sam",
      lastName: "Student",
      memberId: "4392000002",
      studentStartYear: 2024,
      studentGrade: 9,
    })
    expect(
      (await mentor.query(api.teamMembers.getById, { id: studentId }))?.displayGrade,
    ).toBe(9)

    // Omitting both clears them; previously they could only ever be set.
    await mentor.mutation(api.teamMembers.update, {
      id: studentId,
      firstName: "Sam",
      lastName: "Student",
      memberId: "4392000002",
    })
    const cleared = await mentor.query(api.teamMembers.getById, { id: studentId })
    expect(cleared?.studentGrade).toBeUndefined()
    expect(cleared?.studentStartYear).toBeUndefined()
    expect(cleared?.displayGrade).toBeNull()
  })

  test("member update rejects blank names and out-of-range start years", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)
    const base = {
      id: studentId,
      firstName: "Sam",
      lastName: "Student",
      memberId: "4392000002",
    }

    await expect(
      mentor.mutation(api.teamMembers.update, { ...base, firstName: "   " }),
    ).rejects.toThrow("name")
    await expect(
      mentor.mutation(api.teamMembers.update, { ...base, studentStartYear: 1899 }),
    ).rejects.toThrow("Start year")
    await expect(
      mentor.mutation(api.teamMembers.update, { ...base, studentStartYear: 2024.5 }),
    ).rejects.toThrow("Start year")
  })

  test("destructive roster reset requires a mentor identity", async () => {
    const { t, mentor, student } = setup()
    await seedRoster(t)
    vi.stubEnv("ENABLE_DESTRUCTIVE_MIGRATIONS", "true")

    // The confirmation string is published in the README, so the mentor gate is
    // the only thing standing between an anonymous caller and the whole roster.
    await expect(
      t.mutation(api.migrations.clearWorkosEraRoster, {
        confirmation: "DELETE_WORKOS_ROSTER",
      }),
    ).rejects.toThrow("Unauthorized")
    await expect(
      student.mutation(api.migrations.clearWorkosEraRoster, {
        confirmation: "DELETE_WORKOS_ROSTER",
      }),
    ).rejects.toThrow("Forbidden")
    await expect(
      mentor.mutation(api.migrations.clearWorkosEraRoster, { confirmation: "nope" }),
    ).rejects.toThrow("Invalid confirmation")

    const result = await mentor.mutation(api.migrations.clearWorkosEraRoster, {
      confirmation: "DELETE_WORKOS_ROSTER",
    })
    expect(result.deletedTeamMembers).toBe(2)
  })

  test("configured hours range drives dashboard, kiosk status, and member sessions", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)

    await mentor.mutation(api.clockSessions.addSession, {
      teamMemberId: studentId,
      clockIn: 1_000,
      clockOut: 2_000,
    })
    await mentor.mutation(api.clockSessions.addSession, {
      teamMemberId: studentId,
      clockIn: 3_000,
      clockOut: 5_000,
    })
    await mentor.mutation(api.clockSessions.addSession, {
      teamMemberId: studentId,
      clockIn: 6_000,
      clockOut: 9_000,
    })

    await mentor.mutation(api.settings.updateHoursRange, {
      startAt: 2_500,
      endAt: 6_000,
    })

    const dashboard = await mentor.query(api.dashboard.getDashboardData, {})
    const member = dashboard.members.find((m) => m._id === studentId)
    expect(member?.completedMs).toBe(2_000)
    expect(dashboard.totalCompletedMs).toBe(2_000)

    const status = await mentor.query(api.clockSessions.getMemberStatus, {
      teamMemberId: studentId,
    })
    expect(status.completedMs).toBe(2_000)

    const sessions = await mentor.query(api.clockSessions.getForMember, {
      teamMemberId: studentId,
    })
    expect(sessions.map((s) => s.clockIn)).toEqual([3_000])

    const overridden = await mentor.query(api.dashboard.getDashboardData, {
      startAt: 0,
      endAt: 10_000,
    })
    const overriddenMember = overridden.members.find((m) => m._id === studentId)
    expect(overriddenMember?.completedMs).toBe(6_000)
  })

  test("student grade display advances on July 1 and rolls into alumni", async () => {
    expect(
      computeDisplayGrade(
        { type: "student", studentGrade: 10, studentGradeAsOfSchoolYear: 2026 },
        new Date("2027-06-30T12:00:00").getTime(),
      ),
    ).toBe(10)
    expect(
      computeDisplayGrade(
        { type: "student", studentGrade: 10, studentGradeAsOfSchoolYear: 2026 },
        new Date("2027-07-01T12:00:00").getTime(),
      ),
    ).toBe(11)
    expect(
      computeDisplayGrade(
        { type: "student", studentGrade: 12, studentGradeAsOfSchoolYear: 2026 },
        new Date("2027-07-01T12:00:00").getTime(),
      ),
    ).toBe("alumni")
  })

  test("re-saving a member with their displayed grade is grade-neutral", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)

    // A grade stored two school years ago now displays two grades higher. The
    // edit dialog seeds from the displayed grade, so writing it straight back
    // with a refreshed as-of year must not move the student.
    await t.run((ctx) =>
      ctx.db.patch(studentId, {
        studentGrade: 9,
        studentGradeAsOfSchoolYear: currentSchoolYear() - 2,
      }),
    )
    const before = await mentor.query(api.teamMembers.getById, { id: studentId })
    expect(before?.displayGrade).toBe(11)

    await mentor.mutation(api.teamMembers.update, {
      id: studentId,
      firstName: "Samantha",
      lastName: "Student",
      memberId: "4392000002",
      studentGrade: before!.displayGrade as 11,
      studentGradeAsOfSchoolYear: currentSchoolYear(),
    })

    const after = await mentor.query(api.teamMembers.getById, { id: studentId })
    expect(after?.displayGrade).toBe(11)
  })

  test("team member update stores student start year and grade metadata", async () => {
    const { t, mentor } = setup()
    const { studentId } = await seedRoster(t)

    await mentor.mutation(api.teamMembers.update, {
      id: studentId,
      firstName: "Sam",
      lastName: "Student",
      memberId: "4392000002",
      studentStartYear: 2024,
      studentGrade: 9,
      studentGradeAsOfSchoolYear: 2026,
    })

    const member = await t.run((ctx) => ctx.db.get(studentId))
    expect(member?.studentStartYear).toBe(2024)
    expect(member?.studentGrade).toBe(9)
    expect(member?.studentGradeAsOfSchoolYear).toBe(2026)
  })
})
