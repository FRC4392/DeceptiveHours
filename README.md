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
   `/clerk/webhook`, subscribe it to `user.created`, `user.updated`, and
   `user.deleted`, then copy the webhook signing secret.
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

### Development

```bash
bun run dev:all
```

This starts both the Vite dev server and the Convex function watcher concurrently.

| URL | Description |
|---|---|
| `http://localhost:5174/` | Mentor dashboard |
| `http://localhost:5174/clock` | Mentor-unlocked time clock kiosk |
| `http://localhost:5174/login` | Mentor sign-in |
| `http://localhost:5174/members` | Team member roster, filtering, exports, and detail links |
| `http://localhost:5174/users` | Manage users — invite mentors/students by email |

## Deployment

### 1. Deploy Convex to production

```bash
bunx convex deploy
```

Repeat the Clerk env vars from [First-time deployment
setup](#first-time-deployment-setup) against the production deployment
(`npx convex env set <VAR> <value> --prod`), and add
`VITE_CLERK_PUBLISHABLE_KEY` for the production Clerk app in Netlify
(step 2 below). Use the production Clerk Frontend API URL for
`CLERK_JWT_ISSUER_DOMAIN`.

### 2. Deploy frontend to Netlify

Connect the repo in the [Netlify dashboard](https://app.netlify.com). Add the following environment variables under **Site configuration → Environment variables**:

| Variable | Value |
|---|---|
| `VITE_CONVEX_URL` | Your Convex production URL (e.g. `https://xxxx.convex.cloud`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Your production Clerk publishable key |
| `CONVEX_DEPLOY_KEY` | Found in Convex dashboard → Settings → Deploy key |

The `netlify.toml` at the repo root handles the build command, publish directory, and SPA redirects automatically.

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
