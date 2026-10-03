#!/bin/bash
# POS Final — Rebuild shared packages (@pos-final/types, @pos-final/validation)
#
# Why this exists: the API imports these packages from their compiled dist/, NOT from
# src/. The host has no node_modules, but the API container already ships tsc plus the
# workspace symlinks — and ./packages is bind-mounted into it — so compiling *inside*
# the container writes dist/ straight onto the host, with no local npm install.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

CONTAINER="${CONTAINER:-posfinal-api}"
TSC="/app/node_modules/.bin/tsc"
PACKAGES=(types validation)   # order matters: validation depends on types

RESTART=0
for arg in "$@"; do
  case "$arg" in
    --restart|-r) RESTART=1 ;;
    -h|--help)
      echo "Usage: $0 [--restart]"
      echo "  --restart, -r   Also restart api, dashboard and superadmin after building"
      exit 0 ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2 ;;
  esac
done

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" >/dev/null 2>&1; then
  echo "✗ Container '$CONTAINER' not found. Start the stack first: docker compose up -d"
  exit 1
fi
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
  echo "✗ Container '$CONTAINER' is not running. Start the stack first: docker compose up -d"
  exit 1
fi

echo "🔨 Rebuilding shared packages..."
for pkg in "${PACKAGES[@]}"; do
  echo "   → @pos-final/$pkg"
  docker exec "$CONTAINER" sh -c "cd /app/packages/$pkg && $TSC"
  if [ ! -f "packages/$pkg/dist/index.js" ]; then
    echo "   ✗ packages/$pkg/dist/index.js was not generated" >&2
    exit 1
  fi
  echo "     ✓ packages/$pkg/dist/index.js"
done

echo "✅ Packages rebuilt."

if [ "$RESTART" -eq 1 ]; then
  echo "♻️  Restarting api, dashboard, superadmin..."
  docker compose restart api dashboard superadmin
  echo "✅ Services restarted."
else
  echo "   Restart the consumers when needed:  docker compose restart api dashboard superadmin"
fi
