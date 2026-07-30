import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PackPanel } from "@/components/pack-panel";
import { NewProduct } from "@/components/new-product";
import { getCurrentUser, rolesInWorkspace } from "@/lib/auth/session";
import { getWorkspaceView } from "@/lib/queries";
import { STAGES } from "@/lib/lifecycle/stages";
import { loadPack } from "@/lib/packs/loader";
import type { Pack } from "@/lib/packs/schema";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { slug } = await params;
  const view = await getWorkspaceView(slug);
  if (!view) notFound();

  const isAdmin = (await rolesInWorkspace(user.id, view.workspace.id)).includes("PLATFORM_ADMIN");

  // Load the workspace's active pack. A pack that fails validation must not take
  // the whole page down — the workspace still works, so degrade to a note.
  let pack: Pack | null = null;
  let packError: string | null = null;
  try {
    pack = await loadPack(view.workspace.industryPack);
  } catch {
    packError = `Industry pack "${view.workspace.industryPack}" could not be loaded or failed validation.`;
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <nav className="text-sm text-[var(--muted)]">
          <Link href="/workspace" className="hover:text-foreground">
            Workspaces
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{view.workspace.name}</span>
        </nav>

        <h1 className="mt-2 text-xl font-semibold tracking-tight">{view.workspace.name}</h1>

        <div className="mt-6">
          {pack ? (
            <PackPanel pack={pack} />
          ) : (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
              {packError}
            </p>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Products
          </h2>
          {isAdmin && <NewProduct workspaceSlug={view.workspace.slug} />}
        </div>

        {view.products.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--muted)]">No products in this workspace yet.</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {view.products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/workspace/${view.workspace.slug}/product/${p.slug}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-foreground/30"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="mt-0.5 text-xs text-[var(--muted)]">
                      Currently at stage {p.currentStage} · {STAGES[p.currentStage]?.title}
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--muted)]">
                    {p.approvedStages}/{STAGES.length} stages approved
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
