#!/bin/bash
# Run this on the server to create nginx-ssl.conf (no SCP needed)
cd ~/MAXED-OSS/infra/nginx
cp nginx.conf nginx.conf.http-backup

# Part 1
cat > nginx-ssl.conf << 'PART1'
worker_processes auto;
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 100M;

    access_log /var/log/nginx/access.log;
    error_log  /var/log/nginx/error.log;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    ssl_certificate     /etc/letsencrypt/live/app.maxed.life/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.maxed.life/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

    server { listen 80; server_name app.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name app.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:3005; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; } }

    server { listen 80; server_name portal.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name portal.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:3006; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; } }

    server { listen 80; server_name opencpa.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name opencpa.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:3007; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } }

    server { listen 80; server_name api.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name api.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:4100; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } }

    server { listen 80; server_name books.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name books.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } }

    server { listen 80; server_name docs.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name docs.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } }
PART1

# Part 2
cat >> nginx-ssl.conf << 'PART2'

    server { listen 80; server_name flow.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name flow.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:5678; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; } }

    server { listen 80; server_name reports.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name reports.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:3002; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } }

    server { listen 80; server_name sign.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name sign.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:3003; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } }

    server { listen 80; server_name billing.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name billing.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } }

    server { listen 80; server_name crm.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name crm.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:3004; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } }

    server { listen 80; server_name chat.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name chat.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:8065; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; } }

    server { listen 80; server_name time.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; } }
    server { listen 443 ssl; server_name time.maxed.life; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { proxy_pass http://127.0.0.1:8001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } }
}
PART2

echo "nginx-ssl.conf created. Run: cd ~/MAXED-OSS/infra && ./enable-https.sh"
