import type { ArtifactKind, Role } from "@/lib/artifacts/enums";

/**
 * Result of one machine-checkable exit criterion. The stage checklist UI and the
 * transition engine both render from this — one source, two consumers.
 */
export interface CriterionResult {
  id: string;
  label: string;
  passed: boolean;
  /** Why it passed or, more usefully, exactly what is missing. */
  detail: string;
  /** Artifact this criterion inspected, when it inspected one. */
  artifactRef?: string;
}

/**
 * The subset of product state an exit criterion is allowed to see. Criteria are
 * pure functions of this — no database access, no I/O — so they are trivially
 * testable and can run on unsaved draft state in the UI.
 */
export interface StageEvaluationContext {
  productId: string;
  decisionRecords: Array<{
    persona: string;
    decision: string;
    cadence: string;
    consequence: string;
  }>;
  attributes: Array<{ name: string; sensitivity: string | null }>;
  metrics: Array<{ name: string; definition: string; certified: boolean }>;
  /** Latest committed version per artifact kind present on the product. */
  artifacts: Array<{ kind: ArtifactKind; slug: string; versionNumber: number }>;
}

export type ExitCriterion = (ctx: StageEvaluationContext) => CriterionResult;

export interface StageDefinition {
  number: number;
  title: string;
  /** What the stage produces. Drives the artifact pickers and the export index. */
  artifactKinds: ArtifactKind[];
  /** Every listed role must record an APPROVE for the gate to close. */
  requiredApprovers: Role[];
  exitCriteria: ExitCriterion[];
}
