# Handoff

## Current Feature / Goal
- Move the lending/leasing platform onto a stricter production-grade lifecycle for deal approval, customer onboarding, contract signing, and termination.
- Replace the temporary-password approval flow with passwordless-first onboarding links.
- Keep the system Oracle-compatible, RBAC-safe, auditable, and modular enough to support multiple email providers.

## What Has Been Completed
- Added the original lifecycle/security migration:
  - `ricoh-capital/backend/db/migrations/003_deal_contract_security_and_lifecycle.sql`
- Added the follow-up secure onboarding + e-sign migration:
  - `ricoh-capital/backend/db/migrations/004_secure_onboarding_and_esign.sql`
- Hardened backend auth/query behavior:
  - refresh token now reloads `email` and `role`
  - password update validates complexity server-side
  - login rejects password auth for customers who only have onboarding-token access
  - signed URL verification uses timing-safe comparison
  - `/api/query` blocks empty-filter deletes and now forces lifecycle writes through dedicated endpoints for contracts/signatures/closure/onboarding tokens
- Reworked deal approval to be transactional and lifecycle-driven:
  - create/link customer
  - create immutable contract snapshot with version + document hash
  - generate hashed single-use onboarding token
  - send onboarding email
  - seed payment schedule
  - write audit trail
- Added passwordless onboarding flow:
  - `/api/auth/onboard/consume`
  - frontend route `/onboard`
  - redirects customer into the contract page after token consumption
- Added audit-grade signing flow:
  - captures role, timestamp, IP, user agent, document hash, document version
  - contract becomes `ACTIVE` only after both customer and admin signatures exist
- Added provider-agnostic email layer:
  - `backend/src/email/service.js`
  - providers for Gmail SMTP and OCI SMTP-style delivery design
  - reusable templates for onboarding, approval, signing, and fully executed notifications
- Added dedicated backend routes for:
  - approve deal
  - resend onboarding invite
  - sign contract
  - view contract audit event
  - closure request create/review
  - direct termination
  - audit log insertion
- Frontend updated for:
  - onboarding link sign-in
  - admin approval result page showing invite expiry instead of temp password
  - contract viewing audit callback
  - signature-field normalization after signature table rename
  - customer/admin lifecycle display alignment
- Dependencies are now installed and lockfiles updated.
- Frontend production build succeeds locally with Vite/TypeScript.
- Backend JS syntax checks succeed with `node --check`.

## What Is In Progress
- Full runtime verification against a live Oracle schema with migrations `003` and `004`.
- Manual QA of the new onboarding email -> onboard link -> contract sign flow.
- Final cleanup of remaining screens/docs that still mention old temp-password behavior.

## Pending Tasks
- Apply migration `004_secure_onboarding_and_esign.sql` after `003` in the target Oracle database.
- Start the backend and run end-to-end smoke tests:
  - admin approves a deal
  - customer receives onboarding email
  - customer opens `/onboard?token=...`
  - customer lands on contract page
  - customer signs
  - admin signs
  - contract becomes `ACTIVE`
  - customer requests closure
  - admin approves/declines closure
- Confirm resend invite invalidates only older unused tokens for the same contract.
- Verify contract signatures persist correctly in renamed `signatures` table after migration.
- Check any reporting/export/admin pages that may still assume `contract_signatures` instead of `signatures`.
- Review remaining translation/copy gaps in new onboarding and contract lifecycle UI.
- Decide whether to address backend `npm audit` findings now or defer to a dependency-maintenance pass.

## Key Decisions / Assumptions
- Passwordless-first onboarding is now the primary customer access pattern; plaintext temp passwords are no longer the preferred flow.
- Tokens are stored hashed, single-use, and expiring; the plaintext onboarding token only exists in the email link.
- Contract activation is driven by lifecycle rules, not just generic status fields.
- Existing `status` columns were retained for compatibility, but `lifecycle_status` is the server-side source of truth for transitions.
- Built-in e-sign remains an in-app typed-signature + audit-trail implementation, not DocuSign/Adobe Sign.
- Email logic is abstracted behind a service interface; providers should stay dumb and contain no business rules.
- Contract content is treated as immutable after approval; changes should create a new contract version and invalidate old signatures.

## Known Issues / Bugs
- Backend runtime was not fully exercised against a live DB in this workspace yet; only syntax/build-level verification is complete.
- Frontend build passes, but Vite reports a large bundle warning for the main JS chunk.
- Backend install reported `2 high severity vulnerabilities`; no remediation has been applied yet.
- `docs/MIGRATION_CHECKLIST.md` still references the older invite/temp-password expectations and should be updated.
- Some legacy copy and labels still refer to older statuses like `pending_signatures` or older onboarding wording.
- There may still be screens outside the touched paths that assume the old `contract_signatures` table name.

## Next Recommended Steps
1. Apply migrations `003` then `004` in a non-prod Oracle environment.
2. Start backend/frontend and execute the full manual QA flow for approval, onboarding, signing, resend, and termination.
3. Update any remaining docs/UI copy that still mentions temp passwords or old signature table names.
4. If runtime is clean, decide whether to:
   - push this branch as the new lifecycle baseline, or
   - do one more cleanup commit for docs, bundle size, and dependency vulnerabilities.
