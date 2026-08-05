import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import { celebrate } from "@/lib/celebrate";
import { isLevelUnlockedBySection } from "@/lib/locking";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import { parseFreeResponse } from "@/lib/numeric";
import { isFlashcardLevelComplete } from "@/lib/progressOps";
import {
  canRegenerateFlashcard,
  flashcardSignature,
  freshPracticeSeed,
  generateFreshFlashcard,
} from "@/lib/regenerate";
import { buildDeepDive, hasDeepDive } from "@/lib/tutor/deepDive";
import { DeepDivePanel } from "@/components/tutor/DeepDivePanel";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { StampSeal } from "@/components/visuals/StampSeal";
import { ChevronLeftIcon } from "@/components/icons";
import type { Flashcard, Level, Track } from "@/types/content";

/* -------------------------------------------------------------------------- */
/*  Flashcard (integrity-based) level player — brainteasers.                   */
/*  No multiple choice, no scoring: read → reveal → self-assess.              */
/* -------------------------------------------------------------------------- */

type FlashPhase = "lesson" | "cards" | "done";

/**
 * A flashcard is OBJECTIVE-GRADABLE (T7) iff it declares `gradable: true` AND
 * carries a closed-form `numericAnswer`. Those run the commit-then-reveal flow
 * and emit ONE `recordItemAttempt` per committed non-bonus card; everything else
 * keeps the pure reveal + self-assess flow and records no graded evidence.
 */
function isGradableFlashcard(
  card: Flashcard,
): card is Flashcard & { numericAnswer: number } {
  return card.gradable === true && typeof card.numericAnswer === "number";
}

/**
 * Grade a committed free-response entry against a gradable card's closed-form
 * answer using the tolerant `@/lib/numeric` parser (fractions / percents /
 * simple expressions all parse) and an absolute `tolerance` window. Returns the
 * parsed value (null when unparseable) and whether it counts as correct.
 */
function gradeFlashcardEntry(
  card: Flashcard & { numericAnswer: number },
  raw: string,
): { value: number | null; correct: boolean } {
  const value = parseFreeResponse(raw);
  if (value === null) return { value: null, correct: false };
  const tol = Math.abs(card.tolerance ?? 0);
  // `1e-9` absorbs floating-point noise so an exact integer answer with
  // `tolerance: 0` still accepts the exact typed value.
  const correct = Math.abs(value - card.numericAnswer) <= tol + 1e-9;
  return { value, correct };
}

export function FlashcardLevel({ track, level }: { track: Track; level: Level }) {
  const navigate = useNavigate();
  const {
    getLevelProgress,
    getUnderstood,
    markUnderstood,
    completeFlashcardLevel,
    recordItemAttempt,
  } = useProgress();
  const topicKey = useMemo(
    () => topicKeyForLevel(track.id, level),
    [track.id, level],
  );
  const { themeDef } = useTheme();

  const pool = level.flashcards ?? [];
  const poolIds = useMemo(() => pool.map((c) => c.id), [level.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Run-wide dedup for bonus cards: differ from every static pool card AND every
  // bonus already generated this session.
  const poolSigs = useMemo(
    () => new Set(pool.map(flashcardSignature)),
    [level.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const bonusSigsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    bonusSigsRef.current = new Set();
  }, [level.id]);

  const levelIndex = track.levels.findIndex((l) => l.id === level.id);
  const unlocked = isLevelUnlockedBySection(
    track.levels,
    levelIndex,
    (id) => !!getLevelProgress(id)?.mastered,
  );

  const [phase, setPhase] = useState<FlashPhase>("lesson");
  const [understood, setUnderstood] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0); // index into `pool`
  const [revealed, setRevealed] = useState(false);
  // The learner's committed free-response for a GRADABLE card (T7). Set on
  // commit (which also reveals) so the graded verdict + their entry can be shown
  // after reveal; null for the pure reveal-then-self-assess (non-gradable) flow.
  const [committed, setCommitted] = useState<{
    value: number | null;
    correct: boolean;
  } | null>(null);
  // A fresh, parametric BONUS card (from `flashcardGenerators`). When non-null it
  // is shown IN PLACE of the pool card, but is completely isolated from mastery:
  // it never enters the `understood` set / streak (same isolation as the
  // quiz/numeric regenerate practice).
  const [generated, setGenerated] = useState<Flashcard | null>(null);
  const [result, setResult] = useState<{
    isNewMastery: boolean;
    xpGained: number;
  } | null>(null);
  const hasGenerators = canRegenerateFlashcard(level);

  // Load the persisted "understood" set and resume at the first unlearned card.
  useEffect(() => {
    const saved = new Set(getUnderstood(level.id));
    setUnderstood(saved);
    const firstUnlearned = pool.findIndex((c) => !saved.has(c.id));
    setCurrent(firstUnlearned === -1 ? 0 : firstUnlearned);
    setRevealed(false);
    setCommitted(null);
    setGenerated(null);
    setResult(null);
    setPhase("lesson");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id]);

  const Illustration = themeDef.getLevelIllustration?.({
    trackId: track.id,
    levelId: level.id,
    levelIndex,
    motif: track.motif,
  });

  if (!unlocked) return <Navigate to={`/track/${track.id}`} replace />;
  if (pool.length === 0) return <Navigate to={`/track/${track.id}`} replace />;

  // The card on screen: a fresh generated BONUS card if one is active, else the
  // current mastery-deck (static pool) card.
  const isBonus = generated !== null;
  const card = generated ?? pool[current];
  const understoodCount = understood.size;

  const complete = () => {
    const r = completeFlashcardLevel(level.id);
    setResult(r);
    setPhase("done");
    setTimeout(themeDef.celebration ?? celebrate, 260);
  };

  // "Got it": for a BONUS generated card this just returns to the mastery deck
  // WITHOUT touching mastery/understood (isolated bonus practice). For a real
  // pool card it marks the problem understood, persists, then either finishes
  // the level (all cards done → auto-advance) or moves to the next unlearned one.
  // COMMIT-THEN-REVEAL (T7). For a GRADABLE card the learner commits a numeric
  // free-response BEFORE seeing the answer; committing grades it, reveals the
  // answer, and — for a real (non-bonus) mastery-deck card — emits EXACTLY ONE
  // graded `ItemAttempt` (mode "flashcard") into the mastery layer via
  // `recordItemAttempt`. Bonus/generated cards reveal the same way but record
  // nothing (isolated practice), and non-gradable cards never reach here.
  const commitGradable = (value: number | null, correct: boolean) => {
    setCommitted({ value, correct });
    if (!isBonus && isGradableFlashcard(card)) {
      recordItemAttempt({
        topicKey,
        tier: level.difficulty,
        correct,
        mode: "flashcard",
        chosenValue: value ?? undefined,
        at: new Date().toISOString(),
      });
    }
    setRevealed(true);
  };

  const gotIt = () => {
    if (isBonus) {
      setGenerated(null);
      setRevealed(false);
      setCommitted(null);
      return;
    }
    const poolCard = pool[current];
    if (!poolCard) return;
    markUnderstood(level.id, poolCard.id);
    const next = new Set(understood);
    next.add(poolCard.id);
    setUnderstood(next);
    if (isFlashcardLevelComplete(next, poolIds)) {
      complete();
      return;
    }
    // Advance to the next not-yet-understood card (wrapping).
    let target = current;
    for (let step = 1; step <= pool.length; step++) {
      const i = (current + step) % pool.length;
      if (!next.has(pool[i].id)) {
        target = i;
        break;
      }
    }
    setCurrent(target);
    setRevealed(false);
    setCommitted(null);
  };

  // "Give me another at this difficulty": when the level has parametric families
  // (the six originals), draw a brand-new, exact-solved card with a FRESH seed —
  // that's the infinite part. Otherwise (static-only levels) fall back to serving
  // a different fixed card from the pool. Either way, marks NOTHING.
  const giveAnother = () => {
    if (hasGenerators) {
      // Button #1 semantics: STRICTLY stay within the CURRENT card's family when
      // it has one (a bonus generated card, resolved/inferred via `lockFamily`);
      // a static pool card has no generator family, so inference returns nothing
      // and we fall back to the original random-family pick. The run-wide
      // avoid-set (all pool cards + earlier bonuses) prevents any repeat.
      const avoid = new Set([...poolSigs, ...bonusSigsRef.current]);
      const fresh = generateFreshFlashcard(
        level,
        freshPracticeSeed(),
        card.family,
        avoid,
        true,
        card,
      );
      if (fresh) {
        bonusSigsRef.current.add(flashcardSignature(fresh));
        setGenerated(fresh);
        setRevealed(false);
        setCommitted(null);
        return;
      }
    }
    setGenerated(null);
    if (pool.length > 1) {
      let i = current;
      while (i === current) i = Math.floor(Math.random() * pool.length);
      setCurrent(i);
    }
    setRevealed(false);
    setCommitted(null);
  };

  const nextLevel = track.levels[levelIndex + 1];
  const goAdvance = () =>
    navigate(
      nextLevel
        ? `/track/${track.id}/level/${nextLevel.id}`
        : `/track/${track.id}`,
    );

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => navigate(`/track/${track.id}`)}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back to map"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-primary">
              {level.title}
            </div>
            {phase === "cards" && (
              <div className="mt-1 h-1.5 w-full border border-subtle bg-surface">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${(understoodCount / pool.length) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
          {phase === "cards" && (
            <span className="num text-xs text-secondary">
              {understoodCount}/{pool.length} got
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6">
        {phase === "lesson" && (
          <LessonIntro
            level={level}
            onStart={() => setPhase("cards")}
            illustration={Illustration ? <Illustration /> : null}
            startLabel="Start Flashcards ▸"
          />
        )}

        {phase === "cards" && card && (
          <FlashCard
            key={card.id + (revealed ? "-r" : "")}
            card={card}
            revealed={revealed}
            bonus={isBonus}
            committed={committed}
            onReveal={() => setRevealed(true)}
            onCommit={commitGradable}
            onGotIt={gotIt}
            onAnother={giveAnother}
            onUnderstandTopic={complete}
          />
        )}

        {phase === "done" && result && (
          <FlashDone
            level={level}
            understoodCount={understoodCount}
            total={pool.length}
            isNewMastery={result.isNewMastery}
            xpGained={result.xpGained}
            nextTitle={nextLevel?.title}
            onAdvance={goAdvance}
            onBack={() => navigate(`/track/${track.id}`)}
          />
        )}
      </main>
    </div>
  );
}

function FlashCard({
  card,
  revealed,
  bonus = false,
  committed,
  onReveal,
  onCommit,
  onGotIt,
  onAnother,
  onUnderstandTopic,
}: {
  card: Flashcard;
  revealed: boolean;
  /** True for a freshly-generated BONUS card (not counted toward mastery). */
  bonus?: boolean;
  /** The learner's committed graded entry (gradable cards only), else null. */
  committed?: { value: number | null; correct: boolean } | null;
  onReveal: () => void;
  /** Commit a graded free-response (gradable cards): grade → reveal → record. */
  onCommit: (value: number | null, correct: boolean) => void;
  onGotIt: () => void;
  onAnother: () => void;
  onUnderstandTopic: () => void;
}) {
  const gradable = isGradableFlashcard(card);
  const [entry, setEntry] = useState("");
  const [entryError, setEntryError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus the commit field the moment a gradable card appears (keyboard-first).
  useEffect(() => {
    if (gradable && !revealed) inputRef.current?.focus();
  }, [gradable, revealed]);

  const tryCommit = () => {
    if (!isGradableFlashcard(card)) return;
    const value = parseFreeResponse(entry);
    if (value === null) {
      setEntryError("Enter a number (e.g. 17, 2/3, or 0.2) before revealing.");
      return;
    }
    const { correct } = gradeFlashcardEntry(card, entry);
    onCommit(value, correct);
  };

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label text-accent">
            {bonus ? "Bonus · Freshly Generated" : "Brainteaser"}
          </span>
          <div className="flex items-center gap-1.5">
            {card.concept && (
              <span className="chip border-subtle text-secondary">
                {card.concept}
              </span>
            )}
            <span className="chip border-subtle text-secondary">
              {card.difficulty}
            </span>
          </div>
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {card.prompt}
        </p>
        {bonus && (
          <p className="mt-2 text-xs text-secondary">
            A brand-new, exact-verified instance of this family — not counted
            toward mastery.
          </p>
        )}
        {card.source && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
            Source · {card.source}
          </p>
        )}
      </div>

      {!revealed ? (
        gradable ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-secondary">
              Work it out, then COMMIT your numeric answer — the reveal unlocks
              once you do. Your commit is graded objectively.
            </p>
            <div className="panel p-5">
              <label
                htmlFor={`flash-commit-${card.id}`}
                className="label text-accent"
              >
                Your answer
              </label>
              <div className="mt-2 flex items-stretch gap-2">
                <div className="flex flex-1 items-center border-2 border-border-strong bg-surface focus-within:border-accent">
                  <input
                    id={`flash-commit-${card.id}`}
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    value={entry}
                    onChange={(e) => {
                      setEntry(e.target.value);
                      if (entryError) setEntryError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") tryCommit();
                    }}
                    placeholder="Type a number, then Enter"
                    aria-label="Your numeric answer"
                    aria-invalid={entryError ? true : undefined}
                    className="num min-h-[44px] w-full bg-transparent px-3 py-2 text-lg font-semibold text-primary outline-none"
                  />
                </div>
                <button
                  onClick={tryCommit}
                  disabled={entry.trim() === ""}
                  className="btn-primary px-5 disabled:opacity-50"
                >
                  Commit &amp; reveal ▸
                </button>
              </div>
              {entryError && (
                <p className="mt-2 text-sm text-bear" role="alert">
                  {entryError}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-secondary">
              Reason it through on your own first — then reveal and be honest
              with yourself.
            </p>
            <button onClick={onReveal} className="btn-primary w-full">
              Reveal answer ▸
            </button>
          </div>
        )
      ) : (
        <div className="animate-print-in space-y-4">
          {gradable && committed && (
            <div
              role="status"
              aria-live="polite"
              className={`border px-4 py-3 ${
                committed.correct
                  ? "border-bull/60 bg-bull/10"
                  : "border-bear/60 bg-bear/10"
              }`}
            >
              <span
                className={`font-mono text-xs font-semibold uppercase tracking-label ${
                  committed.correct ? "text-bull" : "text-bear"
                }`}
              >
                {committed.correct ? "✓ Correct" : "✗ Not quite"}
              </span>
              <p className="mt-1 text-sm text-secondary">
                You committed{" "}
                <span className="num font-semibold text-primary">
                  {committed.value ?? "—"}
                </span>
                {!committed.correct && (
                  <>
                    {" "}
                    · the exact answer is{" "}
                    <span className="num font-semibold text-primary">
                      {card.numericAnswer}
                    </span>
                  </>
                )}
                .
              </p>
            </div>
          )}
          <div className="border border-subtle">
            <div className="flex items-center justify-between bg-bull px-4 py-2 text-bg">
              <span className="font-mono text-xs font-semibold uppercase tracking-label">
                ● Answer
              </span>
              <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
                Reveal
              </span>
            </div>
            <div className="bg-surface p-4">
              <p className="font-display text-lg font-semibold leading-relaxed text-primary">
                {card.answer}
              </p>
            </div>
          </div>

          <div className="panel p-5">
            <span className="label text-accent">Why this is the answer</span>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-secondary">
              {card.explanation}
            </p>
            {card.needsVerification && (
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
                Hand-authored · flagged for expert verification
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={onGotIt} className="btn-primary flex-1">
              {bonus ? "Back to the deck ✓" : "Got it ✓"}
            </button>
            <button onClick={onAnother} className="btn-secondary flex-1">
              Give me another at this difficulty ↻
            </button>
          </div>
        </div>
      )}

      {!bonus && (
        <div className="border-t border-subtle pt-3">
          <button
            onClick={onUnderstandTopic}
            className="btn-ghost w-full text-sm"
          >
            I understand this topic — advance ▸
          </button>
        </div>
      )}
    </div>
  );
}

function FlashDone({
  level,
  understoodCount,
  total,
  isNewMastery,
  xpGained,
  nextTitle,
  onAdvance,
  onBack,
}: {
  level: Level;
  understoodCount: number;
  total: number;
  isNewMastery: boolean;
  xpGained: number;
  nextTitle?: string;
  onAdvance: () => void;
  onBack: () => void;
}) {
  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Settlement Statement</span>

        <div className="relative mt-4 flex justify-center">
          <StampSeal label="Mastered" sub="Topic Understood" tone="bull" />
          {isNewMastery && xpGained > 0 && (
            <span className="animate-rise-fade num absolute -top-2 right-1/4 text-lg font-semibold text-bull">
              +{xpGained} XP
            </span>
          )}
        </div>

        <h2 className="mt-6 font-display text-xl font-semibold text-primary">
          {level.title} complete
        </h2>
        <p className="mt-2 text-sm text-secondary">
          You marked {understoodCount} of {total} cards as understood.
          {" "}
          {isNewMastery
            ? "This node is now filled and the next one is unlocked on the route."
            : "This node was already filled — nice review."}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button onClick={onAdvance} className="btn-primary flex-1">
            {nextTitle ? `Continue → ${nextTitle}` : "Back to Route"}
          </button>
          {nextTitle && (
            <button onClick={onBack} className="btn-secondary flex-1">
              Back to Route
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LessonIntro({
  level,
  onStart,
  illustration,
  startLabel = "Start Practice ▸",
  detailLabel = "Explain in more detail ▾",
}: {
  level: Level;
  onStart: () => void;
  illustration?: ReactNode;
  startLabel?: string;
  detailLabel?: string;
}) {
  const [showDetail, setShowDetail] = useState(false);
  // Flashcard/briefing levels have no scored worked-example instance, so the
  // deep dive is composed from the level's own conceptual content: the thesis,
  // the authored `deepDive`, and (as a fallback) the briefing prose + the first
  // pool card's exact solver explanation. Numbers still come from solver output.
  const sampleCard = level.flashcards?.[0];
  const deepDive = useMemo(
    () =>
      buildDeepDive({
        concept: sampleCard?.concept,
        keyIdea: level.lesson.keyIdea,
        authored: level.lesson.deepDive,
        workedExplanation: level.lesson.deepDive?.whyItWorks
          ? undefined
          : sampleCard?.explanation,
        fallbackParagraphs: level.lesson.paragraphs,
      }),
    [level, sampleCard],
  );
  const canExpand = hasDeepDive(deepDive) && deepDive.sections.length > 1;

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Briefing</span>
          <span className="chip border-subtle text-secondary">
            {level.difficulty}
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          {level.subtitle}
        </h2>
        {/* Optional theme-supplied per-level illustration (e.g. kids cartoon). */}
        {illustration && <div className="mt-4">{illustration}</div>}
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-secondary">
          {level.lesson.paragraphs.map((p, i) => (
            <p key={i}>
              {i === 0 && (
                <span className="float-left mr-2 font-display text-5xl font-black leading-[0.8] text-primary">
                  {p.charAt(0)}
                </span>
              )}
              {i === 0 ? p.slice(1) : p}
            </p>
          ))}
        </div>
        {level.lesson.keyIdea && (
          <div className="mt-5 border-l-2 border-accent bg-surface-muted px-4 py-3">
            <div className="label text-accent">Thesis</div>
            <div className="mt-1 font-display text-base font-semibold text-primary">
              {level.lesson.keyIdea}
            </div>
          </div>
        )}
        {level.lesson.whyInterviewers && (
          <p className="mt-4 border-t border-subtle pt-3 font-mono text-xs uppercase tracking-wider text-muted">
            Why firms ask · {level.lesson.whyInterviewers}
          </p>
        )}
        {showDetail && (
          <div className="mt-5">
            <DeepDivePanel
              view={deepDive}
              onStart={onStart}
              startLabel="Start ▸"
              headingId="briefing-deep-dive"
            />
          </div>
        )}
      </article>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onStart} className="btn-primary flex-1">
          {startLabel}
        </button>
        {canExpand && (
          <button
            onClick={() => setShowDetail((v) => !v)}
            aria-expanded={showDetail}
            aria-controls="briefing-deep-dive"
            className="btn-secondary flex-1"
          >
            {showDetail ? "Hide the detailed explanation ▴" : detailLabel}
          </button>
        )}
      </div>
    </div>
  );
}
