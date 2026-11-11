import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "edge-runtime",
    // `src/lib` holds pure helpers (CSV escaping, duration/date formatting,
    // session staleness) that are worth testing directly. Components are not
    // collected — they would need a DOM environment.
    include: ["convex/**/*.test.ts", "src/lib/**/*.test.ts"],
    alias: {
      "@convex": new URL("./convex", import.meta.url).pathname,
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
})
