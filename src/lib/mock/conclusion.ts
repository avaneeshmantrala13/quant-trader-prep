/**
 * mock/conclusion.ts — the ROCK-SOLID, non-jailbreakable committed-conclusion
 * grader shared by every reasoning-graded surface (reasoning follow-ups, the
 * main-question reasoning check, and the clarify round).
 *
 * THE PROBLEM IT FIXES: the old reasoning grader marked an answer CORRECT the
 * moment a correct token/phrase appeared ANYWHERE in the text. That let a
 * "gaming" answer pass — e.g. committing to the WRONG conclusion while quoting a
 * TRUE fact:
 *
 *   Q: "Would P be the same if the two events were mutually exclusive instead of
 *       independent?"  (correct: NO / DIFFERENT — mutually-exclusive ⇒ P=0)
 *   Gaming: "yes, it would because they are mutually exclusive so it would not be
 *            possible for both of the events to occur."
 *
 *   The candidate COMMITS to "yes, same" (wrong) yet states a true fact
 *   ("both can't occur"), which is internally CONTRADICTORY. The true fact used
 *   to trip the keyword and mark it CORRECT. That is the jailbreak.
 *
 * THE FIX: grade on the COMMITTED CONCLUSION, not keyword presence. We extract
 * which side/value the candidate actually committed to and REQUIRE it to match
 * the verified answer AND be free of contradiction / hedging / a committed-wrong
 * side. When the answer is MIXED (a correct part + a wrong/contradictory part),
 * confusingly worded, or we cannot CONFIDENTLY read a correct committed
 * conclusion, we return `"clarify"` instead of silently passing or failing — the
 * caller then forces a single-answer clarifying follow-up.
 *
 * SAFETY DEFAULT: when unsure, prefer CLARIFY over CORRECT. An ambiguous or
 * contradictory answer NEVER passes as CORRECT.
 *
 * PURE: no React, DOM, storage, or network. Same inputs ⇒ same verdict.
 */
import {
  parseNumericValue,
  matchesMechanismSignal,
  isHandWaveOnly,
  isUninterpretable,
  creditableMechanismSignals,
  isExplanationRequiredPrompt,
  isCircularJustification,
} from "./reasoning";
import type { ClarifyKind, ConclusionMode } from "./types";

/** The three-way verdict of the committed-conclusion grader. */
export type ConclusionVerdict = "correct" | "missed" | "clarify";

/**
 * The polarity a yes/no or same/different question EXPECTS for a correct
 * conclusion. `"deny"` = the correct answer is NO / different / not-the-same /
 * it-changes; `"affirm"` = the correct answer is YES / same / unchanged.
 */
export type Polarity = "affirm" | "deny";

/**
 * What a CORRECT committed conclusion looks like, and what a WRONG one looks
 * like, for one reasoning question. Everything is optional so the grader adapts
 * to whatever signals a question can offer.
 */
export interface ConclusionSpec {
  /** Groups of acceptable CORRECT-conclusion words; ≥1 per group is required. */
  correctKeywords?: string[][];
  /** Numeric conclusion value(s) a correct answer must state (within tol). */
  correctValues?: number[];
  /** How `correctKeywords` and `correctValues` combine (default `"all"`). */
  mode?: ConclusionMode;
  /**
   * Groups of phrases that signal COMMITMENT TO A WRONG conclusion (any one
   * present ⇒ a wrong-side signal). Used to catch "correct-fact-but-wrong-
   * conclusion" and contradictions.
   */
  wrongKeywords?: string[][];
  /** Numeric value(s) that indicate a WRONG committed conclusion (decoys). */
  wrongValues?: number[];
  /** Expected polarity for a yes/no or same/different question. */
  expectedPolarity?: Polarity;
  /**
   * Accepted phrasings that PROVE the candidate engaged the MECHANISM (not just
   * the committed side/value). When non-empty, a `correct` verdict additionally
   * REQUIRES ≥1 signal, so a "committed-correct side + true buzzword" (no
   * mechanism) or a pure hand-wave routes to CLARIFY instead of passing.
   */
  mechanismSignals?: string[];
  /** Extra pure hand-waves that can never alone justify this question. */
  bannedAsSoleJustification?: string[];
  /**
   * The question prompt/stem. Used to (a) detect an explanation-required ("why")
   * follow-up and (b) discount mechanism signals that merely ECHO the stem, so a
   * committed value + a parroted stem word ("three terms") no longer passes the
   * mechanism gate. Optional/back-compat: when absent, no echo-discounting runs.
   */
  prompt?: string;
}

/** The grader's result: a verdict plus a human reason and an optional clarify. */
export interface ConclusionResult {
  verdict: ConclusionVerdict;
  /** Short, prep-oriented explanation of WHY (used for feedback). */
  reason: string;
  /** The two sides in tension when `clarify` (for a specific clarify prompt). */
  tension?: { concluded: string; suggests: string };
  /**
   * WHY it routed to `clarify`, so the UI can pick accurate copy (a garbled
   * answer must NOT read "points both ways"). Present only on `clarify`.
   */
  clarifyKind?: ClarifyKind;
}

/* -------------------------------------------------------------------------- */
/*  Value + keyword extraction (shared, previously in followups.ts)            */
/* -------------------------------------------------------------------------- */

/**
 * Common spelled fractions candidates type in prose ("switching wins two-thirds")
 * → their decimal value, so a reasoning answer that words its conclusion still
 * has its numeric target detected. Multi-word so they're unambiguous.
 */
const SPELLED_FRACTIONS: [RegExp, string][] = [
  [/\btwo[-\s]thirds?\b/gi, " 0.6667 "],
  [/\bone[-\s]thirds?\b/gi, " 0.3333 "],
  [/\bthree[-\s](?:quarters?|fourths?)\b/gi, " 0.75 "],
  [/\bone[-\s](?:quarter|fourth)\b/gi, " 0.25 "],
  [/\ba\s+quarter\b/gi, " 0.25 "],
  [/\b(?:one[-\s]half|a\s+half|one\s+half)\b/gi, " 0.5 "],
];

/** Extract candidate numeric values (decimals, fractions, percents) from text. */
export function valuesIn(rawText: string): number[] {
  // Normalize a Unicode minus (U+2212, as printed in prompts) to ASCII "-" and
  // drop currency symbols so a negative like "-$0.50" parses as -0.5 (not +0.5).
  let text = (rawText ?? "").replace(/\u2212/g, "-").replace(/[$£€]/g, "");
  for (const [re, val] of SPELLED_FRACTIONS) text = text.replace(re, val);
  const out: number[] = [];
  const re =
    /[+-]?\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|[+-]?\d+(?:[.,]\d+)?\s*%|[+-]?\d[\d,]*(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = parseNumericValue(m[0].replace(/\s+/g, ""));
    if (v !== null) out.push(v);
  }
  return out;
}

/**
 * Does `lower` (already lower-cased) contain `keyword` as a WHOLE token/phrase,
 * not merely as a substring? This prevents short conclusion words from matching
 * inside unrelated words — e.g. "no" inside "known"/"another", "up" inside
 * "suppose"/"group", "so" inside "also" — which would otherwise let a WRONG
 * answer trip a keyword by accident (a precision leak). Alphanumerics on either
 * side of a match disqualify it; punctuation/whitespace/start/end are fine.
 */
export function keywordHit(lower: string, keyword: string): boolean {
  const k = keyword.toLowerCase().trim();
  if (k === "") return false;
  // Short, purely-alphabetic words ("no", "up", "so", "rate", "mode", "less")
  // must match as a WHOLE word, so they don't fire inside "known", "suppose",
  // "also", "accurate", "model", "unless" — a precision leak that would let a
  // WRONG answer trip a keyword by accident. Longer or non-alphabetic keywords
  // ("double", "variance", "2/3", "1 in") use substring so natural inflections
  // ("double"→"doubles", "reset"→"resets") still count.
  if (/^[a-z]+$/.test(k) && k.length <= 4) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, "i").test(lower);
  }
  return lower.includes(k);
}

/** Whether ANY keyword in the group is present as a whole token/phrase. */
function groupHit(lower: string, group: string[]): boolean {
  return group.some((k) => keywordHit(lower, k));
}

/** Value-match: absolute tol near zero, relative tol otherwise (mirrors old). */
function valueMatches(vals: number[], t: number): boolean {
  return vals.some((v) =>
    Math.abs(t) < 1
      ? Math.abs(v - t) <= 1e-2
      : Math.abs(v - t) <= 1e-2 + Math.abs(t) * 2e-2,
  );
}

/* -------------------------------------------------------------------------- */
/*  Hedging / both-sides / commitment detection                                */
/* -------------------------------------------------------------------------- */

/**
 * STRONG both-sides / hedging phrases that mean the candidate did NOT commit to
 * a single answer. Deliberately targeted (no bare "maybe"/"perhaps") so genuine,
 * committed answers are never flagged. A candidate who lists options and refuses
 * to pick is exactly who a clarifying follow-up is for.
 */
const HEDGE_PATTERNS: RegExp[] = [
  /\beither\s+(?:one|answer|could|would|is\s+fine|works)\b/i,
  /\bcould\s+be\s+(?:either|both|right|wrong|the\s+same|different)\b/i,
  /\bcould\s+go\s+either\s+way\b/i,
  /\bcan\s+go\s+either\s+way\b/i,
  /\bboth\s+(?:answers?|could\s+be|are\s+(?:correct|right|valid)|ways)\b/i,
  /\bnot\s+(?:sure|certain)\b/i,
  /\bi'?m\s+unsure\b/i,
  /\bhard\s+to\s+say\b/i,
  /\bon\s+the\s+one\s+hand\b/i,
  /\bit\s+(?:might|may|could)\s+be\s+(?:either|the\s+same|different|both)\b/i,
  /\bdepending\s+on\s+how\s+you\s+look\b/i,
];

/** True if the text hedges / refuses to commit (spec-aware exclusions). */
function isHedged(text: string, spec: ConclusionSpec): boolean {
  const lower = text.toLowerCase();
  // "depends" is a legitimate CORRECT conclusion for some questions (e.g.
  // "does it depend on the base rate?"). Only treat it as hedging when it is NOT
  // an accepted correct keyword for THIS question.
  const dependsIsCorrect = (spec.correctKeywords ?? []).some((g) =>
    g.some((k) => /\bdepend/i.test(k)),
  );
  if (!dependsIsCorrect && /\b(?:it|that)\s+depends\b/i.test(lower)) {
    // "it depends on X" without further commitment is a hedge; but "it depends
    // on the base rate, which is …" that then names the right driver is fine —
    // require that no correct signal accompanies it (checked by caller). Here we
    // only flag the bare hedge phrasings.
    if (/\bit\s+depends\b\s*[.!?]?\s*$/i.test(lower.trim())) return true;
  }
  return HEDGE_PATTERNS.some((re) => re.test(lower));
}

/** Leading/committed polarity tokens. */
const AFFIRM_LEAD =
  /^\s*(?:yes|yeah|yep|yup|sure|correct|true|indeed|absolutely|definitely)\b/i;
const DENY_LEAD =
  /^\s*(?:no|nope|nah|incorrect|false|not\b)/i;
const AFFIRM_SAME =
  /\b(?:still\s+the\s+same|same\s+(?:probability|value|answer|as\s+before)|unchanged|would\s+be\s+the\s+same|it\s+would|it\s+is\s+still|stays?\s+the\s+same|no\s+change)\b/i;
const DENY_DIFFERENT =
  /\b(?:different|not\s+the\s+same|would\s+change|it\s+changes?|no\s+longer|would\s+differ|it\s+differs)\b/i;

/**
 * Read the candidate's COMMITTED polarity, or `null` if none is clearly stated.
 * We trust a LEADING yes/no first (that is the committed answer), then fall back
 * to strong same/different phrasing.
 */
export function committedPolarity(text: string): Polarity | null {
  const t = text.trim();
  if (AFFIRM_LEAD.test(t)) return "affirm";
  if (DENY_LEAD.test(t)) return "deny";
  // No leading yes/no: infer from strong same/different phrasing (prefer the
  // FIRST such signal in the text as the commitment).
  const affirmIdx = t.search(AFFIRM_SAME);
  const denyIdx = t.search(DENY_DIFFERENT);
  if (affirmIdx === -1 && denyIdx === -1) return null;
  if (affirmIdx === -1) return "deny";
  if (denyIdx === -1) return "affirm";
  return affirmIdx < denyIdx ? "affirm" : "deny";
}

/* -------------------------------------------------------------------------- */
/*  The grader                                                                 */
/* -------------------------------------------------------------------------- */

/** Word count of trimmed text. */
function words(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).filter(Boolean).length;
}

/**
 * Grade a written conclusion against a spec, returning a three-way verdict.
 *
 *  • `strict: true` (the CLARIFY round) collapses any would-be `"clarify"` to
 *    `"missed"` — there is no second clarify; unresolved ⇒ missed.
 *
 * Decision order (conservative — never passes an ambiguous/contradictory answer).
 * STRICT GATE: clarify (a second chance) fires ONLY when genuine CORRECT content
 * is present and just a small part is wrong/ambiguous; otherwise commit to WRONG.
 *   1. empty / non-substantive        → missed
 *   2. hedged WITH correct footing    → clarify (strict → missed);
 *      hedged with NO correct content → missed (no second chance)
 *   3. correct-signal AND wrong-signal (mixed/contradiction) → clarify (→ missed)
 *   4. wrong-signal only              → missed (committed to the wrong side)
 *   5. correct-signal satisfied       → correct (mechanism-gated → clarify)
 *   6. verifiable but unsatisfied / garbled → missed (nothing correct to confirm)
 *   7. nothing to verify + substantive→ correct (substantive-answer gate)
 */
export function gradeConclusion(
  raw: string,
  spec: ConclusionSpec,
  opts: { strict?: boolean } = {},
): ConclusionResult {
  const strict = opts.strict === true;
  const clarifyOr = (
    reason: string,
    kind: ClarifyKind,
    tension?: { concluded: string; suggests: string },
  ): ConclusionResult =>
    strict
      ? { verdict: "missed", reason }
      : { verdict: "clarify", reason, clarifyKind: kind, ...(tension ? { tension } : {}) };

  const text = (raw ?? "").trim();
  const lower = text.toLowerCase();
  const vals = valuesIn(text);

  const correctKeywords = spec.correctKeywords ?? [];
  const correctValues = spec.correctValues ?? [];
  const wrongKeywords = spec.wrongKeywords ?? [];
  const wrongValues = spec.wrongValues ?? [];
  const mode = spec.mode ?? "all";
  const mechanismSignals = spec.mechanismSignals ?? [];
  const requiresMechanism = mechanismSignals.length > 0;
  const explanationRequired = isExplanationRequiredPrompt(spec.prompt);
  // For an explanation-required ("why") prompt, discount mechanism signals that
  // merely ECHO the question stem ("three terms") — a parroted stem word proves
  // no understanding. What remains are signals that name the actual reason.
  const creditableSignals = creditableMechanismSignals(mechanismSignals, spec.prompt);
  const hasMechanism =
    requiresMechanism &&
    matchesMechanismSignal(text, creditableSignals) &&
    // A circular / vacuous "reason" ("…because that is enough") never counts as
    // naming the mechanism on a why-prompt, even if a stray keyword matched.
    !(explanationRequired && isCircularJustification(text));
  const handWaveOnly = isHandWaveOnly(text, spec.bannedAsSoleJustification ?? []);

  // --- 1) empty → missed --------------------------------------------------
  const hasSpec =
    correctKeywords.length > 0 ||
    correctValues.length > 0 ||
    wrongKeywords.length > 0 ||
    spec.expectedPolarity !== undefined;
  if (text === "") {
    return { verdict: "missed", reason: "No committed answer was given." };
  }

  // --- correct-signal --------------------------------------------------------
  const numericOk: boolean | null =
    correctValues.length === 0 ? null : correctValues.every((t) => valueMatches(vals, t));
  const keywordsOk: boolean | null =
    correctKeywords.length === 0 ? null : correctKeywords.every((g) => groupHit(lower, g));

  let correctSignal: boolean | null;
  if (numericOk === null && keywordsOk === null) {
    correctSignal = null; // nothing to verify against
  } else if (mode === "any" && numericOk !== null && keywordsOk !== null) {
    correctSignal = numericOk || keywordsOk;
  } else {
    correctSignal = (numericOk ?? true) && (keywordsOk ?? true);
  }

  // --- wrong-signal ----------------------------------------------------------
  const wrongKwHit = wrongKeywords.some((g) => groupHit(lower, g));
  const wrongValHit = wrongValues.some((t) => valueMatches(vals, t));
  let polarityWrong = false;
  let polarityRight = false;
  if (spec.expectedPolarity) {
    const committed = committedPolarity(text);
    if (committed !== null) {
      if (committed === spec.expectedPolarity) polarityRight = true;
      else polarityWrong = true;
    }
  }
  const wrongSignal = wrongKwHit || wrongValHit || polarityWrong;

  // Genuine CORRECT, load-bearing content present? This is the STRICT-GATE key:
  // the confirm/clarify (second-chance) path may fire ONLY when the candidate
  // has real correct content and just a small part is wrong/ambiguous. With no
  // correct footing we commit to a WRONG verdict — no "couldn't confirm" retry.
  const correctPresent = correctSignal === true || polarityRight;

  // Human-readable side names for a specific clarify prompt.
  const correctSide =
    (correctKeywords[0]?.[0] ??
      (correctValues.length ? String(correctValues[0]) : undefined) ??
      (spec.expectedPolarity === "deny" ? "no / it changes" : "yes")) as string;
  const wrongSide =
    (wrongKeywords[0]?.[0] ??
      (spec.expectedPolarity === "deny" ? "yes / it's the same" : "no")) as string;

  // --- 2) hedged / both-sides → clarify ONLY with correct footing ---------
  // STRICT GATE: a hedge earns a second chance ONLY when genuine correct content
  // is also present (mostly-right, just non-committal). A footingless hedge
  // ("could be either / not sure" with nothing correct) is graded WRONG directly.
  if (isHedged(text, spec)) {
    if (correctPresent) {
      return clarifyOr(
        "Hedged / both-sides: no single committed answer.",
        "hedge",
        { concluded: "both/either", suggests: correctSide },
      );
    }
    return {
      verdict: "missed",
      reason: "Hedged with no correct, committed content to build on.",
    };
  }

  // --- 3) correct AND wrong signal → contradiction / mixed → clarify -------
  if (correctPresent && wrongSignal) {
    return clarifyOr(
      "Mixed: a correct part and a contradictory wrong-side commitment.",
      "contradiction",
      { concluded: wrongSide, suggests: correctSide },
    );
  }

  // --- 4) wrong-signal only → missed (committed to the wrong side) ---------
  if (wrongSignal && correctSignal !== true) {
    return {
      verdict: "missed",
      reason: "Committed to the wrong conclusion.",
    };
  }

  // --- 4.5) correct SIDE committed, required VALUE simply ABSENT → clarify --
  // STRICT-GATE nuance for a genuinely TWO-SIDED question (a wrong side is
  // defined via `wrongKeywords`/`expectedPolarity`): the candidate committed to
  // the RIGHT side but omitted a required numeric value AND stated NO number at
  // all (not a wrong one, and no wrong-side signal). That is a mostly-right
  // answer missing ONE piece — ask for the value (confirm/clarify); never grade
  // the correct load-bearing side as WRONG. A WRONG stated value (or a wrong
  // side) still routes to `missed` via the checks above. In the strict clarify
  // round this collapses to `missed` (there is no second confirm).
  const isTwoSided =
    wrongKeywords.length > 0 || spec.expectedPolarity !== undefined;
  const sideCommittedRight = keywordsOk === true || polarityRight;
  if (
    isTwoSided &&
    sideCommittedRight &&
    correctSignal !== true &&
    correctValues.length > 0 &&
    numericOk === false &&
    vals.length === 0 &&
    !wrongSignal
  ) {
    return clarifyOr(
      "Committed to the right side but did not state the required value.",
      "unconfirmed",
      { concluded: "side only", suggests: correctSide },
    );
  }

  // --- 5) correct-signal satisfied → correct (mechanism-gated) ------------
  if (correctSignal === true) {
    // A per-question MECHANISM requirement: committing to the right side/value
    // is necessary but NOT sufficient — a "yes/no + true buzzword" with no
    // mechanism, or a pure hand-wave, must not pass. Route to CLARIFY so the
    // candidate gets exactly one chance to state the justification.
    if (requiresMechanism && !hasMechanism) {
      return clarifyOr(
        "Committed to the right side but did not state the mechanism/justification.",
        "unconfirmed",
        { concluded: "answer only", suggests: correctSide },
      );
    }
    return { verdict: "correct", reason: "Committed to the correct conclusion." };
  }

  // --- 6) verifiable but unsatisfied → graded WRONG (STRICT GATE) ---------
  // No correct, committed conclusion was found. There is NOTHING correct to
  // confirm, so we do NOT offer a "couldn't confirm — commit below" retry: we
  // commit to a WRONG verdict directly. Garbled/uninterpretable input is graded
  // wrong the same way, with an accurate not-understood reason.
  if (correctSignal === false || (hasSpec && !correctPresent)) {
    return {
      verdict: "missed",
      reason: isUninterpretable(text)
        ? "Response not understood — no committed claim about the problem to build on."
        : "No correct, committed conclusion — nothing correct to confirm.",
    };
  }

  // --- 7) nothing to verify + substantive → correct -----------------------
  // A PURE hand-wave ("the math checks out / it's obvious / trust me") is never
  // a substantive answer, even without an authored spec (the universal guard).
  const substantive =
    text !== "" &&
    !handWaveOnly &&
    // On a why-prompt, a purely CIRCULAR "reason" is not a substantive answer,
    // even when it clears the word-count floor.
    !(explanationRequired && isCircularJustification(text)) &&
    (vals.length > 0 || words(text) >= 6);
  if (substantive && requiresMechanism && !hasMechanism) {
    return clarifyOr(
      "Substantive but did not state the required mechanism/justification.",
      "unconfirmed",
      { concluded: "answer only", suggests: correctSide },
    );
  }
  return substantive
    ? { verdict: "correct", reason: "Substantive committed answer." }
    : { verdict: "missed", reason: "Not a substantive answer." };
}

/**
 * Build a specific, commitment-forcing clarify prompt from a grader result. When
 * the two sides in tension are known it NAMES them; otherwise it uses a generic
 * but still commitment-forcing ask.
 */
export function buildClarifyPrompt(result: ConclusionResult): string {
  const t = result.tension;
  if (result.clarifyKind === "uninterpretable") {
    return (
      `I couldn't understand your response — it didn't read as a claim about the ` +
      `problem. State your ONE final answer in plain words and the single reason ` +
      `it's correct.`
    );
  }
  if (t && t.concluded === "side only") {
    return (
      `You've got the right side ("${t.suggests}") — now give the actual VALUE ` +
      `to lock it in (state the number, e.g. each probability).`
    );
  }
  if (t && t.concluded === "both/either") {
    return (
      `Your explanation points both ways instead of committing. Pick ONE answer — ` +
      `is it "${t.suggests}" or not — and give the single reason it's correct.`
    );
  }
  if (t && t.concluded !== "unclear") {
    return (
      `Your explanation points both ways: you concluded "${t.concluded}", but your ` +
      `reasoning points to "${t.suggests}". Commit to ONE answer and give the single ` +
      `reason it's correct.`
    );
  }
  if (t) {
    return (
      `I can't tell what you actually concluded. State your ONE final answer and the ` +
      `single reason it's correct (the key value and what it means).`
    );
  }
  return (
    `Commit to ONE final answer and give the single reason it's correct — ` +
    `no both-sides, no contradictions.`
  );
}
