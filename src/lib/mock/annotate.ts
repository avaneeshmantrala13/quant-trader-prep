/**
 * mock/annotate.ts — SPAN-LEVEL reasoning annotations for the review UI.
 *
 * Given the candidate's submitted reasoning, this produces a list of character
 * SPANS classified GOOD (green — a correct step / valid mechanism / reaches the
 * verified answer) or FLAWED (red — a demonstrably false stated computation, a
 * self-contradiction, or a hedge), each with a short "why". The UI highlights
 * these spans so a learner SEES exactly which parts of their own words were
 * right and which were wrong.
 *
 * GRANULAR, NOT BLANKET: spans are TIGHT and MINIMAL — only the load-bearing bit
 * is colored (the correct value, the correct equation, the named mechanism; or
 * the specific false step / hedge / root premise), leaving connective filler
 * UNHIGHLIGHTED. A correct answer is never a wall of green, and a wrong one is
 * never a wall of red. Every `why` is CONTENT-REFERENTIAL — it quotes what the
 * candidate actually wrote — never a generic template.
 *
 * DESIGN (mirrors the extract-and-verify philosophy of `claims.ts`):
 *   • The DETERMINISTIC verdict stays AUTHORITATIVE — annotations only DECORATE
 *     the text; they never change the graded `quality` (passed in, or computed
 *     via the tested deterministic grader).
 *   • Every FLAWED/GOOD label is re-derived by DETERMINISTIC arithmetic checks
 *     (`evalArithmetic`, `findFalseArithmetic`, …), so an LLM extractor can only
 *     ever SUPPLY candidate spans/mechanism phrasings — it can never fabricate a
 *     "correct" label. This keeps the LLM part mockable and non-jailbreakable.
 *
 * PURE: no React, DOM, storage, or network. Imports only pure helpers from
 * `./reasoning` (one-directional; `reasoning.ts` never imports this module).
 */
import {
  allValuesIn,
  checkCommittedFormula,
  committedValuesMatchVerifiedSet,
  creditableMechanismSignals,
  evalArithmetic,
  findClosedFormMismatch,
  findFalseArithmetic,
  findFalseResidualClaim,
  findHedgePhrase,
  findPremiseFlaw,
  hasArithmeticContradiction,
  hasNewMechanismContent,
  isCircularJustification,
  isExplanationRequiredPrompt,
  isStemRestatement,
  isUninterpretable,
  parseNumericValue,
  statedResultValues,
  toClauses,
  type TextClause,
} from "./reasoning";

/** GOOD (correct/green) vs FLAWED (incorrect/red). */
export type SpanLabel = "good" | "flawed";

/** One highlighted span of the candidate's submitted reasoning text. */
export interface ReasoningSpan {
  /** Inclusive start / exclusive end char offsets into the ORIGINAL text. */
  start: number;
  end: number;
  /** The exact substring `text.slice(start, end)` (convenience for the UI). */
  excerpt: string;
  label: SpanLabel;
  /** Short, plain-language reason shown on hover / below the highlight. */
  why: string;
}

/**
 * SNAP a span to WORD BOUNDARIES so a highlight never begins or ends in the
 * MIDDLE of an alphanumeric token. This fixes the "span bleeds into the previous
 * word" bug where an LLM-returned start offset landed on the trailing "n" of
 * "than", painting `n 3n^2` instead of just `3n^2`. Pure + total; applied to
 * EVERY accepted span on BOTH the real-LLM review path (`reconcileReviewSpans`)
 * and the deterministic annotator, so all rendered highlights are clean:
 *   • a MID-WORD START (the char before `start` AND the char at `start` are both
 *     alphanumeric) advances past the partial-word prefix and any following
 *     whitespace to the next word boundary;
 *   • a MID-WORD END (the char at `end` AND the char before `end` are both
 *     alphanumeric) retracts past the partial-word suffix and any preceding
 *     whitespace to the previous word boundary;
 *   • leading/trailing whitespace and dangling sentence punctuation / quotes are
 *     trimmed so only the meaningful token(s) remain (e.g. only `3n^2`).
 * A span that is already clean is returned UNCHANGED. If snapping would collapse
 * the span to empty (e.g. the whole span is a strict prefix of a longer word),
 * the original clamped-and-trimmed range is kept so a legitimate highlight is
 * never destroyed. `excerpt` is recomputed to match the normalized offsets.
 */
export function snapSpanToWordBoundaries(
  text: string,
  span: ReasoningSpan,
): ReasoningSpan {
  const n = text.length;
  const isAlnum = (i: number) => i >= 0 && i < n && /[A-Za-z0-9]/.test(text[i]);
  const isSpace = (i: number) => i >= 0 && i < n && /\s/.test(text[i]);
  // Dangling punctuation to trim off the EDGES only — sentence punctuation and
  // quotes. Deliberately EXCLUDES brackets/operators (e.g. the "(" in "(n+1)^2"
  // and the "^" in "3n^2" are meaningful and must be preserved).
  const isDangling = (i: number) =>
    i >= 0 && i < n && /[.,;:!?\u2013\u2014"'\u201c\u201d\u2018\u2019]/.test(text[i]);

  const clamp = (v: number) => Math.max(0, Math.min(n, Math.floor(v)));
  const s0 = clamp(span.start);
  const e0 = clamp(span.end);

  const trim = (a: number, b: number): [number, number] => {
    while (a < b && (isSpace(a) || isDangling(a))) a++;
    while (b > a && (isSpace(b - 1) || isDangling(b - 1))) b--;
    return [a, b];
  };

  let start = s0;
  let end = e0;

  // MID-WORD start → advance past the partial-word prefix + following whitespace.
  if (start > 0 && isAlnum(start - 1) && isAlnum(start)) {
    while (start < end && isAlnum(start)) start++;
    while (start < end && isSpace(start)) start++;
  }
  // MID-WORD end → retract past the partial-word suffix + preceding whitespace.
  if (end < n && isAlnum(end) && isAlnum(end - 1)) {
    while (end > start && isAlnum(end - 1)) end--;
    while (end > start && isSpace(end - 1)) end--;
  }

  [start, end] = trim(start, end);
  if (end <= start) {
    // Snapping erased everything meaningful — keep the original, just trimmed.
    [start, end] = trim(s0, e0);
  }

  return { ...span, start, end, excerpt: text.slice(start, end) };
}

/** Options for {@link annotateReasoning}. */
export interface AnnotateOptions {
  /** The verifier's ground-truth answer, if numeric (drives the "reaches" span). */
  verifiedAnswer?: number | null;
  /**
   * The FULL set of the verifier's correct values, if the answer is multi-part
   * (e.g. `[2, −1, 3]` for "a = 2, b = −1, c = 3"). Grounds PARTIAL greens over
   * each genuinely-correct committed value even when the overall answer is
   * missed. Defaults to `[verifiedAnswer]` when absent — a single-value answer is
   * unchanged.
   */
  verifiedValues?: number[];
  /** Accepted mechanism phrasings (question signals + rubric classes). */
  mechanismSignals?: string[];
  /** The question prompt — enables PREMISE / decomposition flaw localization. */
  prompt?: string;
  /**
   * Whether the verifier marked the ANSWER wrong. When true (or the derivation
   * lands on a value contradicting `verifiedAnswer`), the annotator localizes
   * the single ROOT flaw as a RED span — a broken premise/decomposition, or (as
   * a fallback) the earliest load-bearing step — so the learner is never left to
   * "find the broken step" themselves.
   */
  answerWasWrong?: boolean;
}

/** A trimmed clause with offsets into the original text. */
type Clause = TextClause;

/** Compact human-readable number. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

/** A local {start,end} range within a clause (offsets are clause-relative). */
type Range = { start: number; end: number };

/** Trim whitespace off a clause-relative range. */
function trimRange(text: string, r: Range): Range {
  let { start, end } = r;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return { start, end };
}

/**
 * Locate the FIRST stated `<expr> = <expr>` equality in the clause that HOLDS,
 * returning its tight range (just the equation, no surrounding prose), or `null`.
 * This is what lets a CORRECT step be highlighted GREEN granularly — only the
 * arithmetic itself, not the whole sentence around it.
 */
function findCorrectArithRange(text: string): Range | null {
  const isArith = (ch: string) => /[0-9.+\-*/×÷() ]/.test(ch);
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "=") continue;
    let l = i;
    while (l > 0 && isArith(text[l - 1])) l--;
    let r = i + 1;
    while (r < text.length && (isArith(text[r]) || text[r] === "=")) r++;
    const a = evalArithmetic(text.slice(l, i));
    const b = evalArithmetic(text.slice(i + 1, r));
    if (a === null || b === null) continue;
    const tol = 1e-6 + Math.abs(b) * 1e-6;
    if (Math.abs(a - b) <= tol) return trimRange(text, { start: l, end: r });
  }
  return null;
}

/**
 * Locate the LAST numeric token in the clause whose value matches `verified`
 * (within tol), returning its tight range — so ONLY the correct final value is
 * greened, not the whole concluding sentence. `null` when none matches.
 */
function findValueRange(text: string, verified: number, tol: number): Range | null {
  const re =
    /[+-]?\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|[+-]?\d+(?:[.,]\d+)?\s*%|[+-]?\d[\d,]*(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  let best: Range | null = null;
  while ((m = re.exec(text)) !== null) {
    const v = parseNumericValue(m[0].replace(/\s+/g, ""));
    if (v !== null && Math.abs(v - verified) <= tol) {
      best = { start: m.index, end: m.index + m[0].length };
    }
  }
  return best;
}

/**
 * Locate the earliest LITERAL occurrence of any mechanism signal phrase in the
 * clause (case-insensitive), returning its tight range — so only the key idea is
 * greened. Tiny/answer-value-ish signals are skipped so a bare number can never
 * paint a phrase green. `null` when no phrase is found literally.
 */
function findMechanismRange(text: string, signals: string[]): Range | null {
  const lower = text.toLowerCase();
  let best: Range | null = null;
  for (const sig of signals) {
    const s = sig.toLowerCase().trim();
    if (s.length < 4 || /^[\d.\s/%+-]+$/.test(s)) continue;
    const idx = lower.indexOf(s);
    if (idx >= 0 && (best === null || idx < best.start)) {
      best = { start: idx, end: idx + s.length };
    }
  }
  return best;
}

/** Does a candidate range overlap any range already collected for this clause? */
function overlapsAny(r: Range, taken: Range[]): boolean {
  return taken.some((t) => !(r.end <= t.start || r.start >= t.end));
}

/**
 * Collect TIGHT, minimal, content-referential spans for ONE clause. Instead of
 * blanket-coloring the whole clause, this highlights ONLY the load-bearing bits:
 * the specific false step / hedge (red), or the correct value / correct equation
 * / named mechanism (green) — leaving connective filler unhighlighted. Each `why`
 * quotes the candidate's ACTUAL words. FLAWED wins over GOOD on any overlap.
 */
function collectClauseSpans(
  clause: Clause,
  opts: AnnotateOptions,
  out: ReasoningSpan[],
): void {
  const { text } = clause;
  const taken: Range[] = [];
  const push = (r: Range, label: SpanLabel, why: string) => {
    const tr = trimRange(text, r);
    if (tr.end <= tr.start) return;
    taken.push(tr);
    out.push({
      start: clause.start + tr.start,
      end: clause.start + tr.end,
      excerpt: text.slice(tr.start, tr.end),
      label,
      why,
    });
  };

  // --- FLAWED (red), tight ------------------------------------------------
  const falseArith = findFalseArithmetic(text);
  if (falseArith) {
    const idx = text.toLowerCase().indexOf(falseArith.claim.toLowerCase().trim());
    const r =
      idx >= 0
        ? { start: idx, end: idx + falseArith.claim.trim().length }
        : { start: 0, end: text.length };
    push(
      r,
      "flawed",
      `Incorrect step — you wrote “${falseArith.claim.trim()}”, but that works out to ${fmt(falseArith.correct)}, not ${fmt(falseArith.stated)}. Recompute this before building on it.`,
    );
    return; // a broken step clause isn't also greened
  }
  if (hasArithmeticContradiction(text)) {
    const eq = findEqualityRange(text) ?? { start: 0, end: text.length };
    push(
      eq,
      "flawed",
      `This equality doesn't hold — “${text.slice(eq.start, eq.end).trim()}” — the numbers you wrote don't produce that result.`,
    );
    return;
  }
  const hedge = findHedgePhrase(text);
  if (hedge) {
    push(
      hedge,
      "flawed",
      `You hedge here (“${text.slice(hedge.start, hedge.end).trim()}”) — this points both ways instead of committing to one answer.`,
    );
  }

  // --- GOOD (green), tight ------------------------------------------------
  // NOTE: the COMMITTED-CONCLUSION value is greened GLOBALLY (see
  // `addCommittedValueSpan`) — NOT here — so a number is green ONLY when it's the
  // candidate's committed answer that equals the verified answer, never because a
  // token coincidentally matches an answer component (e.g. the "2" in "(n+1)²").
  const eq = findCorrectArithRange(text);
  if (eq && !overlapsAny(eq, taken)) {
    push(
      eq,
      "good",
      `This step checks out — “${text.slice(eq.start, eq.end).trim()}” is correct.`,
    );
  }
  if (opts.mechanismSignals && opts.mechanismSignals.length > 0) {
    const mech = findMechanismRange(text, opts.mechanismSignals);
    if (mech && !overlapsAny(mech, taken)) {
      push(
        mech,
        "good",
        `You name the key mechanism here (“${text.slice(mech.start, mech.end).trim()}”) — that's what the result actually turns on.`,
      );
    }
  }
}

/**
 * Locate the tight range of the FIRST `<expr> = <expr>` equality (holding or not)
 * so a CONTRADICTORY equality can be reddened granularly. `null` when there's no
 * arithmetic equality in the text.
 */
function findEqualityRange(text: string): Range | null {
  const isArith = (ch: string) => /[0-9.+\-*/×÷() ]/.test(ch);
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "=") continue;
    let l = i;
    while (l > 0 && isArith(text[l - 1])) l--;
    let r = i + 1;
    while (r < text.length && (isArith(text[r]) || text[r] === "=")) r++;
    return trimRange(text, { start: l, end: r });
  }
  return null;
}

/**
 * WHOLE-CLAUSE explanation grading for an explanation-required ("why …?") prompt.
 * For each clause the candidate wrote:
 *   • a CIRCULAR justification ("because that is enough") or a STEM RESTATEMENT
 *     ("three terms … because it is quadratic", which lifts "quadratic" straight
 *     from the stem) is reddened as a NON-explanation — even when the final answer
 *     is correct — with feedback naming what a real reason would say; else
 *   • a clause that introduces a GENUINE mechanism (a creditable signal, or a
 *     content term the stem didn't already give) is greened AS A WHOLE CLAUSE, so
 *     the load-bearing reasoning is covered fully instead of as a lone keyword.
 * Skips short connective fragments and any clause already carrying a flawed span
 * (a false step wins). Full-clause GREEN is withheld when the verifier marked the
 * answer wrong (the root-cause localizer reddens instead). Mutates `spans`.
 */
function annotateExplanationClauses(
  text: string,
  spans: ReasoningSpan[],
  opts: AnnotateOptions,
  signals: string[] | undefined,
): void {
  const prompt = opts.prompt;
  const evictOverlappingGood = (start: number, end: number) => {
    for (let i = spans.length - 1; i >= 0; i--) {
      if (spans[i].label === "good" && !(spans[i].end <= start || spans[i].start >= end))
        spans.splice(i, 1);
    }
  };
  for (const c of toClauses(text)) {
    const claim = c.text.trim().replace(/[.,;:]+$/, "");
    if (claim.split(/\s+/).filter(Boolean).length < 3) continue;
    // A false step already reddened this clause — that critique wins.
    if (spans.some((s) => s.label === "flawed" && !(c.end <= s.start || c.start >= s.end)))
      continue;
    // A pure CORRECT VALUE COMMITMENT ("a = 2, b = −1, c = 3") is NOT a vacuous
    // restatement even when its tokens (a/b/c and the coefficient digits) happen
    // to echo the stem — never redden it here; its correct values are greened
    // separately (partial credit). Only fires when the FULL correct value set is
    // known, so other archetypes are unaffected.
    if (isCorrectValueCommitClause(c.text, opts)) continue;
    // RED: circular or a bare restatement of the stem — it explains nothing.
    if (isCircularJustification(c.text) || isStemRestatement(c.text, prompt)) {
      evictOverlappingGood(c.start, c.end);
      spans.push({
        start: c.start,
        end: c.end,
        excerpt: c.text,
        label: "flawed",
        why: `This repeats the question rather than answering it — “${claim}” names the property but never says WHY it forces the answer. Give the actual mechanism (e.g. three unknowns need three equations, or the constant second difference fixes the leading coefficient).`,
      });
      continue;
    }
    // GREEN (whole clause): a genuine mechanism, on a not-wrong answer. Supersede
    // any tight keyword green already collected inside this clause.
    if (
      opts.answerWasWrong !== true &&
      hasNewMechanismContent(c.text, prompt, signals)
    ) {
      evictOverlappingGood(c.start, c.end);
      if (spans.some((s) => !(c.end <= s.start || c.start >= s.end))) continue;
      spans.push({
        start: c.start,
        end: c.end,
        excerpt: c.text,
        label: "good",
        why: `This is a real, load-bearing explanation — “${claim}” names the mechanism the answer actually turns on.`,
      });
    }
  }
}

/**
 * Produce SPAN-LEVEL good/flawed annotations for the candidate's reasoning. The
 * spans are disjoint and ordered by position. Garbled / empty text yields NO
 * spans (the UI shows a "not understood" / "no reasoning" state instead). Pure
 * and total.
 */
export function annotateReasoning(
  rawText: string,
  opts: AnnotateOptions = {},
): ReasoningSpan[] {
  const text = rawText ?? "";
  if (text.trim() === "") return [];
  // Genuinely garbled text has no meaningful spans to highlight.
  if (isUninterpretable(text)) return [];
  // For the GREEN "you name the key mechanism" attribution, only credit signals
  // that don't merely ECHO the stem on an explanation-required ("why") prompt —
  // so a parroted stem phrase ("three terms") is never greened as "the key
  // mechanism" when no genuine reason was given. A no-op for non-why prompts.
  const greenOpts: AnnotateOptions = {
    ...opts,
    mechanismSignals: creditableMechanismSignals(
      opts.mechanismSignals ?? [],
      opts.prompt,
    ),
  };
  const spans: ReasoningSpan[] = [];
  for (const clause of toClauses(text)) {
    collectClauseSpans(clause, greenOpts, spans);
  }
  // On an explanation-required ("why …?") prompt, grade whole EXPLANATION clauses
  // (not just keywords): GREEN a clause that introduces a genuine mechanism, RED a
  // clause that is circular or merely restates the stem. This is what turns the
  // "tiny random chunk" fallback into full-clause coverage.
  if (isExplanationRequiredPrompt(opts.prompt)) {
    annotateExplanationClauses(text, spans, opts, greenOpts.mechanismSignals);
  }
  addCommittedValueSpan(text, spans, opts);
  localizeRootCause(text, spans, opts);
  // Normalize EVERY span to word boundaries (same pass the LLM review runs) so
  // no highlight bleeds into an adjacent word. A no-op for already-clean spans.
  return dedupeSpans(spans).map((s) => snapSpanToWordBoundaries(text, s));
}

/**
 * Green ONLY the candidate's COMMITTED CONCLUSION when it equals the verified
 * answer — never a coincidental token. The committed conclusion is the LAST value
 * the derivation states as a result; we green it only when (a) it matches the
 * verifier within tolerance AND (b) the verifier did NOT mark the answer wrong.
 * This is the fix for the false-green bug where the "2" inside "(n+1)²" (or the
 * "2" in "1,2,1") was greened because it happened to equal an answer component.
 * Mutates `spans`; a flawed span at the same place still wins in `dedupeSpans`.
 */
function addCommittedValueSpan(
  text: string,
  spans: ReasoningSpan[],
  opts: AnnotateOptions,
): void {
  // PARTIAL CREDIT on a graded-wrong answer: when the candidate committed the
  // WHOLE correct value set (all right, none wrong — e.g. "a = 2, b = −1, c = 3"
  // on a missed "why" explanation), green EACH correct committed value even
  // though the overall answer was missed. The load-bearing flaw (the circular /
  // stem-restatement clause, or a false step) is reddened separately, and a
  // coincidental token (the "2" in "(n+1)²") never qualifies because the
  // committed set there does not match the verifier's set.
  if (opts.answerWasWrong === true) {
    addPartialCorrectValueSpans(text, spans, opts);
    return;
  }
  const verified = opts.verifiedAnswer ?? null;
  if (verified === null) return;
  const tol = 1e-3 + Math.abs(verified) * 1e-6;
  // The committed conclusion must actually be the LAST stated result value AND
  // equal the verified answer — otherwise there is no correct committed value.
  const results = statedResultValues(text);
  const committed = results.length > 0 ? results[results.length - 1] : null;
  const committedMatches =
    committed !== null && Math.abs(committed - verified) <= tol;
  // When the verifier EXPLICITLY confirmed the answer correct
  // (`answerWasWrong === false`), the committed answer IS the verified one, so
  // the graded value is grounded wherever the candidate states it — green it
  // even when it isn't the final token. This surfaces the load-bearing correct
  // value in multi-part / prose answers ("a is 2, b is -1, and c is 3", where 2
  // is the graded coefficient) instead of leaving a correct commit unhighlighted.
  const verifierConfirmed = opts.answerWasWrong === false;
  if (!committedMatches && !verifierConfirmed) return;
  // Highlight the LAST verified-matching token (the conclusion), tightly.
  const r = findValueRange(text, verified, tol);
  if (!r) return;
  if (spans.some((s) => !(r.end <= s.start || r.start >= s.end))) return;
  spans.push({
    start: r.start,
    end: r.end,
    excerpt: text.slice(r.start, r.end),
    label: "good",
    why: `You commit to the correct answer here (${fmt(verified)}) — this is where the work lands right.`,
  });
}

/** The verifier's correct value SET (explicit multi-value set, or the scalar). */
function verifiedValueSet(opts: AnnotateOptions): number[] {
  if (opts.verifiedValues && opts.verifiedValues.length > 0)
    return opts.verifiedValues;
  return opts.verifiedAnswer != null ? [opts.verifiedAnswer] : [];
}

/**
 * Is a clause a pure CORRECT VALUE COMMITMENT — it states numeric value(s) that
 * are ALL in the verifier's correct set (e.g. "a = 2, b = −1, c = 3"), with no
 * causal "because/since" reason? Such a clause is a committed answer, NOT a
 * vacuous stem restatement, so the explanation grader must not redden it even if
 * its bare tokens echo the stem. Requires the FULL correct value set (≥2 values,
 * so a single-answer archetype is unaffected). Pure and total.
 */
function isCorrectValueCommitClause(text: string, opts: AnnotateOptions): boolean {
  const verified = verifiedValueSet(opts);
  if (verified.length < 2) return false;
  if (/\b(?:because|since|so that|due to|for the reason that)\b/i.test(text))
    return false;
  const vals = allValuesIn(text);
  if (vals.length === 0) return false;
  return vals.every((v) =>
    verified.some((vv) => Math.abs(v - vv) <= 1e-3 + Math.abs(vv) * 1e-6),
  );
}

/**
 * PARTIAL-CREDIT greens for a graded-wrong answer: green each correct committed
 * value the candidate stated, BUT only when they committed the WHOLE correct
 * value set (see {@link committedValuesMatchVerifiedSet}) — so a coincidental
 * token is never greened. Each value's tight token is greened where it doesn't
 * overlap an existing (e.g. reddened circular-clause) span. Mutates `spans`.
 */
function addPartialCorrectValueSpans(
  text: string,
  spans: ReasoningSpan[],
  opts: AnnotateOptions,
): void {
  const verified = verifiedValueSet(opts);
  if (!committedValuesMatchVerifiedSet(text, verified)) return;
  for (const v of verified) {
    const tol = 1e-3 + Math.abs(v) * 1e-6;
    const r = findValueRange(text, v, tol);
    if (!r) continue;
    if (spans.some((s) => !(r.end <= s.start || r.start >= s.end))) continue;
    spans.push({
      start: r.start,
      end: r.end,
      excerpt: text.slice(r.start, r.end),
      label: "good",
      why: `This value is correct (${fmt(v)}) — it matches the verified answer; the miss is in the reasoning, not this number.`,
    });
  }
}

/**
 * Sort spans by position and drop overlaps so the highlighted runs are DISJOINT
 * (the UI renders neutral text between them). On overlap, FLAWED (red) wins over
 * GOOD (green) — a broken step is never painted green — and the earlier span wins
 * among same-label overlaps.
 */
function dedupeSpans(spans: ReasoningSpan[]): ReasoningSpan[] {
  const ordered = [...spans].sort((a, b) =>
    a.start !== b.start
      ? a.start - b.start
      : a.label === b.label
        ? a.end - b.end
        : a.label === "flawed"
          ? -1
          : 1,
  );
  const out: ReasoningSpan[] = [];
  for (const s of ordered) {
    const clash = out.find((k) => !(s.end <= k.start || s.start >= k.end));
    if (!clash) {
      out.push(s);
      continue;
    }
    // Prefer a flawed span over a green one it overlaps.
    if (clash.label === "good" && s.label === "flawed") {
      out.splice(out.indexOf(clash), 1, s);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * When the derivation is WRONG, ensure the single ROOT flaw is highlighted RED
 * so the learner sees exactly where it breaks (never "locate it yourself"):
 *   1. a specific broken PREMISE / decomposition / independence-abuse / bogus
 *      50/50 (shared with the grader's `findPremiseFlaw`, so the highlighted
 *      span and the graded verdict come from the SAME root cause); else
 *   2. if nothing is highlighted flawed yet, the EARLIEST load-bearing clause —
 *      the chain built on it carries the error forward.
 * A derivation that REACHES the verified answer is never reddened, so a correct
 * chain can't get a false red. Mutates `spans` in place.
 */
function localizeRootCause(
  text: string,
  spans: ReasoningSpan[],
  opts: AnnotateOptions,
): void {
  const verified = opts.verifiedAnswer ?? null;
  const tol = verified !== null ? 1e-3 + Math.abs(verified) * 1e-6 : 0;
  const reaches =
    verified !== null &&
    statedResultValues(text).some((v) => Math.abs(v - verified) <= tol);
  if (reaches) return; // correct chain — never redden
  const all = allValuesIn(text);
  const landing = all.length > 0 ? all[all.length - 1] : null;
  const contradicts =
    verified !== null &&
    landing !== null &&
    Math.abs(landing - verified) > tol;
  // The verifier is AUTHORITATIVE. When it explicitly CONFIRMED the committed
  // answer correct (`answerWasWrong === false`), never invent a root-cause red
  // from a scalar landing mismatch: a multi-part answer ("a = 2, b = −1, c = 3")
  // legitimately ends on a value (3) that isn't the single graded target (2),
  // and reddening the correct coefficients with a nonsensical "steers the chain
  // to 3 instead of 2" is exactly the reported bug. The `contradicts` heuristic
  // is only a FALLBACK for when the verifier verdict wasn't supplied.
  const wrong =
    opts.answerWasWrong === true ||
    (opts.answerWasWrong === undefined && contradicts);
  if (!wrong) return;

  // Redden a localized root-cause span, evicting any overlapping decoration so
  // the root cause always wins its span. Shared by every localizer below.
  const redden = (start: number, end: number, why: string): void => {
    for (let i = spans.length - 1; i >= 0; i--) {
      if (!(spans[i].end <= start || spans[i].start >= end)) spans.splice(i, 1);
    }
    spans.push({
      start,
      end,
      excerpt: text.slice(start, end),
      label: "flawed",
      why,
    });
  };

  // EARLIEST FALSE PER-CLAIM RESIDUAL (sequence family), HIGHEST priority: the
  // candidate asserted "<delta> more/less than <expr> at n=k" and the verifier
  // found the earliest k where that residual is FALSE. This is earlier and more
  // load-bearing than the final formula line, so it is the primary red span.
  const residual = opts.prompt
    ? findFalseResidualClaim(text, opts.prompt)
    : null;
  if (residual) {
    redden(residual.start, residual.end, residual.why);
    return;
  }

  const flaw = findPremiseFlaw(text, {
    prompt: opts.prompt,
    verifiedAnswer: verified,
    statedValue: landing,
  });
  if (flaw) {
    redden(flaw.start, flaw.end, flaw.why);
    return;
  }

  // The candidate's COMMITTED formula (parsed from their text, NOT a highlighted
  // substring) evaluated against the ACTUAL terms — the earliest `n` where it
  // diverges, quoted with the verifier's real numbers ("gives 13 at n=2 but the
  // sequence is 11"). Critiques the formula they actually wrote.
  const committed = opts.prompt
    ? checkCommittedFormula(text, opts.prompt)
    : null;
  if (committed) {
    redden(committed.start, committed.end, committed.why);
    return;
  }

  // A MIS-IDENTIFIED CLOSED FORM (sequence family), detected GENERICALLY: the
  // candidate's implied closed form (e.g. "(n+1)²") doesn't reproduce the actual
  // terms. Redden the closed-form phrase with a content-referential explanation
  // that shows what it gives vs. what the sequence really is.
  const cf = opts.prompt ? findClosedFormMismatch(text, opts.prompt) : null;
  if (cf) {
    redden(cf.start, cf.end, cf.why);
    return;
  }

  // Generic fallback: no specific misconception matched, but the chain is wrong.
  // Point at the earliest substantive, not-yet-highlighted clause and QUOTE it,
  // so the learner still sees exactly where it goes off — never a template.
  if (spans.some((s) => s.label === "flawed")) return;
  for (const c of toClauses(text)) {
    if (c.text.trim().split(/\s+/).filter(Boolean).length < 3) continue;
    if (spans.some((s) => !(c.end <= s.start || c.start >= s.end))) continue;
    const claim = c.text.trim().replace(/[.,;:]+$/, "");
    const tail =
      landing !== null && verified !== null
        ? ` it's what steers the chain to ${fmt(landing)} instead of ${fmt(verified)}.`
        : " the rest of the chain is built on it and inherits the error.";
    spans.push({
      start: c.start,
      end: c.end,
      excerpt: c.text,
      label: "flawed",
      why: `This is where it goes off — you wrote “${claim}”, and${tail} Re-check this step against the setup.`,
    });
    return;
  }
}

/**
 * Convenience for callers that already hold the verifier's answer as a STRING
 * (e.g. a `MathStep.answer` stringified). Parses it to a number when possible.
 */
export function annotateReasoningForAnswer(
  rawText: string,
  correctAnswer: string,
  mechanismSignals?: string[],
): ReasoningSpan[] {
  return annotateReasoning(rawText, {
    verifiedAnswer: parseNumericValue(correctAnswer),
    mechanismSignals,
  });
}
