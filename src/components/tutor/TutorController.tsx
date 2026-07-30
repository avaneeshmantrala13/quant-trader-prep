import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  isNumericLevel,
  type Level,
  type NumericQuestion,
  type Question,
} from "@/types/content";
import {
  generateFreshNumericQuestion,
  generateFreshQuestion,
  freshPracticeSeed,
} from "@/lib/regenerate";
import { selectTutorPhase, type TutorPhase } from "@/lib/tutor/phase";
import { deriveWorkedSteps, buildFadedStages } from "@/lib/tutor/faded";
import { buildSelfExplainMCQ } from "@/lib/tutor/selfExplain";
import { numericAnswerText } from "@/lib/tutor/hintLadder";
import { buildDeepDive } from "@/lib/tutor/deepDive";
import { WorkedExample } from "./WorkedExample";
import { FadedSteps } from "./FadedSteps";

/**
 * The three-phase tutor loop (PHASE_2 §5/§6) that REPLACES the passive prologue.
 *
 * Selects worked-example → faded/completion → independent from Phase-1 topic θ
 * (Kalyuga expertise-reversal: fade scaffolding as skill rises). The worked /
 * faded instance is a FRESH same-family sibling (via `regenerate.ts`) so the
 * scored round questions stay unseen. `independent` learners skip straight to the
 * quiz (no forced prologue). Fully deterministic / functional with the AI flag
 * OFF; all logic lives in the pure `src/lib/tutor` modules.
 */
export function TutorController({
  level,
  illustration,
  roundQuestions,
  theta,
  n,
  onStart,
}: {
  level: Level;
  illustration?: ReactNode;
  /** The scored round's questions — used to seed the family and avoid repeats. */
  roundQuestions: (Question | NumericQuestion)[];
  /** Phase-1 topic θ (0 if unseen) and items answered in the topic. */
  theta: number;
  n: number;
  onStart: () => void;
}) {
  const phase: TutorPhase = useMemo(
    () => selectTutorPhase({ theta, n, recentFailures: 0 }),
    [theta, n],
  );

  // Independent learners go straight to the quiz (expertise reversal): no prologue.
  const started = useRef(false);
  useEffect(() => {
    if (phase === "independent" && !started.current) {
      started.current = true;
      onStart();
    }
  }, [phase, onStart]);

  // Build ONE fresh same-family sibling to teach from (stable across renders).
  const [seed] = useState(() => freshPracticeSeed());
  const numeric = isNumericLevel(level);

  const sample = useMemo<Question | NumericQuestion | null>(() => {
    const current = roundQuestions[0];
    if (numeric) {
      return generateFreshNumericQuestion(
        level,
        seed,
        (current as NumericQuestion | undefined)?.family,
        roundQuestions as NumericQuestion[],
        true,
        (current as NumericQuestion) ?? null,
      );
    }
    return generateFreshQuestion(
      level,
      seed,
      (current as Question | undefined)?.family,
      roundQuestions as Question[],
      true,
      (current as Question) ?? null,
    );
  }, [level, seed, numeric, roundQuestions]);

  // Independent learners skip the prologue entirely (auto-started by the effect
  // above), so render nothing while that fires.
  if (phase === "independent") return null;

  // A STATIC-pool level (hand-authored `questions` / `numericQuestions`, no
  // parametric generator) can't synthesize a fresh worked-example sibling, so
  // `sample` is null here. Previously this returned `null`, which rendered a
  // COMPLETELY BLANK lesson screen for a non-independent learner — no worked
  // example AND no way to start, i.e. the level served no questions and the
  // learner was stranded (a hard-fail progression bug). Never strand them:
  // fall back to the level's own briefing + an explicit Start action so the
  // round is always reachable (mirrors the pre-tutor prologue).
  if (!sample) {
    return (
      <StaticLevelIntro
        level={level}
        illustration={illustration}
        onStart={onStart}
      />
    );
  }

  const steps = deriveWorkedSteps(sample.explanation).map((s) => s.text);
  const answer =
    "choices" in sample
      ? sample.choices[sample.correctIndex]
      : numericAnswerText(sample);

  // Solver-grounded pitfalls: WRONG-option rationale (quiz) or common-error
  // feedback (numeric). These are the item's own misconception taxonomy, so the
  // deep-dive can never drift from what the questions test.
  const solverPitfalls =
    "choices" in sample
      ? (sample.distractorRationale ?? []).filter(
          (_, i) => i !== sample.correctIndex,
        )
      : (sample.commonErrors ?? []).map((e) => e.feedback);

  const deepDive = buildDeepDive({
    concept: sample.concept,
    keyIdea: level.lesson.keyIdea,
    authored: level.lesson.deepDive,
    workedSteps: steps,
    workedExplanation: sample.explanation,
    solverPitfalls,
    answer,
    answerLabel: "Answer",
    fallbackParagraphs: level.lesson.paragraphs,
  });

  if (phase === "worked") {
    return (
      <WorkedExample
        concept={sample.concept}
        prompt={sample.prompt}
        steps={steps}
        answer={answer}
        illustration={illustration}
        onContinue={onStart}
        deepDive={deepDive}
      />
    );
  }

  // faded
  const workedSteps = deriveWorkedSteps(sample.explanation);
  const stages = buildFadedStages(workedSteps);
  // Stage 1 blanks only the misconception-critical step (fade it first, Renkl).
  const stage = stages[Math.min(1, stages.length - 1)];
  const selfExplain =
    "choices" in sample ? buildSelfExplainMCQ(sample) : null;

  return (
    <FadedSteps
      concept={sample.concept}
      prompt={sample.prompt}
      stage={stage}
      selfExplain={selfExplain}
      illustration={illustration}
      onContinue={onStart}
      deepDive={deepDive}
    />
  );
}

/**
 * Briefing + Start fallback for levels the adaptive tutor cannot scaffold —
 * i.e. STATIC-pool levels with no parametric generator (e.g. the hand-authored
 * "Hard Interview Problems" / "Lattice Paths" levels). These have no fresh
 * same-family sibling to build a worked example from, so the worked/faded
 * phases have nothing to render; without this the lesson screen was blank and
 * the round was unreachable. It shows the level's own briefing and an explicit
 * Start action so questions are ALWAYS reachable. Token-themed like the rest of
 * the lesson intro.
 */
function StaticLevelIntro({
  level,
  illustration,
  onStart,
}: {
  level: Level;
  illustration?: ReactNode;
  onStart: () => void;
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
        {illustration && <div className="mt-4">{illustration}</div>}
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-secondary">
          {level.lesson.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
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

      <button onClick={onStart} className="btn-primary w-full">
        Start Practice ▸
      </button>
    </div>
  );
}
