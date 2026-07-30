import type { HintRungReached } from "./creditSchedule";
import { creditForEpisode } from "./creditSchedule";

/**
 * Pure state machine for a free-response HINT EPISODE (PHASE_1 re-attempt flow).
 *
 * The flow (CONFIRMED DECISION §2): on a wrong answer we do NOT reveal — we
 * disclose the 5-rung ladder ONE rung at a time and let the learner RE-ATTEMPT
 * the SAME instance after each rung. We track the HIGHEST rung reached before a
 * correct answer; if still wrong after all 5 rungs it is fully wrong (credit 0).
 * A correct answer after the full solution (rung 5) is worth almost nothing.
 *
 * This module owns ONLY the episode bookkeeping + the resolved credit; the React
 * player holds an `HintEpisode` in state and calls these transitions. It is
 * deterministic and UI-free so it is unit-testable in isolation. The credit it
 * resolves is fed to `recordItemAttempt({ credit, highestRung, correct })`.
 */

export const MAX_RUNG = 5 as const;

export interface HintEpisode {
  /** How many wrong submissions have been made so far. */
  wrongAttempts: number;
  /**
   * Rungs currently REVEALED to the learner (0 = none yet). After the first
   * wrong answer rung 1 is shown; each subsequent wrong answer reveals the next.
   */
  revealed: HintRungReached;
  /** The highest rung the learner reached across the whole episode (for credit). */
  highestRung: HintRungReached;
  /** Terminal state: resolved once they answer correctly OR exhaust all rungs. */
  status: "active" | "correct" | "exhausted";
}

/** A fresh episode (before the first submission). */
export function startEpisode(): HintEpisode {
  return { wrongAttempts: 0, revealed: 0, highestRung: 0, status: "active" };
}

/**
 * Apply ONE submission to the episode.
 *  - correct: episode resolves "correct" at the current `highestRung`.
 *  - wrong (rungs remain): reveal the next rung and stay active.
 *  - wrong (rung 5 already shown): episode resolves "exhausted" (credit 0).
 *
 * Idempotent once terminal: a submission on a resolved episode returns it as-is.
 */
export function submitAttempt(ep: HintEpisode, correct: boolean): HintEpisode {
  if (ep.status !== "active") return ep;
  if (correct) {
    return { ...ep, status: "correct" };
  }
  const wrongAttempts = ep.wrongAttempts + 1;
  // Reveal the next rung (cap at MAX_RUNG). `revealed` becomes the highest rung
  // the learner has now SEEN, which is also the rung they'll re-attempt from.
  const revealed = Math.min(ep.revealed + 1, MAX_RUNG) as HintRungReached;
  const highestRung = Math.max(ep.highestRung, revealed) as HintRungReached;
  // Exhausted only when they were ALREADY at rung 5 and got it wrong again.
  const status = ep.revealed >= MAX_RUNG ? "exhausted" : "active";
  return { wrongAttempts, revealed, highestRung, status };
}

/** True once the episode can be scored (correct or exhausted). */
export function isResolved(ep: HintEpisode): boolean {
  return ep.status !== "active";
}

/**
 * The partial credit ∈ [0,1] for a resolved episode. Active episodes return the
 * credit they WOULD earn if the learner answered correctly right now (useful for
 * previews); prefer calling this only once resolved.
 */
export function episodeCredit(ep: HintEpisode): number {
  return creditForEpisode(ep.status !== "exhausted", ep.highestRung);
}
