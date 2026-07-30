import { Boxes, Landmark, Ruler, Gauge } from "lucide-react";
import type { Pack } from "@/lib/packs/schema";

/**
 * Renders a workspace's active industry pack. This is the first place packs are
 * *consumed* rather than just validated — proof that industry specifics are data
 * the app reads (Non-Negotiable 11), not branches in the code.
 */
export function PackPanel({ pack }: { pack: Pack }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Industry pack</h2>
        <span className="font-mono text-xs text-[var(--muted)]">
          {pack.id} v{pack.version}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium">{pack.name}</p>
      {pack.description && (
        <p className="mt-1 max-w-prose text-xs text-[var(--muted)]">{pack.description}</p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <PackGroup icon={<Boxes size={14} aria-hidden />} title="Domains">
          {pack.domains.map((d) => (
            <li key={d.id} title={d.description}>
              {d.name}
            </li>
          ))}
        </PackGroup>

        <PackGroup icon={<Ruler size={14} aria-hidden />} title="Conformed backbone">
          {pack.conformedBackbone.map((e) => (
            <li key={e.id} title={e.grain}>
              {e.name}
            </li>
          ))}
        </PackGroup>

        <PackGroup icon={<Landmark size={14} aria-hidden />} title="Regulatory constraints">
          {pack.regulatoryConstraints.length === 0 ? (
            <li className="text-[var(--muted)]">None</li>
          ) : (
            pack.regulatoryConstraints.map((c) => (
              <li key={c.id} title={c.note}>
                {c.name}{" "}
                <span className="text-xs text-[var(--muted)]">≥ {c.minimumSensitivity}</span>
              </li>
            ))
          )}
        </PackGroup>

        <PackGroup icon={<Gauge size={14} aria-hidden />} title="Starter metrics">
          {pack.starterMetrics.map((m) => (
            <li key={m.id} title={m.definition}>
              {m.name}
            </li>
          ))}
        </PackGroup>
      </div>
    </section>
  );
}

function PackGroup({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {icon}
        {title}
      </div>
      <ul className="flex flex-col gap-0.5 text-sm">{children}</ul>
    </div>
  );
}
