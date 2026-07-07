import type { ReactNode } from "react"
import { Navigate } from "react-router"
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { SignOutButton } from "@clerk/react"

export function Spinner() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

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

export function MentorGate({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <Spinner />
      </AuthLoading>
      <Unauthenticated>
        <Navigate to="/login" replace />
      </Unauthenticated>
      <Authenticated>
        <MentorRoleGate>{children}</MentorRoleGate>
      </Authenticated>
    </>
  )
}
