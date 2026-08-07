import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import { materializeLevel } from "@/content/materialize";
import { misconceptionTagOf } from "@/content/remediation/prereqDAG";
import {
  DIFFICULTY_META,
  type Level,
  type Question,
  type Track,
} from "@/types/content";
import type { ResumeState } from "@/types/progress";
import { isLevelUnlockedBySection } from "@/lib/locking";
import { canRegenerateQuiz, questionSignature } from "@/lib/regenerate";
import { countQuizCorrect, roundScore } from "@/lib/score";
import { celebrate } from "@/lib/celebrate";
import { topicKeyForLevel, tierDifficultyKey } from "@/lib/mastery/topicKey";
import { predictSuccess, seedTierDifficulty } from "@/lib/mastery/elo";
import { isLowConfidenceUnlock, isTopicUnlocked } from "@/lib/mastery/unlock";
import { planRoundReview } from "@/lib/adaptivity/review";
import {
  resolveQuizTag,
  resolveQuizMisconceptionKeys,
} from "@/lib/tutor/misconception";
import { TutorController } from "@/components/tutor/TutorController";
import { REMEDIATION_MODE } from "@/lib/remediation/config";
import {
  remediationStep,
  type RemediationAction,
  type RemediationInput,
} from "@/lib/remediation/policy";
import { planFinishRemediation } from "@/lib/remediation/finish";
import type { TopicMastery } from "@/types/mastery";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { ChevronLeftIcon } from "@/components/icons";
import {
  QuizCard,
  Summary,
  type WhyThisQuestionProps,
} from "@/pages/lesson/cards";
import {
  RemediationFlow,
  FinishRemediation,
  QuizPractice,
} from "@/pages/lesson/remediation";
import { LevelFinishGuidance } from "@/pages/lesson/LevelFinishGuidance";
import { type Phase, initialPhase } from "@/pages/lesson/phase";

export function QuizLevel({ track, level }: { track: Track; level: Level }) {
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
    // Also honor a diagnostic-seeded low-confidence unlock of this topic (Part B).
    return (
      isLevelUnlockedBySection(
        track.levels,
        idx,
        (id) => !!getLevelProgress(id)?.mastered,
      ) || isTopicUnlocked(mastery)
    );
  }, [track, level, getLevelProgress, mastery]);

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
      const { mastery: nextMastery, relock } = recordItemAttempt({
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
      // Part B: if this fold RE-LOCKED a low-confidence unlock, `recordItemAttempt`
      // planned the ~0.85 prerequisite probe — surface it through the SAME
      // mid-lesson remediation UI (a confirmed gap descends on the first miss,
      // before the Kapur retry-in-place path would otherwise ease in place).
      surfaceRelockRemediation(relock, nextMastery);
    }
  };

  // Route a planned Part-B relock action into the existing mid-lesson
  // `RemediationFlow` by arming a forceDescend origin (its internal
  // `remediationStep` reproduces the planned ~0.85 prereq descent). Marks the
  // topic remediated so the finish-time trigger does not double-fire.
  const surfaceRelockRemediation = (
    relock: RemediationAction | null,
    nextMastery: TopicMastery | undefined,
  ) => {
    if (!relock || remediation) return;
    remediatedTopicsRef.current.add(topicKey);
    setRemediation({
      topicKey,
      theta: nextMastery?.theta ?? 0,
      alpha: nextMastery?.alpha ?? 1,
      beta: nextMastery?.beta ?? 1,
      n: nextMastery?.n ?? 0,
      consecutiveMisses: 2,
      atFloorTier: false,
      misconceptionTag: lastMissTagRef.current,
      responseFast: false,
      depthThisSession: 0,
      forceDescend: true,
    });
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
    // (credit-weighted) mastery equals the binary correct/total. So the mastery
    // gate reads the same value it always did here — MCQ mastery behavior is
    // unchanged by the credit-weighted gate fix (which only bites hint-bearing
    // numeric rounds).
    const gateScore = roundScore(correctCount, questions.length);
    const score = gateScore;
    const r = recordAttempt(level.id, gateScore, level.masteryThreshold);
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
          <div className="space-y-5">
            <LevelFinishGuidance
              topicKey={topicKey}
              mastered={result.mastered}
              misconceptionTag={lastMissTagRef.current}
            />
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
          </div>
        )}
      </main>
    </div>
  );
}
