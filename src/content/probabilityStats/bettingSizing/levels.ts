import type { Level } from "@/types/content";
import { makeKellyGenerator, mixNumeric } from "./generators";

/**
 * Betting & Sizing — the first subcategory of the Probability & Statistics
 * category, mode `"numeric"` (free-entry dollar stakes). Powered by the nine
 * parametric Kelly generators (3 probability sources × 3 odds formats). The
 * levels form a Candy-Crush progression: simple single-event positive odds →
 * binomial / two-dice events with decimal & fractional conversions → negative
 * money lines, complements, and sum events with larger denominators → a mixed
 * mastery desk drawing on all nine generators.
 *
 * See `../kelly.ts` for the exact-rational solver and event catalogs, and
 * `./generators.ts` for the generators + Kelly error taxonomy.
 */

const KELLY_METHOD =
  "The Kelly criterion answers HOW MUCH to bet once you have an edge: f* = (b·p − q)/b, where p is your true win probability, q = 1 − p, and b is the net odds (profit per $1 staked). Your stake is f* × bankroll. If f* ≤ 0 you have no edge — don't bet.";

const ODDS_CONVERSIONS =
  "Convert quoted odds to net odds b before sizing. American: +M → b = M/100; −M → b = 100/M. Decimal o → b = o − 1. Fractional m:n → b = m/n. Get true p from the setup: a card event is (winning cards)/52, a coin event is (winning outcomes)/2ⁿ, a dice event is (winning outcomes)/6ⁿ.";

export const bettingSizingLevels: Level[] = [
  {
    id: "bs-1",
    title: "Sizing the Edge",
    subtitle: "Kelly stakes on simple single events",
    blurb:
      "Size single card/coin/die bets with the Kelly formula f*=(b·p−q)/b on simple positive American, decimal, and fractional odds.",
    section: "Betting & Sizing",
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 6,
    numericGenerator: mixNumeric([
      makeKellyGenerator("dice", "american", "easy"),
      makeKellyGenerator("cards", "decimal", "easy"),
      makeKellyGenerator("coins", "fractional", "easy"),
      makeKellyGenerator("cards", "american", "easy"),
    ]),
    lesson: {
      paragraphs: [
        KELLY_METHOD,
        ODDS_CONVERSIONS,
        "Here you get simple single events (one die, a single card, two coins) at friendly odds. Compute p, convert the odds to b, plug into Kelly, and multiply by the bankroll for a whole-dollar stake.",
      ],
      keyIdea: "f* = (b·p − q)/b; stake = f* × bankroll.",
      whyInterviewers:
        "Sizing discipline — betting the edge, not the win probability — separates good traders from lucky ones.",
      deepDive: {
        whyItWorks:
          "Kelly picks the bet fraction that maximises long-run growth (expected log wealth), so you stake more when your edge or payoff is larger and nothing when you have no edge. The fraction (b·p − q)/b compares your true edge against the odds rather than betting the raw win chance.",
        approach: [
          "Read the setup to get the true win probability p (and q = 1 − p).",
          "Convert the quoted odds to net odds b (profit per $1 staked).",
          "Compute the Kelly fraction f* = (b·p − q)/b.",
          "Multiply f* by the bankroll for the stake; if f* ≤ 0 there is no edge, so don't bet.",
        ],
        pitfalls: [
          "Betting the win probability p (or the break-even/implied probability) directly as the fraction.",
          "Forgetting to subtract q, or forgetting to divide by b.",
          "Confusing the quoted odds with the net odds b.",
        ],
      },
    },
  },
  {
    id: "bs-2",
    title: "Odds Conversions & Binomials",
    subtitle: "Decimal & fractional lines, binomial coin & two-dice events",
    blurb:
      "Convert decimal and fractional odds to net odds b and size Kelly bets on binomial coin counts and independent two-dice events.",
    section: "Betting & Sizing",
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 6,
    numericGenerator: mixNumeric([
      makeKellyGenerator("coins", "american", "medium"),
      makeKellyGenerator("dice", "decimal", "medium"),
      makeKellyGenerator("cards", "fractional", "medium"),
      makeKellyGenerator("coins", "decimal", "medium"),
    ]),
    lesson: {
      paragraphs: [
        "Now the win probabilities take a little counting. For n fair coins, P(event) = (Σ C(n,k) over winning head-counts)/2ⁿ. For two fair dice, enumerate the 36 outcomes and count the winners.",
        ODDS_CONVERSIONS,
        "Watch the conversions: decimal 2.50 means b = 1.50 (not 2.50), and fractional 5/2 means b = 2.5. Compute p exactly, then f* = (b·p − q)/b.",
      ],
      keyIdea: "p from binomial/enumeration; b = o−1 (decimal) or m/n (fractional).",
      whyInterviewers:
        "Fast, exact odds↔probability conversion under pressure is a core desk skill.",
      deepDive: {
        whyItWorks:
          "The Kelly principle is unchanged — bet the edge (b·p − q)/b — but here the win probability comes from counting outcomes (a binomial over fair coins, an enumeration of the dice space). Kelly still needs an exact p and an exact net odds b.",
        approach: [
          "Count the favourable outcomes over the total to get p (binomial coefficients for coins, enumerate the outcome space for dice).",
          "Convert the quoted odds to net odds b (decimal o → o−1; fractional m:n → m/n).",
          "Set q = 1 − p and compute f* = (b·p − q)/b.",
          "Multiply by the bankroll for the whole-dollar stake.",
        ],
        pitfalls: [
          "Using the quoted decimal odds directly as b instead of subtracting 1.",
          "Miscounting the outcome space (wrong 2ⁿ or 6ⁿ denominator, or missing winning cases).",
          "Betting p directly rather than the Kelly fraction.",
        ],
      },
    },
  },
  {
    id: "bs-3",
    title: "Negative Lines & Complements",
    subtitle: "Favorites, 'at least one', and sum events",
    blurb:
      "Size Kelly bets on negative American favorites (b=100/M), complement events like 'at least one', and two-dice sum events with larger denominators.",
    section: "Betting & Sizing",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 6,
    numericGenerator: mixNumeric([
      makeKellyGenerator("cards", "american", "hard"),
      makeKellyGenerator("dice", "american", "hard"),
      makeKellyGenerator("coins", "decimal", "hard"),
      makeKellyGenerator("dice", "fractional", "hard"),
    ]),
    lesson: {
      paragraphs: [
        "The traps intensify. On a negative money line −M the net odds are b = 100/M (a favorite pays less than even), NOT M/100 — flipping this is the classic sizing error.",
        "Use complements: P(at least one) = 1 − P(none). For 'at least one 6' on two dice that's 1 − (5/6)² = 11/36. Sum events (sum > s, sum ≥ s) need the enumerated count over 36.",
        KELLY_METHOD,
      ],
      keyIdea: "Negative line ⇒ b = 100/M; 'at least one' ⇒ 1 − P(none).",
      whyInterviewers:
        "Favorites and complement events are where careless sizing quietly leaks money.",
      deepDive: {
        whyItWorks:
          "The same growth-optimal formula applies, but favorites (negative money lines) pay less than even, and complement events are far easier via 1 − P(none). Getting both b and p right on these framings is exactly where careless sizing leaks.",
        approach: [
          "Find the true win probability p, using complements where handy: P(at least one) = 1 − P(none).",
          "Convert a negative money line −M to net odds b = 100/M (a favorite pays less than $1 per $1 staked).",
          "Set q = 1 − p and compute f* = (b·p − q)/b.",
          "Multiply by the bankroll for the stake.",
        ],
        pitfalls: [
          "Flipping the negative-line conversion (using M/100 instead of 100/M).",
          "Computing P(at least one) the hard way instead of 1 − P(none).",
          "Forgetting to subtract q or to divide by b.",
        ],
      },
    },
  },
  {
    id: "bs-4",
    title: "The Sizing Desk",
    subtitle: "Mixed mastery across all nine schemas",
    blurb:
      "A mixed set drawing on all nine Kelly schemas (cards/coins/dice × American/decimal/fractional) across every difficulty — prove your sizing.",
    section: "Betting & Sizing",
    difficulty: "expert",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 8,
    numericGenerator: mixNumeric([
      makeKellyGenerator("cards", "american"),
      makeKellyGenerator("cards", "decimal"),
      makeKellyGenerator("cards", "fractional"),
      makeKellyGenerator("coins", "american"),
      makeKellyGenerator("coins", "decimal"),
      makeKellyGenerator("coins", "fractional"),
      makeKellyGenerator("dice", "american"),
      makeKellyGenerator("dice", "decimal"),
      makeKellyGenerator("dice", "fractional"),
    ]),
    lesson: {
      paragraphs: [
        "This desk mixes every source and odds format at every difficulty. For each: read the setup for true p, convert the quoted odds to net odds b, then size with f* = (b·p − q)/b × bankroll.",
        ODDS_CONVERSIONS,
        "Common leaks to avoid: betting your win probability p directly, using the break-even/implied probability as the stake fraction, forgetting to divide by b, or mis-converting a negative money line.",
      ],
      keyIdea: "One formula, nine schemas: f* = (b·p − q)/b.",
      whyInterviewers:
        "Consistent, exact bet sizing across framings is exactly what a trading desk tests.",
      deepDive: {
        whyItWorks:
          "One formula sizes every bet: Kelly stakes the edge (b·p − q)/b, never the raw win probability. The whole skill is recognising the source that gives p and the odds format that gives b, then applying the same computation.",
        approach: [
          "Read the setup for the true win probability p (cards, coins, or dice).",
          "Identify the odds format and convert to net odds b (American ±M, decimal, or fractional).",
          "Set q = 1 − p and compute f* = (b·p − q)/b.",
          "Multiply by the bankroll; skip the bet if f* ≤ 0.",
        ],
        pitfalls: [
          "Betting p directly, or using the break-even/implied probability as the stake fraction.",
          "Forgetting to divide by b.",
          "Mis-converting a negative money line or a decimal line.",
        ],
      },
    },
  },
];
