# Platform Runtime Modules

The backend is decomposed into runtime roles under `platform/src/`:

- `runtime/`
  Express app bootstrap, middleware, health, and auth gate wiring.
- `platform/`
  Base platform/auth/client/team routes that are not OpenFrame connector surfaces.
- `openframe/`
  Control-plane, workspace, storage, registry, and legacy adapter surfaces.

`platform/server.js` is the composition root and shared helper layer. It no longer defines API routes inline.
