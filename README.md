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
| [**Bigcapital**](https://github.com/bigcapitalhq/bigcapital) | Double-entry bookkeeping. Chart of accounts, journal entries, financial statements. | Self-hosted |
| [**Paperless-ngx**](https://github.com/paperless-ngx/paperless-ngx) | OCR document management. Auto-scans, tags, and indexes uploaded tax returns, receipts, engagement letters. | Self-hosted |
| [**n8n**](https://github.com/n8n-io/n8n) | Workflow automation. Pre-built flows: new-client sync (creates client across all tools), document auto-tagging, daily financial sync from Bigcapital. | Self-hosted |
| [**Metabase**](https://github.com/metabase/metabase) | Business intelligence. Revenue dashboards, client analytics, invoice performance, advisory impact tracking. | Self-hosted |
| [**DocuSeal**](https://github.com/docusealco/docuseal) | E-signatures. Create and send proposals/engagement letters for client signatures. | Self-hosted |
| [**Invoice Ninja**](https://github.com/invoiceninja/invoiceninja) | Professional invoicing. Create invoices, accept payments, track receivables. | Self-hosted |
| [**Twenty CRM**](https://github.com/twentyhq/twenty) | Client relationship management. Track interactions, pipeline, contact info. | Self-hosted |
| [**Kimai**](https://github.com/kimai/kimai) | Time tracking. Staff logs billable hours per client/engagement. | Self-hosted |
| [**Mattermost**](https://github.com/mattermost/mattermost) | Team chat. Internal firm communication, channels per client/project. | Self-hosted |

---

## Bundled Open-Source Projects

Every tool below is free and self-hosted. No subscriptions, no per-seat fees, no API keys to buy.

| Tool | GitHub | License | Replaces |
|------|--------|---------|----------|
| Bigcapital | [bigcapitalhq/bigcapital](https://github.com/bigcapitalhq/bigcapital) | AGPL-3.0 | QuickBooks, Xero |
| Paperless-ngx | [paperless-ngx/paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) | GPL-3.0 | SmartVault, ShareFile |
| n8n | [n8n-io/n8n](https://github.com/n8n-io/n8n) | Sustainable Use | Zapier, Make |
| Metabase | [metabase/metabase](https://github.com/metabase/metabase) | AGPL-3.0 | Tableau, Power BI |
| DocuSeal | [docusealco/docuseal](https://github.com/docusealco/docuseal) | AGPL-3.0 | DocuSign, PandaDoc |
| Invoice Ninja | [invoiceninja/invoiceninja](https://github.com/invoiceninja/invoiceninja) | AAL | FreshBooks, Bill.com |
| Twenty CRM | [twentyhq/twenty](https://github.com/twentyhq/twenty) | AGPL-3.0 | Salesforce, HubSpot |
| Kimai | [kimai/kimai](https://github.com/kimai/kimai) | AGPL-3.0 | Harvest, Toggl |
| Mattermost | [mattermost/mattermost](https://github.com/mattermost/mattermost) | MIT + Enterprise | Slack, Teams |

---

## Deployment Options

Maxed can be deployed two ways. Choose the one that fits your situation:

| Option | Best For | Requirements |
|--------|----------|-------------|
| **DigitalOcean Droplet** (recommended) | Production, demos, onboarding clients | DigitalOcean account, ~$48/mo for 8GB droplet |
| **Local (Docker Desktop)** | Development only | 16 GB RAM, Docker Desktop, Windows/macOS |

> **Why DigitalOcean?** Running 9 services + 4 databases needs ~8-16 GB RAM. Most dev laptops struggle with this. A $48/mo DigitalOcean droplet (8 GB) handles it easily, runs 24/7, and is accessible from anywhere.

---

## Quick Start — DigitalOcean Deployment (Recommended)

### Step 1: Create a Droplet

1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com) and create a new Droplet:
   - **Image:** Ubuntu 24.04 LTS
   - **Size:** 8 GB RAM / 4 vCPUs / 160 GB SSD ($48/mo) — or 16 GB for comfortable headroom
   - **Region:** Pick the closest to your firm
   - **Authentication:** SSH key (recommended) or password

2. Note your Droplet's IP address (e.g., `164.90.xxx.xxx`).

### Step 2: SSH in and install Docker

```bash
ssh root@YOUR_DROPLET_IP

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify
docker --version
node --version
```

### Step 3: Clone and run setup

```bash
git clone https://github.com/your-org/MAXED-OSS.git
cd MAXED-OSS
chmod +x setup.sh
./setup.sh
```

This will:
1. Generate strong random passwords for all databases and services
2. Generate Invoice Ninja APP_KEY, Twenty CRM JWT secrets, NextAuth secrets
3. Install npm dependencies for platform, dashboard, client portal, and opencpa
4. Start all Docker containers
5. Run Prisma migrations and seed sample data (1 firm, 5 clients)

Wait 2-3 minutes for all services to initialize. Check status:

```bash
cd infra && docker compose ps
```

All containers should show `Up` or `Up (healthy)`.

### Step 4: Update URLs for your Droplet IP

Replace `157.245.116.168` with your Droplet IP in all config files:

```bash

cd ~/MAXED-OSS

# Set your Droplet IP
export DROPLET_IP="YOUR_DROPLET_IP"

# Update platform API
sed -i "s|157.245.116.168:5432|157.245.116.168:5432|" platform/.env

# Update dashboard env
sed -i "s|http://157.245.116.168:4000|http://$DROPLET_IP:4000|g" dashboard/.env.local
sed -i "s|http://157.245.116.168:8000|http://$DROPLET_IP:8000|g" dashboard/.env.local
sed -i "s|http://157.245.116.168:8080|http://$DROPLET_IP:8080|g" dashboard/.env.local
sed -i "s|http://157.245.116.168:3003|http://$DROPLET_IP:3003|g" dashboard/.env.local
sed -i "s|http://157.245.116.168:3002|http://$DROPLET_IP:3002|g" dashboard/.env.local
sed -i "s|http://157.245.116.168:5678|http://$DROPLET_IP:5678|g" dashboard/.env.local
sed -i "s|http://157.245.116.168:8065|http://$DROPLET_IP:8065|g" dashboard/.env.local
sed -i "s|http://157.245.116.168:8001|http://$DROPLET_IP:8001|g" dashboard/.env.local
sed -i "s|http://157.245.116.168:3004|http://$DROPLET_IP:3004|g" dashboard/.env.local
sed -i "s|http://157.245.116.168:3005|http://$DROPLET_IP:3005|g" dashboard/.env.local

# Update client portal env
sed -i "s|http://157.245.116.168:4000|http://$DROPLET_IP:4000|g" client-portal/.env.local
sed -i "s|http://157.245.116.168:8000|http://$DROPLET_IP:8000|g" client-portal/.env.local
sed -i "s|http://157.245.116.168:8080|http://$DROPLET_IP:8080|g" client-portal/.env.local
sed -i "s|http://157.245.116.168:3003|http://$DROPLET_IP:3003|g" client-portal/.env.local

# Update docker services that reference 157.245.116.168
sed -i "s|http://157.245.116.168:8000|http://$DROPLET_IP:8000|g" infra/docker-compose.yml
sed -i "s|http://157.245.116.168:5678|http://$DROPLET_IP:5678|g" infra/docker-compose.yml
sed -i "s|http://157.245.116.168:8080|http://$DROPLET_IP:8080|g" infra/docker-compose.yml
sed -i "s|http://157.245.116.168:3004|http://$DROPLET_IP:3004|g" infra/docker-compose.yml
sed -i "s|http://157.245.116.168:8065|http://$DROPLET_IP:8065|g" infra/docker-compose.yml

# Restart Docker services with updated URLs
cd infra && docker compose down && docker compose up -d
```

### Step 5: Open firewall ports

```bash
ufw allow 22/tcp     # SSH
ufw allow 3000:9000/tcp  # All service ports
ufw enable
```

> For production, use nginx reverse proxy (already included in `infra/nginx/`) and only expose 80/443.

### Step 6: Start the Platform API + Apps

```bash
cd ~/MAXED-OSS

# Start the API (background)
cd platform && npm start &

# Start the dashboard (background)
cd ../dashboard && npm run dev &

# Start the client portal (background)
cd ../client-portal && npm run dev &
```

> **Tip:** For production, use `pm2` to keep these running:
> ```bash
> npm install -g pm2
> cd ~/MAXED-OSS/platform && pm2 start server.js --name maxed-api
> cd ~/MAXED-OSS/dashboard && pm2 start npm --name maxed-dashboard -- run dev
> cd ~/MAXED-OSS/client-portal && pm2 start npm --name maxed-portal -- run dev
> ```

### Step 7: Access everything

Open these URLs in your browser (replace `YOUR_DROPLET_IP`):

| Service | URL |
|---------|-----|
| **Dashboard** | `http://YOUR_DROPLET_IP:3005` |
| **Client Portal** | `http://YOUR_DROPLET_IP:3006` |
| **Platform API** | `http://YOUR_DROPLET_IP:4000/health` |
| **Bigcapital** | `http://YOUR_DROPLET_IP:3001` |
| **Paperless-ngx** | `http://YOUR_DROPLET_IP:8000` |
| **n8n** | `http://YOUR_DROPLET_IP:5678` |
| **Metabase** | `http://YOUR_DROPLET_IP:3002` |
| **DocuSeal** | `http://YOUR_DROPLET_IP:3003` |
| **Invoice Ninja** | `http://YOUR_DROPLET_IP:8080` |
| **Twenty CRM** | `http://YOUR_DROPLET_IP:3004` |
| **Kimai** | `http://YOUR_DROPLET_IP:8001` |
| **Mattermost** | `http://YOUR_DROPLET_IP:8065` |

---

## Quick Start — Local Development (Docker Desktop)

> **Warning:** Running all 9 services locally requires 16 GB RAM minimum. If your machine has 8 GB or less, use the DigitalOcean deployment above.

### Step 1: Clone and enter the repo

```bash
git clone https://github.com/your-org/MAXED-OSS.git
cd MAXED-OSS
```

### Step 2: Run the setup script

```bash
./setup.sh
```

Wait 2-3 minutes for all services to initialize. Check status:

```bash
cd infra && docker compose ps
```

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

The API is now running on `http://157.245.116.168:4000`. Verify: `curl http://157.245.116.168:4000/health`

### Step 4: Start the Dashboard

```bash
cd ../dashboard
npm install
npm run dev
```

Open `http://157.245.116.168:3005` in your browser.

### Step 5: Start the Client Portal

```bash
cd ../client-portal
npm install
npm run dev
```

Open `http://157.245.116.168:3006`.

### Step 6: (Optional) Start the OpenCPA marketing site

```bash
cd ../opencpa
npm install
npm run dev
```

Open `http://157.245.116.168:3007`.

---

## Default Logins (All Services)

| Service | URL | Username | Password |
|---------|-----|----------|----------|
| **Dashboard** | :3005 | `admin@maxed.dev` or `admin@maxed.life` | `maxed2024` |
| **Paperless-ngx** | :8000 | `admin` | `maxed2024` |
| **n8n** | :5678 | `admin` | `maxed2024` |
| **Invoice Ninja** | :8080 | `admin@maxed.dev` | `maxed2024` |
| **Kimai** | :8001 | `admin@maxed.dev` | `maxed2024` |
| **Bigcapital** | :3001 | *(create on first visit)* | |
| **Metabase** | :3002 | *(create on first visit)* | |
| **DocuSeal** | :3003 | *(create on first visit)* | |
| **Twenty CRM** | :3004 | *(create on first visit)* | |
| **Mattermost** | :8065 | *(create on first visit)* | |

> **Note:** If you ran `./setup.sh`, passwords were regenerated. Check the terminal output for the new shared admin password, or look in `infra/.env`.

---

## What You Need to Finish Before Giving This to a Firm

### Must-Do (Day Before)

- [ ] **Run `./setup.sh`** — generates all secrets, installs deps, starts Docker, runs migrations, seeds data. If you already ran it during development, run `./setup.sh --secrets-only` to just regenerate production-strength passwords.

- [ ] **Verify all containers are healthy:** `cd infra && docker compose ps`. Some services (Bigcapital, Twenty) can take 60-90 seconds on first start.

- [ ] **Set up the firm's data.** Either:
  - Edit `platform/prisma/seed.js` with the real firm name, clients, etc. and re-seed, OR
  - Use the Dashboard UI to create the firm and add clients manually.

- [ ] **Import n8n workflows.** Go to n8n (:5678), import the three JSON files from `platform/n8n-workflows/`:
  1. `new-client-sync.json` — auto-creates clients in Invoice Ninja + Paperless when added via API
  2. `document-auto-tag.json` — auto-tags documents after OCR
  3. `daily-financial-sync.json` — syncs financial data from Bigcapital nightly

  After importing, update the credential/environment variables inside n8n for each workflow.

- [ ] **Configure Metabase.** On first visit to :3002:
  1. Create an admin account
  2. Connect it to the PostgreSQL database (`host: postgres`, `port: 5432`, `db: maxed_unified`, `user: maxed`, `pass: <from infra/.env>`)
  3. Build the four dashboards referenced in the Dashboard (Revenue, Clients, Invoices, Advisory) or use Metabase's auto-dashboard feature

- [ ] **Configure Bigcapital.** Visit :3001, create an organization, set up chart of accounts. This becomes the firm's bookkeeping system.

- [ ] **Configure DocuSeal.** Visit :3003, create templates for engagement letters and proposals.

- [ ] **Configure Mattermost.** Visit :8065, create the workspace, invite team members, create channels.

### Production Deployment Guide (Step-by-Step)

This section documents the full production deployment process for `*.maxed.life` (or your domain) on a DigitalOcean droplet. Follow these steps in order.

#### 1. Server Setup

```bash
ssh root@YOUR_SERVER_IP

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify
docker --version && node --version
```

#### 2. Clone and Configure Environment

```bash
git clone https://github.com/your-org/MAXED-OSS.git
cd MAXED-OSS
```

**Create env files** (they are gitignored — copy from `.env.example` or create manually):

- **`infra/.env`** — Regenerate all passwords with `openssl rand -base64 24`. Required: `POSTGRES_PASSWORD`, `BIGCAPITAL_MYSQL_*`, `INVOICENINJA_MYSQL_*`, `KIMAI_MYSQL_*`, `PAPERLESS_ADMIN_PASSWORD`, `N8N_BASIC_AUTH_PASSWORD`, `KIMAI_ADMIN_PASSWORD`, `KIMAI_ADMIN_EMAIL=admin@maxed.life`. Generate `INVOICENINJA_APP_KEY=base64:$(openssl rand -base64 32)` and Twenty secrets with `openssl rand -hex 32`. Update `MM_SQLSETTINGS_DATASOURCE` to use the new Postgres password (URL-encode special chars: `/` → `%2F`, `+` → `%2B`).

- **`dashboard/.env.local`** — Set `NEXT_PUBLIC_*` URLs to `https://*.maxed.life`, `NEXTAUTH_SECRET` (from `openssl rand -base64 32`), `NEXTAUTH_URL=https://app.maxed.life`.

- **`client-portal/.env.local`** — Same `NEXT_PUBLIC_*` URLs.

- **`platform/.env`** — Keep `DATABASE_URL` pointing to `localhost:5432` (API runs on same host as Postgres).

#### 3. Start Docker Infrastructure

```bash
cd ~/MAXED-OSS/infra
chmod +x start.sh
./start.sh   # Generates missing secrets, starts all containers
```

Wait 2–3 minutes. Verify: `docker compose ps` — all should show `Up`.

#### 4. Fix nginx for Production (Linux)

The default nginx config uses `host.docker.internal`, which fails on Linux. Apply these fixes:

**docker-compose.yml** — Add `network_mode: host` to the nginx service (remove `ports:` if present).

**nginx/nginx.conf** — Replace all `host.docker.internal` and Docker service names with `127.0.0.1` and the correct host ports:

```bash
cd ~/MAXED-OSS/infra
sed -i 's/host\.docker\.internal/127.0.0.1/g' nginx/nginx.conf
sed -i 's/bigcapital-webapp:3001/127.0.0.1:3001/g' nginx/nginx.conf
sed -i 's/paperless:8000/127.0.0.1:8000/g' nginx/nginx.conf
sed -i 's/n8n:5678/127.0.0.1:5678/g' nginx/nginx.conf
sed -i 's/metabase:3000/127.0.0.1:3002/g' nginx/nginx.conf
sed -i 's/docuseal:3000/127.0.0.1:3003/g' nginx/nginx.conf
sed -i 's/invoiceninja:80/127.0.0.1:8080/g' nginx/nginx.conf
sed -i 's/twenty:3000/127.0.0.1:3004/g' nginx/nginx.conf
sed -i 's/mattermost:8065/127.0.0.1:8065/g' nginx/nginx.conf
sed -i 's/kimai:8001/127.0.0.1:8001/g' nginx/nginx.conf
```

#### 5. Build and Run Node Apps

```bash
cd ~/MAXED-OSS

# Platform API
cd platform && npm install && npm start &

# Dashboard (remove output: 'standalone' from next.config.js if present)
cd ../dashboard && npm install && npm run build

# Client portal
cd ../client-portal && npm install && npm run build

# OpenCPA (add -p 3007 to start script if needed)
cd ../opencpa && npm install && npm run build
```

#### 6. Start with PM2

```bash
npm install -g pm2

cd ~/MAXED-OSS/platform
pm2 start npm --name maxed-api -- start

cd ~/MAXED-OSS/dashboard
pm2 start npm --name maxed-dashboard -- start

cd ~/MAXED-OSS/client-portal
pm2 start npm --name maxed-portal -- start

cd ~/MAXED-OSS/opencpa
pm2 start npm --name maxed-opencpa -- start

pm2 save
pm2 startup   # Run the command it prints
```

#### 7. Start nginx

```bash
cd ~/MAXED-OSS/infra
docker compose up -d nginx --force-recreate
```

#### 8. Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1 -H "Host: app.maxed.life"
# Should return 307 (redirect to login)
```

#### 9. DNS and SSL

- Point `*.maxed.life` (or your domain) A record to your server IP.
- After DNS propagates, run certbot for SSL (stop nginx first, then start after).

**Login credentials:** `admin@maxed.dev` or `admin@maxed.life` / `maxed2024`

---

### Production Deployment Checklist (Summary)

- [ ] **DNS.** Point `*.maxed.dev` (or your domain) to your server IP.

- [ ] **SSL/TLS.** Uncomment the SSL block in `infra/nginx/nginx.conf` and set up Let's Encrypt (see Step 9 above).

- [ ] **Update all `.env.local` URLs** to use your production domain (e.g. `https://api.maxed.life`).

- [ ] **nginx config.** Use `network_mode: host` and `127.0.0.1` for all upstreams (see Step 4).

- [ ] **Build Next.js apps** with `npm run build`, then run with `npm start` via pm2.

- [ ] **Set up backups.** At minimum, back up:
  - PostgreSQL: `pg_dump` all 6 databases
  - MySQL: `mysqldump` for bigcapital, invoiceninja, kimai
  - Docker volumes: paperless media, docuseal data, mattermost data

- [ ] **Firewall.** Only expose ports 80/443 (nginx). All other ports should be internal only.

---

## API Endpoints Reference

Base URL: `http://YOUR_SERVER:4000`

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

| Deployment | RAM | CPU | Storage | Cost |
|-----------|-----|-----|---------|------|
| **DigitalOcean (recommended)** | 8 GB | 4 vCPUs | 160 GB SSD | ~$48/mo |
| DigitalOcean (comfortable) | 16 GB | 8 vCPUs | 320 GB SSD | ~$96/mo |
| Local Dev/Demo | 16 GB+ | 4+ cores | 20 GB | Your machine |

The biggest RAM consumers are PostgreSQL, Metabase, and Mattermost. For a demo or small firm, 8 GB on DigitalOcean is sufficient.

---

## Troubleshooting

**Container won't start:** Check logs with `docker compose logs <service-name>`. Most issues are database connection timing — restart the specific service: `docker compose restart <service-name>`.

**Prisma migration fails:** Make sure PostgreSQL is running and the `DATABASE_URL` in `platform/.env` is correct. The database must exist first (created by `init-databases.sql`). If using DigitalOcean, `DATABASE_URL` should point to `157.245.116.168:5432` (Prisma runs on the same server as Docker).

**Dashboard shows "Failed to fetch" errors:** The Platform API isn't running or the URL in `dashboard/.env.local` is wrong. Check that `http://YOUR_SERVER:4000/health` returns OK.

**Invoice Ninja 500 errors:** The `APP_KEY` is likely missing. Generate it and restart: `docker compose restart invoiceninja`.

**Twenty CRM won't load:** Token secrets may be blank. Generate them, then `docker compose restart twenty`.

**Docker Desktop disk corruption (Windows):** If you see `input/output error` during pulls, Docker Desktop's virtual disk is corrupted. Quit Docker Desktop → `wsl --shutdown` → Docker Desktop Settings → Troubleshoot → Clean/Purge data → Restart. Consider using DigitalOcean instead to avoid local resource issues.

**WSL2 won't start (0x800705aa):** Your machine is low on RAM. Close heavy apps, reboot, or switch to DigitalOcean deployment.

---

## Manual Secret Generation

If you prefer not to use `setup.sh`, generate secrets by hand:

```bash
cd infra

# Replace default database passwords in .env with strong randoms
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/BIGCAPITAL_MYSQL_ROOT_PASSWORD=.*/BIGCAPITAL_MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/BIGCAPITAL_MYSQL_PASSWORD=.*/BIGCAPITAL_MYSQL_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/INVOICENINJA_MYSQL_ROOT_PASSWORD=.*/INVOICENINJA_MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/INVOICENINJA_MYSQL_PASSWORD=.*/INVOICENINJA_MYSQL_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/KIMAI_MYSQL_ROOT_PASSWORD=.*/KIMAI_MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/KIMAI_MYSQL_PASSWORD=.*/KIMAI_MYSQL_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/PAPERLESS_ADMIN_PASSWORD=.*/PAPERLESS_ADMIN_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/N8N_BASIC_AUTH_PASSWORD=.*/N8N_BASIC_AUTH_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/KIMAI_ADMIN_PASSWORD=.*/KIMAI_ADMIN_PASSWORD=$(openssl rand -hex 16)/" .env

# Generate app keys and JWT secrets
sed -i "s|INVOICENINJA_APP_KEY=.*|INVOICENINJA_APP_KEY=base64:$(openssl rand -base64 32)|" .env
sed -i "s/TWENTY_ACCESS_TOKEN_SECRET=.*/TWENTY_ACCESS_TOKEN_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/TWENTY_LOGIN_TOKEN_SECRET=.*/TWENTY_LOGIN_TOKEN_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/TWENTY_REFRESH_TOKEN_SECRET=.*/TWENTY_REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)/" .env

# Generate NextAuth secret
cd ../dashboard
sed -i "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$(openssl rand -hex 32)/" .env.local
```

---

## License

Open source. Individual bundled tools retain their own licenses — see the [Bundled Open-Source Projects](#bundled-open-source-projects) table for each license. Check each project's repository for full terms.
