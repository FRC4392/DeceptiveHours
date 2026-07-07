import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import { ClerkProvider, useAuth } from "@clerk/react"
import { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ThemeProvider } from "next-themes"
import "./index.css"
import { router } from "./router"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string
if (!clerkPublishableKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/login">
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RouterProvider router={router} />
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </StrictMode>,
)
