# Setup and Run — Zoro Capital (Ricoh Capital)

This guide walks through provisioning **Oracle Autonomous Database**, **OCI Object Storage**, configuring **backend** and **frontend** environment variables, and running the app locally on Windows (paths use PowerShell-style examples).

---

## What you are starting

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite (`ricoh-capital/`) |
| Backend | Node.js + Express (`ricoh-capital/backend/`) |
| Database | Oracle Autonomous Database |
| Files | OCI Object Storage (buckets `documents`, `contracts`) |

---

## Prerequisites

- **Node.js 18+** and **npm**
- **Oracle Cloud** account with:
  - An **Autonomous Database** instance (or equivalent Oracle DB with connectivity details)
  - **Object Storage** access
- Optional on Windows: **Oracle Instant Client** if the `oracledb` driver fails to connect (see [node-oracledb installation](https://node-oracledb.readthedocs.io/en/latest/user_guide/installation.html))

---

## Part A — Oracle Autonomous Database

### A1) Create or use an ADB instance

1. In OCI Console: **Oracle Database → Autonomous Database**.
2. Create an instance (or use existing). Note:
   - Admin user and password
   - Connection string / service name (from **DB Connection** in console)

### A2) Download wallet (TLS, typical for ADB)

1. On the ADB detail page: **Database actions → Download wallet**.
2. Unzip to a folder on your machine, e.g. `C:\oracle\wallet\adb_wallet\`
3. Set **`ORACLE_WALLET_DIR`** in backend `.env` to that folder (the directory containing `tnsnames.ora`, `sqlnet.ora`, etc.).

### A3) Run schema migration

1. Open **SQL Developer**, **SQLcl**, or **Database actions → SQL** for your ADB.
2. Run the script:

   `ricoh-capital/backend/db/migrations/001_oracle_schema.sql`

3. Confirm tables exist (e.g. `users`, `originator_applications`, `originator_documents`, …).

### A4) Backend Oracle env vars (reference)

| Variable | Purpose |
|----------|---------|
| `ORACLE_USER` | DB user (e.g. `ADMIN` or app schema user) |
| `ORACLE_PASSWORD` | Password |
| `ORACLE_CONNECT_STRING` | Connect descriptor / service name (often matches alias in `tnsnames.ora` when using wallet) |
| `ORACLE_WALLET_DIR` | Folder path to unzipped wallet (often required for ADB) |

---

## Part B — OCI Object Storage

### B1) Compartment and namespace

1. **Identity & Security → Compartments**: create or pick a compartment (e.g. `ricoh-capital-dev`).
2. **Storage → Object Storage**: note your **Object Storage namespace** (top of the page or tenancy info).

### B2) Create buckets

1. In Object Storage, same compartment:
   - Create a **documents** bucket (console name can be anything, e.g. *oci tech squad* — the value you put in `.env` must be the **API bucket name** shown in OCI, which may differ slightly from the display label)
   - Optionally create a separate **contracts** bucket, or reuse one bucket for both if your policy allows
2. Keep buckets **private** unless you intentionally publish assets.

Bucket API names map to `OCI_BUCKET_DOCUMENTS` and `OCI_BUCKET_CONTRACTS`. To mimic a console “folder” (e.g. everything under **`Ricoh/`**), set the prefix variables in **B5** — Object Storage has no real subfolders; the prefix is part of the object key.

### B3) API key for the backend SDK

The backend uses `oci-sdk` with a **user API key**:

1. **Identity & Security → Users** → open the user the backend will use (dedicated service user recommended).
2. **API Keys → Add API Key** → generate or upload key pair.
3. Save:
   - **Private key** (`.pem`) on disk — **never commit it**
   - **Fingerprint** from the console
4. Copy **User OCID** and **Tenancy OCID** from the user and tenancy profile pages.

### B4) IAM policy

Put the user in a group (e.g. `ricoh-capital-backend`). Add a policy (tenancy or compartment level) such as:

```text
Allow group ricoh-capital-backend to manage object-family in compartment <YOUR_COMPARTMENT_NAME>
```

Narrow policies further in production (specific buckets/compartments).

### B5) Backend OCI env vars (reference)

| Variable | Purpose |
|----------|---------|
| `OCI_REGION` | Region identifier, e.g. `uk-london-1` |
| `OCI_TENANCY_ID` | Tenancy OCID |
| `OCI_USER_ID` | User OCID |
| `OCI_FINGERPRINT` | API key fingerprint |
| `OCI_PRIVATE_KEY_PATH` | Absolute path to `.pem`, e.g. `C:/Users/you/keys/oci_api_key.pem` |
| `OCI_PASSPHRASE` | Only if the private key is encrypted |
| `OCI_NAMESPACE` | Object Storage namespace |
| `OCI_BUCKET_DOCUMENTS` | API bucket name for uploaded files |
| `OCI_BUCKET_CONTRACTS` | API bucket name for contract objects (if used) |
| `OCI_DOCUMENTS_PREFIX` | Optional key prefix, e.g. `Ricoh` or `Ricoh/` (normalized to end with `/`) |
| `OCI_CONTRACTS_PREFIX` | Optional prefix for contract keys (same rules); wire uploads to this when you add contract flows |

---

## Part C — JWT and CORS (backend)

The backend **requires** both secrets at startup (`backend/src/config/env.js`). If either is missing, the process exits.

**`JWT_ACCESS_SECRET`** and **`JWT_REFRESH_SECRET`** must be:

- **Different values** — never use the same string for both; if one key leaks, the other token class stays valid.
- **Long and random** — treat them like passwords (32+ bytes of entropy is a reasonable minimum); not dictionary words or short strings.
- **Stable per environment** — changing a secret **invalidates** all already-issued tokens signed with the old key (users must sign in again).

The **access** secret signs short-lived API **access** JWTs. The **refresh** secret signs longer-lived **refresh** tokens stored server-side (or validated on refresh). Some features (e.g. signing short-lived read URLs) may also use the access secret — keep it as confidential as the refresh secret.

Generate examples (run locally, then paste into `.env`):

```powershell
# OpenSSL (if installed)
openssl rand -base64 48

# Node
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

| Variable | Purpose |
|----------|---------|
| `JWT_ACCESS_SECRET` | Signs access tokens (and related short-lived signatures) |
| `JWT_REFRESH_SECRET` | Signs refresh tokens only |
| `JWT_ACCESS_TTL` | e.g. `15m` |
| `JWT_REFRESH_TTL` | e.g. `7d` |
| `FRONTEND_ORIGIN` | CORS origin, e.g. `http://localhost:5173` |
| `PORT` | API port, default `4000` |

---

## Part D — Configure and run the backend

From the repository root, use the `ricoh-capital` app directory.

### D1) Install and env

```powershell
cd c:\Users\RAGHUL\Documents\Projo\Lender\ricoh-capital\backend
copy .env.example .env
```

Edit **`backend/.env`** and fill **every** required variable (empty values cause startup to fail — see `backend/src/config/env.js`).

### D2) Install dependencies and start

```powershell
npm install
npm run dev
```

### D3) Health check

Open a browser or use curl:

`http://localhost:4000/health`

Expected: `{"ok":true}`

---

## Part E — Configure and run the frontend

Open a **second** terminal:

```powershell
cd c:\Users\RAGHUL\Documents\Projo\Lender\ricoh-capital
copy .env.example .env
```

Ensure **`VITE_API_BASE_URL`** matches your API, e.g.:

`VITE_API_BASE_URL=http://localhost:4000/api`

### Install and dev server

```powershell
npm install
npm run dev
```

Open **http://localhost:5173** (default Vite port).

### Optional: start backend from frontend folder

From `ricoh-capital/`:

```powershell
npm run backend:dev
```

---

## Part F — Quick verification checklist

- [ ] ADB: schema script applied without errors
- [ ] Backend: `/health` returns OK
- [ ] Sign up / sign in creates or loads user (Oracle `users` table)
- [ ] Document upload stores object in the configured bucket (under `OCI_DOCUMENTS_PREFIX` if set) and `originator_documents.file_path` is set
- [ ] Document preview/download works (signed read path through API)

---

## Part G — Production-style build (optional)

**Frontend:**

```powershell
cd ricoh-capital
npm run build
npm run preview
```

**Backend:**

```powershell
cd ricoh-capital\backend
npm run start
```

Host `dist/` on your static CDN; place the API behind HTTPS and set `FRONTEND_ORIGIN` to your real app URL.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Backend exits on “Missing required env var” | Incomplete `backend/.env` |
| Oracle connection errors | Wrong `ORACLE_CONNECT_STRING`, wallet path, or Instant Client not installed |
| OCI 401 / NotAuthenticated | Wrong OCIDs, fingerprint, or private key path |
| OCI 403 | IAM policy missing for Object Storage on user/group |
| OCI 404 on bucket | Wrong region, namespace, or bucket name |
| CORS errors in browser | `FRONTEND_ORIGIN` must match exact frontend URL (scheme + host + port) |

---

## Related docs

- [Oracle migration runbook](./ORACLE_MIGRATION_RUNBOOK.md)
- [Migration checklist](./MIGRATION_CHECKLIST.md)
