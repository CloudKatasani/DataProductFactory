"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { commitCharterAction } from "@/lib/actions";

/**
 * Stage-2 authoring: the product charter. Authored as a structured shape and
 * committed as Markdown. The value hypothesis is required and is meant to name
 * the stage-1 consumer decision this product unblocks — consumption stays first
 * (Non-Negotiable 1), even in the charter.
 */
const ARCHETYPES = ["SOURCE_ALIGNED", "AGGREGATE", "CONSUMER_ALIGNED"] as const;
const TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;

interface Measure {
  measure: string;
  target: string;
}

export function CharterEditor({
  productId,
  defaultName,
  defaultArchetype,
  defaultTier,
}: {
  productId: string;
  defaultName: string;
  defaultArchetype: string | null;
  defaultTier: string | null;
}) {
  const [productName, setProductName] = useState(defaultName);
  const [archetype, setArchetype] = useState(defaultArchetype ?? "CONSUMER_ALIGNED");
  const [tier, setTier] = useState(defaultTier ?? "SILVER");
  const [scopeBoundary, setScopeBoundary] = useState("");
  const [valueHypothesis, setValueHypothesis] = useState("");
  const [measures, setMeasures] = useState<Measure[]>([{ measure: "", target: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const validMeasures = measures.filter((m) => m.measure.trim() && m.target.trim());
  const canCommit =
    productName.trim() &&
    scopeBoundary.trim() &&
    valueHypothesis.trim() &&
    validMeasures.length > 0;

  function commit() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await commitCharterAction(productId, {
        productName: productName.trim(),
        archetype,
        tier,
        scopeBoundary: scopeBoundary.trim(),
        valueHypothesis: valueHypothesis.trim(),
        successMeasures: validMeasures,
      });
      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-[var(--border)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">Product name</span>
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Archetype</span>
          <select
            value={archetype}
            onChange={(e) => setArchetype(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
          >
            {ARCHETYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Tier</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">Scope boundary (what is in and out)</span>
          <textarea
            value={scopeBoundary}
            onChange={(e) => setScopeBoundary(e.target.value)}
            rows={2}
            placeholder="In: active outage dispatch. Out: billing, planned maintenance."
            className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">
            Value hypothesis (the consumer decision this unblocks)
          </span>
          <textarea
            value={valueHypothesis}
            onChange={(e) => setValueHypothesis(e.target.value)}
            rows={2}
            placeholder="Unblocks the dispatch supervisor's crew-priority decision during outages."
            className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
          />
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-[var(--muted)]">Success measures</span>
          <button
            type="button"
            onClick={() => setMeasures((m) => [...m, { measure: "", target: "" }])}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
          >
            <Plus size={12} aria-hidden /> Add measure
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {measures.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input
                aria-label={`Measure ${i + 1}`}
                value={m.measure}
                onChange={(e) =>
                  setMeasures((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, measure: e.target.value } : x)),
                  )
                }
                placeholder="Mean time to dispatch"
                className="flex-1 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              />
              <input
                aria-label={`Target ${i + 1}`}
                value={m.target}
                onChange={(e) =>
                  setMeasures((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)),
                  )
                }
                placeholder="< 10 min"
                className="w-40 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                aria-label={`Remove measure ${i + 1}`}
                disabled={measures.length === 1}
                onClick={() => setMeasures((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-md border border-transparent p-1.5 text-[var(--muted)] hover:border-rose-500/40 hover:text-rose-600 disabled:opacity-40"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {done && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Charter committed. Submit it for review below.
        </p>
      )}

      <button
        type="button"
        disabled={!canCommit || pending}
        onClick={commit}
        className="self-start rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Committing…" : "Commit charter"}
      </button>
    </div>
  );
}
