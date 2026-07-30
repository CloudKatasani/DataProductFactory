"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { commitLogicalModelAction } from "@/lib/actions";
import { AiDraftButton, AiDraftBanner } from "@/components/ai-draft";

/**
 * Stage-4 authoring: the conceptual & logical model. Grain and identity
 * resolution are required; entities carry their own grain. Conformed-backbone
 * bindings are optional and map the pack's shared spine to local entities.
 */
interface EntityRow {
  name: string;
  grain: string;
  description: string;
}
interface BindingRow {
  backboneEntity: string;
  boundEntity: string;
}

export function LogicalModelEditor({ productId }: { productId: string }) {
  const [grainStatement, setGrainStatement] = useState("");
  const [identityResolution, setIdentityResolution] = useState("");
  const [entities, setEntities] = useState<EntityRow[]>([
    { name: "", grain: "", description: "" },
  ]);
  const [bindings, setBindings] = useState<BindingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [aiDrafted, setAiDrafted] = useState(false);
  const [pending, startTransition] = useTransition();

  function applyDraft(draft: unknown) {
    const d = draft as Partial<{
      grainStatement: string;
      identityResolution: string;
      entities: EntityRow[];
      conformedBindings: BindingRow[];
    }>;
    if (typeof d.grainStatement === "string") setGrainStatement(d.grainStatement);
    if (typeof d.identityResolution === "string") setIdentityResolution(d.identityResolution);
    if (d.entities?.length) {
      setEntities(
        d.entities.map((e) => ({
          name: e.name ?? "",
          grain: e.grain ?? "",
          description: e.description ?? "",
        })),
      );
    }
    if (d.conformedBindings?.length) setBindings(d.conformedBindings);
    setDone(false);
    setAiDrafted(true);
  }

  const validEntities = entities.filter((e) => e.name.trim() && e.grain.trim());
  const canCommit =
    grainStatement.trim() && identityResolution.trim() && validEntities.length > 0;

  function commit() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await commitLogicalModelAction(productId, {
        grainStatement: grainStatement.trim(),
        identityResolution: identityResolution.trim(),
        entities: validEntities,
        conformedBindings: bindings.filter(
          (b) => b.backboneEntity.trim() && b.boundEntity.trim(),
        ),
      });
      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-md border border-[var(--border)] p-4"
      onChange={() => aiDrafted && setAiDrafted(false)}
    >
      <AiDraftButton productId={productId} kind="LOGICAL_MODEL" onDraft={applyDraft} />
      {aiDrafted && <AiDraftBanner />}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Grain statement (what one row means)</span>
        <textarea
          value={grainStatement}
          onChange={(e) => setGrainStatement(e.target.value)}
          rows={2}
          placeholder="One row per outage event per affected service point."
          className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Entities</span>
          <button
            type="button"
            onClick={() => setEntities((r) => [...r, { name: "", grain: "", description: "" }])}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
          >
            <Plus size={12} aria-hidden /> Add entity
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {entities.map((row, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-3">
              <input
                aria-label={`Entity ${i + 1} name`}
                value={row.name}
                onChange={(e) =>
                  setEntities((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="Outage"
                className="rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              />
              <input
                aria-label={`Entity ${i + 1} grain`}
                value={row.grain}
                onChange={(e) =>
                  setEntities((p) => p.map((x, j) => (j === i ? { ...x, grain: e.target.value } : x)))
                }
                placeholder="One row per outage"
                className="rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  aria-label={`Entity ${i + 1} description`}
                  value={row.description}
                  onChange={(e) =>
                    setEntities((p) =>
                      p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)),
                    )
                  }
                  placeholder="Description (optional)"
                  className="flex-1 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
                />
                {entities.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove entity ${i + 1}`}
                    onClick={() => setEntities((p) => p.filter((_, j) => j !== i))}
                    className="rounded-md border border-transparent p-1.5 text-[var(--muted)] hover:border-rose-500/40 hover:text-rose-600"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Identity-resolution strategy</span>
        <textarea
          value={identityResolution}
          onChange={(e) => setIdentityResolution(e.target.value)}
          rows={2}
          placeholder="Service points are matched on meter id; outages keyed by SCADA event id."
          className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Conformed backbone bindings (optional)</span>
          <button
            type="button"
            onClick={() => setBindings((r) => [...r, { backboneEntity: "", boundEntity: "" }])}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
          >
            <Plus size={12} aria-hidden /> Add binding
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {bindings.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                aria-label={`Binding ${i + 1} backbone entity`}
                value={row.backboneEntity}
                onChange={(e) =>
                  setBindings((p) =>
                    p.map((x, j) => (j === i ? { ...x, backboneEntity: e.target.value } : x)),
                  )
                }
                placeholder="Service Point (pack)"
                className="flex-1 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              />
              <input
                aria-label={`Binding ${i + 1} bound entity`}
                value={row.boundEntity}
                onChange={(e) =>
                  setBindings((p) =>
                    p.map((x, j) => (j === i ? { ...x, boundEntity: e.target.value } : x)),
                  )
                }
                placeholder="Premise"
                className="flex-1 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                aria-label={`Remove binding ${i + 1}`}
                onClick={() => setBindings((p) => p.filter((_, j) => j !== i))}
                className="rounded-md border border-transparent p-1.5 text-[var(--muted)] hover:border-rose-500/40 hover:text-rose-600"
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
          Logical model committed. Submit it for review below.
        </p>
      )}

      <button
        type="button"
        disabled={!canCommit || pending}
        onClick={commit}
        className="self-start rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Committing…" : "Commit logical model"}
      </button>
    </div>
  );
}
