# Platform Runtime Modules

The backend is decomposed into runtime roles under `platform/src/` and `platform/services/`:

- `services/maxed-gateway/`
  Browser-facing gateway boundary. Routes CPA traffic to auth, API, config, stream, and external services.
- `services/maxed-auth/`
  Platform login, session, logout, password reset, and client portal auth.
- `services/maxed-api/`
  Internal API surface that runs the firm, workspace, control-plane, and storage logic.
- `services/maxed-external-api/`
  Public service catalog and bridge handoff endpoints.
- `services/maxed-stream/`
  Runtime event ingestion and SSE event feed.
- `services/maxed-config/`
  Central runtime and connector configuration surface.
- `runtime/`
  Express app bootstrap, middleware, and health wiring.
- `platform/`
  Base platform routes.
- `openframe/`
  Control-plane, workspace, storage, registry, and legacy adapter surfaces.
- `shared/`
  Shared auth/session, Prisma/Supabase bootstrap, runtime ports, and proxy helpers.

`platform/server.js` remains the legacy-compatible internal API composition root, while the deployed topology now runs through the service entrypoints under `platform/services/`.
