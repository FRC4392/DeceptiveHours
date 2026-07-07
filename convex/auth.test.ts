/// <reference types="vite/client" />
import { createHmac } from "node:crypto"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"])

function setup() {
  return convexTest(schema, modules)
}

function signedWebhook(body: string) {
  const secretBytes = Buffer.from("test-secret")
  process.env.CLERK_WEBHOOK_SECRET = `whsec_${secretBytes.toString("base64")}`
  const id = "msg_test"
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64")

  return {
    method: "POST",
    body,
    headers: {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`,
      "content-type": "application/json",
    },
  }
}

describe("Clerk auth sync", () => {
  test("users.me is null before webhook sync and returns profile after sync", async () => {
    const t = setup()

    await expect(t.withIdentity({ subject: "user_mentor" }).query(api.users.me)).resolves.toBeNull()

    await t.mutation(internal.auth.upsertClerkUser, {
      clerkUserId: "user_mentor",
      email: "mentor@example.com",
      firstName: "Mira",
      lastName: "Mentor",
      role: "mentor",
    })

    await expect(t.withIdentity({ subject: "user_mentor" }).query(api.users.me)).resolves.toEqual({
      role: "mentor",
      firstName: "Mira",
      lastName: "Mentor",
      email: "mentor@example.com",
    })
  })

  test("Clerk webhooks upsert users, default unknown roles to student, and delete cascades", async () => {
    const t = setup()
    const createdBody = JSON.stringify({
      type: "user.created",
      data: {
        id: "user_student",
        first_name: "Sam",
        last_name: "Student",
        primary_email_address_id: "email_1",
        email_addresses: [{ id: "email_1", email_address: "student@example.com" }],
        public_metadata: { role: "captain" },
      },
    })

    const created = await t.fetch("/clerk/webhook", signedWebhook(createdBody))
    expect(created.status).toBe(200)
    await expect(t.withIdentity({ subject: "user_student" }).query(api.users.me)).resolves.toEqual({
      role: "student",
      firstName: "Sam",
      lastName: "Student",
      email: "student@example.com",
    })

    const memberId = await t.run(async (ctx) => {
      const member = await ctx.db
        .query("teamMembers")
        .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", "user_student"))
        .unique()
      if (!member) throw new Error("Missing synced member")
      await ctx.db.insert("clockSessions", {
        teamMemberId: member._id,
        clockIn: 1,
        clockOut: 2,
        status: "closed",
      })
      return member._id
    })

    const updatedBody = JSON.stringify({
      type: "user.updated",
      data: {
        id: "user_student",
        first_name: "Mira",
        last_name: "Mentor",
        primary_email_address_id: "email_1",
        email_addresses: [{ id: "email_1", email_address: "mentor@example.com" }],
        public_metadata: { role: "mentor" },
      },
    })
    const updated = await t.fetch("/clerk/webhook", signedWebhook(updatedBody))
    expect(updated.status).toBe(200)
    await expect(t.withIdentity({ subject: "user_student" }).query(api.users.me)).resolves.toMatchObject({
      role: "mentor",
      firstName: "Mira",
      lastName: "Mentor",
      email: "mentor@example.com",
    })

    const deletedBody = JSON.stringify({
      type: "user.deleted",
      data: { id: "user_student" },
    })
    const deleted = await t.fetch("/clerk/webhook", signedWebhook(deletedBody))
    expect(deleted.status).toBe(200)
    await expect(t.run((ctx) => ctx.db.get(memberId))).resolves.toBeNull()
    await expect(
      t.run((ctx) =>
        ctx.db.query("clockSessions").withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", memberId)).collect(),
      ),
    ).resolves.toEqual([])
  })
})
