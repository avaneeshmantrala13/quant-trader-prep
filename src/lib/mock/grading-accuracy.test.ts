/**
 * mock/grading-accuracy.test.ts — the iterative multi-pass "candidate simulator"
 * QA corpus for the DETERMINISTIC graders (the always-on fallback that must be
 * excellent on its own).
 *
 * For every scored non-mental-math question type across all three presets
 * (probability/EV, sequences, estimation) AND both follow-ups (numeric probe +
 * reasoning adversarial), we sample many seeded instances and feed the grader:
 *   (a) MANY genuinely-correct answers with VARIED wording/notation/length —
 *       terse, verbose, symbolic, plain-English, different-but-valid method — and
 *       require the grader to ACCEPT them  → RECALL / false-negative rate.
 *   (b) FLAWED variants — right number but hand-wavy, wrong conclusion, wrong
 *       method, or caving to a misconception — and require the grader to REJECT
 *       them  → PRECISION / false-positive rate.
 * We also VALIDATE QUESTION CORRECTNESS (answers finite, follow-ups distinct,
 * targets well-formed).
 *
 * Acceptance targets (asserted below): ≥98% recall, ≥95% flaw-rejection, ZERO
 * false-negatives on the CANONICAL correct answer of every case, 0 malformed
 * questions. Measured numbers are printed per type for the QA report.
 */
import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  _pools,
  drawArchetype,
  type ArchetypeId,
  type MockNumericQuestion,
} from "./questionPools";
import { buildFollowupPresentations, gradeFollowup, keywordHit } from "./followups";
import type { FollowupPresentation } from "./types";

/* -------------------------------------------------------------------------- */
/*  Harness                                                                    */
/* -------------------------------------------------------------------------- */

type Gen = (rng: Rng) => MockNumericQuestion;
const TARGET_MS = 60_000;
const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 7);
const fmt = (n: number) => String(n);

/** Grade a follow-up answer; returns whether the grader marked it correct. */
function accepts(p: FollowupPresentation, raw: string): boolean {
  const s = gradeFollowup(p, raw, Math.round(p.targetMs / 2));
  return s != null && s.correct === true;
}

/** All non-archetype generators, plus the pinned firm archetypes. */
const ALL_GENS: Gen[] = [
  ..._pools.PROB_EV_MEDIUM,
  ..._pools.PROB_EV_HARD,
  ..._pools.PROB_EV_STRETCH,
  ..._pools.ESTIMATION_POOL,
  ..._pools.SEQUENCE_MEDIUM,
  ..._pools.SEQUENCE_HARD,
];
const ARCHETYPES: ArchetypeId[] = [
  "bank-or-roll",
  "sig-confidence-bet",
  "monty-hold-firm",
  "citadel-bet",
  "optiver-quadratic-demo",
];

/** A per-concept builder for reasoning-adversarial correct / flawed answers. */
interface AdvBuilder {
  /** Realistic CORRECT phrasings (first is the CANONICAL one — must pass). */
  correct: (q: MockNumericQuestion, adv: FollowupPresentation) => string[];
  /** FLAWED phrasings that must be REJECTED (wrong value AND/OR wrong logic). */
  flawed: (q: MockNumericQuestion, adv: FollowupPresentation) => string[];
}

/** conclusionTargets[0] as a formatted string (safe when present). */
const t0 = (a: FollowupPresentation) => fmt((a.conclusionTargets ?? [0])[0]);
/**
 * A value that is CLEARLY wrong for a sequence target — far outside the grader's
 * relative tolerance even for the large values geometric sequences reach (r⁸),
 * so a flawed answer is never accepted on a near-miss coincidence.
 */
const wrong = (a: FollowupPresentation) => fmt((a.conclusionTargets ?? [0])[0] * 3 + 13);

/**
 * Per-concept adversarial answer banks, keyed by the LONGEST matching `q.id`
 * prefix. Correct answers deliberately include phrasings OUTSIDE the keyword
 * bank (relying on the value where the mode allows) to probe true recall.
 */
const ADV: Record<string, AdvBuilder> = {
  "pev-bet": {
    correct: (_q, a) => [
      `It doubles — the new EV is ${t0(a)}.`,
      `EV scales linearly with the stakes, so it's ${t0(a)} now.`,
      `Twice as big: ${t0(a)}.`,
      `Proportional to the payoffs, hence ${t0(a)}.`,
    ],
    flawed: (q) => [
      `It stays the same at ${fmt(q.answer)}.`,
      `It halves to ${fmt(q.answer / 2)}.`,
      `No change; probabilities are what matter.`,
    ],
  },
  "pev-twoof3": {
    correct: () => [
      `Zero — mutually exclusive events can't both occur, let alone two.`,
      `It's impossible, so 0.`,
      `0; at most one of them can happen.`,
      `Since they cannot both happen, the probability is 0.`,
    ],
    flawed: (q) => [
      `Still 3p²(1−p), about ${fmt(q.answer)}.`,
      `Yes, it's unchanged.`,
      `Roughly ${fmt(q.answer)}, same as before.`,
    ],
  },
  "pev-2dice-sum": {
    correct: () => [
      `No — only when the distribution is symmetric.`,
      `Not always; it depends on the skew of the distribution.`,
      `No, the mean and mode differ for skewed distributions.`,
    ],
    flawed: () => [
      `Yes, they're always equal.`,
      `Sure, expected value is just the most common outcome.`,
      `Always the same thing.`,
    ],
  },
  "pev-die-reroll": {
    correct: () => [
      `Up — with more rerolls left you can afford to be more selective.`,
      `Higher; you'd hold out for a bigger number.`,
      `The threshold rises because the continuation value increases.`,
    ],
    flawed: () => [
      `It goes down, you'd keep lower rolls.`,
      `Stays the same.`,
      `Suppose it doesn't change at all.`,
    ],
  },
  "pev-die": {
    // die EV adversarial: E[X²] vs (E[X])² — two required concept groups.
    correct: () => [
      `No, E[X²] is larger; the difference is the variance.`,
      `They're not equal — E[X²] exceeds (E[X])² by the variance.`,
      `Unequal; E[X²] > (E[X])², and the gap equals the variance.`,
    ],
    flawed: () => [
      `Yes, they're equal.`,
      `No, they differ by the standard deviation.`,
      `E[X²] is bigger, by some amount.`,
    ],
  },
  "pev-coin": {
    correct: (_q, a) => [
      `By symmetry, ${t0(a)} heads — a fair coin mirrors heads and tails.`,
      `${t0(a)}; it's the complement you get by swapping heads and tails.`,
      `Same probability as ${t0(a)} heads, by the fair-coin symmetry.`,
    ],
    flawed: (_q, a) => [
      `${fmt((a.conclusionTargets ?? [0])[0] + 1)} heads, by symmetry.`,
      `The same ${t0(a)}, because it's random.`,
      `About half, roughly.`,
    ],
  },
  "pev-urn": {
    // Adversarial: is P(both red | ≥1 red) LARGER or SMALLER than the
    // unconditional P(both red)? Correct = LARGER (no-red cases are removed).
    correct: () => [
      `Larger — conditioning on at least one red removes the no-red outcomes, so it rises.`,
      `Greater than the unconditional value, since you divide by P(≥1 red) which is below 1.`,
      `It's higher; eliminating the both-blue cases concentrates the mass onto both-red.`,
    ],
    flawed: () => [
      `Smaller — conditioning always shrinks a probability.`,
      `The same; conditioning on at least one red changes nothing.`,
      `Lower, because you added a restriction.`,
    ],
  },
  "pev-geo": {
    // Adversarial: as per-attempt p → 0, the first mover's win probability
    // approaches 1/2 (the head-start advantage fades). Correct = 1/2 / even.
    correct: () => [
      `It approaches 1/2 — as success becomes rare, moving first barely matters, so the edge fades to even.`,
      `Toward one half; with tiny p the head start almost never converts, so it becomes symmetric.`,
      `1/2 — the first-move advantage disappears in the limit.`,
    ],
    flawed: () => [
      `It stays the same; the first mover keeps the edge.`,
      `It approaches 1 — the first mover is basically certain to win.`,
      `No change — the first mover still keeps the edge.`,
    ],
  },
  "pev-condgeo": {
    correct: () => [
      `No, it doesn't depend on that — the geometric process is memoryless.`,
      `It's the same distribution regardless; that's memorylessness.`,
      `No memory here, so the count of earlier tails is irrelevant.`,
    ],
    flawed: () => [
      `Yes, more early tails make later flips likelier.`,
      `It changes with the number of tails you were told.`,
      `Sure, the past shifts the odds.`,
    ],
  },
  "pev-choose": {
    correct: (_q, a) => [
      `${t0(a)} — giving distinct roles orders the choices, a permutation.`,
      `With numbered seats it's ${t0(a)}, since you now arrange the chosen people.`,
      `${t0(a)}; that's the ordered count (permutations, not combinations).`,
    ],
    flawed: (q) => [
      `Same as before, ${fmt(q.answer)}.`,
      `It's ${fmt(q.answer)}; order doesn't matter here.`,
      `Unchanged committee count.`,
    ],
  },
  "pev-max2dice": {
    correct: () => [
      `E[max] + E[min] = 7, which checks out against E[sum].`,
      `They sum to 7, consistent with two dice.`,
      `7 — it equals E[sum of two dice], so it's consistent.`,
    ],
    flawed: () => [
      `About 4.47 for each, so around 8.9.`,
      `They don't have to match.`,
      `Roughly 9 total.`,
    ],
  },
  "pev-bayes": {
    correct: () => [
      `Prevalence — raising the base rate lifts the posterior most.`,
      `The prior, i.e. how common the disease is.`,
      `Base rate; it dominates the posterior here.`,
    ],
    flawed: () => [
      `The false-positive rate.`,
      `The test's specificity matters most.`,
      `Sensitivity would move it more.`,
    ],
  },
  "pev-lattice": {
    correct: () => [
      `Greater than half — the paths intersect most of the time, about 0.8.`,
      `More than 1/2; it's roughly 3273/4096 ≈ 0.8.`,
      `It's more likely than not that they cross — well above half.`,
      `Above half; two monotone walkers headed at each other usually share a vertex.`,
    ],
    flawed: () => [
      `Less than half — they rarely meet.`,
      `Under half, maybe a quarter.`,
      `About 0.5, basically a coin flip.`,
    ],
  },
  "pev-ruin": {
    correct: () => [
      `Up — a favorable bias raises it, pushing P(reach the target) toward 1.`,
      `Higher; with an edge it increases and approaches 1.`,
      `It goes up, closer to 1 as the edge grows.`,
    ],
    flawed: () => [
      `Down, the bias lowers it.`,
      `It stays the same regardless of the edge.`,
      `Lower, toward 0.`,
    ],
  },
  "pev-ord3": {
    correct: () => [
      `It increases toward 6 — more dice make a high max likelier.`,
      `Grows and approaches 6, the maximum face.`,
      `Higher with more dice, limiting at 6.`,
    ],
    flawed: () => [
      `It stays at 3.5.`,
      `Decreases toward the mean.`,
      `Approaches 3.5, the average.`,
    ],
  },
  "pev-pattern": {
    correct: () => [
      `The self-overlapping pattern takes LONGER — a failed match wastes progress.`,
      `Longer for the overlapping one; overlaps cost you flips.`,
      `It waits longer, not a paradox — HH beats HT in expected flips.`,
    ],
    flawed: () => [
      `Shorter — overlapping patterns appear faster.`,
      `They're the same; only length matters.`,
      `Fewer flips for the overlapping pattern.`,
    ],
  },
  "pev-bankroll": {
    correct: () => [
      `It approaches 6 — you keep rerolling until you get the maximum.`,
      `Toward 6, the highest face, since you never settle for less.`,
      `6, the maximum, because with unlimited rerolls you hold out for it.`,
    ],
    flawed: () => [
      `It approaches 3.5.`,
      `Stays at 4.25.`,
      `Around 5, it plateaus.`,
    ],
  },
  "pev-monty": {
    correct: () => [
      `2/3 — the host's reveal is informed, so it's not 50/50.`,
      `Two-thirds; the host knows where the prize is, that's conditional information.`,
      `I'm sure: switching wins 2/3 because the host opens an empty door on purpose.`,
    ],
    flawed: () => [
      `You're right, it's 50/50 once two doors remain.`,
      `Yes, 1/2.`,
      `Half, since two doors are left.`,
    ],
  },
  "pev-citadel-stones": {
    correct: () => [
      `Pass — the EV is -0.5 per dollar, since you're 75% it's black.`,
      `I decline; the bet's EV to me is -$0.50.`,
      `Don't take it: -0.5 EV per dollar.`,
    ],
    flawed: () => [
      `Take it, EV +0.5.`,
      `Sure, I'd bet — positive 0.5.`,
      `Accept; it's a fair coin flip.`,
    ],
  },
  "pev-sig-confbet": {
    correct: () => [
      `Stake $50, and that's more than at 60% confidence.`,
      `$50 — a bigger edge means a bigger stake.`,
      `f = 0.5, so $50; higher than the 60% case.`,
    ],
    flawed: () => [
      `$50, but I'd bet less than at 60%.`,
      `About $20, and the same regardless of confidence.`,
      `Bet it all, $100.`,
    ],
  },
  // Coupon collector: total grows FASTER than the number of faces (~k·ln k),
  // and the value for the other die (mode "any" ⇒ keyword OR value passes).
  "pev-coupon": {
    correct: (_q, a) => [
      `It grows faster than the face count — a harmonic k·H_k.`,
      `${t0(a)} rolls, and it climbs faster than the number of faces.`,
      `Grows faster; the total scales like k times ln k.`,
      `${t0(a)} — the harmonic sum grows faster than the die size.`,
    ],
    flawed: () => [
      `It's linear — doubling the faces doubles the rolls.`,
      `Proportional to the number of faces.`,
      `Just k, in proportion to the faces.`,
    ],
  },
  // Birthday paradox: more people than days ⇒ a shared day is CERTAIN (pigeonhole).
  "pev-birthday": {
    correct: () => [
      `Exactly 1 — by the pigeonhole principle, more people than days forces a shared day.`,
      `Certain, so it's 1; you can't seat everyone on distinct days.`,
      `The probability is 1 — pigeonhole guarantees a collision.`,
    ],
    flawed: () => [
      `It's still less than 1, not guaranteed.`,
      `About 0.5, roughly even.`,
      `It stays the same as before.`,
    ],
  },
  // Derangements: as n → ∞ the probability tends to 1/e ≈ 0.3679.
  "pev-derange": {
    correct: () => [
      `It tends to 1/e ≈ 0.3679 — the alternating series is the expansion of e inverse.`,
      `The reciprocal of e, about 0.37.`,
      `It settles at 1/e, one over e.`,
    ],
    flawed: () => [
      `It approaches 0 as n grows.`,
      `It goes to 1 — everything gets deranged.`,
      `About 1/2.`,
    ],
  },
  // HARD market-making-anchor Fermi (the retained estimation generator).
  // Adversarial: total is LINEAR in the refresh rate ⇒ 2× rate = 2× messages.
  "est-mmquotes": {
    correct: (_q, a) => [
      `Double the refresh rate doubles it to ${t0(a)}; the total is linear in the rate.`,
      `${t0(a)} — it scales proportionally with the refresh rate.`,
      `Twice as many messages: ${t0(a)}, linear in R.`,
    ],
    flawed: (q) => [
      `Still ${fmt(q.answer)}, the rate doesn't matter.`,
      `It would quadruple.`,
      `Non-linear; hard to say.`,
    ],
  },
  "est-stadium": {
    correct: (_q, a) => [
      `Double the spend doubles it to ${t0(a)}; the relationship is linear.`,
      `${t0(a)} — it scales proportionally with per-person spend.`,
      `Twice as much: ${t0(a)}, linear in spend.`,
    ],
    flawed: (q) => [
      `Still ${fmt(q.answer)}, spend doesn't matter.`,
      `It would quadruple.`,
      `Non-linear; hard to say.`,
    ],
  },
  "est-cars": {
    correct: () => [
      `The car-ownership rate dominates — it's a guess, so I'd sharpen that assumption.`,
      `Ownership proportion is the shaky input; population is roughly known.`,
      `The 1-in-k ownership guess drives the uncertainty.`,
    ],
    flawed: () => [
      `The population, since cities vary a lot.`,
      `Nothing dominates; both are exact.`,
      `The number of trips per day.`,
    ],
  },
  "est-search": {
    correct: (_q, a) => [
      `Double the per-day rate doubles the yearly total to ${t0(a)}; linear.`,
      `${t0(a)} — it scales proportionally, a factor of two.`,
      `Twice as many: ${t0(a)}.`,
    ],
    flawed: (q) => [
      `Still ${fmt(q.answer)}.`,
      `It would square.`,
      `Hard to say, non-linear.`,
    ],
  },
  "est-heart": {
    correct: () => [
      `The heart rate assumption drives it — minutes per year are essentially fixed.`,
      `The bpm guess; lifespan and calendar are near-exact.`,
      `How many beats per minute you assume matters most.`,
    ],
    flawed: () => [
      `The number of minutes in a year.`,
      `The days-per-year factor.`,
      `Nothing; it's all exact.`,
    ],
  },
  // Sequences: adversarial = "state the RULE and give the value at position N".
  // Mode is "any": the un-guessable far value proves the rule, so value-only
  // (even with a formula phrased OUTSIDE the keyword bank) must pass, AND a
  // correctly-named rule without the value must pass. Only BOTH-wrong is missed.
  "seqn-arith": {
    correct: (_q, a) => [
      t0(a),
      `aₙ = aₙ₋₁ + d, so position 9 is ${t0(a)}.`,
      `Add the common difference each step; it's ${t0(a)}.`,
      `Arithmetic sequence.`,
    ],
    flawed: (_q, a) => [
      `${wrong(a)}, no consistent rule — it looks random.`,
      `${wrong(a)} — it's geometric, you multiply each term.`,
      `${wrong(a)}; the second differences are constant.`,
    ],
  },
  "seqn-geo": {
    correct: (_q, a) => [
      t0(a),
      `Multiply by the constant ratio; term is ${t0(a)}.`,
      `aₙ = a₀·rⁿ, giving ${t0(a)}.`,
      `Geometric sequence.`,
    ],
    flawed: (_q, a) => [
      `${wrong(a)}, no consistent rule — it looks random.`,
      `${wrong(a)} — it's arithmetic, just add a constant each time.`,
      `${wrong(a)}; the second differences are constant.`,
    ],
  },
  "seqn-poly": {
    correct: (_q, a) => [
      t0(a),
      `The second differences are constant, so it's ${t0(a)}.`,
      `Quadratic in n; value ${t0(a)}.`,
      `A parabola / n² pattern.`,
    ],
    flawed: (_q, a) => [
      `${wrong(a)}, no consistent rule — it looks random.`,
      `${wrong(a)} — it's linear, add a fixed amount.`,
      `${wrong(a)}; geometric doubling each step.`,
    ],
  },
  // The PINNED Optiver demo. Its adversarial switches to a DIFFERENT quadratic
  // (4, 9, 18, 31, 48 → aₙ = 2n² − n + 3) and uses the "fit aₙ = a·n² + b·n + c"
  // framing: state the leading coefficient (a = 2) AND why three points pin all
  // three coefficients. Requires BOTH signals (mode "all").
  "seqn-poly-demo": {
    correct: () => [
      `a = 2, b = −1, c = 3 — three points pin down the three coefficients.`,
      `The leading coefficient is 2; three equations from three shown terms determine a, b, and c.`,
      `a = 2 (half the constant second difference of 4), and a quadratic's three unknowns need three data points.`,
      `a equals 2, since three points give three equations for the three coefficients a, b, c.`,
    ],
    flawed: () => [
      `a = 4, that's just the second difference.`,
      `It's simply n², so a = 1 with no other terms.`,
      `You'd need all five shown terms to fit a quadratic.`,
    ],
  },
  "seqn-cubic": {
    correct: (_q, a) => [
      t0(a),
      `The third differences are constant, so it's ${t0(a)}.`,
      `Cubic in n; value ${t0(a)}.`,
      `An n³ pattern.`,
    ],
    flawed: (_q, a) => [
      `${wrong(a)}, no consistent rule — it looks random.`,
      `${wrong(a)} — it's quadratic, the second differences are constant.`,
      `${wrong(a)}; linear, add a fixed amount.`,
    ],
  },
  "seqn-fib": {
    correct: (_q, a) => [
      `aₙ = aₙ₋₁ + aₙ₋₂, so position 10 is ${t0(a)}.`, // the exact reported repro
      t0(a),
      `Each term is the sum of the previous two.`,
      `It's the Fibonacci rule; the value is ${t0(a)}.`,
      `Add the two before it: ${t0(a)}.`,
    ],
    flawed: (_q, a) => [
      `${wrong(a)}, no consistent rule — it looks random.`,
      `${wrong(a)} — it's arithmetic, add a constant each step.`,
      `${wrong(a)}; geometric, multiply each term.`,
    ],
  },
  "seqn-alt": {
    correct: (_q, a) => [
      t0(a),
      `Operations alternate — add, then multiply — giving ${t0(a)}.`,
      `Every other step switches operation; it's ${t0(a)}.`,
      `Alternating add / multiply.`,
    ],
    flawed: (_q, a) => [
      `${wrong(a)}, no consistent rule — it looks random.`,
      `${wrong(a)} — it's plain arithmetic with a constant difference.`,
      `${wrong(a)}; a geometric ratio each step.`,
    ],
  },
};

/** Route a question id to its adversarial builder (longest prefix wins). */
function advBuilderFor(id: string): AdvBuilder | null {
  const keys = Object.keys(ADV).sort((a, b) => b.length - a.length);
  for (const k of keys) if (id.startsWith(k)) return ADV[k];
  return null;
}

/* -------------------------------------------------------------------------- */
/*  1) QUESTION CORRECTNESS — every generated item is well-formed              */
/* -------------------------------------------------------------------------- */

describe("question correctness — every scored item is mathematically well-formed", () => {
  it("main answers, prompts, and follow-ups are all well-formed and distinct", () => {
    let checked = 0;
    const draw = (g: Gen | (() => MockNumericQuestion), seed: number) =>
      (g as Gen)(new Rng(seed));
    const gens: (Gen)[] = [
      ...ALL_GENS,
      ...ARCHETYPES.map((id) => (rng: Rng) => drawArchetype(rng, id)),
    ];
    for (const g of gens) {
      for (const seed of SEEDS) {
        const q = draw(g, seed);
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.prompt.length).toBeGreaterThan(10);
        expect(q.explanation && q.explanation.length).toBeGreaterThan(5);
        expect(q.concept && q.concept.length).toBeGreaterThan(0);
        const f = q.followups;
        expect(f).toBeTruthy();
        if (!f) continue;
        const { probe, adversarial } = buildFollowupPresentations(f, TARGET_MS);
        // Probe is a genuine, distinct related computation (not the same number).
        expect(probe.prompt.length).toBeGreaterThan(10);
        expect(adversarial.prompt.length).toBeGreaterThan(10);
        expect(probe.prompt).not.toEqual(adversarial.prompt);
        if (probe.answerKind !== "reasoning" && probe.answer != null) {
          expect(Number.isFinite(probe.answer)).toBe(true);
          // The probe deepens — its target isn't just the main answer echoed.
          expect(probe.answer).not.toEqual(q.answer);
        }
        if (adversarial.answerKind === "reasoning") {
          for (const t of adversarial.conclusionTargets ?? [])
            expect(Number.isFinite(t)).toBe(true);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});

/* -------------------------------------------------------------------------- */
/*  2) NUMERIC PROBE accuracy — recall on varied notation, precision on wrong  */
/* -------------------------------------------------------------------------- */

describe("numeric probe grading — recall & precision", () => {
  it("accepts varied correct notations and rejects wrong numbers", () => {
    let recallHit = 0,
      recallTot = 0,
      flawRej = 0,
      flawTot = 0;
    const gens: Gen[] = [
      ...ALL_GENS,
      ...ARCHETYPES.map((id) => (rng: Rng) => drawArchetype(rng, id)),
    ];
    for (const g of gens) {
      for (const seed of SEEDS) {
        const q = g(new Rng(seed));
        const f = q.followups;
        if (!f) continue;
        const { probe } = buildFollowupPresentations(f, TARGET_MS);
        if (probe.answerKind === "reasoning" || probe.answer == null) continue;
        const ans = probe.answer;
        // A numeric probe is a NUMBER-ENTRY field: realistic entries are the
        // bare value and its comma-grouped / currency forms (not prose).
        const correct = Array.from(
          new Set([
            fmt(ans),
            ans.toLocaleString("en-US"),
            `${fmt(ans)} `,
            probe.decimals && probe.decimals > 0 ? ans.toFixed(probe.decimals) : fmt(ans),
          ]),
        );
        for (const c of correct) {
          recallTot++;
          if (accepts(probe, c)) recallHit++;
        }
        const decoys = (probe.commonErrors ?? []).map((e) => e.value);
        const wrong = [fmt(ans + (Number.isInteger(ans) ? 1 : 0.37)), ...decoys.map(fmt)];
        for (const w of wrong) {
          if (parseFloat(w) === ans) continue; // skip degenerate decoy
          flawTot++;
          if (!accepts(probe, w)) flawRej++;
        }
      }
    }
    const recall = recallHit / recallTot;
    const precision = flawRej / flawTot;
    // eslint-disable-next-line no-console
    console.log(
      `[probe] recall=${(recall * 100).toFixed(1)}% (${recallHit}/${recallTot})  flaw-reject=${(precision * 100).toFixed(1)}% (${flawRej}/${flawTot})`,
    );
    expect(recall).toBeGreaterThanOrEqual(0.98);
    expect(precision).toBeGreaterThanOrEqual(0.95);
  });
});

/* -------------------------------------------------------------------------- */
/*  3) REASONING ADVERSARIAL accuracy — the heart of the grading QA            */
/* -------------------------------------------------------------------------- */

describe("reasoning adversarial grading — recall & precision by concept", () => {
  it("accepts varied-but-correct reasoning and rejects flawed reasoning", () => {
    const perType: Record<
      string,
      { rHit: number; rTot: number; fRej: number; fTot: number; canonFN: number }
    > = {};
    const bump = (k: string) =>
      (perType[k] ??= { rHit: 0, rTot: 0, fRej: 0, fTot: 0, canonFN: 0 });

    const gens: Gen[] = [
      ...ALL_GENS,
      ...ARCHETYPES.map((id) => (rng: Rng) => drawArchetype(rng, id)),
    ];
    const canonicalFailures: string[] = [];

    for (const g of gens) {
      for (const seed of SEEDS) {
        const q = g(new Rng(seed));
        const f = q.followups;
        if (!f) continue;
        const { adversarial } = buildFollowupPresentations(f, TARGET_MS);
        if (adversarial.answerKind !== "reasoning") continue;
        const builder = advBuilderFor(q.id);
        if (!builder) {
          throw new Error(`No adversarial corpus for question id "${q.id}"`);
        }
        const bucket = q.id.split("-").slice(0, 2).join("-");
        const m = bump(bucket);

        const corrects = builder.correct(q, adversarial);
        corrects.forEach((c, idx) => {
          m.rTot++;
          const ok = accepts(adversarial, c);
          if (ok) m.rHit++;
          if (idx === 0 && !ok) {
            m.canonFN++;
            canonicalFailures.push(`${q.id} :: "${c}"`);
          }
        });
        for (const w of builder.flawed(q, adversarial)) {
          m.fTot++;
          if (!accepts(adversarial, w)) m.fRej++;
        }
      }
    }

    let rHit = 0,
      rTot = 0,
      fRej = 0,
      fTot = 0,
      canonFN = 0;
    for (const [k, m] of Object.entries(perType).sort()) {
      rHit += m.rHit;
      rTot += m.rTot;
      fRej += m.fRej;
      fTot += m.fTot;
      canonFN += m.canonFN;
      // eslint-disable-next-line no-console
      console.log(
        `[adv ${k.padEnd(16)}] recall=${((m.rHit / m.rTot) * 100).toFixed(1)}%  flaw-reject=${((m.fRej / m.fTot) * 100).toFixed(1)}%  canonFN=${m.canonFN}`,
      );
    }
    const recall = rHit / rTot;
    const precision = fRej / fTot;
    // eslint-disable-next-line no-console
    console.log(
      `[adv TOTAL] recall=${(recall * 100).toFixed(2)}% (${rHit}/${rTot})  flaw-reject=${(precision * 100).toFixed(2)}% (${fRej}/${fTot})  canonicalFN=${canonFN}`,
    );

    expect(canonicalFailures, canonicalFailures.join("\n")).toHaveLength(0);
    expect(recall).toBeGreaterThanOrEqual(0.98);
    expect(precision).toBeGreaterThanOrEqual(0.95);
  });
});

/* -------------------------------------------------------------------------- */
/*  4) REGRESSION — the exact reported bug + every sequence sibling            */
/* -------------------------------------------------------------------------- */

describe("regression: sequence 'state the rule + value' adversarial (reported bug)", () => {
  const seqGens: [string, Gen][] = [
    ["arithmetic", _pools.SEQUENCE_MEDIUM[0]],
    ["geometric", _pools.SEQUENCE_MEDIUM[1]],
    ["fibonacci", _pools.SEQUENCE_MEDIUM[2]],
    ["quadratic", _pools.SEQUENCE_HARD[0]],
    ["alternating", _pools.SEQUENCE_HARD[1]],
  ];

  it("a correct rule + correct far-value grades CORRECT across many seeds & phrasings", () => {
    for (const [name, g] of seqGens) {
      for (const seed of SEEDS) {
        const q = g(new Rng(seed));
        const { adversarial } = buildFollowupPresentations(q.followups!, TARGET_MS);
        const fv = (adversarial.conclusionTargets ?? [NaN])[0];
        expect(Number.isFinite(fv)).toBe(true);
        // Value stated with a rule phrased OUTSIDE our keyword bank must pass.
        expect(accepts(adversarial, `The value at that position is ${fv}.`)).toBe(true);
        // Bare correct value must pass (it proves the rule for this family).
        expect(accepts(adversarial, `${fv}`), `${name} bare value`).toBe(true);
      }
    }
  });

  it("the Fibonacci repro (recurrence notation + value) grades CORRECT", () => {
    const fib = _pools.SEQUENCE_MEDIUM[2];
    for (const seed of SEEDS) {
      const q = fib(new Rng(seed));
      const { adversarial } = buildFollowupPresentations(q.followups!, TARGET_MS);
      const fv = (adversarial.conclusionTargets ?? [NaN])[0];
      const answer = `Each term is aₙ = aₙ₋₁ + aₙ₋₂ (Fibonacci-style); position 10 is ${fv}.`;
      expect(accepts(adversarial, answer)).toBe(true);
      // A correct rule with NO computed value also earns credit.
      expect(accepts(adversarial, `It's the sum of the previous two terms.`)).toBe(true);
    }
  });

  it("a wrong rule AND wrong value grades MISSED (no false positive)", () => {
    for (const [, g] of seqGens) {
      for (const seed of SEEDS.slice(0, 12)) {
        const q = g(new Rng(seed));
        const { adversarial } = buildFollowupPresentations(q.followups!, TARGET_MS);
        const fv = (adversarial.conclusionTargets ?? [0])[0];
        // Wrong number (far off) + no correct rule for ANY family.
        expect(
          accepts(adversarial, `${fv * 3 + 13}, no consistent rule — it looks random.`),
        ).toBe(false);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  5) keywordHit unit guards — the precision fix for short words              */
/* -------------------------------------------------------------------------- */

describe("keywordHit — whole-word matching for short words, substring for long", () => {
  it("short alpha words don't fire inside longer words", () => {
    expect(keywordHit("it is clearly known to be 10", "no")).toBe(false);
    expect(keywordHit("suppose it doesn't change", "up")).toBe(false);
    expect(keywordHit("the value is accurate", "rate")).toBe(false);
    expect(keywordHit("i'd bet less unless forced", "less")).toBe(true);
    expect(keywordHit("unless you tell me more", "less")).toBe(false);
  });
  it("longer keywords still match natural inflections", () => {
    expect(keywordHit("the ev doubles here", "double")).toBe(true);
    expect(keywordHit("it resets each draw", "reset")).toBe(true);
    expect(keywordHit("it scales proportionally", "proportional")).toBe(true);
    expect(keywordHit("that's the variance", "variance")).toBe(true);
  });
});
