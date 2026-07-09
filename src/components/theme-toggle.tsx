"use client"

import type { ComponentType } from "react"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type ThemeValue = "light" | "dark" | "system"

type ThemeOption = {
  value: ThemeValue
  label: string
  icon: ComponentType<{ className?: string }>
}

const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light theme", icon: SunIcon },
  { value: "dark", label: "Dark theme", icon: MoonIcon },
  { value: "system", label: "System theme", icon: MonitorIcon },
]

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const currentTheme = theme ?? "system"

  return (
    <div
      role="group"
      aria-label="Theme settings"
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-background p-0.5",
        className
      )}
    >
      {themeOptions.map(({ value, label, icon: Icon }) => {
        const active = currentTheme === value

        return (
          <Tooltip key={value}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={active}
                  title={label}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
                    active &&
                      "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                  )}
                />
              }
            >
              <Icon className="h-4 w-4" />
              <span className="sr-only">{label}</span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
