import { describe, expect, test, vi } from "vitest"
import { ConvexError } from "convex/values"
import { errorMessage } from "./errors"

describe("errorMessage", () => {
  test("uses the payload of a ConvexError", () => {
    expect(errorMessage(new ConvexError("Already clocked in"), "fallback")).toBe(
      "Already clocked in",
    )
  })

  test("falls back rather than showing production's redacted text", () => {
    // What a plain `Error` thrown by a Convex function actually looks like on
    // the client in production — the real message never arrives.
    const redacted = new Error("[Request ID: f01c2deb] Server Error")
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(errorMessage(redacted, "Failed to save session")).toBe(
      "Failed to save session",
    )
  })

  test("keeps messages from errors thrown by client code", () => {
    expect(errorMessage(new Error("This browser blocked local storage"), "nope")).toBe(
      "This browser blocked local storage",
    )
  })

  test("falls back for non-errors and empty payloads", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(errorMessage(undefined, "fallback")).toBe("fallback")
    expect(errorMessage("a string", "fallback")).toBe("fallback")
    expect(errorMessage(new ConvexError(""), "fallback")).toBe("fallback")
    expect(errorMessage(new ConvexError({ code: 409 }), "fallback")).toBe("fallback")
  })
})
