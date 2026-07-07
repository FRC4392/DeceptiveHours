/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"])
type TestBackend = ReturnType<typeof convexTest>

async function seedRoster(t: Pick<TestBackend, "run">) {
  return t.run(async (ctx) => {
    const mentorId = await ctx.db.insert("teamMembers", {
      workosUserId: "mentor-user",
      email: "mentor@example.com",
      firstName: "Mira",
      lastName: "Mentor",
      memberId: "4392000001",
      type: "mentor",
    })
    const studentId = await ctx.db.insert("teamMembers", {
      workosUserId: "student-user",
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
        workosUserId: "missing-user",
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

    const dashboard = await mentor.query(api.dashboard.getDashboardData)
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
        type: "student",
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
})
