# Developer Setup Guide

Step-by-step guide to connect all integrated services in the Maxed OpenCPA platform.

---

## Prerequisites

- Docker Desktop running (or Docker on Linux)
- Node.js 18+
- All containers running: `cd infra && docker compose up -d`
- Platform API running: `cd platform && npm start`

---

## 1. Paperless-ngx (Document Management)

**Port:** 8000
**API Base:** `http://localhost:8000/api/`
**Auth:** Token-based

### Get API Token

1. Log in to Paperless at `http://localhost:8000` (admin / maxed2024)
2. Go to Django Admin: `http://localhost:8000/admin/`
3. Navigate to Auth Token > Add Token
4. Select the admin user and save
5. Copy the token

### Configure

Add to `platform/.env`:
```
PAPERLESS_URL=http://localhost:8000
PAPERLESS_API_TOKEN=your_token_here
```

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents/` | List documents (supports `?query=`, `?page=`, `?ordering=`) |
| GET | `/api/documents/{id}/` | Get document details |
| POST | `/api/documents/post_document/` | Upload a document (multipart/form-data) |
| GET | `/api/documents/{id}/download/` | Download original file |
| GET | `/api/documents/{id}/thumb/` | Get document thumbnail |
| GET | `/api/tags/` | List all tags |
| GET | `/api/correspondents/` | List correspondents (clients) |
| GET | `/api/document_types/` | List document types |

---

## 2. Invoice Ninja (Invoicing & Billing)

**Port:** 8080
**API Base:** `http://localhost:8080/api/v1/`
**Auth:** X-API-TOKEN header

### Get API Token

1. Log in to Invoice Ninja at `http://localhost:8080` (admin@maxed.dev / maxed2024)
2. Go to Settings > Account Management > API Tokens
3. Click "Add Token", name it, save
4. Copy the token

### Configure

Add to `platform/.env`:
```
INVOICE_NINJA_URL=http://localhost:8080
INVOICE_NINJA_API_TOKEN=your_token_here
```

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/clients` | List clients |
| POST | `/api/v1/clients` | Create client |
| GET | `/api/v1/invoices` | List invoices |
| POST | `/api/v1/invoices` | Create invoice |
| GET | `/api/v1/payments` | List payments |
| POST | `/api/v1/payments` | Record payment |
| GET | `/api/v1/products` | List products/services |
| GET | `/api/v1/invoices/{id}/download` | Download invoice PDF |

All endpoints support `?per_page=`, `?page=`, `?sort=` query parameters.

---

## 3. DocuSeal (E-Signatures & Proposals)

**Port:** 3003
**API Base:** `http://localhost:3003/api/`
**Auth:** X-Auth-Token header

### Get API Token

1. Log in to DocuSeal at `http://localhost:3003`
2. Create an account on first visit
3. Go to Settings > API
4. Copy the API key

### Configure

Add to `platform/.env`:
```
DOCUSEAL_URL=http://localhost:3003
DOCUSEAL_API_TOKEN=your_token_here
```

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List templates |
| GET | `/api/templates/{id}` | Get template details |
| POST | `/api/submissions` | Send a document for signing |
| GET | `/api/submissions` | List submissions |
| GET | `/api/submissions/{id}` | Get submission status |

### Creating a Submission (Sending for Signature)

```json
POST /api/submissions
{
  "template_id": 1,
  "send_email": true,
  "submitters": [
    {
      "role": "Client",
      "email": "client@example.com",
      "name": "John Doe"
    }
  ]
}
```

---

## 4. n8n (Workflow Automation)

**Port:** 5678
**API Base:** `http://localhost:5678/api/v1/`
**Auth:** X-N8N-API-KEY header

### Get API Key

1. Log in to n8n at `http://localhost:5678` (admin / maxed2024)
2. Go to Settings > API
3. Create a new API key
4. Copy the key

### Configure

Add to `platform/.env`:
```
N8N_URL=http://localhost:5678
N8N_API_KEY=your_api_key_here
```

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/workflows` | List all workflows |
| GET | `/api/v1/workflows/{id}` | Get workflow details |
| PATCH | `/api/v1/workflows/{id}` | Update workflow (activate/deactivate) |
| GET | `/api/v1/executions` | List recent executions |
| POST | `/api/v1/workflows/{id}/activate` | Activate a workflow |
| POST | `/api/v1/workflows/{id}/deactivate` | Deactivate a workflow |

### Import Pre-Built Workflows

```bash
# From the n8n UI, import these files:
platform/n8n-workflows/new-client-sync.json
platform/n8n-workflows/document-auto-tag.json
platform/n8n-workflows/daily-financial-sync.json
```

After importing, update credential/environment variables inside each workflow.

---

## 5. Kimai (Time Tracking)

**Port:** 8001
**API Base:** `http://localhost:8001/api/`
**Auth:** X-AUTH-USER + X-AUTH-TOKEN headers

### Get API Token

1. Log in to Kimai at `http://localhost:8001` (admin@maxed.dev / maxed2024)
2. Go to your user profile > API Access
3. Create a new API token
4. Copy the token

### Configure

Add to `platform/.env`:
```
KIMAI_URL=http://localhost:8001
KIMAI_API_USER=admin@maxed.dev
KIMAI_API_TOKEN=your_token_here
```

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/timesheets` | List timesheets (`?page=`, `?size=`, `?order=`, `?orderBy=`) |
| POST | `/api/timesheets` | Create timesheet entry |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/activities` | List activities |
| GET | `/api/customers` | List customers |
| GET | `/api/users` | List users |

### Creating a Timesheet Entry

```json
POST /api/timesheets
{
  "begin": "2025-01-15T09:00:00",
  "end": "2025-01-15T11:30:00",
  "project": 1,
  "activity": 1,
  "description": "Tax return preparation"
}
```

---

## 6. Metabase (BI & Reporting)

**Port:** 3002
**API Base:** `http://localhost:3002/api/`
**Auth:** Session-based or API key

### Setup

1. Visit `http://localhost:3002` and create an admin account
2. Connect to the PostgreSQL database:
   - Host: `postgres` (if inside Docker) or `localhost`
   - Port: `5432`
   - Database: `maxed_unified`
   - Username: `maxed`
   - Password: from `infra/.env`

### Embedding Dashboards

Metabase supports three embedding methods:
- **Public link:** Enable in Metabase settings for read-only dashboards
- **Signed embedding:** Use JWT for secure embedding (recommended)
- **Full-app embedding:** Embed the entire Metabase UI

For production, enable public sharing on specific dashboards and use the public embed URL.

---

## 7. Mattermost (Team Chat)

**Port:** 8065
**API Base:** `http://localhost:8065/api/v4/`
**Auth:** Bearer token

### Setup

1. Visit `http://localhost:8065` and create a workspace
2. For API access, create a bot or use personal access tokens:
   - System Console > Integrations > Bot Accounts > Enable
   - User menu > Integrations > Personal Access Tokens

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v4/channels` | List channels |
| POST | `/api/v4/channels` | Create channel |
| POST | `/api/v4/posts` | Send message |
| GET | `/api/v4/teams` | List teams |
| GET | `/api/v4/users` | List users |

Mattermost also supports **incoming/outgoing webhooks** for integration without API tokens.

---

## 8. Twenty CRM

**Port:** 3004
**API:** GraphQL and REST
**Auth:** Bearer token (JWT)

### Setup

1. Visit `http://localhost:3004` and create an account
2. For API access: Settings > Developers > API Keys

### API Details

Twenty uses a **GraphQL API** at `/api/graphql`. The REST API is also available at `/api/rest/`.

Example GraphQL query:
```graphql
query {
  companies {
    edges {
      node {
        id
        name
        domainName
      }
    }
  }
}
```

---

## 9. Bigcapital (Bookkeeping / GL)

**Port:** 3001
**API Base:** `http://localhost:3001/api/`
**Auth:** Session-based (JWT)

### Setup

1. Visit `http://localhost:3001` and create an organization
2. Set up chart of accounts
3. API access uses session authentication after login

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List chart of accounts |
| GET | `/api/journal-entries` | List journal entries |
| POST | `/api/journal-entries` | Create journal entry |
| GET | `/api/financial-statements/balance-sheet` | Get balance sheet |
| GET | `/api/financial-statements/profit-loss` | Get P&L statement |

---

## 10. Supabase (Optional — Managed Database + Auth + Storage)

Instead of self-hosted PostgreSQL, you can use [Supabase](https://supabase.com) for managed Postgres, authentication, and file storage. This is recommended for production.

### Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Project Settings > Database > Connection string**
3. Update `platform/.env`:

```
# Transaction pooler (port 6543) — for Prisma queries
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Session pooler (port 5432) — for Prisma migrations
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Supabase client (for auth + storage features)
SUPABASE_URL="https://[project-ref].supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

4. Run migrations against Supabase:

```bash
cd platform
npx prisma migrate deploy
npx prisma db seed
```

5. (Optional) Create a `documents` storage bucket in Supabase Dashboard > Storage for file uploads.

### What Supabase Provides

| Feature | Self-Hosted | Supabase |
|---------|------------|----------|
| PostgreSQL | Docker container | Managed, auto-backups |
| Auth | NextAuth + bcrypt | Supabase Auth (social login, MFA) |
| File Storage | Paperless-ngx only | Supabase Storage buckets |
| Realtime | Not available | Supabase Realtime subscriptions |
| Dashboard | None | Built-in SQL editor + table viewer |

The platform API detects Supabase automatically. When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, it enables file storage endpoints (`/api/storage/upload`, `/api/storage/url`).

---

## Quick Checklist

After running `./setup.sh`:

1. [ ] Platform API running: `curl http://localhost:4000/health`
2. [ ] Get Paperless API token, add to `platform/.env`
3. [ ] Get Invoice Ninja API token, add to `platform/.env`
4. [ ] Get DocuSeal API token, add to `platform/.env`
5. [ ] Get n8n API key, add to `platform/.env`
6. [ ] Get Kimai API token, add to `platform/.env`
7. [ ] Import n8n workflows from `platform/n8n-workflows/`
8. [ ] Connect Metabase to PostgreSQL database
9. [ ] Create Mattermost workspace and channels
10. [ ] Create Twenty CRM account and configure
11. [ ] Create Bigcapital organization and chart of accounts
12. [ ] (Optional) Configure Supabase — see section 10 above

---

## Production Security Checklist

- [ ] Set `MAXED_API_KEY` in `platform/.env` to a strong random value
- [ ] Set `CORS_ORIGINS` in `platform/.env` to your dashboard/portal URLs
- [ ] Set `NEXTAUTH_SECRET` in `dashboard/.env.local`
- [ ] Regenerate all service passwords with `openssl rand -hex 16`
- [ ] Only expose ports 80/443 through nginx; block all other ports via firewall
- [ ] Enable HTTPS via Let's Encrypt (see `infra/setup-ssl.sh`)
- [ ] Use `pm2` to keep Node.js apps running with auto-restart

---

## Tools That Cannot Be Replaced (Integration Only)

These categories require proprietary software due to regulatory requirements:

| Category | Tools | Why |
|----------|-------|-----|
| **Tax Preparation** | UltraTax CS, Lacerte, ProConnect, Drake, ProSeries | Tax code updates, IRS e-filing integration, state compliance. No viable OSS alternative. |
| **Payroll** | Gusto, ADP, Paychex | Payroll tax calculations, direct deposit, W-2/1099 generation require certified payroll providers. |

These tools integrate with Maxed via n8n workflows (webhook triggers, scheduled syncs) or manual data export/import. They are **not replaced** by the platform.
