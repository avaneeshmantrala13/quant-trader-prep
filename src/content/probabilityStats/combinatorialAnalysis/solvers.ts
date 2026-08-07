import Fraction from "fraction.js";
import {
  F,
  binomTailGE,
  binomTailLE,
  binomTailLEFloat,
  chooseBig,
  factorialBig,
  fallingBig,
  fracBig,
  multinomialBig,
  powBig,
} from "./combinatorics";

/**
 * Exact family solvers for the **Combinatorial Analysis** subcategory. Each
 * function computes the ground-truth answer for one counting technique via
 * EXACT integer / rational arithmetic (bigint counts + `fraction.js` rationals),
 * so the whole dataset is correct by construction and every generated instance
 * is verified against the solver at its stated precision.
 *
 * Organised family-by-family, matching the dataset's ~10 counting families:
 *   1. Choose-k ratios (favorable / total combinations)
 *   2. Hypergeometric draws (exactly-j / no-special)
 *   3. Poker hands (five-card draw)
 *   4. Binomial coin/dice sequence counting
 *   5. Dice sum / order counting (stars & bars + inclusion–exclusion)
 *   6. Without-replacement sequences / chain rule
 *   7. Balance-scale symmetry
 *   8. Grid / lattice-path & line counting
 *   9. Circular / arrangement counting
 *  10. Multiplication principle (independent choices, incl–excl, secret-sharing)
 *  + the coin-grab value-threshold count.
 *
 * NONE of the 51 source questions are user-facing, they live only in
 * `./combinatorialAnalysis.test.ts` as hidden fixtures; every playable item is a
 * freshly generated instance built from these solvers.
 */

/* ========================================================================== */
/*  FAMILY 1. Choose-k ratios (favorable / total combinations)                */
/* ========================================================================== */

/**
 * P(a draw of `draw` from an urn with the given color `counts` (no replacement)
 * contains exactly ONE of each color), requires `draw === counts.length`.
 * Favorable = ∏ C(cᵢ, 1) = ∏ cᵢ; total = C(Σcᵢ, draw). (CA1: [10,10,10],3 → 0.2463)
 */
export function oneOfEachColorProb(counts: number[], draw: number): Fraction {
  const total = counts.reduce((a, b) => a + b, 0);
  let fav = 1n;
  for (const c of counts) fav *= BigInt(c);
  return fracBig(fav, chooseBig(total, draw));
}

/**
 * P(all `draw` cards are the SAME color) from an urn with color `counts`.
 * = Σ C(cᵢ, draw) / C(Σcᵢ, draw). (CA26: [3,4,2],3 → 5/84 ≈ 0.060)
 */
export function allSameColorProb(counts: number[], draw: number): Fraction {
  const total = counts.reduce((a, b) => a + b, 0);
  let fav = 0n;
  for (const c of counts) fav += chooseBig(c, draw);
  return fracBig(fav, chooseBig(total, draw));
}

/**
 * P(the draw shows EXACTLY TWO of the available colors). Choose the color pair,
 * draw all from those two, subtract the all-from-one-color triples:
 * Σ_{i<j} [C(cᵢ+cⱼ, draw) − C(cᵢ, draw) − C(cⱼ, draw)] / C(N, draw).
 * (CA27: [3,4,2],3 → 55/84 ≈ 0.65)
 */
export function exactlyTwoColorsProb(counts: number[], draw: number): Fraction {
  const total = counts.reduce((a, b) => a + b, 0);
  let fav = 0n;
  for (let i = 0; i < counts.length; i++) {
    for (let j = i + 1; j < counts.length; j++) {
      fav +=
        chooseBig(counts[i] + counts[j], draw) -
        chooseBig(counts[i], draw) -
        chooseBig(counts[j], draw);
    }
  }
  return fracBig(fav, chooseBig(total, draw));
}

/**
 * P(a draw of `k` from `n` items, exactly ONE of which is "special/even" —
 * AVOIDS the special item), = C(n−1, k) / C(n, k). For the prime-sum problem
 * (CA41) k is even so the k chosen odds sum even ⟺ the lone even prime is avoided.
 * (CA41: n=16, k=4 → 3/4)
 */
export function avoidOneSpecialProb(n: number, k: number): Fraction {
  return fracBig(chooseBig(n - 1, k), chooseBig(n, k));
}

/**
 * P(the sum of two distinct tickets drawn from {1..m} is ≥ `threshold`).
 * Exact pair count / C(m, 2). (CA49: m=10, threshold=12 → 20/45 = 4/9)
 */
export function pairSumAtLeastProb(m: number, threshold: number): Fraction {
  let fav = 0n;
  for (let a = 1; a <= m; a++) {
    for (let b = a + 1; b <= m; b++) if (a + b >= threshold) fav += 1n;
  }
  return fracBig(fav, chooseBig(m, 2));
}

/**
 * P(a single uniformly-random assignment matching `k` of `n` slots is the unique
 * correct one) = 1 / C(n, k). (CA5: choose which 4 of 7 get pasta → 1/35)
 */
export function oneCorrectAssignmentProb(n: number, k: number): Fraction {
  return fracBig(1n, chooseBig(n, k));
}

/**
 * P(each of `players` hands of `handSize` cards, dealt from a deck of
 * players·handSize, receives exactly one of the `players` special cards) =
 * handSize^players / C(players·handSize, players). (CA3: 13⁴/C(52,4) ≈ 0.105)
 */
export function eachPlayerOneSpecialProb(players: number, handSize: number): Fraction {
  const deck = players * handSize;
  return fracBig(powBig(handSize, players), chooseBig(deck, players));
}

/**
 * P(all three colors are first seen exactly on the 4th draw) from a 3-color urn
 * with `counts`. The first 3 draws must show exactly the two non-missing colors
 * (both present), then the 4th is the missing color. Sum over the missing color:
 * [C(N−cₖ,3) − Σ_{i≠k} C(cᵢ,3)]/C(N,3) · cₖ/(N−3). (CA28: [3,4,2] → 2/7 ≈ 0.286)
 */
export function firstAllThreeOnDrawFourProb(counts: number[]): Fraction {
  const N = counts.reduce((a, b) => a + b, 0);
  let p = F(0);
  for (let k = 0; k < counts.length; k++) {
    const others = N - counts[k];
    let allOneOfOthers = 0n;
    for (let i = 0; i < counts.length; i++) if (i !== k) allOneOfOthers += chooseBig(counts[i], 3);
    const exactlyTwo = chooseBig(others, 3) - allOneOfOthers;
    const firstThree = fracBig(exactlyTwo, chooseBig(N, 3));
    const fourthMissing = F(counts[k], N - 3);
    p = p.add(firstThree.mul(fourthMissing));
  }
  return p;
}

/**
 * P(three chips drawn one at a time (no replacement) come out in NON-DECREASING
 * value order), for a jar with `distinctValues` values and `copiesPer` copies of
 * each. Split by handful type, all-different (fraction 1/6), one repeated value
 * (1/3), all three equal (1), over C(v·c, 3). (CA32: v=5, c=3 → 22/91 ≈ 0.242)
 */
export function nonDecreasingThreeDrawProb(distinctValues: number, copiesPer: number): Fraction {
  const v = distinctValues;
  const c = copiesPer;
  const allDiff = chooseBig(v, 3) * powBig(c, 3);
  const onePair = BigInt(v) * chooseBig(c, 2) * BigInt(v - 1) * BigInt(c);
  const triple = BigInt(v) * chooseBig(c, 3);
  const total = chooseBig(v * c, 3);
  const fav = F(allDiff.toString())
    .mul(F(1, 6))
    .add(F(onePair.toString()).mul(F(1, 3)))
    .add(F(triple.toString()));
  return fav.div(F(total.toString()));
}

/* ========================================================================== */
/*  FAMILY 2. Hypergeometric draws                                             */
/* ========================================================================== */

/**
 * Hypergeometric P(exactly `j` special in a draw of `k`) from `N` items with `m`
 * special: C(m,j)·C(N−m,k−j) / C(N,k). (CA10: N=25,m=5,k=6,j=2 → 0.27)
 */
export function hyperExactlyProb(N: number, m: number, k: number, j: number): Fraction {
  return fracBig(chooseBig(m, j) * chooseBig(N - m, k - j), chooseBig(N, k));
}

/**
 * Hypergeometric P(NO special in a draw of `k`) = C(N−m,k)/C(N,k).
 * (CA45: N=52, m=4, k=10 → 246/595 ≈ 0.4134; needs bigint for C(52,10))
 */
export function hyperNoneProb(N: number, m: number, k: number): Fraction {
  return fracBig(chooseBig(N - m, k), chooseBig(N, k));
}

/** Hypergeometric P(at least `j` special in a draw of `k`) = Σ_{t≥j} P(exactly t). */
export function hyperAtLeastProb(N: number, m: number, k: number, j: number): Fraction {
  let s = F(0);
  for (let t = j; t <= Math.min(m, k); t++) s = s.add(hyperExactlyProb(N, m, k, t));
  return s;
}

/* ========================================================================== */
/*  FAMILY 3. Poker hands (five-card draw)                                     */
/* ========================================================================== */

export type PokerHand =
  | "fourOfAKind"
  | "fullHouse"
  | "twoPair"
  | "threeOfAKind"
  | "onePair"
  | "flush";

/** Exact count of five-card hands of the given category (standard 52-card deck). */
export function pokerHandCount(hand: PokerHand): bigint {
  const C = chooseBig;
  switch (hand) {
    case "fourOfAKind":
      return 13n * 48n; // quad rank × any 5th card
    case "fullHouse":
      return 13n * C(4, 3) * 12n * C(4, 2);
    case "twoPair":
      return C(13, 2) * C(4, 2) * C(4, 2) * 44n;
    case "threeOfAKind":
      return 13n * C(4, 3) * C(12, 2) * C(4, 1) * C(4, 1);
    case "onePair":
      return 13n * C(4, 2) * C(12, 3) * C(4, 1) ** 3n;
    case "flush": // includes straight flushes
      return C(4, 1) * C(13, 5);
  }
}

/** P(a random five-card hand is the given category) = count / C(52,5). */
export function pokerHandProb(hand: PokerHand): Fraction {
  return fracBig(pokerHandCount(hand), chooseBig(52, 5));
}

/** Same probability expressed as a PERCENT (value in [0,100]), the dataset's poker convention. */
export function pokerHandPercent(hand: PokerHand): Fraction {
  return pokerHandProb(hand).mul(100);
}

/* ========================================================================== */
/*  FAMILY 4. Binomial coin/dice sequence counting                            */
/* ========================================================================== */

export { binomTailLE, binomTailGE };

/**
 * P(a symmetric ±1 walk of `steps` fair steps returns to the origin) =
 * C(steps, steps/2) / 2^steps (steps even). (CA39: 10 → 252/1024 = 0.246)
 */
export function returnToOriginProb(steps: number): Fraction {
  const half = steps / 2;
  return fracBig(chooseBig(steps, half), powBig(2, steps));
}

/**
 * Number of ±1 step SEQUENCES of `steps` moves that end at displacement `end`
 * from 0: r = (steps+end)/2 right-moves, count = C(steps, r). Integer.
 * (CA50: steps=12, end=2 → C(12,7) = 792)
 */
export function stepSequencesCount(steps: number, end: number): bigint {
  const r = (steps + end) / 2;
  if (!Number.isInteger(r) || r < 0 || r > steps) return 0n;
  return chooseBig(steps, r);
}

/**
 * P(two walkers taking shortest opposite-corner routes on an `n`×`n` grid, each
 * step by a fair coin, MEET) = Σ_i C(n,i)² / 4^n = C(2n,n)/4^n.
 * (CA22: n=4 → 70/256 ≈ 0.27)
 */
export function latticeMeetingProb(n: number): Fraction {
  return fracBig(chooseBig(2 * n, n), powBig(4, n));
}

/**
 * P(a race to `target` points, one point per fair flip, lasts the MAXIMUM
 * 2·target−1 flips, i.e. reaches target−target then the decider) =
 * C(2·target−2, target−1) / 2^{2·target−2}. (CA14: target=4 → 20/64 = 5/16)
 */
export function maxLengthRaceProb(target: number): Fraction {
  const m = 2 * target - 2;
  return fracBig(chooseBig(m, target - 1), powBig(2, m));
}

/**
 * P(the FIRST-flipping player A wins a first-to-`target` fair-flip race, GIVEN
 * the first flip is A's point AND the game ends exactly on flip `totalFlips`).
 * Exact enumeration of all length-`totalFlips` H/T sequences with first = H that
 * end (a player first reaches `target`) exactly on the last flip.
 * (CA15: target=4, totalFlips=6 → 3/5 = 0.6)
 */
export function raceConditionalWinProb(target: number, totalFlips: number): Fraction {
  let aWins = 0n;
  let bWins = 0n;
  const total = 1 << totalFlips;
  for (let mask = 0; mask < total; mask++) {
    // bit i (from most significant = flip 1): 1 = A's point (H), 0 = B's point (T)
    if (!(mask & (1 << (totalFlips - 1)))) continue; // first flip must be A's (H)
    let a = 0;
    let b = 0;
    let endsAt = -1;
    let winner = 0;
    for (let i = 0; i < totalFlips; i++) {
      const isA = (mask & (1 << (totalFlips - 1 - i))) !== 0;
      if (isA) a++;
      else b++;
      if (a === target || b === target) {
        endsAt = i;
        winner = a === target ? 1 : 2;
        break;
      }
    }
    if (endsAt !== totalFlips - 1) continue; // must end exactly on the last flip
    if (winner === 1) aWins += 1n;
    else bWins += 1n;
  }
  return fracBig(aWins, aWins + bWins);
}

/**
 * P(the trailing side wins a first-to-`target` fair-flip race, GIVEN the first
 * flip already went to the other side), the "Heads wins the race" conditioning:
 * with `rem = 2·target−1` flips remaining (dataset uses target=5, first flip
 * Tails ⇒ Heads wins unless total tails ≤ target−1). Returned as P(Heads wins).
 * (CA9: target=5, first flip Tails → Σ_{k=0}^{3} C(9,k)/2⁹ ≈ 0.254 is P(tails lose))
 */
export function coinRaceHeadsWinProb(totalFlips: number, targetTailsToLose: number): Fraction {
  // After the forced first Tails, remaining = totalFlips−1 fair flips; Heads wins
  // unless the FINAL tails count ≤ target−1, i.e. ≤ targetTailsToLose more tails.
  return binomTailLE(totalFlips - 1, F(1, 2), targetTailsToLose);
}

/* ========================================================================== */
/*  FAMILY 5. Dice sum / order counting (stars & bars + inclusion–exclusion)   */
/* ========================================================================== */

/** Distribution of the sum of `dice` d-`faces` dice, as a count Map (exact). */
export function diceSumDistribution(dice: number, faces: number): Map<number, bigint> {
  let dist = new Map<number, bigint>([[0, 1n]]);
  for (let d = 0; d < dice; d++) {
    const next = new Map<number, bigint>();
    for (const [s, c] of dist) {
      for (let f = 1; f <= faces; f++) {
        next.set(s + f, (next.get(s + f) ?? 0n) + c);
      }
    }
    dist = next;
  }
  return dist;
}

/**
 * P(the sum of `dice` d-`faces` dice equals `target`), stars & bars capped by
 * inclusion–exclusion on the ≤faces constraint, computed here by exact
 * convolution. (CA42: 4 d6, target 17 → 104/1296 = 13/162 ≈ 0.0802)
 */
export function diceSumEqualsProb(dice: number, faces: number, target: number): Fraction {
  const dist = diceSumDistribution(dice, faces);
  const fav = dist.get(target) ?? 0n;
  return fracBig(fav, powBig(faces, dice));
}

/** P(strictly increasing values when `dice` d-`faces` dice are rolled in order) = C(faces,dice)/faces^dice. (CA12: 3 d6 → 5/54) */
export function strictlyIncreasingProb(dice: number, faces: number): Fraction {
  return fracBig(chooseBig(faces, dice), powBig(faces, dice));
}

/**
 * P(the two highest of `dice` d-`faces` dice sum to the maximum 2·faces) ⟺ at
 * least two dice show `faces`: = P(X ≥ 2), X ~ Bin(dice, 1/faces).
 * (CA47: 4 d6 → 19/144 ≈ 0.1319)
 */
export function topTwoMaxProb(dice: number, faces: number): Fraction {
  return binomTailGE(dice, F(1, faces), 2);
}

/**
 * P(the sum of the LOWEST three of four d-`faces` dice equals `lowFaces`·3),
 * i.e. all three lowest show the minimum face ⟺ at least three dice show a 1.
 * (CA43: 4 d6, sum of three lowest = 3 → 7/432 ≈ 0.016)
 */
export function sumLowestThreeMinProb(faces: number): Fraction {
  // ≥3 ones among 4 dice: exactly three (4th ∈ {2..faces}) + all four ones.
  const three = F(4).mul(F(1, faces).pow(3) as Fraction).mul(F(faces - 1, faces));
  const four = F(1, faces).pow(4) as Fraction;
  return three.add(four);
}

/**
 * P(at least `k` of `dice` d-`faces` dice show the same value) via the
 * complement (every value appears ≤ k−1 times), counted exactly by an occupancy
 * DP over the `faces` value-multiplicities. (CA48: 7 d6, k=3 → 701/1296 ≈ 0.5409)
 */
export function atLeastKOfAKindProb(dice: number, faces: number, k: number): Fraction {
  // Count sequences (length `dice`, alphabet `faces`) with every symbol used ≤ k−1
  // times: Σ over (m₁,…,m_faces), each 0..k−1, Σmᵢ=dice, of dice!/∏mᵢ!.
  const cap = k - 1;
  let complement = 0n;
  const counts: number[] = [];
  const recur = (idx: number, remaining: number): void => {
    if (idx === faces) {
      if (remaining === 0) complement += multinomialBig(counts);
      return;
    }
    for (let c = 0; c <= Math.min(cap, remaining); c++) {
      counts.push(c);
      recur(idx + 1, remaining - c);
      counts.pop();
    }
  };
  recur(0, dice);
  const totalBig = powBig(faces, dice);
  return F(1).sub(fracBig(complement, totalBig));
}

/**
 * P(some NON-EMPTY subset of `dice` d-`faces` dice sums to exactly `target`),
 * by exact enumeration of all faces^dice outcomes (complement + subset check).
 * (CA40: 3 d6, target 6 → 162/216 = 3/4)
 */
export function subsetSumsToProb(dice: number, faces: number, target: number): Fraction {
  const totalBig = powBig(faces, dice);
  let fav = 0n;
  const roll: number[] = new Array(dice).fill(1);
  const hasSubset = (): boolean => {
    for (let mask = 1; mask < 1 << dice; mask++) {
      let s = 0;
      for (let i = 0; i < dice; i++) if (mask & (1 << i)) s += roll[i];
      if (s === target) return true;
    }
    return false;
  };
  const recur = (idx: number): void => {
    if (idx === dice) {
      if (hasSubset()) fav += 1n;
      return;
    }
    for (let f = 1; f <= faces; f++) {
      roll[idx] = f;
      recur(idx + 1);
    }
  };
  recur(0);
  return fracBig(fav, totalBig);
}

/**
 * P(a `spins`-digit number formed by spinning a 1..`faces` wheel is divisible by
 * `mod`) when divisibility depends only on the last `t` digits (mod = 2^t). We
 * count last-`t`-digit combinations whose value ≡ 0 (mod). (CA51: faces=6, mod=8
 * ⇒ t=3 → 27/216 = 1/8)
 */
export function divisibleByModProb(faces: number, mod: number, t: number): Fraction {
  let fav = 0n;
  const digits: number[] = [];
  const recur = (idx: number): void => {
    if (idx === t) {
      let val = 0;
      for (const d of digits) val = val * 10 + d;
      if (val % mod === 0) fav += 1n;
      return;
    }
    for (let d = 1; d <= faces; d++) {
      digits.push(d);
      recur(idx + 1);
      digits.pop();
    }
  };
  recur(0);
  return fracBig(fav, powBig(faces, t));
}

/* ========================================================================== */
/*  FAMILY 6. Without-replacement sequences / chain rule                       */
/* ========================================================================== */

/**
 * P(an ORDERED draw without replacement matches a target color sequence). Given
 * color `counts` (indexed) and a `sequence` of color indices, multiply the
 * chain-rule fractions. (CA7: 6 brass/9 pearl, [B,B,P,P] → 0.0659)
 */
export function orderedDrawProb(counts: number[], sequence: number[]): Fraction {
  const remaining = counts.slice();
  let total = counts.reduce((a, b) => a + b, 0);
  let p = F(1);
  for (const color of sequence) {
    p = p.mul(F(remaining[color], total));
    remaining[color] -= 1;
    total -= 1;
  }
  return p;
}

/**
 * P(the first pair and the last pair of a 4-draw without replacement carry the
 * SAME two colors, order within pairs irrelevant), from a 2-color urn of `a`
 * and `b`. By exchangeability, = [P(BBBB)+P(PPPP)+4·P(2B2P in the 1,2/3,4 split)].
 * Computed exactly by enumerating the qualifying ordered outcomes. (CA8 → 167/455)
 */
export function pairsAgreeColorProb(a: number, b: number): Fraction {
  const total = a + b;
  const denom = fallingBig(total, 4); // ordered draws of 4
  // helper: ordered-draw count for a specific color pattern (0=color-a,1=color-b)
  const patternCount = (pat: number[]): bigint => {
    let av = a;
    let bv = b;
    let ways = 1n;
    for (const c of pat) {
      if (c === 0) {
        ways *= BigInt(av);
        av -= 1;
      } else {
        ways *= BigInt(bv);
        bv -= 1;
      }
    }
    return ways;
  };
  // pair {1,2} and {3,4} carry same color-multiset. Cases:
  //   both AA: AAAA;  both BB: BBBB;  both mixed {A,B}: the 4 orderings with
  //   {pos1,pos2} = one A one B and {pos3,pos4} = one A one B.
  let fav = 0n;
  fav += patternCount([0, 0, 0, 0]); // AAAA
  fav += patternCount([1, 1, 1, 1]); // BBBB
  for (const first of [
    [0, 1],
    [1, 0],
  ]) {
    for (const last of [
      [0, 1],
      [1, 0],
    ]) {
      fav += patternCount([...first, ...last]);
    }
  }
  return fracBig(fav, denom);
}

/**
 * P(dealing cards one by one until a `stop`-card appears, exactly one of each of
 * the `groups` target ranks appears BEFORE it). Considering only the relevant
 * cards, favorable = (#groups)! · ∏(groupSizeᵢ) · stopSize, total = falling
 * factorial of (Σgroups + stopSize) taken (#groups+1). (CA36: [4,4,4], stop 4 →
 * 0.035; CA37: [4,4,4], stop 1 → 0.0224)
 */
export function dealUntilOneEachProb(groupSizes: number[], stopSize: number): Fraction {
  const g = groupSizes.length;
  let favProd = factorialBig(g) * BigInt(stopSize);
  for (const s of groupSizes) favProd *= BigInt(s);
  const relevant = groupSizes.reduce((a, b) => a + b, 0) + stopSize;
  const denom = fallingBig(relevant, g + 1);
  return fracBig(favProd, denom);
}

/**
 * P(three cards drawn from a `decks`-deck shoe (52·decks cards) form three
 * CONSECUTIVE ranks that are NOT all one suit). 12 rank-runs (A23…QKA); each rank
 * has 4·decks copies ⇒ (4·decks)³ ordered-value hands per run minus straight
 * flushes 4·decks³; ×12, over C(52·decks, 3). (CA13: decks=5 → 0.0311)
 */
export function multiDeckStraightProb(decks: number): Fraction {
  const copies = 4 * decks;
  const perRun = powBig(copies, 3) - 4n * powBig(decks, 3);
  const fav = 12n * perRun;
  return fracBig(fav, chooseBig(52 * decks, 3));
}

/* ========================================================================== */
/*  FAMILY 7. Balance-scale symmetry                                           */
/* ========================================================================== */

/**
 * P(the pan holding the heaviest of six distinct `weights` (three per pan) is
 * the heavier pan). Fix the max weight on one pan with two of the other five;
 * that pan is heavier iff its two companions' sum exceeds half the remaining
 * total. Exact pair count / C(5,2). (CA16/CA24: 101..106 → 8/10 = 0.8)
 */
export function heavierPanProb(weights: number[]): Fraction {
  const sorted = weights.slice().sort((x, y) => x - y);
  const max = sorted[sorted.length - 1];
  const rest = sorted.slice(0, sorted.length - 1);
  const grand = weights.reduce((a, b) => a + b, 0);
  let fav = 0n;
  let tot = 0n;
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      tot += 1n;
      const mySide = max + rest[i] + rest[j];
      if (mySide * 2 > grand) fav += 1n; // strictly heavier (no ties: distinct ints)
    }
  }
  return fracBig(fav, tot);
}

/* ========================================================================== */
/*  FAMILY 8. Grid / lattice-path & line counting                             */
/* ========================================================================== */

/**
 * P(`onCount` uniformly-chosen lit cells on an `n`×`n` grid include a full line —
 * some row, column, or main diagonal of `n` cells). Lines = 2n+2; favorable =
 * lines·C(n²−n, onCount−n) (the line's n cells + the rest anywhere); valid while
 * a single line is possible (onCount ≤ n²−n+... ; used for onCount ≤ n+2 here so
 * two disjoint lines can't both be complete). (CA18/19/20: 4×4, on∈{4,5,6})
 */
export function lightsLineProb(n: number, onCount: number): Fraction {
  const cells = n * n;
  const lines = 2 * n + 2;
  const fav = BigInt(lines) * chooseBig(cells - n, onCount - n);
  return fracBig(fav, chooseBig(cells, onCount));
}

/**
 * Number of monotone lattice routes from the origin to `dims` (each coordinate a
 * count of unit steps in one direction) = multinomial(Σdims)!/∏dimsᵢ!. Integer.
 * (CA33: (6,4,2) → 12!/(6!4!2!) = 13860)
 */
export function multinomialPathsCount(dims: number[]): bigint {
  return multinomialBig(dims);
}

/**
 * Number of up/right paths from (0,0) to (`X`,`Y`) using ALTERNATING step sizes
 * `sA`, `sB`, `sA`, … The magnitude sequence is forced by the total X+Y (it must
 * start with whichever step makes the alternating sum reach the total); we then
 * count the ways to label each step up-vs-right so the up-magnitudes sum to Y,
 * via an exact DP. (CA35: (13,4), steps 1,3 → 25)
 */
export function alternatingStepPathsCount(
  X: number,
  Y: number,
  sA: number,
  sB: number,
): bigint {
  const total = X + Y;
  // Build the forced magnitude sequence. Try starting with sA, then sB; keep the
  // one whose alternating run exactly reaches `total` (the dataset guarantees a
  // unique valid alternation).
  const build = (first: number, second: number): number[] | null => {
    const seq: number[] = [];
    let sum = 0;
    let useFirst = true;
    while (sum < total) {
      const step = useFirst ? first : second;
      seq.push(step);
      sum += step;
      useFirst = !useFirst;
    }
    return sum === total ? seq : null;
  };
  const seq = build(sA, sB) ?? build(sB, sA);
  if (!seq) return 0n;
  // DP: count labelings so the "up" magnitudes total Y (rest go right, total X).
  let ways = new Map<number, bigint>([[0, 1n]]);
  for (const step of seq) {
    const next = new Map<number, bigint>();
    for (const [up, c] of ways) {
      // assign this step to up
      if (up + step <= Y) next.set(up + step, (next.get(up + step) ?? 0n) + c);
      // or to right
      next.set(up, (next.get(up) ?? 0n) + c);
    }
    ways = next;
  }
  return ways.get(Y) ?? 0n;
}

/* ========================================================================== */
/*  FAMILY 9. Circular / arrangement counting                                 */
/* ========================================================================== */

/**
 * P(`n` distinctly-aged people seated at a round table end up in ascending age
 * order clockwise OR counter-clockwise) = 2n / n! = 2/(n−1)!.
 * (CA44: n=5 → 10/120 = 1/12 ≈ 0.083)
 */
export function circularAscendingProb(n: number): Fraction {
  return fracBig(2n * BigInt(n), factorialBig(n));
}

/**
 * P(a distinguished item keeps BOTH its neighbors when `fillers` are placed into
 * distinct gaps around a circle of `anchors` items), its two flanking gaps must
 * stay empty: C(anchors−2, fillers) / C(anchors, fillers).
 * (CA34: 15 knights, 9 jesters → 715/5005 = 1/7 ≈ 0.143)
 */
export function keepBothNeighborsProb(anchors: number, fillers: number): Fraction {
  return fracBig(chooseBig(anchors - 2, fillers), chooseBig(anchors, fillers));
}

/**
 * P(three cards (ranks 1..`ranks`, 4 suits) drawn have all three values pairwise
 * differing by ≥ 2). Sorted-gap model: #value-triples with both gaps ≥2 =
 * C(ranks−4+... ), computed here as the number of triples a<b<c with b−a≥2,
 * c−b≥2 (exact), ×4³ suit choices / C(4·ranks, 3). (CA46: ranks=13 → 528/1105 ≈ 0.478)
 */
export function threeValuesGapProb(ranks: number): Fraction {
  let valueTriples = 0n;
  for (let a = 1; a <= ranks; a++) {
    for (let b = a + 2; b <= ranks; b++) {
      for (let c = b + 2; c <= ranks; c++) valueTriples += 1n;
    }
  }
  const fav = valueTriples * 64n; // 4³ suit choices
  return fracBig(fav, chooseBig(4 * ranks, 3));
}

/* ========================================================================== */
/*  FAMILY 10. Multiplication principle                                        */
/* ========================================================================== */

/** Number of ways to give each of `n` elements one of `options` independent states = options^n. (CA38: 3⁵ = 243) */
export function independentChoicesCount(options: number, n: number): bigint {
  return powBig(options, n);
}

/**
 * Count of `length`-bit strings that start with a fixed `prefixLen`-bit block OR
 * end with a fixed `suffixLen`-bit block (inclusion–exclusion):
 * 2^{L−p} + 2^{L−s} − 2^{L−p−s}. (CA6: L=10, p=2, s=2 → 448)
 */
export function unionFixedBitsCount(length: number, prefixLen: number, suffixLen: number): bigint {
  return (
    powBig(2, length - prefixLen) +
    powBig(2, length - suffixLen) -
    powBig(2, length - prefixLen - suffixLen)
  );
}

/**
 * Number of goal-by-goal sequences that reach `target`–`target` in a "first to
 * `target`, win by 2 after (target−1)-all" contest: any such path passes through
 * (target−1)-all (C(2·(target−1), target−1) orders) then the trailing side must
 * score (2 orders). (CA4: target=6 → C(10,5)·2 = 504)
 */
export function deadlockSequencesCount(target: number): bigint {
  return chooseBig(2 * (target - 1), target - 1) * 2n;
}

/**
 * Threshold secret-sharing (Shamir-style combinatorial locks): `n` people, any
 * `threshold` can open. Minimum locks = C(n, threshold−1) (one per minimal
 * blocking coalition of threshold−1 people, held by the complementary
 * n−threshold+1); keys per lock = n−threshold+1; keys per person =
 * locks·keysPerLock / n. (CA11: n=11, threshold=6 → 462 locks, 252 keys/person)
 */
export function secretSharing(
  n: number,
  threshold: number,
): { locks: bigint; keysPerLock: bigint; keysPerPerson: bigint } {
  const locks = chooseBig(n, threshold - 1);
  const keysPerLock = BigInt(n - threshold + 1);
  const keysPerPerson = (locks * keysPerLock) / BigInt(n);
  return { locks, keysPerLock, keysPerPerson };
}

/* ========================================================================== */
/*  Coin-grab value threshold                                                   */
/* ========================================================================== */

/**
 * P(a grab of `grab` coins from a pocket with the given `values` (one of each)
 * totals ≥ `threshold`), by exact enumeration of all C(n, grab) subsets.
 * (CA2 "computed": {200,100,50,20,10,5,2,1}, grab 3, ≥90 → 36/56 = 9/14 ≈ 0.643)
 */
export function coinGrabAtLeastProb(values: number[], grab: number, threshold: number): Fraction {
  const n = values.length;
  let fav = 0n;
  const combo: number[] = [];
  const recur = (start: number): void => {
    if (combo.length === grab) {
      let sum = 0;
      for (const idx of combo) sum += values[idx];
      if (sum >= threshold) fav += 1n;
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      recur(i + 1);
      combo.pop();
    }
  };
  recur(0);
  return fracBig(fav, chooseBig(n, grab));
}

/* ========================================================================== */
/*  Linearity of expectation (indicator)                                       */
/* ========================================================================== */

/**
 * Expected number of complete pairs when dealing `deal` cards from a deck of
 * `ranks` ranks × `copies` copies each. By linearity, E = ranks · P(a given rank
 * fully in hand) = ranks · C(copies,copies)·C(total−copies, deal−copies)/C(total,deal).
 * (CA17: ranks=4, copies=2, deal=4 → 6/7 ≈ 0.857)
 */
export function expectedPairsDealt(ranks: number, copies: number, deal: number): Fraction {
  const total = ranks * copies;
  const perRank = fracBig(
    chooseBig(copies, copies) * chooseBig(total - copies, deal - copies),
    chooseBig(total, deal),
  );
  return perRank.mul(ranks);
}

/* ========================================================================== */
/*  Big binomial tail (high precision float), overbooked flight                */
/* ========================================================================== */

/**
 * P(at least one passenger is denied boarding) when `tickets` are sold for
 * `seats` seats and each ticket-holder is a no-show independently w.p.
 * `noShowProb`. Someone is refused iff fewer than (tickets−seats) no-show, i.e.
 * X ≤ tickets−seats−1 where X ~ Bin(tickets, noShowProb). Computed in log-space.
 * (CA25: 310 tickets, 300 seats, 5% → ≈ 0.051)
 */
export function overbookedDeniedProb(
  tickets: number,
  seats: number,
  noShowProb: number,
): number {
  const k = tickets - seats - 1;
  return binomTailLEFloat(tickets, noShowProb, k);
}
