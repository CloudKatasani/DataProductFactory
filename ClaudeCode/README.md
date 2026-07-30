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

## What works today

The consumption-first loop is implemented end-to-end and enforces the
non-negotiables in code and tests:

- **Stage 0 — Workspace & Pack Setup**: a Platform Admin creates a product,
  which commits a `WORKSPACE_SETUP` (`workspace.yaml`) artifact and opens Stage 0
  for review. Approving it — through the ordinary gate, never a back door —
  unlocks Stage 1. Each workspace surfaces its active industry pack.
- **Stage 1 — Consumption Discovery**: author blocked decisions (persona,
  decision, cadence, consequence), commit a versioned, hashed, file-mirrored
  `DECISION_REGISTER`, watch the exit-criteria checklist, and submit for review.
- **Gating**: a stage cannot enter review until its exit criteria pass, and a
  gate closes only when every required approver has approved the exact artifact
  hash under review. The Privacy/Security Officer holds a veto on stage 9.
- **The single approval path**: `approveGate` is the only code that writes
  `APPROVED`; a source-scanning test fails if any other write site appears.
- **Manual or automated gates**: each gate is `MANUAL` (a human approves) or
  `AUTOMATED` (auto-approves the moment exit criteria pass). Automation is a
  governed act — only a member holding *every* required approver role may enable
  it, veto-role gates (Stage 9) can never be automated, and every auto-approval
  is attributed to that human and still flows through the one `approveGate`
  choke point. So both modes preserve "human-in-the-loop"; automation just
  records the human's standing pre-approval instead of a click.
- **Cascade invalidation**: editing an approved upstream artifact moves
  downstream gates `APPROVED → STALE` and records a re-approval reason.
- **Provenance**: every artifact version records `AI_DRAFT` / `HUMAN_AUTHORED` /
  `HUMAN_REVIEWED`, shown as a badge. The assistant can never approve anything.
- **Draft with agent** (optional, propose-only): each stage editor has a
  "Draft with agent" action that asks Claude for a schema-valid draft, validated
  against the same Zod schema manual authoring uses. The draft lands in the
  editor marked as an agent draft; a human reviews, edits, and commits it as
  their own work — nothing is persisted or approved by the agent. With no
  `DPF_LLM_API_KEY` set, the button reports assist is off and authoring stays
  fully manual (Non-Negotiables #3 and #6).

- **Control-plane catalog**: each workspace opens on a card catalog of its data
  products — classification (derived from the attribute register), archetype and
  tier tags, attribute/source/contract-field counts, grain and the charter's
  value hypothesis, all from committed state. An **Agent flow** view lays the
  lifecycle out as phases, marking each stage's gate (human / veto / automatable)
  and whether it has agent-assisted authoring.

Stages 2–5 have full authoring UIs; stages 6–12 exist in the registry with gates
and exit criteria, and their authoring UIs are the next slices.

## Routes

Routes are workspace-scoped so a product slug is unambiguous across workspaces
(product slugs are unique per workspace, not globally):

| Route | Purpose |
|-------|---------|
| `/login` | Credentials sign-in |
| `/workspace` | Workspace list |
| `/workspace/[slug]` | Control-plane catalog of the workspace's data products |
| `/workspace/[slug]/agent-flow` | Lifecycle phase board (gates, automation, agent assist) |
| `/workspace/[slug]/product/[productSlug]` | The 13-stage gate board |
| `/workspace/[slug]/product/[productSlug]/stage/[n]` | Stage detail: author, commit, review, approve |
| `/review` | Cross-product review queue (Requests) |

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
