import Link from "next/link";
import { STAGES } from "@/lib/lifecycle/stages";

/**
 * The lifecycle at a glance. This renders straight from the stage registry, so
 * it is also the cheapest possible proof that the registry is the single source
 * of stage truth: add a stage there and it appears here with no edit.
 *
 * No product data yet — that arrives with the stage-1 vertical slice.
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Data Product Factory</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Thirteen stages, each with a human approval gate. No stage advances without a
          recorded human decision.
        </p>
        <div className="mt-4 flex gap-3 text-sm">
          <Link
            href="/workspace"
            className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background transition hover:opacity-90"
          >
            Open workspaces
          </Link>
          <Link
            href="/review"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 transition hover:bg-[var(--surface)]"
          >
            Review queue
          </Link>
        </div>
      </header>

      <ol className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)]">
        {STAGES.map((stage) => (
          <li
            key={stage.number}
            className="flex items-baseline gap-4 bg-[var(--surface)] px-4 py-3"
          >
            <span className="w-6 shrink-0 text-right font-mono text-sm text-[var(--muted)]">
              {stage.number}
            </span>
            <span className="flex-1 text-sm font-medium">{stage.title}</span>
            <span className="text-xs text-[var(--muted)]">
              {stage.requiredApprovers.length} approver
              {stage.requiredApprovers.length === 1 ? "" : "s"}
              {stage.exitCriteria.length > 0
                ? ` · ${stage.exitCriteria.length} exit criteri${
                    stage.exitCriteria.length === 1 ? "on" : "a"
                  }`
                : ""}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
