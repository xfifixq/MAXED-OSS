#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ECOSYSTEM_FILE="$ROOT_DIR/infra/pm2/ecosystem.full.config.cjs"
REBUILD=0
ENABLE_OPENCPA_PM2=0

for arg in "$@"; do
  case "$arg" in
    --rebuild)
      REBUILD=1
      ;;
    --with-opencpa)
      ENABLE_OPENCPA_PM2=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--rebuild] [--with-opencpa]" >&2
      exit 1
      ;;
  esac
done

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 is required but not installed." >&2
  exit 1
fi

kill_listener_on_port() {
  local port="$1"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  elif command -v fuser >/dev/null 2>&1; then
    pids="$(fuser -n tcp "$port" 2>/dev/null || true)"
  fi

  if [[ -n "$pids" ]]; then
    echo "Clearing existing listener(s) on port $port: $pids"
    kill -9 $pids >/dev/null 2>&1 || true
  fi
}

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

  local ports=(3005 3006 3007 4000 4100 4101 4102 4103 4104 4105)
  for port in "${ports[@]}"; do
    kill_listener_on_port "$port"
  done

  MAXED_ENABLE_OPENCPA_PM2="$ENABLE_OPENCPA_PM2" pm2 start "$ECOSYSTEM_FILE" --update-env
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
    rm -rf .next
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
  if [[ "$ENABLE_OPENCPA_PM2" -eq 1 ]]; then
    build_app_if_present "opencpa" "OpenCPA"
  fi
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
