import { StrictMode } from "react"
import { useCallback, useMemo } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react"
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react"
import { ThemeProvider } from "next-themes"
import "./index.css"
import { router } from "./router"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

function useConvexAuthFromWorkOS() {
  const { isLoading, user, getAccessToken } = useAuth()

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        return await getAccessToken({ forceRefresh: forceRefreshToken })
      } catch {
        return null
      }
    },
    [getAccessToken],
  )

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [isLoading, user, fetchAccessToken],
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthKitProvider
      clientId={import.meta.env.VITE_WORKOS_CLIENT_ID as string}
      redirectUri={import.meta.env.VITE_WORKOS_REDIRECT_URI as string}
      devMode
    >
      <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthFromWorkOS}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RouterProvider router={router} />
        </ThemeProvider>
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  </StrictMode>,
)
