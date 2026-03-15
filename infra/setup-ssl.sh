#!/bin/bash
# SSL setup for Maxed production (Let's Encrypt)
# Run on the server: ./setup-ssl.sh
# Prerequisites: DNS for *.maxed.life pointing to this server

set -e

DOMAINS="app.maxed.life portal.maxed.life opencpa.maxed.life api.maxed.life books.maxed.life docs.maxed.life flow.maxed.life reports.maxed.life sign.maxed.life billing.maxed.life crm.maxed.life chat.maxed.life time.maxed.life"
CERTBOT_WEBROOT="/var/www/certbot"
NGINX_CONF="$(dirname "$0")/nginx/nginx.conf"

echo "=== Maxed SSL Setup (Let's Encrypt) ==="

# 1. Create certbot webroot
echo "Creating $CERTBOT_WEBROOT..."
sudo mkdir -p "$CERTBOT_WEBROOT"
sudo chmod 755 "$CERTBOT_WEBROOT"

# 2. Ensure nginx is running with certbot volumes (docker compose up -d)
echo "Ensuring nginx is running..."
cd "$(dirname "$0")"
docker compose up -d nginx 2>/dev/null || true

# 3. Install certbot if missing
if ! command -v certbot &>/dev/null; then
    echo "Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot
fi

# 4. Get certificate (webroot challenge)
echo "Requesting certificate for all domains..."
sudo certbot certonly --webroot \
    -w "$CERTBOT_WEBROOT" \
    -d app.maxed.life \
    -d portal.maxed.life \
    -d opencpa.maxed.life \
    -d api.maxed.life \
    -d books.maxed.life \
    -d docs.maxed.life \
    -d flow.maxed.life \
    -d reports.maxed.life \
    -d sign.maxed.life \
    -d billing.maxed.life \
    -d crm.maxed.life \
    -d chat.maxed.life \
    -d time.maxed.life \
    --email admin@maxed.life \
    --agree-tos \
    --non-interactive \
    --expand

# 5. Apply full SSL nginx config
NGINX_SSL="$(dirname "$0")/nginx/nginx-ssl.conf"
if [ -f "$NGINX_SSL" ]; then
    echo "Applying SSL nginx config..."
    cp "$NGINX_SSL" "$NGINX_CONF"
else
    echo "ERROR: nginx-ssl.conf not found at $NGINX_SSL"
    exit 1
fi

# 6. Reload nginx
echo "Reloading nginx..."
docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload

echo ""
echo "=== SSL setup complete ==="
echo "Sites are now available at https://app.maxed.life etc."
echo ""
echo "Auto-renewal: certbot renew runs via systemd/cron. Test with:"
echo "  sudo certbot renew --dry-run"
