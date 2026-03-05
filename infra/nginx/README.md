# Maxed OpenCPA — Nginx Reverse Proxy

Routes all services behind `*.maxed.dev` subdomains.

## Subdomain Mapping

| Subdomain | Service | Backend Port |
|-----------|---------|-------------|
| app.maxed.dev | Dashboard | 3005 |
| portal.maxed.dev | Client Portal | 3006 |
| opencpa.maxed.dev | OpenCPA Site | 3007 |
| api.maxed.dev | Maxed API | 4000 |
| books.maxed.dev | Bigcapital | 3001 |
| docs.maxed.dev | Paperless-ngx | 8000 |
| flow.maxed.dev | n8n | 5678 |
| reports.maxed.dev | Metabase | 3002 |
| sign.maxed.dev | DocuSeal | 3003 |
| billing.maxed.dev | Invoice Ninja | 8080 |
| crm.maxed.dev | Twenty CRM | 3004 |
| chat.maxed.dev | Mattermost | 8065 |
| time.maxed.dev | Kimai | 8001 |

## Local Development Setup

1. Add host entries:
```bash
sudo bash setup-hosts.sh
```

2. Add the nginx service to docker-compose.yml (see docker-compose-nginx.yml snippet).

3. Start nginx:
```bash
docker compose up -d nginx
```

## Production Setup (Let's Encrypt SSL)

1. Point `*.maxed.dev` DNS to your VPS IP.

2. Install certbot and get wildcard cert:
```bash
sudo certbot certonly --manual --preferred-challenges dns -d "*.maxed.dev" -d "maxed.dev"
```

3. Uncomment SSL lines in nginx.conf.

4. Add HTTPS server blocks (port 443) and redirect HTTP to HTTPS.

## Docker Compose Service Block

Add this to your main `docker-compose.yml`:

```yaml
  nginx:
    image: nginx:alpine
    container_name: maxed-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      # Uncomment for production SSL:
      # - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - paperless
      - n8n
      - metabase
      - docuseal
      - invoiceninja
      - mattermost
    extra_hosts:
      - "host.docker.internal:host-gateway"
```
