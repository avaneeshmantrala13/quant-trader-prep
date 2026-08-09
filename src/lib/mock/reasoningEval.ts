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
