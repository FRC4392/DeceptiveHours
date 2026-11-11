import { ConvexError } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

// Helpers for the kiosk device token. Not a Convex function module — the
// mentor-facing mutations and queries live in `convex/kiosk.ts`.

/** How long a newly provisioned kiosk stays valid: a full competition year. */
export const KIOSK_TOKEN_TTL_MS = 400 * 24 * 60 * 60 * 1000

/**
 * Thrown when a token exists but is no longer usable. Distinct from a generic
 * authorization failure so the tablet can show "ask a mentor to set this
 * device up again" rather than a bare error.
 *
 * Extends `ConvexError`, not `Error`: a production Convex deployment replaces
 * plain `Error` messages with "Server Error" before they reach the client, so
 * a revoked tablet would otherwise explain nothing.
 */
export class KioskTokenError extends ConvexError<string> {}

export async function hashKioskToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

/** Resolve a device token to its row, or throw a message the tablet can show. */
export async function resolveKioskDevice(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"kioskDevices">> {
  // Only the hash is stored, so a leaked database yields no working tokens.
  const tokenHash = await hashKioskToken(token)
  const device = await ctx.db
    .query("kioskDevices")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique()

  if (!device) throw new KioskTokenError("This device is not set up as a kiosk")
  if (device.revokedAt !== undefined) {
    throw new KioskTokenError("This kiosk has been removed by a mentor")
  }
  if (device.expiresAt <= Date.now()) {
    throw new KioskTokenError("This kiosk has expired and needs setting up again")
  }
  return device
}
