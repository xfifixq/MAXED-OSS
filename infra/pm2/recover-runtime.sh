#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ECOSYSTEM_FILE="$ROOT_DIR/infra/pm2/ecosystem.full.config.cjs"
REBUILD=0

for arg in "$@"; do
  case "$arg" in
    --rebuild)
      REBUILD=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--rebuild]" >&2
      exit 1
      ;;
  esac
done

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 is required but not installed." >&2
  exit 1
fi

delete_pm2_app() {
  pm2 delete "$1" >/dev/null 2>&1 || true
}

restart_pm2_stack() {
  local app_names=(
    platform
    dashboard
    portal
    opencpa
    maxed-dashboard
    maxed-portal
    maxed-opencpa
    maxed-gateway
    maxed-auth
    maxed-api
    maxed-external-api
    maxed-stream
    maxed-config
  )

  for name in "${app_names[@]}"; do
    delete_pm2_app "$name"
  done

  pm2 start "$ECOSYSTEM_FILE" --update-env
  pm2 save
}

build_app_if_present() {
  local dir="$1"
  local label="$2"

  if [[ ! -f "$ROOT_DIR/$dir/package.json" ]]; then
    return 0
  fi

  echo "Installing dependencies for $label..."
  (
    cd "$ROOT_DIR/$dir"
    npm install
  )

  if [[ "$dir" == "platform" ]]; then
    return 0
  fi

  echo "Building $label..."
  (
    cd "$ROOT_DIR/$dir"
    npm run build
  )
}

if [[ ! -f "$ECOSYSTEM_FILE" ]]; then
  echo "Missing PM2 ecosystem file: $ECOSYSTEM_FILE" >&2
  exit 1
fi

if [[ "$REBUILD" -eq 1 ]]; then
  build_app_if_present "platform" "platform"
  build_app_if_present "dashboard" "dashboard"
  build_app_if_present "client-portal" "client portal"
  build_app_if_present "opencpa" "OpenCPA"
fi

echo "Restarting PM2 runtime with a clean app set..."
restart_pm2_stack

echo
echo "PM2 status:"
pm2 list

echo
echo "Next steps:"
echo "  1. Verify the API gateway:  curl -I http://127.0.0.1:4100/health"
echo "  2. Verify the dashboard:    curl -I http://127.0.0.1:3005"
echo "  3. If nginx is fronting the stack, restart it after app changes."
