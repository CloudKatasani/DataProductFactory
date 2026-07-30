import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { NewWorkspace } from "@/components/new-workspace";
import { getCurrentUser } from "@/lib/auth/session";
import { listAvailablePacks, listWorkspaces } from "@/lib/queries";

export default async function WorkspacesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [workspaces, packs] = await Promise.all([listWorkspaces(), listAvailablePacks()]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Workspaces</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Each workspace runs one industry pack. Industry behaviour is data, not code.
            </p>
          </div>
          <NewWorkspace packs={packs} />
        </div>

        {workspaces.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--muted)]">
            No workspaces yet. Use <span className="font-medium">New workspace</span> above to
            create one, or run <code className="font-mono">pnpm db:seed</code> for the demo.
          </p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/workspace/${w.slug}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-foreground/30"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{w.name}</span>
                    <span className="font-mono text-xs text-[var(--muted)]">{w.industryPack}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {w._count.products} product{w._count.products === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
