import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { getTrack } from "@/content";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import {
  DIFFICULTY_META,
  isFlashcardLevel,
  isNumericLevel,
  type Difficulty,
  type Flashcard,
  type Level,
  type NumericQuestion,
  type Question,
  type Track,
} from "@/types/content";
import type { ResumeState } from "@/types/progress";
import { isFlashcardLevelComplete } from "@/lib/progressOps";
import { isLevelUnlockedBySection } from "@/lib/locking";
import {
  gradeNumeric,
  gradeFreeResponse,
  numericMatches,
  formatNumericAnswer,
  parseFreeResponse,
} from "@/lib/numeric";
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
import {
  countQuizCorrect,
  countNumericCorrect,
  roundScore,
  creditRoundScore,
} from "@/lib/score";
import { celebrate } from "@/lib/celebrate";
import { topicKeyForLevel, tierDifficultyKey } from "@/lib/mastery/topicKey";
import { predictSuccess, seedTierDifficulty } from "@/lib/mastery/elo";
import { isLowConfidenceUnlock, isTopicUnlocked } from "@/lib/mastery/unlock";
import { WhyThisQuestion } from "@/components/tutor/WhyThisQuestion";
import type { TopicVerdict } from "@/lib/mastery/verdict";
import { planRoundReview } from "@/lib/adaptivity/review";
import { buildHintLadder } from "@/lib/tutor/hintLadder";
import { selectTutorPhase } from "@/lib/tutor/phase";
import {
  startEpisode,
  submitAttempt,
  isResolved,
  type HintEpisode,
} from "@/lib/tutor/hintEpisode";
import { creditForEpisode, type HintRungReached } from "@/lib/tutor/creditSchedule";
import { deriveWorkedSteps } from "@/lib/tutor/faded";
import { buildDeepDive, hasDeepDive } from "@/lib/tutor/deepDive";
import { DeepDivePanel } from "@/components/tutor/DeepDivePanel";
import {
  resolveQuizTag,
  resolveNumericTag,
  resolveQuizMisconceptionKeys,
  resolveNumericMisconceptionKeys,
} from "@/lib/tutor/misconception";
import { TutorController } from "@/components/tutor/TutorController";
import { HintLadder, type SiblingWorked } from "@/components/tutor/HintLadder";
import { REMEDIATION_MODE } from "@/lib/remediation/config";
import {
  probeTierFor,
  remediationStep,
  type RemediationAction,
  type RemediationInput,
} from "@/lib/remediation/policy";
import {
  descendTo,
  startRemediation,
  type RemediationSession,
} from "@/lib/remediation/session";
import { isNodeCleared } from "@/lib/remediation/climbBack";
import { planFinishRemediation } from "@/lib/remediation/finish";
import { buildProbeItem, type ProbeItem } from "@/lib/remediation/probe";
import {
  misconceptionTagOf,
  prereqNode,
} from "@/content/remediation/prereqDAG";
import { useTheme } from "@/context/ThemeContext";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { StampSeal } from "@/components/visuals/StampSeal";
import { ChevronLeftIcon } from "@/components/icons";
import type { ReactNode } from "react";

type Phase = "lesson" | "quiz" | "remediation" | "summary";

/**
 * The phase a fresh (no-resume) attempt should START in.
 *
 * `TutorController` (the "lesson" prologue) auto-skips itself for `independent`
 * learners by calling `onStart()` from an effect — but that fires DURING the
 * same commit as the player's own mount effect, which unconditionally set
 * `"lesson"`. Because child effects run before parent effects, the parent's
 * `"lesson"` write CLOBBERED the tutor's `"quiz"` write, and the tutor's
 * one-shot `started` guard prevented a retry — leaving an `independent` learner
 * stranded on a lesson phase where `TutorController` renders `null`, i.e. a
 * COMPLETELY BLANK working area (header only). We instead resolve the phase up
 * front here, so an `independent` learner starts directly in the questions and
 * the race can never strand them (a `worked`/`faded` learner still gets the
 * prologue). Mirrors `selectTutorPhase` — the single source of truth.
 */
function initialPhase(theta: number, n: number): Phase {
  return selectTutorPhase({ theta, n, recentFailures: 0 }) === "independent"
    ? "quiz"
    : "lesson";
}

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
  const {
    progress,
    getLevelProgress,
    getResume,
    saveResume,
    clearResume,
    recordAttempt,
    recordItemAttempt,
    getTopicMastery,
    getTopicVerdict,
    setReviewSchedule,
    recordCalibrationPair,
  } = useProgress();
  const { themeDef } = useTheme();

  // Phase 2: topic identity + Phase-1 mastery snapshot drive the tutor loop and
  // the per-item `recordItemAttempt` fold (COORDINATION §2.3/§2.4).
  const topicKey = useMemo(
    () => topicKeyForLevel(track.id, level),
    [track.id, level],
  );
  const mastery = getTopicMastery(topicKey);
  const theta = mastery?.theta ?? 0;
  const topicN = mastery?.n ?? 0;

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
      setPhase(initialPhase(theta, topicN));
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

  // When the current PRIMARY question appeared (for `recordItemAttempt.responseMs`).
  const questionShownAtRef = useRef<number>(Date.now());
  useEffect(() => {
    questionShownAtRef.current = Date.now();
  }, [index, phase]);

  // Phase 4: per-topic consecutive-miss counter (session-local, never persisted)
  // + the active mid-lesson remediation trigger. Both reset each new round.
  const missStreakRef = useRef<Record<string, number>>({});
  const [remediation, setRemediation] = useState<RemediationInput | null>(null);
  // Finish-time remediation: the origin input armed when a WEAK finish should
  // auto-launch remediation before the summary. Plus the round-local bookkeeping
  // that keeps it honest: which topics were ALREADY remediated this round (no
  // double-trigger) and the misconception behind the latest miss (descent edge).
  const [finishRemediation, setFinishRemediation] =
    useState<RemediationInput | null>(null);
  const remediatedTopicsRef = useRef<Set<string>>(new Set());
  const lastMissTagRef = useRef<string | undefined>(undefined);
  // Part B: snapshot at round start whether this topic is held only at a
  // diagnostic-seeded LOW-CONFIDENCE unlock, so a failing finish can detect a
  // swing-and-relock and route to the ~0.85 prerequisite remediation.
  const preRoundLowConfUnlockRef = useRef(false);
  useEffect(() => {
    missStreakRef.current = {};
    remediatedTopicsRef.current = new Set();
    lastMissTagRef.current = undefined;
    preRoundLowConfUnlockRef.current = isLowConfidenceUnlock(getTopicMastery(topicKey));
    setRemediation(null);
    setFinishRemediation(null);
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

  // Part A — honest "Why this question?" adaptive read. Same guessing-corrected
  // prediction the calibration logger uses (PRE-answer snapshot), plus the live
  // topic verdict. Presentational only; never mutates mastery.
  const whyProps: WhyThisQuestionProps | undefined = q
    ? {
        topicKey,
        difficulty: level.difficulty,
        predicted: predictSuccess(
          theta,
          progress.tierDifficulty?.[
            tierDifficultyKey(topicKey, level.difficulty)
          ] ?? seedTierDifficulty(level.difficulty),
          q.choices.length,
        ),
        verdict: getTopicVerdict(topicKey),
      }
    : undefined;

  const select = (choice: number) => {
    if (answered) return;
    const next = answers.slice();
    next[index] = choice;
    setAnswers(next);
    persist(index, next);
    // Phase 2: fold this ONE PRIMARY answer into topic mastery (Phase-1 hook).
    // Called exactly once per primary question (the `answered` guard + disabled
    // choice buttons prevent a double-fire). NEVER called from `QuizPractice`.
    if (q) {
      const correct = choice === q.correctIndex;
      const responseMs = Date.now() - questionShownAtRef.current;
      // Phase 5 calibration: log (predictedProbability, outcome) for the
      // reliability diagram. The prediction is the guessing-corrected
      // predictSuccess computed from the PRE-answer mastery snapshot (`theta`
      // this render) + the current tier difficulty. PRIMARY answers only —
      // never bonus practice (COORDINATION §2 / PHASE_5 §5).
      const tierD =
        progress.tierDifficulty?.[tierDifficultyKey(topicKey, level.difficulty)] ??
        seedTierDifficulty(level.difficulty);
      const predicted = predictSuccess(theta, tierD, q.choices.length);
      recordCalibrationPair(topicKey, predicted, correct ? 1 : 0);
      recordItemAttempt({
        topicKey,
        tier: level.difficulty,
        correct,
        mode: "quiz",
        kOptions: q.choices.length,
        chosenIndex: choice,
        misconceptions: resolveQuizMisconceptionKeys(topicKey, q, choice),
        responseMs,
        at: new Date().toISOString(),
      });
      // Phase 4: on a REPEATED miss (never the first), the pure policy decides
      // whether to descend the prerequisite DAG. Isolated from scoring/mastery
      // gate — the branch only ever calls `recordItemAttempt` for prereqs.
      maybeTriggerRemediation(correct, responseMs, () =>
        misconceptionTagOf(resolveQuizTag(q, choice)),
      );
    }
  };

  // Update the per-topic miss streak and, if `remediationStep` decides to
  // descend/teach on this repeated miss, arm the remediation branch. Guarded by
  // `REMEDIATION_MODE`; a first miss / slip / non-foundational level is a no-op.
  const maybeTriggerRemediation = (
    correct: boolean,
    responseMs: number,
    tagOf: () => string | undefined,
  ) => {
    if (REMEDIATION_MODE !== "dag") return;
    const streak = correct ? 0 : (missStreakRef.current[topicKey] ?? 0) + 1;
    missStreakRef.current[topicKey] = streak;
    if (correct) return;
    // Remember the misconception behind THIS miss so a finish-time descent can
    // pick the implicated prerequisite edge even without an armed mid-lesson run.
    lastMissTagRef.current = tagOf();
    if (remediation) return;
    const m = getTopicMastery(topicKey);
    const input: RemediationInput = {
      topicKey,
      theta: m?.theta ?? 0,
      alpha: m?.alpha ?? 1,
      beta: m?.beta ?? 1,
      n: m?.n ?? 0,
      consecutiveMisses: streak,
      // "At the floor tier" ≈ the level itself is already foundational (intro/easy);
      // harder levels ease within-topic first (Elo lowers the tier) before descent.
      atFloorTier: DIFFICULTY_META[level.difficulty].order <= 1,
      misconceptionTag: tagOf(),
      responseFast: responseMs < 4000,
      depthThisSession: 0,
    };
    const action = remediationStep(input);
    if (
      action.kind === "descend" ||
      action.kind === "teach-link" ||
      action.kind === "floor-teach"
    ) {
      remediatedTopicsRef.current.add(topicKey);
      setRemediation(input);
    }
  };

  const goNext = () => {
    setRemediation(null);
    if (index < questions.length - 1) {
      const ni = index + 1;
      setIndex(ni);
      persist(ni, answers);
    } else {
      finish();
    }
  };

  const finish = () => {
    // MCQ has no hint re-attempt, so partial credit does not exist: the visible
    // (display) score equals the binary gate. Pass gate == display so behavior
    // is unchanged while adopting the new split `recordAttempt` signature.
    const gateScore = roundScore(correctCount, questions.length);
    const score = gateScore;
    const r = recordAttempt(
      level.id,
      gateScore,
      level.masteryThreshold,
      gateScore,
    );
    clearResume(level.id);
    // Seam 1: persist the SM-2 spaced-review schedule for this topic. The pure
    // `planRoundReview` uses the canonical (Phase-4) `scheduleReview`: a cleared
    // topic advances the ladder, a due-and-missed review resets it, everything
    // else is a no-op. Additive — never touches score/mastery/locking.
    const plan = planRoundReview(getTopicMastery(topicKey), new Date().toISOString());
    if (plan) setReviewSchedule(topicKey, plan.reviewDue, plan.reviewStep);
    setResult({
      mastered: r.mastered,
      isNewMastery: r.isNewMastery,
      xpGained: r.xpGained,
    });
    // Phase 4 finish-time trigger: a WEAK/FAILED finish auto-launches a
    // remediation session (descend → probe → climb back) BEFORE the summary,
    // unless it was already remediated this round or the policy declines (slip /
    // non-DAG topic / within-node retry ⇒ degrade to the normal summary+retry).
    const finPlan = planFinishRemediation({
      topicKey,
      scoreFraction: score,
      // Part B: a failed round that swings a low-confidence unlock back under the
      // unlock bar (now no longer unlocked) routes to the ~0.85 prereq probe.
      wasLowConfidenceUnlock:
        preRoundLowConfUnlockRef.current &&
        !isTopicUnlocked(getTopicMastery(topicKey)),
      masteryThreshold: level.masteryThreshold,
      mastery: getTopicMastery(topicKey),
      levelDifficulty: level.difficulty,
      missedCount: questions.length - correctCount,
      misconceptionTag: lastMissTagRef.current,
      alreadyRemediated: remediatedTopicsRef.current.has(topicKey),
      mode: REMEDIATION_MODE,
    });
    if (finPlan.kind === "remediate") {
      setFinishRemediation(finPlan.origin);
      setPhase("remediation");
      return;
    }
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
    setPhase(initialPhase(theta, topicN));
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
          <TutorController
            level={level}
            illustration={Illustration ? <Illustration /> : null}
            roundQuestions={questions}
            theta={theta}
            n={topicN}
            onStart={startQuiz}
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
            hintLevel={level}
            why={whyProps}
          />
        )}

        {/* Phase 4 remediation: bounded backtracking down the prereq DAG. */}
        {phase === "quiz" && q && answered && remediation && (
          <div className="mt-4">
            <RemediationFlow
              key={`${q.id}-rem`}
              origin={remediation}
              onExit={() => setRemediation(null)}
            />
          </div>
        )}

        {/* Bonus practice: fresh same-concept parametric item, never scored. */}
        {phase === "quiz" &&
          q &&
          answered &&
          !remediation &&
          canRegenerateQuiz(level) && (
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

        {/* Phase 4 finish-time remediation: descend → probe → climb back before
            the learner sees the summary / can navigate away on a weak finish. */}
        {phase === "remediation" && finishRemediation && (
          <FinishRemediation
            origin={finishRemediation}
            onDone={() => {
              setFinishRemediation(null);
              setPhase("summary");
            }}
          />
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

function FlashcardLevel({ track, level }: { track: Track; level: Level }) {
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

/** Props for the honest "Why this question?" adaptive-read panel (Part A). */
interface WhyThisQuestionProps {
  topicKey: string;
  difficulty: Difficulty;
  predicted?: number;
  verdict: TopicVerdict;
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
  hintLevel,
  why,
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
  /**
   * OPTIONAL, additive. When present, renders the honest "Why this question?"
   * adaptive-read panel next to the concept chip. Omitted for bonus practice /
   * remediation cards (where per-item mastery data is not the primary signal).
   */
  why?: WhyThisQuestionProps;
  /**
   * When present, a WRONG answer shows the answer-withholding hint ladder
   * (PHASE_2 §5/§6) instead of the immediate explanation — the level is used to
   * regenerate a same-family worked sibling for rung 3. Purely presentational:
   * this NEVER records mastery (that is `recordItemAttempt` in the players).
   */
  hintLevel?: Level;
}) {
  const isCorrect = answered && selected === question.correctIndex;

  // Build the answer-withholding hint ladder for a WRONG primary/bonus answer.
  const ladder = useMemo(
    () =>
      answered && !isCorrect && selected !== null && hintLevel
        ? buildHintLadder({
            question,
            chosenIndex: selected,
            misconceptionTag: resolveQuizTag(question, selected),
            section: hintLevel.section,
          })
        : null,
    [answered, isCorrect, selected, hintLevel, question],
  );
  // Regenerate a same-family worked sibling for the ladder's rung 3 (completion).
  const sibling = useMemo<SiblingWorked | null>(() => {
    if (!ladder || !hintLevel) return null;
    const sib = generateFreshQuestion(
      hintLevel,
      freshPracticeSeed(),
      question.family,
      question,
      true,
      question,
    );
    if (!sib) return null;
    return {
      prompt: sib.prompt,
      steps: deriveWorkedSteps(sib.explanation).map((s) => s.text),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladder, hintLevel, question]);

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            {headerLabel ??
              `Question ${String(number).padStart(2, "0")} / ${total}`}
          </span>
          <span className="flex items-center gap-2">
            {question.concept && (
              <span className="chip border-subtle text-secondary">
                {question.concept}
              </span>
            )}
            {why && <WhyThisQuestion {...why} />}
          </span>
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
            {isCorrect ? (
              <p className="text-sm leading-relaxed text-secondary">
                {question.explanation}
              </p>
            ) : ladder ? (
              // Answer-withholding: the ladder holds "your error" (rung 1) through
              // the full worked solution (rung 5), revealed one rung at a time.
              <HintLadder rungs={ladder} siblingWorked={sibling} />
            ) : (
              <>
                {selected !== null &&
                  question.distractorRationale?.[selected] && (
                    <p className="text-sm text-primary">
                      <span className="label text-bear">Your error · </span>
                      {question.distractorRationale[selected]}
                    </p>
                  )}
                <p className="text-sm leading-relaxed text-secondary">
                  {question.explanation}
                </p>
              </>
            )}
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
  const {
    progress,
    getLevelProgress,
    getResume,
    saveResume,
    clearResume,
    recordAttempt,
    recordItemAttempt,
    getTopicMastery,
    getTopicVerdict,
    setReviewSchedule,
    recordCalibrationPair,
  } = useProgress();
  const { themeDef } = useTheme();

  // Phase 2: topic identity + Phase-1 mastery snapshot (mirrors QuizLevel).
  const topicKey = useMemo(
    () => topicKeyForLevel(track.id, level),
    [track.id, level],
  );
  const mastery = getTopicMastery(topicKey);
  const theta = mastery?.theta ?? 0;
  const topicN = mastery?.n ?? 0;

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
  // Per-item hint-credit ∈ [0,1], parallel to `answers` (0 = unanswered). This is
  // the credit-weighted VISIBLE score's raw material; `highestRung` cannot be
  // recovered from the final value, so it must be tracked (and persisted) here.
  const [credits, setCredits] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState("");
  const [result, setResult] = useState<{
    mastered: boolean;
    isNewMastery: boolean;
    xpGained: number;
    /** Credit-weighted VISIBLE score in [0,1] shown as the summary "Mastery %". */
    displayScore: number;
  } | null>(null);

  useEffect(() => {
    if (!level) return;
    const existing = getResume(level.id);
    if (existing && existing.questions.length) {
      setSeed(existing.seed);
      setQuestions(existing.questions as NumericQuestion[]);
      setIndex(existing.index);
      setAnswers(existing.answers);
      // Restore per-item credit; older blobs without it fall back to all-zero.
      setCredits(existing.credits ?? new Array(existing.answers.length).fill(0));
      setStartedAt(existing.startedAt);
      setPhase("quiz");
    } else {
      const s = Date.now() % 2_000_000_000;
      setSeed(s);
      const qs = materializeNumericLevel(level, s);
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(null));
      setCredits(new Array(qs.length).fill(0));
      setStartedAt(new Date().toISOString());
      setPhase(initialPhase(theta, topicN));
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

  // When the current PRIMARY question appeared (for `recordItemAttempt.responseMs`).
  const questionShownAtRef = useRef<number>(Date.now());
  useEffect(() => {
    questionShownAtRef.current = Date.now();
  }, [index, phase]);

  // Phase 4: per-topic consecutive-miss counter (session-local) + active trigger.
  const missStreakRef = useRef<Record<string, number>>({});
  const [remediation, setRemediation] = useState<RemediationInput | null>(null);
  // Finish-time remediation bookkeeping (mirrors QuizLevel — see there).
  const [finishRemediation, setFinishRemediation] =
    useState<RemediationInput | null>(null);
  const remediatedTopicsRef = useRef<Set<string>>(new Set());
  const lastMissTagRef = useRef<string | undefined>(undefined);
  // Part B: snapshot at round start whether this topic is held only at a
  // diagnostic-seeded LOW-CONFIDENCE unlock (see QuizLevel).
  const preRoundLowConfUnlockRef = useRef(false);
  useEffect(() => {
    missStreakRef.current = {};
    remediatedTopicsRef.current = new Set();
    lastMissTagRef.current = undefined;
    preRoundLowConfUnlockRef.current = isLowConfidenceUnlock(getTopicMastery(topicKey));
    setRemediation(null);
    setFinishRemediation(null);
  }, [seed]);

  if (!unlocked) return <Navigate to={`/track/${track.id}`} replace />;

  const persist = (
    nextIndex: number,
    nextAnswers: (number | null)[],
    nextCredits: number[] = credits,
  ) => {
    const state: ResumeState = {
      levelId: level.id,
      seed,
      questions,
      index: nextIndex,
      answers: nextAnswers,
      credits: nextCredits,
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

  // Part A — honest "Why this question?" adaptive read (numeric mode: free-entry,
  // so predictSuccess uses no guessing correction). Presentational only.
  const whyProps: WhyThisQuestionProps | undefined = q
    ? {
        topicKey,
        difficulty: level.difficulty,
        predicted: predictSuccess(
          theta,
          progress.tierDifficulty?.[
            tierDifficultyKey(topicKey, level.difficulty)
          ] ?? seedTierDifficulty(level.difficulty),
        ),
        verdict: getTopicVerdict(topicKey),
      }
    : undefined;

  // PHASE_1 free-response re-attempt flow: the FreeResponseCard runs the 5-rung
  // hint→re-attempt episode locally and calls this ONCE, when the episode
  // resolves (correct at some rung, or exhausted). We fold ONE PRIMARY item into
  // topic mastery with the FRACTIONAL partial credit from the rung schedule.
  const resolveItem = (r: {
    finalValue: number;
    correct: boolean;
    highestRung: HintRungReached;
    firstWrongValue?: number;
  }) => {
    if (answered) return;
    const next = answers.slice();
    next[index] = r.finalValue;
    setAnswers(next);
    // Record the credit-weighted partial credit for this item (parallel to
    // `answers`) so the VISIBLE score reflects how many hints were needed.
    const itemCredit = creditForEpisode(r.correct, r.highestRung);
    const nextCredits = credits.slice();
    nextCredits[index] = itemCredit;
    setCredits(nextCredits);
    persist(index, next, nextCredits);
    // Fold this ONE PRIMARY item into topic mastery (Phase-1 hook). Exactly once
    // per primary question; NEVER called from `NumericPractice`.
    if (q) {
      const responseMs = Date.now() - questionShownAtRef.current;
      // Phase 5 calibration: the honest, UNAIDED signal is whether they got it
      // right FIRST try (no hint). A hinted recovery counts as an outcome of 0
      // for the reliability diagram even though it earns partial mastery credit.
      const unaidedCorrect = r.correct && r.highestRung === 0;
      const tierD =
        progress.tierDifficulty?.[tierDifficultyKey(topicKey, level.difficulty)] ??
        seedTierDifficulty(level.difficulty);
      const predicted = predictSuccess(theta, tierD);
      recordCalibrationPair(topicKey, predicted, unaidedCorrect ? 1 : 0);
      // Bump the misconception the learner tripped on their FIRST wrong attempt
      // (help was used ⇒ credit < 1 ⇒ the mastery fold records it); a clean
      // first-try solve has no firstWrongValue and decays stale flags.
      const misconceptions =
        r.firstWrongValue != null
          ? resolveNumericMisconceptionKeys(topicKey, q, r.firstWrongValue)
          : [];
      recordItemAttempt({
        topicKey,
        tier: level.difficulty,
        correct: r.correct,
        mode: "numeric",
        chosenValue: r.finalValue,
        credit: itemCredit,
        highestRung: r.highestRung,
        misconceptions,
        responseMs,
        at: new Date().toISOString(),
      });
      maybeTriggerRemediation(r.correct, responseMs, () =>
        misconceptionTagOf(
          resolveNumericTag(q, r.firstWrongValue ?? r.finalValue),
        ),
      );
    }
  };

  // See QuizLevel: arm the DAG remediation branch on a REPEATED miss only.
  const maybeTriggerRemediation = (
    correct: boolean,
    responseMs: number,
    tagOf: () => string | undefined,
  ) => {
    if (REMEDIATION_MODE !== "dag") return;
    const streak = correct ? 0 : (missStreakRef.current[topicKey] ?? 0) + 1;
    missStreakRef.current[topicKey] = streak;
    if (correct) return;
    lastMissTagRef.current = tagOf();
    if (remediation) return;
    const m = getTopicMastery(topicKey);
    const input: RemediationInput = {
      topicKey,
      theta: m?.theta ?? 0,
      alpha: m?.alpha ?? 1,
      beta: m?.beta ?? 1,
      n: m?.n ?? 0,
      consecutiveMisses: streak,
      atFloorTier: DIFFICULTY_META[level.difficulty].order <= 1,
      misconceptionTag: tagOf(),
      responseFast: responseMs < 4000,
      depthThisSession: 0,
    };
    const action = remediationStep(input);
    if (
      action.kind === "descend" ||
      action.kind === "teach-link" ||
      action.kind === "floor-teach"
    ) {
      remediatedTopicsRef.current.add(topicKey);
      setRemediation(input);
    }
  };

  const goNext = () => {
    setRemediation(null);
    if (index < questions.length - 1) {
      const ni = index + 1;
      setIndex(ni);
      persist(ni, answers);
    } else {
      finish();
    }
  };

  const finish = () => {
    // Two scores from one round:
    //  • gateScore  — binary fraction ULTIMATELY correct (ignores hints); drives
    //    the lenient advance/unlock gate + remediation, so hint use can never
    //    bounce a learner below the pass bar. UNCHANGED behavior.
    //  • displayScore — credit-weighted mean of per-item hint-credit; the VISIBLE
    //    mastery % (map "Best X%" + summary), so answering after hints shows < 100%.
    const gateScore = roundScore(correctCount, questions.length);
    const displayScore = creditRoundScore(credits, questions.length);
    const r = recordAttempt(
      level.id,
      displayScore,
      level.masteryThreshold,
      gateScore,
    );
    clearResume(level.id);
    // Seam 1: persist the SM-2 spaced-review schedule (see QuizLevel.finish).
    const plan = planRoundReview(getTopicMastery(topicKey), new Date().toISOString());
    if (plan) setReviewSchedule(topicKey, plan.reviewDue, plan.reviewStep);
    setResult({
      mastered: r.mastered,
      isNewMastery: r.isNewMastery,
      xpGained: r.xpGained,
      displayScore,
    });
    // Phase 4 finish-time trigger (see QuizLevel.finish for the rationale). The
    // gate + remediation stay lenient: driven by the BINARY `gateScore`, never
    // the credit-weighted display score.
    const finPlan = planFinishRemediation({
      topicKey,
      scoreFraction: gateScore,
      // Part B: swing-and-relock ⇒ route to the ~0.85 prereq probe (see QuizLevel).
      wasLowConfidenceUnlock:
        preRoundLowConfUnlockRef.current &&
        !isTopicUnlocked(getTopicMastery(topicKey)),
      masteryThreshold: level.masteryThreshold,
      mastery: getTopicMastery(topicKey),
      levelDifficulty: level.difficulty,
      missedCount: questions.length - correctCount,
      misconceptionTag: lastMissTagRef.current,
      alreadyRemediated: remediatedTopicsRef.current.has(topicKey),
      mode: REMEDIATION_MODE,
    });
    if (finPlan.kind === "remediate") {
      setFinishRemediation(finPlan.origin);
      setPhase("remediation");
      return;
    }
    setPhase("summary");
    if (r.mastered) setTimeout(themeDef.celebration ?? celebrate, 260);
  };

  const retry = () => {
    const s = Date.now() % 2_000_000_000;
    setSeed(s);
    const qs = materializeNumericLevel(level, s);
    setQuestions(qs);
    setAnswers(new Array(qs.length).fill(null));
    setCredits(new Array(qs.length).fill(0));
    setIndex(0);
    setResult(null);
    setStartedAt(new Date().toISOString());
    setPhase(initialPhase(theta, topicN));
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
          <TutorController
            level={level}
            illustration={Illustration ? <Illustration /> : null}
            roundQuestions={questions}
            theta={theta}
            n={topicN}
            onStart={() => setPhase("quiz")}
          />
        )}

        {phase === "quiz" && q && (
          <FreeResponseCard
            key={q.id}
            question={q}
            number={index + 1}
            total={questions.length}
            isLast={index === questions.length - 1}
            onResolve={resolveItem}
            onNext={goNext}
            hintLevel={level}
            why={whyProps}
          />
        )}

        {/* Phase 4 remediation: bounded backtracking down the prereq DAG. */}
        {phase === "quiz" && q && answered && remediation && (
          <div className="mt-4">
            <RemediationFlow
              key={`${q.id}-rem`}
              origin={remediation}
              onExit={() => setRemediation(null)}
            />
          </div>
        )}

        {/* Bonus practice: fresh same-concept parametric item, never scored. */}
        {phase === "quiz" &&
          q &&
          answered &&
          !remediation &&
          canRegenerateNumeric(level) && (
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

        {/* Phase 4 finish-time remediation (see QuizLevel). */}
        {phase === "remediation" && finishRemediation && (
          <FinishRemediation
            origin={finishRemediation}
            onDone={() => {
              setFinishRemediation(null);
              setPhase("summary");
            }}
          />
        )}

        {phase === "summary" && result && (
          <NumericSummary
            correct={correctCount}
            total={questions.length}
            displayScore={result.displayScore}
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
  hintLevel,
  why,
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
  /** When present, a WRONG answer shows the answer-withholding hint ladder. */
  hintLevel?: Level;
  /** OPTIONAL honest "Why this question?" adaptive-read panel (Part A). */
  why?: WhyThisQuestionProps;
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

  // Answer-withholding hint ladder for a WRONG numeric answer (PHASE_2 §5/§6).
  const ladder = useMemo(
    () =>
      answered && !isCorrect && entered !== null && hintLevel
        ? buildHintLadder({
            question,
            chosenValue: entered,
            misconceptionTag: resolveNumericTag(question, entered),
            section: hintLevel.section,
          })
        : null,
    [answered, isCorrect, entered, hintLevel, question],
  );
  const sibling = useMemo<SiblingWorked | null>(() => {
    if (!ladder || !hintLevel) return null;
    const sib = generateFreshNumericQuestion(
      hintLevel,
      freshPracticeSeed(),
      question.family,
      question,
      true,
      question,
    );
    if (!sib) return null;
    return {
      prompt: sib.prompt,
      steps: deriveWorkedSteps(sib.explanation).map((s) => s.text),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladder, hintLevel, question]);

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
          <span className="flex items-center gap-2">
            {question.concept && (
              <span className="chip border-subtle text-secondary">
                {question.concept}
              </span>
            )}
            {why && <WhyThisQuestion {...why} />}
          </span>
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
            {isCorrect ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                {question.explanation}
              </p>
            ) : ladder ? (
              // Answer-withholding: the correct value + worked explanation live
              // inside the ladder's reveal (rung 5), shown only after the rungs.
              <HintLadder rungs={ladder} siblingWorked={sibling} />
            ) : (
              <>
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
                {grade.matchedError && (
                  <p className="text-sm text-primary">
                    <span className="label text-bear">Your error · </span>
                    {grade.matchedError.feedback}
                  </p>
                )}
                <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                  {question.explanation}
                </p>
              </>
            )}
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

/**
 * FREE-RESPONSE player card with the PHASE_1 re-attempt hint flow.
 *
 * On a WRONG answer it does NOT reveal — it discloses the 5-rung ladder ONE rung
 * at a time (rung 1 = the detected-misconception coaching sentence from the
 * item's parametric error modes) and lets the learner RE-ATTEMPT the SAME
 * instance. It tracks the highest rung reached and, when the episode resolves
 * (correct at some rung, or still wrong after all 5), calls `onResolve` ONCE with
 * the partial-credit inputs. Answer normalization accepts numbers, fractions,
 * decimals, percentages, and simple expressions (`gradeFreeResponse`).
 *
 * This is the primary-round player; the bonus/remediation paths keep the simpler
 * `NumericCard` (single submit, post-hoc ladder) so their behaviour is unchanged.
 */
function FreeResponseCard({
  question,
  number,
  total,
  isLast,
  hintLevel,
  onResolve,
  onNext,
  why,
}: {
  question: NumericQuestion;
  number: number;
  total: number;
  isLast: boolean;
  hintLevel: Level;
  onResolve: (r: {
    finalValue: number;
    correct: boolean;
    highestRung: HintRungReached;
    firstWrongValue?: number;
  }) => void;
  onNext: () => void;
  /** OPTIONAL honest "Why this question?" adaptive-read panel (Part A). */
  why?: WhyThisQuestionProps;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [episode, setEpisode] = useState<HintEpisode>(() => startEpisode());
  const [lastWrong, setLastWrong] = useState<number | null>(null);
  const firstWrongRef = useRef<number | undefined>(undefined);
  const resolvedRef = useRef(false);

  const unit = question.unit ?? "$";
  const isMoney = unit === "$";
  const inputLabel = isMoney ? "Your stake" : "Your answer";
  const placeholder = isMoney
    ? "e.g. 300"
    : question.decimals != null
      ? `e.g. ${(0).toFixed(question.decimals)}`
      : "e.g. 5";

  const resolved = isResolved(episode);
  const isCorrect = episode.status === "correct";

  // Ladder rebuilt from the MOST RECENT wrong entry so rung-1 coaching reflects
  // what the learner actually did; rungs 2–5 are family/generic and stable.
  const ladder = useMemo(
    () =>
      lastWrong !== null
        ? buildHintLadder({
            question,
            chosenValue: lastWrong,
            misconceptionTag: resolveNumericTag(question, lastWrong),
            section: hintLevel.section,
          })
        : null,
    [question, lastWrong, hintLevel],
  );
  const hasLadder = ladder !== null;
  const sibling = useMemo<SiblingWorked | null>(() => {
    if (!hasLadder) return null;
    const sib = generateFreshNumericQuestion(
      hintLevel,
      freshPracticeSeed(),
      question.family,
      question,
      true,
      question,
    );
    if (!sib) return null;
    return {
      prompt: sib.prompt,
      steps: deriveWorkedSteps(sib.explanation).map((s) => s.text),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLadder, hintLevel, question]);

  const handleSubmit = () => {
    if (resolved) return;
    const g = gradeFreeResponse(question, raw);
    if (g.parsed === null) {
      setError(
        isMoney
          ? "Enter a whole-dollar number (digits only, e.g. 300)."
          : "Enter a number, fraction, or expression (e.g. 2.8 or 1/3).",
      );
      return;
    }
    setError(null);
    const nextEp = submitAttempt(episode, g.correct);
    setEpisode(nextEp);
    if (!g.correct) {
      if (firstWrongRef.current === undefined) firstWrongRef.current = g.parsed;
      setLastWrong(g.parsed);
      setRaw("");
    }
    if (isResolved(nextEp) && !resolvedRef.current) {
      resolvedRef.current = true;
      onResolve({
        finalValue: g.parsed,
        correct: nextEp.status === "correct",
        highestRung: nextEp.highestRung,
        firstWrongValue: firstWrongRef.current,
      });
    }
  };

  const shownValue = resolved
    ? isCorrect
      ? raw || (lastWrong !== null ? String(lastWrong) : "")
      : lastWrong !== null
        ? String(lastWrong)
        : raw
    : raw;

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            {`Question ${String(number).padStart(2, "0")} / ${total}`}
          </span>
          <span className="flex items-center gap-2">
            {question.concept && (
              <span className="chip border-subtle text-secondary">
                {question.concept}
              </span>
            )}
            {why && <WhyThisQuestion {...why} />}
          </span>
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {question.prompt}
        </p>
      </div>

      {/* Free-response input (stays enabled for re-attempts until resolved). */}
      <div className="panel p-5">
        <label htmlFor={`fr-${question.id}`} className="label text-accent">
          {inputLabel}
        </label>
        <div className="mt-2 flex items-stretch gap-2">
          <div className="flex flex-1 items-center border-2 border-border-strong bg-surface focus-within:border-accent">
            <span className="px-3 font-mono text-lg font-semibold text-secondary">
              {unit}
            </span>
            <input
              id={`fr-${question.id}`}
              type="text"
              inputMode={question.decimals != null ? "decimal" : "numeric"}
              autoComplete="off"
              disabled={resolved}
              value={shownValue}
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
          {!resolved && (
            <button onClick={handleSubmit} className="btn-primary px-5">
              {episode.revealed > 0 ? "Re-attempt ▸" : "Submit ▸"}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-bear" role="alert">
            {error}
          </p>
        )}
        {!resolved && episode.revealed > 0 && (
          <p className="mt-2 text-xs text-muted">
            Not quite — read the coaching below, then re-enter your answer above.
          </p>
        )}
      </div>

      {/* Progressive hint ladder — disclosed one rung per wrong attempt. */}
      {ladder && episode.revealed > 0 && (
        <HintLadder
          rungs={ladder}
          siblingWorked={sibling}
          controlledRevealed={episode.revealed}
        />
      )}

      {resolved && (
        <div className="animate-print-in border border-subtle">
          <div
            className={`flex items-center justify-between px-4 py-2 ${
              isCorrect ? "bg-bull text-bg" : "bg-bear text-bg"
            }`}
          >
            <span className="font-mono text-xs font-semibold uppercase tracking-label">
              {isCorrect
                ? episode.highestRung === 0
                  ? "● Filled — Correct"
                  : `● Filled — Correct after ${episode.highestRung} hint${episode.highestRung > 1 ? "s" : ""}`
                : "● Rejected — Incorrect"}
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
              {isLast ? "Settle & See Results ▸" : "Next Question ▸"}
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
  displayScore,
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
  /** Credit-weighted VISIBLE score in [0,1] — the shown "Mastery %". */
  displayScore: number;
  threshold: number;
  mastered: boolean;
  xpGained: number;
  questions: NumericQuestion[];
  answers: (number | null)[];
  onRetry: () => void;
  onDone: () => void;
}) {
  // The visible percentage is the credit-weighted mastery (partial credit for
  // hint use), NOT the raw fraction correct. The "Score correct/total" column
  // below still shows the honest raw tally.
  const pct = Math.round(displayScore * 100);
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
            <div className="label text-[9px]">Mastery</div>
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

/* -------------------------------------------------------------------------- */
/*  Remediation (Phase 4) — bounded backtracking down the prerequisite DAG.    */
/*                                                                             */
/*  Triggered on a REPEATED miss (never the first) when `remediationStep`      */
/*  decides to descend/teach. It walks DOWN the static DAG, probing each        */
/*  prerequisite at its ~85%-predicted tier, stops at the first passed probe    */
/*  (teach the edge up), the graph floor, or the depth cap — then teaches the   */
/*  foundation using the SAME QuizCard/NumericCard + Phase-2 hint ladder.       */
/*                                                                             */
/*  Remediation items call `recordItemAttempt` for the PREREQ topic (so its     */
/*  mastery updates) but are ISOLATED like bonus practice: they never touch     */
/*  the round score, `recordAttempt`, resume, or `LevelProgress.mastered`.      */
/*  All policy logic lives in pure, tested `src/lib/remediation/**` modules;    */
/*  this component is a thin renderer. Guarded by `REMEDIATION_MODE === "dag"`. */
/* -------------------------------------------------------------------------- */

function RemediationFlow({
  origin,
  onExit,
}: {
  /** The origin-node decision input built by the lesson player on a repeated miss. */
  origin: RemediationInput;
  onExit: () => void;
}) {
  const { recordItemAttempt, getTopicMastery } = useProgress();
  const [session, setSession] = useState<RemediationSession>(() =>
    startRemediation(origin.topicKey),
  );
  const [action, setAction] = useState<RemediationAction>(() =>
    remediationStep({ ...origin, depthThisSession: 0 }),
  );
  const [probe, setProbe] = useState<ProbeItem | null>(null);
  const [teachItem, setTeachItem] = useState<ProbeItem | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [entered, setEntered] = useState<number | null>(null);
  const [pending, setPending] = useState<RemediationAction | null>(null);
  const shownAtRef = useRef<number>(Date.now());

  // Materialize content for the current decision: a probe on `descend`, a worked
  // example on `teach-link`/`floor-teach`. Advancing the depth counter happens
  // here so it stays in lockstep with the descent.
  useEffect(() => {
    if (action.kind === "descend") {
      // Honor the policy's ~0.85-target probe tier (probe.ts degrades to the
      // node's easy levelRef when it has no such tier variant).
      const p = buildProbeItem(
        action.toTopicKey,
        freshPracticeSeed(),
        action.probeTier,
      );
      setProbe(p);
      setSelected(null);
      setEntered(null);
      setPending(null);
      shownAtRef.current = Date.now();
      setSession((s) => descendTo(s, action.toTopicKey));
      // No materializable item at the prereq ⇒ teach the foundation directly.
      if (!p) setAction({ kind: "floor-teach", atTopicKey: action.toTopicKey });
    } else if (action.kind === "teach-link" || action.kind === "floor-teach") {
      setTeachItem(buildProbeItem(action.atTopicKey, freshPracticeSeed()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const answered = selected !== null || entered !== null;

  // Fold ONE probe answer into the PREREQ topic's mastery, then stage the next
  // descent/teach decision (applied on "Continue"). Never scores the round.
  const stageNext = (
    topicKey: string,
    correct: boolean,
    tag: string | undefined,
  ) => {
    const m = getTopicMastery(topicKey);
    setPending(
      remediationStep({
        topicKey,
        theta: m?.theta ?? 0,
        alpha: m?.alpha ?? 1,
        beta: m?.beta ?? 1,
        n: m?.n ?? 0,
        consecutiveMisses: correct ? 0 : 1,
        atFloorTier: true,
        misconceptionTag: tag,
        responseFast: false,
        depthThisSession: session.depth,
      }),
    );
  };

  const answerQuiz = (choice: number) => {
    if (!probe?.question || answered) return;
    const correct = choice === probe.question.correctIndex;
    setSelected(choice);
    recordItemAttempt({
      topicKey: probe.topicKey,
      tier: probe.level.difficulty,
      correct,
      mode: "quiz",
      kOptions: probe.question.choices.length,
      chosenIndex: choice,
      misconceptions: resolveQuizMisconceptionKeys(
        probe.topicKey,
        probe.question,
        choice,
      ),
      responseMs: Date.now() - shownAtRef.current,
      at: new Date().toISOString(),
    });
    stageNext(
      probe.topicKey,
      correct,
      correct
        ? undefined
        : misconceptionTagOf(resolveQuizTag(probe.question, choice)),
    );
  };

  const answerNumeric = (value: number) => {
    if (!probe?.numericQuestion || answered) return;
    const correct = numericMatches(probe.numericQuestion, value);
    setEntered(value);
    recordItemAttempt({
      topicKey: probe.topicKey,
      tier: probe.level.difficulty,
      correct,
      mode: "numeric",
      chosenValue: value,
      misconceptions: resolveNumericMisconceptionKeys(
        probe.topicKey,
        probe.numericQuestion,
        value,
      ),
      responseMs: Date.now() - shownAtRef.current,
      at: new Date().toISOString(),
    });
    stageNext(
      probe.topicKey,
      correct,
      correct
        ? undefined
        : misconceptionTagOf(resolveNumericTag(probe.numericQuestion, value)),
    );
  };

  const advance = () => {
    if (pending) setAction(pending);
  };

  const interstitial = (
    <div className="flex items-center justify-between">
      <span className="label text-accent">Shoring Up the Foundation</span>
      <span className="chip border-subtle text-secondary">
        Not scored · builds mastery
      </span>
    </div>
  );

  const teachNode =
    action.kind === "teach-link" || action.kind === "floor-teach"
      ? prereqNode(action.atTopicKey)
      : undefined;

  return (
    <div className="animate-print-in space-y-4 border-t-2 border-dashed border-accent pt-5">
      {interstitial}
      <p className="text-sm text-secondary">
        Good — you're in the productive zone, not simply &ldquo;wrong.&rdquo; Two
        misses in a row here usually means a foundation underneath needs a quick
        top-up. Let&rsquo;s check it, then climb straight back.
      </p>

      {action.kind === "descend" && probe && (
        <>
          <p className="text-xs text-muted">
            Prerequisite check ·{" "}
            <span className="text-secondary">{probe.level.title}</span>
          </p>
          {probe.mode === "quiz" && probe.question ? (
            <QuizCard
              key={probe.question.id}
              question={probe.question}
              number={0}
              total={0}
              answered={answered}
              selected={selected}
              isLast={false}
              onSelect={answerQuiz}
              onNext={advance}
              headerLabel="Foundation Probe"
              nextLabel="Continue ▸"
              hintLevel={probe.level}
            />
          ) : probe.numericQuestion ? (
            <NumericCard
              key={probe.numericQuestion.id}
              question={probe.numericQuestion}
              number={0}
              total={0}
              answered={answered}
              entered={entered}
              isLast={false}
              onSubmit={answerNumeric}
              onNext={advance}
              headerLabel="Foundation Probe"
              nextLabel="Continue ▸"
              hintLevel={probe.level}
            />
          ) : null}
        </>
      )}

      {teachNode && (
        <div className="panel p-5">
          <span className="label text-accent">
            {action.kind === "floor-teach"
              ? "Foundation · Start Here"
              : "Bridge Up · How It Composes"}
          </span>
          <h3 className="mt-2 font-display text-lg font-semibold text-primary">
            {teachNode.label}
          </h3>
          {teachNode.topicKey && teachItem?.level.lesson.keyIdea && (
            <div className="mt-3 border-l-2 border-accent bg-surface-muted px-4 py-3">
              <div className="label text-accent">Key idea</div>
              <div className="mt-1 font-display text-base font-semibold text-primary">
                {teachItem.level.lesson.keyIdea}
              </div>
            </div>
          )}
          {teachItem && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-primary">
                {teachItem.question?.prompt ?? teachItem.numericQuestion?.prompt}
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                {teachItem.question?.explanation ??
                  teachItem.numericQuestion?.explanation}
              </p>
            </div>
          )}
          <button onClick={onExit} className="btn-primary mt-4 w-full">
            Got the foundation — resume the lesson ▸
          </button>
        </div>
      )}

      {action.kind === "exit" && (
        <div className="panel p-5">
          <p className="text-sm text-secondary">
            That looked like a slip more than a gap — no detour needed. Keep
            going.
          </p>
          <button onClick={onExit} className="btn-primary mt-3 w-full">
            Resume the lesson ▸
          </button>
        </div>
      )}

      {action.kind === "retry-in-place" && (
        <div className="panel p-5">
          <p className="text-sm text-secondary">
            Let&rsquo;s ease the difficulty and try one more here before digging
            deeper.
          </p>
          <button onClick={onExit} className="btn-primary mt-3 w-full">
            Resume the lesson ▸
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Finish-time remediation (Phase 4) — the WHOLE descent → probe → climb-back */
/*  journey, auto-launched when a level is FINISHED below its mastery bar.      */
/*                                                                             */
/*  Unlike the mid-lesson `RemediationFlow` (a single descend/probe/teach step */
/*  interleaved into an in-progress round), this runs the full loop before the  */
/*  learner reaches the summary: it descends the prereq DAG from the failed     */
/*  topic (probing each prerequisite at its ~0.85 tier), teaches at the frontier*/
/*  / floor, then CLIMBS BACK up the visited path to the origin — re-serving one */
/*  probe per ancestor and reading the ~0.80 CI-low "node cleared" gate         */
/*  (`isNodeCleared`) as a progress cue. Every probe updates ONLY the PREREQ     */
/*  topic's mastery (isolated from the round score, exactly like bonus practice) */
/*  and the learner can ALWAYS bail to their results — never an inescapable loop.*/
/*  All decisions come from the same pure `remediation/**` modules.             */
/* -------------------------------------------------------------------------- */

export function FinishRemediation({
  origin,
  onDone,
}: {
  /** The origin-node decision input built by the lesson player at finish time. */
  origin: RemediationInput;
  /** Called when remediation is finished / skipped — the caller shows the summary. */
  onDone: () => void;
}) {
  const { progress, recordItemAttempt, getTopicMastery } = useProgress();

  const [session, setSession] = useState<RemediationSession>(() =>
    startRemediation(origin.topicKey),
  );
  const [action, setAction] = useState<RemediationAction>(() =>
    remediationStep({ ...origin, depthThisSession: 0 }),
  );
  const [probe, setProbe] = useState<ProbeItem | null>(null);
  const [teachItem, setTeachItem] = useState<ProbeItem | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [entered, setEntered] = useState<number | null>(null);
  const [pending, setPending] = useState<RemediationAction | null>(null);
  const [cleared, setCleared] = useState<boolean | null>(null);
  // Climb-back queue: ancestor topicKeys from the taught node UP to the origin.
  const [climb, setClimb] = useState<{ queue: string[]; i: number } | null>(
    null,
  );
  const shownAtRef = useRef<number>(Date.now());

  // Serve the probe/climb tier at the learner's ~0.85 band for that node.
  const tierFor = (topicKey: string): Difficulty =>
    probeTierFor(
      getTopicMastery(topicKey)?.theta ?? origin.theta,
      topicKey,
      progress.tierDifficulty ?? {},
    );

  // Materialize content for the current DESCENT decision (the climb has its own
  // probe loader). Advancing the depth counter happens here in lockstep.
  useEffect(() => {
    if (climb) return;
    if (action.kind === "descend") {
      const p = buildProbeItem(
        action.toTopicKey,
        freshPracticeSeed(),
        action.probeTier,
      );
      setProbe(p);
      setSelected(null);
      setEntered(null);
      setPending(null);
      setCleared(null);
      shownAtRef.current = Date.now();
      setSession((s) => descendTo(s, action.toTopicKey));
      // No materializable item at the prereq ⇒ teach the foundation directly.
      if (!p) setAction({ kind: "floor-teach", atTopicKey: action.toTopicKey });
    } else if (action.kind === "teach-link" || action.kind === "floor-teach") {
      setTeachItem(buildProbeItem(action.atTopicKey, freshPracticeSeed()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const answered = selected !== null || entered !== null;

  // Fold ONE probe answer into the current node's mastery, note the ~0.80 clear
  // gate, and (on a DESCENT probe) stage the next descend/teach decision.
  const afterAnswer = (
    topicKey: string,
    correct: boolean,
    tag: string | undefined,
  ) => {
    const m = getTopicMastery(topicKey);
    setCleared(isNodeCleared(m?.alpha ?? 1, m?.beta ?? 1, correct ? 1 : 0));
    if (climb) return; // the climb advances via its own "Continue" button
    setPending(
      remediationStep({
        topicKey,
        theta: m?.theta ?? 0,
        alpha: m?.alpha ?? 1,
        beta: m?.beta ?? 1,
        n: m?.n ?? 0,
        consecutiveMisses: correct ? 0 : 1,
        atFloorTier: true,
        misconceptionTag: tag,
        responseFast: false,
        depthThisSession: session.depth,
      }),
    );
  };

  const answerQuiz = (choice: number) => {
    if (!probe?.question || answered) return;
    const correct = choice === probe.question.correctIndex;
    setSelected(choice);
    recordItemAttempt({
      topicKey: probe.topicKey,
      tier: probe.level.difficulty,
      correct,
      mode: "quiz",
      kOptions: probe.question.choices.length,
      chosenIndex: choice,
      misconceptions: resolveQuizMisconceptionKeys(
        probe.topicKey,
        probe.question,
        choice,
      ),
      responseMs: Date.now() - shownAtRef.current,
      at: new Date().toISOString(),
    });
    afterAnswer(
      probe.topicKey,
      correct,
      correct
        ? undefined
        : misconceptionTagOf(resolveQuizTag(probe.question, choice)),
    );
  };

  const answerNumeric = (value: number) => {
    if (!probe?.numericQuestion || answered) return;
    const correct = numericMatches(probe.numericQuestion, value);
    setEntered(value);
    recordItemAttempt({
      topicKey: probe.topicKey,
      tier: probe.level.difficulty,
      correct,
      mode: "numeric",
      chosenValue: value,
      misconceptions: resolveNumericMisconceptionKeys(
        probe.topicKey,
        probe.numericQuestion,
        value,
      ),
      responseMs: Date.now() - shownAtRef.current,
      at: new Date().toISOString(),
    });
    afterAnswer(
      probe.topicKey,
      correct,
      correct
        ? undefined
        : misconceptionTagOf(resolveNumericTag(probe.numericQuestion, value)),
    );
  };

  const advanceDescend = () => {
    if (pending) setAction(pending);
  };

  // Load the next climb-back probe (or finish if that ancestor can't be probed —
  // bounded, never trapping the learner).
  const loadClimbProbe = (topicKey: string) => {
    const p = buildProbeItem(topicKey, freshPracticeSeed(), tierFor(topicKey));
    setProbe(p);
    setSelected(null);
    setEntered(null);
    setCleared(null);
    shownAtRef.current = Date.now();
    return p;
  };

  // Begin the climb back: re-serve each ancestor from just above the taught node
  // up to (and including) the origin. Nothing to climb ⇒ straight to results.
  const startClimb = () => {
    const queue: string[] = [];
    for (let d = session.depth - 1; d >= 0; d--) queue.push(session.path[d]);
    let start = 0;
    while (start < queue.length && !loadClimbProbe(queue[start])) start++;
    if (start >= queue.length) {
      onDone();
      return;
    }
    setClimb({ queue, i: start });
  };

  const advanceClimb = () => {
    if (!climb) return;
    let next = climb.i + 1;
    while (next < climb.queue.length && !loadClimbProbe(climb.queue[next]))
      next++;
    if (next >= climb.queue.length) {
      onDone();
      return;
    }
    setClimb({ queue: climb.queue, i: next });
  };

  const teachNode =
    !climb && (action.kind === "teach-link" || action.kind === "floor-teach")
      ? prereqNode(action.atTopicKey)
      : undefined;

  const showProbe =
    !!probe && (climb !== null || action.kind === "descend");
  const onProbeNext = climb ? advanceClimb : advanceDescend;

  return (
    <div className="animate-print-in space-y-4 border-t-2 border-dashed border-accent pt-5">
      <div className="flex items-center justify-between">
        <span className="label text-accent">
          Foundation Check Before You Move On
        </span>
        <span className="chip border-subtle text-secondary">
          Not scored · builds mastery
        </span>
      </div>
      <p className="text-sm text-secondary">
        That attempt finished below the mastery bar. Instead of moving on with a
        gap, let&rsquo;s quickly check the foundation underneath this topic and
        shore it up — then climb straight back and review your results.
      </p>

      {showProbe && probe && (
        <>
          <p className="text-xs text-muted">
            {climb ? "Climbing back · " : "Prerequisite check · "}
            <span className="text-secondary">{probe.level.title}</span>
          </p>
          {probe.mode === "quiz" && probe.question ? (
            <QuizCard
              key={probe.question.id}
              question={probe.question}
              number={0}
              total={0}
              answered={answered}
              selected={selected}
              isLast={false}
              onSelect={answerQuiz}
              onNext={onProbeNext}
              headerLabel={climb ? "Climb-Back Check" : "Foundation Probe"}
              nextLabel="Continue ▸"
              hintLevel={probe.level}
            />
          ) : probe.numericQuestion ? (
            <NumericCard
              key={probe.numericQuestion.id}
              question={probe.numericQuestion}
              number={0}
              total={0}
              answered={answered}
              entered={entered}
              isLast={false}
              onSubmit={answerNumeric}
              onNext={onProbeNext}
              headerLabel={climb ? "Climb-Back Check" : "Foundation Probe"}
              nextLabel="Continue ▸"
              hintLevel={probe.level}
            />
          ) : null}
          {answered && cleared !== null && (
            <p className="text-xs text-muted">
              {cleared
                ? "Looking solid here — climbing back toward the topic."
                : "Let’s keep shoring this up as we climb back."}
            </p>
          )}
        </>
      )}

      {teachNode && (
        <div className="panel p-5">
          <span className="label text-accent">
            {action.kind === "floor-teach"
              ? "Foundation · Start Here"
              : "Bridge Up · How It Composes"}
          </span>
          <h3 className="mt-2 font-display text-lg font-semibold text-primary">
            {teachNode.label}
          </h3>
          {teachNode.topicKey && teachItem?.level.lesson.keyIdea && (
            <div className="mt-3 border-l-2 border-accent bg-surface-muted px-4 py-3">
              <div className="label text-accent">Key idea</div>
              <div className="mt-1 font-display text-base font-semibold text-primary">
                {teachItem.level.lesson.keyIdea}
              </div>
            </div>
          )}
          {teachItem && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-primary">
                {teachItem.question?.prompt ?? teachItem.numericQuestion?.prompt}
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                {teachItem.question?.explanation ??
                  teachItem.numericQuestion?.explanation}
              </p>
            </div>
          )}
          <button onClick={startClimb} className="btn-primary mt-4 w-full">
            {session.depth > 0
              ? "Got it — climb back up ▸"
              : "Got the foundation — see results ▸"}
          </button>
        </div>
      )}

      {!climb && action.kind === "exit" && (
        <div className="panel p-5">
          <p className="text-sm text-secondary">
            That looked more like a slip than a gap — no detour needed.
          </p>
          <button onClick={onDone} className="btn-primary mt-3 w-full">
            See my results ▸
          </button>
        </div>
      )}

      {!climb && action.kind === "retry-in-place" && (
        <div className="panel p-5">
          <p className="text-sm text-secondary">
            Let&rsquo;s ease the difficulty and size a fresh set when you&rsquo;re
            ready.
          </p>
          <button onClick={onDone} className="btn-primary mt-3 w-full">
            See my results ▸
          </button>
        </div>
      )}

      {/* Always-available escape: never trap the learner in a remediation loop. */}
      <button onClick={onDone} className="btn-ghost w-full text-sm">
        Skip remediation — see my results ▸
      </button>
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
          hintLevel={level}
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
          hintLevel={level}
        />
      )}
    </div>
  );
}
