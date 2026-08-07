import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { resolveGoalMode } from "@/lib/mode/goalMode";
import {
  deckForMode,
  indexDeck,
  type SrsCardContent,
} from "@/lib/srs/deck";
import {
  buildReviewQueue,
  coerceSrsStore,
  dueCount,
  graduatedCount,
} from "@/lib/srs/store";
import type { SrsGrade } from "@/lib/srs/schedule";

/**
 * `/review` — the Spaced-Repetition review surface (T14 retention).
 *
 * Mode-aware by design (the research scoping):
 *  • Case A (course mastery): a BROAD deck of concept / key-idea / worked-
 *    procedure recall cards drawn from the probability & stochastic-processes
 *    course content — SRS is the primary retention engine here.
 *  • Case B (interview): a NARROW, MIXED (interleaved) FACT-CORE deck only —
 *    conversions, squares/cubes/powers, primes, log/root anchors, prob/EV/
 *    combinatorics identities, nCk, and de-vig heuristics. SRS COMPLEMENTS speed
 *    practice: own the facts cold here, then the Speed Arena adds the clock.
 *
 * Grading runs through the pure SM-2 scheduler (`src/lib/srs`) and persists
 * absolute wall-clock due timestamps via `gradeSrsCard`. It stays in its OWN
 * lane — it never folds into the adaptive-engine mastery / unlock / relock path,
 * so a self-graded recall can't corrupt the diagnostic-seeded mastery signal.
 * Progress is instead surfaced natively (due count, cards reviewed, cards
 * graduated) and, for fact cards, a "graduate to timed" link into the Arena.
 */

/** The four recall grades exposed as buttons, mapped to SM-2 grades. */
const GRADE_BUTTONS: { label: string; grade: SrsGrade; tone: string }[] = [
  { label: "Again", grade: 1, tone: "bg-bear text-bg" },
  { label: "Hard", grade: 3, tone: "border border-border-strong text-primary" },
  { label: "Good", grade: 4, tone: "bg-accent text-accent-contrast" },
  { label: "Easy", grade: 5, tone: "bg-bull text-bg" },
];

interface ReviewCardViewProps {
  card: SrsCardContent;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: SrsGrade) => void;
}

/** Pure card presenter: prompt → reveal → grade. Easy to render in tests. */
export function ReviewCardView({
  card,
  revealed,
  onReveal,
  onGrade,
}: ReviewCardViewProps) {
  return (
    <div className="panel p-6">
      <div className="label text-muted">{card.category}</div>
      <p
        className="mt-3 whitespace-pre-line text-lg font-semibold text-primary"
        data-testid="srs-front"
      >
        {card.front}
      </p>

      {revealed ? (
        <>
          <div className="mt-5 border-t border-subtle pt-4">
            <div className="label text-muted">Answer</div>
            <p
              className="mt-2 whitespace-pre-line text-base text-secondary"
              data-testid="srs-back"
            >
              {card.back}
            </p>
          </div>
          <div className="mt-6">
            <div className="label text-muted">How well did you recall it?</div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADE_BUTTONS.map((b) => (
                <button
                  key={b.grade}
                  type="button"
                  onClick={() => onGrade(b.grade)}
                  className={`btn ${b.tone}`}
                  data-testid={`srs-grade-${b.grade}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={onReveal}
          className="btn btn-primary mt-6"
          data-testid="srs-reveal"
        >
          Show answer
        </button>
      )}
    </div>
  );
}

export function ReviewPage() {
  const { progress, ensureSrsCardsSeeded, gradeSrsCard } = useProgress();
  const mode = resolveGoalMode(progress);

  // Deck content is deterministic per mode; index it for O(1) lookups.
  const deck = useMemo(() => deckForMode(mode), [mode]);
  const cardById = useMemo(() => indexDeck(deck), [deck]);
  const cardIds = useMemo(() => deck.map((c) => c.id), [deck]);

  // One stable `now` per mount so due checks / the queue don't flicker.
  const now = useMemo(() => Date.now(), []);
  const store = coerceSrsStore(progress.srs);

  // The review queue is captured ONCE at session start (keyed by mode) so it
  // doesn't reshuffle out from under the learner as each card is graded. The
  // "Start a session" action rebuilds it from the freshest store.
  const [queue, setQueue] = useState<string[]>(() =>
    buildReviewQueue(store, cardIds, now),
  );
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedThisSession, setReviewedThisSession] = useState(0);

  const startSession = useCallback(() => {
    const fresh = buildReviewQueue(coerceSrsStore(progress.srs), cardIds, Date.now());
    // Seed the whole deck's scheduling rows up front so first-ever cards persist
    // as tracked even if the learner leaves mid-session.
    ensureSrsCardsSeeded(cardIds);
    setQueue(fresh);
    setPos(0);
    setRevealed(false);
    setReviewedThisSession(0);
  }, [progress.srs, cardIds, ensureSrsCardsSeeded]);

  const grade = useCallback(
    (g: SrsGrade) => {
      const id = queue[pos];
      if (!id) return;
      gradeSrsCard(id, g, Date.now());
      setReviewedThisSession((n) => n + 1);
      setPos((p) => p + 1);
      setRevealed(false);
    },
    [queue, pos, gradeSrsCard],
  );

  const totalDue = dueCount(store, cardIds, now);
  const graduated = graduatedCount(store, cardIds);
  const current = pos < queue.length ? cardById[queue[pos]] : undefined;
  const isFactCore = mode === "course" ? false : true;

  const heading = mode === "course" ? "Course Review" : "Fact-Core Review";
  const subhead =
    mode === "course"
      ? "Spaced repetition over your probability & stochastic-processes course: concepts, key formulas, and worked procedures, resurfaced right before you'd forget them."
      : "Spaced repetition over the memorizable fact core every quant should own cold: conversions, squares, anchors, identities, and de-vig heuristics, served as one mixed deck.";

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <div className="label text-muted">Spaced Repetition</div>
        <h1 className="mt-1 font-display text-3xl font-black text-primary">
          {heading}
        </h1>
        <p className="mt-2 text-sm text-secondary">{subhead}</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <div className="panel p-4">
          <div className="label text-muted">Due now</div>
          <div className="num mt-1 text-2xl font-semibold text-primary" data-testid="srs-due-count">
            {totalDue}
          </div>
        </div>
        <div className="panel p-4">
          <div className="label text-muted">Reviewed</div>
          <div className="num mt-1 text-2xl font-semibold text-primary">
            {store.reviews}
          </div>
        </div>
        <div className="panel p-4">
          <div className="label text-muted">Graduated</div>
          <div className="num mt-1 text-2xl font-semibold text-primary">
            {graduated}
          </div>
        </div>
      </div>

      <section className="mt-6">
        {current ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="label text-muted">
                Card {pos + 1} of {queue.length}
              </span>
              <span className="label text-muted" data-testid="srs-session-count">
                {reviewedThisSession} reviewed
              </span>
            </div>
            <ReviewCardView
              card={current}
              revealed={revealed}
              onReveal={() => setRevealed(true)}
              onGrade={grade}
            />
          </>
        ) : (
          <div className="panel p-6 text-center" data-testid="srs-empty">
            <p className="text-lg font-semibold text-primary">
              {reviewedThisSession > 0
                ? "Session complete. Nice work."
                : totalDue > 0
                  ? "Ready when you are."
                  : "Nothing due right now."}
            </p>
            <p className="mt-2 text-sm text-secondary">
              {totalDue > 0
                ? `${totalDue} card${totalDue === 1 ? "" : "s"} due. Start a focused session below.`
                : "Every scheduled card is ahead of its due date. Come back later, or start a session to review ahead."}
            </p>
            <button
              type="button"
              onClick={startSession}
              className="btn btn-primary mt-4"
              data-testid="srs-start"
            >
              {totalDue > 0 ? "Start review session" : "Review ahead"}
            </button>
          </div>
        )}
      </section>

      {isFactCore && (
        <section className="mt-6">
          <div className="panel p-4">
            <div className="label text-muted">Graduate to timed</div>
            <p className="mt-2 text-sm text-secondary">
              Own these facts cold here, then add the clock: the Speed Arena
              turns your fact core into fast, accurate mental math under
              pressure.
              {graduated > 0
                ? ` You've graduated ${graduated} fact${graduated === 1 ? "" : "s"} to long-term memory. Take them to the Arena.`
                : ""}
            </p>
            <Link to="/arena" className="btn mt-3 inline-block border border-border-strong text-primary">
              Go to Speed Arena →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
