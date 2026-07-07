import { createBrowserRouter, Navigate } from "react-router"
import RootLayout from "@/layouts/root-layout"
import MentorLayout from "@/layouts/mentor-layout"
import ClockPage from "@/routes/clock"
import LoginPage from "@/routes/login"
import DashboardPage from "@/routes/dashboard"
import MembersPage from "@/routes/members/index"
import MemberDetailPage from "@/routes/members/detail"
import UsersPage from "@/routes/users/index"

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      {
        path: "/clock",
        Component: ClockPage,
      },
      {
        path: "/login",
        Component: LoginPage,
      },
      {
        Component: MentorLayout,
        children: [
          {
            index: true,
            Component: DashboardPage,
          },
          {
            path: "/dashboard",
            element: <Navigate to="/" replace />,
          },
          {
            path: "/members",
            Component: MembersPage,
          },
          {
            path: "/members/:memberId",
            Component: MemberDetailPage,
          },
          {
            path: "/users",
            Component: UsersPage,
          },
        ],
      },
    ],
  },
])
