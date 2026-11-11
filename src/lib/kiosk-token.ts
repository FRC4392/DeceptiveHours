// The kiosk device token lives in this browser's localStorage and nowhere
// else. It is what lets the shared tablet keep working for a season without a
// mentor's Clerk session — and what keeps it limited to the clock screen.
//
// Every access is guarded: Safari throws on localStorage in private mode, and
// a kiosk that crashes on load is worse than one that asks to be set up again.

const STORAGE_KEY = "deceptive-hours.kiosk-token"

export function readKioskToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeKioskToken(token: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, token)
    return true
  } catch {
    return false
  }
}

export function clearKioskToken() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing to clear */
  }
}
