import type { ReactNode } from "react"
import { Link, Navigate } from "react-router"
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { FullPageSpinner } from "@/components/spinner"
import { SignOutButton } from "@clerk/react"

// Re-exported under the old name so existing imports of `Spinner` keep working.
export const Spinner = FullPageSpinner

function Forbidden() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Mentor access required</h1>
        <p className="text-sm text-muted-foreground">
          This screen must be unlocked by a mentor account.
        </p>
        <SignOutButton redirectUrl="/login">
          <Button>Sign out</Button>
        </SignOutButton>
      </div>
    </div>
  )
}

function MentorRoleGate({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me)

  if (me === undefined) return <Spinner />
  if (me?.role !== "mentor") return <Forbidden />
  return <>{children}</>
}

/**
 * Shown at `/clock` when the browser has neither a kiosk device token nor a
 * signed-in mentor — a tablet that was never set up, or a mentor whose Clerk
 * session lapsed while the page was open. Bouncing silently to `/login` left
 * students staring at an unexplained sign-in form mid-meeting.
 */
function KioskLocked() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="font-heading text-2xl font-bold italic uppercase tracking-tight">
          Kiosk locked
        </h1>
        <p className="text-sm text-muted-foreground">
          This device isn't set up as a kiosk and nobody is signed in. Your hours
          are safe — nothing was lost.
        </p>
        <p className="text-sm text-muted-foreground">
          A mentor can sign in here and register this tablet from{" "}
          <strong>Kiosks</strong>, which keeps the time clock running for the
          season without anyone staying signed in.
        </p>
        <Link to="/login">
          <Button>Mentor sign-in</Button>
        </Link>
      </div>
    </div>
  )
}

export function MentorGate({
  children,
  kiosk = false,
}: {
  children: ReactNode
  kiosk?: boolean
}) {
  return (
    <>
      <AuthLoading>
        <Spinner />
      </AuthLoading>
      <Unauthenticated>
        {kiosk ? <KioskLocked /> : <Navigate to="/login" replace />}
      </Unauthenticated>
      <Authenticated>
        <MentorRoleGate>{children}</MentorRoleGate>
      </Authenticated>
    </>
  )
}
