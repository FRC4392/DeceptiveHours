# DeceptiveHours

Hour tracking app for Deceivers Robotics Team 4392. Members clock in and out via a kiosk interface; mentors manage the roster and review session history through a protected dashboard.

## Features

- **Time Clock Kiosk** — mentor-unlocked screen where members enter or scan their Member ID to clock in/out. Shows live session timer and hours for the configured reporting range.
- **Mentor Dashboard** — protected view showing currently clocked-in members, configurable total team hours, a roster sorted by hours, and CSV export.
- **Team Member Management** — add and remove members. Member IDs are auto-generated (10-digit, prefixed with `4392`), and roster tables support search, filters, sorting, and CSV export.
- **Student Metadata** — store student start year and grade. Grades advance automatically each July 1 and become Alumni after grade 12.
- **Member Detail** — view and edit member info, generate a QR code, manage session history, choose temporary reporting ranges, and export individual hours with daily and weekly summaries.
- **QR Scanning** — kiosk supports camera-based QR code scanning with `jsQR`.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript (strict), Vite 8 |
| Routing | React Router 7 (SPA mode) |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | [Convex](https://convex.dev) |
| Auth | [Clerk](https://clerk.com) |
| Package manager | Bun |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
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
6. If migrating from the old WorkOS setup and intentionally starting fresh,
   clear old roster/session data before inviting Clerk users:
   ```bash
   npx convex env set ENABLE_DESTRUCTIVE_MIGRATIONS true
   npx convex run migrations:clearWorkosEraRoster '{"confirmation":"DELETE_WORKOS_ROSTER"}'
   npx convex env unset ENABLE_DESTRUCTIVE_MIGRATIONS
   ```
7. Create the first mentor directly in Clerk and set their
   `publicMetadata.role` to `"mentor"`. This has to be done in Clerk itself:
   the in-app **Invite User** flow at `/users` requires an already-signed-in
   mentor, so it cannot bootstrap the first one.
8. Sign in at `/login`. The signed-in user's `teamMembers` row is created
   automatically from the Clerk webhook (`convex/auth.ts`), with its type
   synced from `publicMetadata.role`.

Existing Clerk-synced rows without an `authTokenIdentifier` still work through
a legacy Clerk user ID fallback. A future Clerk `user.updated` webhook, or the
paginated `migrations:backfillClerkAuthTokenIdentifiers` mutation, fills the
provider-scoped identifier used by new rows.

### Development

```bash
bun run dev:all
```

This starts both the Vite dev server and the Convex function watcher concurrently.
The included `setup.sh` helper wraps `bun install` plus `bun run dev:all`; use
`./setup.sh --install-only` when you only want dependencies installed.

| URL | Description |
|---|---|
| `http://localhost:5174/` | Mentor dashboard |
| `http://localhost:5174/clock` | Mentor-unlocked time clock kiosk |
| `http://localhost:5174/login` | Mentor sign-in |
| `http://localhost:5174/members` | Team member roster, filtering, exports, and detail links |
| `http://localhost:5174/users` | Manage users — invite mentors/students by email |

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

Manual production actions may still be needed for operational changes that are
not just code deploys, such as setting Convex env vars, changing Clerk webhook
settings, creating the first mentor, or running a one-off migration/backfill.
For example, after introducing `authTokenIdentifier`, existing Clerk rows can be
backfilled from the Convex dashboard or with:

```bash
npx convex run --prod --identity '{"issuer":"<production-clerk-frontend-api-url>","subject":"<mentor-clerk-user-id>"}' migrations:backfillClerkAuthTokenIdentifiers '{"paginationOpts":{"numItems":100,"cursor":null},"dryRun":true}'
npx convex run --prod --identity '{"issuer":"<production-clerk-frontend-api-url>","subject":"<mentor-clerk-user-id>"}' migrations:backfillClerkAuthTokenIdentifiers '{"paginationOpts":{"numItems":100,"cursor":null},"dryRun":false}'
```

Repeat the command with the returned `continueCursor` in place of `null` until
`isDone` is `true`.
Deploy previews currently run `bun run build` only, so they do not create Convex
preview deployments unless Netlify and `netlify.toml` are changed to use Convex
preview deploys.

## Project Structure

```
convex/          Convex backend — schema, queries, mutations, auth
src/
  assets/        Static assets (logo)
  components/    Shared UI components
  hooks/         Custom React hooks
  layouts/       Route layouts (root, mentor-protected)
  lib/           Utilities (date/duration formatting)
  routes/        Page components
  store/         Zustand UI state
```

## Auth

Sign-in uses Clerk (see [First-time deployment
setup](#first-time-deployment-setup) above). The dashboard (`/`), kiosk
(`/clock`), `/members`, and `/users` all require a signed-in mentor. A mentor
signs in once on the kiosk browser to unlock the shared clock screen for team
members.

Clerk is the source of truth for login, passwords, invitations, and account
recovery. `convex/auth.config.ts` is only the Convex JWT bridge that lets Convex
verify Clerk tokens and make `ctx.auth.getUserIdentity()` work; this app does
not use the legacy Convex Auth password sign-in flow.

New accounts can only be created by an already-authenticated mentor, via
**Invite User** on the **Manage Users** page (`/users`) — there is no public
sign-up flow. Inviting sends a Clerk invitation to the given email with the
chosen role (`student` or `mentor`); the `teamMembers` roster row is created
automatically once the invite is accepted, synced from a Clerk webhook (see
`convex/auth.ts`).

## Reporting Ranges and Exports

The dashboard stores one global hours range used by the dashboard, kiosk, and
member detail pages. Existing deployments default to January 1 of the current
calendar year until a mentor saves a different start/end date. Dashboard and
member detail pages can apply temporary ranges without changing that default.

Roster and dashboard exports are browser-generated CSV files for the currently
visible rows. Member detail exports include raw session rows plus daily and
Monday-Sunday weekly summaries for the selected range.
