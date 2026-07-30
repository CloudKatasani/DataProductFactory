# CLAUDE.md — Data Product Factory (DPF)

This file is binding. Read it fully before any change. If a request conflicts with the
Non-Negotiables below, stop and say so rather than working around them.

---

## 1. What this project is

**Data Product Factory (DPF)** is an enterprise-grade, **locally hosted** web application that
takes a team through the complete lifecycle of designing, building, certifying, and operating a
**data product** — with a **human review-and-approval gate at every stage**.

It is **industry-agnostic**. Industry specifics (domains, conformed backbones, regulatory
constraints, starter metrics) live in **declarative packs**, never in application code.

Two classes of user:
- **Practitioners** (data product owner, architect, engineer) who author artifacts.
- **Reviewers/approvers** (SME, steward, privacy officer, consumer representative) who gate them.

DPF produces durable, text-based, version-controlled artifacts — contracts, semantic models,
marketplace listings, grounding packs, evidence packs — not screenshots and slideware.

---

## 2. Non-Negotiables

These are enforced **in code and in tests**, not just in documentation. A feature that violates
one of these is a defect regardless of how well it works.

1. **Consumption-first.** A data product cannot exist without a named consumer and a blocked
   decision. Stage 2 (Charter) is hard-blocked until Stage 1 records at least one
   `DecisionRecord` with a named persona, the decision they cannot make today, the cadence, and
   the consequence of not making it. Pipelines, tools, and infrastructure are supporting detail
   and must never lead an artifact, a UI screen, or an export.

2. **Human-in-the-loop is structural, not advisory.** No stage advances without a recorded human
   approval. There is exactly one code path that can set a `Gate.status` to `APPROVED`, it
   requires an authenticated `User` with the required `Role`, and it is covered by a test that
   fails if any other path can reach that state. **The AI assistant can never approve anything.**

3. **AI is propose-only.** Every AI-generated artifact is persisted with
   `provenance = AI_DRAFT` and is visually marked as such in the UI. It can only become
   `HUMAN_AUTHORED` or `HUMAN_REVIEWED` through an explicit human edit or acceptance action.
   AI output is never written directly to an approved artifact version.

4. **Append-only audit.** `AuditEvent` is insert-only. Artifacts are versioned with a SHA-256
   content hash; versions are immutable. There are no hard deletes anywhere in the domain model —
   use `archivedAt`. Every approval records actor, role, timestamp, artifact version hash,
   decision, and comment.

5. **Cascade invalidation.** Editing an approved upstream artifact invalidates downstream gate
   approvals (`APPROVED → STALE`) and surfaces a re-approval task. Silent drift between an
   approved contract and its dependents is the failure mode this app exists to prevent.

6. **Local-first, offline-capable.** Core function must work with no network access. The LLM
   assist is optional, requires an explicit user-supplied key, and every screen must degrade
   gracefully to fully manual authoring when it is absent. No telemetry leaves the machine.

7. **Everything is text.** Every artifact serializes to YAML/JSON/Markdown under
   `workspace/<workspace-slug>/<product-slug>/`, written on every version commit, so the whole
   estate is Git-diffable. The database holds state and history; the filesystem holds truth you
   can review in a pull request.

8. **One metric, one definition.** Metric names are unique per workspace. A metric has exactly
   one certified definition, one owner, and one lineage path. Two metrics that mean the same
   thing is a validation error, not a naming discussion.

9. **No free-form text-to-SQL against raw tables.** Conversational grounding packs may only
   reference certified semantic-layer objects (metrics, dimensions, entities, allowed joins).
   The generator must reject any grounding artifact that names a physical Bronze/Silver table.

10. **Classification before access.** Every attribute carries a sensitivity classification and a
    PII/regulatory flag. Stage 9 (Access & Governance) cannot be gated until 100% of attributes
    in the register are classified.

11. **Industry logic lives in packs.** If you find yourself writing `if (industry === 'utility')`
    in `src/`, stop — that belongs in `packs/`.

12. **No secrets in the repo.** `.env.local` only, gitignored, `.env.example` maintained.

---

## 3. The Lifecycle (canonical — do not renumber)

Each stage has: inputs, activities, required artifacts, a **gate** with required approver roles,
and machine-checkable **exit criteria**. Stage `N+1` is locked until stage `N` gate is `APPROVED`.

| # | Stage | Primary artifacts | Required approvers |
|---|-------|-------------------|--------------------|
| 0 | Workspace & Pack Setup | workspace.yaml, selected industry pack, domain map, role assignments | Platform Admin |
| 1 | Consumption Discovery | decision-register.yaml, consumer personas, question inventory, current-state pain | Consumer Rep, Product Owner |
| 2 | Product Charter | charter.md, archetype, tier, scope boundary, value hypothesis, success measures | Product Owner, Domain Architect |
| 3 | Source Discovery & Profiling | source-inventory.yaml, profiling results, feasibility & gap log | Platform Engineer, Domain SME |
| 4 | Conceptual & Logical Model | entity model, grain statement, conformed backbone binding, identity-resolution strategy | Domain Architect, Domain SME |
| 5 | Attribute Register & Data Contract | attribute-register.yaml, data-contract.yaml (schema, SLA, quality thresholds, versioning, deprecation) | Data Steward, Domain SME, Product Owner |
| 6 | Semantic Model & Metrics | semantic-model.yaml, metric definitions, certified metric registry entries | Domain Architect, Product Owner |
| 7 | Physical Architecture & Pipelines | medallion mapping, ingestion & orchestration design, lineage graph | Platform Engineer, Domain Architect |
| 8 | Quality, Observability & Controls | quality-rules.yaml, freshness/completeness SLOs, alerting & remediation runbook | Data Steward, Platform Engineer |
| 9 | Access, Security & Governance | access-policy.yaml (ABAC, purpose-based), masking & RLS rules, regulatory constraint map | Privacy/Security Officer **(veto role)**, Data Steward |
| 10 | Serving & Consumption Interfaces | BI semantic binding, API spec, marketplace-listing.json, grounding-pack.json | Consumer Rep, Domain Architect |
| 11 | Certification & Publication | DATSIS+V scorecard, evidence pack, publication record | Product Owner, Data Steward, Domain Architect |
| 12 | Operate & Evolve | usage telemetry, feedback log, change requests, version bumps, deprecation notice | Product Owner |

**Gate states:** `NOT_STARTED → DRAFT → IN_REVIEW → CHANGES_REQUESTED → APPROVED → STALE`.
A **veto role** rejection blocks approval regardless of quorum.

**DATSIS+V** is the certification rubric at stage 11: Discoverable, Addressable, Trustworthy,
Self-describing, Interoperable, Secure, **+ Valuable**. Each dimension scored with cited evidence
drawn from earlier stages — never free text alone.

---

## 4. Stack

- **Node 20+ / pnpm.** TypeScript `strict`, no `any`, no non-null `!` without a comment.
- **Next.js 15 (App Router), React 19.** Server Components by default; client components only
  where interaction demands it.
- **Prisma ORM.** SQLite by default (zero-config). Postgres via `docker-compose.yml` for
  multi-user. Same schema, no dialect-specific SQL in app code.
- **Zod** is the single source of truth for artifact shapes. Generate JSON Schema from Zod for
  export validation. Validate at every boundary — route handlers, server actions, pack loading,
  file import.
- **Auth.js** credentials provider, seeded local users, role-based authorization enforced
  server-side. Never trust a client-supplied role.
- **Tailwind v4 + shadcn/ui + lucide-react.** Mermaid rendered client-side for diagrams.
- **Exports:** `docx` (Word), `exceljs` (Excel), `js-yaml` (YAML), Playwright print-to-PDF.
  All behind `src/lib/exports/` adapters — no export library imported outside that directory.
- **Tests:** Vitest + Testing Library (unit/integration), Playwright (e2e for gate flows).

---

## 5. Layout

```
CLAUDE.md  README.md  docker-compose.yml  .env.example
prisma/            schema.prisma, migrations/, seed.ts
packs/             _generic/ utility/ banking/ insurance/ retail/ healthcare/ manufacturing/ telecom/ public-sector/
templates/         artifact templates + export templates
workspace/         generated artifacts (Git-tracked)
docs/              lifecycle.md, architecture.md, adr/
src/
  app/             routes: /workspace, /product/[slug]/stage/[n], /review, /marketplace, /admin
  components/
  lib/
    lifecycle/     stage registry, exit criteria, transition engine
    artifacts/     zod schemas, versioning, hashing, diffing, file mirroring
    governance/    gates, approvals, audit, cascade invalidation
    packs/         pack loader + validator
    exports/       docx | xlsx | pdf | yaml | json adapters
    ai/            optional propose-only assist
    db/
tests/             unit/ integration/ e2e/
```

---

## 6. Conventions

- **Stages are data.** Adding or editing a stage means editing `src/lib/lifecycle/stages.ts` and
  its Zod schema — never scattering stage logic across components.
- **Exit criteria are functions**, not prose: `(product) => CriterionResult[]`, each returning
  `{ id, label, passed, detail, artifactRef }`. The UI renders the checklist from this; the
  transition engine reads the same list. One source, two consumers.
- **Server-side authorization on every mutation.** A hidden button is not a control.
- **Artifact writes go through `artifacts/commit.ts`** — it hashes, versions, mirrors to
  `workspace/`, and emits an `AuditEvent` in one transaction. Never write artifacts elsewhere.
- **Errors are typed and surfaced.** No silent catch. User-facing failures explain what to do next.
- **Accessibility:** keyboard-navigable review flows, labelled form controls, visible focus.
  Reviewers live in this UI all day.
- **Commits:** Conventional Commits. Small, coherent, independently reviewable.

---

## 7. Definition of Done

Before you say a task is complete:

1. `pnpm typecheck` clean.
2. `pnpm lint` clean.
3. `pnpm test` passing, including a test for the behaviour you just added.
4. `pnpm build` succeeds.
5. Migration created and `pnpm db:seed` still works, if the schema changed.
6. Any new non-negotiable-adjacent behaviour has a test that would fail if the guardrail were
   removed.
7. Docs updated if you changed the lifecycle, the artifact schemas, or the pack format.

Never report a feature as working without having run it. If you could not verify something, say
exactly what is unverified.

---

## 8. Commands

```bash
pnpm install
pnpm db:push        # sync schema (dev)
pnpm db:migrate     # create migration
pnpm db:seed        # seed users, roles, packs, demo product
pnpm dev            # http://localhost:3000
pnpm typecheck | pnpm lint | pnpm test | pnpm test:e2e | pnpm build
pnpm pack:validate  # validate all packs/ against the pack schema
```

---

## 9. Working style for this repo

- **Plan before building.** For any multi-file change, state the plan and the files you will
  touch, then execute.
- **Build in vertical slices.** One stage working end-to-end (schema → artifact → gate → export)
  beats twelve stages half-wired.
- **Prefer deleting to abstracting.** Do not add a framework, queue, or state library until a
  concrete second use case exists.
- **Ask when the domain is ambiguous.** Guessing at governance semantics is expensive to unwind.
  Guessing at a button colour is not — just pick one.
- **Do not scaffold speculative files.** No empty `utils.ts`, no placeholder routes.
