/**
 * mock/followups.ts — deterministic ASK-AND-GRADE follow-ups.
 *
 * Follow-ups are CONCEPT-SPECIFIC: each scored (non-mental-math) question in
 * `questionPools.ts` authors its own `probe` + `adversarial` `FollowupSeed`s
 * from its OWN setup, and this module turns those seeds into presentable,
 * deterministically-graded follow-ups. There is no longer any "arithmetic on the
 * previous answer" (square it, 3⁄8 of it, reprice ±%): the probe deepens the same
 * PRINCIPLE and the adversarial challenges the underlying LOGIC.
 *
 *  • `buildFollowupPresentations(followups, targetMs)` converts a question's two
 *    authored seeds into the `{probe, adversarial}` presentations the engine
 *    stores on a `MathStep` (the always-on backbone; used when AI is off). Same
 *    seeds ⇒ same follow-ups.
 *  • `gradeFollowup(presentation, raw, elapsedMs)` grades the candidate's answer:
 *      – numeric   → exact numeric grading via `scoreMathAnswer`;
 *      – reasoning → conclusion-reached grading (`gradeReasoningConclusion`);
 *      – AI note   → deterministic numeric-token match against `referenceNote`.
 *    The LLM may author a note, but the correctness DECISION is 100% client-side,
 *    so the model can never decide correctness (contract invariant).
 *
 * PURE: no React, DOM, storage, or network.
 */
import type {
  FollowupPresentation,
  FollowupRole,
  FollowupSeed,
  MathScore,
  QuestionFollowups,
  TimingBand,
} from "./types";
import { scoreMathAnswer, normalizeSpokenNumber } from "./scoring";
import { parseNumericValue } from "./reasoning";
import {
  gradeConclusion,
  buildClarifyPrompt,
  valuesIn,
  type ConclusionSpec,
} from "./conclusion";

// Re-exported for back-compat: callers/tests import `keywordHit` from here.
export { keywordHit } from "./conclusion";

/** Round to a given number of decimals (default 2). */
function roundTo(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

const PROBE_ROLE_META: Record<FollowupRole, string> = {
  probe: "Follow-up 1 of 2 · Probe",
  adversarial: "Follow-up 2 of 2 · Adversarial",
};

/** Build one presentation from an authored concept follow-up seed. */
function presentationFromSeed(
  seed: FollowupSeed,
  role: FollowupRole,
  targetMs: number,
): FollowupPresentation {
  const decimals = seed.decimals ?? 2;
  const base = {
    prompt: seed.prompt,
    source: "authored" as const,
    role,
    label: PROBE_ROLE_META[role],
    // Carry the taxonomy type + difficulty so the acceptance gate can audit the
    // presentation directly (no decomposition; follow-up ≥ base difficulty).
    ...(seed.type ? { type: seed.type } : {}),
    ...(seed.difficulty ? { difficulty: seed.difficulty } : {}),
    // Carry the learn-from-it model answer/reasoning so the UI can reveal the
    // canonical answer + demo reasoning whenever this follow-up is not fully
    // correct (the candidate misses it or caves under pressure).
    ...(seed.modelAnswer ? { modelAnswer: seed.modelAnswer } : {}),
    ...(seed.modelReasoning ? { modelReasoning: seed.modelReasoning } : {}),
    targetMs,
  };
  if (seed.answerKind === "reasoning") {
    return {
      ...base,
      answerKind: "reasoning",
      ...(seed.conclusionTargets ? { conclusionTargets: seed.conclusionTargets } : {}),
      ...(seed.conclusionKeywords ? { conclusionKeywords: seed.conclusionKeywords } : {}),
      ...(seed.conclusionMode ? { conclusionMode: seed.conclusionMode } : {}),
      ...(seed.wrongKeywords ? { wrongKeywords: seed.wrongKeywords } : {}),
      ...(seed.wrongValues ? { wrongValues: seed.wrongValues } : {}),
      ...(seed.expectedPolarity ? { expectedPolarity: seed.expectedPolarity } : {}),
      ...(seed.mechanismSignals ? { mechanismSignals: seed.mechanismSignals } : {}),
      ...(seed.bannedAsSoleJustification
        ? { bannedAsSoleJustification: seed.bannedAsSoleJustification }
        : {}),
    };
  }
  return {
    ...base,
    answerKind: "numeric",
    answer: seed.answer !== undefined ? roundTo(seed.answer, decimals) : undefined,
    decimals,
    ...(seed.commonErrors ? { commonErrors: seed.commonErrors } : {}),
  };
}

/**
 * Build BOTH concept-specific authored follow-ups for a scored question from the
 * seeds it authored in `questionPools.ts`: a probe (Follow-up 1) that deepens the
 * SAME principle and an adversarial (Follow-up 2) that challenges the underlying
 * logic. The probe gets a tighter clock than the main question; the adversarial a
 * near-full one. Deterministic — identical seeds ⇒ identical pair.
 */
export function buildFollowupPresentations(
  followups: QuestionFollowups,
  targetMs: number,
): { probe: FollowupPresentation; adversarial: FollowupPresentation } {
  return {
    probe: presentationFromSeed(
      followups.probe,
      "probe",
      Math.round(targetMs * 0.8),
    ),
    adversarial: presentationFromSeed(
      followups.adversarial,
      "adversarial",
      Math.round(targetMs * 0.9),
    ),
  };
}

/** An open/reasoning ask (multi-part, "why/how/consistent/adjust", etc.). */
const OPEN_QUESTION_RE =
  /\b(why|how would|how much|explain|describe|justify|consist|adjust|reason|argue|defend|walk me|are the|is it|internally|would you)\b/i;
/** A crisp single-number ask ("what is …", "compute …", "how many …"). */
const NUMERIC_QUESTION_RE =
  /\b(what is|what's|what are|compute|calculate|how many|value of|the sum|the product|expected value|probability that)\b/i;

/**
 * Build the AI follow-up presentation from a `mock-followup` payload. Falls back
 * to `authored` when the payload has no usable `question`.
 *
 * Crucially, this CLASSIFIES the follow-up so it is graded BY ITS TYPE:
 *   • a crisp single-number ask with a clean conclusion in the note → `numeric`
 *     (graded against the note's target), OR
 *   • an OPEN/reasoning ask (multi-part, "are the odds consistent…?") →
 *     `reasoning` (graded on reaching the correct conclusion, so a correct
 *     written argument is NEVER marked "missed" by single-number extraction).
 */
export function buildAiFollowup(
  authored: FollowupPresentation,
  payload: Record<string, unknown> | null,
): FollowupPresentation {
  const question =
    payload && typeof payload["question"] === "string"
      ? (payload["question"] as string).trim()
      : "";
  if (question === "") return authored; // contract default → no follow-up text
  const note =
    payload && typeof payload["idealAnswerNote"] === "string"
      ? (payload["idealAnswerNote"] as string)
      : "";

  const target = extractTargetAnswer(note);
  const questionMarks = (question.match(/\?/g) ?? []).length;
  const looksOpen = OPEN_QUESTION_RE.test(question) || questionMarks > 1;
  const looksNumeric = NUMERIC_QUESTION_RE.test(question);

  // Numeric ONLY when it's an unambiguous single-number ask AND the note carries
  // a clean, extractable target. Everything else is reasoning-graded.
  if (!looksOpen && looksNumeric && target !== null) {
    return {
      prompt: question,
      source: "ai",
      role: authored.role,
      label: authored.label,
      answerKind: "numeric",
      referenceNote: note,
      targetMs: authored.targetMs,
    };
  }
  // An "equal or different?" comparison is two-sided: read the committed side
  // from the note so the grader can accept the right side, ask for a missing
  // value (clarify), and reject a committed wrong side — instead of a blanket
  // single-number match that false-MISSES a correct written argument.
  const cmp = comparisonSpecFromNote(question, note);
  const noteTrimmed = (note ?? "").trim();
  return {
    prompt: question,
    source: "ai",
    role: authored.role,
    label: authored.label,
    answerKind: "reasoning",
    // Use the note's concluded value as the required conclusion when present;
    // otherwise the reasoning grader credits any substantive correct argument.
    ...(target !== null ? { conclusionTargets: [target] } : {}),
    ...(cmp ? { conclusionKeywords: cmp.correctKeywords, wrongKeywords: cmp.wrongKeywords } : {}),
    referenceNote: note,
    // Carry the interviewer note as the MODEL reasoning so the "See model
    // explanation" reveal has real content on a reasoning follow-up (matching
    // the base-question behavior); a comparison also gets a crisp stance.
    ...(noteTrimmed !== "" ? { modelReasoning: noteTrimmed } : {}),
    ...(cmp ? { modelAnswer: cmp.modelAnswer } : {}),
    targetMs: authored.targetMs,
  };
}

/** Correct-side / wrong-side keyword banks for an "equal or different?" ask. */
const EQUAL_SIDE_WORDS = ["equal", "same", "identical", "the same", "no different"];
const DIFFERENT_SIDE_WORDS = ["different", "not the same", "not equal", "differ"];

/**
 * A reasoning follow-up that asks "EQUAL or DIFFERENT?" (compare two quantities)
 * is genuinely TWO-SIDED: the correct committed side is read from the interviewer
 * note (the client owns this decision; the model only authored the note). Setting
 * `conclusionKeywords`/`wrongKeywords` lets the committed-conclusion grader (a)
 * accept "equal, and each is 2/9", (b) route "equal by memorylessness" (right
 * side, value omitted) to a value-asking CLARIFY instead of a false MISSED, and
 * (c) grade a committed WRONG side ("different, 8/81 vs 12/81") as missed. Returns
 * `null` when the follow-up isn't a comparison or the note doesn't commit a side.
 */
function comparisonSpecFromNote(
  question: string,
  note: string,
): { correctKeywords: string[][]; wrongKeywords: string[][]; modelAnswer: string } | null {
  const q = question.toLowerCase();
  const isComparison =
    /\b(equal or different|different or (the )?same|same or different|equal or not)\b/.test(
      q,
    ) || (/\bequal\b/.test(q) && /\bdifferent\b/.test(q));
  if (!isComparison) return null;
  const n = (note ?? "").toLowerCase();
  const notDifferent = /\bno(?:t)? different\b/.test(n);
  const saysEqual = /\bequal\b|\bthe same\b|\bidentical\b/.test(n) || notDifferent;
  const saysDifferent =
    (/\bdifferent\b|\bnot the same\b|\bnot equal\b|\bdiffer\b/.test(n)) && !notDifferent;
  if (saysEqual && !saysDifferent) {
    return {
      correctKeywords: [EQUAL_SIDE_WORDS],
      wrongKeywords: [DIFFERENT_SIDE_WORDS],
      modelAnswer: "Equal — the two conditional probabilities are the same.",
    };
  }
  if (saysDifferent && !saysEqual) {
    return {
      correctKeywords: [DIFFERENT_SIDE_WORDS],
      wrongKeywords: [EQUAL_SIDE_WORDS],
      modelAnswer: "Different — the two conditional probabilities are not the same.",
    };
  }
  return null;
}

/** A single value expression (fraction / percentage / decimal) within a note. */
const NOTE_VALUE_RE =
  /[+-]?\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|[+-]?\d+(?:[.,]\d+)?\s*%|[+-]?\d[\d,]*(?:\.\d+)?/g;

/**
 * Extract the SPECIFIC intended answer from an interviewer note. The note is a
 * worked note whose FINAL computed value (after the last `=` / `→`) is the
 * target — e.g. `"… = (1/8)/(1/2) = 1/4. Watch …"` → 0.25, NOT the decoys 1/8,
 * 1/2. Fractions/percentages/decimals are all parsed to a number. When no
 * reliable target can be identified (no result delimiter AND more than one
 * distinct numeric value), returns `null` so the follow-up is left UNGRADABLE
 * rather than guessed.
 */
export function extractTargetAnswer(note: string): number | null {
  if (note == null) return null;
  const marker = Math.max(note.lastIndexOf("="), note.lastIndexOf("→"));
  if (marker >= 0) {
    const m = note.slice(marker + 1).match(NOTE_VALUE_RE);
    if (m && m.length > 0) {
      const v = parseNumericValue(m[0].replace(/\s+/g, ""));
      if (v !== null) return v;
    }
  }
  // No result delimiter: only trust a note with a single, unambiguous value.
  const all = (note.match(NOTE_VALUE_RE) ?? [])
    .map((tok) => parseNumericValue(tok.replace(/\s+/g, "")))
    .filter((n): n is number => n !== null);
  if (all.length === 0) return null;
  const distinct = new Set(all.map((n) => Math.round(n * 1e6)));
  return distinct.size === 1 ? all[0] : null;
}

/**
 * DETERMINISTIC grade of an AI follow-up answer against its reference note. The
 * client owns this decision — the LLM merely authored the note. The candidate is
 * graded ONLY against the SPECIFIC target answer parsed from the note (fractions
 * like `1/4` → 0.25, percentages, decimals), NOT any digit that happens to
 * appear in it — so decoys in the derivation can't score correct and the true
 * decimal answer isn't rejected. When the target can't be reliably extracted the
 * follow-up is ungradable → returns `null` (excluded from the tally, never a
 * crash, and never counted against the candidate).
 */
export function gradeAgainstReference(
  referenceNote: string,
  raw: string,
  elapsedMs: number,
  targetMs: number,
): MathScore | null {
  const target = extractTargetAnswer(referenceNote);
  if (target === null) return null;

  const normalized = normalizeSpokenNumber(raw);
  const parsed = parseNumericValue(normalized);
  const parsedOk = parsed !== null;
  const correct =
    parsedOk && Math.abs(parsed - target) <= 1e-3 + Math.abs(target) * 1e-6;

  const t = Math.max(0, elapsedMs);
  return {
    parsed: parsedOk ? parsed : null,
    correct,
    elapsedMs: t,
    targetMs,
    timing: t <= targetMs ? "fast" : t <= targetMs * 2 ? "ok" : "slow",
    score: correct ? 1 : 0,
  };
}

/** Timing band from elapsed vs target (fast ≤ target, ok ≤ 2×, else slow). */
function timingBand(elapsedMs: number, targetMs: number): TimingBand {
  const t = Math.max(0, elapsedMs);
  return t <= targetMs ? "fast" : t <= targetMs * 2 ? "ok" : "slow";
}

/** First candidate numeric value in text (fraction/percent/decimal), or null. */
function firstValueIn(text: string): number | null {
  const vals = valuesIn(text);
  return vals.length > 0 ? vals[0] : null;
}

/**
 * Translate a reasoning FollowupPresentation into the committed-conclusion
 * grader's spec. The presentation's `conclusionKeywords`/`conclusionTargets`
 * describe the CORRECT conclusion; `wrongKeywords`/`wrongValues`/
 * `expectedPolarity` (when authored) describe the WRONG side so the grader can
 * catch "correct-fact-but-wrong-conclusion" and contradictions.
 */
export function specFromPresentation(p: FollowupPresentation): ConclusionSpec {
  return {
    // Carry the prompt so the grader can detect an explanation-required ("why")
    // follow-up and discount mechanism signals that merely echo the stem.
    ...(p.prompt ? { prompt: p.prompt } : {}),
    ...(p.conclusionKeywords ? { correctKeywords: p.conclusionKeywords } : {}),
    ...(p.conclusionTargets ? { correctValues: p.conclusionTargets } : {}),
    ...(p.conclusionMode ? { mode: p.conclusionMode } : {}),
    ...(p.wrongKeywords ? { wrongKeywords: p.wrongKeywords } : {}),
    ...(p.wrongValues ? { wrongValues: p.wrongValues } : {}),
    ...(p.expectedPolarity ? { expectedPolarity: p.expectedPolarity } : {}),
    ...(p.mechanismSignals ? { mechanismSignals: p.mechanismSignals } : {}),
    ...(p.bannedAsSoleJustification
      ? { bannedAsSoleJustification: p.bannedAsSoleJustification }
      : {}),
  };
}

/**
 * ROCK-SOLID grade of an OPEN / REASONING follow-up. Grades on the COMMITTED
 * CONCLUSION (not keyword presence), so a "gaming" answer that commits to the
 * wrong side while quoting a true fact CANNOT pass. The three-way verdict is
 * carried on `MathScore.verdict`:
 *   • `correct` — committed to the verified conclusion, no contradiction/hedge;
 *   • `missed`  — committed to the wrong side (or wrong/empty);
 *   • `clarify` — MIXED / contradictory / hedged / can't-confirm → the caller
 *                 must ask ONE clarifying follow-up. `correct` stays `false`.
 *
 * When there is nothing to verify against (no targets, no keywords — e.g. a pure
 * AI open prompt), it falls back to a substantive-answer gate so a genuine
 * argument still earns credit and an empty/garbage one does not.
 *
 * `opts.strict` (the CLARIFY round) collapses any `clarify` to `missed` — there
 * is exactly ONE clarify; unresolved ⇒ missed.
 */
export function gradeReasoningConclusion(
  p: FollowupPresentation,
  raw: string,
  elapsedMs: number,
  opts: { strict?: boolean } = {},
): MathScore {
  const result = gradeConclusion(raw, specFromPresentation(p), opts);
  const correct = result.verdict === "correct";
  return {
    parsed: firstValueIn(raw),
    correct,
    elapsedMs: Math.max(0, elapsedMs),
    targetMs: p.targetMs,
    timing: timingBand(elapsedMs, p.targetMs),
    score: correct ? 1 : 0,
    verdict: result.verdict,
    ...(result.verdict === "clarify"
      ? {
          clarifyPrompt: buildClarifyPrompt(result),
          ...(result.clarifyKind ? { clarifyKind: result.clarifyKind } : {}),
        }
      : {}),
  };
}

/**
 * STRICTLY grade the CLARIFICATION of a reasoning follow-up against the SAME
 * spec. There is no second clarify: a still-hedged / contradictory / wrong
 * clarification is `missed`; only a clean committed-correct answer is `correct`.
 */
export function gradeClarification(
  p: FollowupPresentation,
  raw: string,
  elapsedMs: number,
): MathScore {
  return gradeReasoningConclusion(p, raw, elapsedMs, { strict: true });
}

/**
 * STRICTLY grade the CLARIFICATION of a MAIN question's ambiguous reasoning. The
 * candidate must now commit to the verified answer with a clean, non-hedged,
 * non-contradictory reason. When the verified answer parses to a number we
 * require that committed value; otherwise a substantive committed answer with no
 * hedging suffices. There is no second clarify — unresolved ⇒ `missed`.
 */
export function gradeMainClarification(
  correctAnswer: string,
  raw: string,
  elapsedMs: number,
  targetMs: number,
): MathScore {
  const verified = parseNumericValue(correctAnswer);
  const spec: ConclusionSpec =
    verified !== null ? { correctValues: [verified] } : {};
  const result = gradeConclusion(raw, spec, { strict: true });
  const correct = result.verdict === "correct";
  return {
    parsed: firstValueIn(raw),
    correct,
    elapsedMs: Math.max(0, elapsedMs),
    targetMs,
    timing: timingBand(elapsedMs, targetMs),
    score: correct ? 1 : 0,
    verdict: result.verdict,
  };
}

/**
 * Grade a follow-up answer BY ITS TYPE:
 *   • `reasoning` → conclusion-reached grading (open text; credit on correct
 *     conclusion, never a false "missed");
 *   • `numeric` authored → exact numeric grading via `scoreMathAnswer`;
 *   • AI numeric (note-backed) → deterministic grade against the reference note.
 * Returns `null` only when a numeric follow-up is structurally ungradable (an AI
 * note with no numeric anchor) — the caller excludes it from the tally.
 */
export function gradeFollowup(
  p: FollowupPresentation,
  raw: string,
  elapsedMs: number,
): MathScore | null {
  if (p.answerKind === "reasoning") {
    return gradeReasoningConclusion(p, raw, elapsedMs);
  }
  if (p.answer != null) {
    return scoreMathAnswer(
      {
        answer: p.answer,
        decimals: p.decimals,
        commonErrors: p.commonErrors,
        targetMs: p.targetMs,
      },
      raw,
      elapsedMs,
    );
  }
  if (p.referenceNote != null) {
    return gradeAgainstReference(p.referenceNote, raw, elapsedMs, p.targetMs);
  }
  return null;
}
