"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actions";

/**
 * A button that runs a bound server action, shows a pending state, and surfaces
 * a typed governance failure inline instead of throwing it away. Governance
 * errors are meant to be read by a reviewer, so we render the message.
 */
export function ActionButton({
  action,
  children,
  variant = "default",
  confirm,
  className = "",
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: "default" | "primary" | "danger" | "subtle";
  confirm?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const styles: Record<string, string> = {
    primary:
      "bg-foreground text-background hover:opacity-90 border-transparent",
    default: "border-[var(--border)] hover:bg-[var(--surface)]",
    subtle: "border-transparent text-[var(--muted)] hover:text-foreground",
    danger:
      "border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10",
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (!result.ok) setError(result.error);
          });
        }}
        className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles[variant]} ${className}`}
      >
        {pending ? "Working…" : children}
      </button>
      {error && (
        <span role="alert" className="max-w-prose text-xs text-rose-600 dark:text-rose-400">
          {error}
        </span>
      )}
    </span>
  );
}
