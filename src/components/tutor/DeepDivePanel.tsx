import type { DeepDiveView } from "@/lib/tutor/deepDive";

/**
 * Renders a composed {@link DeepDiveView} — the deeper walk-through revealed by
 * the intro's "Explain in more detail" action. Purely presentational and fully
 * token-themed (no hard-coded colors), so it renders correctly across all six
 * themes in light + dark. The view is composed upstream by `buildDeepDive`, so
 * every concrete number here comes from the level's own solver output.
 *
 * Ends with a primary CTA to proceed into the questions, so a learner who opened
 * the deep dive can start without scrolling back up.
 */
export function DeepDivePanel({
  view,
  onStart,
  startLabel = "Start the questions ▸",
  headingId,
}: {
  view: DeepDiveView;
  onStart: () => void;
  startLabel?: string;
  headingId?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="animate-print-in space-y-4 border-t-2 border-dashed border-accent pt-5"
    >
      <div className="flex items-center justify-between">
        <span id={headingId} className="label text-accent">
          In more detail
        </span>
        <span className="chip border-subtle text-secondary">Deeper walk-through</span>
      </div>

      {view.sections.map((s, i) => (
        <div key={i} className="space-y-2">
          <h3 className="font-display text-base font-semibold text-primary">
            {s.heading}
          </h3>
          {s.body && (
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-secondary">
              {s.body}
            </p>
          )}
          {s.items && s.items.length > 0 && (
            <ol className="list-decimal space-y-1.5 pl-5">
              {s.items.map((item, j) => (
                <li
                  key={j}
                  className="text-[15px] leading-relaxed text-secondary"
                >
                  {item}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}

      {view.answer != null && (
        <div className="border-l-2 border-accent bg-surface-muted px-4 py-3">
          <div className="label text-accent">{view.answerLabel ?? "Answer"}</div>
          <div className="num mt-1 font-display text-base font-semibold text-primary">
            {view.answer}
          </div>
        </div>
      )}

      <button onClick={onStart} className="btn-primary w-full">
        {startLabel}
      </button>
    </section>
  );
}
