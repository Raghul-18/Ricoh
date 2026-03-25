# Oracle Migration Checklist (Priority + Status)

## Legend
- **Priority**: `P0` (must-have before go-live), `P1` (high), `P2` (nice-to-have)
- **Status**: `DONE`, `IN_PROGRESS`, `TODO`, `BLOCKED`

---

## P0 — Must Complete Before Go-Live

| Priority | Item | Status | Notes |
|---|---|---|---|
| P0 | Backend env configuration (Oracle/OCI/JWT/CORS) | TODO | Fill `backend/.env` from `backend/.env.example` with real values |
| P0 | Oracle schema applied to Autonomous DB | TODO | Run `backend/db/migrations/001_oracle_schema.sql` |
| P0 | Query API parity with frontend usage (`range`, `limit`, relational selects/projections) | TODO | Current `/api/query` mostly does `SELECT *`; frontend uses richer patterns |
| P0 | Password reset request flow fully implemented | TODO | `reset-password-request` is currently stubbed |
| P0 | Admin invite flows (`invite-admin`, `invite-customer`) fully implemented | TODO | Endpoints are placeholders now |
| P0 | Payment status refresh logic implemented | TODO | `update-payment-statuses` returns placeholder values |
| P0 | OCI upload/read security validation | TODO | Verify signed-read flow and bucket/IAM restrictions |
| P0 | End-to-end test pass (auth, onboarding, docs, deals/contracts, admin actions) | TODO | Must pass in target environment |

---

## P1 — High Priority (Next)

| Priority | Item | Status | Notes |
|---|---|---|---|
| P1 | Realtime strategy finalized (polling-only vs websocket/events) | TODO | Current realtime client is effectively a no-op |
| P1 | Monitoring, logging, and alerting for backend | TODO | Add production visibility and alerting |
| P1 | Security hardening (rate limits, token policy, error handling) | TODO | Harden auth and file endpoints |
| P1 | Documentation cleanup in root docs (remove legacy platform references) | DONE | `README.md`, `docs/PROJECT_SPEC.md`, `docs/EXEC_SUMMARY.md` updated to Oracle/backend terminology |

---

## P2 — Nice To Have / Cleanup

| Priority | Item | Status | Notes |
|---|---|---|---|
| P2 | Remove leftover empty legacy directories | TODO | Remove any unused migration-era folders |
| P2 | Improve chunking/build size warning cleanup | TODO | Current build warns about large bundle chunks |
| P2 | Expand automated integration tests | TODO | Add CI-level coverage for migrated flows |

---

## Completed Items

| Priority | Item | Status | Evidence |
|---|---|---|---|
| P0 | Frontend switched off legacy SDK usage | DONE | Replaced with `src/lib/backendClient.js` and updated imports |
| P0 | Legacy runtime code removed from app package | DONE | Legacy client file removed; app now uses backend adapter |
| P0 | Oracle DB connectivity layer implemented | DONE | `backend/src/db/oracle.js` pool + connection helper |
| P0 | OCI Object Storage integration implemented | DONE | `backend/src/services/objectStorageService.js` (`putObject`/read flow) |
| P0 | Oracle schema baseline created | DONE | `backend/db/migrations/001_oracle_schema.sql` |
| P0 | Auth/session backend scaffold implemented | DONE | `backend/src/routes/authRoutes.js` + `backend/src/services/authService.js` |
| P1 | Migration runbook added | DONE | `docs/ORACLE_MIGRATION_RUNBOOK.md` |
| P1 | Frontend build verification | DONE | `npm run build` succeeded after migration changes |

---

## Explicitly Out Of Scope (Current Decision)

| Priority | Item | Status | Notes |
|---|---|---|---|
| P0 | Historical data copy from legacy platform | DONE (SKIPPED BY DECISION) | Migration of historical data intentionally excluded |
| P0 | Historical object/file copy | DONE (SKIPPED BY DECISION) | Backfill of historical files intentionally excluded |

---

## Go-Live Gate (Must Be All DONE)

- [ ] Query API parity complete
- [ ] Password reset + admin invite + payment refresh no longer placeholders
- [ ] Oracle + OCI production env configured and validated
- [ ] Full end-to-end acceptance test pass
- [ ] Security checks completed
