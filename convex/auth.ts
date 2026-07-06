import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit"
import type { GenericMutationCtx } from "convex/server"
import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"

// Typed reference to the internal event-dispatch mutation exported below.
const authFunctions: AuthFunctions = internal.auth

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
  // The component only forwards "user.*" events by default. Role lives on the
  // WorkOS Organization Membership (not the User object), so membership
  // events must be opted in here to reach `authKitEvent` below. Note this
  // list only affects the .updated/.deleted catch-up path — .created events
  // are always forwarded regardless.
  additionalEventTypes: [
    "organization_membership.created",
    "organization_membership.updated",
    "organization_membership.deleted",
  ],
})

type MutationCtx = GenericMutationCtx<DataModel>

/** Role is a WorkOS Role slug on the user's organization membership. Anything
 * other than exactly "mentor" (including no membership yet) is "student". */
function deriveType(roleSlug: string | null | undefined): "student" | "mentor" {
  return roleSlug === "mentor" ? "mentor" : "student"
}

/** Generate a unique 6-random-digit member id prefixed with "4392". */
async function generateMemberId(ctx: MutationCtx): Promise<string> {
  // Bounded retry; collisions are astronomically unlikely.
  for (let i = 0; i < 25; i++) {
    const suffix = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0")
    const memberId = `4392${suffix}`
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_memberId", (q) => q.eq("memberId", memberId))
      .unique()
    if (!existing) return memberId
  }
  throw new Error("Failed to generate a unique memberId")
}

async function findMember(ctx: MutationCtx, workosUserId: string) {
  return ctx.db
    .query("teamMembers")
    .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
    .unique()
}

/**
 * Upsert identity fields (email/name) from a WorkOS user record. Role is
 * intentionally NOT touched here — it's synced separately from organization
 * membership events below. A brand-new row defaults to "student" until a
 * membership event assigns a role.
 */
async function upsertUserIdentity(
  ctx: MutationCtx,
  data: {
    id: string
    email?: string | null
    firstName?: string | null
    lastName?: string | null
  },
): Promise<void> {
  const existing = await findMember(ctx, data.id)
  const fields = {
    email: data.email ?? "",
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
  }

  if (existing) {
    // Preserve the assigned memberId and type; only identity fields change.
    await ctx.db.patch(existing._id, fields)
    return
  }

  const memberId = await generateMemberId(ctx)
  await ctx.db.insert("teamMembers", {
    workosUserId: data.id,
    memberId,
    type: "student",
    ...fields,
  })
}

/** Delete a teamMembers row (by workosUserId) and cascade its clockSessions. */
async function deleteMember(ctx: MutationCtx, workosUserId: string): Promise<void> {
  const member = await findMember(ctx, workosUserId)
  if (!member) return
  const sessions = await ctx.db
    .query("clockSessions")
    .withIndex("by_teamMemberId", (q) => q.eq("teamMemberId", member._id))
    .collect()
  await Promise.all(sessions.map((s) => ctx.db.delete(s._id)))
  await ctx.db.delete(member._id)
}

/**
 * Sync the WorkOS Role slug on an organization membership into the roster's
 * `type`. If the row doesn't exist yet (the membership event raced ahead of
 * `user.created`), skip: the row is created shortly by the user event, and
 * the next membership event reconciles the role.
 */
async function syncRoleFromMembership(
  ctx: MutationCtx,
  data: { userId: string; role?: { slug?: string | null } | null },
): Promise<void> {
  const member = await findMember(ctx, data.userId)
  if (!member) return
  await ctx.db.patch(member._id, { type: deriveType(data.role?.slug) })
}

// The webhook route (registered in http.ts) dispatches WorkOS events into this
// internal mutation. Handlers run in a mutation context with db access.
export const { authKitEvent } = authKit.events({
  "user.created": async (ctx, event) => {
    await upsertUserIdentity(ctx, event.data)
  },
  "user.updated": async (ctx, event) => {
    await upsertUserIdentity(ctx, event.data)
  },
  "user.deleted": async (ctx, event) => {
    await deleteMember(ctx, event.data.id)
  },
  "organization_membership.created": async (ctx, event) => {
    await syncRoleFromMembership(ctx, event.data)
  },
  "organization_membership.updated": async (ctx, event) => {
    await syncRoleFromMembership(ctx, event.data)
  },
  "organization_membership.deleted": async (ctx, event) => {
    // The WorkOS user account may still exist minus this membership/role, so
    // demote to student (revoke elevated access) rather than deleting the row.
    const member = await findMember(ctx, event.data.userId)
    if (!member) return
    await ctx.db.patch(member._id, { type: "student" })
  },
})

// Replays user.created for any WorkOS users the webhook missed (e.g. created
// before the webhook endpoint existed). Safe to re-run; skips users already
// synced. Run manually via `npx convex run auth:backfillUsers` if the roster
// looks incomplete.
export const { backfillUsers } = authKit.utils()
