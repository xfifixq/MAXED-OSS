# Maxed OpenCPA Platform

Unified data layer for the Maxed accounting firm management platform. Built with Node.js, Express, and Prisma ORM backed by PostgreSQL.

## Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- A running PostgreSQL instance with a database created for the project

## Setup

1. **Install dependencies**

   ```bash
   cd platform
   npm install
   ```

2. **Configure environment**

   Copy or edit the `.env` file to match your PostgreSQL connection:

   ```
   DATABASE_URL=postgresql://maxed:maxed_dev_2024@localhost:5432/maxed_unified
   PORT=4000
   ```

3. **Run database migrations**

   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed the database**

   ```bash
   npm run seed
   ```

5. **Start the runtime**

   ```bash
   # Gateway boundary
   npm run start:gateway

   # Internal API
   npm run start:api

   # Auth service
   npm run start:auth
   ```

For the full decomposed runtime, use the PM2 file at [ecosystem.config.cjs](/Users/fifisiddiqui/Desktop/MAXED-OSS/MAXED-OSS/infra/pm2/ecosystem.config.cjs) or the Docker Compose stack in [docker-compose.yml](/Users/fifisiddiqui/Desktop/MAXED-OSS/MAXED-OSS/infra/docker-compose.yml).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/firms` | Create a firm |
| GET | `/api/firms` | List all firms |
| GET | `/api/firms/:id` | Get firm with clients and team members |
| POST | `/api/firms/:firmId/clients` | Create a client |
| GET | `/api/firms/:firmId/clients` | List clients with documents, invoices, scenarios |
| POST | `/api/clients/:clientId/scenarios` | Create a scenario |
| GET | `/api/clients/:clientId/scenarios` | List scenarios |
| POST | `/api/clients/:clientId/documents` | Create a document |
| GET | `/api/clients/:clientId/documents` | List documents |
| POST | `/api/clients/:clientId/invoices` | Create an invoice |
| GET | `/api/clients/:clientId/invoices` | List invoices |
| POST | `/api/clients/:clientId/messages` | Create a message |
| GET | `/api/clients/:clientId/messages` | List messages |
| GET | `/api/firms/:firmId/stats` | Firm statistics (counts and total revenue) |

## Data Models

- **Firm** - Accounting firm (has clients, team members, workflows)
- **Client** - Business client of a firm
- **TeamMember** - Staff or admin belonging to a firm
- **Document** - Tax returns, financial statements, etc.
- **Invoice** - Billing records
- **Workflow** - Automated workflows (n8n integration)
- **AdvisorySession** - Client advisory meetings
- **Scenario** - What-if tax/business scenarios
- **Message** - Client-firm communication
