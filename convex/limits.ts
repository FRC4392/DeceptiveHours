// Read limits for the handlers that would otherwise `.take()` a page and treat
// it as the whole set. Every handler that hits one of these throws rather than
// returning a short result: a silently truncated hour total or roster is worse
// than a visible, actionable error.
//
// Not a Convex function module — these are plain constants shared by
// `hours.ts`, `clockSessions.ts`, `teamMembers.ts`, and `dashboard.ts`.

export const SESSION_SCAN_LIMIT = 500

export const ROSTER_LIMIT = 500
