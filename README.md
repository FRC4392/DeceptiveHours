# DeceptiveHours

Hour tracking app for Deceivers Robotics Team 4392. Members clock in and out via a kiosk interface; mentors manage the roster and review session history through a protected dashboard.

## Features

- **Time Clock Kiosk** — public-facing screen where members enter or scan their Member ID to clock in/out. Shows live session timer and year-to-date hours.
- **Mentor Dashboard** — protected view showing currently clocked-in members, total team hours YTD, and a full roster sorted by hours.
- **Team Member Management** — add and remove members. Member IDs are auto-generated (10-digit, prefixed with `4392`).
- **Member Detail** — view and edit member info, generate a QR code for their ID, and manage their full session history.
- **QR Scanning** — kiosk supports camera-based QR code scanning via the browser's native `BarcodeDetector` API.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript (strict), Vite 6 |
| Routing | React Router 7 (SPA mode) |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | [Convex](https://convex.dev) |
| Auth | Convex Auth (password-based) |
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

Set up auth keys on the deployment:

```bash
bunx @convex-dev/auth
```

Create an initial mentor account:

```bash
bunx convex run auth:signIn '{"provider":"password","params":{"email":"you@example.com","password":"yourpassword","flow":"signUp"}}'
```

### Development

```bash
bun run dev:all
```

This starts both the Vite dev server and the Convex function watcher concurrently.

| URL | Description |
|---|---|
| `http://localhost:5173/` | Time clock kiosk |
| `http://localhost:5173/login` | Mentor sign-in |
| `http://localhost:5173/dashboard` | Mentor dashboard |
| `http://localhost:5173/members` | Team member management |

## Deployment

### 1. Deploy Convex to production

```bash
bunx convex deploy
bunx @convex-dev/auth --prod
```

### 2. Deploy frontend to Netlify

Connect the repo in the [Netlify dashboard](https://app.netlify.com). Add the following environment variables under **Site configuration → Environment variables**:

| Variable | Value |
|---|---|
| `VITE_CONVEX_URL` | Your Convex production URL (e.g. `https://xxxx.convex.cloud`) |
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
scripts/         One-off CLI scripts (account creation)
```

## Auth

Authentication is mentor-only. The kiosk (`/`) is fully public. New mentor accounts can only be created by an already-authenticated mentor via the **Add Mentor Account** button in the sidebar — there is no public sign-up flow.
