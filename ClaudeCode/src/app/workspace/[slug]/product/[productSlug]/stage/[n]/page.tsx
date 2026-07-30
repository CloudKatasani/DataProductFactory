import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, Download, X } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { GateStatusBadge, ProvenanceBadge } from "@/components/badges";
import { ActionButton } from "@/components/action-button";
import { DecisionRecordsEditor } from "@/components/decision-records-editor";
import { CharterEditor } from "@/components/charter-editor";
import { SourceInventoryEditor } from "@/components/source-inventory-editor";
import { LogicalModelEditor } from "@/components/logical-model-editor";
import { AttributeRegisterEditor } from "@/components/attribute-register-editor";
import { DataContractEditor } from "@/components/data-contract-editor";
import { getCurrentUser, rolesInWorkspace } from "@/lib/auth/session";
import { getProductView } from "@/lib/queries";
import {
  approveGateAction,
  commitDecisionRegisterAction,
  enterReviewAction,
  reviewDecisionAction,
} from "@/lib/actions";
import type { CriterionResult } from "@/lib/lifecycle/types";

const REVIEWABLE = new Set(["IN_REVIEW", "CHANGES_REQUESTED", "STALE"]);
const PRE_REVIEW = new Set(["NOT_STARTED", "DRAFT", "CHANGES_REQUESTED", "STALE"]);

export default async function StagePage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string; n: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { slug, productSlug, n } = await params;
  const stageNumber = Number(n);
  const view = await getProductView(slug, productSlug);
  if (!view) notFound();

  const stage = view.stages.find((s) => s.number === stageNumber);
  if (!stage) notFound();

  const base = `/workspace/${view.workspace.slug}/product/${view.product.slug}`;
  const myRoles = await rolesInWorkspace(user.id, view.workspace.id);
  const isMember = myRoles.length > 0;
  const myApproverRoles = stage.requiredApprovers.filter((r) => myRoles.includes(r));

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <nav className="text-sm text-[var(--muted)]">
          <Link href={`/workspace/${view.workspace.slug}`} className="hover:text-foreground">
            {view.workspace.name}
          </Link>
          <span className="mx-2">/</span>
          <Link href={base} className="hover:text-foreground">
            {view.product.name}
          </Link>
        </nav>

        <div className="mt-2 flex items-center gap-3">
          <span className="font-mono text-sm text-[var(--muted)]">Stage {stage.number}</span>
          <h1 className="text-xl font-semibold tracking-tight">{stage.title}</h1>
          <GateStatusBadge status={stage.status} />
        </div>

        {!stage.unlocked && (
          <p className="mt-4 rounded-md border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-600 dark:text-rose-400">
            This stage is locked until stage {stage.blockingStage} is approved.
          </p>
        )}

        {/* Exit criteria — the same list the transition engine enforces. */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Exit criteria
          </h2>
          {stage.criteria.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              This stage has no machine-checkable exit criteria.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {stage.criteria.map((c) => (
                <CriterionRow key={c.id} criterion={c} />
              ))}
            </ul>
          )}
        </section>

        {/* Stage-1 authoring. */}
        {stage.number === 1 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Decision register
            </h2>
            <div className="mt-3">
              <DecisionRecordsEditor productId={view.product.id} records={view.decisionRecords} />
            </div>
            {isMember && (
              <div className="mt-4 flex flex-wrap gap-3">
                <ActionButton
                  action={commitDecisionRegisterAction.bind(null, view.product.id)}
                  variant="default"
                >
                  Commit decision register
                </ActionButton>
                {PRE_REVIEW.has(stage.status) && (
                  <ActionButton
                    action={enterReviewAction.bind(null, view.product.id, stage.number)}
                    variant="primary"
                  >
                    Submit for review
                  </ActionButton>
                )}
              </div>
            )}
          </section>
        )}

        {/* Stage-2 authoring. */}
        {stage.number === 2 && isMember && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Product charter
            </h2>
            <div className="mt-3">
              <CharterEditor
                productId={view.product.id}
                defaultName={view.product.name}
                defaultArchetype={view.product.archetype}
                defaultTier={view.product.tier}
              />
            </div>
            {PRE_REVIEW.has(stage.status) && (
              <div className="mt-4">
                <ActionButton
                  action={enterReviewAction.bind(null, view.product.id, stage.number)}
                  variant="primary"
                >
                  Submit for review
                </ActionButton>
              </div>
            )}
          </section>
        )}

        {/* Stage-3 authoring. */}
        {stage.number === 3 && isMember && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Source inventory
            </h2>
            <div className="mt-3">
              <SourceInventoryEditor productId={view.product.id} />
            </div>
            {PRE_REVIEW.has(stage.status) && (
              <div className="mt-4">
                <ActionButton
                  action={enterReviewAction.bind(null, view.product.id, stage.number)}
                  variant="primary"
                >
                  Submit for review
                </ActionButton>
              </div>
            )}
          </section>
        )}

        {/* Stage-4 authoring. */}
        {stage.number === 4 && isMember && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Conceptual &amp; logical model
            </h2>
            <div className="mt-3">
              <LogicalModelEditor productId={view.product.id} />
            </div>
            {PRE_REVIEW.has(stage.status) && (
              <div className="mt-4">
                <ActionButton
                  action={enterReviewAction.bind(null, view.product.id, stage.number)}
                  variant="primary"
                >
                  Submit for review
                </ActionButton>
              </div>
            )}
          </section>
        )}

        {/* Stage-5 authoring: two artifacts. */}
        {stage.number === 5 && isMember && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Attribute register
            </h2>
            <div className="mt-3">
              <AttributeRegisterEditor productId={view.product.id} />
            </div>
            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Data contract
            </h2>
            <div className="mt-3">
              <DataContractEditor productId={view.product.id} />
            </div>
            {PRE_REVIEW.has(stage.status) && (
              <div className="mt-4">
                <ActionButton
                  action={enterReviewAction.bind(null, view.product.id, stage.number)}
                  variant="primary"
                >
                  Submit for review
                </ActionButton>
              </div>
            )}
          </section>
        )}

        {/* Stages whose authoring UI is not built yet — the gate is still live. */}
        {isMember && stage.number > 5 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Author
            </h2>
            <p className="mt-2 max-w-prose text-sm text-[var(--muted)]">
              The authoring UI for this stage arrives in a later slice. Its gate, exit criteria
              and approval flow above are already active.
            </p>
          </section>
        )}

        {/* Committed artifacts with provenance. */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Committed artifacts
          </h2>
          {stage.artifacts.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Nothing committed for this stage yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {stage.artifacts.map((a) => (
                <li
                  key={a.slug}
                  className="flex items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs">{a.kind}</span>
                  <span className="text-[var(--muted)]">v{a.versionNumber}</span>
                  <span className="ml-auto flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      <Download size={12} aria-hidden />
                      <a
                        href={`/api/export/${a.versionId}?format=yaml`}
                        className="underline decoration-dotted hover:text-foreground"
                      >
                        YAML
                      </a>
                      <span aria-hidden>·</span>
                      <a
                        href={`/api/export/${a.versionId}?format=json`}
                        className="underline decoration-dotted hover:text-foreground"
                      >
                        JSON
                      </a>
                    </span>
                    <ProvenanceBadge provenance={a.provenance} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Review & approval. */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Gate — required approvers
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {stage.requiredApprovers.map((r) => (
              <span
                key={r}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]"
              >
                {r}
              </span>
            ))}
          </div>

          {stage.gateId && REVIEWABLE.has(stage.status) && myApproverRoles.length > 0 ? (
            <div className="mt-4 flex flex-col gap-4">
              {myApproverRoles.map((role) => (
                <div key={role} className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-[var(--muted)]">As {role}:</span>
                  <ActionButton
                    action={approveGateAction.bind(null, stage.gateId!, role, undefined)}
                    variant="primary"
                  >
                    Approve
                  </ActionButton>
                  <ActionButton
                    action={reviewDecisionAction.bind(
                      null,
                      stage.gateId!,
                      role,
                      "REQUEST_CHANGES",
                      undefined,
                    )}
                    variant="default"
                  >
                    Request changes
                  </ActionButton>
                  <ActionButton
                    action={reviewDecisionAction.bind(null, stage.gateId!, role, "REJECT", undefined)}
                    variant="danger"
                  >
                    Reject
                  </ActionButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">
              {REVIEWABLE.has(stage.status)
                ? "You do not hold a required approver role for this gate."
                : "This gate is not currently open for review."}
            </p>
          )}
        </section>
      </main>
    </>
  );
}

function CriterionRow({ criterion }: { criterion: CriterionResult }) {
  return (
    <li className="flex items-start gap-3 rounded-md border border-[var(--border)] px-3 py-2 text-sm">
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
          criterion.passed
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
        }`}
        aria-label={criterion.passed ? "passed" : "not met"}
      >
        {criterion.passed ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
      </span>
      <span className="flex flex-col">
        <span className="font-medium">{criterion.label}</span>
        <span className="text-xs text-[var(--muted)]">{criterion.detail}</span>
      </span>
    </li>
  );
}
