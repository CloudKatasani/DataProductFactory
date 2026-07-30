# Data Product Factory (DPF)

A locally hosted web application that takes a team through the full lifecycle of
designing, building, certifying and operating a **data product**, with a
**human review-and-approval gate at every stage**. Industry specifics live in
declarative `packs/`, never in application code.

The binding project rules are in [`CLAUDE.md`](./CLAUDE.md). This README is the
operational quick-start.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Prisma (SQLite default)
· Zod · Auth.js (credentials) · Tailwind v4 · Vitest + Playwright.

## Getting started

```bash
pnpm install
cp .env.example .env          # then set AUTH_SECRET: openssl rand -base64 32
pnpm db:push                  # sync the SQLite schema
pnpm db:seed                  # users, roles, and the demo product
pnpm dev                      # http://localhost:3000
```

Sign in with any seeded user — `owner@dpf.local`, `consumer@dpf.local`,
`architect@dpf.local`, `steward@dpf.local`, `privacy@dpf.local`, … — all sharing
the dev password `dpf-local-dev`.

## What works today (stage-1 vertical slice)

The consumption-first loop is implemented end-to-end and enforces the
non-negotiables in code and tests:

- **Stage 1 — Consumption Discovery**: author blocked decisions (persona,
  decision, cadence, consequence), commit a versioned, hashed, file-mirrored
  `DECISION_REGISTER`, watch the exit-criteria checklist, and submit for review.
- **Gating**: a stage cannot enter review until its exit criteria pass, and a
  gate closes only when every required approver has approved the exact artifact
  hash under review. The Privacy/Security Officer holds a veto on stage 9.
- **The single approval path**: `approveGate` is the only code that writes
  `APPROVED`; a source-scanning test fails if any other write site appears.
- **Cascade invalidation**: editing an approved upstream artifact moves
  downstream gates `APPROVED → STALE` and records a re-approval reason.
- **Provenance**: every artifact version records `AI_DRAFT` / `HUMAN_AUTHORED` /
  `HUMAN_REVIEWED`, shown as a badge. The assistant can never approve anything.

Stages 2–12 exist in the registry with gates and exit criteria; their authoring
UIs are the next slices.

## Routes

Routes are workspace-scoped so a product slug is unambiguous across workspaces
(product slugs are unique per workspace, not globally):

| Route | Purpose |
|-------|---------|
| `/login` | Credentials sign-in |
| `/workspace` | Workspace list |
| `/workspace/[slug]` | Products in a workspace |
| `/workspace/[slug]/product/[productSlug]` | The 13-stage gate board |
| `/workspace/[slug]/product/[productSlug]/stage/[n]` | Stage detail: author, commit, review, approve |
| `/review` | Cross-product review queue |

## Verifying

```bash
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest: unit + real-SQLite integration
pnpm test:e2e     # playwright: the stage-1 gate flow in a browser
pnpm build        # production build
pnpm pack:validate
```

The Vitest integration suite spins up a throwaway `test.db` from the live schema
and exercises the governance write paths with no mocks. The Playwright suite is
hermetic (its own `e2e.db` and mirror root). On CI images that ship a browser,
set `PLAYWRIGHT_CHROMIUM_PATH` to its executable.
