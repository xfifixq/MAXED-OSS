#!/bin/bash
# Enable HTTPS - run on server after HTTP is working
set -e
cd ~/MAXED-OSS/infra

echo "=== Step 1: Check certificates ==="
if [ ! -f /etc/letsencrypt/live/app.maxed.life/fullchain.pem ]; then
    echo "No certs found. Running certbot standalone..."
    docker compose stop nginx
    certbot certonly --standalone \
        -d app.maxed.life -d portal.maxed.life -d opencpa.maxed.life -d api.maxed.life \
        -d books.maxed.life -d docs.maxed.life -d flow.maxed.life -d reports.maxed.life \
        -d sign.maxed.life -d billing.maxed.life -d crm.maxed.life -d chat.maxed.life -d time.maxed.life \
        --email admin@maxed.life --agree-tos --non-interactive
    docker compose start nginx
else
    echo "Certs OK"
fi

echo "=== Step 2: Ensure /etc/letsencrypt is mounted in docker-compose ==="
if ! grep -q "letsencrypt" docker-compose.yml; then
    sed -i 's|- ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro|- ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro\n      - /etc/letsencrypt:/etc/letsencrypt:ro|' docker-compose.yml
fi

echo "=== Step 3: Apply SSL config ==="
if [ -f nginx/nginx-ssl.conf ]; then
    cp nginx/nginx-ssl.conf nginx/nginx.conf
else
    echo "ERROR: nginx/nginx-ssl.conf not found."
    echo "Copy it to the server: scp infra/nginx/nginx-ssl.conf root@SERVER:~/MAXED-OSS/infra/nginx/"
    exit 1
fi

echo "=== Step 4: Restart all Docker services ==="
docker compose up -d --force-recreate

echo "=== Step 5: Run platform database migration ==="
cd ~/MAXED-OSS/platform
npx prisma migrate deploy 2>/dev/null || echo "Migration skipped (may already be applied)"

echo "=== Step 6: Rebuild dashboard with HTTPS env vars ==="
cd ~/MAXED-OSS/dashboard
npm run build 2>/dev/null || echo "Dashboard build skipped"

echo "=== Step 7: Restart PM2 services ==="
pm2 restart all 2>/dev/null || echo "PM2 restart skipped (may not be using PM2)"

echo "=== Step 8: Verify ==="
sleep 5
cd ~/MAXED-OSS/infra
docker compose exec nginx nginx -t
echo ""
echo "Checking service health..."
for svc in app portal api books docs flow reports sign billing crm chat time; do
    STATUS=$(curl -so /dev/null -w "%{http_code}" "https://${svc}.maxed.life/" --max-time 5 2>/dev/null || echo "000")
    echo "  https://${svc}.maxed.life/ → HTTP $STATUS"
done
echo ""
echo "=== HTTPS setup complete ==="
echo "Dashboard: https://app.maxed.life"
echo "Portal:    https://portal.maxed.life"
echo "API:       https://api.maxed.life"
