# OpenFrame Backend Modules

This folder contains the Maxed backend decomposition for the OpenFrame-style control plane.

## Module boundaries

- `registerOpenFrameRoutes.js`
  Composes the extracted OpenFrame route surfaces into the Express app.
- `controlPlaneRoutes.js`
  Control-plane APIs for catalog, service health, provisioning, credentials, identity mapping, access policy, and brokering.
- `workspaceRoutes.js`
  Firm-scoped Maxed workspace APIs for bookkeeping, documents, time tracking, proposals, workflows, chat, CRM, invoicing, and reporting.
- `legacyServiceRoutes.js`
  Backward-compatible connector adapter routes for `/api/services/*` while the UI and automation layer finish migrating.
- `storageRoutes.js`
  Maxed-owned storage endpoints for upload, signed/public URL generation, and file serving.

## Current architecture

`platform/server.js` is now the composition root:

- boot and middleware
- auth and base platform routes
- shared connector and workspace helpers
- OpenFrame route registration through this folder

That keeps the control-plane/domain surfaces modular without breaking the existing runtime contract.
