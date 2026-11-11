import { createBrowserRouter, Navigate } from "react-router"
import RootLayout from "@/layouts/root-layout"
import { MemberErrorBoundary, NotFoundPage, RouteErrorBoundary } from "@/routes/error"

// Routes are lazy so the kiosk does not download the mentor dashboard, the
// roster tables and the QR/CSV code it never uses. React Router handles the
// loading state for `lazy` routes itself, so no Suspense boundary is needed.
//
// Each module's default export is the route component; `lazy` must return the
// route object properties, hence the `{ Component }` shape.
const lazyComponent =
  (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
    Component: (await load()).default,
  })

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      {
        path: "/clock",
        lazy: lazyComponent(() => import("@/routes/clock")),
      },
      {
        path: "/login",
        lazy: lazyComponent(() => import("@/routes/login")),
      },
      {
        lazy: lazyComponent(() => import("@/layouts/mentor-layout")),
        children: [
          {
            index: true,
            lazy: lazyComponent(() => import("@/routes/dashboard")),
          },
          {
            path: "/dashboard",
            element: <Navigate to="/" replace />,
          },
          {
            path: "/members",
            lazy: lazyComponent(() => import("@/routes/members/index")),
          },
          {
            // `:memberDocId`, not `:memberId` — this segment is the Convex
            // document ID, not the team's 10-digit Member ID. The old name
            // read like the latter and invited hand-built URLs that fail
            // argument validation.
            path: "/members/:memberDocId",
            lazy: lazyComponent(() => import("@/routes/members/detail")),
            ErrorBoundary: MemberErrorBoundary,
          },
          {
            path: "/users",
            lazy: lazyComponent(() => import("@/routes/users/index")),
          },
          {
            path: "/kiosks",
            lazy: lazyComponent(() => import("@/routes/kiosks/index")),
          },
        ],
      },
      {
        path: "*",
        Component: NotFoundPage,
      },
    ],
  },
])
