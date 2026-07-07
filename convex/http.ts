import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"

const http = httpRouter()

type ClerkRole = "student" | "mentor"

interface ClerkEmailAddress {
  id: string
  email_address: string
}

interface ClerkUserData {
  id: string
  first_name?: string | null
  last_name?: string | null
  primary_email_address_id?: string | null
  email_addresses?: ClerkEmailAddress[]
  public_metadata?: Record<string, unknown>
}

interface ClerkWebhookEvent {
  type: string
  data: ClerkUserData
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i]
  }
  return mismatch === 0
}

async function verifySvixSignature(req: Request, body: string) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) throw new Error("CLERK_WEBHOOK_SECRET is not set")

  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")
  if (!svixId || !svixTimestamp || !svixSignature) return false

  const timestampSeconds = Number(svixTimestamp)
  if (!Number.isFinite(timestampSeconds)) return false
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds)
  if (ageSeconds > 5 * 60) return false

  const keyBytes = base64ToBytes(secret.replace(/^whsec_/, ""))
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signedContent = `${svixId}.${svixTimestamp}.${body}`
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent)),
  )

  return svixSignature
    .split(" ")
    .some((part) => {
      const [version, signature] = part.split(",")
      if (version !== "v1" || !signature) return false
      return timingSafeEqual(expected, base64ToBytes(signature))
    })
}

function primaryEmail(data: ClerkUserData) {
  const primary = data.email_addresses?.find(
    (email) => email.id === data.primary_email_address_id,
  )
  return primary?.email_address ?? data.email_addresses?.[0]?.email_address ?? ""
}

function roleFromMetadata(data: ClerkUserData): ClerkRole {
  return data.public_metadata?.role === "mentor" ? "mentor" : "student"
}

http.route({
  path: "/clerk/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.text()
    if (!(await verifySvixSignature(req, body))) {
      return json(400, { error: "Invalid webhook signature" })
    }

    const event = JSON.parse(body) as ClerkWebhookEvent
    if (event.type === "user.deleted") {
      await ctx.runMutation(internal.auth.deleteClerkUser, {
        clerkUserId: event.data.id,
      })
      return json(200, { ok: true })
    }

    if (event.type === "user.created" || event.type === "user.updated") {
      await ctx.runMutation(internal.auth.upsertClerkUser, {
        clerkUserId: event.data.id,
        email: primaryEmail(event.data),
        firstName: event.data.first_name ?? "",
        lastName: event.data.last_name ?? "",
        role: roleFromMetadata(event.data),
      })
      return json(200, { ok: true })
    }

    return json(200, { ok: true, ignored: true })
  }),
})

export default http
