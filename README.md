# DeceptiveHours

Hour tracking app for Deceivers Robotics Team 4392. Members clock in and out via a kiosk interface; mentors manage the roster and review session history through a protected dashboard.

## Features

- **Time Clock Kiosk** — members enter or scan their Member ID to clock in/out. Runs either on a registered tablet holding a long-lived device token (no Clerk session, restricted to the clock screen) or on a signed-in mentor's phone. Shows the member's hours for the configured reporting range plus a live session timer.
- **Mentor Dashboard** — currently clocked-in members with running timers and a one-click **Clock out**, warnings on sessions left open over 12 hours, total team hours for a configurable range, mentor/student breakdowns on every stat card, a roster sorted by hours, and CSV export.
- **Team Member Roster** — searchable, filterable, sortable roster with CSV export. Rows are created by Clerk invitations (not typed in directly) and synced through a webhook.
- **User Management** — invite students/mentors by email, review and revoke pending invitations, change a member's role (written to Clerk `publicMetadata`, with a guard against self-demotion), remove users from Clerk, and re-sync the roster from Clerk on demand when a webhook is missed. Sync never deletes without confirmation.
- **Student Metadata** — student start year and grade. Grades advance automatically each July 1 and become Alumni after grade 12.
- **Member Detail** — view and edit member info, show a QR code with a one-click **Print** for badges, add/edit/delete sessions, apply a temporary reporting range, and export hours with daily and weekly summaries.
- **QR Scanning** — kiosk supports camera-based QR code scanning with `jsQR`.
- **Light/dark/system theme** — theme switcher in the mentor header; the Clerk sign-in form is themed to match.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript (strict), Vite 8 |
| Routing | React Router 7 (SPA mode, `createBrowserRouter`) |
| Styling | Tailwind CSS v4, shadcn/ui on Base UI (`@base-ui/react`) |
| State | Convex live queries; React local state for UI |
| Backend | [Convex](https://convex.dev) |
| Auth | [Clerk](https://clerk.com) |
| Tests | Vitest + `convex-test` (edge-runtime environment) |
| Package manager | Bun |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- Node 22 or newer — the Convex CLI requires it, and Vite 8 wants
  `^20.19 || >=22.12`. Netlify pins this via `NODE_VERSION` in `netlify.toml`;
  a Node 20 build fails at `convex deploy` before Vite runs.
- A [Convex](https://dashboard.convex.dev) account

### Setup

```bash
bun install
```

Connect to your Convex project (first run only — follow the prompts):

```bash
bunx convex dev
```

### First-time deployment setup

Auth is handled by Clerk. There is no local password store, so a brand-new
deployment needs Clerk configured before anyone can sign in:

1. Create or open a Clerk application.
2. Activate the Clerk Convex integration at
   `https://dashboard.clerk.com/apps/setup/convex`, then copy the Clerk
   Frontend API URL.
3. Create a Clerk webhook endpoint for the Convex HTTP endpoint
   `https://<deployment-name>.convex.site/clerk/webhook`, subscribe it to
   `user.created`, `user.updated`, and `user.deleted`, then copy the webhook
   signing secret. Use the `.convex.site` URL for webhooks, not the
   `.convex.cloud` client URL.
4. Set the server-side Clerk env vars on the Convex deployment:
   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN <clerk-frontend-api-url>
   npx convex env set CLERK_SECRET_KEY <clerk-secret-key>
   npx convex env set CLERK_WEBHOOK_SECRET <clerk-webhook-signing-secret>
   ```
5. Copy `.env.example` to `.env.local` and set `VITE_CONVEX_URL` plus
   `VITE_CLERK_PUBLISHABLE_KEY`.
6. Create the first mentor directly in Clerk and set their
   `publicMetadata.role` to `"mentor"`. This has to be done in Clerk itself:
   the in-app **Invite User** flow at `/users` requires an already-signed-in
   mentor, so it cannot bootstrap the first one.
7. Sign in at `/login`. The signed-in user's `teamMembers` row is created
   automatically from the Clerk webhook (`convex/auth.ts`), with its type
   synced from `publicMetadata.role`.
8. If migrating from the old WorkOS setup and intentionally starting fresh,
   clear old roster/session data. This runs after step 6 because, like every
   other function in the app, it is mentor-gated — pass the first mentor's
   Clerk issuer and user ID as `--identity`:
   ```bash
   npx convex env set ENABLE_DESTRUCTIVE_MIGRATIONS true
   npx convex run --identity '{"issuer":"<clerk-frontend-api-url>","subject":"<mentor-clerk-user-id>"}' migrations:clearWorkosEraRoster '{"confirmation":"DELETE_WORKOS_ROSTER"}'
   npx convex env unset ENABLE_DESTRUCTIVE_MIGRATIONS
   ```

Existing Clerk-synced rows without an `authTokenIdentifier` still work through
a legacy Clerk user ID fallback. A future Clerk `user.updated` webhook, the
**Sync Clerk** button on `/users`, or the paginated
`migrations:backfillClerkAuthTokenIdentifiers` mutation fills the
provider-scoped identifier used by new rows.

### Development

```bash
bun run dev:all
```

This starts both the Vite dev server and the Convex function watcher concurrently.
The included `setup.sh` helper wraps `bun install` plus `bun run dev:all`; use
`./setup.sh --install-only` when you only want dependencies installed.

| Script | Description |
|---|---|
| `bun run dev` | Vite dev server only (fixed port 5174) |
| `bun run dev:convex` | Convex function watcher only |
| `bun run dev:all` | Both of the above, concurrently |
| `bun run build` | `tsc -b` then `vite build` |
| `bun run typecheck` | `tsc -b` (honours the project references; `tsc --noEmit` would check nothing) |
| `bun run lint` | ESLint over the repo |
| `bun run test` | Vitest (`convex/**/*.test.ts` and the pure helpers in `src/lib/**/*.test.ts`) |
| `bun run preview` | Serve the production build locally |

| URL | Description |
|---|---|
| `http://localhost:5174/` | Mentor dashboard |
| `http://localhost:5174/clock` | Mentor-unlocked time clock kiosk |
| `http://localhost:5174/login` | Mentor sign-in |
| `http://localhost:5174/members` | Team member roster, filtering, exports, and detail links |
| `http://localhost:5174/members/:memberDocId` | Member detail — info, QR code, sessions, exports. The segment is the Convex document ID, not the 10-digit Member ID |
| `http://localhost:5174/users` | Manage users — invite, remove, and sync Clerk accounts |
| `http://localhost:5174/kiosks` | Register this tablet as a kiosk; list and revoke kiosks |

### Bulk-inviting from a CSV

`scripts/bulk-invite-clerk.ts` sends Clerk invitations for every row in a CSV
with `First Name`, `Last Name`, and `Email` header columns (any order). It
throttles to roughly three invites per second to stay under Clerk's rate limits
and skips people who already have an invitation.

```bash
bun scripts/bulk-invite-clerk.ts path/to/people.csv --dry-run
CLERK_SECRET_KEY=sk_live_... bun scripts/bulk-invite-clerk.ts path/to/people.csv
```

Invitations created this way carry the person's name in `publicMetadata` but no
`role`, so they sync in as **students**. Promote mentors afterwards in Clerk by
setting `publicMetadata.role` to `"mentor"`, or invite them individually from
`/users`.

## Deployment

Git pushes to the production branch trigger Netlify. The production Netlify
build also deploys Convex functions because `netlify.toml` runs
`npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'bun run build'`.
That means normal code, schema, and Convex function changes go to production
automatically once Netlify has the right Convex deploy key.

### One-time production setup

1. Create or identify the Convex production deployment in the Convex dashboard.
2. Generate a production deploy key with `deployment:deploy` permission and add
   it to Netlify as `CONVEX_DEPLOY_KEY`.
3. Add `VITE_CLERK_PUBLISHABLE_KEY` in Netlify for the production Clerk app.
   `VITE_CONVEX_URL` is injected during the build by `npx convex deploy`, but
   if you also set it in Netlify, it must point at the same production
   `.convex.cloud` URL.
4. Set the Clerk server env vars on the Convex production deployment:
   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN <production-clerk-frontend-api-url> --prod
   npx convex env set CLERK_SECRET_KEY <production-clerk-secret-key> --prod
   npx convex env set CLERK_WEBHOOK_SECRET <production-clerk-webhook-signing-secret> --prod
   ```
5. In Clerk, allow the production Netlify URL or custom domain in the app's
   sign-in/redirect settings.
6. In Clerk, configure the webhook destination as
   `https://<deployment-name>.convex.site/clerk/webhook`.
7. Create the first mentor in Clerk and set their `publicMetadata.role` to
   `"mentor"` before trying to use in-app invites.

### Ongoing deploys

After the one-time setup, merging to the production branch is enough for normal
deploys:

- Netlify runs the production build.
- `npx convex deploy` deploys Convex code/schema and provides
  `VITE_CONVEX_URL` to `bun run build`.
- Netlify publishes the `dist` frontend.

Manual production deploys are still possible with:

```bash
bunx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd "bun run build"
```

Deploy previews currently run `bun run build` only, so they do not create Convex
preview deployments unless Netlify and `netlify.toml` are changed to use Convex
preview deploys.

### Migrations and backfills

Manual production actions are still needed for operational changes that are not
just code deploys, such as setting Convex env vars, changing Clerk webhook
settings, creating the first mentor, or running a one-off migration. The
mutations in `convex/migrations.ts` are mentor-gated, so run them from the
Convex dashboard while signed in as a mentor, or pass `--identity` on the CLI:

| Mutation | Purpose |
|---|---|
| `migrations:backfillClerkAuthTokenIdentifiers` | Fill `authTokenIdentifier` on rows created before it existed |
| `migrations:backfillClockSessionStatus` | Fill `status` on `clockSessions` rows created before it existed |
| `migrations:clearWorkosEraRoster` | Destructive WorkOS-era reset; requires `ENABLE_DESTRUCTIVE_MIGRATIONS=true` and an explicit confirmation string |

Both backfills are paginated and support `dryRun`:

```bash
npx convex run --prod --identity '{"issuer":"<production-clerk-frontend-api-url>","subject":"<mentor-clerk-user-id>"}' migrations:backfillClerkAuthTokenIdentifiers '{"paginationOpts":{"numItems":100,"cursor":null},"dryRun":true}'
npx convex run --prod --identity '{"issuer":"<production-clerk-frontend-api-url>","subject":"<mentor-clerk-user-id>"}' migrations:backfillClerkAuthTokenIdentifiers '{"paginationOpts":{"numItems":100,"cursor":null},"dryRun":false}'
```

Repeat the command with the returned `continueCursor` in place of `null` until
`isDone` is `true`.

## Project Structure

```
convex/          Convex backend
  schema.ts        teamMembers, appSettings, clockSessions
  limits.ts        Shared read limits (sessions per range, roster size)
  timeZone.ts      TEAM_TIME_ZONE and the calendar-boundary helpers
  authz.ts         getCurrentMember / requireMentor gates
  auth.ts          Internal Clerk → teamMembers sync mutations
  clerk.ts         Node actions: invite, remove, role change, full Clerk sync
  kiosk.ts         Kiosk device registration, listing, revoke, verify
  kioskAuth.ts     Device-token hashing and resolution
  http.ts          Svix-verified Clerk webhook endpoint
  users.ts         users.me + internal mentor assertion
  teamMembers.ts   Roster queries and mentor-only edits
  clockSessions.ts Clock in/out and session CRUD
  hours.ts         Range resolution and completed-hour math
  dashboard.ts     Aggregated dashboard query
  settings.ts      Global hours range
  studentInfo.ts   Grade rollover logic
  migrations.ts    Backfills and the WorkOS-era reset
  *.test.ts        Vitest + convex-test suites
scripts/         One-off operational scripts (bulk Clerk invites)
public/          Favicons and static icons
src/
  assets/        Static assets (logo)
  components/    Shared UI components (QR scanner, theme toggle, ui/)
  hooks/         Custom React hooks
  layouts/       Route layouts (root, mentor shell, mentor gate)
  lib/           Utilities (date/duration formatting, CSV, grades)
  routes/        Page components (lazy-loaded; error.tsx holds the error
                 boundaries and the not-found page)
```

## Auth

Sign-in uses Clerk (see [First-time deployment
setup](#first-time-deployment-setup) above). The dashboard (`/`), `/members`,
`/users` and `/kiosks` all require a signed-in mentor.

`/clock` is the exception, because it serves two different callers:

- **The shared tablet in the room.** A mentor signs in on it once, registers it
  from `/kiosks`, and is signed out of it in the same step. The tablet then
  holds a long-lived device token and no Clerk session. The backend honours
  that token on exactly five functions — resolve a member, read their status,
  clock in, clock out — so a student who walks up to the tablet and opens
  `/users` gets a sign-in page, not the roster. Tokens are stored only as a
  SHA-256 hash, last about a year, and can be revoked from `/kiosks` if a
  tablet is lost.
- **A mentor on their own phone.** No device token, a normal Clerk session,
  full access, and opening the clock screen never signs them out.

Clerk is the source of truth for login, passwords, invitations, and account
recovery. `convex/auth.config.ts` is only the Convex JWT bridge that lets Convex
verify Clerk tokens and make `ctx.auth.getUserIdentity()` work; this app does
not use the legacy Convex Auth password sign-in flow.

Every Convex query, mutation, and action in the app calls `requireMentor`
(directly, or via `internal.users.assertMentor` from Node actions), with three
documented exceptions:

1. The five clock functions call `requireKioskOrMentor` and accept a kiosk
   device token as an alternative credential.
2. `kiosk.verifyDevice` takes a token and no identity, so an unregistered
   tablet can be told it needs setting up. It returns only whether the token
   works and, if it does, that device's own name — never roster data.
3. The Clerk webhook at `convex/http.ts`, verified by Svix signature.

The two kiosk lookups deliberately return a reduced member shape without email
or Clerk identifiers, because the tablet is a screen anyone can walk up to.

New accounts can only be created by an already-authenticated mentor, via
**Invite User** on the **Manage Users** page (`/users`) — there is no public
sign-up flow. Inviting sends a Clerk invitation to the given email with the
chosen role (`student` or `mentor`); the `teamMembers` roster row is created
automatically once the invite is accepted, synced from a Clerk webhook (see
`convex/auth.ts`). If a webhook is missed, **Sync Clerk** on the same page
reconciles the whole roster against Clerk, creating and updating local rows to
match. It does not delete: rows whose Clerk account is gone are reported as a
count and removed only after the mentor confirms, because that cascade also
deletes their clock sessions.

Role changes go through `api.clerk.updateUserRole`, which writes Clerk
`publicMetadata.role` and mirrors it into the roster immediately. It refuses to
demote the caller, so a mentor cannot lock themselves out. Removing a user
deletes the Clerk account and then the local row and its sessions in the same
action, instead of relying on the `user.deleted` webhook to arrive.

## Reporting Ranges and Exports

The dashboard stores one global hours range used by the dashboard, kiosk, and
member detail pages. Existing deployments default to January 1 of the current
calendar year until a mentor saves a different start/end date. Dashboard and
member detail pages can apply temporary ranges without changing that default.

All dates are interpreted and displayed in the team's time zone, set once as
`TEAM_TIME_ZONE` in `convex/timeZone.ts` and shared by the backend and
`src/lib/format.ts`. Convex functions run in UTC, so boundaries like January 1
and the July 1 grade rollover must never be built from local `Date` getters —
change the constant if the team relocates.

A session counts toward a range when its clock-in is at or after the start and
before the end. Only completed (clocked-out) sessions contribute to hour totals;
open sessions appear as live timers instead. The kiosk is the one exception —
its member card adds the running session's elapsed time to the displayed total
so the number on screen keeps ticking.

A reporting range holds at most 500 sessions per member and the roster at most
500 people. Past either limit the query throws and the UI asks for a narrower
range, rather than returning a page of rows and presenting it as a complete
total.

Roster and dashboard exports are browser-generated CSV files for the currently
visible rows. Member detail exports include raw session rows plus daily and
Monday-Sunday weekly summaries for the selected range.
