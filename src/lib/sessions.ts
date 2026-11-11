// A session left open past this point is almost certainly a forgotten
// clock-out rather than someone still working. Those sessions never count
// toward anyone's hours and keep inflating the "Currently Clocked In" tile, so
// the UI calls them out instead of leaving them to be noticed by accident.
export const STALE_SESSION_MS = 12 * 60 * 60 * 1000

export function isStaleSession(clockIn: number, now = Date.now()): boolean {
  return now - clockIn >= STALE_SESSION_MS
}
