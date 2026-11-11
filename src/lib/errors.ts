import { ConvexError } from "convex/values"

/**
 * The message to show a user for a failed Convex call.
 *
 * A production Convex deployment does **not** send plain `Error` messages to
 * the client — it replaces them with "[Request ID: …] Server Error" so server
 * internals can't leak. Only `ConvexError` carries its payload through. That
 * is why every message a user is meant to read is thrown as a `ConvexError`
 * on the backend, and why `err.message` is not good enough here: in
 * development it shows the real text and in production it shows "Server
 * Error", which is the kind of bug that only appears after deploying.
 *
 * Anything that isn't a `ConvexError` falls back to the caller's own wording
 * rather than exposing the redacted text, and the original is logged so the
 * request ID is still reachable from the browser console.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" && error.data ? error.data : fallback
  }
  // Errors thrown by client code itself still carry a usable message.
  if (error instanceof Error && !isRedactedServerError(error)) {
    return error.message || fallback
  }
  console.error(error)
  return fallback
}

function isRedactedServerError(error: Error): boolean {
  return /Server Error/.test(error.message)
}
