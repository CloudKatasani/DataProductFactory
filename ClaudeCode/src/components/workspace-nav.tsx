import Link from "next/link";

/**
 * The control-plane sub-navigation for a workspace: Catalog, Agent flow and
 * Requests. Rendered server-side with the active tab passed in, so it needs no
 * client JS. Requests points at the shared review queue.
 */
export type WorkspaceTab = "catalog" | "agent-flow" | "requests";

export function WorkspaceNav({ slug, active }: { slug: string; active: WorkspaceTab }) {
  const tabs: Array<{ key: WorkspaceTab; label: string; href: string }> = [
    { key: "catalog", label: "Catalog", href: `/workspace/${slug}` },
    { key: "agent-flow", label: "Agent flow", href: `/workspace/${slug}/agent-flow` },
    { key: "requests", label: "Requests", href: "/review" },
  ];

  return (
    <nav className="flex items-center gap-1 border-b border-[var(--border)]">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              isActive
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-[var(--muted)] hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
