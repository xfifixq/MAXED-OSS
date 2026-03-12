#!/bin/bash
# =============================================================================
# Maxed — One-time service initialization
# Run ONCE after docker compose up to auto-setup all services.
# This eliminates setup wizards so CPAs see a unified platform.
# =============================================================================
set -e

# Load env vars
cd "$(dirname "$0")"
source .env 2>/dev/null || true

ADMIN_EMAIL="${INVOICENINJA_ADMIN_EMAIL:-admin@maxed.life}"
ADMIN_PASSWORD="${PAPERLESS_ADMIN_PASSWORD:-maxed2024}"
ADMIN_NAME="Maxed Admin"

wait_for_service() {
    local name=$1 url=$2 max=$3
    echo -n "  Waiting for $name..."
    for i in $(seq 1 "$max"); do
        if curl -sf "$url" > /dev/null 2>&1; then
            echo " ready"
            return 0
        fi
        sleep 3
    done
    echo " TIMEOUT (skipping)"
    return 1
}

echo "=== Maxed Service Auto-Setup ==="
echo "Admin: $ADMIN_EMAIL"
echo ""

# --------------------------------------------------
# 1. METABASE — Complete setup wizard via API
# --------------------------------------------------
echo "[1/7] Metabase..."
if wait_for_service "Metabase" "http://localhost:3002/api/health" 40; then
    # Get the setup token
    SETUP_TOKEN=$(curl -sf http://localhost:3002/api/session/properties | python3 -c "import sys,json; print(json.load(sys.stdin).get('setup-token',''))" 2>/dev/null || echo "")
    if [ -n "$SETUP_TOKEN" ] && [ "$SETUP_TOKEN" != "None" ] && [ "$SETUP_TOKEN" != "null" ]; then
        echo "  Setting up Metabase with token..."
        curl -sf -X POST http://localhost:3002/api/setup \
            -H "Content-Type: application/json" \
            -d "{
                \"token\": \"$SETUP_TOKEN\",
                \"user\": {
                    \"email\": \"$ADMIN_EMAIL\",
                    \"password\": \"$ADMIN_PASSWORD\",
                    \"first_name\": \"Maxed\",
                    \"last_name\": \"Admin\",
                    \"site_name\": \"Maxed Analytics\"
                },
                \"prefs\": {
                    \"site_name\": \"Maxed Analytics\",
                    \"site_locale\": \"en\",
                    \"allow_tracking\": false
                }
            }" > /dev/null 2>&1 && echo "  Metabase setup complete" || echo "  Metabase setup failed (may already be configured)"
    else
        echo "  Metabase already set up (no setup token)"
    fi
fi

# --------------------------------------------------
# 2. MATTERMOST — Create admin via CLI
# --------------------------------------------------
echo "[2/7] Mattermost..."
if wait_for_service "Mattermost" "http://localhost:8065/api/v4/system/ping" 40; then
    # Try to create admin user (will fail silently if already exists)
    docker exec maxed-mattermost mmctl user create \
        --email "$ADMIN_EMAIL" \
        --username "maxed-admin" \
        --password "$ADMIN_PASSWORD" \
        --system-admin \
        --local 2>/dev/null && echo "  Mattermost admin created" || echo "  Mattermost admin exists"
    # Create default team
    docker exec maxed-mattermost mmctl team create \
        --name "maxed" \
        --display-name "Maxed" \
        --local 2>/dev/null && echo "  Mattermost team created" || echo "  Mattermost team exists"
    # Add admin to team
    docker exec maxed-mattermost mmctl team users add maxed maxed-admin \
        --local 2>/dev/null || true
fi

# --------------------------------------------------
# 3. N8N — Create owner via API
# --------------------------------------------------
echo "[3/7] n8n..."
if wait_for_service "n8n" "http://localhost:5678/healthz" 30; then
    # Try the setup endpoint
    curl -sf -X POST http://localhost:5678/rest/owner/setup \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$ADMIN_EMAIL\",
            \"password\": \"$ADMIN_PASSWORD\",
            \"firstName\": \"Maxed\",
            \"lastName\": \"Admin\"
        }" > /dev/null 2>&1 && echo "  n8n owner created" || echo "  n8n owner exists or setup not available"
fi

# --------------------------------------------------
# 4. DOCUSEAL — Complete initial setup
# --------------------------------------------------
echo "[4/7] DocuSeal..."
if wait_for_service "DocuSeal" "http://localhost:3003" 30; then
    # DocuSeal auto-creates admin on first POST to /auth/sign_up
    curl -sf -X POST http://localhost:3003/auth/sign_up \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$ADMIN_EMAIL\",
            \"password\": \"$ADMIN_PASSWORD\",
            \"name\": \"$ADMIN_NAME\"
        }" > /dev/null 2>&1 && echo "  DocuSeal admin created" || echo "  DocuSeal admin exists"
fi

# --------------------------------------------------
# 5. INVOICE NINJA — Run migrations + check status
# --------------------------------------------------
echo "[5/7] Invoice Ninja..."
if wait_for_service "Invoice Ninja" "http://localhost:8080" 40; then
    # Run artisan setup inside container
    docker exec maxed-invoiceninja php artisan migrate --force 2>/dev/null && echo "  Invoice Ninja migrations done" || echo "  Invoice Ninja migrations skipped"
    docker exec maxed-invoiceninja php artisan db:seed --force 2>/dev/null || true
    echo "  Invoice Ninja ready"
else
    echo "  Invoice Ninja not responding — check: docker logs maxed-invoiceninja"
fi

# --------------------------------------------------
# 6. TWENTY CRM — Run migrations
# --------------------------------------------------
echo "[6/7] Twenty CRM..."
if wait_for_service "Twenty CRM" "http://localhost:3004" 60; then
    echo "  Twenty CRM is up"
else
    echo "  Twenty CRM not responding — check: docker logs maxed-twenty"
    # Try to run DB setup
    docker exec maxed-twenty npx ts-node ./scripts/setup-db.ts 2>/dev/null || true
fi

# --------------------------------------------------
# 7. BIGCAPITAL — Check status
# --------------------------------------------------
echo "[7/7] Bigcapital..."
if wait_for_service "Bigcapital API" "http://localhost:3000" 40; then
    echo "  Bigcapital server is up"
    if wait_for_service "Bigcapital Webapp" "http://localhost:3001" 20; then
        echo "  Bigcapital webapp is up"
    fi
else
    echo "  Bigcapital not responding — check: docker logs maxed-bigcapital-server"
fi

echo ""
echo "=== Service Status ==="
for svc in "Paperless:8000" "Metabase:3002" "DocuSeal:3003" "n8n:5678" "Mattermost:8065" "Kimai:8001" "Bigcapital:3001" "Invoice Ninja:8080" "Twenty CRM:3004"; do
    name="${svc%%:*}"
    port="${svc##*:}"
    STATUS=$(curl -so /dev/null -w "%{http_code}" "http://localhost:$port/" --max-time 3 2>/dev/null || echo "000")
    if [ "$STATUS" = "000" ]; then
        echo "  $name (port $port): DOWN"
    else
        echo "  $name (port $port): HTTP $STATUS"
    fi
done
echo ""
echo "=== Done ==="
echo "All services initialized with admin: $ADMIN_EMAIL"
echo "Services that show DOWN may need more startup time. Re-run this script or check docker logs."
