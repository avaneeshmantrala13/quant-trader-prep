import type Fraction from "fraction.js";
import type { Rng } from "@/lib/rng";
import type {
  Difficulty,
  NumericQuestion,
  NumericQuestionGenerator,
} from "@/types/content";
import {
  CARD_EVENTS,
  COIN_EVENTS,
  DICE_EVENTS,
  F,
  cardEventProb,
  coinEventProb,
  diceEventProb,
  fracText,
  impliedProb,
  kellyFraction,
  oddsLabel,
  oddsToB,
  pctText,
  type CoinEvent,
  type DiceEvent,
  type Odds,
  type OddsFormat,
  type Source,
} from "./kelly";
import { mixNumericGenerators } from "../../mixFamilies";

/**
 * The nine parametric Kelly generators — the 3×3 (source × odds-format) grid
 * that forms the infinitely-scalable "question factory". Each generator, seeded
 * by the shared `Rng`, draws a positive-edge event + odds, then chooses a
 * bankroll that makes the exact Kelly stake a clean positive integer. Every
 * number is computed with exact rationals via the solver in `kelly.ts`, and the
 * worked explanation quotes exactly those computed values.
 */

export type Tier = "easy" | "medium" | "hard";

export interface KellyInstance {
  id: string;
  source: Source;
  format: OddsFormat;
  eventKey: string;
  p: Fraction;
  b: Fraction;
  implied: Fraction;
  fStar: Fraction;
  bankroll: number;
  stake: number;
  prompt: string;
  explanation: string;
  difficulty: Difficulty;
  concept: string;
  commonErrors: { value: number; feedback: string }[];
}

const VENUES = [
  "the Monte Carlo pit",
  "the Riverside card room",
  "an after-hours prop desk",
  "the Aria high-limit salon",
  "a Chicago trading-floor side game",
  "the Belmont sportsbook",
  "a Jane Street game night",
  "the downtown poker club",
];

/* -------------------------------------------------------------------------- */
/*  Odds pools per format × tier                                               */
/* -------------------------------------------------------------------------- */

function pickAmerican(rng: Rng, tier: Tier): Odds {
  const positiveEasy = [110, 120, 130, 140, 150, 175, 200];
  const positiveMed = [130, 150, 175, 200, 250, 300, 400];
  const negatives = [-105, -110, -120, -125, -140, -150, -180, -200, -250];
  const american =
    tier === "hard"
      ? rng.pick(negatives)
      : rng.pick(tier === "easy" ? positiveEasy : positiveMed);
  return { format: "american", american };
}

function pickDecimal(rng: Rng, tier: Tier): Odds {
  const easy = ["1.50", "1.80", "2.00", "2.20", "2.50"];
  const med = ["1.75", "1.90", "2.40", "2.60", "3.00"];
  const hard = ["2.75", "3.25", "3.50", "1.85", "2.35", "4.00"];
  const decimal = rng.pick(tier === "easy" ? easy : tier === "medium" ? med : hard);
  return { format: "decimal", decimal };
}

function pickFractional(rng: Rng, tier: Tier): Odds {
  const easy: [number, number][] = [
    [1, 2],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
  ];
  const med: [number, number][] = [
    [3, 1],
    [5, 4],
    [7, 4],
    [4, 3],
  ];
  const hard: [number, number][] = [
    [9, 5],
    [11, 4],
    [7, 5],
    [8, 3],
    [13, 5],
  ];
  const [num, den] = rng.pick(
    tier === "easy" ? easy : tier === "medium" ? med : hard,
  );
  return { format: "fractional", num, den };
}

function pickOdds(rng: Rng, format: OddsFormat, tier: Tier): Odds {
  if (format === "american") return pickAmerican(rng, tier);
  if (format === "decimal") return pickDecimal(rng, tier);
  return pickFractional(rng, tier);
}

/* -------------------------------------------------------------------------- */
/*  Event pools per source × tier → (p, phrase, label, key)                    */
/* -------------------------------------------------------------------------- */

interface DrawnEvent {
  key: string;
  p: Fraction;
  phrase: string;
  label: string;
  /** Setup sentence fragment: "draw one card…", "flip 3 fair coins…". */
  setup: string;
  probDerivation: string;
}

function drawCardEvent(rng: Rng): DrawnEvent {
  // Full catalog: the positive-edge filter in the builder naturally selects
  // events with enough win probability for the drawn odds (favorites for
  // negative money lines, longer shots for plus money).
  const e = rng.pick(CARD_EVENTS);
  return {
    key: `card-${e.key}`,
    p: cardEventProb(e),
    phrase: `the card is ${e.phrase}`,
    label: e.label,
    setup: "draw one card from a standard 52-card deck",
    probDerivation: `${e.k}/52`,
  };
}

function drawCoinEvent(rng: Rng, tier: Tier): DrawnEvent {
  const n = tier === "easy" ? 2 : tier === "medium" ? 3 : 4;
  const pool: CoinEvent[] = COIN_EVENTS.filter((e) => e.ns.includes(n));
  const e = rng.pick(pool);
  const count = (() => {
    let c = 0;
    for (let h = 0; h <= n; h++) if (e.pred(h, n)) c += binomLocal(n, h);
    return c;
  })();
  return {
    key: `coin${n}-${e.key}`,
    p: coinEventProb(e, n),
    phrase: `you get ${e.phrase}`,
    label: e.label,
    setup: `flip ${n} fair coins`,
    probDerivation: `${count}/${2 ** n}`,
  };
}

function drawDiceEvent(rng: Rng, tier: Tier): DrawnEvent {
  const n = tier === "easy" ? 1 : 2;
  const pool: DiceEvent[] = DICE_EVENTS.filter((e) => e.ns.includes(n)).filter(
    (e) => (tier === "hard" ? true : e.key !== "sumEquals"),
  );
  const e = rng.pick(pool);
  const x = paramFor(rng, e);
  const total = 6 ** n;
  const count = Math.round(diceEventProb(e, n, x).valueOf() * total);
  return {
    key: `dice${n}-${e.key}-${x}`,
    p: diceEventProb(e, n, x),
    phrase: e.phrase(x),
    label: e.label(x),
    setup: n === 1 ? "roll one fair die" : "roll two fair dice",
    probDerivation: `${count}/${total}`,
  };
}

function paramFor(rng: Rng, e: DiceEvent): number {
  switch (e.key) {
    case "showsFace":
      return rng.int(1, 6);
    case "atLeastX":
      return rng.int(2, 5);
    case "bothAtLeastX":
      return rng.int(2, 4);
    case "sumEquals":
      return rng.pick([5, 6, 7, 8, 9]);
    case "sumGreater":
      return rng.pick([4, 5, 6, 7, 8]);
    case "sumAtLeast":
      return rng.pick([5, 6, 7, 8, 9]);
    default:
      return 0;
  }
}

function binomLocal(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let v = 1;
  for (let i = 0; i < k; i++) v = (v * (n - i)) / (i + 1);
  return Math.round(v);
}

function drawEvent(rng: Rng, source: Source, tier: Tier): DrawnEvent {
  if (source === "cards") return drawCardEvent(rng);
  if (source === "coins") return drawCoinEvent(rng, tier);
  return drawDiceEvent(rng, tier);
}

/* -------------------------------------------------------------------------- */
/*  Core builder — draws a positive-edge instance with a clean integer stake    */
/* -------------------------------------------------------------------------- */

function bDerivation(o: Odds): string {
  switch (o.format) {
    case "american":
      return o.american > 0 ? `${o.american}/100` : `100/${-o.american}`;
    case "decimal":
      return `${o.decimal} − 1`;
    case "fractional":
      return `${o.num}/${o.den}`;
  }
}

export function buildKellyInstance(
  rng: Rng,
  source: Source,
  format: OddsFormat,
  tier: Tier,
): KellyInstance {
  for (let attempt = 0; attempt < 500; attempt++) {
    const ev = drawEvent(rng, source, tier);
    const odds = pickOdds(rng, format, tier);
    const p = ev.p;
    const b = oddsToB(odds);
    const fStar = kellyFraction(p, b);
    if (fStar.valueOf() <= 0) continue; // need a real positive edge
    // f* = A/B in lowest terms (f* > 0 ⇒ sign +).
    const A = Number(fStar.n);
    const B = Number(fStar.d);
    // Choose bankroll = B·t so stake = A·t is a clean integer, keeping
    // stake ∈ [$25,$1000] and bankroll ∈ [$500,$4000] (dataset-like).
    const tLow = Math.max(Math.ceil(25 / A), Math.ceil(500 / B), 1);
    const tHigh = Math.min(Math.floor(1000 / A), Math.floor(4000 / B));
    if (tLow > tHigh) continue;
    const t = rng.int(tLow, tHigh);
    const bankroll = B * t;
    const stake = A * t;

    const implied = impliedProb(odds);
    const venue = rng.pick(VENUES);
    const prompt =
      `At ${venue}, ${ev.setup} — you win if ${ev.phrase}. ` +
      `The book prices it at ${oddsLabel(odds)} (${format}). ` +
      `With a $${bankroll.toLocaleString("en-US")} bankroll, what whole-dollar ` +
      `amount does the Kelly criterion say to stake?`;

    const q = fracText(F(1).sub(p)); // 1 − p
    const explanation =
      `Step 1 — True win probability. ${cap(ev.phrase)}: p = ${ev.probDerivation}` +
      (fracText(p) !== ev.probDerivation ? ` = ${fracText(p)}` : "") +
      ` ≈ ${pctText(p)}. So q = 1 − p = ${q}.\n` +
      `Step 2 — Net odds. ${oddsLabel(odds)} (${format}) → b = ${bDerivation(odds)} = ${fracText(b)} (profit per $1 staked).\n` +
      `Step 3 — Confirm the edge. Break-even (implied) prob = ${fracText(implied)} ≈ ${pctText(implied)}; your true p ≈ ${pctText(p)} is higher, so the edge is positive — size it.\n` +
      `Step 4 — Kelly fraction. f* = (b·p − q)/b = ${fracText(fStar)} ≈ ${pctText(fStar)} of bankroll.\n` +
      `Step 5 — Stake. f* × bankroll = ${fracText(fStar)} × $${bankroll.toLocaleString("en-US")} = $${stake.toLocaleString("en-US")}. Bet $${stake.toLocaleString("en-US")}.`;

    const commonErrors = buildCommonErrors({
      p,
      b,
      implied,
      fStar,
      bankroll,
      stake,
      odds,
    });

    return {
      id: `kelly-${source}-${format}-${ev.key}-${bankroll}`,
      source,
      format,
      eventKey: ev.key,
      p,
      b,
      implied,
      fStar,
      bankroll,
      stake,
      prompt,
      explanation,
      difficulty: tier,
      concept: "Kelly criterion",
      commonErrors,
    };
  }
  // Extremely unlikely: fall back to a guaranteed-valid canonical instance.
  return canonicalFallback(rng, source, format, tier);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* -------------------------------------------------------------------------- */
/*  Common-error taxonomy (targeted feedback for wrong numeric entries)        */
/* -------------------------------------------------------------------------- */

function buildCommonErrors(args: {
  p: Fraction;
  b: Fraction;
  implied: Fraction;
  fStar: Fraction;
  bankroll: number;
  stake: number;
  odds: Odds;
}): { value: number; feedback: string }[] {
  const { p, b, implied, fStar, bankroll, stake, odds } = args;
  const q = F(1).sub(p);
  const out: { value: number; feedback: string }[] = [];
  const seen = new Set<number>([stake]);
  const push = (value: number, feedback: string) => {
    if (!Number.isFinite(value) || value <= 0 || seen.has(value)) return;
    seen.add(value);
    out.push({ value, feedback });
  };
  // Every wrong-odds distractor is re-solved through the SAME exact Kelly
  // solver with a mis-converted b, so each is a genuine "what you'd get if you
  // made this specific conversion mistake" value — not an arbitrary offset.
  const pushWrongB = (bWrong: Fraction, feedback: string) => {
    const fWrong = kellyFraction(p, bWrong);
    if (fWrong.valueOf() > 0) push(Math.round(fWrong.mul(bankroll).valueOf()), feedback);
  };

  // 1) Bet the win probability p (forgot to subtract q / scale by odds).
  push(
    Math.round(p.mul(bankroll).valueOf()),
    "You staked bankroll × p — that bets your raw win probability, not the Kelly fraction. Kelly subtracts the loss probability q and scales the edge by the net odds b: f* = (b·p − q)/b.",
  );
  // 2) Use the implied / break-even probability as the bet fraction.
  push(
    Math.round(implied.mul(bankroll).valueOf()),
    "You used the break-even (implied) probability as your bet fraction. Implied prob only tells you whether an edge exists; the Kelly fraction tells you how much to bet.",
  );
  // 3) Stake the un-normalized numerator (b·p − q) — the full edge, not divided by b.
  push(
    Math.round(b.mul(p).sub(q).mul(bankroll).valueOf()),
    "You staked (b·p − q) × bankroll — the raw edge, not the Kelly fraction. You forgot to divide by b: f* = (b·p − q)/b.",
  );
  // 4) Bet the entire bankroll (no sizing at all — the classic risk-of-ruin mistake).
  push(
    bankroll,
    "That stakes your whole bankroll. Kelly bets only the fraction f* = (b·p − q)/b of it; betting the full roll maximizes variance and risk of ruin, not long-run growth.",
  );
  // 5) Treat the Kelly percentage as a dollar amount (ignored the bankroll).
  push(
    Math.round(fStar.mul(100).valueOf()),
    `You used f* ≈ ${pctText(fStar)} as a dollar figure. f* is a FRACTION of bankroll — multiply it by your $${bankroll.toLocaleString("en-US")} bankroll to get the stake.`,
  );
  // 6) Format-specific odds→b conversion mistakes, each re-solved exactly.
  if (odds.format === "american") {
    const M = Math.abs(odds.american);
    if (odds.american < 0) {
      // Negative line: correct b = 100/M; the classic slip is M/100.
      pushWrongB(
        F(M, 100),
        `On a negative money line (${odds.american}) the net odds are b = 100/${M}, not ${M}/100. Using ${M}/100 flips the payout and mis-sizes the bet.`,
      );
    } else {
      // Positive line: correct b = M/100; inverting (the negative-line rule) gives 100/M.
      pushWrongB(
        F(100, M),
        `On a positive money line (+${M}) the net odds are b = ${M}/100, not 100/${M}. You applied the negative-line rule and inverted the conversion.`,
      );
    }
  } else if (odds.format === "decimal") {
    // Gross odds used as net: forgot the −1 (decimal o already includes the stake).
    pushWrongB(
      F(odds.decimal),
      `Decimal odds ${odds.decimal} are GROSS (they include your returned stake). Net odds are b = ${odds.decimal} − 1 = ${fracText(b)}; you skipped the −1 and used ${odds.decimal}.`,
    );
  } else {
    // Fractional inverted: m:n → b = m/n, not n/m.
    pushWrongB(
      F(odds.den, odds.num),
      `Fractional odds ${odds.num}/${odds.den} give b = ${odds.num}/${odds.den} = ${fracText(b)}. You inverted them to ${odds.den}/${odds.num}.`,
    );
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Fallback (guaranteed valid) — red card / decimal 2.00 style                 */
/* -------------------------------------------------------------------------- */

function canonicalFallback(
  _rng: Rng,
  source: Source,
  format: OddsFormat,
  tier: Tier,
): KellyInstance {
  // A guaranteed positive-edge item: an exactly-even (p = 1/2) event paired
  // with odds giving b = 2, so f* = (2·½ − ½)/2 = 1/4 > 0.
  const ev: DrawnEvent =
    source === "cards"
      ? {
          key: "card-red",
          p: F(26, 52),
          phrase: "the card is a red card",
          label: "red (26/52)",
          setup: "draw one card from a standard 52-card deck",
          probDerivation: "26/52",
        }
      : source === "coins"
        ? {
            key: "coin2-exactlyOneHead",
            p: F(2, 4),
            phrase: "you get exactly one head",
            label: "exactly one head",
            setup: "flip 2 fair coins",
            probDerivation: "2/4",
          }
        : {
            key: "dice1-even",
            p: F(3, 6),
            phrase: "the die shows an even number",
            label: "die even (3/6)",
            setup: "roll one fair die",
            probDerivation: "3/6",
          };
  const odds: Odds =
    format === "american"
      ? { format: "american", american: 200 }
      : format === "decimal"
        ? { format: "decimal", decimal: "3.00" }
        : { format: "fractional", num: 2, den: 1 };
  const p = ev.p;
  const b = oddsToB(odds);
  const fStar = kellyFraction(p, b);
  const A = Number(fStar.n);
  const B = Number(fStar.d);
  const t = Math.max(Math.ceil(500 / B), Math.ceil(25 / A));
  const bankroll = B * t;
  const stake = A * t;
  const implied = impliedProb(odds);
  return {
    id: `kelly-${source}-${format}-${ev.key}-fb${bankroll}`,
    source,
    format,
    eventKey: ev.key,
    p,
    b,
    implied,
    fStar,
    bankroll,
    stake,
    prompt: `You ${ev.setup} and win if ${ev.phrase}. Odds ${oddsLabel(odds)} (${format}). Bankroll $${bankroll}. Kelly stake in whole dollars?`,
    explanation: `f* = (b·p − q)/b = ${fracText(fStar)}; stake = ${fracText(fStar)} × $${bankroll} = $${stake}.`,
    difficulty: tier,
    concept: "Kelly criterion",
    commonErrors: buildCommonErrors({ p, b, implied, fStar, bankroll, stake, odds }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Adapters: KellyInstance → NumericQuestion, and the 9 named generators       */
/* -------------------------------------------------------------------------- */

export function instanceToNumeric(inst: KellyInstance): NumericQuestion {
  return {
    id: inst.id,
    prompt: inst.prompt,
    answer: inst.stake,
    difficulty: inst.difficulty,
    concept: inst.concept,
    explanation: inst.explanation,
    unit: "$",
    commonErrors: inst.commonErrors,
    source: `Kelly · ${inst.source} · ${inst.format}`,
  };
}

/** Build a numeric generator for a given (source, format), tier-configurable. */
export function makeKellyGenerator(
  source: Source,
  format: OddsFormat,
  tier?: Tier,
): NumericQuestionGenerator {
  return (rng: Rng) => {
    const t: Tier = tier ?? rng.pick(["easy", "medium", "hard"] as const);
    return instanceToNumeric(buildKellyInstance(rng, source, format, t));
  };
}

const SOURCES: Source[] = ["cards", "coins", "dice"];
const FORMATS: OddsFormat[] = ["american", "decimal", "fractional"];

/** The nine base generators (default: tier drawn per call to span the space). */
export const KELLY_GENERATORS: Record<string, NumericQuestionGenerator> = (() => {
  const out: Record<string, NumericQuestionGenerator> = {};
  for (const s of SOURCES)
    for (const f of FORMATS) out[`gen_${s}_${f}`] = makeKellyGenerator(s, f);
  return out;
})();

/** Combine several numeric generators into one that picks among them per call (family-tagged). */
export const mixNumeric = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => mixNumericGenerators(pool);

/** The nine instance builders (structured output) — used by verification tests. */
export const KELLY_INSTANCE_BUILDERS: Record<
  string,
  (rng: Rng) => KellyInstance
> = (() => {
  const out: Record<string, (rng: Rng) => KellyInstance> = {};
  for (const s of SOURCES)
    for (const f of FORMATS)
      out[`gen_${s}_${f}`] = (rng: Rng) =>
        buildKellyInstance(
          rng,
          s,
          f,
          rng.pick(["easy", "medium", "hard"] as const),
        );
  return out;
})();
