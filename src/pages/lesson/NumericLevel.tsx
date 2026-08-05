import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import { materializeNumericLevel } from "@/content/materialize";
import { misconceptionTagOf } from "@/content/remediation/prereqDAG";
import {
  DIFFICULTY_META,
  type Level,
  type NumericQuestion,
  type Track,
} from "@/types/content";
import type { ResumeState } from "@/types/progress";
import { isLevelUnlockedBySection } from "@/lib/locking";
import { canRegenerateNumeric, numericSignature } from "@/lib/regenerate";
import {
  countNumericCorrect,
  roundScore,
  creditRoundScore,
} from "@/lib/score";
import { celebrate } from "@/lib/celebrate";
import { topicKeyForLevel, tierDifficultyKey } from "@/lib/mastery/topicKey";
import { predictSuccess, seedTierDifficulty } from "@/lib/mastery/elo";
import { isLowConfidenceUnlock, isTopicUnlocked } from "@/lib/mastery/unlock";
import { planRoundReview } from "@/lib/adaptivity/review";
import { creditForEpisode, type HintRungReached } from "@/lib/tutor/creditSchedule";
import {
  resolveNumericTag,
  resolveNumericMisconceptionKeys,
} from "@/lib/tutor/misconception";
import { TutorController } from "@/components/tutor/TutorController";
import { REMEDIATION_MODE } from "@/lib/remediation/config";
import {
  remediationStep,
  type RemediationInput,
} from "@/lib/remediation/policy";
import { planFinishRemediation } from "@/lib/remediation/finish";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { ChevronLeftIcon } from "@/components/icons";
import {
  FreeResponseCard,
  NumericSummary,
  type WhyThisQuestionProps,
} from "@/pages/lesson/cards";
import {
  RemediationFlow,
  FinishRemediation,
  NumericPractice,
} from "@/pages/lesson/remediation";
import { type Phase, initialPhase } from "@/pages/lesson/phase";

/* -------------------------------------------------------------------------- */
/*  Numeric (free-entry) level player — Betting & Sizing (Kelly).              */
/*  Type a number → EXACT-match grade → reveal answer + worked explanation,    */
/*  with targeted feedback when the entry matches a known Kelly error.         */
/* -------------------------------------------------------------------------- */

export function NumericLevel({ track, level }: { track: Track; level: Level }) {
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
