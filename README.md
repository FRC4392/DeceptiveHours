# DeceptiveHours

Hour tracking app for Deceivers Robotics Team 4392. Members clock in and out via a kiosk interface; mentors manage the roster and review session history through a protected dashboard.

## Features

- **Time Clock Kiosk** — mentor-unlocked screen where members enter or scan their Member ID to clock in/out. Shows live session timer and year-to-date hours.
- **Mentor Dashboard** — protected view showing currently clocked-in members, total team hours YTD, and a full roster sorted by hours.
- **Team Member Management** — add and remove members. Member IDs are auto-generated (10-digit, prefixed with `4392`).
- **Member Detail** — view and edit member info, generate a QR code for their ID, and manage their full session history.
- **QR Scanning** — kiosk supports camera-based QR code scanning with `jsQR`.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript (strict), Vite 8 |
| Routing | React Router 7 (SPA mode) |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | [Convex](https://convex.dev) |
| Auth | [WorkOS AuthKit](https://workos.com/docs/authkit) |
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

Auth is handled entirely by WorkOS AuthKit — there's no local password store,
so a brand-new deployment needs WorkOS configured before anyone can sign in:

1. Create a WorkOS organization for the team.
2. In the WorkOS dashboard, define two Roles on that organization: `mentor`
   and `student`. A membership's Role slug is what this app treats as
   permission level (see `deriveType` in [`convex/auth.ts`](convex/auth.ts)).
3. Set the server-side WorkOS env vars on the Convex deployment:
   ```bash
   npx convex env set WORKOS_API_KEY <...>
   npx convex env set WORKOS_CLIENT_ID <...>
   npx convex env set WORKOS_ORGANIZATION_ID <...>
   npx convex env set WORKOS_ENVIRONMENT_CLIENT_ID <...>
   ```
   See the comments in [`convex/auth.config.ts`](convex/auth.config.ts) and
   [`convex/workos.ts`](convex/workos.ts) for what each variable does —
   `WORKOS_ENVIRONMENT_CLIENT_ID` in particular matters if your WorkOS
   environment hosts more than one app.
4. Copy `.env.example` to `.env.local` and set the client-side WorkOS vars
   (`VITE_CONVEX_URL`, `VITE_WORKOS_CLIENT_ID`, `VITE_WORKOS_REDIRECT_URI`).
5. Invite the first mentor directly from the WorkOS dashboard (or API) with
   the `mentor` role slug on their organization membership. This has to be
   done in WorkOS itself — the in-app **Invite User** flow at `/users`
   requires an already-signed-in mentor, so it can't bootstrap the first one.
6. Sign in at `/login`. The signed-in user's `teamMembers` row is created
   automatically from the WorkOS webhook (`convex/auth.ts`), with its type
   synced from the Role on their organization membership.

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
| `http://localhost:5174/members` | Team member management |
| `http://localhost:5174/users` | Manage users — invite mentors/students by email |

## Deployment

### 1. Deploy Convex to production

```bash
bunx convex deploy
```

Repeat the WorkOS env vars from [First-time deployment
setup](#first-time-deployment-setup) against the production deployment
(`npx convex env set <VAR> <value> --prod`), and add `VITE_WORKOS_CLIENT_ID`
/ `VITE_WORKOS_REDIRECT_URI` for the production frontend origin in Netlify
(step 2 below).

### 2. Deploy frontend to Netlify

Connect the repo in the [Netlify dashboard](https://app.netlify.com). Add the following environment variables under **Site configuration → Environment variables**:

| Variable | Value |
|---|---|
| `VITE_CONVEX_URL` | Your Convex production URL (e.g. `https://xxxx.convex.cloud`) |
| `VITE_WORKOS_CLIENT_ID` | Your production WorkOS client ID |
| `VITE_WORKOS_REDIRECT_URI` | Your production frontend redirect URI |
| `CONVEX_DEPLOY_KEY` | Found in Convex dashboard → Settings → Deploy key |

This app keeps AuthKit's client-side `devMode` enabled in production so the
free WorkOS setup works without a paid custom Authentication API domain.

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

Sign-in uses WorkOS AuthKit (see [First-time deployment
setup](#first-time-deployment-setup) above). The dashboard (`/`), kiosk
(`/clock`), `/members`, and `/users` all require a signed-in mentor. A mentor
signs in once on the kiosk browser to unlock the shared clock screen for team
members.

New accounts can only be created by an already-authenticated mentor, via
**Invite User** on the **Manage Users** page (`/users`) — there is no public
sign-up flow. Inviting sends a WorkOS invitation to the given email with the
chosen role (`student` or `mentor`); the `teamMembers` roster row is created
automatically once the invite is accepted, synced from a WorkOS webhook (see
`convex/auth.ts`).
