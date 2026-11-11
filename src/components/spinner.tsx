import { cn } from "@/lib/utils"

/**
 * Loading indicator with an accessible name.
 *
 * The app previously repeated a bare spinning `<div>` in six places, which
 * screen readers announce as nothing at all — a blind mentor got silence while
 * the page loaded. `role="status"` plus visually hidden text fixes that.
 */
export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string
  label?: string
}) {
  return (
    <div role="status" className={cn("inline-flex items-center justify-center", className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** Spinner centred in the full viewport, for route-level loading states. */
export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner label={label} />
    </div>
  )
}
