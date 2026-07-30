"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { commitDataContractAction } from "@/lib/actions";
import { AiDraftButton, AiDraftBanner } from "@/components/ai-draft";

/**
 * Stage-5 authoring: the data contract. Version and deprecation policy are
 * required — a contract a consumer cannot rely on across changes is not a
 * contract.
 */
interface FieldRow {
  name: string;
  type: string;
  required: boolean;
}
interface ThresholdRow {
  rule: string;
  threshold: string;
}

export function DataContractEditor({ productId }: { productId: string }) {
  const [version, setVersion] = useState("1.0.0");
  const [fields, setFields] = useState<FieldRow[]>([{ name: "", type: "", required: true }]);
  const [freshness, setFreshness] = useState("");
  const [availability, setAvailability] = useState("");
  const [thresholds, setThresholds] = useState<ThresholdRow[]>([]);
  const [deprecationPolicy, setDeprecationPolicy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [aiDrafted, setAiDrafted] = useState(false);
  const [pending, startTransition] = useTransition();

  function applyDraft(draft: unknown) {
    const d = draft as Partial<{
      version: string;
      fields: FieldRow[];
      sla: { freshness?: string; availability?: string };
      qualityThresholds: ThresholdRow[];
      deprecationPolicy: string;
    }>;
    if (d.version) setVersion(d.version);
    if (d.fields?.length) {
      setFields(
        d.fields.map((f) => ({
          name: f.name ?? "",
          type: f.type ?? "",
          required: f.required ?? true,
        })),
      );
    }
    if (d.sla?.freshness !== undefined) setFreshness(d.sla.freshness);
    if (d.sla?.availability !== undefined) setAvailability(d.sla.availability);
    if (d.qualityThresholds?.length) setThresholds(d.qualityThresholds);
    if (typeof d.deprecationPolicy === "string") setDeprecationPolicy(d.deprecationPolicy);
    setDone(false);
    setAiDrafted(true);
  }

  const validFields = fields.filter((f) => f.name.trim() && f.type.trim());
  const canCommit = version.trim() && freshness.trim() && deprecationPolicy.trim() && validFields.length > 0;

  function commit() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await commitDataContractAction(productId, {
        version: version.trim(),
        fields: validFields,
        sla: { freshness: freshness.trim(), availability: availability.trim() },
        qualityThresholds: thresholds.filter((t) => t.rule.trim() && t.threshold.trim()),
        deprecationPolicy: deprecationPolicy.trim(),
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
      <AiDraftButton productId={productId} kind="DATA_CONTRACT" onDraft={applyDraft} />
      {aiDrafted && <AiDraftBanner />}
      <label className="flex flex-col gap-1 text-sm sm:max-w-40">
        <span className="text-[var(--muted)]">Version (semver)</span>
        <input
          aria-label="Contract version"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="1.0.0"
          className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Schema fields</span>
          <button
            type="button"
            onClick={() => setFields((r) => [...r, { name: "", type: "", required: true }])}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
          >
            <Plus size={12} aria-hidden /> Add field
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {fields.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label={`Field ${i + 1} name`}
                value={f.name}
                onChange={(e) =>
                  setFields((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="outage_id"
                className="flex-1 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              />
              <input
                aria-label={`Field ${i + 1} type`}
                value={f.type}
                onChange={(e) =>
                  setFields((p) => p.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))
                }
                placeholder="string"
                className="w-32 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  aria-label={`Field ${i + 1} required`}
                  checked={f.required}
                  onChange={(e) =>
                    setFields((p) =>
                      p.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)),
                    )
                  }
                />
                required
              </label>
              {fields.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove field ${i + 1}`}
                  onClick={() => setFields((p) => p.filter((_, j) => j !== i))}
                  className="rounded-md border border-transparent p-1.5 text-[var(--muted)] hover:border-rose-500/40 hover:text-rose-600"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">SLA — freshness</span>
          <input
            aria-label="SLA freshness"
            value={freshness}
            onChange={(e) => setFreshness(e.target.value)}
            placeholder="< 5 minutes behind source"
            className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">SLA — availability (optional)</span>
          <input
            aria-label="SLA availability"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="99.9%"
            className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
          />
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Quality thresholds (optional)</span>
          <button
            type="button"
            onClick={() => setThresholds((r) => [...r, { rule: "", threshold: "" }])}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
          >
            <Plus size={12} aria-hidden /> Add threshold
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {thresholds.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input
                aria-label={`Threshold ${i + 1} rule`}
                value={t.rule}
                onChange={(e) =>
                  setThresholds((p) => p.map((x, j) => (j === i ? { ...x, rule: e.target.value } : x)))
                }
                placeholder="Completeness of outage_id"
                className="flex-1 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              />
              <input
                aria-label={`Threshold ${i + 1} threshold`}
                value={t.threshold}
                onChange={(e) =>
                  setThresholds((p) =>
                    p.map((x, j) => (j === i ? { ...x, threshold: e.target.value } : x)),
                  )
                }
                placeholder=">= 99.5%"
                className="w-40 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                aria-label={`Remove threshold ${i + 1}`}
                onClick={() => setThresholds((p) => p.filter((_, j) => j !== i))}
                className="rounded-md border border-transparent p-1.5 text-[var(--muted)] hover:border-rose-500/40 hover:text-rose-600"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Deprecation policy</span>
        <textarea
          aria-label="Deprecation policy"
          value={deprecationPolicy}
          onChange={(e) => setDeprecationPolicy(e.target.value)}
          rows={2}
          placeholder="Breaking changes get a new major version and 90 days notice to consumers."
          className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
        />
      </label>

      {error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {done && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Data contract committed.</p>
      )}

      <button
        type="button"
        disabled={!canCommit || pending}
        onClick={commit}
        className="self-start rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Committing…" : "Commit data contract"}
      </button>
    </div>
  );
}
