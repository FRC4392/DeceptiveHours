import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { MentorGate } from "@/layouts/mentor-gate"
import { Button } from "@/components/ui/button"
import { FullPageSpinner } from "@/components/spinner"
import { clearKioskToken, readKioskToken } from "@/lib/kiosk-token"
import TimeClockPage from "./time-clock"

/**
 * The clock screen serves two callers with different trust levels.
 *
 * **The shared tablet** holds a kiosk device token and no Clerk session. It
 * stays valid for a season, survives any Clerk session expiry, and — because
 * the backend only honours that token on the five clock functions — a student
 * who wanders into `/users` on it finds a sign-in page, not the roster.
 *
 * **A mentor on their phone** has no kiosk token and a normal Clerk session.
 * They fall through to `MentorGate`, keep full access, and are never signed
 * out by opening this page.
 */
export default function ClockPage() {
  // Read once on mount: setup replaces the whole page, so this never needs to
  // react to the value changing underneath it.
  const [token] = useState(() => readKioskToken())

  if (token) return <KioskDeviceGate token={token} />

  return (
    <MentorGate kiosk>
      <TimeClockPage />
    </MentorGate>
  )
}

function KioskDeviceGate({ token }: { token: string }) {
  const status = useQuery(api.kiosk.verifyDevice, { kioskToken: token })

  if (status === undefined) return <FullPageSpinner label="Checking this kiosk" />

  if (!status.valid) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="font-heading text-2xl font-bold italic uppercase tracking-tight">
            Kiosk not active
          </h1>
          <p className="text-sm text-muted-foreground">
            {status.reason} Ask a mentor to sign in on this tablet and set it up
            again — no hours have been lost.
          </p>
          <Link to="/login">
            <Button
              onClick={() => {
                // Drop the dead token so the next visit goes straight to
                // sign-in instead of showing this screen again.
                clearKioskToken()
              }}
            >
              Mentor sign-in
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return <TimeClockPage kioskToken={token} />
}
