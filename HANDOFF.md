# Handoff

## Current Feature / Goal
- Stabilize the deal/contract lifecycle after the recent multilingual changes.
- Fix the issues captured in `CRITICAL.docx`, especially security/data-integrity problems.
- Add dynamic deal capture by product family, approval-time customer temp credentials, built-in two-party e-sign, and contract closure/termination flows.

## What Has Been Completed
- Added backend schema migration for lifecycle/security work:
  - `ricoh-capital/backend/db/migrations/003_deal_contract_security_and_lifecycle.sql`
- Hardened backend auth/query behavior:
  - refresh token now reloads `email`/`role`
  - password update validates complexity server-side
  - signed URL verification uses timing-safe comparison
  - `/api/query` now applies role/table constraints and blocks empty-filter deletes
- Added explicit backend lifecycle routes/services:
  - transactional admin approval
  - contract signing
  - closure request submission/review
  - direct admin termination
- Refactored deal wizard to use product-family payloads and dynamic forms.
- Added admin approval result page showing temp password once.
- Added in-app signature UI and closure flows on contract/account pages.
- Fixed several regressions from the document:
  - login redirect
  - approved-user redirect target
  - mobile nav close
  - quote balloon math
  - CSV formula sanitization
  - spinner visibility
  - onboarding subscription leak
  - banner dismissal persistence
  - duplicate prospect activity hook cleanup
  - removed stale `src/main.ts`

## What Is In Progress
- Integration verification across the full frontend/backend stack.
- Confirming all legacy screens still behave correctly after the deal store/schema refactor.
- Validating runtime behavior against actual installed dependencies and DB state.

## Pending Tasks
- Install frontend/backend dependencies and update lockfiles if needed.
- Run:
  - `npm.cmd install`
  - `npm.cmd --prefix backend install`
  - `npm.cmd run build`
  - backend start + manual smoke tests
- Apply migration `003_deal_contract_security_and_lifecycle.sql` to the target Oracle schema.
- Manually test:
  - one deal per product family
  - admin approval -> temp password page
  - admin + customer signature flow
  - customer closure request + admin approval/decline
  - direct admin termination
  - originator data isolation
- Review remaining hardcoded English/translation gaps in newer pages.
- Check whether any UI still assumes older deal field names instead of `product_family` + `deal_payload`.

## Key Decisions / Assumptions
- Temp password is generated only after admin approval, not on initial deal submission.
- Built-in e-sign is in-app typed signature capture/audit trail, not a third-party provider.
- Product behavior is keyed by normalized `product_family`; `product_type` remains for display/reporting.
- Approval result page is admin-facing and intended to be the only plaintext temp-password reveal.
- Existing contract status values were kept broadly compatible; lifecycle detail is additionally stored in `lifecycle_status`.

## Known Issues / Bugs
- Full build was not completed locally because dependencies are missing in this workspace:
  - frontend build failed because `tsc` was unavailable before install
  - backend runtime failed before install because packages like `cors` were missing
- Because runtime verification was blocked, not every Word-doc fix is fully confirmed end-to-end yet.
- Some pages still contain hardcoded labels/copy and may need a translation cleanup pass.
- Breadcrumbs/top-nav labels were not fully revisited after the deal-step rename.
- `P22QuoteOutput.jsx` still uses legacy quote-to-deal prefill assumptions and should be re-verified after smoke testing.

## Next Recommended Steps
1. Install dependencies and run a clean build.
2. Apply migration `003`.
3. Execute the QA script for:
   - security/isolation
   - product-family deal creation
   - admin approval/temp pass
   - e-sign
   - closure/termination
4. Fix any runtime compile errors revealed by the first build, then do a second pass on translations and UI polish.
5. Only after verification, consider splitting follow-up cleanup into smaller commits (translations/polish vs lifecycle core).
