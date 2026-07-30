# Running Data Product Factory locally

A step-by-step guide to run DPF on your own machine and open the UI at
`http://localhost:3000`. It is a standard local-first Next.js app backed by a
zero-config SQLite file — no database server to install.

> The application lives in the **`ClaudeCode/`** subfolder of the repository.
> Every command below is run from inside `DataProductFactory/ClaudeCode`.

---

## 1. Prerequisites

| Tool | Version | Check | Install |
|------|---------|-------|---------|
| **Node.js** | 20 or newer | `node -v` | <https://nodejs.org> (LTS) |
| **pnpm** | 9 or 10 | `pnpm -v` | `npm install -g pnpm` |
| **Git** | any | `git -v` | <https://git-scm.com> |

**Database:** nothing to install. DPF uses **SQLite by default** — a single local
file (`prisma/dev.db`) created automatically in step 4. Postgres is optional and
only needed for multi-user setups (see `docker-compose.yml`); ignore it for local
use.

---

## 2. Get the code

```bash
git clone https://github.com/CloudKatasani/DataProductFactory.git
cd DataProductFactory/ClaudeCode
```

The `main` branch has the full app — no branch switching needed.

## 3. Install dependencies

```bash
pnpm install
```

## 4. Create your environment file

DPF needs a database location and an auth secret. Copy the template:

```bash
cp .env.example .env
```

Then generate a real `AUTH_SECRET` and append it to `.env`:

- **macOS / Linux:**
  ```bash
  echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env
  ```
- **Windows (PowerShell):**
  ```powershell
  "AUTH_SECRET=""$([Convert]::ToBase64String((1..32|%{Get-Random -Max 256})))""" | Add-Content .env
  ```

Your `.env` should contain (the `DATABASE_URL` comes from the template):

```ini
DATABASE_URL="file:./dev.db"
AUTH_SECRET="<the value you just generated>"
AUTH_TRUST_HOST="true"
```

> `.env` is gitignored and never committed. No secrets live in the repo.

## 5. Set up the database

```bash
pnpm db:push     # creates dev.db and the tables from the Prisma schema
pnpm db:seed     # seeds users, roles, the utility-pack workspace, and a demo product
```

Expected output ends with:
`All seed users share the password: dpf-local-dev`.

## 6. Run the app

```bash
pnpm dev
```

Open **<http://localhost:3000>**.

---

## Signing in

All seeded users share the password **`dpf-local-dev`**. Choose the role you want
to act as:

| Email | Role | Use it to… |
|-------|------|------------|
| `admin@dpf.local` | Platform Admin | **Create products** (Stage 0 setup + approval) |
| `owner@dpf.local` | Product Owner | Author Stage 1 & 2; approve gates |
| `consumer@dpf.local` | Consumer Rep | Second approver on Stage 1 |
| `architect@dpf.local` | Domain Architect | Second approver on Stage 2 |
| `steward@dpf.local` | Data Steward | Approver on Stages 5, 8, 9, 11 |
| `privacy@dpf.local` | Privacy/Security Officer | Veto approver on Stage 9 |
| `engineer@dpf.local` | Platform Engineer | Approver on Stages 3, 7, 8 |
| `sme@dpf.local` | Domain SME | Approver on Stages 3, 4, 5 |

### A first walkthrough

1. Sign in as **`owner@dpf.local`** → **Demo Workspace → Outage Response → Stage 1**.
2. Add a complete decision record → **Commit decision register** → **Submit for
   review** → **Approve**.
3. Sign out; sign in as **`consumer@dpf.local`**; open Stage 1 → **Approve**. The
   gate closes and **Stage 2 unlocks**.
4. On Stage 2, author the charter → commit → submit → approve as `owner@` and
   `architect@` → **Stage 3 unlocks**.
5. To create a product: sign in as **`admin@dpf.local`** → open a workspace →
   **New product** → approve the Stage 0 setup it lands you on.

---

## Verifying the build (optional)

```bash
pnpm typecheck   # TypeScript, no errors
pnpm lint        # ESLint
pnpm test        # unit + integration tests (real SQLite, no mocks)
pnpm build       # production build
pnpm pack:validate  # validate the industry packs
```

End-to-end browser tests need Chromium once:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **Port 3000 in use** | `pnpm dev --port 3001`, then open `:3001` |
| **Prisma / client errors** | Re-run `pnpm db:push` (it regenerates the client) |
| **"Cannot find module" / wrong folder** | Ensure you are in `DataProductFactory/ClaudeCode`, not the repo root |
| **Want a clean database** | Delete `prisma/dev.db`, then `pnpm db:push && pnpm db:seed` |
| **Node too old** | Install Node 20+ (`node -v` to check) |

Use **`pnpm dev`** for local viewing. Everything runs offline — no network or
external services are required.
