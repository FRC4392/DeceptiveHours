import { Navigate } from "react-router"
import { SignIn, useUser } from "@clerk/react"
import logo from "@/assets/logo.png"

function SignInCard() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 p-4">
      <div className="mb-6">
        <img src={logo} alt="Deceivers Robotics Team 4392" className="h-14 w-auto" />
      </div>

      <SignIn
        routing="hash"
        forceRedirectUrl="/"
        appearance={{
          elements: {
            rootBox: "w-full max-w-sm",
            cardBox: "w-full shadow-none",
            card: "border border-border bg-card text-card-foreground shadow-sm",
            headerTitle: "font-heading text-2xl font-bold italic uppercase tracking-normal",
            headerSubtitle: "text-muted-foreground",
            formButtonPrimary:
              "bg-brand-core text-white shadow-none hover:bg-brand-core/90 focus:ring-2 focus:ring-ring focus:ring-offset-2",
            footerActionLink: "text-primary hover:text-primary/90",
          },
        }}
      />
    </div>
  )
}

// Login itself is Clerk-only. Convex only verifies Clerk JWTs after sign-in so
// backend functions can authorize the signed-in user.
export default function LoginPage() {
  const { isLoaded, isSignedIn } = useUser()

  if (!isLoaded) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (isSignedIn) return <Navigate to="/" replace />

  return <SignInCard />
}
