import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { WorkspaceNav } from "@/components/workspace-nav";
import { CatalogCard } from "@/components/catalog-card";
import { PackPanel } from "@/components/pack-panel";
import { NewProduct } from "@/components/new-product";
import { getCurrentUser, rolesInWorkspace } from "@/lib/auth/session";
import { getWorkspaceCatalog } from "@/lib/queries";
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
  const catalog = await getWorkspaceCatalog(slug);
  if (!catalog) notFound();

  const isAdmin = (await rolesInWorkspace(user.id, catalog.workspace.id)).includes(
    "PLATFORM_ADMIN",
  );

  // Load the workspace's active pack. A pack that fails validation must not take
  // the whole page down — the workspace still works, so degrade to a note.
  let pack: Pack | null = null;
  let packError: string | null = null;
  try {
    pack = await loadPack(catalog.workspace.industryPack);
  } catch {
    packError = `Industry pack "${catalog.workspace.industryPack}" could not be loaded or failed validation.`;
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <nav className="text-sm text-[var(--muted)]">
          <Link href="/workspace" className="hover:text-foreground">
            Workspaces
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{catalog.workspace.name}</span>
        </nav>

        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{catalog.workspace.name}</h1>
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
            Control plane
          </span>
        </div>

        <div className="mt-6">
          <WorkspaceNav slug={catalog.workspace.slug} active="catalog" />
        </div>

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
            Data product catalog
          </h2>
          {isAdmin && <NewProduct workspaceSlug={catalog.workspace.slug} />}
        </div>

        {catalog.cards.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--muted)]">No data products in this workspace yet.</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.cards.map((card) => (
              <CatalogCard key={card.id} card={card} workspaceSlug={catalog.workspace.slug} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
