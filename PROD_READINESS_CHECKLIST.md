# Maxed Production Readiness Checklist

This is the go/no-go list for CPA-facing production rollout.

## Architecture

- `maxed-gateway`, `maxed-auth`, `maxed-api`, `maxed-external-api`, `maxed-stream`, and `maxed-config` are deployed and online.
- `api.maxed.life` is routed to the gateway, not directly to the API process.
- `app.maxed.life` is the primary CPA-facing entrypoint.

## Database

- `platform/.env` contains valid `DATABASE_URL` and `DIRECT_URL`.
- Prisma migrations are deployed, including `20260324_add_password_reset_tokens`.
- `npx prisma migrate deploy` has completed successfully.
- `npx prisma generate` has been run after pulling the latest code.

## Auth And Security

- Dashboard sign-in succeeds through the auth service.
- Browser receives the `maxed_session` HTTP-only cookie for `.maxed.life`.
- Sign-out clears the `maxed_session` cookie.
- Production does not rely on the old hardcoded dev login fallback.
- Password reset tokens are no longer in-memory only; they are stored in the database.
- `EXPOSE_PASSWORD_RESET_TOKENS` is not enabled in production.

## Tenant Isolation

- A CPA user can only access their own firm's `/api/firms/:firmId/*` routes.
- A CPA user cannot fetch another firm's client or storage records by editing request IDs.
- Service proxy routes reject mismatched `X-Firm-Id` when the caller is not a platform admin.
- Normal CPA connector access fails closed when firm-specific credentials are missing.

## Connectors

- Every firm-facing connector used by the target CPA has firm-specific saved credentials:
  - Paperless
  - DocuSeal
  - n8n
  - Kimai
  - Invoice Ninja
  - Bigcapital
  - Mattermost
  - Metabase
  - Twenty
- Provisioning status matches live connector probe results, not just setup intent.
- No remaining workspace depends on shared-admin fallback for CPA access.

## Runtime Readiness

- `curl http://127.0.0.1:4100/ready`
- `curl http://127.0.0.1:4101/ready`
- `curl http://127.0.0.1:4102/ready`
- `curl http://127.0.0.1:4103/ready`
- `curl http://127.0.0.1:4104/ready`
- `curl http://127.0.0.1:4105/ready`
- `node platform/scripts/runtime-smoke.js`

All of the above must return success.

## CPA Workflow Validation

Test with at least:
- one platform admin
- one CPA firm admin
- one non-admin CPA user
- one client-portal user

Required flows:
- login
- logout
- forgot password
- reset password
- create firm
- switch into firm dashboard
- bookkeeping
- documents upload and download
- invoicing
- time tracking
- CRM
- chat
- workflows
- reporting
- proposals
- client portal

## Go / No-Go Rule

Go only if:
- all six runtime services are ready
- migrations are applied
- tenant isolation checks pass
- target CPA workflows pass end-to-end
- no connector used by that CPA depends on shared-admin fallback

No-go if any of the above fails.
