#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== Maxed OpenCPA Infrastructure Setup ==="
echo ""

# Generate random secrets if not already set
generate_secret() {
  openssl rand -hex 32
}

generate_app_key() {
  echo "base64:$(openssl rand -base64 32)"
}

# Read existing .env
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env first."
  exit 1
fi

# Generate Invoice Ninja APP_KEY if empty
if grep -q "^INVOICENINJA_APP_KEY=$" .env; then
  APP_KEY=$(generate_app_key)
  sed -i "s|^INVOICENINJA_APP_KEY=.*|INVOICENINJA_APP_KEY=${APP_KEY}|" .env
  echo "Generated Invoice Ninja APP_KEY"
fi

# Generate Twenty CRM secrets if empty
if grep -q "^TWENTY_ACCESS_TOKEN_SECRET=$" .env; then
  sed -i "s|^TWENTY_ACCESS_TOKEN_SECRET=.*|TWENTY_ACCESS_TOKEN_SECRET=$(generate_secret)|" .env
  echo "Generated Twenty ACCESS_TOKEN_SECRET"
fi

if grep -q "^TWENTY_LOGIN_TOKEN_SECRET=$" .env; then
  sed -i "s|^TWENTY_LOGIN_TOKEN_SECRET=.*|TWENTY_LOGIN_TOKEN_SECRET=$(generate_secret)|" .env
  echo "Generated Twenty LOGIN_TOKEN_SECRET"
fi

if grep -q "^TWENTY_REFRESH_TOKEN_SECRET=$" .env; then
  sed -i "s|^TWENTY_REFRESH_TOKEN_SECRET=.*|TWENTY_REFRESH_TOKEN_SECRET=$(generate_secret)|" .env
  echo "Generated Twenty REFRESH_TOKEN_SECRET"
fi

echo ""
echo "Starting all services..."
docker compose up -d

echo ""
echo "=== Maxed OpenCPA is starting up ==="
echo ""
echo "Services will be available at:"
echo "  Bigcapital:     http://localhost:3001"
echo "  Paperless-ngx:  http://localhost:8000  (admin / maxed2024)"
echo "  n8n:            http://localhost:5678   (admin / maxed2024)"
echo "  Metabase:       http://localhost:3002"
echo "  DocuSeal:       http://localhost:3003"
echo "  Invoice Ninja:  http://localhost:8080   (admin@maxed.dev / maxed2024)"
echo "  Twenty CRM:     http://localhost:3004"
echo "  Kimai:          http://localhost:8001   (admin@maxed.dev / maxed2024)"
echo "  Mattermost:     http://localhost:8065"
echo ""
echo "Note: Some services take 1-3 minutes to fully initialize."
echo "Check status with: docker compose ps"
echo "Check logs with:   docker compose logs -f <service-name>"
