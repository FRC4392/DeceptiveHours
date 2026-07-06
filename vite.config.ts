import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@convex": path.resolve(__dirname, "./convex"),
    },
  },
  // Fixed, non-default port so this app's origin never collides with
  // sibling WorkOS AuthKit apps also registered for localhost:5173 in the
  // same WorkOS environment (that collision caused refreshed tokens to be
  // minted against the wrong app's client ID — see chat history).
  server: {
    port: 5174,
    strictPort: true,
  },
})
