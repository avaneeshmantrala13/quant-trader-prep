/**
 * mock/rubrics.ts — the per-archetype REASONING RUBRICS.
 *
 * A rubric declares, ONCE per question archetype, the small set of facts a valid
 * solution MUST establish (its `degreesOfFreedom` — the load-bearing claims) and
 * the EQUIVALENCE CLASSES of valid methods (`mechanismClasses`) that establish
 * them. A derivation is judged SOUND when it (a) is arithmetically sound, (b)
 * engages the actual setup quantities, (c) reaches the verified answer, and (d)
 * establishes ≥1 mechanism class — BY ANY of the listed equivalent methods.
 *
 * WHY: the old grader matched ONE canonical phrasing per question (brittle). The
 * rubric formalizes that, e.g. for a quadratic sequence, the "first differences
 * increase by a constant" framing ≡ the "constant second difference" framing ≡
 * the explicit closed-form quadratic. Establishing ANY one is sufficient.
 *
 * These classes are supersets of the per-question `mechanismSignals` threaded
 * through `RequiredReasoning`; the extract-and-verify grader (`./claims`) checks
 * an LLM-extracted mechanism CLAIM against them so ARBITRARY phrasing (which the
 * LLM normalizes) is accepted, while the deterministic fallback keeps matching
 * the literal signals. Pure data + tiny lookup helpers: no React/DOM/network.
 */

/** One equivalence class of valid methods (synonymous phrasings for ONE method). */
export type MechanismClass = string[];

/** The rubric for one question archetype (keyed by `id` prefix). */
export interface ArchetypeRubric {
  /** The `id` prefix this rubric applies to (longest match wins). */
  idPrefix: string;
  /** Human name of the family (for reports / the eval harness). */
  family: string;
  /**
   * The LOAD-BEARING claims — the facts (degrees of freedom) a valid solution
   * MUST establish. Human-readable; used to author positive/negative test
   * derivations in the eval harness and to document what "sound" requires.
   */
  degreesOfFreedom: string[];
  /**
   * EQUIVALENCE CLASSES of valid methods. Establishing ANY ONE class (via a true
   * derivation that reaches the verified answer) satisfies the mechanism
   * requirement. Each inner array is a set of synonymous phrasings for the SAME
   * method; different arrays are genuinely different-but-equivalent methods.
   */
  mechanismClasses: MechanismClass[];
  /**
   * Paraphrase SEEDS the LLM would normalize onto a mechanism class but which do
   * NOT contain a literal class phrase. Used by the eval harness to prove the
   * extract-and-verify path accepts wording OUTSIDE the literal signal bank.
   */
  paraphrases?: MechanismClass[];
}

/**
 * The rubric registry. Prefixes mirror the `id` scheme in `questionPools.ts`
 * (e.g. "seqn-poly-demo", "pev-bayes"). `mechanismClasses` are supersets of the
 * corresponding `MAIN_MECHANISM_BY_ID` entries, grouped into equivalent methods.
 */
export const RUBRICS: ArchetypeRubric[] = [
  /* ------------------------------- sequences ------------------------------- */
  {
    idPrefix: "seqn-poly-demo",
    family: "Quadratic sequence (Optiver demo pin)",
    degreesOfFreedom: [
      "the gap pattern (first differences grow by a constant)",
      "the next gap value",
      "the final term = last term + next gap",
    ],
    mechanismClasses: [
      [
        "first difference", "first differences", "differences grow",
        "differences increase", "gaps grow", "gaps increase", "gap grows",
        "gap increases", "grow by 6", "growing by 6", "increase by 6",
        "increases by 6", "constant increment", "6 12 18 24", "12 18 24",
        "18 24 30",
      ],
      [
        "second difference", "second differences", "2nd difference",
        "second-order difference", "difference of the differences",
        "constant second",
      ],
      ["quadratic", "parabola", "n^2", "3n^2", "closed form"],
    ],
    paraphrases: [
      ["the jumps get bigger by the same amount", "each step grows by six more",
        "the spacing widens by a fixed six", "the gap keeps growing by six"],
      ["the change in the gaps stays constant", "the gaps' rate of change is fixed"],
      ["it fits a squared formula in n", "an n-squared rule"],
    ],
  },
  {
    idPrefix: "seqn-poly",
    family: "Quadratic sequence",
    degreesOfFreedom: [
      "the first differences and that they grow by a constant",
      "the constant second difference",
      "the next term",
    ],
    mechanismClasses: [
      [
        "first difference", "first differences", "differences grow",
        "differences increase", "gaps grow", "gaps increase", "constant second",
      ],
      [
        "second difference", "second differences", "2nd difference",
      ],
      ["quadratic", "parabola", "n^2", "n squared", "polynomial", "second-order"],
    ],
    paraphrases: [
      ["the jumps grow by a fixed amount", "each gap is bigger by the same step"],
      ["the difference of the differences is constant"],
      ["a squared rule in n", "an n-squared pattern"],
    ],
  },
  {
    idPrefix: "seqn-cubic",
    family: "Cubic sequence",
    degreesOfFreedom: [
      "the third differences are constant",
      "the next term",
    ],
    mechanismClasses: [
      ["third difference", "third differences", "3rd difference", "three levels",
        "differences of the differences"],
      ["cubic", "cubed", "n^3", "n cubed", "degree 3", "degree three",
        "third-order", "polynomial"],
    ],
    paraphrases: [
      ["you have to take differences three times", "differencing three times is constant"],
      ["a cubed rule in n", "an n-cubed pattern"],
    ],
  },
  {
    idPrefix: "seqn-alt",
    family: "Alternating-operation sequence",
    degreesOfFreedom: [
      "the two operations alternate",
      "the next term",
    ],
    mechanismClasses: [
      ["alternate", "alternating", "add then multiply", "then multiply",
        "every other", "cycle", "two operations", "switch operation",
        "operations alternate"],
    ],
    paraphrases: [
      ["it flips between adding and multiplying", "the rule toggles each step",
        "one step adds, the next multiplies"],
    ],
  },
  {
    idPrefix: "seqn-arith",
    family: "Arithmetic sequence",
    degreesOfFreedom: ["the common difference", "the next term"],
    mechanismClasses: [
      ["common difference", "constant difference", "arithmetic", "add", "adds",
        "plus", "same difference", "each step", "goes up by"],
    ],
    paraphrases: [
      ["you add the same amount each time", "it steps up by a fixed number"],
    ],
  },
  {
    idPrefix: "seqn-geo",
    family: "Geometric sequence",
    degreesOfFreedom: ["the common ratio", "the next term"],
    mechanismClasses: [
      ["common ratio", "ratio", "geometric", "multiply", "times", "r^n",
        "each term is multiplied"],
    ],
    paraphrases: [
      ["you multiply by the same factor each time", "it scales by a fixed ratio"],
    ],
  },
  {
    idPrefix: "seqn-fib",
    family: "Fibonacci-like sequence",
    degreesOfFreedom: ["each term is the sum of the previous two", "the next term"],
    mechanismClasses: [
      ["sum of the previous two", "previous two", "fibonacci", "add the two",
        "recurrence", "a_n-1 + a_n-2", "sum of the last two"],
    ],
    paraphrases: [
      ["you add the two terms before it", "each is the two before it added up"],
    ],
  },

  /* ------------------------------ probability ------------------------------ */
  {
    idPrefix: "pev-twoof3",
    family: "Independent events — exactly two of three",
    degreesOfFreedom: [
      "there are 3 ways to choose which two occur",
      "each way has probability p^2 (1-p)",
      "the total is 3 p^2 (1-p)",
    ],
    mechanismClasses: [
      ["choose", "3 ways", "three ways", "c(3,2)", "combination", "binomial"],
      ["p^2", "p squared", "(1-p)", "one fails", "third fails"],
    ],
    paraphrases: [
      ["pick which pair happens", "three ways to select the two that occur"],
      ["two succeed and one fails"],
    ],
  },
  {
    idPrefix: "pev-urn",
    family: "Conditional urn",
    degreesOfFreedom: [
      "P(both red) unconditional",
      "P(at least one red)",
      "the conditional divides the two (>1 so it is larger)",
    ],
    mechanismClasses: [
      ["conditional", "condition on", "at least one", "given"],
      ["without replacement", "one fewer", "ratio", "bayes", "divide by"],
    ],
    paraphrases: [
      ["you throw out the no-red cases", "restricting to at least one red rescales"],
    ],
  },
  {
    idPrefix: "pev-geo",
    family: "Geometric race (first mover)",
    degreesOfFreedom: [
      "the geometric series for the first mover",
      "the head-start advantage",
    ],
    mechanismClasses: [
      ["geometric series", "first attempt", "head start", "(1-p)", "first mover",
        "first move"],
    ],
    paraphrases: [
      ["the leader gets the extra attempt", "the first shot gives the edge"],
    ],
  },
  {
    idPrefix: "pev-condgeo",
    family: "Conditional geometric (memoryless)",
    degreesOfFreedom: [
      "the process is memoryless",
      "the conditional distribution is unchanged",
    ],
    mechanismClasses: [
      ["memoryless", "no memory", "geometric", "conditional", "resets",
        "past does not matter"],
    ],
    paraphrases: [
      ["earlier tails carry no information", "the count starts fresh"],
    ],
  },
  {
    idPrefix: "pev-bayes",
    family: "Bayes with a low base rate",
    degreesOfFreedom: [
      "the base rate / prevalence dominates",
      "posterior = P·1 / (P·1 + (1-P)·FPR)",
    ],
    mechanismClasses: [
      ["base rate", "base-rate", "prevalence", "prior"],
      ["posterior", "bayes", "false positive", "false-positive", "numerator",
        "dominates"],
    ],
    paraphrases: [
      ["most positives are healthy false alarms", "the rarity of the disease drives it"],
    ],
  },
  {
    idPrefix: "pev-max2dice",
    family: "Order statistics — max of two dice",
    degreesOfFreedom: [
      "P(max = m) rises with m (proportional to 2m-1)",
      "E[max] + E[min] = E[sum] = 7",
    ],
    mechanismClasses: [
      ["order statistic", "p(max", "2m-1", "2m - 1", "cdf", "m/6",
        "distribution of the max", "larger values weigh more"],
      ["e[max] + e[min]", "sum is 7", "max plus min"],
    ],
  },
  {
    idPrefix: "pev-monty",
    family: "Monty Hall",
    degreesOfFreedom: [
      "the host's reveal is informed",
      "switching wins with the complementary probability",
    ],
    mechanismClasses: [
      ["host knows", "informed", "not 50/50", "not fifty", "conditional",
        "host opens", "reveal is not random", "deliberately opens"],
    ],
    paraphrases: [
      ["the host deliberately opens an empty door", "the reveal is not random"],
    ],
  },
  {
    idPrefix: "pev-citadel-stones",
    family: "Bayesian composition (bet on your posterior)",
    degreesOfFreedom: [
      "the posterior probability of black",
      "the bet EV is negative",
    ],
    mechanismClasses: [
      ["bayes", "posterior", "prior", "update", "composition", "conditioning"],
      ["expected value", "negative ev", "negative expected value", "losing bet",
        "unfavorable", "ev is negative"],
    ],
  },
  {
    idPrefix: "pev-sig-confbet",
    family: "Confidence → Kelly bet",
    degreesOfFreedom: [
      "the win probability via total probability",
      "the Kelly fraction f = 2p-1",
    ],
    mechanismClasses: [
      ["law of total probability", "total probability", "average", "both branches",
        "condition on"],
      ["kelly", "2p - 1", "2p-1", "edge", "fraction", "f ="],
    ],
  },
  {
    idPrefix: "est-mmquotes",
    family: "Fermi — options market-maker quote throughput",
    degreesOfFreedom: [
      "call AND put at every strike (the ×2)",
      "a 6.5-hour session is 23,400 seconds",
      "the multi-factor product",
    ],
    mechanismClasses: [
      ["call and put", "call + put", "call/put", "×2", "x2", "times 2", "both a call"],
      ["23,400", "23400", "seconds", "6.5 hour", "per second"],
      ["multiply", "product", "decompose", "underlying", "expiration", "strike"],
    ],
  },
];

/** Look up the rubric for a question id (longest matching `idPrefix` wins). */
export function rubricForId(id: string): ArchetypeRubric | undefined {
  let best: ArchetypeRubric | undefined;
  for (const r of RUBRICS) {
    if (id.startsWith(r.idPrefix)) {
      if (!best || r.idPrefix.length > best.idPrefix.length) best = r;
    }
  }
  return best;
}

/** The flattened union of every mechanism-class phrasing for a rubric. */
export function rubricSignals(rubric: ArchetypeRubric): string[] {
  return rubric.mechanismClasses.flat();
}
