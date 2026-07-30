"use client";

import { useState, useTransition } from "react";
import { Bot, ShieldCheck, User } from "lucide-react";
import { setGateModeAction } from "@/lib/actions";
import type { GateMode } from "@/lib/artifacts/enums";

/**
 * The per-gate approval-mode control. MANUAL is the default — a human approver
 * clicks approve. AUTOMATED auto-approves when exit criteria pass, on behalf of
 * the human who enabled it. Only a member holding every required approver role
 * can switch a (non-veto) gate to AUTOMATED; the server re-checks regardless
 * (Non-Negotiable 2 — a hidden button is not a control).
 */
export function GateModeControl({
  gateId,
  mode,
  automatable,
  automationByName,
  canToggle,
}: {
  gateId: string;
  mode: GateMode;
  automatable: boolean;
  automationByName: string | null;
  canToggle: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setMode(next: GateMode) {
    setError(null);
    startTransition(async () => {
      const result = await setGateModeAction(gateId, next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {mode === "AUTOMATED" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/50 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">
            <Bot size={13} aria-hidden /> Automated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
            <User size={13} aria-hidden /> Manual approval
          </span>
        )}
        {mode === "AUTOMATED" && automationByName && (
          <span className="text-xs text-[var(--muted)]">
            Auto-approves on behalf of {automationByName} when exit criteria pass.
          </span>
        )}
      </div>

      {!automatable ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <ShieldCheck size={13} aria-hidden />
          This gate holds a veto role and always requires a human — it cannot be automated.
        </p>
      ) : canToggle ? (
        <div>
          {mode === "AUTOMATED" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("MANUAL")}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm transition hover:bg-[var(--surface)] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Require manual approval"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("AUTOMATED")}
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:bg-sky-500/20 disabled:opacity-50 dark:text-sky-300"
            >
              <Bot size={14} aria-hidden />
              {pending ? "Saving…" : "Automate this gate"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          Only a member holding every required approver role for this stage can automate it.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
