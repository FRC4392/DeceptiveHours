import { ConvexHttpClient } from "convex/browser"

const CONVEX_URL = process.env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210"
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error("Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword bun run scripts/create-admin.ts")
  process.exit(1)
}

const client = new ConvexHttpClient(CONVEX_URL)

try {
  await (client as unknown as {
    action(name: string, args: unknown): Promise<unknown>
  }).action("auth:signIn", {
    provider: "password",
    params: { email: EMAIL, password: PASSWORD, flow: "signUp" },
  })
  console.log("✅ Admin account created")
  console.log(`   Email:    ${EMAIL}`)
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes("already") || msg.includes("exists")) {
    console.log("ℹ️  Account already exists — credentials unchanged")
  } else {
    console.error("❌ Failed:", msg)
    process.exit(1)
  }
}
