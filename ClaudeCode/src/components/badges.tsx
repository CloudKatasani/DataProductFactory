import type { GateStatus, Provenance, Sensitivity } from "@/lib/artifacts/enums";

/**
 * Status and provenance chips. AI_DRAFT is always visually distinct — a draft
 * from the assistant must never look like a human-authored, reviewed artifact
 * (Non-Negotiable 3).
 */

const GATE_STYLES: Record<GateStatus, string> = {
  NOT_STARTED: "border-[var(--border)] text-[var(--muted)]",
  DRAFT: "border-sky-400/40 text-sky-600 dark:text-sky-400",
  IN_REVIEW: "border-amber-400/50 text-amber-600 dark:text-amber-400",
  CHANGES_REQUESTED: "border-orange-500/50 text-orange-600 dark:text-orange-400",
  APPROVED: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
  STALE: "border-rose-500/50 text-rose-600 dark:text-rose-400",
};

const GATE_LABEL: Record<GateStatus, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  STALE: "Stale",
};

export function GateStatusBadge({ status }: { status: GateStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${GATE_STYLES[status]}`}
    >
      {GATE_LABEL[status]}
    </span>
  );
}

const PROVENANCE_STYLES: Record<Provenance, string> = {
  AI_DRAFT: "border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  HUMAN_AUTHORED: "border-[var(--border)] text-[var(--muted)]",
  HUMAN_REVIEWED: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
};

const PROVENANCE_LABEL: Record<Provenance, string> = {
  AI_DRAFT: "AI draft",
  HUMAN_AUTHORED: "Human-authored",
  HUMAN_REVIEWED: "Human-reviewed",
};

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PROVENANCE_STYLES[provenance]}`}
    >
      {PROVENANCE_LABEL[provenance]}
    </span>
  );
}

const SENSITIVITY_STYLES: Record<Sensitivity, string> = {
  PUBLIC: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
  INTERNAL: "border-sky-500/50 text-sky-600 dark:text-sky-400",
  CONFIDENTIAL: "border-amber-500/50 text-amber-600 dark:text-amber-400",
  RESTRICTED: "border-rose-500/50 text-rose-600 dark:text-rose-400",
};

/**
 * Classification chip. `null` means no attribute is classified yet — shown as a
 * muted "Unclassified" so an unclassified product reads as a gap, not as safe.
 */
export function SensitivityBadge({ sensitivity }: { sensitivity: Sensitivity | null }) {
  if (!sensitivity) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
        Unclassified
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${SENSITIVITY_STYLES[sensitivity]}`}
    >
      {sensitivity}
    </span>
  );
}
