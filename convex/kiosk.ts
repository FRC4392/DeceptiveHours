import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { requireMentor } from "./authz"
import {
  KIOSK_TOKEN_TTL_MS,
  KioskTokenError,
  hashKioskToken,
  resolveKioskDevice,
} from "./kioskAuth"

const kioskDeviceSummary = v.object({
  _id: v.id("kioskDevices"),
  name: v.string(),
  createdAt: v.number(),
  expiresAt: v.number(),
  lastSeenAt: v.optional(v.number()),
  isExpired: v.boolean(),
})

/**
 * Provision the device the mentor is currently holding as a kiosk.
 *
 * The plaintext token is returned exactly once — only its hash is stored — so
 * the client must save it immediately. The intended flow is: a mentor signs in
 * on the tablet, runs this, the browser keeps the token, and then signs out of
 * Clerk entirely. From then on the tablet can clock people in and out and do
 * nothing else, and it keeps working after the mentor's Clerk session lapses.
 */
export const registerDevice = mutation({
  args: { name: v.string() },
  returns: v.object({
    deviceId: v.id("kioskDevices"),
    token: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, { name }) => {
    const mentor = await requireMentor(ctx)
    const trimmed = name.trim()
    if (!trimmed) throw new Error("Give the kiosk a name so you can recognise it later")

    // Two UUIDs: ~244 bits of entropy, far beyond guessing.
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "")
    const expiresAt = Date.now() + KIOSK_TOKEN_TTL_MS
    const deviceId = await ctx.db.insert("kioskDevices", {
      name: trimmed,
      tokenHash: await hashKioskToken(token),
      createdByMemberId: mentor._id,
      expiresAt,
    })
    return { deviceId, token, expiresAt }
  },
})

export const listDevices = query({
  args: {},
  returns: v.array(kioskDeviceSummary),
  handler: async (ctx) => {
    await requireMentor(ctx)
    const now = Date.now()
    const devices = await ctx.db.query("kioskDevices").take(100)
    return devices
      .filter((device) => device.revokedAt === undefined)
      .map((device) => ({
        _id: device._id,
        name: device.name,
        createdAt: device._creationTime,
        expiresAt: device.expiresAt,
        lastSeenAt: device.lastSeenAt,
        isExpired: device.expiresAt <= now,
      }))
      .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0) || b.createdAt - a.createdAt)
  },
})

/** Cut off a lost or retired tablet. The device stops working immediately. */
export const revokeDevice = mutation({
  args: { deviceId: v.id("kioskDevices") },
  returns: v.null(),
  handler: async (ctx, { deviceId }) => {
    await requireMentor(ctx)
    const device = await ctx.db.get(deviceId)
    if (!device) throw new Error("Kiosk not found")
    await ctx.db.patch(deviceId, { revokedAt: Date.now() })
    return null
  },
})

/**
 * Whether the token this browser is holding still works.
 *
 * The kiosk calls this before rendering so a revoked or expired tablet shows a
 * "ask a mentor to set this up again" screen rather than failing on the first
 * clock-in attempt. Deliberately says nothing beyond the device's own name.
 */
export const verifyDevice = query({
  args: { kioskToken: v.string() },
  returns: v.object({
    valid: v.boolean(),
    name: v.union(v.string(), v.null()),
    reason: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { kioskToken }) => {
    try {
      const device = await resolveKioskDevice(ctx, kioskToken)
      return { valid: true, name: device.name, reason: null }
    } catch (error) {
      if (error instanceof KioskTokenError) {
        return { valid: false, name: null, reason: error.message }
      }
      throw error
    }
  },
})
