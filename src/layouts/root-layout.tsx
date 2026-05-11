import { Outlet } from "react-router"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export default function RootLayout() {
  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col">
        <Outlet />
      </div>
      <Toaster richColors closeButton />
    </TooltipProvider>
  )
}
