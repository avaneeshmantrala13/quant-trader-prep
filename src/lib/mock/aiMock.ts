/**
 * mock/aiMock.ts — the CLIENT-SIDE AI helper for the mock interview.
 *
 * This is the ONLY mock module that touches the network / env. The pure engine
 * (`engine.ts` and friends) never imports it, so the engine stays framework- and
 * network-free. Each function calls the AI Lambda per `datasets/MOCK_AI_CONTRACT.md`
 * and falls back to the DETERMINISTIC pure implementation when the AI layer is
 * off / stubbed / unreachable or returns something unusable. Nothing here can
 * ever decide correctness — that always comes from the verifier, passed in.
 *
 * The modes:
 *   • `gradeReasoning`   → `mock-extract-claims` (EXTRACT-AND-VERIFY: the LLM only
 *                           TRANSLATES the reasoning into structured claims; the
 *                           QUALITY VERDICT is computed DETERMINISTICALLY from
 *                           those claims by `./claims`. The LLM never judges.)
 *   • `generateFollowup` → `mock-followup`       (adaptive adversarial follow-up)
 *   • `getDiagnosis`     → `mock-diagnosis`       (final brutal prose)
 */
import { readAiConfig } from "@/lib/aiConfig";
import { env, postAi } from "@/lib/aiFlavor";
import {
  allValuesIn,
  checkCommittedFormula,
  creditableMechanismSignals,
  evalArithmetic,
  evalInN,
  findFalseArithmetic,
  findFalseResidualClaim,
  gradeReasoningDeterministic,
  hasNewMechanismContent,
  isCircularJustification,
  isStemRestatement,
  parseCommittedClosedForm,
  parseSequenceTerms,
  parseNumericValue,
  type ReasoningInput,
} from "./reasoning";
import {
  annotateReasoning,
  snapSpanToWordBoundaries,
  type ReasoningSpan,
} from "./annotate";
import {
  extractClaimsDeterministic,
  gradeReasoningFromClaims,
  normalizeClaimsPayload,
  type ClaimSet,
} from "./claims";
import { buildAiFollowup } from "./followups";
import {
  deterministicDiagnosis,
  floorDiagnosis,
  normalizeDiagnosisPayload,
} from "./diagnosis";
import type {
  FollowupPresentation,
  MockDiagnosis,
  MockPerformance,
  ReasoningGrade,
} from "./types";

/**
 * EXTRACT the candidate's free-text reasoning into a STRUCTURED list of claims.
 * The LLM's ONLY job is translation (text → claims): intermediate arithmetic,
 * the asserted final answer, and the method/mechanism invoked. It is explicitly
 * NOT asked to judge correctness. Falls back to the deterministic extractor when
 * the AI layer is off / stubbed / unreachable or returns nothing usable, so a
 * `ClaimSet` is ALWAYS returned.
 */
export async function extractReasoningClaims(
  input: ReasoningInput,
  opts: { concept?: string; signal?: AbortSignal } = {},
): Promise<ClaimSet> {
  const fallback = extractClaimsDeterministic(input.reasoning, {
    mechanismSignals: input.mechanismSignals,
  });

  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg || cfg.stub) return fallback;

  const payload = await postAi(
    cfg,
    e,
    {
      mode: "mock-extract-claims",
      prompt: input.prompt,
      correctAnswer: input.correctAnswer,
      reasoning: input.reasoning,
      concept: opts.concept ?? null,
    },
    opts.signal,
  );
  if (!payload) return fallback;
  const ai = normalizeClaimsPayload(payload);
  // If the model returned nothing usable, keep the deterministic claims so the
  // verifier still has structured facts to check.
  return ai.claims.length > 0 ? ai : fallback;
}

/**
 * Grade reasoning QUALITY via EXTRACT-AND-VERIFY. The LLM (when available) only
 * TRANSLATES the reasoning into claims (`extractReasoningClaims`); the VERDICT is
 * then computed 100% DETERMINISTICALLY from those claims against the problem's
 * computable truth (`gradeReasoningFromClaims`). The verifier's `correct` verdict
 * is authoritative and is never re-decided by the model. With the AI layer off,
 * the claims are extracted deterministically and the result is byte-identical to
 * `gradeReasoningDeterministic` (the tested fallback) — no regression.
 */
export async function gradeReasoning(
  input: ReasoningInput,
  opts: { concept?: string; signal?: AbortSignal } = {},
): Promise<ReasoningGrade> {
  const e = env();
  const cfg = readAiConfig(e);
  // Fast path: AI off/stubbed → skip extraction entirely and use the tested
  // deterministic verdict directly.
  if (!cfg || cfg.stub) return gradeReasoningDeterministic(input);

  const claimSet = await extractReasoningClaims(input, opts);
  return gradeReasoningFromClaims(input, claimSet);
}

/* -------------------------------------------------------------------------- */
/*  REAL LLM reasoning REVIEW (mock-review-reasoning) — grounded by the verifier */
/* -------------------------------------------------------------------------- */

/**
 * Context handed to the LLM reviewer so it can localize + explain, WITHOUT ever
 * deciding correctness: the verified answer, a canonical derivation / closed-form
 * and the key shortcut (e.g. "constant 2nd difference ⇒ a = Δ²/2"). All optional.
 */
export interface ReviewContext {
  concept?: string;
  /** The verifier's answer, if numeric (grounds every "good" value span). */
  verifiedAnswer?: number | null;
  /** Whether the verifier marked the committed ANSWER wrong (authoritative). */
  answerWasWrong?: boolean;
  /** Accepted mechanism phrasings (question signals + rubric classes). */
  mechanismSignals?: string[];
  /** A canonical worked derivation the reviewer may reference. */
  canonicalDerivation?: string;
  /** The closed form / formula for the answer, if any. */
  closedForm?: string;
  /** The key shortcut/insight (e.g. "constant second difference"). */
  keyShortcut?: string;
  signal?: AbortSignal;
}

/**
 * The result of an LLM reasoning REVIEW: verifier-GROUNDED spans over the
 * candidate text (each already reconciled against deterministic checks) plus an
 * advisory overall assessment. `source` records whether the LLM produced it or
 * the deterministic annotator (the offline floor) did. The spans are safe to
 * render verbatim — the LLM can never fabricate a "correct" label here.
 */
export interface ReasoningReview {
  spans: ReasoningSpan[];
  /** Advisory overall assessment (never changes correctness). */
  assessment: string;
  source: "ai" | "deterministic";
}

/** Compact human-readable number (mirrors the annotator). */
function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

/**
 * Is the REAL-LLM reasoning review path active right now (AI layer on + not the
 * stub)? The UI uses this to show a "reviewing…" pending state ONLY when the
 * grade genuinely round-trips to the hosted model (~1–3s), and to skip that
 * spinner entirely when the deterministic floor answers instantly (AI off /
 * stub / tests). Never throws.
 */
export function aiReviewActive(): boolean {
  try {
    const cfg = readAiConfig(env());
    return !!cfg && !cfg.stub;
  } catch {
    return false;
  }
}

/**
 * Does `excerpt` contain an arithmetic equality that actually HOLDS? Used to keep
 * a genuinely-correct equation green even on a wrong final answer.
 */
function holdsEquation(excerpt: string): boolean {
  let idx = excerpt.indexOf("=");
  while (idx >= 0) {
    // Grab the arithmetic runs on each side of this "=".
    const isArith = (ch: string) => /[0-9.+\-*/×÷() ]/.test(ch);
    let l = idx;
    while (l > 0 && isArith(excerpt[l - 1])) l--;
    let r = idx + 1;
    while (r < excerpt.length && (isArith(excerpt[r]) || excerpt[r] === "=")) r++;
    const a = evalArithmetic(excerpt.slice(l, idx));
    const b = evalArithmetic(excerpt.slice(idx + 1, r));
    if (a !== null && b !== null && Math.abs(a - b) <= 1e-6 + Math.abs(b) * 1e-6)
      return true;
    idx = excerpt.indexOf("=", idx + 1);
  }
  return false;
}

/** Is a candidate GREEN span genuinely grounded (not a coincidental token)? */
function isGreenGrounded(
  excerpt: string,
  verified: number | null,
  answerWasWrong: boolean,
  signals: string[] | undefined,
): boolean {
  // A holding equation is a genuinely-correct load-bearing step.
  if (holdsEquation(excerpt)) return true;
  // A named mechanism phrase (≥4 chars, not a bare number) engages the method.
  const lower = excerpt.toLowerCase();
  if (
    (signals ?? []).some((sig) => {
      const s = sig.toLowerCase().trim();
      return s.length >= 4 && !/^[\d.\s/%+-]+$/.test(s) && lower.includes(s);
    })
  )
    return true;
  // The committed conclusion value — ONLY when the verifier did NOT mark the
  // answer wrong. This is what drops a coincidental "2" green on a wrong answer.
  if (!answerWasWrong && verified !== null) {
    const tol = 1e-3 + Math.abs(verified) * 1e-6;
    if (allValuesIn(excerpt).some((v) => Math.abs(v - verified) <= tol))
      return true;
  }
  return false;
}

/**
 * RECONCILE raw LLM review spans against the DETERMINISTIC verifier — the
 * anti-jailbreak core. The LLM supplies localization + human `why` wording, but
 * it can NEVER fabricate correctness:
 *   • a "good" span that is actually a FALSE stated computation is FLIPPED to
 *     flawed with the corrected arithmetic;
 *   • a "good" span that isn't grounded (a coincidental number, an ungrounded
 *     claim on a wrong answer) is DROPPED;
 *   • "flawed" spans are kept (the LLM may flag flaws; it can't upgrade to
 *     correct), clamped to the text.
 * Pure and total — this is the tested grounding gate. Spans are clamped, sorted,
 * and de-overlapped (flawed wins), mirroring the deterministic annotator.
 */
export function reconcileReviewSpans(
  text: string,
  rawSpans: ReasoningSpan[],
  opts: {
    verifiedAnswer?: number | null;
    answerWasWrong?: boolean;
    mechanismSignals?: string[];
    /** The question prompt — enables stem-echo / circular discounting of greens. */
    prompt?: string;
  } = {},
): ReasoningSpan[] {
  const verified = opts.verifiedAnswer ?? null;
  const wrong = opts.answerWasWrong === true;
  const n = text.length;
  const out: ReasoningSpan[] = [];
  for (const s of rawSpans) {
    const rawStart = Math.max(0, Math.min(n, Math.floor(s.start)));
    const rawEnd = Math.max(0, Math.min(n, Math.floor(s.end)));
    if (rawEnd <= rawStart) continue;
    // Snap to WORD BOUNDARIES first so an LLM offset that landed mid-word (the
    // reported `n 3n^2` bleed) is corrected before we ground/label the excerpt.
    const snapped = snapSpanToWordBoundaries(text, {
      ...s,
      start: rawStart,
      end: rawEnd,
    });
    const start = snapped.start;
    const end = snapped.end;
    if (end <= start) continue;
    const excerpt = text.slice(start, end);
    let label = s.label;
    let why = (s.why ?? "").trim();
    if (label === "good") {
      const fa = findFalseArithmetic(excerpt);
      if (fa) {
        // The LLM greened a demonstrably false step → the verifier FLIPS it red.
        label = "flawed";
        why = `Incorrect step — you wrote \u201c${fa.claim.trim()}\u201d, but that works out to ${fmtNum(fa.correct)}, not ${fmtNum(fa.stated)}. Recompute this before building on it.`;
      } else if (
        isCircularJustification(excerpt) ||
        isStemRestatement(excerpt, opts.prompt)
      ) {
        // A circular ("because that is enough") or parroted-stem restatement
        // ("three terms … because it is quadratic") explains NOTHING — never let
        // the model green it, even on a correct answer.
        continue;
      } else if (
        !isGreenGrounded(excerpt, verified, wrong, opts.mechanismSignals) &&
        // Allow a FULL-CLAUSE explanation green on a CONFIRMED-correct answer even
        // when it holds no equation/number, provided it introduces genuine
        // mechanism content (not a bare keyword/echo) — so the load-bearing
        // reasoning clause is kept whole instead of shrunk away.
        !(
          opts.answerWasWrong === false &&
          hasNewMechanismContent(excerpt, opts.prompt, opts.mechanismSignals)
        )
      ) {
        // Ungrounded / coincidental green (e.g. the "2" in "(n+1)²") → DROP it.
        continue;
      }
    }
    if (why === "") {
      why =
        label === "good"
          ? "This step checks out."
          : "This step doesn't hold — recheck it.";
    }
    out.push({ start, end, excerpt, label, why });
  }
  // Sort + drop overlaps (flawed wins) so the UI renders disjoint runs.
  const ordered = out.sort((a, b) =>
    a.start !== b.start
      ? a.start - b.start
      : a.label === b.label
        ? a.end - b.end
        : a.label === "flawed"
          ? -1
          : 1,
  );
  const disjoint: ReasoningSpan[] = [];
  for (const s of ordered) {
    const clash = disjoint.find((k) => !(s.end <= k.start || s.start >= k.end));
    if (!clash) disjoint.push(s);
    else if (clash.label === "good" && s.label === "flawed")
      disjoint.splice(disjoint.indexOf(clash), 1, s);
  }
  return disjoint.sort((a, b) => a.start - b.start);
}

/**
 * Normalize a raw `mock-review-reasoning` payload into candidate spans + an
 * assessment. Tolerates missing/mistyped fields (drops junk spans) and never
 * throws. Correctness is NEVER read from the payload — only span geometry, a
 * label, and human `why` text; grounding happens in `reconcileReviewSpans`.
 */
export function normalizeReviewPayload(
  payload: Record<string, unknown> | null,
): { spans: ReasoningSpan[]; assessment: string } {
  const spans: ReasoningSpan[] = [];
  const raw = payload?.["spans"];
  if (Array.isArray(raw)) {
    for (const c of raw) {
      if (!c || typeof c !== "object") continue;
      const obj = c as Record<string, unknown>;
      const start = Number(obj["start"]);
      const end = Number(obj["end"]);
      const rawLabel = obj["label"];
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      // The server emits "flawed"; tolerate a raw model "bad" too.
      const label: ReasoningSpan["label"] | null =
        rawLabel === "good"
          ? "good"
          : rawLabel === "flawed" || rawLabel === "bad"
            ? "flawed"
            : null;
      if (label === null) continue;
      const why = typeof obj["why"] === "string" ? (obj["why"] as string) : "";
      spans.push({
        start,
        end,
        excerpt: typeof obj["excerpt"] === "string" ? (obj["excerpt"] as string) : "",
        label,
        why,
      });
    }
  }
  const assessment =
    typeof payload?.["assessment"] === "string"
      ? (payload["assessment"] as string)
      : "";
  return { spans, assessment };
}

/**
 * Verifier-computed facts handed to the `mock-review-reasoning` model so it is
 * GROUNDED: it may only critique the candidate's ACTUAL committed formula and
 * highlight the verifier-flagged earliest false claim, phrasing counterexamples
 * with these real numbers — never invent or evaluate an expression the candidate
 * did not write. `null` when the prompt is not a numeric sequence. See
 * `datasets/MOCK_AI_CONTRACT.md` Mode 1d.
 */
export interface VerifierFacts {
  /** The prompt's actual sequence terms, in order. */
  trueTerms: number[];
  /** The candidate's PARSED committed closed form (literal text), if any. */
  candidateFormula: string | null;
  /** The candidate formula's per-`n` values over the given terms, if parseable. */
  candidateValues: number[] | null;
  /** A concrete first-divergence counterexample for the candidate's OWN formula. */
  counterexample: string | null;
  /** The earliest FALSE per-`n` residual/pattern claim, if any. */
  earliestFalseClaim: string | null;
  /** Why that earliest false claim is false (verifier numbers). */
  earliestFalseClaimWhy: string | null;
}

/**
 * Compute the {@link VerifierFacts} for a sequence prompt (or `null` otherwise).
 * Pure: reuses the deterministic `reasoning.ts` parsers/checkers so the grounding
 * facts are exactly what the offline annotator uses — no duplicate logic.
 */
export function buildVerifierFacts(
  prompt: string,
  reasoning: string,
): VerifierFacts | null {
  const trueTerms = parseSequenceTerms(prompt ?? "");
  if (trueTerms.length < 3) return null;
  const cf = parseCommittedClosedForm(reasoning ?? "");
  const counter = checkCommittedFormula(reasoning ?? "", prompt ?? "");
  const residual = findFalseResidualClaim(reasoning ?? "", prompt ?? "");
  // The candidate formula's per-`n` values over the given terms (1-indexed), so
  // the model can SEE where the candidate's OWN formula diverges — never a
  // re-read expression. `null` when any point isn't evaluable.
  let candidateValues: number[] | null = null;
  if (cf) {
    const vals: number[] = [];
    let ok = true;
    for (let i = 0; i < trueTerms.length; i++) {
      const v = evalInN(cf.claim, i + 1);
      if (v === null) {
        ok = false;
        break;
      }
      vals.push(v);
    }
    candidateValues = ok ? vals : null;
  }
  return {
    trueTerms,
    candidateFormula: cf ? cf.claim : null,
    candidateValues,
    counterexample: counter ? counter.counterexample : null,
    earliestFalseClaim: residual ? residual.claim : null,
    earliestFalseClaimWhy: residual ? residual.why : null,
  };
}

/**
 * Run a REAL LLM reasoning REVIEW (`mock-review-reasoning`) that returns
 * verifier-GROUNDED good/bad spans with specific human feedback plus an overall
 * assessment. The deterministic verifier stays AUTHORITATIVE: every LLM span is
 * reconciled against deterministic checks (`reconcileReviewSpans`), so a
 * hallucinated "green" on a wrong answer is dropped/flipped and the review can
 * NEVER upgrade a wrong committed answer to correct. On the AI layer being off /
 * stubbed / unreachable, or an unusable reply, it falls back to the DETERMINISTIC
 * annotator — the offline floor — so the highlight path is identical either way.
 */
export async function reviewReasoning(
  input: ReasoningInput,
  ctx: ReviewContext = {},
): Promise<ReasoningReview> {
  const verifiedAnswer =
    ctx.verifiedAnswer ?? parseNumericValue(input.correctAnswer);
  const mechanismSignals = ctx.mechanismSignals ?? input.mechanismSignals;
  const floor = (): ReasoningReview => ({
    spans: annotateReasoning(input.reasoning ?? "", {
      verifiedAnswer,
      mechanismSignals,
      prompt: input.prompt,
      answerWasWrong: ctx.answerWasWrong,
    }),
    assessment: "",
    source: "deterministic",
  });

  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg || cfg.stub) return floor();

  const payload = await postAi(
    cfg,
    e,
    {
      mode: "mock-review-reasoning",
      prompt: input.prompt,
      correctAnswer: input.correctAnswer,
      verifiedAnswer,
      canonicalDerivation: ctx.canonicalDerivation ?? null,
      closedForm: ctx.closedForm ?? null,
      keyShortcut: ctx.keyShortcut ?? null,
      reasoning: input.reasoning,
      concept: ctx.concept ?? null,
      mechanismSignals: mechanismSignals ?? [],
      // VERIFIER-COMPUTED FACTS (sequence family): ground the model so it can
      // ONLY critique the candidate's ACTUAL committed formula and highlight the
      // verifier-flagged earliest false claim — never a mis-read substring or an
      // expression the candidate never wrote. Empty/absent for non-sequences.
      verifierFacts: buildVerifierFacts(input.prompt, input.reasoning ?? ""),
    },
    ctx.signal,
  );
  if (!payload) return floor();

  const { spans: rawSpans, assessment } = normalizeReviewPayload(payload);
  const grounded = reconcileReviewSpans(input.reasoning ?? "", rawSpans, {
    verifiedAnswer,
    answerWasWrong: ctx.answerWasWrong,
    prompt: input.prompt,
    // Ground GREEN mechanism spans only on signals that don't merely ECHO the
    // stem of an explanation-required ("why") prompt — so the LLM can't green a
    // parroted stem phrase ("three terms") as a named mechanism.
    mechanismSignals: creditableMechanismSignals(
      mechanismSignals ?? [],
      input.prompt,
    ),
  });
  // Nothing usable survived grounding → keep the deterministic floor.
  if (grounded.length === 0) return floor();
  return { spans: grounded, assessment, source: "ai" };
}

/**
 * Generate the adaptive adversarial follow-up. On AI failure (or an empty
 * `question`) returns the deterministic `authored` follow-up so the flow always
 * has a real, gradable question.
 */
export async function generateFollowup(
  args: {
    prompt: string;
    correctAnswer: string;
    reasoning?: string;
    concept?: string;
    difficulty?: "harder" | "variation" | "break-logic";
    authored: FollowupPresentation;
  },
  signal?: AbortSignal,
): Promise<FollowupPresentation> {
  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg || cfg.stub) return args.authored;

  const payload = await postAi(
    cfg,
    e,
    {
      mode: "mock-followup",
      prompt: args.prompt,
      correctAnswer: args.correctAnswer,
      reasoning: args.reasoning ?? "",
      concept: args.concept ?? null,
      difficulty: args.difficulty ?? "harder",
    },
    signal,
  );
  // buildAiFollowup falls back to `authored` when the payload lacks a question.
  return buildAiFollowup(args.authored, payload);
}

/**
 * Get the final diagnosis. The CLIENT computes every number in `perf`; the LLM
 * only turns them into prose. Falls back to the deterministic diagnosis on any
 * failure, and any missing field is filled with the contract's safe default.
 */
export async function getDiagnosis(
  perf: MockPerformance,
  signal?: AbortSignal,
): Promise<MockDiagnosis> {
  const fallback = deterministicDiagnosis(perf);

  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg || cfg.stub) return fallback;

  const payload = await postAi(
    cfg,
    e,
    { mode: "mock-diagnosis", summary: perf },
    signal,
  );
  if (!payload) return fallback;

  // Floor to the deterministic diagnosis FIELD-BY-FIELD: a partial/verdict-only
  // AI reply (empty strengths/weaknesses/next-steps) is completed from the
  // deterministic floor so the candidate always gets a complete report.
  const parsed = normalizeDiagnosisPayload(payload);
  return floorDiagnosis(parsed, fallback);
}
