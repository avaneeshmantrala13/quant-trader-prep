import { useMemo, useState } from "react";
import {
  VERIFIED_CATEGORY_LABEL,
  VERIFIED_CATEGORY_ORDER,
  type VerifiedCategory,
} from "@/content/verifiedBank/schema";
import {
  getVerifiedItemCount,
  getVerifiedItems,
} from "@/content/verifiedBank/loader";

/**
 * `/verified-bank` — the human-VERIFIED interview question bank (TASK T9).
 *
 * A browse surface over the pure loader (`@/content/verifiedBank`). Unlike the
 * generator-drawn drills, every item here is a hand-curated, provenance-tagged
 * problem with a full worked solution. Presentational only: filter by category,
 * expand any item to read the derivation. Reachable in Case B via the nav.
 */

type Filter = "all" | VerifiedCategory;

export function VerifiedBankPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const all = useMemo(() => getVerifiedItems(), []);
  const total = useMemo(() => getVerifiedItemCount(), []);

  const visible = useMemo(
    () => (filter === "all" ? all : all.filter((i) => i.category === filter)),
    [all, filter],
  );

  return (
    <div className="space-y-8">
      <header className="panel p-6">
        <span className="label text-accent">Human-verified · Worked solutions</span>
        <h1 className="mt-1 font-display text-3xl font-black text-primary sm:text-4xl">
          Verified Question Bank
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
          {total} curated, provenance-tagged interview problems — each reviewed
          for original phrasing and shipped with a complete worked derivation.
          Filter by genre and expand any item to study the full solution.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1 text-muted">Category</span>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        {VERIFIED_CATEGORY_ORDER.map((c) => (
          <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {VERIFIED_CATEGORY_LABEL[c]}
          </FilterChip>
        ))}
      </div>

      <ul className="space-y-3">
        {visible.map((item) => {
          const open = openId === item.id;
          return (
            <li key={item.id} className="panel-ruled p-5">
              <button
                onClick={() => setOpenId(open ? null : item.id)}
                className="flex w-full items-start justify-between gap-4 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip border-accent text-accent">
                      {VERIFIED_CATEGORY_LABEL[item.category]}
                    </span>
                    <span className="label text-muted">{item.difficulty}</span>
                    {item.provenance.firm && (
                      <span className="label text-secondary">{item.provenance.firm}</span>
                    )}
                  </div>
                  <p className="mt-2 text-[15px] leading-snug text-primary">
                    {item.prompt}
                  </p>
                </div>
                <span className="label text-accent">{open ? "Hide" : "Solve"}</span>
              </button>

              {open && (
                <div className="mt-4 space-y-3 border-t border-subtle pt-4">
                  <p className="label text-bull">
                    Answer: <span className="num text-primary">{String(item.answer)}</span>
                  </p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                    {item.workedSolution}
                  </p>
                  <p className="label text-[10px] text-muted">
                    {item.provenance.genre}
                    {item.tags.length > 0 && ` · ${item.tags.join(" · ")}`}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="panel-ruled p-6 text-center text-sm text-secondary">
          No verified items in that category yet.
        </p>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip transition-colors ${
        active
          ? "border-accent bg-accent text-accent-contrast"
          : "border-subtle text-secondary hover:border-accent hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
