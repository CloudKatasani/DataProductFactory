import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { GateStatusBadge } from "@/components/badges";
import { getCurrentUser } from "@/lib/auth/session";
import { getReviewItems } from "@/lib/queries";

/**
 * The reviewer's queue: every gate currently awaiting a decision, across all
 * products. Reviewers live here, so it is deliberately flat and scannable.
 */
export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const items = await getReviewItems();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Review queue</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Gates awaiting a human decision. Only a reviewer holding a required role can approve —
          the assistant never can.
        </p>

        {items.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Nothing is awaiting review right now.</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.gateId}>
                <Link
                  href={`/workspace/${item.workspaceSlug}/product/${item.productSlug}/stage/${item.stageNumber}`}
                  className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:border-foreground/30"
                >
                  <span className="font-mono text-xs text-[var(--muted)]">
                    {item.stageNumber}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{item.productName}</span>
                    <span className="text-xs text-[var(--muted)]">{item.stageTitle}</span>
                  </span>
                  <span className="ml-auto">
                    <GateStatusBadge status={item.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
