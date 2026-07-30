import Link from "next/link";
import { ArrowRight, Columns3, Database, Tag } from "lucide-react";
import { SensitivityBadge } from "@/components/badges";
import { STAGES } from "@/lib/lifecycle/stages";
import type { CatalogCard as CatalogCardModel } from "@/lib/queries";

/**
 * A single data product in the control-plane catalog. Everything shown is
 * derived from committed state — classification, counts, grain and the charter's
 * value hypothesis — so the card is a true summary, not decoration.
 */
export function CatalogCard({ card, workspaceSlug }: { card: CatalogCardModel; workspaceSlug: string }) {
  const base = `/workspace/${workspaceSlug}/product/${card.slug}`;
  const tags = [card.archetype, card.tier].filter((t): t is string => !!t);

  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-foreground/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-xs text-[var(--muted)]">{card.code}</span>
          <h3 className="truncate font-medium">{card.name}</h3>
        </div>
        <SensitivityBadge sensitivity={card.sensitivity} />
      </div>

      <p className="mt-2 line-clamp-3 min-h-[2.5rem] text-sm text-[var(--muted)]">
        {card.description ?? "No charter value hypothesis yet."}
      </p>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--muted)]"
            >
              <Tag size={10} aria-hidden />
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1">
          <Columns3 size={12} aria-hidden />
          {card.attributeCount} attr{card.attributeCount === 1 ? "" : "s"}
        </span>
        {card.fieldCount > 0 && (
          <span className="inline-flex items-center gap-1">
            {card.fieldCount} contract field{card.fieldCount === 1 ? "" : "s"}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Database size={12} aria-hidden />
          {card.sourceCount} source{card.sourceCount === 1 ? "" : "s"}
        </span>
      </div>

      {card.grain && (
        <p className="mt-2 truncate font-mono text-[11px] text-[var(--muted)]" title={card.grain}>
          {card.grain}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
        <span className="text-xs text-[var(--muted)]">
          {card.approvedStages}/{STAGES.length} stages approved · at stage {card.currentStage}
        </span>
        <Link
          href={base}
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
        >
          Open
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
