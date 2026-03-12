# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Maxed OpenCPA — a self-hosted practice management platform for CPA firms. It bundles 9 open-source services (Bigcapital, Paperless-ngx, n8n, Metabase, DocuSeal, Invoice Ninja, Twenty CRM, Kimai, Mattermost) behind a unified Express/Prisma API, a Next.js admin dashboard, and a Next.js client portal. Optionally backed by Supabase for managed database, auth, and file storage.

## Architecture

**Four Node.js apps + Docker infrastructure:**

- **`platform/`** — Express REST API (port 4000). Single `server.js` file with Prisma ORM against PostgreSQL (`maxed_unified` database). This is the glue layer — it stores firm/client records and links them to external service IDs (e.g., `paperlessDocId`, `invoiceNinjaId`, `bigcapitalId`, `twentyCrmId`).
- **`dashboard/`** — Next.js 14 admin UI (port 3005). Uses NextAuth for authentication, Tailwind for styling. Embeds external services via iframes (Paperless, n8n, Metabase, DocuSeal). Calls the platform API for all data.
- **`client-portal/`** — Next.js 14 client-facing portal (port 3006). Clients view invoices, upload documents, send messages, sign proposals.
- **`opencpa/`** — Next.js 14 marketing site (port 3007). Tool directory and PDF cost-savings report generator (jsPDF).
- **`infra/`** — Docker Compose stack with all 9 services, PostgreSQL 16, MySQL 8.0 x3, Redis 7, and nginx reverse proxy.

**Data flow:** Dashboard/Portal → Platform API (port 4000) → Prisma → PostgreSQL. External services run independently in Docker; the platform API stores their foreign IDs on the Client model for cross-referencing.

## Common Commands

### Infrastructure (Docker)
```bash
cd infra && docker compose up -d      # Start all services
cd infra && docker compose ps          # Check container status
cd infra && docker compose logs <svc>  # Debug a specific service
cd infra && docker compose down        # Stop all (data persists in volumes)
```

### Platform API
```bash
cd platform
npm start                    # Start API server (port 4000)
npm run dev                  # Start with nodemon (auto-reload)
npx prisma migrate deploy   # Apply migrations
npx prisma migrate dev      # Create new migration during development
npx prisma db seed           # Seed sample data (1 firm, 5 clients)
npx prisma studio           # Visual database browser
```

### Dashboard
```bash
cd dashboard
npm run dev                  # Dev server (port 3005)
npm run build && npm start   # Production build
npm run lint                 # ESLint
```

### Client Portal
```bash
cd client-portal
npm run dev                  # Dev server (port 3006)
npm run build && npm start   # Production build
npm run lint
```

### OpenCPA Marketing Site
```bash
cd opencpa
npm run dev                  # Dev server (port 3007, note: no -p flag in dev script)
npm run build && npm start   # Production build (port 3007)
npm run lint
```

### First-Time Setup
```bash
chmod +x setup.sh && ./setup.sh   # Generates secrets, installs deps, starts Docker, runs migrations, seeds DB
```

## Key Technical Details

- **Database:** PostgreSQL 16 is the primary database for the platform API (`maxed_unified`). Bigcapital, Invoice Ninja, and Kimai each use their own MySQL 8.0 instance. Paperless, n8n, Metabase, Twenty, and Mattermost share the PostgreSQL instance in separate databases (created by `infra/init-databases.sql`).
- **Prisma schema** is at `platform/prisma/schema.prisma`. The Client model has nullable foreign key fields (`bigcapitalId`, `paperlessTag`, `invoiceNinjaId`, `twentyCrmId`) that store IDs from external services.
- **No test suite exists** currently. No test runner is configured.
- **No monorepo tooling** — each app has its own `node_modules` and is run independently.
- **Auth:** Dashboard uses NextAuth. Platform API has API key authentication middleware (via `MAXED_API_KEY` env var). Supabase auth is optional.
- **Security:** Platform API uses `helmet` for HTTP security headers, `express-rate-limit` (200 req/min), and configurable CORS origins.
- **Supabase:** Optional. When `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, the API enables file storage endpoints. Prisma `directUrl` supports Supabase connection pooling.
- **Environment files** are gitignored. Each app needs its own `.env` or `.env.local`. Service URLs in dashboard/client-portal `.env.local` must point to the correct server IP.
- **nginx config** at `infra/nginx/nginx.conf` routes subdomains to services. On Linux production, replace `host.docker.internal` with `127.0.0.1` and use `network_mode: host`.
- **n8n workflows** in `platform/n8n-workflows/` must be manually imported into n8n after setup.
