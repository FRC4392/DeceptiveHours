# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

DeceptiveHours — hour tracking for FRC Team 4392 (Deceivers Robotics). Team
members clock in/out on a shared kiosk; mentors manage the roster and review
hours on a protected dashboard. React 19 + Vite SPA on a Convex backend, with
Clerk for auth. Deployed on Netlify.

`README.md` covers setup, deployment, and operations. `USER_MANUAL.md` is
written for mentors and students, not developers. **Both are part of the
deliverable — update them whenever a user-visible flow, route, or setup step
changes.**

## Commands

```bash
bun run dev:all      # Vite (port 5174, strict) + convex dev watcher
bun run test         # Vitest — convex/**/*.test.ts and src/lib/**/*.test.ts
bun run typecheck    # tsc -b
bun run lint         # ESLint
bun run build        # tsc -b && vite build
```

`typecheck` used to be `tsc --noEmit`, which compiled **zero files**: the root
`tsconfig.json` is `files: []` plus project references, which plain `tsc`
ignores. It is now `tsc -b`, which honours the references and really does check
`src`. Note that it does **not** typecheck `convex/` — that happens through the
Convex CLI (`convex dev` / `convex deploy`), which uses `convex/tsconfig.json`.
The Vitest run is the practical check on `convex/`.

Always run `bun run test`, `bun run lint`, and `bun run build` before calling a
change done. All three are currently clean.

## Architecture

### Auth and authorization — the thing to get right

Clerk is the source of truth for accounts. Convex mirrors them into
`teamMembers` and stores everything hours-related.

- `convex/http.ts` — the only unauthenticated entry point. Clerk `user.created`
  / `user.updated` / `user.deleted` webhooks, verified with a hand-rolled Svix
  HMAC check (timestamp skew ≤ 5 min, constant-time compare). It calls the
  internal mutations in `convex/auth.ts`.
- `convex/authz.ts` — `getCurrentMember` / `requireMentor` /
  `requireKioskOrMentor`. **Every** public query, mutation, and action gates on
  `requireMentor`; Node actions can't touch `ctx.db`, so they call
  `internal.users.assertMentor` instead. Preserve this when adding functions.
  The only exceptions are the kiosk functions below and `kiosk.verifyDevice`,
  which takes a token and no identity so an unregistered tablet can be told to
  set itself up; it returns validity and the device's own name, nothing more.
- **Kiosk device tokens.** Exactly five functions accept an optional
  `kioskToken` and gate on `requireKioskOrMentor`:
  `teamMembers.lookupByMemberId`, `teamMembers.getById`,
  `clockSessions.getMemberStatus`, `clockSessions.clockIn` and
  `clockSessions.clockOut`. **Do not widen that set** — it is the entire
  privilege of a tablet that anyone in the room can pick up.
  - The shared tablet holds a long-lived token in localStorage and has *no*
    Clerk session; a mentor clocking someone in from their phone has a Clerk
    session and no token. Both land on `/clock`, which branches in
    `src/routes/clock.tsx`.
  - Tokens live in `kioskDevices`, stored only as a SHA-256 hash, valid for
    `KIOSK_TOKEN_TTL_MS` (~400 days) and revocable from `/kiosks`. Setup mints
    a token on the tablet and then signs Clerk out of it — signing out is the
    security property, not a nicety.
  - `convex/kiosk.test.ts` asserts a token is refused by the roster, dashboard,
    settings, member edits, session edits and device registration. Keep those
    assertions passing when adding functions.
- Identity lookup order: provider-scoped `identity.tokenIdentifier` against the
  `by_authTokenIdentifier` index first, then a legacy `by_clerkUserId` fallback
  for rows created before `authTokenIdentifier` existed. Keep both paths until
  the backfill has run everywhere.
- `users.me` must never throw — the client routes on it (`mentor-gate.tsx`) and
  a throw turns a signed-out user into a broken screen.
- Roles live in Clerk `publicMetadata.role`; anything other than `"mentor"`
  reads as `"student"`. The first mentor must be created in Clerk by hand.
  Change a role through `clerk.updateUserRole`, which writes Clerk metadata and
  mirrors it locally via `internal.auth.setMemberRole`. `teamMembers.update`
  deliberately takes no `type`: every `user.updated` webhook overwrites it from
  Clerk, so a local role edit reverted silently, and nothing stopped a mentor
  demoting themselves out of the app.
- The two kiosk lookups (`teamMembers.lookupByMemberId`, `teamMembers.getById`)
  return a reduced shape with no email or Clerk ids. They're mentor-gated, but
  the kiosk is a shared screen — don't widen them.

### Hours model

- `clockSessions` rows have `clockIn`, optional `clockOut`, and an optional
  `status` of `"open" | "closed"`. `status` is still mid-rollout for display
  (`sessionStatus()` in `convex/hours.ts` interprets old rows), but open-session
  *lookups* no longer depend on it: `openSessionFor` in `convex/hours.ts` queries
  the `by_teamMemberId_clockOut` index for `clockOut: undefined`, which is exact
  for pre-`status` rows too. The old 200-row scan fallback is gone — it missed
  stale open sessions buried under newer history. Use that one helper; the
  dashboard used to keep a divergent copy that swallowed duplicates.
- A member may have at most one open session; `openSessionFor` throws on more
  than one. `assertNoOverlappingSession` rejects overlapping manual entries: it
  checks the open session explicitly (an open session has no end, so it can sit
  anywhere in `clockIn` order), then walks closed rows newest-first and stops at
  the first one starting at or before the proposed start.
- Manual entries may not be dated in the future (5-minute skew tolerance) — a
  future open session blocked every later clock-in and made the live timers run
  negative.
- Range convention: `clockIn >= startAt` and `clockIn < endAt`, both pushed into
  the index rather than filtered afterwards. End dates from the UI are
  exclusive — `fromDateInputExclusiveEnd` adds a day, and displays subtract 1 ms.
  Only closed sessions count toward totals.
- Session and roster reads **throw** past `SESSION_SCAN_LIMIT` / `ROSTER_LIMIT`
  (`convex/limits.ts`) instead of returning a short page. Under-reporting hours
  silently is worse than a visible error; keep that behaviour.
- One global range lives in `appSettings` under key `hoursRange`; the dashboard
  and member detail pages can pass a temporary override. Default when unset:
  Jan 1 of the current year → now.
- **All** calendar boundaries and date formatting go through
  `convex/timeZone.ts` (`TEAM_TIME_ZONE`), imported by both the backend and
  `src/lib/format.ts`. Never use local `Date` getters/setters for a team date:
  Convex runs in UTC, so that made the default range start resolve to Jan 1
  00:00 UTC and render as "Dec 31" in the UI.
- The kiosk is the one place that adds live elapsed time on top of completed
  hours, so its number won't match the dashboard. That's intentional.

### Frontend

- Routes are declared in `src/router.tsx` (React Router 7, `createBrowserRouter`).
  `MentorGate` wraps the mentor shell. `/clock` is *not* simply mentor-gated:
  `src/routes/clock.tsx` checks for a kiosk device token first and falls back
  to `MentorGate` only when there isn't one, so the shared tablet and a
  mentor's phone both work without the tablet carrying mentor privileges.
  `MentorGate` takes a `kiosk` prop so that fallback renders a "Kiosk locked"
  explanation rather than silently swapping in Clerk's sign-in form.
- Every route is lazy (`lazy: lazyComponent(() => import(...))`) so the kiosk
  does not download the mentor pages. Keep new routes lazy.
- `src/routes/error.tsx` holds the root `ErrorBoundary`, the `*` not-found page,
  and `MemberErrorBoundary`. The last one exists because `/members/:memberDocId`
  takes a **Convex document ID**, not the team's 10-digit Member ID, so a
  hand-typed URL makes `getById` reject its arguments mid-render; that case
  renders "Member not found" rather than an error report.
- Data comes from Convex live queries (`useQuery`/`useMutation`/`useAction`);
  there is no client-side cache layer. UI state is plain `useState` — the
  Zustand store was removed because nothing imported it. The one exception to
  live queries is Clerk-side data such as pending invitations, which only a
  Node action can reach and so is fetched once and refreshed by hand.
- shadcn/ui components in `src/components/ui` sit on Base UI (`@base-ui/react`),
  not Radix. Some accept a `render` prop where Radix used `asChild`.
- Path aliases: `@/*` → `src/*`, `@convex/*` → `convex/*`.
- Use `Spinner` / `FullPageSpinner` from `src/components/spinner.tsx` for
  loading states — they carry `role="status"` and a visually hidden label.
  Don't hand-roll a bare spinning `<div>`; screen readers announce nothing.
- Icon-only buttons need an `aria-label`. Sortable table headers need both a
  direction-specific icon and `aria-sort` on the `TableHead`.
- `index.html` has a blocking inline script that applies the stored theme
  before first paint. If the `ThemeProvider` storage key or `attribute` in
  `src/main.tsx` changes, change that script too or the flash comes back.
- `convex/memberId.ts` holds the Member ID pattern used by both the server's
  validator and the kiosk's pre-lookup check — don't re-inline the regex.
- Brand tokens (`brand-core`, `brand-deep`, `brand-navy`, …) and `font-heading`
  are defined in `src/index.css` under `@theme inline`. Headings across the app
  are `font-heading` + bold + italic + uppercase; match that.
- Clerk's sign-in chrome is themed in `src/routes/login.tsx` with hex values
  mirroring the CSS variables — if the palette changes there, change it here too.

### Grades

`studentGrade` is stored with `studentGradeAsOfSchoolYear`, and
`computeDisplayGrade` advances it on the fly. School years roll over July 1
team-time (`currentSchoolYear`). Past grade 12 the display grade becomes
`"alumni"`. This logic is duplicated in `convex/studentInfo.ts` and
`src/lib/student-info.ts` — keep them in sync; both read the calendar date from
`convex/timeZone.ts` so the rollover instant can't drift between them.

Anything that writes `studentGrade` must send the **displayed** grade, not the
stored one, because the write re-pins `studentGradeAsOfSchoolYear` to the
current school year. Seeding an edit form from the stored value silently rolled
students back a grade on any unrelated edit. Omitting `studentGrade` or
`studentStartYear` in `teamMembers.update` clears them.

## Conventions

- No semicolons, double quotes, 2-space indent (`scripts/` is the exception and
  uses semicolons).
- Every Convex function declares `args` **and** `returns` validators. Follow
  that for new functions.
- Convex handlers use `.take(500)` rather than unbounded collects, and throw a
  clear error when the limit is hit. Keep that pattern.
- Comments in this codebase explain *why* (rollout state, security reasoning,
  Clerk quirks), not *what*. Match the density — it's low.
- Errors surface to users through `sonner` toasts; mutations throw plain
  `Error`s with human-readable messages.

## Testing

Vitest with `convex-test` in an edge-runtime environment. `vitest.config.ts`
collects `convex/**/*.test.ts` plus `src/lib/**/*.test.ts` — the pure frontend
helpers (CSV escaping, duration/date formatting, session staleness) are tested
directly. There are no component tests; those would need a DOM environment.
Tests set
`CLERK_JWT_ISSUER_DOMAIN` themselves and use `t.withIdentity({ issuer, subject })`
to simulate a signed-in Clerk user — see `convex/auth.test.ts` for the webhook
signing helper.

## Deployment notes

Netlify builds from the production branch and runs `npx convex deploy … --cmd
'bun run build'`, so schema and function changes ship with the frontend. Deploy
previews run `bun run build` only — no Convex preview deployment. Convex env
vars (`CLERK_JWT_ISSUER_DOMAIN`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`)
and Clerk webhook config are manual, per-deployment steps. Webhooks point at
`.convex.site`, clients at `.convex.cloud`.

`convex/_generated` is committed on purpose (CI/CD needs it) — regenerate with
`bunx convex dev` after schema or function signature changes.

## Known loose ends

- `convex/migrations.ts` backfills are paginated and mentor-gated; they're
  one-shot operational tools, not something to call from the app.
  `migrations:backfillClockSessionStatus` is still worth running in production:
  `sessionStatus()` interprets pre-`status` rows correctly, but the data stays
  inconsistent until it does.
- `convex/_generated` is only refreshed by `bunx convex dev`. It derives types
  from the source modules, so new *exports* typecheck without regenerating, but
  new *modules* and schema indexes do not appear until it runs.
- The dashboard is an N+1: one `completedMsForRange` per member per load, on a
  live query. The per-member open-session lookup is now a single indexed read,
  which removed the worst of it, but a large roster with years of history will
  still push against Convex's per-query document limit. A stored aggregate or
  pagination is the real fix.
- `public/favicon.png` is unreferenced; it looks like the master image the rest
  of the favicon set was generated from, so it was left in place.
