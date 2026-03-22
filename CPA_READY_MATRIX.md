# CPA Readiness Matrix

This document defines what "CPA ready" means for Maxed and maps the current implementation against the upstream open-source products bundled in this repo.

It is intentionally strict. If a workflow is not implemented inside Maxed or clearly delegated to the upstream app by design, it is treated as a gap.

## Product Ownership Rules

Maxed currently bundles overlapping tools. To make the product coherent for a CPA firm, each workflow needs one clear owner.

### Recommended source of truth

| Workflow | System of Record | Maxed Module |
|----------|------------------|--------------|
| Firm, team, client master records | Maxed platform database | Dashboard / CRM |
| General ledger, accounts, statements | Bigcapital | Ledger |
| Billing, invoice issue, payment collection | Invoice Ninja | Billing |
| Document vault and OCR repository | Paperless-ngx | Documents |
| Time tracking | Kimai | Time |
| Team chat | Mattermost | Chat |
| Analytics and saved reporting assets | Metabase | Analytics |
| E-signature and engagement document workflow | DocuSeal | Proposals |
| Workflow automation and cross-system sync | n8n | Workflows |

### Why this ownership split

- Bigcapital and Invoice Ninja overlap around invoicing. The cleaner model is:
  - Bigcapital owns accounting and statements.
  - Invoice Ninja owns client billing and payments.
- Maxed should present those as linked modules, not duplicate invoice creation in both places.
- If you want Bigcapital to own invoicing too, Invoice Ninja should be removed from the product architecture. Running both as first-class invoicing systems creates ambiguity and reconciliation risk.

## Current Status Summary

This is an engineering estimate based on the repo state, not live runtime verification.

| Tool | Current Maxed Status | CPA-ready? |
|------|----------------------|------------|
| Bigcapital | Partial ledger read surface only | No |
| Paperless-ngx | Moderate document review/browse coverage | No |
| Invoice Ninja | Moderate billing coverage | No |
| Kimai | Moderate operational coverage | No |
| Mattermost | Moderate team chat coverage | No |
| Metabase | Light-to-moderate reporting catalog coverage | No |
| DocuSeal | Minimal native coverage | No |
| n8n | Moderate control-plane coverage | No |
| Twenty CRM | Minimal review in this pass | No |

## Feature Matrix

### 1. Bigcapital

#### Upstream capabilities

- Chart of accounts
- Ledger accounts
- Transactions and journal entries
- Balance sheet / P&L
- Contacts, vendors, customers
- Banking and cash activity
- Expenses and bills
- Potential overlap with invoicing and sales objects

#### Current Maxed coverage

- Account list
- Recent transactions
- Balance sheet and P&L summaries
- Filtered ledger review UI

#### Gaps

- No journal entry creation/editing
- No transaction drill-down
- No reconciliation flow
- No vendor/contact management
- No expenses/bills workflow
- No banking workflow
- No accounting period management
- No audit/review workflow inside Maxed

#### Required for CPA readiness

- Account detail and ledger drill-down
- Journal entry create/edit/post flow
- Contact/vendor management
- Expense/bill capture and review
- Reconciliation or explicit non-support decision
- Statement drill-down from line to underlying activity

### 2. Paperless-ngx

#### Upstream capabilities

- OCR document repository
- Search and filters
- Tags, correspondents, document types
- Preview/download
- Metadata editing
- Bulk document actions
- Inbox/review style operations

#### Current Maxed coverage

- Search
- Filters
- Tag/correspondent/document type selectors
- Thumbnail preview
- Download original
- Maxed-linked upload flow

#### Gaps

- No metadata editing
- No bulk actions
- No document reclassification
- No document note/review workflow
- No correspondent/type/tag admin management
- No inbox processing UX

#### Required for CPA readiness

- Document detail editor
- Bulk classify/tag/archive actions
- Review queue and status workflow
- Better client linkage and document assignment tools

### 3. Invoice Ninja

#### Upstream capabilities

- Clients
- Invoices
- Payments
- Quotes
- Products/services
- Recurring invoices
- PDF/download/share/send
- Billing status and collections workflow

#### Current Maxed coverage

- Live clients
- Live invoices
- Live payments
- Native invoice issue flow
- Native payment posting flow

#### Gaps

- No invoice detail screen
- No invoice edit/update/send flow
- No PDF/open/share flow
- No client create/edit flow inside billing
- No products/services management
- No recurring billing flow
- No quote workflow

#### Required for CPA readiness

- Invoice detail and status actions
- Client billing profile management
- Payment reconciliation and invoice allocation verification
- PDF/share/send actions
- Optional recurring invoice support if firms use retainers

### 4. Kimai

#### Upstream capabilities

- Customers
- Projects
- Activities
- Timesheets
- Reports/export
- Team-based time tracking administration

#### Current Maxed coverage

- Timesheet list
- Time entry creation
- Customer/project/activity creation

#### Gaps

- No edit/delete flow for entries
- No reporting/export
- No staffing/team views
- No project/customer detail management
- No approval workflow

#### Required for CPA readiness

- Entry correction flow
- Utilization/reporting surface
- Team filtering
- Customer/project detail management

### 5. Mattermost

#### Upstream capabilities

- Teams
- Channels
- Posts
- Membership and user management
- Threads, notifications, direct messages
- Administration

#### Current Maxed coverage

- Teams list
- Team channels
- Posts list
- Send post
- Create channel

#### Gaps

- No user/channel membership management
- No direct messages
- No thread UI
- No admin/user moderation flow
- No richer message actions

#### Required for CPA readiness

- User and channel membership management
- Team/user assignment workflows for engagements
- Thread visibility or explicit product decision not to support

### 6. Metabase

#### Upstream capabilities

- Dashboard catalog
- Questions/cards
- Dashboard rendering
- Query authoring
- Collections and sharing
- Admin/data model configuration

#### Current Maxed coverage

- Dashboard catalog
- Question catalog
- Selected dashboard card inventory
- Search over dashboards and questions

#### Gaps

- No real dashboard rendering
- No chart/visual embed inside Maxed
- No authoring
- No sharing/export
- No collection/admin workflow

#### Required for CPA readiness

- Embedded dashboard rendering or secure deep-link strategy
- Report export/share
- Clear admin/setup workflow

### 7. DocuSeal

#### Upstream capabilities

- Templates
- Submissions
- Signers/roles
- Signing workflow
- Status tracking

#### Current Maxed coverage

- Proxy endpoints exist
- Native parity work not expanded in this pass

#### Gaps

- Minimal end-user Maxed UI coverage

#### Required for CPA readiness

- Template library UI
- Submission creation UI
- Status tracking and signer progress

### 8. n8n

#### Upstream capabilities

- Workflows
- Executions
- Activation/deactivation
- Full automation authoring

#### Current Maxed coverage

- Workflow and execution coverage exists in the repo
- Not reviewed deeply in this pass

#### Gaps

- Full authoring and operational governance not verified

#### Required for CPA readiness

- Reliable workflow monitoring
- Failure alerting
- Onboarding automation verification

### 9. Twenty CRM

#### Upstream capabilities

- Companies
- People
- Deal/pipeline activity
- CRM administration

#### Current Maxed coverage

- Limited review in this pass

#### Gaps

- Native CRM parity not established here

#### Required for CPA readiness

- Contact/company detail flows
- Pipeline or explicit non-support decision

## Priority Order

If the goal is "give this to a CPA now", build in this order:

1. Bigcapital runtime verification and ledger drill-down/create workflows
2. Invoice Ninja invoice lifecycle and PDF/send flows
3. Paperless metadata editing and review workflows
4. Kimai reporting and correction flows
5. Mattermost membership/admin workflows
6. DocuSeal native submission UX
7. Metabase real dashboard rendering
8. Twenty CRM parity decision and implementation
9. n8n monitoring hardening

## What This Means Today

Maxed is now closer to a coherent CPA operations shell, but it is not yet a complete in-Maxed replacement for all upstream products.

The repo can support a staged rollout if:

- the CPA team accepts some workflows still happening in the upstream apps
- runtime verification passes on the server
- you clearly document which workflows are "native in Maxed" and which are "open in source app"

If the requirement is strict full parity inside Maxed UI, more implementation work is still required across Bigcapital, Invoice Ninja, Paperless, Kimai, Mattermost, Metabase, DocuSeal, and Twenty.
