import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { getTrack } from "@/content";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import {
  isFlashcardLevel,
  isNumericLevel,
  type Flashcard,
  type Level,
  type NumericQuestion,
  type Question,
  type Track,
} from "@/types/content";
import type { ResumeState } from "@/types/progress";
import { isFlashcardLevelComplete } from "@/lib/progressOps";
import { isLevelUnlockedBySection } from "@/lib/locking";
import { gradeNumeric, numericMatches, formatNumericAnswer } from "@/lib/numeric";
import {
  canRegenerateQuiz,
  canRegenerateNumeric,
  canRegenerateFlashcard,
  freshPracticeSeed,
  generateFreshQuestion,
  generateFreshNumericQuestion,
  generateFreshFlashcard,
  questionSignature,
  numericSignature,
  flashcardSignature,
} from "@/lib/regenerate";
import { isAiLayerEnabled, requestFlavoredVariant } from "@/lib/aiFlavor";
import { resolveFlavoredItem } from "@/lib/flavorPractice";
import { countQuizCorrect, countNumericCorrect, roundScore } from "@/lib/score";
import { celebrate } from "@/lib/celebrate";
import { useTheme } from "@/context/ThemeContext";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { StampSeal } from "@/components/visuals/StampSeal";
import { ChevronLeftIcon } from "@/components/icons";
import type { ReactNode } from "react";

type Phase = "lesson" | "quiz" | "summary";

/**
 * Route entry for playing a level. It dispatches on the level's `mode`:
 * `"flashcard"` levels (brainteasers) use the integrity-based reveal deck;
 * everything else uses the scored multiple-choice quiz.
 */
export function LessonPage() {
  const { trackId, levelId } = useParams();
  const track = trackId ? getTrack(trackId) : undefined;
  const level = track?.levels.find((l) => l.id === levelId);
  if (!track || !level) return <Navigate to="/" replace />;
  if (isFlashcardLevel(level))
    return <FlashcardLevel track={track} level={level} />;
  if (isNumericLevel(level))
    return <NumericLevel track={track} level={level} />;
  return <QuizLevel track={track} level={level} />;
}

function QuizLevel({ track, level }: { track: Track; level: Level }) {
  const navigate = useNavigate();
  const { getLevelProgress, getResume, saveResume, clearResume, recordAttempt } =
    useProgress();
  const { themeDef } = useTheme();

  const unlocked = useMemo(() => {
    const idx = track.levels.findIndex((l) => l.id === level.id);
    return isLevelUnlockedBySection(
      track.levels,
      idx,
      (id) => !!getLevelProgress(id)?.mastered,
    );
  }, [track, level, getLevelProgress]);

  const [phase, setPhase] = useState<Phase>("lesson");
  const [seed, setSeed] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [startedAt, setStartedAt] = useState("");
  const [result, setResult] = useState<{
    mastered: boolean;
    isNewMastery: boolean;
    xpGained: number;
  } | null>(null);

  useEffect(() => {
    if (!level) return;
    const existing = getResume(level.id);
    if (existing && existing.questions.length) {
      setSeed(existing.seed);
      setQuestions(existing.questions as Question[]);
      setIndex(existing.index);
      setAnswers(existing.answers);
      setStartedAt(existing.startedAt);
      setPhase("quiz");
    } else {
      const s = Date.now() % 2_000_000_000;
      setSeed(s);
      const qs = materializeLevel(level, s);
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(null));
      setStartedAt(new Date().toISOString());
      setPhase("lesson");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level?.id]);

  // Run-wide dedup: bonus items must differ from EVERY question in this run —
  // all 5 originals (materialized up front, incl. upcoming ones) AND every bonus
  // already generated. `roundSigs` are the originals; `bonusSigsRef` accumulates
  // generated bonuses (a ref so it survives the per-question `QuizPractice`
  // remounts). Both reset when a new round starts (seed changes).
  const roundSigs = useMemo(
    () => new Set(questions.map(questionSignature)),
    [questions],
  );
  const bonusSigsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    bonusSigsRef.current = new Set();
  }, [seed]);

  if (!unlocked) return <Navigate to={`/track/${track.id}`} replace />;

  const persist = (nextIndex: number, nextAnswers: (number | null)[]) => {
    const state: ResumeState = {
      levelId: level.id,
      seed,
      questions,
      index: nextIndex,
      answers: nextAnswers,
      lessonSkipped: true,
      startedAt,
    };
    saveResume(state);
  };

  const startQuiz = () => setPhase("quiz");

  const q = questions[index];
  const answered = q ? answers[index] !== null : false;
  // Round score is computed ONLY over the fixed materialized questions/answers;
  // bonus practice lives in a separate component and can never affect it.
  const correctCount = countQuizCorrect(questions, answers);

  const select = (choice: number) => {
    if (answered) return;
    const next = answers.slice();
    next[index] = choice;
    setAnswers(next);
    persist(index, next);
  };

  const goNext = () => {
    if (index < questions.length - 1) {
      const ni = index + 1;
      setIndex(ni);
      persist(ni, answers);
    } else {
      finish();
    }
  };

  const finish = () => {
    const score = roundScore(correctCount, questions.length);
    const r = recordAttempt(level.id, score, level.masteryThreshold);
    clearResume(level.id);
    setResult({
      mastered: r.mastered,
      isNewMastery: r.isNewMastery,
      xpGained: r.xpGained,
    });
    setPhase("summary");
    if (r.mastered) setTimeout(themeDef.celebration ?? celebrate, 260);
  };

  const retry = () => {
    const s = Date.now() % 2_000_000_000;
    setSeed(s);
    const qs = materializeLevel(level, s);
    setQuestions(qs);
    setAnswers(new Array(qs.length).fill(null));
    setIndex(0);
    setResult(null);
    setStartedAt(new Date().toISOString());
    setPhase("lesson");
  };

  const levelIndex = track.levels.findIndex((l) => l.id === level.id);
  const Illustration = themeDef.getLevelIllustration?.({
    trackId: track.id,
    levelId: level.id,
    levelIndex,
    motif: track.motif,
  });

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
            {phase === "quiz" && (
              <div className="mt-1 h-1.5 w-full border border-subtle bg-surface">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
          {phase === "quiz" && (
            <span className="num text-xs text-secondary">
              {String(index + 1).padStart(2, "0")}/{questions.length}
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6">
        {phase === "lesson" && (
          <LessonIntro
            level={level}
            onStart={startQuiz}
            illustration={Illustration ? <Illustration /> : null}
          />
        )}

        {phase === "quiz" && q && (
          <QuizCard
            key={q.id}
            question={q}
            number={index + 1}
            total={questions.length}
            answered={answered}
            selected={answers[index]}
            isLast={index === questions.length - 1}
            onSelect={select}
            onNext={goNext}
          />
        )}

        {/* Bonus practice: fresh same-concept parametric item, never scored. */}
        {phase === "quiz" && q && answered && canRegenerateQuiz(level) && (
          <div className="mt-4">
            <QuizPractice
              key={q.id}
              level={level}
              current={q}
              roundSigs={roundSigs}
              bonusSigsRef={bonusSigsRef}
            />
          </div>
        )}

        {phase === "summary" && result && (
          <Summary
            correct={correctCount}
            total={questions.length}
            threshold={level.masteryThreshold}
            mastered={result.mastered}
            xpGained={result.xpGained}
            questions={questions}
            answers={answers}
            onRetry={retry}
            onDone={() => navigate(`/track/${track.id}`)}
          />
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Flashcard (integrity-based) level player — brainteasers.                   */
/*  No multiple choice, no scoring: read → reveal → self-assess.              */
/* -------------------------------------------------------------------------- */

type FlashPhase = "lesson" | "cards" | "done";

function FlashcardLevel({ track, level }: { track: Track; level: Level }) {
  const navigate = useNavigate();
  const {
    getLevelProgress,
    getUnderstood,
    markUnderstood,
    completeFlashcardLevel,
  } = useProgress();
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
  const gotIt = () => {
    if (isBonus) {
      setGenerated(null);
      setRevealed(false);
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
            skipLabel="Skip briefing ▸"
          />
        )}

        {phase === "cards" && card && (
          <FlashCard
            key={card.id + (revealed ? "-r" : "")}
            card={card}
            revealed={revealed}
            bonus={isBonus}
            onReveal={() => setRevealed(true)}
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
  onReveal,
  onGotIt,
  onAnother,
  onUnderstandTopic,
}: {
  card: Flashcard;
  revealed: boolean;
  /** True for a freshly-generated BONUS card (not counted toward mastery). */
  bonus?: boolean;
  onReveal: () => void;
  onGotIt: () => void;
  onAnother: () => void;
  onUnderstandTopic: () => void;
}) {
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
        <div className="space-y-3">
          <p className="text-center text-sm text-secondary">
            Reason it through on your own first — then reveal and be honest with
            yourself.
          </p>
          <button onClick={onReveal} className="btn-primary w-full">
            Reveal answer ▸
          </button>
        </div>
      ) : (
        <div className="animate-print-in space-y-4">
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
  skipLabel = "Skip — I know this",
}: {
  level: Level;
  onStart: () => void;
  illustration?: ReactNode;
  startLabel?: string;
  skipLabel?: string;
}) {
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
      </article>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onStart} className="btn-primary flex-1">
          {startLabel}
        </button>
        <button onClick={onStart} className="btn-secondary flex-1">
          {skipLabel}
        </button>
      </div>
    </div>
  );
}

function QuizCard({
  question,
  number,
  total,
  answered,
  selected,
  isLast,
  onSelect,
  onNext,
  headerLabel,
  nextLabel,
}: {
  question: Question;
  number: number;
  total: number;
  answered: boolean;
  selected: number | null;
  isLast: boolean;
  onSelect: (i: number) => void;
  onNext: () => void;
  /** Overrides the "Question NN / total" header (used for bonus practice). */
  headerLabel?: string;
  /** Overrides the advance-button label (used for bonus practice). */
  nextLabel?: string;
}) {
  const isCorrect = answered && selected === question.correctIndex;

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            {headerLabel ??
              `Question ${String(number).padStart(2, "0")} / ${total}`}
          </span>
          {question.concept && (
            <span className="chip border-subtle text-secondary">
              {question.concept}
            </span>
          )}
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {question.prompt}
        </p>
      </div>

      <div className="border border-subtle">
        {question.choices.map((choice, i) => {
          const isChosen = selected === i;
          const isAnswer = i === question.correctIndex;
          let rowCls =
            "flex w-full items-start gap-3 border-b border-subtle p-4 text-left transition-colors last:border-b-0 min-h-[44px] ";
          let boxCls =
            "mt-0.5 grid h-6 w-6 shrink-0 place-items-center border font-mono text-xs font-semibold ";
          if (!answered) {
            rowCls += "bg-surface hover:bg-surface-muted";
            boxCls += "border-border-strong text-secondary";
          } else if (isAnswer) {
            rowCls += "bg-success-soft";
            boxCls += "border-bull bg-bull text-bg";
          } else if (isChosen) {
            rowCls += "bg-danger-soft";
            boxCls += "border-bear bg-bear text-bg";
          } else {
            rowCls += "bg-surface opacity-55";
            boxCls += "border-subtle text-muted";
          }
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              disabled={answered}
              className={rowCls}
            >
              <span className={boxCls}>
                {answered && isAnswer ? "✓" : answered && isChosen ? "✕" : String.fromCharCode(65 + i)}
              </span>
              <span className="font-sans text-[15px] font-medium text-primary">
                {choice}
              </span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="animate-print-in border border-subtle">
          {/* Trade-ticket header */}
          <div
            className={`flex items-center justify-between px-4 py-2 ${
              isCorrect ? "bg-bull text-bg" : "bg-bear text-bg"
            }`}
          >
            <span className="font-mono text-xs font-semibold uppercase tracking-label">
              {isCorrect ? "● Filled — Correct" : "● Rejected — Incorrect"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
              Trade Ticket
            </span>
          </div>
          <div className="space-y-2 bg-surface p-4">
            {!isCorrect &&
              selected !== null &&
              question.distractorRationale?.[selected] && (
                <p className="text-sm text-primary">
                  <span className="label text-bear">Your error · </span>
                  {question.distractorRationale[selected]}
                </p>
              )}
            <p className="text-sm leading-relaxed text-secondary">
              {question.explanation}
            </p>
            {question.needsVerification && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Hand-authored · flagged for expert verification
              </p>
            )}
            <button onClick={onNext} className="btn-primary mt-2 w-full">
              {nextLabel ?? (isLast ? "Settle & See Results ▸" : "Next Question ▸")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({
  correct,
  total,
  threshold,
  mastered,
  xpGained,
  questions,
  answers,
  onRetry,
  onDone,
}: {
  correct: number;
  total: number;
  threshold: number;
  mastered: boolean;
  xpGained: number;
  questions: Question[];
  answers: (number | null)[];
  onRetry: () => void;
  onDone: () => void;
}) {
  const pct = Math.round((correct / total) * 100);
  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Settlement Statement</span>

        <div className="relative mt-4 flex justify-center">
          <StampSeal
            label={mastered ? "Mastered" : "Under Review"}
            sub={mastered ? "Position Settled" : "Not Yet Filled"}
            tone={mastered ? "bull" : "accent"}
          />
          {mastered && (
            <span className="animate-rise-fade num absolute -top-2 right-1/4 text-lg font-semibold text-bull">
              +{xpGained} XP
            </span>
          )}
        </div>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 divide-x divide-subtle border-y border-subtle">
          <div className="px-2 py-3">
            <div className="label text-[9px]">Score</div>
            <div className="num mt-1 text-xl font-semibold text-primary">
              {correct}/{total}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Accuracy</div>
            <div
              className={`num mt-1 text-xl font-semibold ${mastered ? "text-bull" : "text-primary"}`}
            >
              {pct}%
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Bar</div>
            <div className="num mt-1 text-xl font-semibold text-secondary">
              {Math.round(threshold * 100)}%
            </div>
          </div>
        </div>

        <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted">
          {mastered
            ? "Next node unlocked on the route."
            : "Review the tickets below, then trade a fresh set."}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {!mastered && (
            <button onClick={onRetry} className="btn-primary flex-1">
              Re-run (Fresh Questions)
            </button>
          )}
          <button
            onClick={onDone}
            className={mastered ? "btn-primary flex-1" : "btn-secondary flex-1"}
          >
            Back to Route
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="border-b-[3px] border-border-strong px-4 py-2.5">
          <span className="label">Blotter · Review</span>
        </div>
        <ul>
          {questions.map((qq, i) => {
            const ok = answers[i] === qq.correctIndex;
            return (
              <li
                key={qq.id}
                className="flex items-start gap-3 border-b border-subtle p-4 last:border-b-0"
              >
                <span
                  className={`num mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-semibold ${
                    ok ? "bg-bull text-bg" : "bg-bear text-bg"
                  }`}
                >
                  {ok ? "✓" : "✕"}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary">
                    {qq.prompt}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-secondary">
                    Ans · {qq.choices[qq.correctIndex]}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Numeric (free-entry) level player — Betting & Sizing (Kelly).              */
/*  Type a number → EXACT-match grade → reveal answer + worked explanation,    */
/*  with targeted feedback when the entry matches a known Kelly error.         */
/* -------------------------------------------------------------------------- */

function NumericLevel({ track, level }: { track: Track; level: Level }) {
  const navigate = useNavigate();
  const { getLevelProgress, getResume, saveResume, clearResume, recordAttempt } =
    useProgress();
  const { themeDef } = useTheme();

  const unlocked = useMemo(() => {
    const idx = track.levels.findIndex((l) => l.id === level.id);
    return isLevelUnlockedBySection(
      track.levels,
      idx,
      (id) => !!getLevelProgress(id)?.mastered,
    );
  }, [track, level, getLevelProgress]);

  const [phase, setPhase] = useState<Phase>("lesson");
  const [seed, setSeed] = useState(0);
  const [questions, setQuestions] = useState<NumericQuestion[]>([]);
  const [index, setIndex] = useState(0);
  // Entered numeric values per question; null = not yet answered.
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [startedAt, setStartedAt] = useState("");
  const [result, setResult] = useState<{
    mastered: boolean;
    isNewMastery: boolean;
    xpGained: number;
  } | null>(null);

  useEffect(() => {
    if (!level) return;
    const existing = getResume(level.id);
    if (existing && existing.questions.length) {
      setSeed(existing.seed);
      setQuestions(existing.questions as NumericQuestion[]);
      setIndex(existing.index);
      setAnswers(existing.answers);
      setStartedAt(existing.startedAt);
      setPhase("quiz");
    } else {
      const s = Date.now() % 2_000_000_000;
      setSeed(s);
      const qs = materializeNumericLevel(level, s);
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(null));
      setStartedAt(new Date().toISOString());
      setPhase("lesson");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level?.id]);

  // Run-wide dedup (see QuizLevel): a bonus must differ from every original in
  // this round AND every bonus already generated this run.
  const roundSigs = useMemo(
    () => new Set(questions.map(numericSignature)),
    [questions],
  );
  const bonusSigsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    bonusSigsRef.current = new Set();
  }, [seed]);

  if (!unlocked) return <Navigate to={`/track/${track.id}`} replace />;

  const persist = (nextIndex: number, nextAnswers: (number | null)[]) => {
    const state: ResumeState = {
      levelId: level.id,
      seed,
      questions,
      index: nextIndex,
      answers: nextAnswers,
      lessonSkipped: true,
      startedAt,
    };
    saveResume(state);
  };

  const q = questions[index];
  const answered = q ? answers[index] !== null : false;
  // Round score is computed ONLY over the fixed materialized questions/answers;
  // bonus practice lives in a separate component and can never affect it.
  const correctCount = countNumericCorrect(questions, answers);

  const submit = (value: number) => {
    if (answered) return;
    const next = answers.slice();
    next[index] = value;
    setAnswers(next);
    persist(index, next);
  };

  const goNext = () => {
    if (index < questions.length - 1) {
      const ni = index + 1;
      setIndex(ni);
      persist(ni, answers);
    } else {
      finish();
    }
  };

  const finish = () => {
    const score = roundScore(correctCount, questions.length);
    const r = recordAttempt(level.id, score, level.masteryThreshold);
    clearResume(level.id);
    setResult({
      mastered: r.mastered,
      isNewMastery: r.isNewMastery,
      xpGained: r.xpGained,
    });
    setPhase("summary");
    if (r.mastered) setTimeout(themeDef.celebration ?? celebrate, 260);
  };

  const retry = () => {
    const s = Date.now() % 2_000_000_000;
    setSeed(s);
    const qs = materializeNumericLevel(level, s);
    setQuestions(qs);
    setAnswers(new Array(qs.length).fill(null));
    setIndex(0);
    setResult(null);
    setStartedAt(new Date().toISOString());
    setPhase("lesson");
  };

  const levelIndex = track.levels.findIndex((l) => l.id === level.id);
  const Illustration = themeDef.getLevelIllustration?.({
    trackId: track.id,
    levelId: level.id,
    levelIndex,
    motif: track.motif,
  });

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
            {phase === "quiz" && (
              <div className="mt-1 h-1.5 w-full border border-subtle bg-surface">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
          {phase === "quiz" && (
            <span className="num text-xs text-secondary">
              {String(index + 1).padStart(2, "0")}/{questions.length}
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6">
        {phase === "lesson" && (
          <LessonIntro
            level={level}
            onStart={() => setPhase("quiz")}
            illustration={Illustration ? <Illustration /> : null}
            startLabel="Start Sizing ▸"
          />
        )}

        {phase === "quiz" && q && (
          <NumericCard
            key={q.id}
            question={q}
            number={index + 1}
            total={questions.length}
            answered={answered}
            entered={answers[index]}
            isLast={index === questions.length - 1}
            onSubmit={submit}
            onNext={goNext}
          />
        )}

        {/* Bonus practice: fresh same-concept parametric item, never scored. */}
        {phase === "quiz" && q && answered && canRegenerateNumeric(level) && (
          <div className="mt-4">
            <NumericPractice
              key={q.id}
              level={level}
              current={q}
              roundSigs={roundSigs}
              bonusSigsRef={bonusSigsRef}
            />
          </div>
        )}

        {phase === "summary" && result && (
          <NumericSummary
            correct={correctCount}
            total={questions.length}
            threshold={level.masteryThreshold}
            mastered={result.mastered}
            xpGained={result.xpGained}
            questions={questions}
            answers={answers}
            onRetry={retry}
            onDone={() => navigate(`/track/${track.id}`)}
          />
        )}
      </main>
    </div>
  );
}

function NumericCard({
  question,
  number,
  total,
  answered,
  entered,
  isLast,
  onSubmit,
  onNext,
  headerLabel,
  nextLabel,
}: {
  question: NumericQuestion;
  number: number;
  total: number;
  answered: boolean;
  entered: number | null;
  isLast: boolean;
  onSubmit: (value: number) => void;
  onNext: () => void;
  /** Overrides the "Question NN / total" header (used for bonus practice). */
  headerLabel?: string;
  /** Overrides the advance-button label (used for bonus practice). */
  nextLabel?: string;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unit = question.unit ?? "$";
  // Kelly (dollar) levels keep their "stake" framing; other numeric levels
  // (game values, probabilities) get a neutral "Your answer" framing.
  const isMoney = unit === "$";
  const inputLabel = isMoney ? "Your stake" : "Your answer";
  const placeholder = isMoney
    ? "e.g. 300"
    : question.decimals != null
      ? `e.g. ${(0).toFixed(question.decimals)}`
      : "e.g. 5";

  // Grade the (persisted) entered value once answered, so resume shows feedback.
  const grade =
    answered && entered !== null
      ? gradeNumeric(question, String(entered))
      : null;
  const isCorrect = grade?.correct ?? false;

  const handleSubmit = () => {
    if (answered) return;
    const g = gradeNumeric(question, raw);
    if (g.parsed === null) {
      setError(
        isMoney
          ? "Enter a whole-dollar number (digits only, e.g. 300)."
          : "Enter a number (e.g. 2.8).",
      );
      return;
    }
    setError(null);
    onSubmit(g.parsed);
  };

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            {headerLabel ??
              `Question ${String(number).padStart(2, "0")} / ${total}`}
          </span>
          {question.concept && (
            <span className="chip border-subtle text-secondary">
              {question.concept}
            </span>
          )}
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {question.prompt}
        </p>
      </div>

      {/* Free-entry numeric input */}
      <div className="panel p-5">
        <label
          htmlFor={`num-${question.id}`}
          className="label text-accent"
        >
          {inputLabel}
        </label>
        <div className="mt-2 flex items-stretch gap-2">
          <div className="flex flex-1 items-center border-2 border-border-strong bg-surface focus-within:border-accent">
            <span className="px-3 font-mono text-lg font-semibold text-secondary">
              {unit}
            </span>
            <input
              id={`num-${question.id}`}
              type="text"
              inputMode={question.decimals != null ? "decimal" : "numeric"}
              autoComplete="off"
              disabled={answered}
              value={answered && entered !== null ? String(entered) : raw}
              onChange={(e) => {
                setRaw(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder={placeholder}
              aria-label={isMoney ? "Stake in dollars" : "Your numeric answer"}
              aria-invalid={error ? true : undefined}
              className="num min-h-[44px] w-full bg-transparent py-2 pr-3 text-lg font-semibold text-primary outline-none disabled:opacity-70"
            />
          </div>
          {!answered && (
            <button onClick={handleSubmit} className="btn-primary px-5">
              Submit ▸
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-bear" role="alert">
            {error}
          </p>
        )}
      </div>

      {answered && grade && (
        <div className="animate-print-in border border-subtle">
          <div
            className={`flex items-center justify-between px-4 py-2 ${
              isCorrect ? "bg-bull text-bg" : "bg-bear text-bg"
            }`}
          >
            <span className="font-mono text-xs font-semibold uppercase tracking-label">
              {isCorrect ? "● Filled — Correct" : "● Rejected — Incorrect"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
              Trade Ticket
            </span>
          </div>
          <div className="space-y-2 bg-surface p-4">
            {!isCorrect && (
              <p className="text-sm text-primary">
                <span className="label text-bear">
                  {isMoney ? "Correct stake · " : "Correct answer · "}
                </span>
                <span className="num font-semibold">
                  {unit}
                  {formatNumericAnswer(question)}
                </span>
                {entered !== null && (
                  <span className="text-secondary">
                    {"  "}(you entered {unit}
                    {entered.toLocaleString("en-US")})
                  </span>
                )}
              </p>
            )}
            {!isCorrect && grade.matchedError && (
              <p className="text-sm text-primary">
                <span className="label text-bear">Your error · </span>
                {grade.matchedError.feedback}
              </p>
            )}
            <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
              {question.explanation}
            </p>
            {question.needsVerification && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Hand-authored · flagged for expert verification
              </p>
            )}
            <button onClick={onNext} className="btn-primary mt-2 w-full">
              {nextLabel ?? (isLast ? "Settle & See Results ▸" : "Next Question ▸")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumericSummary({
  correct,
  total,
  threshold,
  mastered,
  xpGained,
  questions,
  answers,
  onRetry,
  onDone,
}: {
  correct: number;
  total: number;
  threshold: number;
  mastered: boolean;
  xpGained: number;
  questions: NumericQuestion[];
  answers: (number | null)[];
  onRetry: () => void;
  onDone: () => void;
}) {
  const pct = Math.round((correct / total) * 100);
  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Settlement Statement</span>

        <div className="relative mt-4 flex justify-center">
          <StampSeal
            label={mastered ? "Mastered" : "Under Review"}
            sub={mastered ? "Position Settled" : "Not Yet Filled"}
            tone={mastered ? "bull" : "accent"}
          />
          {mastered && (
            <span className="animate-rise-fade num absolute -top-2 right-1/4 text-lg font-semibold text-bull">
              +{xpGained} XP
            </span>
          )}
        </div>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 divide-x divide-subtle border-y border-subtle">
          <div className="px-2 py-3">
            <div className="label text-[9px]">Score</div>
            <div className="num mt-1 text-xl font-semibold text-primary">
              {correct}/{total}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Accuracy</div>
            <div
              className={`num mt-1 text-xl font-semibold ${mastered ? "text-bull" : "text-primary"}`}
            >
              {pct}%
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Bar</div>
            <div className="num mt-1 text-xl font-semibold text-secondary">
              {Math.round(threshold * 100)}%
            </div>
          </div>
        </div>

        <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted">
          {mastered
            ? "Next node unlocked on the route."
            : "Review the tickets below, then size a fresh set."}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {!mastered && (
            <button onClick={onRetry} className="btn-primary flex-1">
              Re-run (Fresh Questions)
            </button>
          )}
          <button
            onClick={onDone}
            className={mastered ? "btn-primary flex-1" : "btn-secondary flex-1"}
          >
            Back to Route
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="border-b-[3px] border-border-strong px-4 py-2.5">
          <span className="label">Blotter · Review</span>
        </div>
        <ul>
          {questions.map((qq, i) => {
            const ok = answers[i] !== null && numericMatches(qq, answers[i] as number);
            const unit = qq.unit ?? "$";
            return (
              <li
                key={qq.id}
                className="flex items-start gap-3 border-b border-subtle p-4 last:border-b-0"
              >
                <span
                  className={`num mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-semibold ${
                    ok ? "bg-bull text-bg" : "bg-bear text-bg"
                  }`}
                >
                  {ok ? "✓" : "✕"}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary">
                    {qq.prompt}
                  </div>
                  <div className="num mt-0.5 font-mono text-xs text-secondary">
                    Ans · {unit}
                    {formatNumericAnswer(qq)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  "Generate another like this" — bonus practice (quiz + numeric).            */
/*                                                                             */
/*  These are EXTRA, un-scored reps produced by re-invoking the level's own    */
/*  parametric generator with a fresh random seed (see `@/lib/regenerate`).    */
/*  They keep their own local state and NEVER touch progress: no recordAttempt,*/
/*  no resume, no mastery/streak/unlock. Grading reuses the exact same solver  */
/*  path as normal questions (quiz `correctIndex`, numeric `gradeNumeric` +    */
/*  `commonErrors`), so feedback/rationale are identical to a real item.       */
/*                                                                             */
/*  When the OPTIONAL LLM flavor layer is enabled (`isAiLayerEnabled()` — OFF  */
/*  by default), an extra "✨ Fresh variant" action appears beside the plain   */
/*  button. It generates the SAME fresh parametric item and then reskins only  */
/*  its prompt via `requestFlavoredVariant`; if the layer is unconfigured or   */
/*  the guardrail rejects the reskin it degrades to the plain parametric item  */
/*  (see `resolveFlavoredItem`). The answer/options/explanation stay the       */
/*  solver's truth, and these items still NEVER touch progress.                */
/* -------------------------------------------------------------------------- */

function PracticeHeader() {
  return (
    <div className="flex items-center justify-between">
      <span className="label text-accent">Bonus Practice · Not Scored</span>
      <span className="chip border-subtle text-secondary">Same concept</span>
    </div>
  );
}

function QuizPractice({
  level,
  current,
  roundSigs,
  bonusSigsRef,
}: {
  level: Level;
  /** The on-screen question this practice is attached to (for family preservation). */
  current: Question;
  /** Signatures of ALL of this run's original questions (incl. upcoming ones). */
  roundSigs: ReadonlySet<string>;
  /** Accumulates signatures of bonuses generated this run (survives remounts). */
  bonusSigsRef: React.MutableRefObject<Set<string>>;
}) {
  // The optional LLM flavor layer is OFF by default: when disabled, this
  // component renders BYTE-IDENTICALLY to the plain parametric practice below.
  const aiEnabled = isAiLayerEnabled();
  const [item, setItem] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // The run-wide avoid-set: every original question this round + every bonus
  // already generated this run. A new bonus must differ from ALL of them.
  const avoidSet = (): Set<string> =>
    new Set([...roundSigs, ...bonusSigsRef.current]);
  const remember = (q: Question) => bonusSigsRef.current.add(questionSignature(q));

  // Button #1 — "Generate another like this": STRICTLY the same family as the
  // current on-screen item (new seed → same concept, different numbers). We pass
  // `current.family` + `lockFamily = true` so regenerate locks to that family
  // (inferring it if the tag is missing), and the whole run-wide avoid-set so it
  // never collides with any original OR earlier bonus.
  const generate = () => {
    const fresh = generateFreshQuestion(
      level,
      freshPracticeSeed(),
      current.family,
      avoidSet(),
      true,
      current,
    );
    if (fresh) remember(fresh);
    setItem(fresh);
    setSelected(null);
  };

  // Button #2 — "✨ Fresh variant" (AI): intentional variety WITHIN THE LEVEL.
  // We DELIBERATELY do NOT pass a family, so the whole-level mix may land on a
  // sibling family, then the flavor layer reskins ONLY the prompt. The run-wide
  // avoid-set still applies. On null / guardrail-rejected fallback we keep the
  // fresh parametric item verbatim (safe degrade). The solver
  // answer/options/explanation stay the parametric truth.
  const generateFlavored = async () => {
    const fresh = generateFreshQuestion(
      level,
      freshPracticeSeed(),
      undefined,
      avoidSet(),
      false,
      current,
    );
    if (!fresh) return;
    remember(fresh);
    setBusy(true);
    try {
      const variant = await requestFlavoredVariant(fresh);
      setItem(resolveFlavoredItem(fresh, variant));
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  // With AI on, advancing returns to the chooser so either path stays reachable.
  const reset = () => {
    setItem(null);
    setSelected(null);
  };

  const answered = selected !== null;

  return (
    <div className="space-y-4 border-t-2 border-dashed border-subtle pt-5">
      <PracticeHeader />
      {!item ? (
        <>
          <p className="text-sm text-secondary">
            Want more reps on this idea? Generate a brand-new same-concept
            question with fresh numbers. It won't affect your score or mastery.
          </p>
          {aiEnabled ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={generate}
                disabled={busy}
                className="btn-secondary w-full disabled:opacity-60"
              >
                Generate another like this ↻
              </button>
              <button
                onClick={generateFlavored}
                disabled={busy}
                aria-busy={busy}
                className="btn-secondary w-full disabled:opacity-60"
              >
                {busy ? "✨ Reskinning…" : "✨ Fresh variant"}
              </button>
            </div>
          ) : (
            <button onClick={generate} className="btn-secondary w-full">
              Generate another like this ↻
            </button>
          )}
        </>
      ) : (
        <QuizCard
          key={item.id}
          question={item}
          number={0}
          total={0}
          answered={answered}
          selected={selected}
          isLast={false}
          onSelect={(i) => setSelected(i)}
          onNext={aiEnabled ? reset : generate}
          headerLabel="Bonus Practice"
          nextLabel={aiEnabled ? "Practice another ↻" : "Generate another like this ↻"}
        />
      )}
    </div>
  );
}

function NumericPractice({
  level,
  current,
  roundSigs,
  bonusSigsRef,
}: {
  level: Level;
  /** The on-screen question this practice is attached to (for family preservation). */
  current: NumericQuestion;
  /** Signatures of ALL of this run's original questions (incl. upcoming ones). */
  roundSigs: ReadonlySet<string>;
  /** Accumulates signatures of bonuses generated this run (survives remounts). */
  bonusSigsRef: React.MutableRefObject<Set<string>>;
}) {
  // The optional LLM flavor layer is OFF by default: when disabled, this
  // component renders BYTE-IDENTICALLY to the plain parametric practice below.
  const aiEnabled = isAiLayerEnabled();
  const [item, setItem] = useState<NumericQuestion | null>(null);
  const [entered, setEntered] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Run-wide avoid-set: every original this round + every bonus already made.
  const avoidSet = (): Set<string> =>
    new Set([...roundSigs, ...bonusSigsRef.current]);
  const remember = (q: NumericQuestion) =>
    bonusSigsRef.current.add(numericSignature(q));

  // Button #1 — "Generate another like this": STRICTLY the same family as the
  // current on-screen item (new seed → same concept, different numbers).
  // `lockFamily = true` locks to that family (inferring it if the tag is
  // missing); the run-wide avoid-set prevents any collision with the round.
  const generate = () => {
    const fresh = generateFreshNumericQuestion(
      level,
      freshPracticeSeed(),
      current.family,
      avoidSet(),
      true,
      current,
    );
    if (fresh) remember(fresh);
    setItem(fresh);
    setEntered(null);
  };

  // Button #2 — "✨ Fresh variant" (AI): intentional variety WITHIN THE LEVEL —
  // NO family passed, so the whole-level mix may land on a sibling family; then
  // the flavor layer reskins ONLY the prompt. The run-wide avoid-set still
  // applies. On null / guardrail-rejected fallback we keep the fresh parametric
  // item verbatim (safe degrade). The solver answer/explanation stay truth.
  const generateFlavored = async () => {
    const fresh = generateFreshNumericQuestion(
      level,
      freshPracticeSeed(),
      undefined,
      avoidSet(),
      false,
      current,
    );
    if (!fresh) return;
    remember(fresh);
    setBusy(true);
    try {
      const variant = await requestFlavoredVariant(fresh);
      setItem(resolveFlavoredItem(fresh, variant));
      setEntered(null);
    } finally {
      setBusy(false);
    }
  };

  // With AI on, advancing returns to the chooser so either path stays reachable.
  const reset = () => {
    setItem(null);
    setEntered(null);
  };

  const answered = entered !== null;

  return (
    <div className="space-y-4 border-t-2 border-dashed border-subtle pt-5">
      <PracticeHeader />
      {!item ? (
        <>
          <p className="text-sm text-secondary">
            Want more reps on this idea? Generate a brand-new same-concept
            problem with fresh numbers. It won't affect your score or mastery.
          </p>
          {aiEnabled ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={generate}
                disabled={busy}
                className="btn-secondary w-full disabled:opacity-60"
              >
                Generate another like this ↻
              </button>
              <button
                onClick={generateFlavored}
                disabled={busy}
                aria-busy={busy}
                className="btn-secondary w-full disabled:opacity-60"
              >
                {busy ? "✨ Reskinning…" : "✨ Fresh variant"}
              </button>
            </div>
          ) : (
            <button onClick={generate} className="btn-secondary w-full">
              Generate another like this ↻
            </button>
          )}
        </>
      ) : (
        <NumericCard
          key={item.id}
          question={item}
          number={0}
          total={0}
          answered={answered}
          entered={entered}
          isLast={false}
          onSubmit={(v) => setEntered(v)}
          onNext={aiEnabled ? reset : generate}
          headerLabel="Bonus Practice"
          nextLabel={aiEnabled ? "Practice another ↻" : "Generate another like this ↻"}
        />
      )}
    </div>
  );
}
