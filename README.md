# Zoro Capital Platform

Full-stack **asset finance / leasing** workspace for originators, administrators, and end customers. The live product UI is branded as **Zoro Capital** in configuration; product planning wireframes use the **Ricoh Capital** name.

---

## Quick links

| Resource | Description |
|----------|-------------|
| [**Interactive wireframe (in README)**](#interactive-wireframe-map) | Same 22 + 3 screens — **expand/collapse below** (no JavaScript; works on GitHub). |
| [**Styled wireframe (HTML)**](ricoh_page_requirements.html) | Card layout + animations — open locally in a browser (clone repo, open file). |
| [App source](ricoh-capital/) | React + Vite SPA (`ricoh-capital/`) |
| [Oracle migration runbook](ricoh-capital/docs/ORACLE_MIGRATION_RUNBOOK.md) | Provision Oracle ADB, OCI, and backend services |

---

## Table of contents

- [Interactive wireframe map](#interactive-wireframe-map)
- [Architecture](#architecture)
- [Features by role](#features-by-role)
- [Wireframe → routes](#wireframe--routes)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database & backend](#database--backend)
- [Project layout](#project-layout)
- [Scripts](#scripts)

---

## Interactive wireframe map

README files on GitHub (and similar hosts) **do not run JavaScript**, so [ricoh_page_requirements.html](ricoh_page_requirements.html) cannot execute inline in this page. The sections below mirror that document with native **`<details>` / `<summary>`** — click a row to expand requirements. For the full visual card grid, open the HTML file in your browser after cloning.

<details>
<summary><strong>At a glance — 22 screens · 6 feature areas</strong></summary>

| Bucket | Screens | Notes |
|--------|---------|--------|
| Customer experience | P01–P17 | Onboarding, deals, portfolio, self-service |
| Lead &amp; opportunity | P18–P22 | Prospects, quotes |
| Shared / global | S01–S03 | Shell, empty/error, toasts |

*Build shared patterns (S01–S03) first — other screens depend on the navigation shell.*

</details>

<details>
<summary><strong>1 · Rapid Originator Onboarding</strong> — 5 pages (customer experience)</summary>

<details>
<summary><code>P01</code> Registration form — company &amp; contact details</summary>

*First step of originator onboarding*

- Company name, reg. number, address — `fields`
- Primary contact + role — `fields`
- Product line selection — `dropdown`
- Terms acceptance — `checkbox`
- Save &amp; continue CTA — `button`

</details>

<details>
<summary><code>P02</code> Document upload — KYC / compliance files</summary>

*KYC &amp; compliance file submission*

- Required docs checklist — `list`
- Drag &amp; drop upload zones — `upload`
- File type / size validation — `inline`
- Upload progress indicators — `state`
- Back / submit for review CTA — `button`

</details>

<details>
<summary><code>P03</code> Verification status — automated check progress</summary>

*Real-time compliance check progress*

- Step tracker (submitted → checking → approved) — `stepper`
- Per-document check results — `list`
- Estimated completion time — `info`
- Resubmit link if failed — `action`

</details>

<details>
<summary><code>P04</code> Admin review queue — approve / reject / request info</summary>

*Internal admin-facing queue*

- Queue list with status filters — `table`
- Originator detail drawer — `panel`
- Approve / Reject / Request info actions — `buttons`
- Notes / reason field — `textarea`
- Audit trail — `log`

</details>

<details>
<summary><code>P05</code> Welcome &amp; activation — credentials + portal tour</summary>

*Successful onboarding confirmation*

- Welcome message + logo — `header`
- Login credentials display — `info`
- Portal feature highlights — `cards`
- First steps checklist — `todo`
- Enter portal CTA — `button`

</details>

</details>

<details>
<summary><strong>2 · Quick Deal Capture</strong> — 4 pages (customer experience)</summary>

<details>
<summary><code>P06</code> Deal initiation — customer + product select</summary>

*Start point of a new deal*

- Customer search / select — `autocomplete`
- Product type dropdown — `dropdown`
- Originator reference field — `field`
- Draft save option — `link`

</details>

<details>
<summary><code>P07</code> Asset &amp; financial details — type, value, term, rates</summary>

*Core deal structuring screen*

- Asset type, make, model, value — `fields`
- Term, deposit, balloon — `fields`
- Rate type (fixed / variable) — `toggle`
- Live payment calculation — `computed`

</details>

<details>
<summary><code>P08</code> Deal review &amp; submit — summary + confirm</summary>

*Final check before submission*

- Full deal summary card — `readonly`
- Edit section links — `links`
- Declaration checkbox — `checkbox`
- Submit to credit CTA — `button`

</details>

<details>
<summary><code>P09</code> Submission confirmation — ref number + status</summary>

*Post-submit success state*

- Reference number prominent — `hero`
- Expected SLA / next steps — `info`
- Track deal link — `link`
- Submit another deal CTA — `button`

</details>

</details>

<details>
<summary><strong>3 · Configurable Live Asset Portfolio</strong> — 4 pages (customer experience)</summary>

<details>
<summary><code>P10</code> Portfolio dashboard — all contracts, KPIs, filters</summary>

*Live view of all customer assets*

- Summary KPI row (active, value, overdue) — `metric cards`
- Filterable data table — `table`
- Status badges per row — `badges`
- Quick actions per row — `dropdown`

</details>

<details>
<summary><code>P11</code> View configurator — columns, sort, save view</summary>

*Customise table columns &amp; sorting*

- Column visibility toggles — `checkboxes`
- Sort order drag handles — `drag`
- Save named view CTA — `button`
- Saved views list — `list`

</details>

<details>
<summary><code>P12</code> Asset detail — contract, payments, docs</summary>

*Deep dive into a single contract*

- Contract header (ID, status, customer) — `header`
- Payment schedule table — `table`
- Documents tab — `tab`
- Activity / notes tab — `tab`

</details>

<details>
<summary><code>P13</code> Export &amp; reports — CSV / scheduled reports</summary>

*Data export &amp; scheduled reporting*

- Export format select (CSV, XLSX) — `radio`
- Field selection — `checkboxes`
- Schedule recurring report — `toggle`
- Download / email CTA — `button`

</details>

</details>

<details>
<summary><strong>4 · Customer / Partner Self Service</strong> — 4 pages (customer experience)</summary>

<details>
<summary><code>P14</code> Self-service login — SSO or credentials</summary>

*Customer / partner portal entry*

- Email + password fields — `fields`
- SSO option — `button`
- Forgot password link — `link`
- Branding / trust mark — `layout`

</details>

<details>
<summary><code>P15</code> My dashboard — contracts, quotes, alerts</summary>

*Customer home screen*

- Active contracts summary — `cards`
- Upcoming payments — `list`
- Recent quotes — `list`
- Notification bell — `icon`

</details>

<details>
<summary><code>P16</code> Account actions — statements, service requests</summary>

*Self-service request centre*

- Download statement — `action`
- Request early settlement — `form`
- Request upgrade / variation — `form`
- Contact us link — `link`

</details>

<details>
<summary><code>P17</code> Notifications centre — alerts, payments due</summary>

*All system alerts in one place*

- Notification list with type icons — `list`
- Read / unread state — `state`
- Mark all read action — `button`
- Deep-link to related record — `link`

</details>

</details>

<details>
<summary><strong>5 · Prospect / Customer Management</strong> — 3 pages (lead &amp; opp.)</summary>

<details>
<summary><code>P18</code> Prospect list — search, filter, pipeline stage</summary>

*CRM-style prospect management table*

- Searchable table with stage filter — `table`
- Pipeline stage pills — `badges`
- Assign to user — `dropdown`
- Create new prospect CTA — `button`

</details>

<details>
<summary><code>P19</code> Prospect profile — contacts, notes, activity</summary>

*360 view of a single prospect*

- Company header + key fields — `header`
- Contacts list — `list`
- Activity timeline — `timeline`
- Log call / email / note — `buttons`

</details>

<details>
<summary><code>P20</code> Qualify / convert — stage, score, link account</summary>

*Move prospect to opportunity or customer*

- Qualification score inputs — `fields`
- Stage dropdown — `dropdown`
- Convert to customer modal — `modal`
- Link to deal / account — `autocomplete`

</details>

</details>

<details>
<summary><strong>6 · Quick Quote Generation</strong> — 2 pages (lead &amp; opp.)</summary>

<details>
<summary><code>P21</code> Quote builder — asset, term, rate, live calc</summary>

*Interactive quote creation tool*

- Customer + asset select — `autocomplete`
- Term, deposit, rate type inputs — `fields`
- Live monthly payment calc — `computed`
- Multiple scenario tabs — `tabs`
- Generate quote CTA — `button`

</details>

<details>
<summary><code>P22</code> Quote output — PDF preview, send, eSign</summary>

*Final quote delivery &amp; actions*

- Branded PDF preview pane — `iframe`
- Send by email / shareable link — `button`
- Save &amp; link to opportunity — `button`
- eSign initiation option — `button`
- Edit quote link — `link`

</details>

</details>

<details>
<summary><strong>7 · Shared / global patterns</strong> — S01–S03</summary>

<details>
<summary><code>S01</code> Global navigation — sidebar + top bar shell</summary>

*The wrapper for every logged-in page*

- Left sidebar with nav items — `nav`
- Top bar with user menu — `header`
- Breadcrumb pattern — `breadcrumb`
- Active state per feature — `state`

</details>

<details>
<summary><code>S02</code> Empty / error states — zero data, 404, forbidden</summary>

*Graceful handling of edge cases*

- Empty list state (no results) — `state`
- API error state — `state`
- 403 / 404 page — `state`
- Retry / back actions — `button`

</details>

<details>
<summary><code>S03</code> Notifications &amp; toasts — success, warning, error</summary>

*System feedback patterns*

- Success toast (green) — `toast`
- Warning toast (amber) — `toast`
- Error toast (red) — `toast`
- Persistent alert banner — `banner`

</details>

</details>

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  React SPA  (Vite · React Router · TanStack Query│   │
│  │             Zustand · React Hook Form · Zod)     │   │
│  └───────┬──────────┬──────────┬──────────┬─────────┘   │
└──────────│──────────│──────────│──────────│─────────────┘
           │          │          │          │
     (auth)│    (data)│  (files) │ (invoke) │
           ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────┐
│  Backend API + Oracle stack                             │
│  ┌─────────────┐  ┌─────────────────────┐  ┌─────────┐  │
│  │ Auth/JWT    │  │ Oracle Autonomous DB│  │ OCI Obj │  │
│  └─────────────┘  └─────────────────────┘  │ Storage │  │
│                                            └─────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **Frontend:** React, React Router, TanStack Query, Zustand, React Hook Form + Zod, backend API client, Lucide icons.
- **Backend:** Express API with Oracle Autonomous DB, OCI Object Storage, JWT auth, and admin endpoints for privileged operations.

---

## Features by role

<details>
<summary><strong>Originator</strong> (approved users)</summary>

- **Onboarding:** registration, documents, verification, welcome (until admin approves).
- **Deals:** wizard (initiation → assets → review → confirmation), deal list and detail.
- **Portfolio:** dashboard, contract/asset detail, export.
- **CRM:** prospects list, profile, create/edit, qualify/convert.
- **Quotes:** list, builder, output.
- **Notifications** and **settings.**

</details>

<details>
<summary><strong>Admin</strong></summary>

- Dashboard, originator **review queue**, **deal queue**, **audit log**, **user management** (including manual payment-status refresh when cron is not used).

</details>

<details>
<summary><strong>Customer</strong> (portal)</summary>

- Portal **dashboard**, **contract detail**, **account actions**, **notifications** (invited when a deal is approved — see Edge Functions doc).

</details>

<details>
<summary><strong>Public</strong></summary>

- Login, signup, forgot password; deactivated account page.

</details>

---

## Wireframe → routes

Screen IDs **P01–P22** and **S01–S03** are defined in the [interactive wireframe map](#interactive-wireframe-map) above and in [ricoh_page_requirements.html](ricoh_page_requirements.html). Below is how they map to the React app (`ricoh-capital/src/App.jsx`).

<details>
<summary><strong>P01–P05 — Rapid originator onboarding &amp; admin review</strong></summary>

| Wireframe | Route |
|-----------|--------|
| P01 Registration | `/onboarding/registration` |
| P02 Document upload | `/onboarding/documents` |
| P03 Verification | `/onboarding/verification` |
| P04 Admin review | `/admin/review` |
| P05 Welcome | `/onboarding/welcome` |

</details>

<details>
<summary><strong>P06–P09 — Quick deal capture</strong></summary>

| Wireframe | Route |
|-----------|--------|
| P06 Deal initiation | `/deals/new` |
| P07 Asset & financial details | `/deals/assets` |
| P08 Review & submit | `/deals/review` |
| P09 Confirmation | `/deals/confirmation` |

Also: `/deals` (list), `/deals/:id` (detail).

</details>

<details>
<summary><strong>P10–P13 — Portfolio</strong></summary>

| Wireframe | Route / note |
|-----------|----------------|
| P10 Portfolio dashboard | `/portfolio` |
| P11 View configurator | Column/view behaviour may live on the dashboard (check UI). |
| P12 Asset detail | `/portfolio/:id` (originator/admin); `/portal/contracts/:id` (customer) |
| P13 Export | `/portfolio/export` |

</details>

<details>
<summary><strong>P14–P17 — Self-service &amp; notifications</strong></summary>

| Wireframe | Route / note |
|-----------|----------------|
| P14 Self-service login | `/login` (shared auth) |
| P15 My dashboard | `/portal/dashboard` |
| P16 Account actions | `/portal/account` |
| P17 Notifications | `/notifications` (originator/admin); `/portal/notifications` (customer) |

</details>

<details>
<summary><strong>P18–P22 — CRM &amp; quotes</strong></summary>

| Wireframe | Route |
|-----------|--------|
| P18 Prospect list | `/crm` |
| P19 Prospect profile | `/crm/:id` |
| P20 Qualify / convert | `/crm/:id/convert` |
| P21 Quote builder | `/quotes/new` |
| P22 Quote output | `/quotes/:id` |

Prospect create/edit: `/crm/new`, `/crm/:id/edit`.

</details>

<details>
<summary><strong>S01–S03 — Shared shell &amp; UX</strong></summary>

| Wireframe | Implementation |
|-----------|----------------|
| S01 Global navigation | `AppShell`, left/top nav |
| S02 Empty / error | e.g. `NotFoundPage`, list empty states in feature pages |
| S03 Toasts / notifications | shared toast + notification pages |

</details>

**Additional admin routes:** `/admin`, `/admin/deals`, `/admin/audit`, `/admin/users`  
**Settings (all authenticated roles):** `/settings`

---

## Getting started

Prerequisites: **Node.js 18+**, **npm**, Oracle Autonomous DB access, and OCI Object Storage access.

```bash
cd ricoh-capital
cp .env.example .env
# Edit .env: set VITE_API_BASE_URL
npm install
npm run dev
```

The dev server defaults to **http://localhost:5173** (Vite). Set `VITE_APP_URL` in `.env` to match.

---

## Environment variables

Copy from [`ricoh-capital/.env.example`](ricoh-capital/.env.example):

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend API base URL |
| `VITE_APP_NAME` | Display name (default example: Zoro Capital) |
| `VITE_APP_URL` | App base URL (e.g. production domain or `http://localhost:5173`) |

Never expose backend secrets in `VITE_*` variables. Store database/OCI/JWT credentials in backend environment variables only.

---

## Database & backend

1. Apply Oracle schema migration at [`ricoh-capital/backend/db/migrations/001_oracle_schema.sql`](ricoh-capital/backend/db/migrations/001_oracle_schema.sql).
2. Configure backend environment using [`ricoh-capital/backend/.env.example`](ricoh-capital/backend/.env.example).
3. Follow [`ricoh-capital/docs/ORACLE_MIGRATION_RUNBOOK.md`](ricoh-capital/docs/ORACLE_MIGRATION_RUNBOOK.md) for bring-up and cutover.

---

## Project layout

```
Ricoh/
├── README.md                      ← You are here
├── ricoh_page_requirements.html   ← Styled wireframe (open in browser); README has expand/collapse version
├── ricoh_capital_demo.html        ← Demo / marketing HTML (if present)
└── ricoh-capital/
    ├── src/                       ← React app (pages, hooks, auth, components)
    ├── backend/
    │   ├── db/migrations/         ← Oracle schema migration(s)
    │   └── src/                   ← API routes, auth, Oracle, OCI integration
    ├── index.html
    ├── package.json
    ├── .env.example
    └── docs/ORACLE_MIGRATION_RUNBOOK.md
```

---

## Scripts

Run from `ricoh-capital/`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck (`tsc`) and production build |
| `npm run preview` | Preview production build locally |

---

## License

Private / internal — not licensed for public distribution unless otherwise stated by the repository owner.
