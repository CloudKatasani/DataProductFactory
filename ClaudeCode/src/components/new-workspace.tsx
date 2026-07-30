"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createWorkspaceAction } from "@/lib/actions";

/**
 * Self-serve workspace creation. Any signed-in user can create a workspace,
 * choose its industry pack, and becomes its Platform Admin. On success it lands
 * them on the new workspace.
 */
export function NewWorkspace({
  packs,
}: {
  packs: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pack, setPack] = useState(packs[0]?.id ?? "_generic");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createWorkspaceAction({ name, industryPack: pack });
      if (result.ok) router.push(`/workspace/${result.workspaceSlug}`);
      else setError(result.error);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--surface)]"
      >
        <Plus size={14} aria-hidden /> New workspace
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Workspace name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Northeast Grid"
          className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Industry pack</span>
        <select
          value={pack}
          onChange={(e) => setPack(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
        >
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
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
          {pending ? "Creating…" : "Create workspace"}
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
