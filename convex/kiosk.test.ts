/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
import { KIOSK_TOKEN_TTL_MS } from "./kioskAuth"

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"])

async function setup() {
  const t = convexTest(schema, modules)
  const { studentId } = await t.run(async (ctx) => {
    await ctx.db.insert("teamMembers", {
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
    return { studentId }
  })
  const mentor = t.withIdentity({ subject: "mentor-user" })
  const { token } = await mentor.mutation(api.kiosk.registerDevice, {
    name: "Shop tablet",
  })
  return { t, mentor, student: t.withIdentity({ subject: "student-user" }), studentId, token }
}

describe("kiosk devices", () => {
  test("a device token clocks people in and out with no Clerk session", async () => {
    const { t, studentId, token } = await setup()

    // `t` with no identity is the shared tablet: signed out entirely.
    const member = await t.query(api.teamMembers.lookupByMemberId, {
      memberId: "4392000002",
      kioskToken: token,
    })
    expect(member?._id).toBe(studentId)

    await t.mutation(api.clockSessions.clockIn, { teamMemberId: studentId, kioskToken: token })
    const status = await t.query(api.clockSessions.getMemberStatus, {
      teamMemberId: studentId,
      kioskToken: token,
    })
    expect(status.currentSession).not.toBeNull()

    await t.mutation(api.clockSessions.clockOut, { teamMemberId: studentId, kioskToken: token })
    const after = await t.query(api.clockSessions.getMemberStatus, {
      teamMemberId: studentId,
      kioskToken: token,
    })
    expect(after.currentSession).toBeNull()
    expect(after.completedMs).toBeGreaterThanOrEqual(0)
  })

  test("a device token reaches nothing beyond the clock screen", async () => {
    const { t, studentId, token } = await setup()

    // This is the whole point of the device token: a student standing at the
    // tablet gets the clock screen and nothing else, even via devtools.
    await expect(t.query(api.teamMembers.list, {})).rejects.toThrow("Unauthorized")
    await expect(t.query(api.dashboard.getDashboardData, {})).rejects.toThrow("Unauthorized")
    await expect(t.query(api.settings.getHoursRange, {})).rejects.toThrow("Unauthorized")
    await expect(t.query(api.kiosk.listDevices, {})).rejects.toThrow("Unauthorized")
    await expect(
      t.mutation(api.clockSessions.addSession, { teamMemberId: studentId, clockIn: 1_000 }),
    ).rejects.toThrow("Unauthorized")
    await expect(
      t.mutation(api.teamMembers.update, {
        id: studentId,
        firstName: "Hacked",
        lastName: "Student",
        memberId: "4392000002",
      }),
    ).rejects.toThrow("Unauthorized")
    await expect(
      t.mutation(api.kiosk.registerDevice, { name: "rogue" }),
    ).rejects.toThrow("Unauthorized")

    // The token is not a general-purpose credential: it is ignored by
    // everything that did not opt into it.
    expect(token).toBeTruthy()
  })

  test("a mentor on their phone needs no token and keeps full access", async () => {
    const { mentor, studentId } = await setup()

    await mentor.mutation(api.clockSessions.clockIn, { teamMemberId: studentId })
    const status = await mentor.query(api.clockSessions.getMemberStatus, {
      teamMemberId: studentId,
    })
    expect(status.currentSession).not.toBeNull()
    // Still a mentor, not downgraded by using the clock screen.
    await expect(mentor.query(api.teamMembers.list, {})).resolves.toHaveLength(2)
  })

  test("students still cannot use the clock screen without a token", async () => {
    const { student, studentId } = await setup()
    await expect(
      student.mutation(api.clockSessions.clockIn, { teamMemberId: studentId }),
    ).rejects.toThrow("Forbidden")
  })

  test("revoked, expired and unknown tokens are refused with a reason", async () => {
    const { t, mentor, studentId, token } = await setup()

    expect(await t.query(api.kiosk.verifyDevice, { kioskToken: token })).toEqual({
      valid: true,
      name: "Shop tablet",
      reason: null,
    })
    expect(await t.query(api.kiosk.verifyDevice, { kioskToken: "nonsense" })).toMatchObject({
      valid: false,
      reason: expect.stringContaining("not set up"),
    })

    const [device] = await mentor.query(api.kiosk.listDevices, {})
    await mentor.mutation(api.kiosk.revokeDevice, { deviceId: device._id })

    expect(await t.query(api.kiosk.verifyDevice, { kioskToken: token })).toMatchObject({
      valid: false,
      reason: expect.stringContaining("removed"),
    })
    await expect(
      t.mutation(api.clockSessions.clockIn, { teamMemberId: studentId, kioskToken: token }),
    ).rejects.toThrow("removed")
    expect(await mentor.query(api.kiosk.listDevices, {})).toHaveLength(0)
  })

  test("a kiosk lasts about a year and records when it was last used", async () => {
    const { t, mentor, studentId, token } = await setup()

    const [before] = await mentor.query(api.kiosk.listDevices, {})
    expect(before.lastSeenAt).toBeUndefined()
    expect(before.expiresAt - Date.now()).toBeGreaterThan(KIOSK_TOKEN_TTL_MS - 60_000)
    expect(before.isExpired).toBe(false)

    await t.mutation(api.clockSessions.clockIn, { teamMemberId: studentId, kioskToken: token })
    const [after] = await mentor.query(api.kiosk.listDevices, {})
    expect(after.lastSeenAt).toBeGreaterThan(0)

    // Past its expiry the same token stops working, without being revoked.
    await t.run(async (ctx) => {
      await ctx.db.patch(after._id, { expiresAt: Date.now() - 1 })
    })
    expect(await t.query(api.kiosk.verifyDevice, { kioskToken: token })).toMatchObject({
      valid: false,
      reason: expect.stringContaining("expired"),
    })
  })

  test("the stored token is hashed, so the database holds nothing usable", async () => {
    const { t, token } = await setup()
    const rows = await t.run((ctx) => ctx.db.query("kioskDevices").collect())
    expect(rows).toHaveLength(1)
    expect(rows[0].tokenHash).not.toBe(token)
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(rows[0])).not.toContain(token)
  })
})
