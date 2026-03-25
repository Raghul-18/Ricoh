# Ricoh/Zoro Capital — One-Page Executive Summary

## What this platform is

Ricoh/Zoro Capital is a digital asset-finance platform that connects three user groups in one system:

- **Originators** submit and manage finance deals.
- **Admins** govern onboarding, approvals, risk controls, and operations.
- **Customers** self-serve contract and payment information through a portal.

The platform reduces deal turnaround time, improves compliance traceability, and provides live portfolio visibility.

## Business outcomes

- **Faster onboarding and deal processing** through guided workflows (P01–P09).
- **Better control and compliance** via role-based access, RLS, and audit logs.
- **Higher operational efficiency** through status automation (payments/contracts/quotes).
- **Improved customer experience** with portal access, notifications, and self-service.

## Scope delivered in the current implementation

- Identity and role-based access (originator/admin/customer/public).
- Originator onboarding, document handling, and admin review queue.
- Deal capture workflow, review process, and contract servicing views.
- CRM prospects and quote generation workflows.
- Notifications, auditability, and operational refresh jobs.

## Architecture at a glance

```mermaid
flowchart LR
  users[Originator_Admin_Customer] --> web[ReactSPA_Vite]
  web -->|JWT + REST API| api[BackendAPI]

  subgraph backend [Backend]
    auth[JWTAuth]
    db[OracleADB]
    storage[OCIObjectStorage]
    edge[AdminEndpoints]
  end

  web --> api
  api --> auth
  api --> db
  api --> storage
  api --> edge
```

## Data architecture (executive view)

Core domains:

- **Identity**: `profiles`
- **Onboarding**: `originator_applications`, `originator_documents`, `verification_checks`
- **Deal servicing**: `deals`, `contracts`, `payment_schedule`
- **Growth pipeline**: `prospects`, `prospect_activities`, `quotes`
- **Control plane**: `notifications`, `audit_logs`

These entities enforce clear data ownership (originator/customer/admin) and policy-driven visibility.

## Security and governance

- Backend JWT auth for identity.
- API-layer authorization on domain operations to enforce least-privilege access.
- Admin endpoints for privileged operations (user invites, bulk status updates).
- Audit logging for traceability and operational accountability.

## Lifecycle and operating model

```mermaid
flowchart LR
  req[Requirements] --> design[Design]
  design --> build[Build]
  build --> test[Test]
  test --> release[Release]
  release --> operate[Operate]
  operate --> improve[Improve]
  improve --> req
```

The delivery lifecycle is iterative and supports controlled releases, post-release monitoring, and continuous improvement.

## Immediate strategic next steps

- Formalize KPI dashboard (SLA to approve, conversion rates, delinquency trends).
- Add automated test coverage for critical authorization and admin endpoint paths.
- Expand integrations (credit checks, payments, eSign) where business-ready.

---

For full technical specification, see `docs/PROJECT_SPEC.md`.

