#!/bin/bash
# Troubleshoot app.maxed.life connection issues
# Run on server: bash troubleshoot-app.sh

echo "=== 1. Port 80/443 listening? ==="
ss -tlnp | grep -E ':80 |:443 ' || netstat -tlnp 2>/dev/null | grep -E ':80 |:443 ' || echo "Nothing on 80/443"

echo ""
echo "=== 2. Docker containers (nginx, dashboard deps) ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | head -20

echo ""
echo "=== 3. Dashboard (port 3005) responding locally? ==="
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3005 2>/dev/null && echo " - OK" || echo " - FAIL (dashboard not running?)"

echo ""
echo "=== 4. Nginx (port 80) responding locally? ==="
curl -s -o /dev/null -w "%{http_code}" -H "Host: app.maxed.life" http://127.0.0.1:80 2>/dev/null && echo " - OK" || echo " - FAIL (nginx not proxying?)"

echo ""
echo "=== 5. PM2 status (Node apps) ==="
pm2 list 2>/dev/null || echo "PM2 not running"

echo ""
echo "=== 6. Firewall (UFW) ==="
ufw status 2>/dev/null || echo "UFW not installed"

echo ""
echo "=== 7. Nginx container logs (last 10 lines) ==="
docker logs maxed-nginx 2>&1 | tail -10
