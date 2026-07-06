import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react"
import { ConvexProviderWithAuthKit } from "@convex-dev/workos"
import { ConvexReactClient } from "convex/react"
import { ThemeProvider } from "next-themes"
import "./index.css"
import { router } from "./router"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthKitProvider
      clientId={import.meta.env.VITE_WORKOS_CLIENT_ID as string}
      redirectUri={import.meta.env.VITE_WORKOS_REDIRECT_URI as string}
    >
      <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
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
