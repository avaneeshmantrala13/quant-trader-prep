/**
 * diagnostic/difficulty-floor.test.ts — the UNTIMED-DIAGNOSTIC difficulty-floor
 * + quant-relevance regression guard (mirrors `src/lib/mock/difficulty-floor.test.ts`).
 *
 * Two goals it locks in:
 *
 *  GOAL A — QUANT-RELEVANCE. Every item in the untimed diagnostic must attribute
 *  to a topic that is in `scoredContentTopicKeys()` (the 21 quant-relevant nodes)
 *  or to the brainteaser competency node. In particular NONE of the five purely
 *  academic course-completeness topics (Moment Generating Functions, Gamma
 *  Distribution, Joint Distributions, Limit Theorems, Continuous-Time Markov
 *  Chains) may be probed here — they were dropped from the scored/gated set
 *  (UT_COURSE_GAP_ANALYSIS.md §4, "largely academic").
 *
 *  GOAL B — DIFFICULTY FLOOR. No reachable diagnostic item may be freshman-
 *  trivial: no "P(heads) = ½", no single-die mean EV, no Poisson-mean plug-in,
 *  no bare `Var(Bₜ)=t`, no legs-6-8 Pythagoras, no bare ≤2-digit multiplication.
 *  Every authored item must clear a vetted-concept ALLOWLIST (a new/un-vetted or
 *  academic concept fails the build until a human vets it), and a GENUINELY-hard
 *  ceiling subset — the lattice-path / random-walk / optimal-stopping / hard-Bayes
 *  / order-statistics benchmark families — must be present and materialize `hard`.
 */
import { describe, expect, it } from "vitest";
import { scoredContentTopicKeys } from "@/lib/pipeline/gates";
import { COMPETENCY_BRAINTEASER } from "@/lib/roadmap/skillGraph";
import { FR_ADAPTER_FAMILIES } from "@/lib/oa/hardContent/frAdapters";
import {
  UNTIMED_BLUEPRINT,
  untimedContentItems,
  type UntimedNumericItem,
} from "@/content/diagnostic/untimedBlueprint";
import { materializeUntimedRun } from "@/lib/diagnostic/untimedRun";

/** Many well-spread seeds so a rarely-picked adapter leak still surfaces. */
const SEEDS = Array.from({ length: 120 }, (_, i) => i * 17 + 3);

/** Anything with a numeric answer + a prompt (authored + materialized adapter). */
interface NumericLike {
  prompt: string;
  answer: number;
  concept?: string;
}

/* -------------------------------------------------------------------------- */
/*  Known-trivial detectors — the freshman signatures forbidden anywhere       */
/* -------------------------------------------------------------------------- */

/** "P(heads)" of a single fair coin — the ½ freebie. */
function isSingleCoinHeads(q: NumericLike): boolean {
  return (
    /coin/i.test(q.prompt) &&
    /heads?/i.test(q.prompt) &&
    /(single|one|a fair coin|fair coin is (flipped|tossed))/i.test(q.prompt) &&
    /probabilit|\bP\(/i.test(q.prompt) &&
    !/\btwo\b|\bthree\b|repeatedly|in a row|first/i.test(q.prompt) &&
    Math.abs(q.answer - 0.5) < 1e-9
  );
}

/** "EV of the SUM of two dice" — the answer-is-7 freebie. */
function isTwoDiceSumEV(q: NumericLike): boolean {
  return (
    /expected value/i.test(q.prompt) &&
    /\btwo\b/i.test(q.prompt) &&
    /dice/i.test(q.prompt) &&
    /\bsum\b/i.test(q.prompt) &&
    Math.abs(q.answer - 7) < 1e-9
  );
}

/** "EV of one roll of a fair k-sided die" — the mean-is-(k+1)/2 freebie. */
function isSingleDieMeanEV(q: NumericLike): boolean {
  return (
    /fair\s+\d+-sided die/i.test(q.prompt) &&
    /rolled once/i.test(q.prompt) &&
    /expected value/i.test(q.prompt)
  );
}

/**
 * Poisson expected-COUNT plug-in — "expected number of events" answer = λ. A
 * genuine Poisson item asks for a pmf/tail probability (contains `P(`), so this
 * only fires on the definitional mean freebie.
 */
function isPoissonMeanPlugin(q: NumericLike): boolean {
  return (
    /poisson/i.test(q.prompt) &&
    /(expected|average|mean)\s+(number|count)/i.test(q.prompt) &&
    !/probabilit|\bP\(/i.test(q.prompt)
  );
}

/**
 * Single-time Brownian variance plug-in `Var(B_t)` (= t). The genuine item asks
 * for an INCREMENT `Var(B_t − B_s)`, so the closing paren does not follow the
 * subscript and this does not fire.
 */
function isSingleTimeBMVar(q: NumericLike): boolean {
  return /Var\(\s*B[₀-₉\d]+\s*\)/.test(q.prompt);
}

/** Bare legs-a-b right-triangle hypotenuse (2-D Pythagoras freebie). */
function isBarePythagoras(q: NumericLike): boolean {
  return (
    /right triangle/i.test(q.prompt) &&
    /hypotenuse/i.test(q.prompt) &&
    /\blegs?\b/i.test(q.prompt)
  );
}

/** A bare ≤2-digit × ≤2-digit multiplication warm-up (e.g. 29 × 14 = ?). */
function isBareSmallMultiplication(q: NumericLike): boolean {
  const m = q.prompt.match(/^\s*(\d[\d,]*)\s*[×x]\s*(\d[\d,]*)\s*=/i);
  if (!m) return false;
  const a = Number(m[1].replace(/,/g, ""));
  const b = Number(m[2].replace(/,/g, ""));
  return a < 100 && b < 100;
}

/** The single trivial-reason (or null) for a numeric item. */
function trivialReason(q: NumericLike): string | null {
  if (isSingleCoinHeads(q)) return "single-coin P(heads)=½";
  if (isTwoDiceSumEV(q)) return "two-dice-sum EV (=7)";
  if (isSingleDieMeanEV(q)) return "single-die mean EV";
  if (isPoissonMeanPlugin(q)) return "Poisson mean plug-in (E[N]=λ)";
  if (isSingleTimeBMVar(q)) return "single-time BM variance plug-in (Var(Bₜ)=t)";
  if (isBarePythagoras(q)) return "bare legs-a-b Pythagoras";
  if (isBareSmallMultiplication(q)) return "bare ≤2-digit × ≤2-digit multiplication";
  return null;
}

/* -------------------------------------------------------------------------- */
/*  GOAL B — the detectors actually have teeth                                 */
/* -------------------------------------------------------------------------- */

describe("diagnostic difficulty floor — the trivial detectors have teeth", () => {
  it("flags every freshman signature and passes the retained (hardened) items", () => {
    // MUST be caught — these are exactly the freebies that were removed.
    expect(trivialReason({ prompt: "A fair coin is flipped. What is P(heads)?", answer: 0.5 })).toBeTruthy();
    expect(trivialReason({ prompt: "Two fair six-sided dice are rolled. What is the expected value of their sum?", answer: 7 })).toBeTruthy();
    expect(trivialReason({ prompt: "A fair 6-sided die is rolled once. What is the expected value?", answer: 3.5 })).toBeTruthy();
    expect(trivialReason({ prompt: "Calls arrive as a Poisson process with mean 3 per hour. What is the expected number of calls in an hour?", answer: 3 })).toBeTruthy();
    expect(trivialReason({ prompt: "For standard Brownian motion, what is Var(B₉)?", answer: 9 })).toBeTruthy();
    expect(trivialReason({ prompt: "A right triangle has legs 6 and 8. What is the hypotenuse?", answer: 10 })).toBeTruthy();
    expect(trivialReason({ prompt: "24 × 25 = ?", answer: 600 })).toBeTruthy();

    // Retained / hardened items must NOT be flagged.
    expect(trivialReason({ prompt: "Compute 88 × 125.", answer: 11000 })).toBeNull();
    expect(trivialReason({ prompt: "Two fair six-sided dice are rolled. What is the probability that at least one of them shows a 6?", answer: 11 / 36 })).toBeNull();
    expect(trivialReason({ prompt: "For standard Brownian motion Bₜ, what is Var(B₉ − B₄)?", answer: 5 })).toBeNull();
    expect(trivialReason({ prompt: "Calls arrive as a Poisson process with mean λ = 3 per hour. What is P(exactly 2 calls in one hour)?", answer: 0.224 })).toBeNull();
    expect(trivialReason({ prompt: "A rectangular box has dimensions 3 × 4 × 12. What is the length of its space diagonal?", answer: 13 })).toBeNull();
  });
});

describe("diagnostic difficulty floor — no reachable item is freshman-trivial", () => {
  it("no authored item is trivial", () => {
    const violations: string[] = [];
    for (const it of untimedContentItems()) {
      if (it.kind !== "numeric-authored") continue;
      const reason = trivialReason(it.question);
      if (reason) violations.push(`${it.question.id}: "${it.question.prompt}" → ${reason}`);
    }
    expect(violations, violations.join("\n")).toHaveLength(0);
  });

  it("no MATERIALIZED item (authored + adapter, many seeds) is trivial", () => {
    const violations: string[] = [];
    let checked = 0;
    for (const seed of SEEDS) {
      for (const m of materializeUntimedRun(seed)) {
        if (m.kind !== "numeric") continue;
        checked++;
        const reason = trivialReason(m.question);
        if (reason) violations.push(`seed ${seed} ${m.question.id}: "${m.question.prompt}" → ${reason}`);
      }
    }
    // Guard is not vacuous.
    expect(checked).toBeGreaterThan(1000);
    expect(violations, violations.slice(0, 12).join("\n")).toHaveLength(0);
  });

  it("no authored FLOOR item is declared 'easy'", () => {
    const bad = untimedContentItems()
      .filter((it): it is UntimedNumericItem => it.kind === "numeric-authored" && it.tier === "floor")
      .filter((it) => it.question.difficulty === "easy");
    expect(
      bad,
      bad.map((b) => `${b.question.id} is "easy"`).join("\n"),
    ).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  GOAL B — vetted-concept allowlist (teeth against new/academic authored math)*/
/* -------------------------------------------------------------------------- */

/**
 * Every AUTHORED numeric item must carry a concept vetted as interview-relevant
 * and non-trivial. A new authored item with an un-vetted concept — or a
 * re-introduced academic plug-in ("Poisson mean", "Moments from the MGF", …) —
 * fails the build until a human adds it here on purpose. Adapter ceilings are
 * covered structurally below (they reuse the exact-verified hard generators).
 */
const APPROVED_AUTHORED_CONCEPTS = new Set<string>([
  // Foundations / mental / rates / counting
  "Multiplication (factoring trick)",
  "Squares & products",
  "Series sums",
  "Digit counting",
  "Percentages",
  "Combined rates",
  "Relative rates",
  "Combinations",
  "Stars and bars",
  "Inclusion–exclusion on divisibility",
  "Series & sums with a divisibility filter",
  // Core / conditional probability
  "Complement rule",
  "Inclusion–exclusion",
  "Conditional probability (reduced sample space)",
  // Expectation & distributions
  "Expected value of a bet",
  "Memorylessness of the geometric wait",
  "First-step analysis (patterns)",
  "Conditional uniform distribution",
  "Exponential distribution",
  "Poisson pmf",
  "Geometric probability (area of a region)",
  "Geometric probability (area in the unit square)",
  "3-D Pythagoras",
  "Clock angles",
  "Order statistics (max)",
  "Variance scaling",
  "Variance of a linear combination",
  // Processes & trading
  "Kelly (even money)",
  "Fair gambler's ruin (duration)",
  "Independent increments of BM",
  "Martingale property of BM",
  "EV of a payoff table net of cost",
  "Mixed-strategy equilibrium",
  "Bluff frequency / pot odds",
  "Branching-process mean growth",
  "Extinction probability (fixed point of the PGF)",
  "Chapman–Kolmogorov (P²)",
  "Stationary distribution (πP = π)",
]);

describe("diagnostic difficulty floor — every authored concept is vetted", () => {
  it("no authored item carries an un-vetted concept (allowlist, not denylist)", () => {
    const offenders = new Map<string, string>();
    for (const it of untimedContentItems()) {
      if (it.kind !== "numeric-authored") continue;
      const concept = it.question.concept ?? "(no concept)";
      if (!APPROVED_AUTHORED_CONCEPTS.has(concept) && !offenders.has(concept)) {
        offenders.set(concept, `${it.question.id}: "${it.question.prompt}"`);
      }
    }
    const msg = [...offenders.entries()]
      .map(([c, ex]) => `UN-VETTED concept "${c}" — e.g. ${ex}`)
      .join("\n");
    expect(offenders.size, msg).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  GOAL A — quant-relevance: only the 21 scored topics are probed             */
/* -------------------------------------------------------------------------- */

/** The five academic topics that must NEVER be probed by the diagnostic. */
const REMOVED_ACADEMIC_TOPICS = [
  "probability::Moment Generating Functions",
  "probability::Gamma Distribution",
  "probability::Joint Distributions",
  "probability::Limit Theorems",
  "probability::Continuous-Time Markov Chains",
];

describe("diagnostic quant-relevance — only scored quant topics are probed", () => {
  it("every item attributes to a scored quant topic (or the brainteaser node)", () => {
    const allowed = new Set<string>([...scoredContentTopicKeys(), COMPETENCY_BRAINTEASER]);
    const offenders = UNTIMED_BLUEPRINT.filter((it) => !allowed.has(it.topicKey)).map(
      (it) => `${it.kind} → ${it.topicKey}`,
    );
    expect(offenders, offenders.join("\n")).toHaveLength(0);
  });

  it("no item probes a removed academic topic", () => {
    for (const removed of REMOVED_ACADEMIC_TOPICS) {
      expect(scoredContentTopicKeys()).not.toContain(removed);
      const hit = UNTIMED_BLUEPRINT.find((it) => it.topicKey === removed);
      expect(hit, `academic topic still probed: ${removed}`).toBeUndefined();
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  GOAL B — a genuinely very-hard ceiling subset is present                   */
/* -------------------------------------------------------------------------- */

/**
 * The user's benchmark "genuinely very hard" families: lattice-path
 * intersection, random-walk meeting / hitting / first-passage / ruin, optimal
 * stopping (secretary), hard Bayes (hidden composition), pattern-wait first-step,
 * and order-statistics EV. Each must be present in the diagnostic AND be a real
 * exact-verified hard OA family.
 */
const REQUIRED_CEILING_FAMILIES = [
  "hardPathIntersect", // A/B lattice-path intersection
  "hardCycleMeeting", // two walkers meeting on a cycle
  "hardGraphHitting", // random-walk hitting time
  "hardStepLanding", // random-walk landing / first passage
  "hardRuinDuration", // (biased) gambler's ruin duration
  "hardSecretary", // optimal stopping
  "hardHiddenComposition", // hard Bayes / hidden composition
  "hardPatternWait", // pattern-wait first-step analysis
  "hardDiceOrderStat", // order-statistics EV
  "hardCoinBias", // hard Bayesian coin update
  "hardOneReroll", // optimal one-reroll stopping
];

describe("diagnostic difficulty ceiling — the very-hard benchmark families are present", () => {
  const presentFamilies = new Set(
    untimedContentItems()
      .filter((it) => it.kind === "numeric-adapter")
      .map((it) => (it as { family: string }).family),
  );

  for (const fam of REQUIRED_CEILING_FAMILIES) {
    it(`includes the very-hard family "${fam}" (and it is a real hard OA family)`, () => {
      expect(FR_ADAPTER_FAMILIES).toContain(fam);
      expect(presentFamilies.has(fam)).toBe(true);
    });
  }

  it("has a substantial hard-ceiling adapter subset", () => {
    const adapterCount = untimedContentItems().filter((it) => it.kind === "numeric-adapter").length;
    expect(adapterCount).toBeGreaterThanOrEqual(25);
  });

  it("every materialized adapter ceiling grades as 'hard' (many seeds)", () => {
    const violations: string[] = [];
    let checked = 0;
    for (const seed of SEEDS.slice(0, 20)) {
      for (const m of materializeUntimedRun(seed)) {
        if (m.kind !== "numeric" || m.item.kind !== "numeric-adapter") continue;
        checked++;
        if (m.question.difficulty !== "hard") {
          violations.push(`seed ${seed} ${m.question.id}: difficulty="${m.question.difficulty}"`);
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
    expect(violations, violations.slice(0, 12).join("\n")).toHaveLength(0);
  });
});
