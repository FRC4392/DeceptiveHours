import { Link, isRouteErrorResponse, useParams, useRouteError } from "react-router"
import { Button } from "@/components/ui/button"
import { AlertTriangle, FileQuestion } from "lucide-react"

function Shell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <h1 className="font-heading text-2xl font-bold italic uppercase tracking-tight">
          {title}
        </h1>
        {children}
      </div>
    </div>
  )
}

/** Unmatched URL. Without this React Router renders its own developer error page. */
export function NotFoundPage() {
  return (
    <Shell icon={<FileQuestion className="h-7 w-7" />} title="Page not found">
      <p className="text-sm text-muted-foreground">
        That address doesn't match anything in DeceptiveHours.
      </p>
      <Link to="/">
        <Button>Back to dashboard</Button>
      </Link>
    </Shell>
  )
}

/**
 * Root error boundary. Anything thrown while rendering — including a Convex
 * argument-validation error from a malformed URL parameter — lands here instead
 * of on React Router's raw "Unexpected Application Error" screen.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />

  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected error occurred."

  return (
    <Shell icon={<AlertTriangle className="h-7 w-7" />} title="Something went wrong">
      <p className="text-sm text-muted-foreground">
        The page couldn't be displayed. Reloading usually helps; if it keeps
        happening, pass this message along to whoever maintains the app.
      </p>
      <p className="break-words rounded-md bg-muted px-3 py-2 text-left font-mono text-xs text-muted-foreground">
        {detail}
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Link to="/">
          <Button variant="outline">Dashboard</Button>
        </Link>
      </div>
    </Shell>
  )
}

/**
 * Member detail pages are reachable by hand-typed URL, where the `:memberDocId`
 * segment is a Convex document ID rather than the team's 10-digit Member ID. A
 * wrong value makes `getById` reject its arguments, so that case gets a plain
 * "not found" rather than an error report.
 */
export function MemberErrorBoundary() {
  const error = useRouteError()
  const { memberDocId } = useParams<{ memberDocId: string }>()

  // Decided from the URL rather than the error text, because production
  // redacts server error messages. A well-formed ID that matches nobody is not
  // an error at all — `getById` returns null and the page renders its own
  // "Member not found" — so reaching here with a malformed id is the case
  // worth naming.
  const looksLikeConvexId = /^[a-z0-9]{16,}$/i.test(memberDocId ?? "")
  const message = error instanceof Error ? error.message : ""
  const isBadId =
    !looksLikeConvexId ||
    message.includes("ArgumentValidationError") ||
    message.includes("Validator error") ||
    message.includes("not a valid document ID")

  if (!isBadId) return <RouteErrorBoundary />

  return (
    <Shell icon={<FileQuestion className="h-7 w-7" />} title="Member not found">
      <p className="text-sm text-muted-foreground">
        That member link isn't valid. Open the member from the roster to be sure
        of the address.
      </p>
      <Link to="/members">
        <Button>Back to members</Button>
      </Link>
    </Shell>
  )
}
