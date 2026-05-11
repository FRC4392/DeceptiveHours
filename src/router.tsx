import { createBrowserRouter } from "react-router"
import RootLayout from "@/layouts/root-layout"
import MentorLayout from "@/layouts/mentor-layout"
import TimeClockPage from "@/routes/time-clock"
import LoginPage from "@/routes/login"
import DashboardPage from "@/routes/dashboard"
import MembersPage from "@/routes/members/index"
import MemberDetailPage from "@/routes/members/detail"

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      {
        path: "/",
        Component: TimeClockPage,
      },
      {
        path: "/login",
        Component: LoginPage,
      },
      {
        Component: MentorLayout,
        children: [
          {
            path: "/dashboard",
            Component: DashboardPage,
          },
          {
            path: "/members",
            Component: MembersPage,
          },
          {
            path: "/members/:memberId",
            Component: MemberDetailPage,
          },
        ],
      },
    ],
  },
])
