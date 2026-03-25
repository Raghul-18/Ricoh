# Oracle Migration Runbook

## 1) Provisioning
- Create Oracle Autonomous Database instance and wallet.
- Create OCI Object Storage buckets: `documents`, `contracts`.
- Configure backend secrets from `backend/.env.example`.

## 2) Schema
- Run `backend/db/migrations/001_oracle_schema.sql` on Autonomous DB.
- Validate table/constraint creation and basic connectivity.

## 3) Backend Bring-up
- `cd backend && npm install`
- `npm run dev`
- Confirm `GET /health` returns `{ ok: true }`.

## 4) Frontend Wiring
- Set `VITE_API_BASE_URL=http://localhost:4000/api`.
- Start frontend and confirm auth + CRUD requests hit backend.

## 5) Data + Object Migration
- Export legacy platform data snapshot.
- Implement and run `backend/scripts/migrate-data.js`.
- Implement and run `backend/scripts/migrate-objects.js`.
- Reconcile counts and sample integrity checks.

## 6) Cutover
- Freeze writes on legacy platform.
- Run final delta migration.
- Switch frontend/backend envs to Oracle stack.
- Execute smoke tests (auth, onboarding, deal, contract, docs).

## 7) Rollback
- Keep legacy stack available during initial cutover window.
- Revert app config to legacy deployment if validation fails.
