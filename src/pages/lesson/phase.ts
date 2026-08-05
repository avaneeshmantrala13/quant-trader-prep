import { selectTutorPhase } from "@/lib/tutor/phase";

export type Phase = "lesson" | "quiz" | "remediation" | "summary";

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
export function initialPhase(theta: number, n: number): Phase {
  return selectTutorPhase({ theta, n, recentFailures: 0 }) === "independent"
    ? "quiz"
    : "lesson";
}
