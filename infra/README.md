# Maxed OpenCPA Infrastructure

Docker Compose setup running 9 open-source tools for CPA firm practice management.

## Quick Start

```bash
chmod +x start.sh
./start.sh
```

## Services

| Service | URL | Login |
|---------|-----|-------|
| Bigcapital (Bookkeeping) | http://localhost:3001 | Create account on first visit |
| Paperless-ngx (Documents) | http://localhost:8000 | admin / maxed2024 |
| n8n (Workflows) | http://localhost:5678 | admin / maxed2024 |
| Metabase (Reporting) | http://localhost:3002 | Create account on first visit |
| DocuSeal (E-Signatures) | http://localhost:3003 | Create account on first visit |
| Invoice Ninja (Invoicing) | http://localhost:8080 | admin@maxed.dev / maxed2024 |
| Twenty CRM | http://localhost:3004 | Create account on first visit |
| Kimai (Time Tracking) | http://localhost:8001 | admin@maxed.dev / maxed2024 |
| Mattermost (Team Chat) | http://localhost:8065 | Create account on first visit |

## Shared Database

PostgreSQL 16 on port 5432. User: `maxed`, Password: `maxed_dev_2024`.

Databases: `paperless`, `n8n`, `metabase`, `twenty`, `mattermost`, `maxed_unified`

## Commands

```bash
docker compose ps          # Check service status
docker compose logs -f     # Follow all logs
docker compose down        # Stop all services
docker compose down -v     # Stop and remove all data
```

## Resource Requirements

- Memory: 10GB minimum recommended
- Disk: 20GB+ for Docker images and data
