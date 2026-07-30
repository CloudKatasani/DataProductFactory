"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles, Trash2, X } from "lucide-react";
import { addDecisionRecordAction, archiveDecisionRecordAction } from "@/lib/actions";
import { AiDraftButton } from "@/components/ai-draft";
import { ProvenanceBadge } from "@/components/badges";

/**
 * Stage-1 authoring: the blocked-decision register. Non-Negotiable 1 lives here
 * — a product cannot advance until at least one decision names a persona, the
 * decision they cannot make, its cadence and the consequence of not making it.
 * Every field is required, and the form says why.
 */
export interface DecisionRow {
  id: string;
  persona: string;
  decision: string;
  cadence: string;
  consequence: string;
  complete: boolean;
}

const EMPTY = { persona: "", decision: "", cadence: "", consequence: "" };

interface ProposedDecision {
  persona: string;
  decision: string;
  cadence: string;
  consequence: string;
}

export function DecisionRecordsEditor({
  productId,
  records,
}: {
  productId: string;
  records: DecisionRow[];
}) {
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<ProposedDecision[]>([]);
  const [pending, startTransition] = useTransition();

  function applyDraft(draft: unknown) {
    const d = draft as Partial<{ decisions: ProposedDecision[] }>;
    // Propose-only: the agent's decisions land in a review list, not the DB.
    // A human adds the ones they want (Non-Negotiable 3).
    if (d.decisions?.length) setProposed(d.decisions);
  }

  function addProposed(index: number) {
    const item = proposed[index];
    if (!item) return;
    startTransition(async () => {
      const result = await addDecisionRecordAction(productId, item);
      if (result.ok) setProposed((p) => p.filter((_, j) => j !== index));
      else setError(result.error);
    });
  }

  const canAdd =
    fields.persona.trim() &&
    fields.decision.trim() &&
    fields.cadence.trim() &&
    fields.consequence.trim();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addDecisionRecordAction(productId, fields);
      if (result.ok) setFields(EMPTY);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <AiDraftButton
          productId={productId}
          kind="DECISION_REGISTER"
          onDraft={applyDraft}
          label="Propose decisions with agent"
        />
        {proposed.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-violet-500/40 bg-violet-500/5 p-3">
            <div className="flex items-center gap-2 text-xs text-violet-700 dark:text-violet-300">
              <Sparkles size={14} aria-hidden />
              <ProvenanceBadge provenance="AI_DRAFT" />
              <span className="font-medium">
                Agent-proposed decisions — add the ones that hold up
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {proposed.map((p, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-md border border-[var(--border)] bg-background p-3 text-sm"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{p.persona}</span>
                    <span>{p.decision}</span>
                    <span className="text-xs text-[var(--muted)]">
                      Cadence: {p.cadence} · Consequence: {p.consequence}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={`Add proposed decision ${i + 1}`}
                      disabled={pending}
                      onClick={() => addProposed(i)}
                      className="rounded-md border border-transparent p-1.5 text-emerald-600 transition hover:border-emerald-500/40 disabled:opacity-50 dark:text-emerald-400"
                    >
                      <Check size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Dismiss proposed decision ${i + 1}`}
                      onClick={() => setProposed((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded-md border border-transparent p-1.5 text-[var(--muted)] transition hover:border-rose-500/40 hover:text-rose-600"
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {records.length === 0 && (
          <li className="rounded-md border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
            No decision records yet. A data product cannot exist without a named consumer and a
            blocked decision.
          </li>
        )}
        {records.map((r) => (
          <li
            key={r.id}
            className={`rounded-md border p-3 text-sm ${
              r.complete ? "border-[var(--border)]" : "border-amber-500/40 bg-amber-500/5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium">{r.persona || "(no persona)"}</span>
                <span>{r.decision || "(no decision)"}</span>
                <span className="text-xs text-[var(--muted)]">
                  Cadence: {r.cadence || "—"} · Consequence: {r.consequence || "—"}
                </span>
                {!r.complete && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Incomplete — this record does not yet unblock the stage.
                  </span>
                )}
              </div>
              <ArchiveButton recordId={r.id} />
            </div>
          </li>
        ))}
      </ul>

      <fieldset className="rounded-md border border-[var(--border)] p-4">
        <legend className="px-1 text-sm font-medium">Add a blocked decision</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Persona (who is blocked)"
            value={fields.persona}
            onChange={(v) => setFields((f) => ({ ...f, persona: v }))}
            placeholder="Regional dispatch supervisor"
          />
          <Field
            label="Cadence (how often)"
            value={fields.cadence}
            onChange={(v) => setFields((f) => ({ ...f, cadence: v }))}
            placeholder="Every 15 minutes during an event"
          />
          <Field
            label="Decision they cannot make"
            value={fields.decision}
            onChange={(v) => setFields((f) => ({ ...f, decision: v }))}
            placeholder="Which crew to send first"
            wide
          />
          <Field
            label="Consequence of not deciding"
            value={fields.consequence}
            onChange={(v) => setFields((f) => ({ ...f, consequence: v }))}
            placeholder="Crews idle while customers stay dark"
            wide
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={!canAdd || pending}
          onClick={submit}
          className="mt-3 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add decision record"}
        </button>
      </fieldset>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[var(--muted)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
      />
    </label>
  );
}

function ArchiveButton({ recordId }: { recordId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Archive decision record"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await archiveDecisionRecordAction(recordId);
        })
      }
      className="rounded-md border border-transparent p-1.5 text-[var(--muted)] transition hover:border-rose-500/40 hover:text-rose-600 disabled:opacity-50"
    >
      <Trash2 size={16} aria-hidden />
    </button>
  );
}
