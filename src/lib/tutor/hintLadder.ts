import type { NumericQuestion, Question } from "@/types/content";
import { formatNumericAnswer } from "@/lib/numeric";
import type { NaturalFrequencyTree } from "./naturalFrequency";
import { MAX_TRIALS, type MonteCarloSpec } from "./monteCarlo";
import { confrontForTag } from "./misconception";
import { containsFinalAnswer } from "./answerWithholding";
import { simLinkFor } from "./hintTopicHelp";
import { planOfAttack } from "./planOfAttack";
import {
  arithmeticSlipCoaching,
  domainPointerCoaching,
  genericFallbackCoaching,
  inferAnswerDomain,
  isArithmeticSlip,
  isOutOfDomain,
} from "./errorModes";

/**
 * The answer-WITHHOLDING hint ladder (PHASE_2 §5).
 *
 * On a WRONG primary answer, instead of revealing, we build an ordered ladder of
 * five rungs keyed on the tripped misconception, escalating support while
 * WITHHOLDING the final answer until the last rung:
 *   1. name-trap        — name the specific error (never the answer).
 *   2. representation    — a GUIDED PLAN OF ATTACK: leading questions naming
 *                          WHAT to determine at each step (never the method).
 *   3. worked-sibling    — study the same step on a fresh sibling, then redo.
 *   4. elicit-confront   — simulate/enumerate to confront a durable misconception.
 *   5. reveal            — only now, the full worked solution.
 *
 * Research anchors: Shute 2008 & Van der Kleij et al. 2015 (elaborated,
 * answer-withholding feedback d ≈ 0.49 ≫ right/wrong d ≈ 0.05); Gigerenzer &
 * Hoffrage 1995 (natural frequencies); GAISE 2016 / Fischbein & Schnarch 1997
 * (elicit-then-confront via simulation); VanLehn 2011 (step-based tutoring).
 *
 * INVARIANT: rungs 1–4 satisfy `containsFinalAnswer(text, answer) === false`.
 * Rung 1's authored rationale is sanitised to a generic nudge if it would leak
 * the answer; rungs 2–4 are authored generically; only rung 5 reveals.
 */

export interface HintRung {
  rung: 1 | 2 | 3 | 4 | 5;
  kind:
    | "name-trap"
    | "representation"
    | "worked-sibling"
    | "elicit-confront"
    | "reveal";
  /** Never contains the final answer for rungs 1–4 (asserted in tests). */
  text: string;
  /** Optional structured payload the thin view renders. */
  payload?:
    | NaturalFrequencyTree
    | MonteCarloSpec
    | { siblingPrompt: string };
  /**
   * Optional deep link to the single most relevant Simulations-tab sim
   * (independent of `payload`). Set on rung 4 so the view can render a themed
   * "Open <sim> →" button. Never contains the final answer.
   */
  simLink?: { href: string; title: string; blurb: string };
}

/** A stable non-negative seed derived from a string (for reproducible sims). */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2_000_000_000 || 1;
}

function isQuiz(q: Question | NumericQuestion): q is Question {
  return "choices" in q;
}

/** The final answer used only for the withholding guard (never shown pre-reveal). */
function finalAnswerOf(q: Question | NumericQuestion): number | string {
  return isQuiz(q) ? q.choices[q.correctIndex] : q.answer;
}

/**
 * Corrective connectives/markers: a matched `feedback` string's NAMING clause
 * (what the learner did) comes BEFORE any of these; the corrective directive
 * (what to do instead) comes after. Ordered longest-safe first is unnecessary —
 * we cut at the earliest occurrence of any marker.
 */
const CORRECTIVE_MARKERS = [
  " but ",
  " — ",
  " – ",
  "; ",
  " you should",
  " instead",
  " to get",
  " multiply",
  " add (",
  " subtract",
  " divide",
  " use 1",
  "1 − p",
  "1-p",
];

/**
 * Reduce ANY matched rung-1 `feedback` to its NAME-ONLY clause: keep the part
 * that names the mistake, drop a trailing corrective directive (the "but you
 * should multiply", "instead …", "to get …" tail) so rung 1 never reveals the
 * method. Central safety net for families whose inline feedback we don't edit.
 *
 * Cuts at the first corrective marker (case-insensitive). If that leaves too
 * little (empty or < 15 chars — likely we clipped the naming clause itself),
 * falls back to the feedback's first sentence. Never returns empty for non-empty
 * input.
 */
export function nameOnlyCoaching(feedback: string): string {
  if (!feedback) return feedback;
  const lower = feedback.toLowerCase();
  let cut = -1;
  for (const marker of CORRECTIVE_MARKERS) {
    const idx = lower.indexOf(marker);
    if (idx !== -1 && (cut === -1 || idx < cut)) cut = idx;
  }
  let result = (cut === -1 ? feedback : feedback.slice(0, cut)).trim();
  if (result.length < 15) {
    const dot = feedback.indexOf(". ");
    result = (dot === -1 ? feedback : feedback.slice(0, dot + 1)).trim();
  }
  return result || feedback;
}

/**
 * Build the ordered 5-rung ladder for a wrong attempt, keyed on the tripped
 * misconception `misconceptionTag` (resolved by the caller via the Phase-2
 * `misconception` helpers). Always returns exactly 5 rungs in order 1..5.
 */
export function buildHintLadder(args: {
  question: Question | NumericQuestion;
  chosenIndex?: number;
  chosenValue?: number;
  misconceptionTag?: string;
  /** `Level.section` topic, threaded from the caller for topic-aware hints. */
  section?: string;
}): HintRung[] {
  const { question, chosenIndex, chosenValue, misconceptionTag, section } = args;
  const family = question.family;
  const answer = finalAnswerOf(question);
  const confront = confrontForTag(misconceptionTag);

  /* -- Rung 1: name the trap (name-ONLY; never the method or the answer) ----- */
  // Prioritised behaviour (numeric free-response): (1) an out-of-domain value
  // gets a basic sanity-check pointer; (2) a matched misconception is reduced to
  // its NAME-ONLY clause; (3) a close-but-not-exact value gets an arithmetic-slip
  // nudge; (4) otherwise the method-free generic nudge. Quiz items keep the
  // distractor rationale, also passed through `nameOnlyCoaching`.
  let rung1Text = "";
  if (isQuiz(question) && chosenIndex != null) {
    rung1Text = nameOnlyCoaching(question.distractorRationale?.[chosenIndex] ?? "");
  } else if (!isQuiz(question) && chosenValue != null) {
    const matched = question.commonErrors?.find((e) =>
      question.decimals == null
        ? e.value === chosenValue
        : Math.round(e.value * 10 ** question.decimals) ===
          Math.round(chosenValue * 10 ** question.decimals),
    );
    if (typeof answer === "number") {
      const domain = inferAnswerDomain({
        section,
        family,
        unit: question.unit,
        decimals: question.decimals,
        answer,
      });
      if (isOutOfDomain(chosenValue, domain)) {
        rung1Text = domainPointerCoaching(domain);
      } else if (matched) {
        rung1Text = nameOnlyCoaching(matched.feedback);
      } else if (isArithmeticSlip(chosenValue, answer)) {
        rung1Text = arithmeticSlipCoaching();
      } else {
        rung1Text = genericFallbackCoaching({ section, family });
      }
    } else if (matched) {
      rung1Text = nameOnlyCoaching(matched.feedback);
    }
  }
  if (!rung1Text || containsFinalAnswer(rung1Text, answer)) {
    rung1Text = genericFallbackCoaching({ section, family });
  }

  /* -- Rung 2: GUIDED PLAN OF ATTACK (leading questions, never the method) --- */
  // Bridges rung 1 (names the mistake) → rung 3 (worked walkthrough). It names
  // WHAT to determine at each step without stating the operation/rule/answer,
  // and deliberately holds NO visualization (that is rung 4's simulation).
  const rung2: HintRung = {
    rung: 2,
    kind: "representation",
    text: planOfAttack({ section, family, misconceptionTag }),
  };

  /* -- Rung 3: worked sibling (completion) ---------------------------------- */
  const rung3: HintRung = {
    rung: 3,
    kind: "worked-sibling",
    text: "Here's the SAME kind of problem with different numbers, worked one step at a time. Study the step you slipped on, then come back and redo yours.",
    payload: {
      siblingPrompt:
        "A fresh same-family instance is worked below; mirror its critical step on your own item.",
    },
  };

  /* -- Rung 4: elicit-then-confront (open the exact sim) --------------------- */
  // Resolve the single most relevant Simulations-tab sim for this item and
  // point at it by name. The inline coin/dice ConfrontSim payload is retained
  // (so the deterministic confront still renders) — the deep link is additive.
  // When NO sim is a confident match, `simLinkFor` returns null and we fall back
  // to an answer-free generic elicitation rather than misdirecting the learner
  // to an unrelated sim (the old code silently pointed everything at coin-flips).
  const sim = simLinkFor({ section, family, misconceptionTag });
  const rung4Base: HintRung = sim
    ? {
        rung: 4,
        kind: "elicit-confront",
        text: `Open the Simulations tab → “${sim.title}” and ${sim.blurb}`,
        simLink: { href: sim.href, title: sim.title, blurb: sim.blurb },
      }
    : {
        rung: 4,
        kind: "elicit-confront",
        text:
          "Re-create this situation from scratch and let the data settle it: " +
          "enumerate the full set of equally-likely outcomes (or run many quick trials), " +
          "then count how often the event actually happens and compare that empirical frequency against the answer you reported.",
      };
  let rung4: HintRung;
  if (confront === "coin-sim") {
    rung4 = {
      ...rung4Base,
      payload: {
        kind: "coin",
        trials: MAX_TRIALS,
        seed: hashSeed(question.id + ":coin"),
        params: { pHeads: 0.5 },
      },
    };
  } else if (confront === "dice-sim") {
    rung4 = {
      ...rung4Base,
      payload: {
        kind: "dice",
        trials: MAX_TRIALS,
        seed: hashSeed(question.id + ":dice"),
        params: { sides: 6, face: 6 },
      },
    };
  } else {
    // nested-set + generic: the named-sim deep link is the whole confront.
    rung4 = rung4Base;
  }

  /* -- Rung 5: reveal (the only rung allowed to contain the answer) ---------- */
  const rung5: HintRung = {
    rung: 5,
    kind: "reveal",
    text: question.explanation,
  };

  return [
    { rung: 1, kind: "name-trap", text: rung1Text },
    rung2,
    rung3,
    rung4,
    rung5,
  ];
}

/** Convenience for views/tests: the numeric answer string for a numeric item. */
export function numericAnswerText(q: NumericQuestion): string {
  return `${q.unit ?? "$"}${formatNumericAnswer(q)}`;
}
