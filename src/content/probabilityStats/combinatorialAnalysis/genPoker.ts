import type { Rng } from "@/lib/rng";
import type { Question } from "@/types/content";
import { chooseBig, decText, fracBig } from "./combinatorics";
import { type Choice, assembleChoices } from "./_shared";
import { type PokerHand, pokerHandCount, pokerHandPercent } from "./solvers";

/**
 * Parametric QUIZ generator for the Probability & Statistics → **Combinatorial
 * Analysis** subcategory, five-card-draw poker-hand family.
 *
 * The teaching point is the SUIT-COMBINATION misconception: every distractor is
 * a re-derived WRONG hand-count that drops (or double-counts) a specific suit /
 * rank factor — forgetting a C(4,2)/C(4,3) suit choice, omitting the kicker, or
 * treating distinguishable ranks as an unordered pair. Naming that exact slip is
 * what the item is designed to teach.
 *
 * The CORRECT value comes ONLY from the exact solvers (`pokerHandPercent`); each
 * distractor percent is the misconception's wrong count divided by the true
 * C(52,5) = 2,598,960 hands and scaled to a percent, formatted identically to
 * "X.XXX%" so nothing about the option text leaks the answer. All wording is
 * fresh — no source-dataset titles ("Poker - Four of a Kind", …) appear.
 */

/** Total five-card hands from a standard 52-card deck: C(52,5) = 2,598,960. */
const TOTAL = chooseBig(52, 5);
const C = chooseBig;

/** Format a hand count as an identically-shaped "X.XXX%" percent (count / C(52,5) × 100). */
function pctText(count: bigint): string {
  return `${decText(fracBig(count, TOTAL).mul(100), 3)}%`;
}

interface HandSpec {
  /** Short, grammatical label used in the prompt ("… form <label>"). */
  label: string;
  concept: string;
  /** Human-readable count derivation quoted in the explanation. */
  derivation: string;
  /** Three NAMED suit-/rank-combo misconceptions, each a re-derived wrong count. */
  distractors: { count: bigint; rationale: string }[];
}

const HANDS: Record<PokerHand, HandSpec> = {
  fourOfAKind: {
    label: "four of a kind",
    concept: "Poker: four of a kind (5-card hand count)",
    derivation:
      "13 quad ranks × C(4,4)=1 for the four suits × 48 choices for the 5th card = 13·48",
    distractors: [
      {
        count: 13n, // forgot the 5th (kicker) card entirely
        rationale:
          "You forgot the fifth card. After fixing the quad rank you still choose 1 of the 48 remaining cards, so it's 13·48 — not 13 alone.",
      },
      {
        count: 13n * 52n, // drew the kicker from all 52 cards
        rationale:
          "You drew the kicker from all 52 cards, but 4 are already committed to the quad — only 48 remain, so multiply by 48, not 52.",
      },
      {
        count: 13n * 4n * 48n, // invented a C(4,1) suit choice for the quad
        rationale:
          "A quad uses ALL four suits, so C(4,4)=1 — there is no suit to pick. Multiplying by C(4,1)=4 invents a suit selection that doesn't exist.",
      },
    ],
  },
  fullHouse: {
    label: "a full house",
    concept: "Poker: full house (5-card hand count)",
    derivation:
      "13 triple ranks × C(4,3) triple suits × 12 pair ranks × C(4,2) pair suits = 13·4·12·6",
    distractors: [
      {
        count: 13n * 12n, // dropped BOTH suit-combo factors
        rationale:
          "You picked the triple rank (13) and the pair rank (12) but forgot which suits fill them — multiply by C(4,3)=4 and C(4,2)=6.",
      },
      {
        count: 13n * 4n * 12n, // kept C(4,3) but dropped C(4,2)
        rationale:
          "You chose the triple's suits C(4,3)=4 but forgot the pair's suits C(4,2)=6.",
      },
      {
        count: C(13, 2) * 4n * 6n, // treated the two ranks as unordered, halving 13·12
        rationale:
          "Triple and pair ranks are distinguishable, so it's 13·12 ordered choices — collapsing them into an unordered C(13,2)=78 halves the count.",
      },
    ],
  },
  twoPair: {
    label: "two pair",
    concept: "Poker: two pair (5-card hand count)",
    derivation:
      "C(13,2) pair ranks × C(4,2) × C(4,2) suits × 44 kicker cards = 78·6·6·44",
    distractors: [
      {
        count: C(13, 2) * 6n * 44n, // suits for only ONE pair
        rationale:
          "You chose suits for only one pair. Each of the two pairs needs its own C(4,2)=6 suit choice, so multiply by 6·6.",
      },
      {
        count: C(13, 2) * 6n * 6n, // forgot the kicker
        rationale:
          "You forgot the kicker: after the two pairs, the 5th card is any of the 44 cards outside those two ranks.",
      },
      {
        count: 13n * 12n * 6n * 6n * 44n, // ordered pair ranks (P(13,2)), doubling
        rationale:
          "The two pair ranks are unordered — use C(13,2)=78. Using ordered 13·12=156 counts every two-pair hand twice.",
      },
    ],
  },
  threeOfAKind: {
    label: "three of a kind",
    concept: "Poker: three of a kind (5-card hand count)",
    derivation:
      "13 triple ranks × C(4,3) triple suits × C(12,2) kicker ranks × C(4,1)² kicker suits = 13·4·66·16",
    distractors: [
      {
        count: 13n * C(12, 2) * 4n * 4n, // forgot the triple's C(4,3)
        rationale:
          "You forgot to choose which 3 of the 4 suits form the triple — multiply by C(4,3)=4.",
      },
      {
        count: 13n * 4n * C(12, 2), // forgot the kicker suit factor 4·4
        rationale:
          "You picked the two kicker ranks but forgot each kicker's suit: multiply by C(4,1)·C(4,1)=16.",
      },
      {
        count: 13n * 4n * (12n * 11n) * 4n * 4n, // ordered kickers, doubling
        rationale:
          "The two kickers are unordered — use C(12,2)=66. Ordered 12·11=132 double-counts each hand.",
      },
    ],
  },
  onePair: {
    label: "one pair",
    concept: "Poker: one pair (5-card hand count)",
    derivation:
      "13 pair ranks × C(4,2) pair suits × C(12,3) kicker ranks × C(4,1)³ kicker suits = 13·6·220·64",
    distractors: [
      {
        count: 13n * C(12, 3) * 64n, // forgot the pair's C(4,2)
        rationale:
          "You forgot the pair's suit combo: choose which 2 of the 4 suits pair up, C(4,2)=6.",
      },
      {
        count: 13n * 6n * C(12, 3), // forgot the three kicker suits 4³
        rationale:
          "You forgot the three kickers' suits: each kicker rank still has C(4,1)=4 suits, a factor 4³=64.",
      },
      {
        count: 13n * 6n * C(12, 2) * 4n * 4n, // only TWO kickers instead of three
        rationale:
          "A one-pair hand has THREE distinct kickers, not two: use C(12,3)=220 kicker ranks with 4³ suits, not C(12,2) with 4².",
      },
    ],
  },
  flush: {
    label: "a flush",
    concept: "Poker: flush (5-card hand count, straight flushes included)",
    derivation: "C(4,1) suits × C(13,5) same-suit rank subsets = 4·1287",
    distractors: [
      {
        count: C(13, 5), // forgot the suit choice
        rationale:
          "You forgot to choose the suit: multiply the C(13,5)=1287 same-suit rank subsets by C(4,1)=4 suits.",
      },
      {
        count: 4n * 13n * C(12, 4), // 'lead card' overcount by a factor of 5
        rationale:
          "Choosing a 'lead' card (13) then 4 more of the suit (C(12,4)) counts each flush 5 times — divide by 5, i.e. use C(13,5).",
      },
      {
        count: 2n * C(26, 5), // confused suit with colour
        rationale:
          "A flush is one SUIT, not one colour. Counting 5 cards of a single colour uses 26 cards (2 colours × C(26,5)), far more than one 13-card suit.",
      },
    ],
  },
};

const HAND_KEYS: PokerHand[] = [
  "fourOfAKind",
  "fullHouse",
  "twoPair",
  "threeOfAKind",
  "onePair",
  "flush",
];

/**
 * One five-card-draw poker-hand quiz: name the exact percentage of hands that
 * form a randomly chosen category. Every option is an "X.XXX%" percent; the
 * three distractors are re-derived wrong counts from named suit-combo slips.
 */
export function genPokerHand(rng: Rng): Question {
  const hand = rng.pick(HAND_KEYS);
  const spec = HANDS[hand];
  const count = pokerHandCount(hand);
  const pct = decText(pokerHandPercent(hand), 3);

  const correct: Choice = {
    text: `${pct}%`,
    rationale: `Correct — ${spec.derivation} = ${count} hands, and ${count}/2,598,960 × 100 = ${pct}%.`,
  };

  const distractors: Choice[] = spec.distractors.map((d) => ({
    text: pctText(d.count),
    rationale: d.rationale,
  }));

  const prompt =
    `A single five-card hand is dealt from a well-shuffled standard 52-card deck. ` +
    `Of all 2,598,960 equally likely hands, what percentage form ${spec.label}? ` +
    `(Give the answer as a percent to three decimals.)`;

  const explanation =
    `There are C(52,5) = 2,598,960 equally likely five-card hands. Exactly ${count} of them ` +
    `form ${spec.label} (${spec.derivation}). So the probability is ${count}/2,598,960 × 100 = ${pct}%. ` +
    `Each wrong option drops or double-counts a suit/rank factor.`;

  return {
    id: `ca-poker-${hand}`,
    prompt,
    ...assembleChoices(rng, correct, distractors),
    explanation,
    difficulty: "easy",
    concept: spec.concept,
    source: "Combinatorial Analysis · Poker hands",
  };
}
