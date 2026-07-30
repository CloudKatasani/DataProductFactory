"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { commitSourceInventoryAction } from "@/lib/actions";

/**
 * Stage-3 authoring: the source inventory. Each source is captured as supporting
 * detail — the sources exist to serve the stage-1 decision, not the other way
 * round (Non-Negotiable 1). Feasibility comes from the profiling pass; the gap
 * log is where what is missing or risky is written down.
 */
const CONNECTION_KINDS = ["DATABASE", "API", "FILE", "STREAM", "OTHER"] as const;
const FEASIBILITY = ["READY", "GAPS", "BLOCKED"] as const;

interface SourceRow {
  name: string;
  system: string;
  connectionKind: string;
  description: string;
  feasibility: string;
}

const EMPTY_ROW: SourceRow = {
  name: "",
  system: "",
  connectionKind: "DATABASE",
  description: "",
  feasibility: "READY",
};

export function SourceInventoryEditor({ productId }: { productId: string }) {
  const [rows, setRows] = useState<SourceRow[]>([{ ...EMPTY_ROW }]);
  const [gapLog, setGapLog] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const valid = rows.filter((r) => r.name.trim() && r.system.trim() && r.description.trim());
  const canCommit = valid.length > 0;

  function update(i: number, patch: Partial<SourceRow>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function commit() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await commitSourceInventoryAction(productId, {
        sources: valid,
        gapLog: gapLog.trim(),
      });
      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Sources</span>
        <button
          type="button"
          onClick={() => setRows((r) => [...r, { ...EMPTY_ROW }])}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
        >
          <Plus size={12} aria-hidden /> Add source
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-md border border-[var(--border)] p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                label={`Source ${i + 1} name`}
                value={row.name}
                onChange={(v) => update(i, { name: v })}
                placeholder="Outage events"
              />
              <Input
                label={`Source ${i + 1} system`}
                value={row.system}
                onChange={(v) => update(i, { system: v })}
                placeholder="SCADA"
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">Connection</span>
                <select
                  aria-label={`Source ${i + 1} connection`}
                  value={row.connectionKind}
                  onChange={(e) => update(i, { connectionKind: e.target.value })}
                  className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
                >
                  {CONNECTION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">Feasibility</span>
                <select
                  aria-label={`Source ${i + 1} feasibility`}
                  value={row.feasibility}
                  onChange={(e) => update(i, { feasibility: e.target.value })}
                  className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
                >
                  {FEASIBILITY.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label={`Source ${i + 1} description`}
                value={row.description}
                onChange={(v) => update(i, { description: v })}
                placeholder="One row per outage event, from detection to restoration."
                wide
              />
            </div>
            {rows.length > 1 && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  aria-label={`Remove source ${i + 1}`}
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-[var(--muted)] hover:border-rose-500/40 hover:text-rose-600"
                >
                  <Trash2 size={13} aria-hidden /> Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Feasibility &amp; gap log</span>
        <textarea
          value={gapLog}
          onChange={(e) => setGapLog(e.target.value)}
          rows={2}
          placeholder="SCADA history older than 90 days is not retained; needs a backfill."
          className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
        />
      </label>

      {error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {done && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Source inventory committed. Submit it for review below.
        </p>
      )}

      <button
        type="button"
        disabled={!canCommit || pending}
        onClick={commit}
        className="self-start rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Committing…" : "Commit source inventory"}
      </button>
    </div>
  );
}

function Input({
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
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
      />
    </label>
  );
}
