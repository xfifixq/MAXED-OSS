# n8n Workflows for MAXED-OSS

This directory contains pre-built n8n workflow JSON files for automating integrations between the Maxed platform and its connected services.

## Workflows

### 1. New Client Sync (`new-client-sync.json`)

Automates the creation of a new client across all integrated services when a client is added.

**Flow:**
1. **Webhook Trigger** - Receives a POST request at `/webhook/new-client` with client details (name, email, firstName, lastName, phone, firmId).
2. **Create Client in Invoice Ninja** - Creates a corresponding client record in Invoice Ninja via its API.
3. **Create Tag in Paperless-ngx** - Creates a tag named `client:<name>` in Paperless-ngx so documents can be automatically associated with the client.
4. **Update Client in Maxed API** - Saves the Invoice Ninja ID and Paperless tag ID back to the Maxed client record for cross-referencing.

**Required Environment Variables:**
- `INVOICE_NINJA_API_KEY`
- `PAPERLESS_API_TOKEN`
- `MAXED_API_TOKEN`

---

### 2. Document Auto-Tag (`document-auto-tag.json`)

Automatically categorizes documents based on OCR-extracted text content.

**Flow:**
1. **Webhook Trigger** - Receives a POST at `/webhook/document-processed` with `ocrText` and `documentId`.
2. **IF Chain** - Checks the OCR text against regex patterns:
   - Matches `W-2` or `1099` -> tagged as `tax_form`
   - Matches `invoice`, `bill to`, `amount due`, `payment due` -> tagged as `invoice`
   - Matches `engagement letter`, `engagement agreement`, `scope of services` -> tagged as `engagement_letter`
   - No match -> tagged as `general`
3. **HTTP Request** - PATCHes the document record in the Maxed API with the determined category.

**Required Environment Variables:**
- `MAXED_API_TOKEN`

---

### 3. Daily Financial Sync (`daily-financial-sync.json`)

Syncs financial data from Bigcapital into the Maxed platform on a nightly schedule.

**Flow:**
1. **Schedule Trigger** - Runs daily at 2:00 AM (cron: `0 2 * * *`).
2. **GET All Clients** - Fetches all clients from the Maxed API that have a `bigcapitalId`.
3. **SplitInBatches** - Iterates over each client one at a time.
4. **GET Financial Summary** - Retrieves the balance sheet from Bigcapital for the client.
5. **PATCH Client** - Updates the client record in Maxed with the financial summary and a `lastSyncedAt` timestamp.

**Required Environment Variables:**
- `MAXED_API_TOKEN`
- `BIGCAPITAL_API_TOKEN`

---

## How to Import Workflows

1. Open the n8n web interface (typically at `http://localhost:5678`).
2. Click the **three-dot menu** (or your user icon) in the top-left corner.
3. Select **Import from File**.
4. Choose the desired `.json` file from this directory.
5. The workflow will appear in your workflow list.

Alternatively, use the n8n CLI:

```bash
n8n import:workflow --input=new-client-sync.json
n8n import:workflow --input=document-auto-tag.json
n8n import:workflow --input=daily-financial-sync.json
```

## How to Activate Workflows

After importing, each workflow is **inactive by default**. To activate:

1. Open the imported workflow in the n8n editor.
2. Configure any required credentials and environment variables (see each workflow section above).
3. Toggle the **Active** switch in the top-right corner of the workflow editor.
4. For webhook-based workflows, n8n will display the production webhook URL once activated.

## Environment Variables

Set the following environment variables in your n8n instance (via `.env` file, Docker environment, or n8n settings):

| Variable | Description |
|---|---|
| `INVOICE_NINJA_API_KEY` | API token for Invoice Ninja |
| `PAPERLESS_API_TOKEN` | API token for Paperless-ngx |
| `MAXED_API_TOKEN` | Bearer token for the Maxed API |
| `BIGCAPITAL_API_TOKEN` | Bearer token for Bigcapital |

## Service Endpoints

These workflows assume the following service URLs (matching the Docker Compose network):

| Service | URL |
|---|---|
| Invoice Ninja | `http://invoice-ninja:80` |
| Paperless-ngx | `http://paperless:8000` |
| Bigcapital | `http://bigcapital:8000` |
| Maxed API | `http://localhost:4000` |

Adjust these URLs in the workflow nodes if your deployment uses different hostnames or ports.
