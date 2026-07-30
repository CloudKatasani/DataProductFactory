"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { commitAttributeRegisterAction } from "@/lib/actions";

/**
 * Stage-5 authoring: the attribute register. Sensitivity offers "Unclassified"
 * (null) on purpose — a register can be committed with unclassified attributes,
 * and it is those that keep Stage 9 blocked until everything is classified
 * (Non-Negotiable 10).
 */
const SENSITIVITY = ["", "PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;

interface Row {
  name: string;
  dataType: string;
  sensitivity: string; // "" means Unclassified
  piiFlag: boolean;
  regulatoryFlags: string;
}

const EMPTY: Row = {
  name: "",
  dataType: "",
  sensitivity: "",
  piiFlag: false,
  regulatoryFlags: "",
};

export function AttributeRegisterEditor({ productId }: { productId: string }) {
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY }]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const valid = rows.filter((r) => r.name.trim() && r.dataType.trim());
  const unclassified = valid.filter((r) => r.sensitivity === "").length;

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function commit() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await commitAttributeRegisterAction(productId, {
        attributes: valid.map((r) => ({
          name: r.name.trim(),
          dataType: r.dataType.trim(),
          sensitivity: r.sensitivity === "" ? null : r.sensitivity,
          piiFlag: r.piiFlag,
          regulatoryFlags: r.regulatoryFlags.trim(),
        })),
      });
      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Attributes</span>
        <button
          type="button"
          onClick={() => setRows((r) => [...r, { ...EMPTY }])}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
        >
          <Plus size={12} aria-hidden /> Add attribute
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-12">
            <input
              aria-label={`Attribute ${i + 1} name`}
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="customer_ssn"
              className="rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm sm:col-span-3"
            />
            <input
              aria-label={`Attribute ${i + 1} type`}
              value={row.dataType}
              onChange={(e) => update(i, { dataType: e.target.value })}
              placeholder="string"
              className="rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              aria-label={`Attribute ${i + 1} sensitivity`}
              value={row.sensitivity}
              onChange={(e) => update(i, { sensitivity: e.target.value })}
              className="rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm sm:col-span-3"
            >
              {SENSITIVITY.map((s) => (
                <option key={s || "none"} value={s}>
                  {s === "" ? "Unclassified" : s}
                </option>
              ))}
            </select>
            <input
              aria-label={`Attribute ${i + 1} regulatory flags`}
              value={row.regulatoryFlags}
              onChange={(e) => update(i, { regulatoryFlags: e.target.value })}
              placeholder="GDPR,HIPAA"
              className="rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm sm:col-span-2"
            />
            <label className="flex items-center gap-1.5 text-xs sm:col-span-1">
              <input
                type="checkbox"
                aria-label={`Attribute ${i + 1} PII`}
                checked={row.piiFlag}
                onChange={(e) => update(i, { piiFlag: e.target.checked })}
              />
              PII
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                aria-label={`Remove attribute ${i + 1}`}
                onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                className="justify-self-start rounded-md border border-transparent p-1.5 text-[var(--muted)] hover:border-rose-500/40 hover:text-rose-600 sm:col-span-1"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            )}
          </div>
        ))}
      </div>

      {unclassified > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {unclassified} attribute{unclassified === 1 ? "" : "s"} still unclassified — allowed
          here, but Stage 9 stays blocked until every attribute is classified.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {done && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Attribute register committed.
        </p>
      )}

      <button
        type="button"
        disabled={valid.length === 0 || pending}
        onClick={commit}
        className="self-start rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Committing…" : "Commit attribute register"}
      </button>
    </div>
  );
}
