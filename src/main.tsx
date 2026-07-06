import { StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react"
import { ConvexProviderWithAuthKit } from "@convex-dev/workos"
import { ConvexReactClient, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { ThemeProvider } from "next-themes"
import "./index.css"
import { router } from "./router"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

// TEMPORARY: logs the raw WorkOS access token's claims and whatever identity
// Convex resolves from it, to settle what `iss`/`client_id` a real sign-in
// actually carries. Remove once done.
function AuthDebug() {
  const { user, isLoading, getAccessToken } = useAuth()
  const identity = useQuery(api.debug.whoAmI)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      console.log("[authdebug] WorkOS: no user (not signed in)")
      return
    }
    async function logToken() {
      try {
        const token = await getAccessToken()
        const payload = JSON.parse(atob(token.split(".")[1]))
        console.log("[authdebug] raw access token claims:", payload)
      } catch (err) {
        console.log("[authdebug] getAccessToken failed:", err)
      }
    }
    void logToken()
  }, [isLoading, user, getAccessToken])

  useEffect(() => {
    console.log("[authdebug] convex getUserIdentity():", identity)
  }, [identity])

  return null
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthKitProvider
      clientId={import.meta.env.VITE_WORKOS_CLIENT_ID as string}
      redirectUri={import.meta.env.VITE_WORKOS_REDIRECT_URI as string}
    >
      <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
        <AuthDebug />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RouterProvider router={router} />
        </ThemeProvider>
      </ConvexProviderWithAuthKit>
    </AuthKitProvider>
  </StrictMode>,
)
