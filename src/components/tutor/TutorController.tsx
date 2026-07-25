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

  if (phase === "independent" || !sample) return null;

  const steps = deriveWorkedSteps(sample.explanation).map((s) => s.text);
  const answer =
    "choices" in sample
      ? sample.choices[sample.correctIndex]
      : numericAnswerText(sample);

  if (phase === "worked") {
    return (
      <WorkedExample
        concept={sample.concept}
        prompt={sample.prompt}
        steps={steps}
        answer={answer}
        illustration={illustration}
        onContinue={onStart}
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
    />
  );
}
