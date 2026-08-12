/**
 * mock/reasoningEval.ts — the ADVERSARIAL EVALUATION HARNESS for the claims-based
 * (extract-and-verify) MAIN reasoning-quality grader.
 *
 * There is no labeled human dataset, so this harness AUTO-GENERATES many labeled
 * derivations for every question archetype in the interview bank and measures the
 * extract-and-verify grader on them:
 *   • POSITIVES — correct derivations in MULTIPLE valid framings / paraphrases
 *     (e.g. sequences: first-difference ≡ second-difference ≡ closed-form), plus
 *     wordings OUTSIDE the literal mechanism-signal bank (to prove generality).
 *   • NEGATIVES — flawed derivations: false arithmetic, a missing load-bearing
 *     (mechanism) claim, a wrong-family mechanism, right-answer-no-reasoning, a
 *     contradictory/hedged conclusion, and a wrong final answer.
 *
 * It reports RECALL (correct reasoning accepted as `sound`), FLAW-REJECTION
 * (flawed reasoning NOT accepted), and the false-negative / false-positive rates
 * per archetype.
 *
 * MOCKABLE EXTRACTION: the harness takes the claim EXTRACTOR as a parameter. The
 * committed unit test injects a DETERMINISTIC `mockLlmExtractor` (a faithful
 * text→claims translator that never sees the answer and never judges), so the
 * test is fully deterministic and exercises the DETERMINISTIC VERIFICATION LOGIC
 * exactly — the LLM-dependent part is stubbed. Pure: no network, DOM, or storage.
 */
import { Rng } from "@/lib/rng";
import {
  _pools,
  attachRequiredReasoning,
  drawArchetype,
  type ArchetypeId,
  type MockNumericQuestion,
} from "./questionPools";
import { matchesMechanismSignal, type ReasoningInput } from "./reasoning";
import { annotateReasoning, type ReasoningSpan } from "./annotate";
import { reconcileReviewSpans } from "./aiMock";
import {
  gradeConclusion,
  type ConclusionSpec,
  type ConclusionVerdict,
} from "./conclusion";
import {
  buildAiFollowup,
  buildFollowupPresentations,
  gradeReasoningConclusion,
} from "./followups";
import type { FollowupPresentation } from "./types";
import {
  extractClaimsDeterministic,
  gradeReasoningFromClaims,
  type ClaimSet,
} from "./claims";
import { RUBRICS, rubricForId, rubricSignals, type ArchetypeRubric } from "./rubrics";

/* -------------------------------------------------------------------------- */
/*  Mock LLM extractor (deterministic faithful translator)                     */
/* -------------------------------------------------------------------------- */

/** A claim EXTRACTOR: free text (+ context) → structured claims. */
export type ClaimExtractor = (input: ReasoningInput) => ClaimSet;

/**
 * A UNIVERSAL mechanism vocabulary spanning EVERY rubric family. Each entry maps
 * a set of phrasings (literal class phrases AND their arbitrary-wording
 * paraphrases) to a CANONICAL mechanism tag (the first literal phrase of the
 * class). This is what a good LLM does: normalize any wording onto a canonical
 * method description. Built once from the rubric registry.
 */
const MECH_VOCAB: { canonical: string; phrases: string[] }[] = RUBRICS.flatMap(
  (r) =>
    r.mechanismClasses.map((cls, i) => ({
      canonical: cls[0],
      phrases: [...cls, ...((r.paraphrases?.[i] ?? []) as string[])],
    })),
);

/**
 * A DETERMINISTIC stand-in for the LLM claim extractor. It TRANSLATES only — it
 * never sees the correct answer and never decides correctness:
 *   • arithmetic + stated result / final-answer claims come from the shared
 *     deterministic extractor (regex over `=` chains + result values);
 *   • a mechanism claim is emitted for each universal-vocabulary phrase the text
 *     contains, tagged with that method's CANONICAL name (so arbitrary wording is
 *     normalized, and a WRONG-family phrase yields a wrong-family tag that the
 *     deterministic verifier will reject for this question).
 * `source` is `"ai"` so the verifier runs its reconcile (generalization) path.
 */
export function mockLlmExtractor(input: ReasoningInput): ClaimSet {
  const base = extractClaimsDeterministic(input.reasoning, {});
  const claims = base.claims.filter((c) => c.kind !== "mechanism");
  for (const v of MECH_VOCAB) {
    if (
      matchesMechanismSignal(input.reasoning, v.phrases) &&
      !claims.some((c) => c.kind === "mechanism" && c.mechanism === v.canonical)
    ) {
      claims.push({ kind: "mechanism", text: v.canonical, mechanism: v.canonical });
    }
  }
  return { claims, source: "ai" };
}

/* -------------------------------------------------------------------------- */
/*  Labeled-derivation generation                                              */
/* -------------------------------------------------------------------------- */

export type DerivationLabel = "positive" | "negative";

export interface LabeledDerivation {
  /** Archetype bucket (id prefix, e.g. "seqn-poly-demo"). */
  archetype: string;
  label: DerivationLabel;
  /** Sub-category, e.g. "canonical", "paraphrase", "false-arith". */
  category: string;
  /** True for the CANONICAL positive of a question (must never be a false neg). */
  canonical: boolean;
  reasoning: string;
  input: ReasoningInput;
}

const fmt = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));

/** A wrong final value far outside the grader's tolerance for this answer. */
const wrongValue = (answer: number): number => answer * 3 + 13;

/**
 * A canonical mechanism phrase that the TARGET question does NOT accept (a
 * genuinely wrong-family method). Guarantees the phrase is outside the target's
 * signals AND rubric so the "wrong-mechanism" negative is truly wrong (related
 * quadratic families, say, share "first difference", so a naive pick can leak).
 */
function foreignMechanismPhrase(
  rubric: ArchetypeRubric,
  targetSignals: string[] | undefined,
): string {
  const accepted = [...(targetSignals ?? []), ...rubricSignals(rubric)];
  for (const r of RUBRICS) {
    for (const cls of r.mechanismClasses) {
      const phrase = cls[0];
      if (!matchesMechanismSignal(phrase, accepted)) return phrase;
    }
  }
  return "law of total probability";
}

/** Build the `ReasoningInput` for a candidate derivation on a question. */
function makeInput(
  q: MockNumericQuestion,
  reasoning: string,
  correct: boolean,
): ReasoningInput {
  return {
    prompt: q.prompt,
    correctAnswer: fmt(q.answer),
    correct,
    reasoning,
    isMentalMath: false,
    mechanismSignals: q.requiredReasoning?.mechanismSignals,
    bannedAsSoleJustification: q.requiredReasoning?.bannedAsSoleJustification,
  };
}

/**
 * Generate the full labeled derivation set for ONE attached question, driven by
 * its rubric. Positives span every mechanism-class framing (literal + paraphrase)
 * so the equivalence classes are exercised; negatives cover the flaw taxonomy.
 */
export function derivationsForQuestion(
  q: MockNumericQuestion,
): LabeledDerivation[] {
  const rubric = rubricForId(q.id);
  if (!rubric) return [];
  const bucket = rubric.idPrefix;
  const gated = (q.requiredReasoning?.mechanismSignals ?? []).length > 0;
  const ans = q.answer;
  const out: LabeledDerivation[] = [];

  const pos = (category: string, canonical: boolean, reasoning: string) =>
    out.push({
      archetype: bucket,
      label: "positive",
      category,
      canonical,
      reasoning,
      input: makeInput(q, reasoning, true),
    });
  const neg = (category: string, reasoning: string, correct: boolean) =>
    out.push({
      archetype: bucket,
      label: "negative",
      category,
      canonical: false,
      reasoning,
      input: makeInput(q, reasoning, correct),
    });

  // --- POSITIVES: one per mechanism-class framing (literal + paraphrase) -----
  rubric.mechanismClasses.forEach((cls, i) => {
    const literal = cls[0];
    // Canonical literal-signal framing (the first class is the CANONICAL one).
    pos(
      i === 0 ? "canonical" : "literal-framing",
      i === 0,
      `Using the ${literal}: it works out, so the answer is ${fmt(ans)}.`,
    );
    // Paraphrase framing — wording OUTSIDE the literal signal bank (generality).
    const para = rubric.paraphrases?.[i]?.[0];
    if (para) {
      pos(
        "paraphrase",
        false,
        `${cap(para)}, and carrying that through gives ${fmt(ans)}.`,
      );
    }
  });
  // A positive that shows real (true) arithmetic reaching the answer.
  pos(
    "arithmetic",
    false,
    `${cap(rubric.mechanismClasses[0][0])}; ${fmt(ans)} = ${fmt(ans)}. So it's ${fmt(ans)}.`,
  );

  // --- NEGATIVES -------------------------------------------------------------
  // Right answer, NO reasoning (bare number).
  neg("no-reasoning", `${fmt(ans)}`, true);
  // Right answer but a demonstrably FALSE arithmetic step (must be `flawed`).
  neg(
    "false-arith",
    `${cap(rubric.mechanismClasses[0][0])}; also 10 - 3 = 8, so the answer is ${fmt(ans)}.`,
    true,
  );
  // Contradictory / hedged conclusion (must route to ambiguous, never sound).
  neg(
    "contradictory",
    `It might be ${fmt(ans)}, but maybe it's ${fmt(ans + 5)} — I'm not sure which.`,
    true,
  );
  // Wrong final answer with a valid-sounding mechanism (must not be sound).
  neg(
    "wrong-answer",
    `Using the ${rubric.mechanismClasses[0][0]}, the answer is ${fmt(wrongValue(ans))}.`,
    false,
  );

  if (gated) {
    // Missing load-bearing (mechanism) claim: arithmetic + answer, no method.
    neg(
      "missing-mechanism",
      `I worked it out and it comes to ${fmt(ans)} = ${fmt(ans)}. The answer is ${fmt(ans)}.`,
      true,
    );
    // WRONG-family mechanism (a true-sounding method that doesn't apply here).
    neg(
      "wrong-mechanism",
      `By ${foreignMechanismPhrase(rubric, q.requiredReasoning?.mechanismSignals)}, the answer is ${fmt(ans)}.`,
      true,
    );
  }

  return out;
}

function cap(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/* -------------------------------------------------------------------------- */
/*  Corpus assembly across the whole question bank                             */
/* -------------------------------------------------------------------------- */

type Gen = (rng: Rng) => MockNumericQuestion;

/** Every non-mental-math generator plus the pinned firm archetypes. */
const ALL_GENS: Gen[] = [
  ..._pools.PROB_EV_MEDIUM,
  ..._pools.PROB_EV_HARD,
  ..._pools.PROB_EV_STRETCH,
  ..._pools.ESTIMATION_POOL,
  ..._pools.SEQUENCE_MEDIUM,
  ..._pools.SEQUENCE_HARD,
];
const ARCHETYPES: ArchetypeId[] = [
  "lattice-paths",
  "bank-or-roll",
  "sig-confidence-bet",
  "monty-hold-firm",
  "citadel-bet",
  "optiver-quadratic-demo",
];

/** Build the full labeled corpus over many seeded question instances. */
export function buildCorpus(seeds: number[]): LabeledDerivation[] {
  const out: LabeledDerivation[] = [];
  const push = (q: MockNumericQuestion) =>
    out.push(...derivationsForQuestion(attachRequiredReasoning(q)));
  for (const g of ALL_GENS) for (const s of seeds) push(g(new Rng(s)));
  for (const id of ARCHETYPES) for (const s of seeds) push(drawArchetype(new Rng(s), id));
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Running the grader + metrics                                               */
/* -------------------------------------------------------------------------- */

export interface ArchetypeMetrics {
  archetype: string;
  positives: number;
  positivesAccepted: number;
  negatives: number;
  negativesRejected: number;
  /** Canonical positives wrongly rejected (must be 0). */
  canonicalFalseNegatives: number;
  /** Example false negatives / false positives (capped, for debugging). */
  falseNegatives: string[];
  falsePositives: string[];
}

export interface EvalReport {
  perArchetype: ArchetypeMetrics[];
  totals: {
    positives: number;
    positivesAccepted: number;
    negatives: number;
    negativesRejected: number;
    canonicalFalseNegatives: number;
    recall: number;
    flawRejection: number;
    falseNegativeRate: number;
    falsePositiveRate: number;
  };
}

/**
 * Run the extract-and-verify grader over a labeled corpus with the given claim
 * extractor and compute per-archetype + total metrics. A derivation is ACCEPTED
 * iff the grader's verdict is `sound`.
 */
export function runReasoningEval(
  corpus: LabeledDerivation[],
  extract: ClaimExtractor,
): EvalReport {
  const byArch = new Map<string, ArchetypeMetrics>();
  const metricFor = (a: string): ArchetypeMetrics => {
    let m = byArch.get(a);
    if (!m) {
      m = {
        archetype: a,
        positives: 0,
        positivesAccepted: 0,
        negatives: 0,
        negativesRejected: 0,
        canonicalFalseNegatives: 0,
        falseNegatives: [],
        falsePositives: [],
      };
      byArch.set(a, m);
    }
    return m;
  };

  for (const d of corpus) {
    const claims = extract(d.input);
    const grade = gradeReasoningFromClaims(d.input, claims, rubricForId(d.archetype));
    const accepted = grade.quality === "sound";
    const m = metricFor(d.archetype);
    if (d.label === "positive") {
      m.positives++;
      if (accepted) m.positivesAccepted++;
      else {
        if (d.canonical) m.canonicalFalseNegatives++;
        if (m.falseNegatives.length < 5)
          m.falseNegatives.push(`[${d.category}] ${d.reasoning}`);
      }
    } else {
      m.negatives++;
      if (!accepted) m.negativesRejected++;
      else if (m.falsePositives.length < 5)
        m.falsePositives.push(`[${d.category}] ${d.reasoning}`);
    }
  }

  const perArchetype = [...byArch.values()].sort((a, b) =>
    a.archetype.localeCompare(b.archetype),
  );
  const t = perArchetype.reduce(
    (acc, m) => {
      acc.positives += m.positives;
      acc.positivesAccepted += m.positivesAccepted;
      acc.negatives += m.negatives;
      acc.negativesRejected += m.negativesRejected;
      acc.canonicalFalseNegatives += m.canonicalFalseNegatives;
      return acc;
    },
    {
      positives: 0,
      positivesAccepted: 0,
      negatives: 0,
      negativesRejected: 0,
      canonicalFalseNegatives: 0,
    },
  );
  const recall = t.positives > 0 ? t.positivesAccepted / t.positives : 1;
  const flawRejection = t.negatives > 0 ? t.negativesRejected / t.negatives : 1;
  return {
    perArchetype,
    totals: {
      ...t,
      recall,
      flawRejection,
      falseNegativeRate: 1 - recall,
      falsePositiveRate: 1 - flawRejection,
    },
  };
}

/** Render an `EvalReport` as a Markdown metrics summary (checked-in artifact). */
export function renderReportMarkdown(report: EvalReport, note?: string): string {
  const pctS = (n: number) => `${(n * 100).toFixed(1)}%`;
  const rows = report.perArchetype
    .map((m) => {
      const recall = m.positives > 0 ? m.positivesAccepted / m.positives : 1;
      const flaw = m.negatives > 0 ? m.negativesRejected / m.negatives : 1;
      return `| \`${m.archetype}\` | ${m.positivesAccepted}/${m.positives} (${pctS(recall)}) | ${m.negativesRejected}/${m.negatives} (${pctS(flaw)}) | ${m.canonicalFalseNegatives} |`;
    })
    .join("\n");
  const t = report.totals;
  return [
    "# Reasoning grader — extract-and-verify evaluation metrics",
    "",
    note ?? "",
    "",
    "Auto-generated by the adversarial harness (`src/lib/mock/reasoningEval.ts`),",
    "run over the whole interview question bank with a DETERMINISTIC mock LLM",
    "claim extractor (so the numbers are reproducible). Reproduce with:",
    "",
    "```bash",
    "npx vitest run src/lib/mock/reasoningEval.test.ts",
    "```",
    "",
    "- **Recall** = correct derivations (across valid framings/paraphrases) graded `sound`.",
    "- **Flaw-rejection** = flawed derivations (false arithmetic, missing/wrong mechanism,",
    "  right-answer-no-reasoning, contradictory, wrong answer) NOT graded `sound`.",
    "- **Canonical FN** = canonical correct answer wrongly rejected (must be 0).",
    "",
    "| Archetype | Recall | Flaw-rejection | Canonical FN |",
    "|---|---|---|---|",
    rows,
    `| **TOTAL** | **${t.positivesAccepted}/${t.positives} (${pctS(t.recall)})** | **${t.negativesRejected}/${t.negatives} (${pctS(t.flawRejection)})** | **${t.canonicalFalseNegatives}** |`,
    "",
    `False-negative rate: **${pctS(t.falseNegativeRate)}**  ·  False-positive rate: **${pctS(t.falsePositiveRate)}**`,
    "",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Localization evaluation — does the annotator pick the RIGHT flawed span?    */
/* -------------------------------------------------------------------------- */

/**
 * A labeled FLAWED derivation with a KNOWN root-cause span. Beyond "is the
 * reasoning rejected?" (the recall / flaw-rejection harness above), this
 * measures whether the annotator LOCALIZES the mistake: does it flag a red span
 * that COVERS the labeled root-cause substring, and is the explanation (`why`)
 * about the RIGHT misconception? These are the exact failure the review must fix
 * — telling the user to "locate the broken step" is not acceptable.
 */
export interface LocalizationCase {
  archetype: string;
  /** Human label of the misconception kind (for the report). */
  kind: string;
  prompt: string;
  reasoning: string;
  verifiedAnswer: number;
  /** The exact substring that IS the root cause — the red span must cover it. */
  rootCause: string;
  /** The produced `why` for the covering span must match this (correct reason). */
  whyPattern: RegExp;
}

/** A correct derivation used as a CONTROL: it must get NO false red span. */
export interface LocalizationControl {
  archetype: string;
  prompt: string;
  reasoning: string;
  verifiedAnswer: number;
}

/**
 * The labeled localization corpus: one flawed derivation per key misconception
 * archetype WITH its root-cause span, plus a correct control per family (which
 * must never be reddened). The dice-max case is the exact reported repro.
 */
export const LOCALIZATION_CASES: LocalizationCase[] = [
  {
    archetype: "pev-max2dice",
    kind: "sequential-order-abuse",
    prompt:
      "Two fair six-sided dice are rolled. What is the expected value of the LARGER of the two (the maximum)?",
    reasoning:
      "There is a 50% chance that one die is 3 or less. This means the larger is just the EV of the next die, which is 3.5. The other 50% chance is that the die rolls 4, 5, or 6 which averages to 5 so the answer is 0.5(3.5) + 0.5(5) = 4.25.",
    verifiedAnswer: 4.4722,
    rootCause: "There is a 50% chance that one die is 3 or less",
    whyPattern: /sequential|first die|next die|jointly|ordering|both dice/i,
  },
  {
    archetype: "pev-urn",
    kind: "independence-abuse",
    prompt:
      "An urn has 5 red and 3 blue balls. Two are drawn WITHOUT replacement. What is P(both red)?",
    reasoning:
      "The draws are independent, so P(both red) = p × p = (5/8)(5/8) = 25/64.",
    verifiedAnswer: 0.3571,
    rootCause: "The draws are independent",
    whyPattern: /independent|dependent|without replacement/i,
  },
  {
    archetype: "pev-monty",
    kind: "false-5050",
    prompt:
      "Monty Hall: 3 doors, you pick one, the host opens a losing door and offers a switch. What is your probability of winning if you SWITCH?",
    reasoning:
      "After the host opens a door, two doors remain, so it's 50/50 and switching doesn't matter. The answer is 0.5.",
    verifiedAnswer: 0.6667,
    rootCause: "it's 50/50 and switching doesn't matter",
    whyPattern: /informed|50\/50|equally likely|reveal|coin-?flip/i,
  },
  {
    // The reported "the sequence is just n²" opener — an oversimplified pattern.
    archetype: "seqn-quadratic",
    kind: "oversimplified-pattern",
    prompt: "The sequence begins 5, 11, 23, 41, 65, … What is the next term?",
    reasoning:
      "The sequence is just n\u00b2, so the next term is 6\u00b2 = 36.",
    verifiedAnswer: 95,
    rootCause: "The sequence is just n\u00b2",
    whyPattern: /pattern|terms|gaps|re-derive|n\u00b2/i,
  },
  {
    // NOVEL, non-hand-tuned case: the reported "(n+1)²" quadratic. The oversimplified
    // -pattern REGEX does NOT match "(n+1)^2"; localization comes GENERICALLY from
    // `findClosedFormMismatch` (evaluate the implied closed form vs the actual
    // terms). The verified answer 2 is `a`; the coincidental "2" must NOT be green.
    archetype: "seqn-quadratic-abc",
    kind: "mis-identified-closed-form",
    prompt:
      "The sequence 4, 9, 18, 31, 48 fits a quadratic a\u00b7n\u00b2 + b\u00b7n + c; find a, b, c.",
    reasoning:
      "The sequence is just (n+1)^2, so a, b, c are 1, 2, 1.",
    verifiedAnswer: 2,
    rootCause: "(n+1)^2",
    whyPattern: /closed form|gives|doesn\u2019t fit|does not fit|4, 9, 16, 25|pattern/i,
  },
  {
    // THE MOTIVATING BUG (real user case). The candidate's FINAL committed formula
    // was 3n^2 - n + 3 (answer 293), but the EARLIEST load-bearing error is the
    // residual claim "1 more at n=2": 3n^2 is 12 at n=2, the term is 11, so it's 1
    // LESS, not 1 more. The primary red must be that per-n claim (earlier and more
    // load-bearing than the final formula line), with a counterexample that quotes
    // the candidate's OWN 3n^2 and the verifier's real numbers — never a mis-read
    // 3n^3 cubic the candidate never wrote.
    archetype: "seqn-poly-residual",
    kind: "false-residual-claim",
    prompt:
      "A polynomial sequence goes 5, 11, 23, 41, 65, … Find the closed form and the 10th term.",
    reasoning:
      "The second difference is constant at 6, so a = 3 and the leading term is 3n^2. The actual value is 2 more than 3n^2 at n=1, 1 more at n=2, 0 more at n=3, so the extra part is 3 - n. That makes the closed form 3n^2 - n + 3, so the 10th term is 293.",
    verifiedAnswer: 275,
    rootCause: "1 more at n=2",
    whyPattern: /3n\^2|is 12|1 less|not 1 more/i,
  },
  {
    // VARIANT — OFF-BY-ONE ON 'a' (a should be 3, candidate used 2). No residual
    // phrasing, so localization comes from the COMMITTED formula: 2n^2 + 3 matches
    // the first two terms then diverges at n=3 (gives 21, the sequence is 23). The
    // counterexample cites the candidate's real formula, never a re-read one.
    archetype: "seqn-poly-offbya",
    kind: "committed-formula-mismatch",
    prompt:
      "A polynomial sequence goes 5, 11, 23, 41, 65, … Find the closed form and the 10th term.",
    reasoning:
      "The second difference here looks like 4, so I take a = 2, giving the closed form 2n^2 + 3, and the 10th term as 203.",
    verifiedAnswer: 275,
    rootCause: "2n^2 + 3",
    whyPattern: /gives|doesn\u2019t fit|does not fit|21|23/i,
  },
  {
    // VARIANT — WRONG SIGN on the linear coefficient (should be -3n, candidate
    // wrote +3n). The committed formula 3n^2 + 3n - 1 matches n=1 then diverges at
    // n=2 (gives 17, the sequence is 11).
    archetype: "seqn-poly-wrongsign",
    kind: "committed-formula-mismatch",
    prompt:
      "A polynomial sequence goes 5, 11, 23, 41, 65, … Find the closed form and the 10th term.",
    reasoning:
      "Second difference is 6 so a = 3. Fitting a quadratic I get the closed form 3n^2 + 3n - 1, so the 10th term is 329.",
    verifiedAnswer: 275,
    rootCause: "3n^2 + 3n - 1",
    whyPattern: /gives|doesn\u2019t fit|does not fit|17|11/i,
  },
];

/** Correct derivations that must produce NO false red (localization precision). */
export const LOCALIZATION_CONTROLS: LocalizationControl[] = [
  {
    archetype: "pev-max2dice",
    prompt:
      "Two fair six-sided dice are rolled. What is the expected value of the LARGER of the two (the maximum)?",
    reasoning:
      "By order statistics, P(max = m) = (2m − 1)/36, so E[max] = Σ m·(2m − 1)/36 = 161/36 ≈ 4.4722.",
    verifiedAnswer: 4.4722,
  },
  {
    archetype: "pev-urn",
    prompt:
      "An urn has 5 red and 3 blue balls. Two are drawn WITHOUT replacement. What is P(both red)?",
    reasoning:
      "Without replacement the second draw depends on the first, so P = (5/8)(4/7) = 20/56.",
    verifiedAnswer: 0.3571,
  },
  {
    archetype: "pev-monty",
    prompt:
      "Monty Hall: 3 doors, you pick one, the host opens a losing door and offers a switch. What is your probability of winning if you SWITCH?",
    reasoning:
      "The host's reveal is informed, so your original 1/3 door stays 1/3 and the other door holds the remaining 2/3. Switching wins 2/3 ≈ 0.6667.",
    verifiedAnswer: 0.6667,
  },
  {
    archetype: "seqn-quadratic",
    prompt: "The sequence begins 5, 11, 23, 41, 65, … What is the next term?",
    reasoning:
      "The first differences are 6, 12, 18, 24 — a constant second difference of 6 — so the next gap is 30 and 65 + 30 = 95.",
    verifiedAnswer: 95,
  },
  {
    // A CORRECT closed form for the (n+1)²-family prompt must NOT be reddened:
    // the detector only fires when the stated form doesn't reproduce the terms.
    archetype: "seqn-quadratic-abc",
    prompt:
      "The sequence 4, 9, 18, 31, 48 fits a quadratic a\u00b7n\u00b2 + b\u00b7n + c; find a, b, c.",
    reasoning:
      "Second differences are constant at 4, so a = 4/2 = 2; fitting the first terms gives b = -1 and c = 3, i.e. 2n\u00b2 - n + 3.",
    verifiedAnswer: 2,
  },
  {
    // The CORRECT derivation for the 10th-term prompt (residual phrasing used
    // CORRECTLY): every asserted residual holds and the committed 3n^2 - 3n + 5
    // reproduces the terms, so NOTHING is reddened.
    archetype: "seqn-poly-residual",
    prompt:
      "A polynomial sequence goes 5, 11, 23, 41, 65, … Find the closed form and the 10th term.",
    reasoning:
      "The leading term is 3n^2. The value is 2 more than 3n^2 at n=1, 1 less at n=2, 4 less at n=3, so the extra part is 5 - 3n, giving 3n^2 - 3n + 5; the 10th term is 300 - 30 + 5 = 275.",
    verifiedAnswer: 275,
  },
  {
    // A CORRECT committed formula must NOT be reddened by the committed-formula
    // checker (it only fires when the form doesn't reproduce the terms).
    archetype: "seqn-poly-offbya",
    prompt:
      "A polynomial sequence goes 5, 11, 23, 41, 65, … Find the closed form and the 10th term.",
    reasoning:
      "Second difference is a constant 6, so a = 3; fitting gives the closed form 3n^2 - 3n + 5, so the 10th term is 275.",
    verifiedAnswer: 275,
  },
];

export interface LocalizationCaseResult {
  archetype: string;
  kind: string;
  /** A red (flawed) span was produced at all. */
  flagged: boolean;
  /** A red span COVERS the labeled root-cause substring. */
  spanCorrect: boolean;
  /** A covering red span's `why` matches the expected misconception. */
  whyCorrect: boolean;
  /** The excerpt of the covering span (for the report / debugging). */
  span?: string;
}

export interface LocalizationMetrics {
  total: number;
  flagged: number;
  spanCorrect: number;
  whyCorrect: number;
  controls: number;
  controlsClean: number;
  perCase: LocalizationCaseResult[];
  /** True for any control that got a FALSE red (must be 0 for clean precision). */
  falseReds: string[];
}

/** The annotator under test: text (+ context) → spans. Mockable / injectable. */
export type Annotator = (
  text: string,
  opts: {
    prompt?: string;
    verifiedAnswer?: number | null;
    answerWasWrong?: boolean;
    mechanismSignals?: string[];
  },
) => ReasoningSpan[];

/** Does any flawed span in `spans` fully cover the substring at `[idx, idx+len)`? */
function coveringFlawedSpan(
  spans: ReasoningSpan[],
  idx: number,
  len: number,
): ReasoningSpan | null {
  if (idx < 0) return null;
  for (const s of spans) {
    if (s.label === "flawed" && s.start <= idx && idx + len <= s.end) return s;
  }
  return null;
}

/**
 * Measure LOCALIZATION quality of the annotator on the labeled corpus: for each
 * flawed case, whether a red span covers the root cause with a correct `why`;
 * for each control, whether it stays clean (no false red). The annotator is
 * injected (defaults to the real deterministic `annotateReasoning`) so the LLM
 * layer stays mockable while the deterministic verdict remains authoritative.
 */
export function runLocalizationEval(
  cases: LocalizationCase[] = LOCALIZATION_CASES,
  controls: LocalizationControl[] = LOCALIZATION_CONTROLS,
  annotate: Annotator = annotateReasoning,
): LocalizationMetrics {
  const perCase: LocalizationCaseResult[] = [];
  let flagged = 0;
  let spanCorrect = 0;
  let whyCorrect = 0;
  for (const c of cases) {
    const spans = annotate(c.reasoning, {
      prompt: c.prompt,
      verifiedAnswer: c.verifiedAnswer,
      answerWasWrong: true,
    });
    const anyFlaw = spans.some((s) => s.label === "flawed");
    const idx = c.reasoning.indexOf(c.rootCause);
    const cover = coveringFlawedSpan(spans, idx, c.rootCause.length);
    const whyOk = cover !== null && c.whyPattern.test(cover.why);
    if (anyFlaw) flagged++;
    if (cover) spanCorrect++;
    if (whyOk) whyCorrect++;
    perCase.push({
      archetype: c.archetype,
      kind: c.kind,
      flagged: anyFlaw,
      spanCorrect: cover !== null,
      whyCorrect: whyOk,
      span: cover?.excerpt,
    });
  }

  let controlsClean = 0;
  const falseReds: string[] = [];
  for (const ctrl of controls) {
    const spans = annotate(ctrl.reasoning, {
      prompt: ctrl.prompt,
      verifiedAnswer: ctrl.verifiedAnswer,
      answerWasWrong: false,
    });
    const red = spans.filter((s) => s.label === "flawed");
    if (red.length === 0) controlsClean++;
    else falseReds.push(`[${ctrl.archetype}] ${red.map((s) => s.excerpt).join(" | ")}`);
  }

  return {
    total: cases.length,
    flagged,
    spanCorrect,
    whyCorrect,
    controls: controls.length,
    controlsClean,
    perCase,
    falseReds,
  };
}

/** Render the localization metrics as a Markdown section (appended to the doc). */
export function renderLocalizationMarkdown(m: LocalizationMetrics): string {
  const pctS = (n: number, d: number) => `${d > 0 ? ((n / d) * 100).toFixed(1) : "100.0"}%`;
  const rows = m.perCase
    .map(
      (c) =>
        `| \`${c.archetype}\` | ${c.kind} | ${c.flagged ? "✓" : "✗"} | ${c.spanCorrect ? "✓" : "✗"} | ${c.whyCorrect ? "✓" : "✗"} |`,
    )
    .join("\n");
  return [
    "",
    "## Localization metrics — does the review CAPTURE the mistake?",
    "",
    "Beyond accept/reject, this measures whether the deterministic annotator",
    "(`src/lib/mock/annotate.ts` + `findPremiseFlaw`) LOCALIZES the root cause:",
    "flags a RED span that COVERS the labeled root-cause substring, with a `why`",
    "about the correct misconception — and never reddens a correct derivation.",
    "",
    "- **Flagged** = a red (flawed) span was produced.",
    "- **Span** = a red span COVERS the labeled root-cause substring.",
    "- **Why** = that span's explanation matches the expected misconception.",
    "",
    "| Archetype | Misconception | Flagged | Span | Why |",
    "|---|---|---|---|---|",
    rows,
    "",
    `**Localized (span correct): ${m.spanCorrect}/${m.total} (${pctS(m.spanCorrect, m.total)})** · ` +
      `**Why correct: ${m.whyCorrect}/${m.total} (${pctS(m.whyCorrect, m.total)})** · ` +
      `**Controls clean (no false red): ${m.controlsClean}/${m.controls} (${pctS(m.controlsClean, m.controls)})**`,
    "",
    m.falseReds.length > 0
      ? `False reds: ${m.falseReds.join("; ")}`
      : "No false reds on correct derivations.",
    "",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Granularity + feedback-specificity — tight spans, human content-referential */
/* -------------------------------------------------------------------------- */

/** Generic templated phrases that must NEVER appear in user-facing feedback. */
export const BANNED_FEEDBACK_PHRASES = [
  "load-bearing",
  "load bearing",
  "locate the broken step",
  "didn't commit to the right conclusion",
  "did not commit to the right conclusion",
  "revisit the key relationship",
];

/** Fraction of the text covered by the UNION of spans of a given label [0..1]. */
function labelCoverage(
  spans: ReasoningSpan[],
  label: "good" | "flawed",
  len: number,
): number {
  if (len <= 0) return 0;
  const ranges = spans
    .filter((s) => s.label === label)
    .map((s) => [s.start, s.end] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curEnd = -1;
  for (const [s, e] of ranges) {
    const start = Math.max(s, curEnd);
    if (e > start) total += e - start;
    if (e > curEnd) curEnd = e;
  }
  return total / len;
}

export interface GranularityMetrics {
  /** Worst (highest) GREEN coverage over the correct controls (want < 1). */
  maxGreenCoverageCorrect: number;
  /** Any correct control got a red span (must be false). */
  anyRedOnCorrect: boolean;
  /** Worst (highest) RED coverage over flawed cases with a specific misconception. */
  maxRedCoverageFlawed: number;
  /** Every flawed span's `why` quotes the candidate's own words. */
  allFeedbackReferencesContent: boolean;
  /** Any user-facing feedback string contained a banned generic phrase. */
  bannedPhraseHits: string[];
  /**
   * FALSE-GREEN on a coincidental number: a GOOD span on a WRONG derivation whose
   * value equals the verified answer (e.g. the "2" in "(n+1)²" when a = 2). MUST
   * be empty — a number is green ONLY when it's the committed correct conclusion.
   */
  coincidentalGreenHits: string[];
  perControl: { archetype: string; greenCoverage: number; redCount: number }[];
  perCase: { archetype: string; redCoverage: number; referencesContent: boolean }[];
}

/**
 * Measure HIGHLIGHT GRANULARITY and FEEDBACK SPECIFICITY of the annotator:
 *   • correct controls must NOT be a wall of green (coverage well under 100%) and
 *     get ZERO red;
 *   • flawed cases must red-highlight only the specific claim (a MINORITY of the
 *     text), never the whole blob;
 *   • every span `why` must QUOTE the candidate's own words (content-referential),
 *     and no feedback may contain a banned generic phrase.
 */
export function runGranularityEval(
  cases: LocalizationCase[] = LOCALIZATION_CASES,
  controls: LocalizationControl[] = LOCALIZATION_CONTROLS,
  annotate: Annotator = annotateReasoning,
): GranularityMetrics {
  const bannedPhraseHits: string[] = [];
  const checkBanned = (why: string) => {
    for (const p of BANNED_FEEDBACK_PHRASES) {
      if (why.toLowerCase().includes(p)) bannedPhraseHits.push(why);
    }
  };

  const perControl: GranularityMetrics["perControl"] = [];
  let maxGreenCoverageCorrect = 0;
  let anyRedOnCorrect = false;
  for (const ctrl of controls) {
    const spans = annotate(ctrl.reasoning, {
      prompt: ctrl.prompt,
      verifiedAnswer: ctrl.verifiedAnswer,
      answerWasWrong: false,
    });
    spans.forEach((s) => checkBanned(s.why));
    const green = labelCoverage(spans, "good", ctrl.reasoning.length);
    const redCount = spans.filter((s) => s.label === "flawed").length;
    if (green > maxGreenCoverageCorrect) maxGreenCoverageCorrect = green;
    if (redCount > 0) anyRedOnCorrect = true;
    perControl.push({ archetype: ctrl.archetype, greenCoverage: green, redCount });
  }

  const perCase: GranularityMetrics["perCase"] = [];
  const coincidentalGreenHits: string[] = [];
  let maxRedCoverageFlawed = 0;
  let allFeedbackReferencesContent = true;
  for (const c of cases) {
    const spans = annotate(c.reasoning, {
      prompt: c.prompt,
      verifiedAnswer: c.verifiedAnswer,
      answerWasWrong: true,
    });
    spans.forEach((s) => checkBanned(s.why));
    // FALSE-GREEN guard: on a WRONG derivation no GOOD span may carry a value
    // equal to the verified answer (that's the coincidental-token bug).
    const tol = 1e-3 + Math.abs(c.verifiedAnswer) * 1e-6;
    for (const s of spans) {
      if (s.label !== "good") continue;
      const nums = s.excerpt.match(/-?\d+(?:\.\d+)?/g) ?? [];
      if (nums.some((x) => Math.abs(Number(x) - c.verifiedAnswer) <= tol)) {
        coincidentalGreenHits.push(`[${c.archetype}] green "${s.excerpt}"`);
      }
    }
    const red = labelCoverage(spans, "flawed", c.reasoning.length);
    if (red > maxRedCoverageFlawed) maxRedCoverageFlawed = red;
    // The covering red span must QUOTE the candidate's own words: its `why`
    // contains its own excerpt (minus trailing punctuation).
    const idx = c.reasoning.indexOf(c.rootCause);
    const cover = coveringFlawedSpan(spans, idx, c.rootCause.length);
    const excerpt = (cover?.excerpt ?? "").trim().replace(/[.,;:]+$/, "");
    const references =
      cover !== null && excerpt.length > 0 && cover.why.includes(excerpt);
    if (!references) allFeedbackReferencesContent = false;
    perCase.push({ archetype: c.archetype, redCoverage: red, referencesContent: references });
  }

  return {
    maxGreenCoverageCorrect,
    anyRedOnCorrect,
    maxRedCoverageFlawed,
    allFeedbackReferencesContent,
    bannedPhraseHits,
    coincidentalGreenHits,
    perControl,
    perCase,
  };
}

/* -------------------------------------------------------------------------- */
/*  Strict confirm/clarify gate — second chance ONLY for mostly-right answers   */
/* -------------------------------------------------------------------------- */

/** One labeled gate case: an answer + spec with the EXPECTED strict verdict. */
export interface GateCase {
  label: string;
  raw: string;
  spec: ConclusionSpec;
  /** The verdict the STRICT gate must return. */
  expect: ConclusionVerdict;
}

/**
 * The strict-gate corpus. The clarify (second-chance) path may fire ONLY for a
 * mostly-right answer (genuine correct content + a small flaw/ambiguity); "I
 * don't know", a fully-wrong answer, a footingless hedge, and garbled input must
 * all be graded WRONG directly (no clarify).
 */
export const GATE_CASES: GateCase[] = [
  {
    label: "mostly-right, minor contradiction → clarify",
    raw: "It's different — but also kind of the same, honestly.",
    spec: { correctKeywords: [["different"]], wrongKeywords: [["the same"]] },
    expect: "clarify",
  },
  {
    label: "correct side, missing mechanism → clarify",
    raw: "Pass, I'd decline the bet.",
    spec: {
      correctKeywords: [["pass", "decline"]],
      mechanismSignals: ["ev", "negative", "expected value"],
    },
    expect: "clarify",
  },
  {
    label: "hedge WITH correct content → clarify",
    raw: "It's different, but honestly it could be either, not sure.",
    spec: { correctKeywords: [["different"]] },
    expect: "clarify",
  },
  {
    label: "'I don't know' → missed (no second chance)",
    raw: "I don't know.",
    spec: { correctKeywords: [["different"]] },
    expect: "missed",
  },
  {
    label: "fully-wrong committed answer → missed",
    raw: "It's exactly the same, unchanged.",
    spec: { correctKeywords: [["different"]], wrongKeywords: [["the same", "unchanged"]] },
    expect: "missed",
  },
  {
    label: "footingless hedge → missed",
    raw: "Could be either one, hard to say, not sure.",
    spec: { correctKeywords: [["different"]] },
    expect: "missed",
  },
  {
    label: "garbled → missed (not-understood)",
    raw: "zxcvbnm qwrtp hjkl sdfgh",
    spec: { correctValues: [0.5] },
    expect: "missed",
  },
];

export interface GateMetrics {
  total: number;
  correct: number;
  perCase: { label: string; expect: ConclusionVerdict; got: ConclusionVerdict; ok: boolean }[];
}

/** Measure how faithfully the strict confirm/clarify gate matches expectations. */
export function runGateEval(cases: GateCase[] = GATE_CASES): GateMetrics {
  let correct = 0;
  const perCase = cases.map((c) => {
    const got = gradeConclusion(c.raw, c.spec).verdict;
    const ok = got === c.expect;
    if (ok) correct++;
    return { label: c.label, expect: c.expect, got, ok };
  });
  return { total: cases.length, correct, perCase };
}

/* -------------------------------------------------------------------------- */
/*  LLM review GROUNDING — verifier overrides a hallucinated green (anti-jailbreak) */
/* -------------------------------------------------------------------------- */

/**
 * A mocked-LLM review case: the RAW spans a hallucinating reviewer might return
 * for a WRONG derivation, and what the verifier-grounded reconciliation MUST do.
 */
export interface ReviewGroundingCase {
  label: string;
  reasoning: string;
  verifiedAnswer: number;
  answerWasWrong: boolean;
  /** A substring the LLM wrongly greened; grounding MUST NOT leave it green. */
  hallucinatedGreen: string;
  /** A substring the LLM flagged bad; grounding MUST keep it flawed. */
  flawedClaim: string;
}

/**
 * The grounding corpus. Case 1 is the exact (n+1)² repro: the LLM greens the
 * coincidental "2" and flags "(n+1)^2" — the verifier drops the green and keeps
 * the flaw. Case 2 proves a FALSE-arithmetic green is FLIPPED to flawed.
 */
export const REVIEW_GROUNDING_CASES: ReviewGroundingCase[] = [
  {
    label: "(n+1)² — coincidental green '2' dropped, closed-form stays flawed",
    reasoning: "The sequence is just (n+1)^2, so a, b, c are 1, 2, 1.",
    verifiedAnswer: 2,
    answerWasWrong: true,
    hallucinatedGreen: "1, 2, 1",
    flawedClaim: "(n+1)^2",
  },
  {
    label: "false-arithmetic green is FLIPPED to flawed by the verifier",
    reasoning: "Adding them, 1 plus 1 = 3, so the total is 3.",
    verifiedAnswer: 2,
    answerWasWrong: true,
    hallucinatedGreen: "1 plus 1 = 3",
    flawedClaim: "1 plus 1 = 3",
  },
];

export interface ReviewGroundingMetrics {
  total: number;
  grounded: number;
  perCase: {
    label: string;
    greenDropped: boolean;
    flawKept: boolean;
    ok: boolean;
  }[];
}

/**
 * Feed hallucinated LLM spans through `reconcileReviewSpans` (the deterministic
 * grounding gate) and verify: (a) the coincidental / false green is dropped or
 * flipped (never left green), and (b) the genuine flaw stays flawed. This proves
 * the verifier OVERRIDES a hallucinated green on a wrong answer — the LLM can
 * never upgrade a wrong committed answer to correct.
 */
export function runReviewGroundingEval(
  cases: ReviewGroundingCase[] = REVIEW_GROUNDING_CASES,
): ReviewGroundingMetrics {
  let grounded = 0;
  const perCase = cases.map((c) => {
    const gi = c.reasoning.indexOf(c.hallucinatedGreen);
    const fi = c.reasoning.indexOf(c.flawedClaim);
    const llmSpans: ReasoningSpan[] = [];
    if (gi >= 0)
      llmSpans.push({
        start: gi,
        end: gi + c.hallucinatedGreen.length,
        excerpt: c.hallucinatedGreen,
        label: "good",
        why: "You correctly landed the answer here.", // hallucinated praise
      });
    if (fi >= 0)
      llmSpans.push({
        start: fi,
        end: fi + c.flawedClaim.length,
        excerpt: c.flawedClaim,
        label: "flawed",
        why: "This pattern doesn't match the terms.",
      });
    const reconciled = reconcileReviewSpans(c.reasoning, llmSpans, {
      verifiedAnswer: c.verifiedAnswer,
      answerWasWrong: c.answerWasWrong,
    });
    const covers = (s: ReasoningSpan, idx: number, len: number) =>
      s.start <= idx && idx + len <= s.end;
    const greenDropped = !reconciled.some(
      (s) => s.label === "good" && covers(s, gi, c.hallucinatedGreen.length),
    );
    const flawKept = reconciled.some(
      (s) => s.label === "flawed" && covers(s, fi, c.flawedClaim.length),
    );
    const ok = greenDropped && flawKept;
    if (ok) grounded++;
    return { label: c.label, greenDropped, flawKept, ok };
  });
  return { total: cases.length, grounded, perCase };
}

/** Render the granularity + gate metrics as a Markdown section. */
export function renderQualityMarkdown(
  gran: GranularityMetrics,
  gate: GateMetrics,
  review?: ReviewGroundingMetrics,
): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const gateRows = gate.perCase
    .map((c) => `| ${c.label} | \`${c.expect}\` | \`${c.got}\` | ${c.ok ? "✓" : "✗"} |`)
    .join("\n");
  return [
    "",
    "## Granularity + feedback specificity — tight, human highlights",
    "",
    "The annotator emits TIGHT, minimal, disjoint spans (not blanket color) and",
    "every `why` QUOTES the candidate's own words — never a generic template.",
    "",
    `- **Max green coverage on a CORRECT answer:** ${pct(gran.maxGreenCoverageCorrect)} ` +
      "(a correct answer is never a wall of green; only the key steps are green).",
    `- **Red on a correct answer:** ${gran.anyRedOnCorrect ? "SOME (bug!)" : "none"}.`,
    `- **Max red coverage on a FLAWED answer:** ${pct(gran.maxRedCoverageFlawed)} ` +
      "(only the specific flawed claim is red, not the whole blob).",
    `- **Feedback references the candidate's own words:** ${gran.allFeedbackReferencesContent ? "always" : "NOT always (bug!)"}.`,
    `- **Banned generic phrases in feedback:** ${gran.bannedPhraseHits.length === 0 ? "none" : gran.bannedPhraseHits.length}.`,
    `- **False-greens on coincidental numbers (wrong answers):** ${gran.coincidentalGreenHits.length === 0 ? "none" : gran.coincidentalGreenHits.join("; ")}.`,
    "",
    ...(review
      ? [
          "## LLM review grounding — the verifier overrides a hallucinated green",
          "",
          "The real LLM review (`mock-review-reasoning`) only LOCALIZES + explains;",
          "every span is reconciled against deterministic checks. A hallucinated",
          "green on a WRONG answer (e.g. the coincidental \u201c2\u201d in \u201c(n+1)\u00b2\u201d) is",
          "dropped, and a false-arithmetic green is flipped to flawed \u2014 the review",
          "can never upgrade a wrong committed answer to correct.",
          "",
          "| Case | Green dropped/flipped | Flaw kept | OK |",
          "|---|---|---|---|",
          ...review.perCase.map(
            (c) =>
              `| ${c.label} | ${c.greenDropped ? "\u2713" : "\u2717"} | ${c.flawKept ? "\u2713" : "\u2717"} | ${c.ok ? "\u2713" : "\u2717"} |`,
          ),
          "",
          `**Review grounding: ${review.grounded}/${review.total} (${pct(review.total > 0 ? review.grounded / review.total : 1)})**`,
          "",
        ]
      : []),
    "## Strict confirm/clarify gate — second chance only when mostly-right",
    "",
    "Clarify (the second chance) fires ONLY when there is genuine correct,",
    "load-carrying content and just a small part is wrong/ambiguous. Everything",
    "else — fully wrong, footingless hedge, \"I don't know\", garbled — is graded",
    "WRONG directly.",
    "",
    "| Case | Expected | Got | OK |",
    "|---|---|---|---|",
    gateRows,
    "",
    `**Gate correctness: ${gate.correct}/${gate.total} (${pct(gate.total > 0 ? gate.correct / gate.total : 1)})**`,
    "",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  ADVERSARIAL REASONING-TYPE FOLLOW-UPS — routed through the SAME pipeline    */
/* -------------------------------------------------------------------------- */

/**
 * A reasoning-type ADVERSARIAL follow-up case built through the REAL AI-follow-up
 * classifier (`buildAiFollowup`): the interviewer question + note become a graded
 * presentation, then the candidate answer is graded on its committed conclusion.
 * The motivating repro is the biased-coin memoryless comparison
 * ("Given >2 flips, P(4)? vs given >1 flip, P(3)? equal or different + value?"):
 *   • "equal, each 2/9, memoryless"       → CORRECT (no red on the memoryless claim);
 *   • "equal because memoryless" (no value)→ CLARIFY (ask for the value; NOT flawed);
 *   • "different, 8/81 vs 12/81"           → MISSED  (a committed wrong side, red-localized).
 */
export interface FollowupReasoningCase {
  label: string;
  /** The (AI-authored) follow-up QUESTION text. */
  question: string;
  /** The interviewer `idealAnswerNote` (client owns the correctness decision). */
  note: string;
  /** The candidate's follow-up answer. */
  raw: string;
  /** The committed-conclusion verdict the grader must return. */
  expect: ConclusionVerdict;
  /** Whether a RED (flawed) span is expected (only on a genuinely wrong answer). */
  expectRed: boolean;
  /** A correct, load-bearing phrase that must NEVER be reddened (false-red guard). */
  protectedPhrase?: string;
}

/** The coin/memoryless follow-up corpus (the reported false-negative + variants). */
const COIN_COMPARE_Q =
  "You flip a biased coin (heads w.p. 1/3) until the first heads. Given you needed MORE than two flips, what is P(exactly 4 flips)? Compare to: given MORE than one flip, P(exactly 3 flips)? Equal or different, and each value?";
const COIN_COMPARE_NOTE =
  "By memorylessness, conditioning on \u201cmore than k flips\u201d resets the geometric count, so both equal the fresh-start P(fail then success) = (2/3)(1/3) = 2/9 = 0.2222. They are EQUAL, each 2/9.";

export const FOLLOWUP_REASONING_CASES: FollowupReasoningCase[] = [
  {
    label: "coin: equal + value 2/9 (memoryless) → sound, no red",
    question: COIN_COMPARE_Q,
    note: COIN_COMPARE_NOTE,
    raw: "They're equal — each is 2/9 — because the coin is memoryless, so conditioning just restarts the count.",
    expect: "correct",
    expectRed: false,
    protectedPhrase: "memoryless",
  },
  {
    label: "coin: equal by memorylessness, value omitted → clarify (not flawed), no red",
    question: COIN_COMPARE_Q,
    note: COIN_COMPARE_NOTE,
    raw: "The two are the same because the coin is memoryless.",
    expect: "clarify",
    expectRed: false,
    protectedPhrase: "memoryless",
  },
  {
    label: "coin: committed WRONG side with wrong values → missed, red-localized",
    question: COIN_COMPARE_Q,
    note: COIN_COMPARE_NOTE,
    raw: "They're different: the first is 8/81 and the second is 12/81.",
    expect: "missed",
    expectRed: true,
  },
];

/** A minimal authored stub for the AI-follow-up classifier (role/label/clock). */
function followupStub(): FollowupPresentation {
  return {
    prompt: "(authored fallback)",
    source: "authored",
    role: "adversarial",
    label: "Follow-up 2 of 2 · Adversarial",
    answerKind: "reasoning",
    targetMs: 20000,
  };
}

export interface FollowupReasoningCaseResult {
  label: string;
  verdict: ConclusionVerdict;
  verdictOk: boolean;
  /** A red span was produced. */
  red: boolean;
  redOk: boolean;
  /** The protected correct phrase was NOT reddened. */
  protectedClean: boolean;
  /** The follow-up carries model-explanation content (answer or reasoning). */
  modelAvailable: boolean;
}

export interface FollowupReasoningMetrics {
  total: number;
  verdictCorrect: number;
  redCorrect: number;
  /** Correct load-bearing claims falsely reddened (must be 0). */
  falseReds: string[];
  /** Cases missing model-explanation content (must be 0). */
  missingModel: string[];
  perCase: FollowupReasoningCaseResult[];
}

/**
 * Measure the reasoning-follow-up pipeline end to end: the AI-follow-up classifier
 * (`buildAiFollowup`) builds the graded presentation, the committed-conclusion
 * grader returns the verdict, and the SAME deterministic annotator (the offline
 * floor of `reviewReasoning`) localizes — with `answerWasWrong` driven by a
 * genuinely-wrong (`missed`) verdict, exactly as the UI wires it. Asserts: right
 * verdict, red ONLY on a wrong answer, a correct load-bearing claim never reddened,
 * and model-explanation content available so the reveal can show.
 */
export function runFollowupReasoningEval(
  cases: FollowupReasoningCase[] = FOLLOWUP_REASONING_CASES,
  annotate: Annotator = annotateReasoning,
): FollowupReasoningMetrics {
  const perCase: FollowupReasoningCaseResult[] = [];
  let verdictCorrect = 0;
  let redCorrect = 0;
  const falseReds: string[] = [];
  const missingModel: string[] = [];
  for (const c of cases) {
    const pres = buildAiFollowup(followupStub(), {
      question: c.question,
      idealAnswerNote: c.note,
    });
    const score = gradeReasoningConclusion(pres, c.raw, 5000);
    const verdict = (score.verdict ?? (score.correct ? "correct" : "missed")) as ConclusionVerdict;
    const verdictOk = verdict === c.expect;

    // Mirror the UI: red-highlight ONLY on a genuinely wrong (`missed`) verdict.
    const answerWasWrong = verdict === "missed";
    const spans = annotate(c.raw, {
      prompt: pres.prompt,
      verifiedAnswer: pres.conclusionTargets?.[0] ?? null,
      answerWasWrong,
    });
    const red = spans.some((s) => s.label === "flawed");
    const redOk = red === c.expectRed;

    let protectedClean = true;
    if (c.protectedPhrase) {
      const idx = c.raw.indexOf(c.protectedPhrase);
      if (idx >= 0) {
        const end = idx + c.protectedPhrase.length;
        protectedClean = !spans.some(
          (s) => s.label === "flawed" && !(s.end <= idx || s.start >= end),
        );
      }
    }
    if (!protectedClean) falseReds.push(`[${c.label}] ${c.protectedPhrase}`);

    const modelAvailable = !!(pres.modelReasoning || pres.modelAnswer || pres.referenceNote);
    if (!modelAvailable) missingModel.push(c.label);

    if (verdictOk) verdictCorrect++;
    if (redOk) redCorrect++;
    perCase.push({
      label: c.label,
      verdict,
      verdictOk,
      red,
      redOk,
      protectedClean,
      modelAvailable,
    });
  }
  return {
    total: cases.length,
    verdictCorrect,
    redCorrect,
    falseReds,
    missingModel,
    perCase,
  };
}

/** Render the follow-up reasoning metrics as a Markdown section. */
export function renderFollowupReasoningMarkdown(m: FollowupReasoningMetrics): string {
  const pct = (n: number, d: number) => `${d > 0 ? ((n / d) * 100).toFixed(1) : "100.0"}%`;
  const rows = m.perCase
    .map(
      (c) =>
        `| ${c.label} | \`${c.verdict}\` | ${c.verdictOk ? "\u2713" : "\u2717"} | ${c.redOk ? "\u2713" : "\u2717"} | ${c.protectedClean ? "\u2713" : "\u2717"} | ${c.modelAvailable ? "\u2713" : "\u2717"} |`,
    )
    .join("\n");
  return [
    "",
    "## Adversarial reasoning-type follow-ups \u2014 same verifier-grounded pipeline",
    "",
    "Reasoning follow-ups (e.g. the biased-coin memoryless comparison) route through",
    "the SAME committed-conclusion grader + verifier-grounded annotator as the base",
    "question. A correct load-bearing claim (\u201cmemoryless\u201d) is never reddened; a",
    "right-side-but-value-omitted answer routes to CLARIFY (ask for the value), not a",
    "false MISSED; only a committed WRONG side is red-localized. Every case carries",
    "model-explanation content so the \u201cSee model explanation\u201d reveal can show.",
    "",
    "| Case | Verdict | Verdict OK | Red OK | No false-red | Model avail |",
    "|---|---|---|---|---|---|",
    rows,
    "",
    `**Verdicts: ${m.verdictCorrect}/${m.total} (${pct(m.verdictCorrect, m.total)})** \u00b7 ` +
      `**Red localization: ${m.redCorrect}/${m.total} (${pct(m.redCorrect, m.total)})** \u00b7 ` +
      `**False-reds on correct claims: ${m.falseReds.length}** \u00b7 ` +
      `**Missing model content: ${m.missingModel.length}**`,
    "",
    m.falseReds.length > 0 ? `False reds: ${m.falseReds.join("; ")}` : "No false reds on correct load-bearing claims.",
    "",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  EXPLANATION-REQUIRED ("why") FOLLOW-UPS — stem-echo / circular parrot guard */
/* -------------------------------------------------------------------------- */

/**
 * A "why do k terms/points pin all k parameters" (or any explanation-required)
 * follow-up. The candidate must convey the ACTUAL reason (k equations / k
 * unknowns / degrees of freedom), not merely commit to the value plus a keyword
 * LIFTED FROM THE STEM ("three terms") or a CIRCULAR non-reason ("because that
 * is enough"). This corpus reproduces the reported screenshot-1 bug and proves
 * the fix generalizes beyond the one sequence.
 */
export interface ExplanationFollowupCase {
  label: string;
  presentation: FollowupPresentation;
  raw: string;
  /** Must the grader mark this SOUND (verdict "correct")? */
  sound: boolean;
  /** A parroted stem phrase that must NOT be greened as "the key mechanism". */
  noGreenPhrase?: string;
  /** A genuine mechanism phrase that SHOULD be greened when present + sound. */
  greenPhrase?: string;
}

/** The REAL authored demo adversarial presentation (4,9,18,31,48 → a,b,c). */
function demoQuadraticAdversarial(): FollowupPresentation {
  const demo = drawArchetype(new Rng(1), "optiver-quadratic-demo");
  return buildFollowupPresentations(demo.followups!, 20000).adversarial;
}

/**
 * A NON-SEQUENCE explanation-required follow-up to prove generality: "is E[X²]
 * larger…and why?" One correct keyword ("larger") is ALSO in the stem (a stem
 * echo that must not count as a mechanism); the genuine mechanism is "variance"
 * / "spread" / "Jensen". A committed-right-side + stem-echo/circular non-reason
 * must NOT pass; a real variance explanation must.
 */
function varianceWhyAdversarial(): FollowupPresentation {
  return {
    prompt:
      "Is E[X\u00b2] larger or smaller than (E[X])\u00b2 for a non-constant X, and why? Commit to a side and explain.",
    source: "authored",
    role: "adversarial",
    label: "Follow-up 2 of 2 \u00b7 Adversarial",
    answerKind: "reasoning",
    conclusionKeywords: [["larger", "bigger", "greater"]],
    conclusionMode: "all",
    mechanismSignals: [
      "larger", "bigger", "greater", "variance", "var(x)", "spread",
      "jensen", "non-negative", "square of the deviation",
    ],
    targetMs: 20000,
  };
}

export const EXPLANATION_FOLLOWUP_CASES: ExplanationFollowupCase[] = [
  {
    // THE REPORTED BUG (screenshot 1): correct a/b/c values + the stem word
    // "three terms" + a CIRCULAR non-reason. Must NOT be sound, and "three
    // terms" must NOT be greened as the key mechanism.
    label: "quad-abc: parrot 'three terms because that is enough' \u2192 NOT sound, no green on stem echo",
    presentation: demoQuadraticAdversarial(),
    raw: "a = 2, b = -1, and c = 3. We only need three terms because that is enough.",
    sound: false,
    noGreenPhrase: "three terms",
  },
  {
    // A GENUINE explanation of the same archetype (three data points → three
    // equations in three unknowns) → sound.
    label: "quad-abc: genuine 'three equations in three unknowns' \u2192 sound",
    presentation: demoQuadraticAdversarial(),
    raw: "a = 2, b = -1, c = 3. Three data points give three equations in three unknowns, so a, b and c are uniquely determined.",
    sound: true,
    greenPhrase: "three equations",
  },
  {
    // The second-difference shortcut is also a genuine mechanism → sound.
    label: "quad-abc: genuine 'half the second difference' \u2192 sound",
    presentation: demoQuadraticAdversarial(),
    raw: "a = 2 because a is half the constant second difference (4/2 = 2); with three unknowns you need three terms to fit b = -1 and c = 3.",
    sound: true,
    greenPhrase: "second difference",
  },
  {
    // NON-SEQUENCE parrot: commits to the right side ("larger") but the only
    // "reason" is the stem word + a circular non-reason → NOT sound.
    label: "variance-why: parrot 'larger because that is just how it works' \u2192 NOT sound",
    presentation: varianceWhyAdversarial(),
    raw: "E[X\u00b2] is larger than (E[X])\u00b2 because that is just how it works.",
    sound: false,
    noGreenPhrase: "larger",
  },
  {
    // NON-SEQUENCE genuine: the variance mechanism → sound.
    label: "variance-why: genuine 'because of the variance' \u2192 sound",
    presentation: varianceWhyAdversarial(),
    raw: "It's larger because E[X\u00b2] - (E[X])\u00b2 is the variance, which is non-negative and strictly positive for a non-constant X.",
    sound: true,
    greenPhrase: "variance",
  },
];

export interface ExplanationFollowupCaseResult {
  label: string;
  sound: boolean;
  soundOk: boolean;
  /** The stem-echo phrase was NOT greened (false-green guard). */
  noGreenOk: boolean;
  /** The genuine mechanism phrase WAS greened when expected. */
  greenOk: boolean;
}

export interface ExplanationFollowupMetrics {
  total: number;
  soundCorrect: number;
  /** Stem-echo phrases wrongly greened (must be 0). */
  falseGreens: string[];
  perCase: ExplanationFollowupCaseResult[];
}

/**
 * Grade + annotate every explanation-required follow-up case through the REAL
 * committed-conclusion grader (`gradeReasoningConclusion`) and the deterministic
 * annotator (the offline floor of `reviewReasoning`). Asserts: the parrot / stem
 * -echo / circular answers are NOT sound while genuine mechanistic explanations
 * ARE, and a parroted stem phrase is never greened as "the key mechanism".
 */
export function runExplanationFollowupEval(
  cases: ExplanationFollowupCase[] = EXPLANATION_FOLLOWUP_CASES,
  annotate: Annotator = annotateReasoning,
): ExplanationFollowupMetrics {
  const perCase: ExplanationFollowupCaseResult[] = [];
  let soundCorrect = 0;
  const falseGreens: string[] = [];
  for (const c of cases) {
    const score = gradeReasoningConclusion(c.presentation, c.raw, 5000);
    const sound = score.verdict === "correct";
    const soundOk = sound === c.sound;

    const spans = annotate(c.raw, {
      prompt: c.presentation.prompt,
      verifiedAnswer: c.presentation.conclusionTargets?.[0] ?? null,
      answerWasWrong: score.verdict === "missed",
      // The follow-up carries mechanism signals on the presentation (mirrors the
      // UI wiring of `reviewReasoning`).
      mechanismSignals: c.presentation.mechanismSignals,
    });

    let noGreenOk = true;
    if (c.noGreenPhrase) {
      const idx = c.raw.toLowerCase().indexOf(c.noGreenPhrase.toLowerCase());
      if (idx >= 0) {
        const end = idx + c.noGreenPhrase.length;
        noGreenOk = !spans.some(
          (s) => s.label === "good" && !(s.end <= idx || s.start >= end),
        );
      }
      if (!noGreenOk) falseGreens.push(`[${c.label}] ${c.noGreenPhrase}`);
    }

    // A SOUND genuine explanation must earn at least one GREEN span — a credited
    // (non-stem-echo) mechanism / correct step — so the learner sees what landed
    // right. (We don't pin the exact phrase: several genuine signals may match;
    // the annotator greens the earliest.)
    let greenOk = true;
    if (c.sound) {
      greenOk = spans.some((s) => s.label === "good");
    }

    if (soundOk) soundCorrect++;
    perCase.push({ label: c.label, sound, soundOk, noGreenOk, greenOk });
  }
  return { total: cases.length, soundCorrect, falseGreens, perCase };
}

/** Render the explanation-follow-up metrics as a Markdown section. */
export function renderExplanationFollowupMarkdown(
  m: ExplanationFollowupMetrics,
): string {
  const pct = (n: number, d: number) => `${d > 0 ? ((n / d) * 100).toFixed(1) : "100.0"}%`;
  const rows = m.perCase
    .map(
      (c) =>
        `| ${c.label} | ${c.sound ? "sound" : "not sound"} | ${c.soundOk ? "\u2713" : "\u2717"} | ${c.noGreenOk ? "\u2713" : "\u2717"} | ${c.greenOk ? "\u2713" : "\u2717"} |`,
    )
    .join("\n");
  return [
    "",
    "## Explanation-required (\u201cwhy\u201d) follow-ups \u2014 stem-echo / circular parrot guard",
    "",
    "A \u201cwhy do k terms pin all k coefficients?\u201d follow-up is NOT satisfied by the",
    "correct value plus a keyword LIFTED FROM THE STEM (\u201cthree terms\u201d) or a CIRCULAR",
    "non-reason (\u201cbecause that is enough\u201d). The candidate must name the actual",
    "mechanism (k equations / k unknowns / degrees of freedom, or the variance).",
    "The stem-echo phrase is also never greened as \u201cthe key mechanism.\u201d",
    "",
    "| Case | Verdict | Sound OK | No false-green | Green OK |",
    "|---|---|---|---|---|",
    rows,
    "",
    `**Sound classification: ${m.soundCorrect}/${m.total} (${pct(m.soundCorrect, m.total)})** \u00b7 ` +
      `**False-greens on stem echoes: ${m.falseGreens.length}**`,
    "",
    m.falseGreens.length > 0
      ? `False greens: ${m.falseGreens.join("; ")}`
      : "No stem-echo phrase greened as a mechanism.",
    "",
  ].join("\n");
}
