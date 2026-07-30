"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { ProvenanceBadge } from "@/components/badges";
import { draftArtifactAction } from "@/lib/actions";

/**
 * Shared UI for propose-only AI assist (Non-Negotiable 3). The button asks the
 * agent for a draft of an artifact and hands the validated body back to the
 * editor via `onDraft`; nothing is persisted. When assist is not configured the
 * button reports that inline and the editor stays fully usable by hand
 * (Non-Negotiable 6). The banner marks content as an agent draft until the human
 * edits or commits it.
 */
export function AiDraftButton({
  productId,
  kind,
  onDraft,
  label = "Draft with agent",
}: {
  productId: string;
  kind: string;
  onDraft: (draft: unknown) => void;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await draftArtifactAction(productId, kind);
      if (result.ok) {
        onDraft(result.draft);
      } else {
        // An absent provider is guidance, not an error — keep it low-key.
        setMessage({ tone: result.unavailable ? "info" : "error", text: result.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 self-start rounded-md border border-violet-500/50 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-violet-500/20 disabled:opacity-50 dark:text-violet-300"
      >
        <Sparkles size={14} aria-hidden />
        {pending ? "Drafting…" : label}
      </button>
      {message && (
        <p
          role={message.tone === "error" ? "alert" : undefined}
          className={`text-xs ${
            message.tone === "error"
              ? "text-rose-600 dark:text-rose-400"
              : "text-[var(--muted)]"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

/** Marks the surrounding editor content as an unaccepted agent draft. */
export function AiDraftBanner() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-violet-500/40 bg-violet-500/5 p-3 text-xs text-violet-700 dark:text-violet-300">
      <Sparkles size={14} aria-hidden className="mt-0.5 shrink-0" />
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-2">
          <ProvenanceBadge provenance="AI_DRAFT" />
          <span className="font-medium">Agent draft — not yet yours</span>
        </span>
        <span>
          Review and edit before committing. Editing any field makes it your own; committing records
          it as human-authored. The agent never approves anything.
        </span>
      </span>
    </div>
  );
}
