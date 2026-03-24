# Maxed Control Plane Rewrite

## Why

Maxed currently mixes three incompatible models:

1. Maxed-native product modules
2. Thin upstream reverse proxies
3. Provisioning metadata that is treated as if it proves live service access

That is why a firm can show as "provisioned" while Bigcapital, Kimai, storage, or other workflows are still unusable.

## OpenFrame Pattern To Reimplement

The useful OpenFrame pattern is architectural, not code-copy:

1. One gateway/control plane owns tenant identity and routing.
2. Upstream tools are adapters behind that control plane.
3. Health is based on live connector probes, not setup intent.
4. The UI talks to Maxed-native surfaces first, not directly to raw upstream apps.
5. Storage and core records remain Maxed-owned even if third-party syncs fail.

## Maxed Target Shape

### 1. Maxed Auth Boundary

- Platform session is the single browser-facing identity.
- All tenant context comes from the platform session plus firm scoping.
- No page should depend on direct upstream cookies or ad hoc browser handoffs.

### 2. Connector Registry

Each upstream service needs a connector with:

- credential resolution
- live probe
- supported capabilities
- normalized errors
- sync and provisioning hooks

Provisioning must never mark a service healthy unless the live probe passes.

### 3. Maxed-Owned Domain Model

CPA-facing workflows should live in Maxed first:

- documents
- bookkeeping review surfaces
- invoicing workflows
- time tracking workflows
- CRM / messaging / reporting orchestration

Upstream tools become backends or specialist engines, not the user-facing source of truth.

### 4. Storage First

- File upload/download must work without Supabase.
- Maxed local/object storage is the baseline.
- External sync to Paperless is additive, not required for basic function.

### 5. Capability-Aware UI

The UI should render based on connector capabilities and live probe state:

- connected
- degraded
- unavailable
- admin setup required

The UI should not assume that "provisioned" means usable.

## Rewrite Phases

### Phase 1

- Add local Maxed storage fallback
- Add live connector probes
- Stop counting provisioning intent as health
- Fix stale upstream endpoint assumptions

### Phase 2

- Move service execution behind a central connector registry
- Normalize responses for Bigcapital, Kimai, Invoice Ninja, Paperless
- Expose connector health and capability APIs

### Phase 3

- Replace raw upstream dependency in CPA pages with Maxed-owned workflows
- Preserve upstream sync as a backend concern

### Phase 4

- Split the platform monolith into explicit gateway/control-plane and domain services
- Keep tenant enforcement and auditability central

## Non-Goals

- Copying OpenFrame source directly
- Reusing Flamingo code or license-restricted implementation details
- Preserving misleading "green" states for broken connectors
