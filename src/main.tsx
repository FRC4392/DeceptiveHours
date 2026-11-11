import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import { ClerkProvider, useAuth } from "@clerk/react"
import { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ThemeProvider } from "next-themes"
import "./index.css"
import { router } from "./router"

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

const rootElement = document.getElementById("root")!

// These are read at build time, so a context that forgot to set them produces
// a site that builds cleanly and then fails on load. That is how Netlify
// deploy previews used to publish a blank page: `vite build` succeeded with no
// VITE_CONVEX_URL, and ConvexReactClient threw in the browser. Naming the
// missing variable on screen beats a white screen and a console stack.
if (!convexUrl || !clerkPublishableKey) {
  const missing = [
    !convexUrl && "VITE_CONVEX_URL",
    !clerkPublishableKey && "VITE_CLERK_PUBLISHABLE_KEY",
  ].filter(Boolean)
  renderConfigError(missing as string[])
} else {
  const convex = new ConvexReactClient(convexUrl)

  createRoot(rootElement).render(
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
}

/** Plain DOM, so this still shows if the app bundle can't start at all. */
function renderConfigError(missing: string[]) {
  console.error(`Missing build-time environment variables: ${missing.join(", ")}`)
  rootElement.innerHTML = `
    <div style="min-height:100svh;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:system-ui,sans-serif">
      <div style="max-width:32rem;text-align:center">
        <h1 style="font-size:1.25rem;margin:0 0 .75rem">This build is not configured</h1>
        <p style="margin:0 0 .75rem;opacity:.75">
          It was built without ${missing.map((name) => `<code>${name}</code>`).join(" and ")},
          so it cannot reach the backend.
        </p>
        <p style="margin:0;opacity:.6;font-size:.875rem">
          Set the missing value for this deploy context in Netlify, then redeploy.
        </p>
      </div>
    </div>
  `
}
