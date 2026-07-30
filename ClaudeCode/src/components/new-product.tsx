"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createProductAction } from "@/lib/actions";

/**
 * Platform-Admin-only product creation. On success it lands the admin on the
 * new product's Stage 0, where the workspace.yaml is committed and waiting for
 * their approval — the gate that unlocks Stage 1.
 */
export function NewProduct({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createProductAction(workspaceSlug, { name });
      if (result.ok) {
        router.push(`/workspace/${workspaceSlug}/product/${result.productSlug}/stage/0`);
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--surface)]"
      >
        <Plus size={14} aria-hidden /> New product
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--border)] p-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Product name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Grid Reliability"
          className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) submit();
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!name.trim() || pending}
          onClick={submit}
          className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create product"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm transition hover:bg-[var(--surface)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
