#!/usr/bin/env bash
# DeceptiveHours — full install + dev startup
# Usage: ./setup.sh        → install deps and start both vite + convex
#        ./setup.sh --install-only  → only install deps
set -e

echo "==> Installing dependencies..."
bun install

if [[ "$1" == "--install-only" ]]; then
  echo "==> Done (install only)."
  exit 0
fi

echo "==> Starting dev servers (Vite + Convex)..."
echo "    Press Ctrl+C to stop all."
exec bun run dev:all
