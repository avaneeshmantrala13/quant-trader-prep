/**
 * THE TRADING FLOOR — procedural dice scenarios (seed-infinite, exact fair).
 *
 * Two packs share the same hidden truth (a sequence of die rolls) so their
 * `fair` is an EXACT martingale and their `settle` is exact — ideal for the
 * property tests:
 *   • quantity: quote the FINAL total; fair = revealed sum + E[remaining].
 *   • binary:   quote a 0/1 "total exceeds the line?" contract; fair is the exact
 *     tail probability of the remaining dice via a small DP (the calibration
 *     core — your mid IS your stated probability).
 */
import type { Rng } from "@/lib/rng";
import type { Posterior, RevealInfo, Scenario } from "../types";

const FACES = 6;
const DIE_MEAN = (FACES + 1) / 2; // 3.5
const DIE_VAR = (FACES * FACES - 1) / 12; // 35/12

interface DiceTruth {
  rolls: number[];
  /** Over/under line (binary packs only). */
  line: number;
}

/** Exact pmf of the sum of `m` fair `FACES`-sided dice, indexed by actual sum. */
function sumDicePmf(m: number): number[] {
  let dist = [1]; // sum of 0 dice = 0 with prob 1 (index 0)
  for (let d = 0; d < m; d++) {
    const next = new Array(dist.length + FACES).fill(0);
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] === 0) continue;
      for (let f = 1; f <= FACES; f++) next[i + f] += dist[i] / FACES;
    }
    dist = next;
  }
  return dist;
}

/** P(sum of `m` dice > threshold). */
export function probSumOver(m: number, threshold: number): number {
  if (m <= 0) return 0 > threshold ? 1 : 0;
  const pmf = sumDicePmf(m); // index === actual sum
  let p = 0;
  for (let sum = 0; sum < pmf.length; sum++) {
    if (sum > threshold) p += pmf[sum];
  }
  return p;
}

function revealedSum(revealed: RevealInfo[]): number {
  return revealed.reduce((s, r) => s + (r.value ?? 0), 0);
}

function drawRolls(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => rng.int(1, FACES));
}

/** Quote the final total of `n` dice, revealed one at a time. */
export function diceQuantityScenario(n = 8): Scenario<DiceTruth> {
  return {
    id: `dice-total-${n}`,
    kind: "quantity",
    title: "Running Total",
    prompt: `Make a market on the FINAL total of ${n} dice as they're rolled one at a time.`,
    unit: "pips",
    rounds: n,
    drawTruth(rng) {
      return { rolls: drawRolls(rng, n), line: 0 };
    },
    reveal(truth, r) {
      const v = truth.rolls[r];
      return { round: r, label: `Die ${r + 1} rolled ${v}`, value: v };
    },
    fair(truth, revealed) {
      const seen = revealed.length;
      const remaining = truth.rolls.length - seen;
      return revealedSum(revealed) + remaining * DIE_MEAN;
    },
    settle(truth) {
      return truth.rolls.reduce((s, x) => s + x, 0);
    },
    posterior(truth, revealed): Posterior {
      const remaining = truth.rolls.length - revealed.length;
      return {
        mean: revealedSum(revealed) + remaining * DIE_MEAN,
        sd: Math.sqrt(Math.max(0, remaining) * DIE_VAR),
      };
    },
  };
}

/** Quote a 0/1 "final total exceeds the line?" contract (calibration core). */
export function diceBinaryScenario(n = 8): Scenario<DiceTruth> {
  return {
    id: `dice-over-under-${n}`,
    kind: "binary",
    title: "Over / Under",
    prompt: `Price the 0/1 contract "will the total of ${n} dice EXCEED the line?" — your mid is your probability.`,
    unit: "",
    rounds: n,
    drawTruth(rng) {
      const rolls = drawRolls(rng, n);
      const mean = n * DIE_MEAN;
      // A line near the mean so the contract starts close to a coin-flip.
      const line = Math.round(mean) + rng.int(-2, 1);
      return { rolls, line };
    },
    reveal(truth, r) {
      const v = truth.rolls[r];
      return { round: r, label: `Die ${r + 1} rolled ${v}`, value: v };
    },
    fair(truth, revealed) {
      const seen = revealed.length;
      const remaining = truth.rolls.length - seen;
      const need = truth.line - revealedSum(revealed);
      return probSumOver(remaining, need);
    },
    settle(truth) {
      const total = truth.rolls.reduce((s, x) => s + x, 0);
      return total > truth.line ? 1 : 0;
    },
    posterior(truth, revealed): Posterior {
      const seen = revealed.length;
      const remaining = truth.rolls.length - seen;
      const need = truth.line - revealedSum(revealed);
      const v = probSumOver(remaining, need);
      return { mean: v, sd: Math.sqrt(v * (1 - v)) };
    },
  };
}
