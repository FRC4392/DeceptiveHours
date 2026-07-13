import { useState } from "react"
import { NavLink, Outlet } from "react-router"
import { UserButton } from "@clerk/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LayoutDashboard, Menu, UserCog, Users } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import logo from "@/assets/logo.png"
import { MentorGate } from "./mentor-gate"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
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
        <div className="px-2">
          <a 
          href="https://apps.deceivers.org"
          className="text-xs text-white/50 hover:text-white">
          ← Deceivers Apps
          </a>
        </div>
        <div className="px-2">
          <NavLink
            to="/clock"
            className="text-xs text-white/50 hover:text-white"
          >
            ← Time Clock Kiosk
          </NavLink>
        </div>
      </div>
    </div>
  )
}

function HeaderControls() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <ThemeToggle />
      <UserButton />
    </div>
  )
}

function MentorShell() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-brand-navy lg:block">
        <div className="sticky top-0 h-svh">
          <SidebarContent />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b bg-background px-4 py-2 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" />}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <img
            src={logo}
            alt="Deceivers Robotics Team 4392"
            className="h-8 w-auto max-w-[30vw] shrink object-contain"
          />
          <div className="ml-auto">
            <HeaderControls />
          </div>
        </header>

        {/* Desktop header */}
        <header className="sticky top-0 z-20 hidden min-h-14 items-center justify-end gap-3 border-b bg-background px-6 py-2 lg:flex">
          <HeaderControls />
        </header>

        {/* Page content */}
        <main className="flex min-w-0 flex-1 flex-col overflow-auto">
          <div className="mx-auto w-full max-w-[1000px] px-4 py-4 md:px-8 md:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default function MentorLayout() {
  return (
    <MentorGate>
      <MentorShell />
    </MentorGate>
  )
}
