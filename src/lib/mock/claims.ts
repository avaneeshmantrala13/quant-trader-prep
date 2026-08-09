/**
 * mock/claims.ts — the CLAIMS-BASED "extract-and-verify" reasoning grader.
 *
 * ARCHITECTURE (why this generalizes AND stays non-jailbreakable):
 *   1. EXTRACT (translation only): a candidate's free-text reasoning is turned
 *      into a STRUCTURED list of discrete, checkable CLAIMS — intermediate
 *      arithmetic, the asserted final answer, and the METHOD/mechanism invoked.
 *      This step may be done by the LLM (see `aiMock.extractReasoningClaims`)
 *      whose ONLY job is text → claims, or deterministically here as a fallback.
 *      The LLM NEVER judges correctness.
 *   2. VERIFY (deterministic): each claim is checked against the problem's
 *      computable truth — arithmetic is re-evaluated exactly, the final answer is
 *      compared to the verifier's answer, and the invoked method is checked
 *      against the archetype RUBRIC's equivalence classes of valid methods. The
 *      VERDICT comes ONLY from this deterministic check.
 *
 * This makes grading general (accepts ANY wording/method the LLM can normalize
 * onto a valid mechanism class) while remaining non-jailbreakable (a correct
 * final answer paired with a FALSE or MISSING load-bearing claim still fails).
 *
 * SAFETY: the deterministic verdict (`gradeReasoningDeterministic`) is the tested
 * floor. When claims come from the LLM we RECONCILE: we STRENGTHEN flaw detection
 * (a false arithmetic claim is caught even if the text scanner missed it) and, as
 * a FAIL-SAFE against false negatives, we may RESCUE a `partial`/`vague` verdict
 * to `sound` ONLY when the extracted claims prove a sound derivation (reaches the
 * verified answer, establishes a valid mechanism, engages the real quantities)
 * AND the verifier already marked the answer correct. We NEVER weaken flaw
 * rejection and NEVER fabricate correctness.
 *
 * PURE: no React, DOM, storage, or network. Imports only pure helpers from
 * `./reasoning` (one-directional — `reasoning.ts` never imports this module, so
 * there is no cycle) and the rubric data from `./rubrics`.
 */
import {
  evalArithmetic,
  gradeReasoningDeterministic,
  matchesMechanismSignal,
  mechanismSignalsSansAnswerValue,
  numbersIn,
  parseNumericValue,
  statedResultValues,
  type FalseArithmetic,
  type ReasoningInput,
} from "./reasoning";
import type { ReasoningGrade } from "./types";
import { rubricForId, rubricSignals, type ArchetypeRubric } from "./rubrics";

/* -------------------------------------------------------------------------- */
/*  Claim data model                                                           */
/* -------------------------------------------------------------------------- */

/** The kind of a discrete, checkable claim extracted from reasoning. */
export type ClaimKind = "arithmetic" | "final-answer" | "mechanism" | "quantity";

/**
 * ONE discrete, checkable claim. The LLM (or the deterministic fallback) emits a
 * list of these; the verifier checks each against computable truth.
 *   • `arithmetic`   — a stated computation: `expr` (LHS) evaluates to `value`.
 *   • `final-answer` — the candidate's asserted final numeric answer (`value`).
 *   • `mechanism`    — the METHOD invoked, as a short natural-language phrase
 *                      (`mechanism`), e.g. "constant second difference".
 *   • `quantity`     — a referenced intermediate quantity (`value`).
 */
export interface ReasoningClaim {
  kind: ClaimKind;
  /** The clause the claim came from (verbatim-ish) — used for feedback. */
  text: string;
  /** `arithmetic`: the left-hand expression, e.g. "24 + 6" or "65 - 41". */
  expr?: string;
  /** `arithmetic`: stated result; `final-answer`/`quantity`: the value. */
  value?: number;
  /** `mechanism`: a short description of the method (LLM-normalized phrasing). */
  mechanism?: string;
}

/** A set of extracted claims plus where they came from. */
export interface ClaimSet {
  claims: ReasoningClaim[];
  source: "ai" | "deterministic";
}

/* -------------------------------------------------------------------------- */
/*  Deterministic extraction (the always-available fallback translator)        */
/* -------------------------------------------------------------------------- */

/** Char class of a numeric-arithmetic run (mirrors `reasoning.ts`, `=`-free). */
const ARITH_RUN = "0-9.,\\s()+\\-*/×✕÷·⋅\\u2212";
const TRAILING_ARITH = new RegExp(`[${ARITH_RUN}]*$`);
const LEADING_ARITH = new RegExp(`^[${ARITH_RUN}]*`);

/**
 * Extract explicit `<expr> = <result>` statements as arithmetic claims. Splits
 * on `=` and pairs the trailing arithmetic run of each segment with the leading
 * run of the next (so a chain `a = b = c` yields both `a=b` and `b=c`). Only
 * fully-numeric, evaluable expressions become claims (formulas with variables
 * like `3n^2` are skipped). Arrows (`→`) are "leads to", NOT arithmetic equality.
 */
function extractArithmeticClaims(text: string): ReasoningClaim[] {
  const out: ReasoningClaim[] = [];
  if (!text || text.indexOf("=") < 0) return out;
  const segs = text.split("=");
  for (let k = 0; k + 1 < segs.length; k++) {
    const lhs = (segs[k].match(TRAILING_ARITH)?.[0] ?? "").trim();
    const rhsRun = (segs[k + 1].match(LEADING_ARITH)?.[0] ?? "").trim();
    const a = evalArithmetic(lhs);
    const b = evalArithmetic(rhsRun);
    if (a === null || b === null) continue;
    out.push({
      kind: "arithmetic",
      text: `${lhs} = ${rhsRun}`.replace(/\s+/g, " ").trim(),
      expr: lhs,
      value: b,
    });
  }
  return out;
}

/**
 * Deterministically translate reasoning text into claims. This mirrors what the
 * LLM extractor produces, using pure heuristics: explicit arithmetic equalities,
 * the stated result/final-answer values, and any mechanism phrasing that matches
 * the supplied signals / rubric classes. Total and pure.
 */
export function extractClaimsDeterministic(
  text: string,
  opts: { mechanismSignals?: string[]; rubric?: ArchetypeRubric } = {},
): ClaimSet {
  const claims: ReasoningClaim[] = [];
  const t = (text ?? "").trim();
  if (t === "") return { claims, source: "deterministic" };

  claims.push(...extractArithmeticClaims(t));

  const results = statedResultValues(t);
  if (results.length > 0) {
    // The LAST stated result is the candidate's asserted final answer; earlier
    // ones are intermediate quantities.
    results.forEach((v, i) => {
      claims.push({
        kind: i === results.length - 1 ? "final-answer" : "quantity",
        text: t,
        value: v,
      });
    });
  }

  const signals = [
    ...(opts.mechanismSignals ?? []),
    ...(opts.rubric ? rubricSignals(opts.rubric) : []),
  ];
  for (const sig of signals) {
    if (matchesMechanismSignal(t, [sig])) {
      claims.push({ kind: "mechanism", text: sig, mechanism: sig });
    }
  }
  return { claims, source: "deterministic" };
}

/**
 * Defensively normalize an LLM `mock-extract-claims` payload into a `ClaimSet`.
 * Tolerates missing/mistyped fields (drops junk claims) and never throws.
 * `source` is `"ai"`. Correctness is NEVER read from the payload.
 */
export function normalizeClaimsPayload(
  payload: Record<string, unknown> | null,
): ClaimSet {
  const raw = payload?.["claims"];
  const claims: ReasoningClaim[] = [];
  if (Array.isArray(raw)) {
    for (const c of raw) {
      if (!c || typeof c !== "object") continue;
      const obj = c as Record<string, unknown>;
      const kind = obj["kind"];
      if (
        kind !== "arithmetic" &&
        kind !== "final-answer" &&
        kind !== "mechanism" &&
        kind !== "quantity"
      )
        continue;
      const text = typeof obj["text"] === "string" ? (obj["text"] as string) : "";
      const claim: ReasoningClaim = { kind, text };
      if (typeof obj["expr"] === "string") claim.expr = obj["expr"] as string;
      if (typeof obj["mechanism"] === "string")
        claim.mechanism = obj["mechanism"] as string;
      const v = obj["value"];
      if (typeof v === "number" && Number.isFinite(v)) claim.value = v;
      else if (typeof v === "string") {
        const parsed = parseNumericValue(v);
        if (parsed !== null) claim.value = parsed;
      }
      claims.push(claim);
    }
  }
  return { claims, source: "ai" };
}

/* -------------------------------------------------------------------------- */
/*  Deterministic verification of the claims                                   */
/* -------------------------------------------------------------------------- */

/** Relative/absolute tolerance for matching a value to the verified answer. */
function withinTol(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-3 + Math.abs(b) * 1e-6;
}

/**
 * The FIRST arithmetic claim whose stated result does not equal its evaluated
 * expression (a demonstrably false step). Returns `null` when every arithmetic
 * claim checks out. This is the claim-based analogue of `findFalseArithmetic`
 * and is used to STRENGTHEN (never weaken) flaw detection on LLM-extracted claims.
 */
export function firstFalseArithmeticClaim(
  claims: ReasoningClaim[],
): FalseArithmetic | null {
  for (const c of claims) {
    if (c.kind !== "arithmetic" || c.expr == null || c.value == null) continue;
    const computed = evalArithmetic(c.expr);
    if (computed === null) continue;
    const tol = Math.max(1e-6, Math.abs(computed) * 1e-6);
    if (Math.abs(computed - c.value) > tol) {
      const claim = c.text.trim() || `${c.expr} = ${c.value}`;
      return {
        claim,
        correct: computed,
        stated: c.value,
        message:
          `You wrote "${claim}" — that's incorrect: ${c.expr} = ${fmt(computed)}, ` +
          `not ${fmt(c.value)}. State the real result; don't force the answer.`,
      };
    }
  }
  return null;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

/** Do the claims ARRIVE AT the verified answer (final-answer / quantity / result)? */
export function claimsReachAnswer(
  claims: ReasoningClaim[],
  verifiedAnswer: number,
): boolean {
  return claims.some(
    (c) =>
      (c.kind === "final-answer" ||
        c.kind === "quantity" ||
        c.kind === "arithmetic") &&
      c.value != null &&
      withinTol(c.value, verifiedAnswer),
  );
}

/**
 * Is the invoked mechanism a VALID method for this question? A mechanism claim
 * establishes the method when its phrasing matches the per-question signals OR
 * any rubric equivalence class. (The LLM normalizes arbitrary wording onto a
 * canonical mechanism phrase, so this generalizes beyond literal substrings.)
 */
export function claimEstablishesMechanism(
  claims: ReasoningClaim[],
  mechanismSignals: string[] | undefined,
  rubric: ArchetypeRubric | undefined,
): boolean {
  const accepted = [
    ...(mechanismSignals ?? []),
    ...(rubric ? rubricSignals(rubric) : []),
  ];
  if (accepted.length === 0) return false;
  return claims.some(
    (c) =>
      c.kind === "mechanism" &&
      c.mechanism != null &&
      matchesMechanismSignal(c.mechanism, accepted),
  );
}

/** Do the claims ENGAGE the actual setup quantities (or show real arithmetic)? */
export function claimEngagesQuantities(
  claims: ReasoningClaim[],
  prompt: string,
): boolean {
  const setup = numbersIn(prompt);
  if (claims.some((c) => c.kind === "arithmetic" && c.expr)) return true;
  if (setup.size === 0) return false;
  return claims.some(
    (c) => c.value != null && setup.has(String(c.value)),
  );
}

/* -------------------------------------------------------------------------- */
/*  The graded verdict — deterministic, shared by both claim sources           */
/* -------------------------------------------------------------------------- */

/**
 * Grade reasoning from a `ClaimSet`, returning a `ReasoningGrade`. The VERDICT is
 * ALWAYS deterministic:
 *
 *   • DETERMINISTIC claims → the tested `gradeReasoningDeterministic` verdict
 *     verbatim (zero behavior change when the LLM is unavailable).
 *   • AI claims → RECONCILE with the deterministic verdict:
 *       – STRENGTHEN: a false arithmetic claim (or the text scanner's flaw) ⇒
 *         `flawed`, even if the deterministic pass missed it.
 *       – PRESERVE: `sound` / `ambiguous` (anti-gaming clarify) / `absent` stand.
 *       – RESCUE (fail-safe vs. false negatives): a `partial`/`vague` verdict is
 *         upgraded to `sound` ONLY when the answer is verifier-correct AND the
 *         claims reach the verified answer, establish a valid mechanism, and
 *         engage the real quantities — i.e. arbitrary phrasing the deterministic
 *         substring matcher failed to recognize but the claims prove is sound.
 *
 * We NEVER weaken flaw rejection and NEVER fabricate correctness.
 */
export function gradeReasoningFromClaims(
  input: ReasoningInput,
  claimSet: ClaimSet,
  rubric?: ArchetypeRubric,
): ReasoningGrade {
  const det = gradeReasoningDeterministic(input);
  if (claimSet.source !== "ai") return det;

  const resolvedRubric = rubric;
  const claimFalse = firstFalseArithmeticClaim(claimSet.claims);

  // STRENGTHEN: any false arithmetic (claim- or text-detected) ⇒ flawed.
  if (det.quality === "flawed") return { ...det, source: "ai" };
  if (claimFalse) {
    return {
      quality: "flawed",
      issues: [claimFalse.message],
      probe: det.probe,
      source: "ai",
    };
  }

  // PRESERVE: sound is already good; ambiguous must still route to clarify (the
  // anti-gaming path); absent has nothing to rescue.
  if (
    det.quality === "sound" ||
    det.quality === "ambiguous" ||
    det.quality === "absent"
  ) {
    return { ...det, source: "ai" };
  }

  // RESCUE partial/vague → sound when the claims prove a sound derivation.
  const verified = parseNumericValue(input.correctAnswer);
  const reaches =
    verified !== null && claimsReachAnswer(claimSet.claims, verified);
  // The QUESTION's policy decides whether a mechanism is required for `sound`
  // (mirrors the real grader: only questions with authored `mechanismSignals`
  // gate on mechanism). The rubric NEVER imposes a requirement — it only
  // BROADENS what counts as establishing a valid method.
  const requiresMechanism = (input.mechanismSignals ?? []).length > 0;
  // A bare-answer-value "signal" can't be used to establish the mechanism (an
  // LLM emitting the numeric answer as a "method" must not pass), mirroring the
  // deterministic grader.
  const acceptedSignals = mechanismSignalsSansAnswerValue(
    input.mechanismSignals ?? [],
    verified,
  );
  const validMechanism = claimEstablishesMechanism(
    claimSet.claims,
    acceptedSignals,
    resolvedRubric,
  );
  const mechOk = !requiresMechanism || validMechanism;
  // Naming a VALID mechanism is itself engaging the problem's structure (mirrors
  // the deterministic grader, where terse-but-correct mechanism prose is sound).
  const engages =
    claimEngagesQuantities(claimSet.claims, input.prompt) || validMechanism;

  if (input.correct && reaches && mechOk && engages) {
    return { quality: "sound", issues: [], probe: det.probe, source: "ai" };
  }
  return { ...det, source: "ai" };
}

/**
 * Convenience: grade reasoning directly from text using the DETERMINISTIC
 * extractor (no LLM). Equivalent to `gradeReasoningDeterministic` but routed
 * through the explicit extract-then-verify pipeline, so the claims-based path is
 * exercised end-to-end even when the AI layer is off.
 */
export function gradeReasoningExtractVerify(
  input: ReasoningInput,
): ReasoningGrade {
  const rubric = rubricForIdSafe(input);
  const claimSet = extractClaimsDeterministic(input.reasoning, {
    mechanismSignals: input.mechanismSignals,
    rubric,
  });
  return gradeReasoningFromClaims(input, claimSet, rubric);
}

/** Best-effort rubric lookup from a (possibly absent) question id on the input. */
function rubricForIdSafe(input: ReasoningInput): ArchetypeRubric | undefined {
  const id = (input as ReasoningInput & { id?: string }).id;
  return typeof id === "string" ? rubricForId(id) : undefined;
}
