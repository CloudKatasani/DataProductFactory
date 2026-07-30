import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bot, ShieldCheck, Sparkles, User } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { WorkspaceNav } from "@/components/workspace-nav";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspaceCatalog } from "@/lib/queries";
import { STAGES, stageAllowsAutomation } from "@/lib/lifecycle/stages";
import { hasArtifactSchema } from "@/lib/artifacts/schemas";
import { VETO_ROLES } from "@/lib/artifacts/enums";

/**
 * The agent-flow view: the canonical lifecycle laid out as phases, each stage
 * marked with how it is gated (human, veto, automatable) and whether it has
 * agent-assisted authoring. It is a map of the governed pipeline — the same
 * stage registry the engine runs, presented as a diagram.
 */

const PHASES: Array<{ title: string; stages: number[] }> = [
  { title: "Demand & Requirements", stages: [0, 1, 2] },
  { title: "Discovery & Modeling", stages: [3, 4, 5] },
  { title: "Semantics & Build", stages: [6, 7, 8] },
  { title: "Govern, Serve & Operate", stages: [9, 10, 11, 12] },
];

const PRINCIPLES: Array<{ title: string; body: string }> = [
  {
    title: "Consumption-first",
    body: "A data product cannot exist without a named consumer and a blocked decision. Stage 2 is hard-blocked until Stage 1 records one.",
  },
  {
    title: "Human-in-the-loop",
    body: "Exactly one code path can approve a gate, and it requires an authenticated human in a required role. Automation is a human's standing pre-approval, never the agent's.",
  },
  {
    title: "AI is propose-only",
    body: "Every agent draft is marked AI_DRAFT and stays a proposal until a human edits or accepts it. The agent never writes an approved artifact.",
  },
  {
    title: "Classification before access",
    body: "Every attribute carries a sensitivity classification. The Stage 9 governance gate cannot close until the register is 100% classified.",
  },
];

export default async function AgentFlowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { slug } = await params;
  const catalog = await getWorkspaceCatalog(slug);
  if (!catalog) notFound();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <nav className="text-sm text-[var(--muted)]">
          <Link href="/workspace" className="hover:text-foreground">
            Workspaces
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/workspace/${catalog.workspace.slug}`} className="hover:text-foreground">
            {catalog.workspace.name}
          </Link>
        </nav>

        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Agent flow</h1>
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
            determinism before LLM · structured outputs · gated handoffs
          </span>
        </div>

        <div className="mt-6">
          <WorkspaceNav slug={catalog.workspace.slug} active="agent-flow" />
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
          <LegendItem icon={<User size={13} aria-hidden />} label="human gate" />
          <LegendItem
            icon={<ShieldCheck size={13} className="text-rose-500" aria-hidden />}
            label="veto gate (always human)"
          />
          <LegendItem
            icon={<Bot size={13} className="text-sky-500" aria-hidden />}
            label="automatable"
          />
          <LegendItem
            icon={<Sparkles size={13} className="text-violet-500" aria-hidden />}
            label="agent-assisted authoring"
          />
        </div>

        {/* Phase board */}
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {PHASES.map((phase, i) => (
            <section key={phase.title} className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {i + 1} · {phase.title}
              </h2>
              {phase.stages.map((n) => (
                <StageCard key={n} stageNumber={n} />
              ))}
            </section>
          ))}
        </div>

        {/* Principles */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-lg border border-[var(--border)] p-4">
              <h3 className="text-sm font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{p.body}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {label}
    </span>
  );
}

function StageCard({ stageNumber }: { stageNumber: number }) {
  const stage = STAGES.find((s) => s.number === stageNumber);
  if (!stage) return null;

  const isVeto = stage.requiredApprovers.some((r) => VETO_ROLES.includes(r));
  const automatable = stageAllowsAutomation(stage.number);
  const aiAssisted = stage.artifactKinds.some((k) => hasArtifactSchema(k));

  return (
    <div
      className={`rounded-md border bg-[var(--surface)] p-3 ${
        isVeto ? "border-rose-500/40" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[11px] text-[var(--muted)]">Stage {stage.number}</span>
          <h3 className="text-sm font-medium leading-tight">{stage.title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {aiAssisted && <Sparkles size={13} className="text-violet-500" aria-label="agent-assisted" />}
          {isVeto ? (
            <ShieldCheck size={13} className="text-rose-500" aria-label="veto gate" />
          ) : automatable ? (
            <Bot size={13} className="text-sky-500" aria-label="automatable" />
          ) : (
            <User size={13} className="text-[var(--muted)]" aria-label="human gate" />
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {stage.requiredApprovers.map((r) => (
          <span
            key={r}
            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]"
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
