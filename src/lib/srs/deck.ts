/**
 * srs/deck.ts — the MODE-SCOPED spaced-repetition CARD CATALOG (T14 retention).
 *
 * SRS content is regenerated deterministically here and joined to the persisted
 * scheduling state (`srs/store.ts`) by a stable `id`. Scoping follows the
 * research exactly:
 *
 *  • CASE A (course mastery — BROAD). SRS is the primary retention engine, so
 *    the deck is drawn from the EXISTING probability / stochastic-processes
 *    course content: one "key idea / formula" recall card per course level, plus
 *    a "worked-procedure recall" card for any level that carries a deep-dive
 *    method. Reuses `probabilityTrack` levels (incl. the probability-stats
 *    subcategories) — no hand-authored concept cards.
 *
 *  • CASE B (interview — NARROW, FACT-CORE ONLY). The deck covers ONLY the
 *    memorizable facts a quant trader should own cold: fraction↔decimal↔%
 *    conversions, squares/cubes/powers, primes<100, log/root anchors + rule of
 *    72, probability/EV/combinatorics identities (Var, linearity, Bayes, nCk,
 *    stars-and-bars), and de-vig / market-making heuristics. It is served MIXED
 *    (interleaved across families), never blocked. Brainteasers, EV word
 *    problems, Fermi/estimation, sequence puzzles, and live market-making stay
 *    OUT of SRS — they are owned by Speed Arena / OA / the problem banks. SRS
 *    COMPLEMENTS speed practice (own the facts cold → then the Arena adds the
 *    clock); it is never itself a timer.
 *
 * Everything here is PURE + deterministic: the same mode always yields the same
 * ordered card list, so the store/queue and every test are reproducible.
 */

import type { GoalMode } from "@/types/progress";
import { TRACKS } from "@/content";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import { isCourseTopic } from "@/lib/mode/courseMap";

/** Which mode-scoped deck a card belongs to. */
export type SrsDeck = "concept" | "fact-core";

/** One reviewable card's CONTENT (scheduling state lives in `srs/store.ts`). */
export interface SrsCardContent {
  /** Stable catalog id — the join key into the persisted `SrsStore`. */
  id: string;
  deck: SrsDeck;
  /** The recall prompt (question side). */
  front: string;
  /** The answer revealed on grade (answer side). */
  back: string;
  /** Human-facing grouping label (topic name / fact family). */
  category: string;
  /** Owning topicKey when the card maps to a course topic (Case A). */
  topicKey?: string;
  /**
   * Fact cards a mastered learner can "graduate to timed" in the Speed Arena
   * (Case B linkage — mental-math-able facts). Concept/derivation cards are not
   * arena-timed and leave this `false`.
   */
  arenaReady?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  CASE A — broad concept deck from existing course content                   */
/* -------------------------------------------------------------------------- */

/**
 * The Case-A (course mastery) deck: concept + worked-procedure recall cards
 * drawn from every COURSE-TOPIC level in the probability track. Deterministic —
 * cards follow the levels' declared order.
 */
export function conceptDeck(): SrsCardContent[] {
  const cards: SrsCardContent[] = [];
  for (const track of TRACKS) {
    for (const level of track.levels) {
      const topicKey = topicKeyForLevel(track.id, level);
      if (!isCourseTopic(topicKey)) continue;

      const category = level.section ?? level.title;
      const cue = level.subtitle ? ` (${level.subtitle})` : "";

      if (level.lesson.keyIdea) {
        cards.push({
          id: `concept:${track.id}:${level.id}:idea`,
          deck: "concept",
          front: `Recall the key idea — ${level.title}${cue}`,
          back: level.lesson.keyIdea,
          category,
          topicKey,
        });
      }

      const approach = level.lesson.deepDive?.approach;
      if (approach && approach.length > 0) {
        cards.push({
          id: `concept:${track.id}:${level.id}:proc`,
          deck: "concept",
          front: `Outline the method — ${level.title}${cue}`,
          back: approach.map((s, i) => `${i + 1}. ${s}`).join("\n"),
          category,
          topicKey,
        });
      }
    }
  }
  return cards;
}

/* -------------------------------------------------------------------------- */
/*  CASE B — narrow fact-core deck (memorizable facts only)                    */
/* -------------------------------------------------------------------------- */

/** Trim a float to at most `places` decimals with no trailing zeros. */
function trim(x: number, places: number): string {
  return String(parseFloat(x.toFixed(places)));
}

function makeCard(
  id: string,
  category: string,
  front: string,
  back: string,
  arenaReady = false,
): SrsCardContent {
  return { id, deck: "fact-core", front, back, category, arenaReady };
}

/** Fraction ↔ decimal ↔ % conversions worth owning cold. */
const CONVERSION_FRACTIONS: [number, number][] = [
  [1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5],
  [1, 6], [5, 6], [1, 7], [1, 8], [3, 8], [5, 8], [7, 8], [1, 9], [1, 10],
  [1, 11], [1, 12], [1, 16], [1, 20], [1, 25], [1, 40], [1, 50],
];

function conversionCards(): SrsCardContent[] {
  return CONVERSION_FRACTIONS.map(([n, d]) => {
    const dec = trim(n / d, 4);
    const pct = `${trim((n / d) * 100, 2)}%`;
    return makeCard(
      `fact:conv:${n}-${d}`,
      "Conversions",
      `${n}/${d} as a decimal and a percent?`,
      `${n}/${d} = ${dec} = ${pct}`,
      true,
    );
  });
}

function squareCards(): SrsCardContent[] {
  const out: SrsCardContent[] = [];
  for (let n = 12; n <= 25; n++) {
    out.push(
      makeCard(`fact:square:${n}`, "Squares", `${n}² = ?`, `${n * n}`, true),
    );
  }
  return out;
}

function cubeCards(): SrsCardContent[] {
  const out: SrsCardContent[] = [];
  for (let n = 2; n <= 12; n++) {
    out.push(
      makeCard(`fact:cube:${n}`, "Cubes", `${n}³ = ?`, `${n * n * n}`, true),
    );
  }
  return out;
}

function powerOfTwoCards(): SrsCardContent[] {
  const out: SrsCardContent[] = [];
  for (let k = 6; k <= 13; k++) {
    out.push(
      makeCard(
        `fact:pow2:${k}`,
        "Powers of 2",
        `2^${k} = ?`,
        `${2 ** k}`,
        true,
      ),
    );
  }
  return out;
}

/** Primes under 100 — the list, plus a few composite "looks prime" traps. */
function primeCards(): SrsCardContent[] {
  const primes = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
    71, 73, 79, 83, 89, 97,
  ];
  const out: SrsCardContent[] = [
    makeCard(
      "fact:primes:under-100",
      "Primes",
      "List every prime below 100 (there are 25).",
      primes.join(", "),
    ),
  ];
  const traps: [number, string][] = [
    [51, "51 = 3 × 17"],
    [57, "57 = 3 × 19 (\u201cGrothendieck prime\u201d)"],
    [77, "77 = 7 × 11"],
    [87, "87 = 3 × 29"],
    [91, "91 = 7 × 13"],
  ];
  for (const [n, factored] of traps) {
    out.push(
      makeCard(
        `fact:prime-trap:${n}`,
        "Primes",
        `Is ${n} prime? If not, factor it.`,
        `Not prime — ${factored}.`,
      ),
    );
  }
  return out;
}

/** Log / root anchors + rule of 72. */
function anchorCards(): SrsCardContent[] {
  const anchors: [string, string, string][] = [
    ["log2", "log₁₀(2) ≈ ?", "0.301"],
    ["log3", "log₁₀(3) ≈ ?", "0.477"],
    ["ln2", "ln 2 ≈ ?", "0.693"],
    ["ln10", "ln 10 ≈ ?", "2.303"],
    ["e", "e ≈ ?", "2.718"],
    ["sqrt2", "√2 ≈ ?", "1.414"],
    ["sqrt3", "√3 ≈ ?", "1.732"],
    ["sqrt5", "√5 ≈ ?", "2.236"],
    [
      "rule72",
      "Rule of 72: at r% growth, doubling time ≈ ?",
      "72 / r years (e.g. 8% → ~9 yrs)",
    ],
  ];
  return anchors.map(([k, front, back]) =>
    makeCard(`fact:anchor:${k}`, "Log & root anchors", front, back, true),
  );
}

/** Probability / EV / combinatorics identities. */
function identityCards(): SrsCardContent[] {
  const ids: [string, string, string][] = [
    ["var", "Variance in terms of moments?", "Var(X) = E[X²] − E[X]²"],
    [
      "linearity",
      "Linearity of expectation (does independence matter)?",
      "E[aX + bY] = aE[X] + bE[Y] — ALWAYS, even for dependent X, Y.",
    ],
    ["bayes", "Bayes' rule?", "P(H|E) = P(E|H)·P(H) / P(E)"],
    [
      "complement",
      "\u201cAt least one\u201d probability trick?",
      "P(≥1) = 1 − P(none)",
    ],
    [
      "binom",
      "Binomial pmf — P(exactly k of n)?",
      "C(n,k) · pᵏ · (1−p)ⁿ⁻ᵏ",
    ],
    ["geom", "Geometric waiting time — expected trials to first success?", "1 / p"],
    ["cov", "Covariance definition?", "Cov(X,Y) = E[XY] − E[X]·E[Y]"],
    ["varaffine", "Var(aX + b) = ?", "a²·Var(X)  (the +b shifts, doesn't scale)"],
    [
      "stars",
      "Stars & bars — # of non-negative integer solutions to x₁+…+x_k = n?",
      "C(n + k − 1, k − 1)",
    ],
    ["uniformmean", "E of Uniform{1,…,n}?", "(n + 1) / 2"],
    ["diesum", "Expected sum of two fair six-sided dice?", "7"],
    [
      "indepvar",
      "Var(X + Y) when X ⟂ Y?",
      "Var(X) + Var(Y)  (covariance term vanishes under independence)",
    ],
  ];
  return ids.map(([k, front, back]) =>
    makeCard(`fact:identity:${k}`, "Prob/EV identities", front, back),
  );
}

/** Small nCk table (the values that recur in interviews). */
function nckCards(): SrsCardContent[] {
  const combos: [number, number][] = [
    [4, 2], [5, 2], [5, 3], [6, 2], [6, 3], [7, 2], [8, 2], [10, 2], [10, 3],
  ];
  const choose = (n: number, k: number): number => {
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return Math.round(r);
  };
  const out = combos.map(([n, k]) =>
    makeCard(
      `fact:nck:${n}-${k}`,
      "nCk table",
      `C(${n}, ${k}) = ?`,
      `${choose(n, k)}`,
      true,
    ),
  );
  out.push(
    makeCard(
      "fact:nck:formula",
      "nCk table",
      "Closed form for C(n, 2)?",
      "n(n − 1) / 2",
    ),
  );
  return out;
}

/** De-vig / market-making heuristics (the fact-core slice, not live MM). */
function devigCards(): SrsCardContent[] {
  const rows: [string, string, string][] = [
    ["decimal", "Decimal odds d → implied probability?", "1 / d"],
    [
      "american",
      "American odds +150 → implied probability?",
      "100 / (150 + 100) = 40%",
    ],
    [
      "americanneg",
      "American odds −200 → implied probability?",
      "200 / (200 + 100) ≈ 66.7%",
    ],
    [
      "overround",
      "Bookmaker overround (vig)?",
      "(sum of both implied probs) − 1",
    ],
    [
      "devig",
      "De-vig a two-way market — fair probability?",
      "implied_i / (implied₁ + implied₂)  (normalize to sum 1)",
    ],
    ["edge", "Your edge on a bet, in probability terms?", "fair prob − implied price"],
    ["width", "Market width and mid from a B / A quote?", "width = A − B;  mid = (A + B) / 2"],
    [
      "skew",
      "Which side do you skew your quote toward?",
      "Toward the inventory you want: shade the mid DOWN to buy, UP to sell.",
    ],
  ];
  return rows.map(([k, front, back]) =>
    makeCard(`fact:devig:${k}`, "De-vig & market heuristics", front, back),
  );
}

/**
 * Round-robin interleave a set of family decks so the served order is MIXED
 * (never blocked by family) — the research-backed interleaving requirement for
 * Case B. Deterministic: families are consumed in declaration order, one card
 * per family per pass.
 */
function interleave(families: SrsCardContent[][]): SrsCardContent[] {
  const out: SrsCardContent[] = [];
  const maxLen = Math.max(0, ...families.map((f) => f.length));
  for (let i = 0; i < maxLen; i++) {
    for (const fam of families) {
      if (i < fam.length) out.push(fam[i]);
    }
  }
  return out;
}

/**
 * The Case-B (interview) fact-core deck, served as a single MIXED (interleaved)
 * deck across all fact families. Deterministic + fully offline.
 */
export function factCoreDeck(): SrsCardContent[] {
  return interleave([
    conversionCards(),
    squareCards(),
    identityCards(),
    anchorCards(),
    cubeCards(),
    devigCards(),
    powerOfTwoCards(),
    nckCards(),
    primeCards(),
  ]);
}

/* -------------------------------------------------------------------------- */
/*  Mode selector + lookups                                                    */
/* -------------------------------------------------------------------------- */

/** The full ordered deck for a goal mode (Case A concept / Case B fact-core). */
export function deckForMode(mode: GoalMode): SrsCardContent[] {
  return mode === "course" ? conceptDeck() : factCoreDeck();
}

/** The deck's card ids in order (the store/queue join keys for this mode). */
export function deckCardIds(mode: GoalMode): string[] {
  return deckForMode(mode).map((c) => c.id);
}

/** Index a deck by id for O(1) content lookup while reviewing. */
export function indexDeck(
  cards: SrsCardContent[],
): Record<string, SrsCardContent> {
  const map: Record<string, SrsCardContent> = {};
  for (const c of cards) map[c.id] = c;
  return map;
}
