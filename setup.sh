#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Maxed OpenCPA — One-command setup
# Generates secrets, installs deps, starts services, seeds data
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SECRETS_ONLY=false

if [[ "${1:-}" == "--secrets-only" ]]; then
    SECRETS_ONLY=true
    echo "==> Running in secrets-only mode (regenerating passwords)"
fi

# ──────────────────────────────────────────
# 1. Generate all secrets
# ──────────────────────────────────────────
echo ""
echo "==> Generating secrets..."

ENV_FILE="$ROOT_DIR/infra/.env"

# Helper: replace a key in .env, or append if missing
set_env() {
    local key="$1" value="$2" file="${3:-$ENV_FILE}"
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# Database passwords
set_env "POSTGRES_PASSWORD"                "$(openssl rand -hex 16)"
set_env "BIGCAPITAL_MYSQL_ROOT_PASSWORD"   "$(openssl rand -hex 16)"
set_env "BIGCAPITAL_MYSQL_PASSWORD"        "$(openssl rand -hex 16)"
set_env "INVOICENINJA_MYSQL_ROOT_PASSWORD" "$(openssl rand -hex 16)"
set_env "INVOICENINJA_MYSQL_PASSWORD"      "$(openssl rand -hex 16)"
set_env "KIMAI_MYSQL_ROOT_PASSWORD"        "$(openssl rand -hex 16)"
set_env "KIMAI_MYSQL_PASSWORD"             "$(openssl rand -hex 16)"

# Service admin passwords
ADMIN_PASS="$(openssl rand -hex 12)"
set_env "PAPERLESS_ADMIN_PASSWORD"  "$ADMIN_PASS"
set_env "N8N_BASIC_AUTH_PASSWORD"   "$ADMIN_PASS"
set_env "KIMAI_ADMIN_PASSWORD"      "$ADMIN_PASS"

# Invoice Ninja APP_KEY
set_env "INVOICENINJA_APP_KEY" "base64:$(openssl rand -base64 32)"

# Twenty CRM JWT secrets
set_env "TWENTY_ACCESS_TOKEN_SECRET"  "$(openssl rand -hex 32)"
set_env "TWENTY_LOGIN_TOKEN_SECRET"   "$(openssl rand -hex 32)"
set_env "TWENTY_REFRESH_TOKEN_SECRET" "$(openssl rand -hex 32)"

# Update Mattermost datasource with new postgres password
PG_PASS=$(grep "^POSTGRES_PASSWORD=" "$ENV_FILE" | cut -d= -f2)
set_env "MM_SQLSETTINGS_DATASOURCE" "postgres://maxed:${PG_PASS}@postgres:5432/mattermost?sslmode=disable"

# NextAuth secret for dashboard
NEXTAUTH_SECRET="$(openssl rand -hex 32)"
DASHBOARD_ENV="$ROOT_DIR/dashboard/.env.local"
if [[ -f "$DASHBOARD_ENV" ]]; then
    set_env "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET" "$DASHBOARD_ENV"
fi

# Update platform DATABASE_URL with new postgres password
PLATFORM_ENV="$ROOT_DIR/platform/.env"
if [[ -f "$PLATFORM_ENV" ]]; then
    set_env "DATABASE_URL" "postgresql://maxed:${PG_PASS}@localhost:5432/maxed_unified" "$PLATFORM_ENV"
fi

echo "    Secrets written to:"
echo "      - $ENV_FILE"
echo "      - $DASHBOARD_ENV"
echo "      - $PLATFORM_ENV"
echo ""
echo "    Shared admin password for Paperless / n8n / Kimai: $ADMIN_PASS"
echo "    (save this somewhere — it won't be shown again)"
echo ""

if $SECRETS_ONLY; then
    echo "==> Done (secrets-only mode). Restart containers to apply:"
    echo "    cd infra && docker compose down && docker compose up -d"
    exit 0
fi

# ──────────────────────────────────────────
# 2. Install npm dependencies
# ──────────────────────────────────────────
echo "==> Installing dependencies..."

for dir in platform dashboard client-portal opencpa; do
    if [[ -f "$ROOT_DIR/$dir/package.json" ]]; then
        echo "    npm install in $dir/"
        (cd "$ROOT_DIR/$dir" && npm install --no-audit --no-fund)
    fi
done

# ──────────────────────────────────────────
# 3. Start Docker services
# ──────────────────────────────────────────
echo ""
echo "==> Starting Docker services..."
(cd "$ROOT_DIR/infra" && docker compose up -d)

echo ""
echo "==> Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker compose -f "$ROOT_DIR/infra/docker-compose.yml" exec -T postgres pg_isready -U maxed >/dev/null 2>&1; then
        echo "    PostgreSQL is ready."
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo "    WARNING: PostgreSQL not ready after 30s. Continuing anyway..."
    fi
    sleep 1
done

# ──────────────────────────────────────────
# 4. Run Prisma migrations and seed
# ──────────────────────────────────────────
echo ""
echo "==> Running database migrations..."
(cd "$ROOT_DIR/platform" && npx prisma migrate deploy)

echo ""
echo "==> Seeding sample data..."
(cd "$ROOT_DIR/platform" && npx prisma db seed)

# ──────────────────────────────────────────
# 5. Done
# ──────────────────────────────────────────
echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  Start the apps:"
echo "    cd dashboard   && npm run dev    # http://localhost:3005"
echo "    cd client-portal && npm run dev  # http://localhost:3006"
echo "    cd opencpa     && npm run dev    # http://localhost:3007"
echo "    cd platform    && npm start      # http://localhost:4000"
echo ""
echo "  Service UIs (via Docker):"
echo "    Paperless-ngx   http://localhost:8000  (admin / $ADMIN_PASS)"
echo "    n8n             http://localhost:5678  (admin / $ADMIN_PASS)"
echo "    Invoice Ninja   http://localhost:8080  (create account on first visit)"
echo "    Bigcapital      http://localhost:3001  (create account on first visit)"
echo "    Metabase        http://localhost:3002  (create account on first visit)"
echo "    DocuSeal        http://localhost:3003  (create account on first visit)"
echo "    Twenty CRM      http://localhost:3004  (create account on first visit)"
echo "    Mattermost      http://localhost:8065  (create account on first visit)"
echo "    Kimai           http://localhost:8001  (admin@maxed.dev / $ADMIN_PASS)"
echo ""
echo "  Next steps:"
echo "    1. Import n8n workflows from platform/n8n-workflows/"
echo "    2. Configure Metabase (connect to PostgreSQL: maxed_unified)"
echo "    3. Set up Bigcapital org and chart of accounts"
echo "    4. See README.md for the full setup checklist"
echo ""
