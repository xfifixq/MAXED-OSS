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

echo "=== Step 4: Restart nginx ==="
docker compose up -d nginx --force-recreate

echo "=== Step 5: Verify ==="
sleep 2
docker compose exec nginx nginx -t
curl -sI https://app.maxed.life | head -3
echo ""
echo "HTTPS should be live at https://app.maxed.life"
