import { useState } from "react"
import { Navigate, NavLink, Outlet } from "react-router"
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react"
import { useAuth } from "@workos-inc/authkit-react"
import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LayoutDashboard, LogOut, Menu, UserCog, Users } from "lucide-react"
import logo from "@/assets/logo.png"

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/members", label: "Team Members", icon: Users },
  { to: "/users", label: "Manage Users", icon: UserCog },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-brand-core text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut } = useAuth()

  function handleSignOut() {
    signOut({ returnTo: `${window.location.origin}/login` })
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-brand-deep to-brand-navy text-white">
      <div className="flex items-center justify-center px-4 py-3">
        <img src={logo} alt="Deceivers Robotics Team 4392" className="h-10 w-auto" />
      </div>
      <Separator className="bg-white/10" />
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavItems onNavigate={onNavigate} />
      </div>
      <Separator className="bg-white/10" />
      <div className="space-y-1 p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
        <div className="px-2 pt-2">
          <NavLink
            to="/"
            className="text-xs text-white/50 hover:text-white"
          >
            ← Time Clock Kiosk
          </NavLink>
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

// Rendered once Convex confirms the visitor is authenticated. Role-gating
// happens here as a plain conditional render, not an imperative redirect.
function MentorShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const me = useQuery(api.users.me)

  if (me === undefined) return <Spinner />
  if (me?.role !== "mentor") return <Navigate to="/" replace />

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-brand-navy lg:block">
        <div className="sticky top-0 h-svh">
          <SidebarContent />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center gap-3 border-b bg-background px-4 py-3 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <img src={logo} alt="Deceivers Robotics Team 4392" className="h-8 w-auto" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Auth state comes purely from Convex's own confirmation (Authenticated /
// Unauthenticated / AuthLoading), not an imperative navigate() reacting to
// WorkOS's raw client state — the two resolve on different timelines, and
// mixing them caused a fast redirect ping-pong with the login page.
export default function MentorLayout() {
  return (
    <>
      <AuthLoading>
        <Spinner />
      </AuthLoading>
      <Unauthenticated>
        <Navigate to="/login" replace />
      </Unauthenticated>
      <Authenticated>
        <MentorShell />
      </Authenticated>
    </>
  )
}
