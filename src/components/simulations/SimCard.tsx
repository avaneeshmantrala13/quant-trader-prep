/**
 * SimCard — the themed wrapper every simulation is placed in. Renders a titled
 * panel with an editorial "What this shows" eyebrow + caption, optional topic
 * chips, and the interactive body (controls + chart) as children.
 *
 * The `id` is the stable catalog anchor: it becomes the `<section>` DOM id and
 * the `/simulations#<id>` hash-scroll target. `scroll-mt-28` keeps the anchor
 * clear of the sticky-ish page header when navigating by hash.
 */
import type { ReactNode } from "react";

export interface SimCardProps {
  /** Stable anchor id (from the sim catalog) — the section DOM id + hash target. */
  id: string;
  title: string;
  /** One-line "what this shows" caption. */
  whatShows: string;
  topics?: string[]; // optional chips
  children: ReactNode; // the interactive controls + chart
  /**
   * Optional "How to read this" legend rendered as a subtle footer note under
   * the interactive body. Use it for the one plain sentence that explains what
   * the chart's key marks mean / what increasing trials does — the inline
   * arrow callouts handle pointing at specific marks. Additive & back-compat:
   * omit it and the card renders exactly as before.
   */
  howToRead?: ReactNode;
}

export function SimCard(props: SimCardProps): JSX.Element {
  const { id, title, whatShows, topics, children, howToRead } = props;

  return (
    <section id={id} className="panel p-5 scroll-mt-28">
      <div className="space-y-4">
        <header className="space-y-2">
          <h3 className="font-display text-xl font-bold text-primary">
            {title}
          </h3>
          <div className="space-y-1">
            <div className="label text-accent">What this shows</div>
            <p className="text-sm text-secondary">{whatShows}</p>
          </div>
          {topics && topics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => (
                <span key={t} className="chip text-secondary">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </header>
        {children}
        {howToRead ? (
          <div className="border-t border-subtle pt-3">
            <div className="label text-accent">How to read this</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {howToRead}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
