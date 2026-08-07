import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { resolveGoalMode } from "@/lib/mode/goalMode";
import { deckCardIds } from "@/lib/srs/deck";
import { coerceSrsStore, dueCount, graduatedCount } from "@/lib/srs/store";

/**
 * SrsReviewPanelView — PURE presentational widget for the dashboard's
 * spaced-repetition surface. Shows the due-count headline + a call to the
 * `/review` session, mode-aware. Takes fully-computed numbers so it's trivial
 * to test without seeding a store.
 */
export function SrsReviewPanelView({
  mode,
  due,
  reviews,
  graduated,
}: {
  mode: "course" | "interview";
  due: number;
  reviews: number;
  graduated: number;
}) {
  const title = mode === "course" ? "Course Review" : "Fact-Core Review";
  const blurb =
    mode === "course"
      ? "Spaced repetition over your course concepts, formulas, and procedures: the primary way to make them stick."
      : "Spaced repetition over the fact core (conversions, squares, anchors, identities, de-vig). Own them cold, then take them to the Speed Arena.";

  return (
    <div className="panel p-5" data-testid="srs-panel">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <p className="mt-1 text-sm text-secondary">{blurb}</p>
        </div>
        <Link to="/review" className="btn btn-primary shrink-0">
          {due > 0 ? `Review ${due} due` : "Review"}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="panel p-4">
          <div className="label text-muted">Due now</div>
          <div className="num mt-1 text-2xl font-semibold text-primary" data-testid="srs-panel-due">
            {due}
          </div>
        </div>
        <div className="panel p-4">
          <div className="label text-muted">Reviewed</div>
          <div className="num mt-1 text-2xl font-semibold text-primary">{reviews}</div>
        </div>
        <div className="panel p-4">
          <div className="label text-muted">Graduated</div>
          <div className="num mt-1 text-2xl font-semibold text-primary">{graduated}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * SrsReviewPanel — the container. Renders in BOTH modes (SRS ships in both,
 * scoped differently by mode). Computes the due / reviewed / graduated counts
 * over the deterministic mode-scoped deck and hands them to the pure view.
 */
export function SrsReviewPanel() {
  const { progress } = useProgress();
  const mode = resolveGoalMode(progress);

  const { due, reviews, graduated } = useMemo(() => {
    const store = coerceSrsStore(progress.srs);
    const ids = deckCardIds(mode);
    return {
      due: dueCount(store, ids, Date.now()),
      reviews: store.reviews,
      graduated: graduatedCount(store, ids),
    };
  }, [progress.srs, mode]);

  return (
    <section className="mx-auto max-w-6xl px-4 pb-8">
      <SrsReviewPanelView
        mode={mode}
        due={due}
        reviews={reviews}
        graduated={graduated}
      />
    </section>
  );
}
