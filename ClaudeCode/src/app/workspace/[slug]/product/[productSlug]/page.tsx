import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { GateStatusBadge } from "@/components/badges";
import { getCurrentUser } from "@/lib/auth/session";
import { getProductView } from "@/lib/queries";

export default async function ProductBoardPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { slug, productSlug } = await params;
  const view = await getProductView(slug, productSlug);
  if (!view) notFound();

  const base = `/workspace/${view.workspace.slug}/product/${view.product.slug}`;

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <nav className="text-sm text-[var(--muted)]">
          <Link href="/workspace" className="hover:text-foreground">
            Workspaces
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/workspace/${view.workspace.slug}`} className="hover:text-foreground">
            {view.workspace.name}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{view.product.name}</span>
        </nav>

        <h1 className="mt-2 text-xl font-semibold tracking-tight">{view.product.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Thirteen gated stages. A stage unlocks only when every prior gate is approved.
        </p>

        <ol className="mt-6 flex flex-col gap-2">
          {view.stages.map((stage) => {
            const locked = !stage.unlocked;
            const body = (
              <div
                className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
                  locked
                    ? "border-[var(--border)] opacity-60"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-foreground/30"
                }`}
              >
                <span className="w-6 shrink-0 text-right font-mono text-sm text-[var(--muted)]">
                  {stage.number}
                </span>
                <span className="flex-1 text-sm font-medium">
                  {stage.title}
                  {stage.artifacts.some((a) => a.provenance === "AI_DRAFT") && (
                    <span className="ml-2 align-middle text-xs text-violet-500">contains AI draft</span>
                  )}
                </span>
                {locked && stage.blockingStage !== null ? (
                  <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                    <Lock size={12} aria-hidden /> stage {stage.blockingStage}
                  </span>
                ) : null}
                <GateStatusBadge status={stage.status} />
              </div>
            );

            return (
              <li key={stage.number}>
                {locked ? (
                  <div aria-disabled title={`Locked by stage ${stage.blockingStage}`}>{body}</div>
                ) : (
                  <Link href={`${base}/stage/${stage.number}`}>{body}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </main>
    </>
  );
}
