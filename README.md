# Maxed OpenCPA

**The open-source practice management platform for CPA firms.**

Maxed replaces $20,000–$76,000/year in fragmented SaaS tools with a single self-hosted platform. It bundles 9 best-in-class open-source services behind a unified API, an admin dashboard, and a client portal — everything a CPA firm needs to run engagements, advisory, billing, and operations.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        NGINX REVERSE PROXY                      │
│   app. / portal. / api. / books. / docs. / flow. / reports.    │
│   sign. / billing. / crm. / chat. / time. / opencpa.           │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ├── Dashboard (Next.js)       → port 3005  → app.maxed.dev
       ├── Client Portal (Next.js)   → port 3006  → portal.maxed.dev
       ├── OpenCPA Marketing (Next.js)→ port 3007  → opencpa.maxed.dev
       ├── Maxed API (Express/Prisma)→ port 4000  → api.maxed.dev
       │
       │   ── Integrated Services (Docker) ──
       ├── Bigcapital (Bookkeeping)  → port 3001  → books.maxed.dev
       ├── Paperless-ngx (Documents) → port 8000  → docs.maxed.dev
       ├── n8n (Workflow Automation)  → port 5678  → flow.maxed.dev
       ├── Metabase (BI/Reporting)   → port 3002  → reports.maxed.dev
       ├── DocuSeal (E-Signatures)   → port 3003  → sign.maxed.dev
       ├── Invoice Ninja (Billing)   → port 8080  → billing.maxed.dev
       ├── Twenty CRM                → port 3004  → crm.maxed.dev
       ├── Mattermost (Team Chat)    → port 8065  → chat.maxed.dev
       └── Kimai (Time Tracking)     → port 8001  → time.maxed.dev

       ── Databases ──
       PostgreSQL 16 (shared: maxed_unified, paperless, n8n, metabase, twenty, mattermost)
       MySQL 8.0 × 3 (bigcapital, invoiceninja, kimai)
       Redis 7 (caching)
```

---

## What Each Piece Does

| Component | What It Does | Tech |
|-----------|-------------|------|
| **`platform/`** | Unified REST API. Manages firms, clients, documents, invoices, scenarios, messages. Links external service IDs (Paperless doc IDs, Invoice Ninja IDs, etc.) to a single client record. | Node.js, Express, Prisma, PostgreSQL |
| **`dashboard/`** | Admin UI for the CPA firm. Manage clients, view documents, send invoices, run advisory scenarios, see analytics. Embeds iframes for Paperless, n8n, Metabase, DocuSeal. | Next.js 14, Tailwind, NextAuth |
| **`client-portal/`** | Client-facing portal. Clients view invoices, upload documents, send messages, sign proposals. | Next.js 14, Tailwind |
| **`opencpa/`** | Marketing/landing page. Tool directory showing open-source alternatives to paid CPA software. PDF cost-savings report generator. Waitlist signup. | Next.js 14, Tailwind, jsPDF |
| **`infra/`** | Docker Compose stack for all 9 services + databases + nginx. | Docker, Nginx |
| **Bigcapital** | Double-entry bookkeeping. Chart of accounts, journal entries, financial statements. | Self-hosted |
| **Paperless-ngx** | OCR document management. Auto-scans, tags, and indexes uploaded tax returns, receipts, engagement letters. | Self-hosted |
| **n8n** | Workflow automation. Pre-built flows: new-client sync (creates client across all tools), document auto-tagging, daily financial sync from Bigcapital. | Self-hosted |
| **Metabase** | Business intelligence. Revenue dashboards, client analytics, invoice performance, advisory impact tracking. | Self-hosted |
| **DocuSeal** | E-signatures. Create and send proposals/engagement letters for client signatures. | Self-hosted |
| **Invoice Ninja** | Professional invoicing. Create invoices, accept payments, track receivables. | Self-hosted |
| **Twenty CRM** | Client relationship management. Track interactions, pipeline, contact info. | Self-hosted |
| **Kimai** | Time tracking. Staff logs billable hours per client/engagement. | Self-hosted |
| **Mattermost** | Team chat. Internal firm communication, channels per client/project. | Self-hosted |

---

## Prerequisites

- **Docker** and **Docker Compose** (v2+)
- **Node.js 18+** and **npm**
- **8 GB RAM minimum** (16 GB recommended — you're running 9 services + 4 databases)
- A Linux server or VM (Ubuntu 22.04+ recommended). Works on macOS for dev.

---

## Quick Start — Get It Running

### Step 1: Clone and enter the repo

```bash
git clone https://github.com/your-org/MAXED-OSS.git
cd MAXED-OSS
```

### Step 2: Generate secrets and start infrastructure

```bash
cd infra

# Generate the missing secrets in .env
# Invoice Ninja needs a base64 app key:
echo "INVOICENINJA_APP_KEY=base64:$(openssl rand -base64 32)" >> .env

# Twenty CRM needs three JWT secrets:
echo "TWENTY_ACCESS_TOKEN_SECRET=$(openssl rand -hex 32)" >> .env
echo "TWENTY_LOGIN_TOKEN_SECRET=$(openssl rand -hex 32)" >> .env
echo "TWENTY_REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)" >> .env

# Start all 9 services + databases
docker compose up -d
```

Wait 2-3 minutes for all services to initialize. Check status:

```bash
docker compose ps
```

All containers should show `Up` or `Up (healthy)`.

### Step 3: Set up the Platform API

```bash
cd ../platform
npm install

# Run database migrations (creates all tables)
npx prisma migrate deploy

# Seed sample data (1 firm, 5 clients, invoices, documents, scenarios)
npx prisma db seed

# Start the API server
npm start
```

The API is now running on `http://localhost:4000`. Verify: `curl http://localhost:4000/health`

### Step 4: Start the Dashboard

```bash
cd ../dashboard
npm install
npm run dev
```

Open `http://localhost:3005` in your browser.

**Login credentials:**
- Email: `admin@maxed.dev`
- Password: `maxed2024`

### Step 5: Start the Client Portal

```bash
cd ../client-portal
npm install
npm run dev
```

Open `http://localhost:3006`.

### Step 6: (Optional) Start the OpenCPA marketing site

```bash
cd ../opencpa
npm install
npm run dev
```

Open `http://localhost:3007`.

---

## Default Logins (All Services)

| Service | URL | Username | Password |
|---------|-----|----------|----------|
| **Dashboard** | http://localhost:3005 | `admin@maxed.dev` | `maxed2024` |
| **Paperless-ngx** | http://localhost:8000 | `admin` | `maxed2024` |
| **n8n** | http://localhost:5678 | `admin` | `maxed2024` |
| **Invoice Ninja** | http://localhost:8080 | `admin@maxed.dev` | `maxed2024` |
| **Kimai** | http://localhost:8001 | `admin@maxed.dev` | `maxed2024` |
| **Bigcapital** | http://localhost:3001 | *(create on first visit)* | |
| **Metabase** | http://localhost:3002 | *(create on first visit)* | |
| **DocuSeal** | http://localhost:3003 | *(create on first visit)* | |
| **Twenty CRM** | http://localhost:3004 | *(create on first visit)* | |
| **Mattermost** | http://localhost:8065 | *(create on first visit)* | |

---

## What You Need to Finish Before Giving This to a Firm

### Must-Do (Day Before)

- [ ] **Generate real secrets.** Replace every password in `infra/.env` and every `NEXTAUTH_SECRET` in `dashboard/.env.local`. The shipped defaults are dev-only.

- [ ] **Set the Invoice Ninja APP_KEY.** If you haven't already:
  ```bash
  echo "INVOICENINJA_APP_KEY=base64:$(openssl rand -base64 32)" >> infra/.env
  ```

- [ ] **Set the Twenty CRM secrets.** If blank in `.env`:
  ```bash
  echo "TWENTY_ACCESS_TOKEN_SECRET=$(openssl rand -hex 32)" >> infra/.env
  echo "TWENTY_LOGIN_TOKEN_SECRET=$(openssl rand -hex 32)" >> infra/.env
  echo "TWENTY_REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)" >> infra/.env
  ```

- [ ] **Run `docker compose up -d` and verify all containers are healthy.** Some services (Bigcapital, Twenty) can take 60-90 seconds on first start.

- [ ] **Run Prisma migrations and seed.**
  ```bash
  cd platform && npx prisma migrate deploy && npx prisma db seed
  ```

- [ ] **Set up the firm's data.** Either:
  - Edit `platform/prisma/seed.js` with the real firm name, clients, etc. and re-seed, OR
  - Use the Dashboard UI to create the firm and add clients manually.

- [ ] **Import n8n workflows.** Go to `http://localhost:5678`, import the three JSON files from `platform/n8n-workflows/`:
  1. `new-client-sync.json` — auto-creates clients in Invoice Ninja + Paperless when added via API
  2. `document-auto-tag.json` — auto-tags documents after OCR
  3. `daily-financial-sync.json` — syncs financial data from Bigcapital nightly

  After importing, update the credential/environment variables inside n8n for each workflow.

- [ ] **Configure Metabase.** On first visit to `http://localhost:3002`:
  1. Create an admin account
  2. Connect it to the PostgreSQL database (`host: postgres`, `port: 5432`, `db: maxed_unified`, `user: maxed`, `pass: maxed_dev_2024`)
  3. Build the four dashboards referenced in the Dashboard (Revenue, Clients, Invoices, Advisory) or use Metabase's auto-dashboard feature

- [ ] **Configure Bigcapital.** Visit `http://localhost:3001`, create an organization, set up chart of accounts. This becomes the firm's bookkeeping system.

- [ ] **Configure DocuSeal.** Visit `http://localhost:3003`, create templates for engagement letters and proposals.

- [ ] **Configure Mattermost.** Visit `http://localhost:8065`, create the workspace, invite team members, create channels.

### Production Deployment Checklist

- [ ] **DNS.** Point `*.maxed.dev` (or your domain) to your server IP. Each subdomain maps to a service — see the nginx config.

- [ ] **SSL/TLS.** Uncomment the SSL block in `infra/nginx/nginx.conf` and set up Let's Encrypt:
  ```bash
  certbot certonly --standalone -d app.maxed.dev -d portal.maxed.dev -d api.maxed.dev \
    -d books.maxed.dev -d docs.maxed.dev -d flow.maxed.dev -d reports.maxed.dev \
    -d sign.maxed.dev -d billing.maxed.dev -d crm.maxed.dev -d chat.maxed.dev \
    -d time.maxed.dev -d opencpa.maxed.dev
  ```

- [ ] **Update all `.env.local` URLs.** Replace `localhost` with your actual domain in:
  - `dashboard/.env.local`
  - `client-portal/.env.local`
  - `platform/.env`

- [ ] **Update nginx `proxy_pass` entries.** For production, services talk to each other inside Docker — the config already handles this for most services, but `host.docker.internal` entries (dashboard, portal, API) need to be updated if those apps run inside Docker too.

- [ ] **Build Next.js apps for production.**
  ```bash
  cd dashboard && npm run build && npm start
  cd client-portal && npm run build && npm start
  cd opencpa && npm run build && npm start
  ```

- [ ] **Set up backups.** At minimum, back up:
  - PostgreSQL: `pg_dump` all 6 databases
  - MySQL: `mysqldump` for bigcapital, invoiceninja, kimai
  - Docker volumes: paperless media, docuseal data, mattermost data

- [ ] **Firewall.** Only expose ports 80/443 (nginx). All other ports should be internal only.

---

## API Endpoints Reference

Base URL: `http://localhost:4000`

```
GET    /health                           Health check

POST   /api/firms                        Create firm
GET    /api/firms                        List firms
GET    /api/firms/:id                    Get firm (with clients + team)
GET    /api/firms/:firmId/stats          Firm dashboard stats

POST   /api/firms/:firmId/clients        Add client
GET    /api/firms/:firmId/clients        List clients

POST   /api/clients/:clientId/scenarios  Create what-if scenario
GET    /api/clients/:clientId/scenarios  List scenarios

POST   /api/clients/:clientId/documents  Add document record
GET    /api/clients/:clientId/documents  List documents

POST   /api/clients/:clientId/invoices   Create invoice
GET    /api/clients/:clientId/invoices   List invoices

POST   /api/clients/:clientId/messages   Send message
GET    /api/clients/:clientId/messages   List messages
```

---

## Pre-Built n8n Workflows

Located in `platform/n8n-workflows/`. Import these into n8n after setup.

| Workflow | Trigger | What It Does |
|----------|---------|-------------|
| `new-client-sync.json` | Webhook (on client creation) | Creates the client in Invoice Ninja + creates a Paperless tag + updates Maxed API with external IDs |
| `document-auto-tag.json` | Webhook (on document upload) | Reads OCR text, classifies document type (tax form, invoice, engagement letter), updates Maxed API |
| `daily-financial-sync.json` | Cron (2:00 AM daily) | Pulls financial summaries from Bigcapital for all linked clients, updates records |

---

## Project Structure

```
MAXED-OSS/
├── infra/                          # Infrastructure
│   ├── docker-compose.yml          # All 9 services + databases
│   ├── .env                        # Service credentials
│   ├── init-databases.sql          # Creates PostgreSQL databases
│   └── nginx/
│       └── nginx.conf              # Subdomain routing
│
├── platform/                       # Core API
│   ├── server.js                   # Express routes
│   ├── prisma/
│   │   ├── schema.prisma           # Data models (Firm, Client, Document, Invoice, etc.)
│   │   ├── seed.js                 # Sample data
│   │   └── migrations/             # Database migrations
│   ├── n8n-workflows/              # Pre-built automation flows
│   └── package.json
│
├── dashboard/                      # Admin Dashboard (port 3005)
│   ├── app/
│   │   ├── dashboard/              # All dashboard pages
│   │   │   ├── page.tsx            # Home — stats, quick actions, activity feed
│   │   │   ├── clients/            # Client list + detail views
│   │   │   ├── documents/          # Paperless-ngx embed
│   │   │   ├── invoicing/          # Invoice list + Invoice Ninja link
│   │   │   ├── proposals/          # DocuSeal embed
│   │   │   ├── reporting/          # Metabase embed
│   │   │   ├── advisory/           # Scenario planning
│   │   │   ├── workflows/          # n8n embed
│   │   │   └── settings/           # Firm settings, team, integrations
│   │   └── login/                  # Auth page
│   ├── components/                 # Sidebar, TopBar, DashboardLayout
│   ├── lib/                        # API helpers, auth config
│   └── .env.local                  # Service URLs
│
├── client-portal/                  # Client Portal (port 3006)
│   ├── app/
│   │   └── portal/                 # All portal pages
│   │       ├── page.tsx            # Home — summary cards, quick actions
│   │       ├── invoices/           # View/pay invoices
│   │       ├── documents/          # Upload/view documents
│   │       ├── messages/           # Message the firm
│   │       ├── proposals/          # View/sign proposals
│   │       └── ask/                # Submit questions
│   └── .env.local
│
├── opencpa/                        # Marketing Site (port 3007)
│   ├── app/
│   │   ├── page.tsx                # Landing page
│   │   ├── directory/              # Tool comparison directory
│   │   └── report/                 # PDF cost-savings report generator
│   └── .env.local
│
└── README.md                       # You are here
```

---

## Hardware Recommendations

| Deployment | RAM | CPU | Storage |
|-----------|-----|-----|---------|
| Dev/Demo | 8 GB | 2 cores | 20 GB |
| Small firm (1-5 staff) | 16 GB | 4 cores | 100 GB SSD |
| Mid firm (5-20 staff) | 32 GB | 8 cores | 250 GB SSD |

The biggest RAM consumers are PostgreSQL, Metabase, and Mattermost. For a demo or small firm, 16 GB is comfortable.

---

## Troubleshooting

**Container won't start:** Check logs with `docker compose logs <service-name>`. Most issues are database connection timing — restart the specific service: `docker compose restart <service-name>`.

**Prisma migration fails:** Make sure PostgreSQL is running and the `DATABASE_URL` in `platform/.env` is correct. The database must exist first (created by `init-databases.sql`).

**Dashboard shows "Failed to fetch" errors:** The Platform API isn't running or the URL in `dashboard/.env.local` is wrong. Check that `http://localhost:4000/health` returns OK.

**Invoice Ninja 500 errors:** The `APP_KEY` is likely missing. Generate it and restart: `docker compose restart invoiceninja`.

**Twenty CRM won't load:** Token secrets may be blank. Generate them, then `docker compose restart twenty`.

---

## License

Open source. Individual bundled tools retain their own licenses (Paperless-ngx: GPL-3.0, n8n: Sustainable Use License, Invoice Ninja: AAL, Metabase: AGPL-3.0, etc.). Check each project for details.
