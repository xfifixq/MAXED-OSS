# Maxed OpenCPA — Startup Sequence

**Use this when you log back into the project and need to get everything running from scratch.**

---

## Does This Need to Run 24/7?

**Yes.** For CPA firms to use Maxed, the platform must be running all the time. Clients need to:
- Access the client portal anytime
- Upload documents, view invoices, sign proposals
- Message the firm

The firm needs:
- The dashboard, documents, invoicing, workflows, etc. available during business hours (and often after)

**How to achieve 24/7 uptime:**
- **Production:** Deploy on a DigitalOcean droplet (or similar) that runs 24/7. Use `pm2` to keep the Node apps running and `restart: unless-stopped` in Docker (already configured) so containers auto-restart after reboots.
- **Development:** You start everything when you work and stop when you're done. Nothing runs when your laptop is off.

---

## Quick Reference: What to Run (In Order)

| Step | What | Where |
|------|------|-------|
| 1 | Start Docker services | `cd infra && docker compose up -d` |
| 2 | Start Platform API | `cd platform && npm start` |
| 3 | Start Dashboard | `cd dashboard && npm run dev` |
| 4 | Start Client Portal | `cd client-portal && npm run dev` |
| 5 | (Optional) Start OpenCPA | `cd opencpa && npm run dev` |

---

## Full Startup Sequence (From Scratch)

### Prerequisites
- Docker Desktop running (or Docker on Linux)
- Node.js 18+ installed
- Project cloned: `~/MAXED-OSS` (or your path)

---

### 1. First-Time Setup (Only Once)

If you've never run the project before, or you've pulled major changes:

```bash
cd ~/MAXED-OSS   # or your project path

# Run the full setup (generates secrets, installs deps, starts Docker, seeds DB)
chmod +x setup.sh
./setup.sh
```

This does:
- Generates passwords for all databases and services
- Installs npm deps for platform, dashboard, client-portal, opencpa
- Starts all Docker containers
- Runs Prisma migrations and seeds sample data

**Wait 2–3 minutes** for services to initialize. Then:

```bash
cd infra && docker compose ps
```

All containers should show `Up` or `Up (healthy)`.

---

### 2. Daily Startup (When You Come Back)

If you've already run `./setup.sh` before and just need to start everything again:

#### A. Start Docker (all 9 services + databases)

```bash
cd ~/MAXED-OSS/infra
docker compose up -d
```

Wait ~1–2 minutes for PostgreSQL and other DBs to be ready.

#### B. Start the Node apps (4 terminals, or use background)

**Terminal 1 — Platform API:**
```bash
cd ~/MAXED-OSS/platform
npm start
```

**Terminal 2 — Dashboard:**
```bash
cd ~/MAXED-OSS/dashboard
npm run dev
```

**Terminal 3 — Client Portal:**
```bash
cd ~/MAXED-OSS/client-portal
npm run dev
```

**Terminal 4 (optional) — OpenCPA marketing site:**
```bash
cd ~/MAXED-OSS/opencpa
npm run dev
```

#### C. Or run in background (single terminal)

```bash
cd ~/MAXED-OSS
cd platform && npm start &
cd dashboard && npm run dev &
cd client-portal && npm run dev &
cd opencpa && npm run dev &
```

---

### 3. Verify Everything Is Running

| Service | URL | Check |
|---------|-----|-------|
| Platform API | `http://localhost:4000/health` | `curl http://localhost:4000/health` |
| Dashboard | `http://localhost:3005` | Open in browser |
| Client Portal | `http://localhost:3006` | Open in browser |
| OpenCPA | `http://localhost:3007` | Open in browser |
| Docker services | — | `cd infra && docker compose ps` |

---

### 4. Production: Keep It Running 24/7 (PM2)

On a server (e.g. DigitalOcean droplet), use PM2 so the Node apps survive disconnects and reboots:

```bash
npm install -g pm2

cd ~/MAXED-OSS
chmod +x infra/pm2/recover-runtime.sh
./infra/pm2/recover-runtime.sh --rebuild

pm2 startup   # Run the command it prints to enable on boot
```

Docker containers already use `restart: unless-stopped`, so they come back after a server reboot.

If you switch between older commits and the newer split-service runtime, do not keep manually reusing the same PM2 process set. Run `./infra/pm2/recover-runtime.sh --rebuild` again so PM2 drops stale legacy or split-platform processes before restart.

---

## Shutdown (When You're Done for the Day)

**Development only** — if you want to stop everything:

```bash
# Stop Node apps: Ctrl+C in each terminal, or:
pkill -f "node server.js"
pkill -f "next dev"

# Stop Docker (keeps data)
cd ~/MAXED-OSS/infra
docker compose stop
```

To stop and remove containers (data persists in volumes):
```bash
docker compose down
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `docker compose up -d` fails | Ensure Docker Desktop is running |
| API returns 500 / DB errors | Wait longer for Postgres; `docker compose restart postgres` |
| Dashboard "Failed to fetch" | Platform API not running or wrong URL in `dashboard/.env.local` |
| Port already in use | Another process is using it; stop it or change the port |
| Prisma migration fails | `cd platform && npx prisma migrate deploy` after Postgres is up |
| Old commit still runs new PM2 services | `cd ~/MAXED-OSS && ./infra/pm2/recover-runtime.sh --rebuild` to clear stale PM2 apps and restart the runtime that matches the current checkout |

---

## URLs Cheat Sheet

**Local / Dev (replace with your IP if on a droplet):**

| App | URL |
|-----|-----|
| Dashboard | http://localhost:3005 |
| Client Portal | http://localhost:3006 |
| OpenCPA | http://localhost:3007 |
| API | http://localhost:4000 |
| Bigcapital | http://localhost:3001 |
| Paperless-ngx | http://localhost:8000 |
| n8n | http://localhost:5678 |
| Metabase | http://localhost:3002 |
| DocuSeal | http://localhost:3003 |
| Invoice Ninja | http://localhost:8080 |
| Twenty CRM | http://localhost:3004 |
| Kimai | http://localhost:8001 |
| Mattermost | http://localhost:8065 |

---

## TL;DR — Fastest Path Back

```bash
cd ~/MAXED-OSS/infra && docker compose up -d
cd ~/MAXED-OSS/platform && npm start &
cd ~/MAXED-OSS/dashboard && npm run dev &
cd ~/MAXED-OSS/client-portal && npm run dev &
```

Then open http://localhost:3005 for the dashboard.
