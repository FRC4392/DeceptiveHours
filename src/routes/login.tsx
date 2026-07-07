import { Navigate } from "react-router"
import { useAuth } from "@workos-inc/authkit-react"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import logo from "@/assets/logo.png"

function SignInCard() {
  const { isLoading, signIn } = useAuth()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 p-4">
      <div className="mb-8">
        <img src={logo} alt="Deceivers Robotics Team 4392" className="h-14 w-auto" />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Mentor Sign In</CardTitle>
          <CardDescription>
            Sign in with your WorkOS account to access the mentor dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" disabled={isLoading} onClick={() => signIn()}>
            {isLoading ? "Please wait…" : "Sign in with WorkOS"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// Auth state is read purely from Convex's own confirmation (via the
// Authenticated/Unauthenticated/AuthLoading boundaries), not WorkOS's raw
// client-side state — mixing the two caused a fast redirect ping-pong with
// MentorLayout, since the two sources resolve on different timelines.
export default function LoginPage() {
  return (
    <>
      <AuthLoading>
        <div className="flex min-h-svh items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AuthLoading>
      <Authenticated>
        <Navigate to="/" replace />
      </Authenticated>
      <Unauthenticated>
        <SignInCard />
      </Unauthenticated>
    </>
  )
}
