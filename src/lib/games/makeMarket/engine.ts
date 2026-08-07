/**
 * ============================================================================
 *  MAKE ME A MARKET — GAME ENGINE (pure model, no React)
 * ============================================================================
 * Faithful implementation of the tradinginterview.com "Make Me a Market" game
 * as documented in `QuantGames-Mechanics.md` (Game 1). The player is the MARKET
 * MAKER: they quote a two-sided market (bid/ask) on an unknown quantity, a
 * counterparty trades against them, and after several rounds the player is
 * quizzed on their net position, max guaranteed loss, and break-even price.
 *
 * The flow this engine models (from the doc):
 *   • Round 1  — quote a 95% CONFIDENCE INTERVAL (wide). Getting traded on here
 *     is itself a mistake (your interval was too narrow or your mid was off).
 *   • Rounds 2+ — quote a TIGHT market under a hard MAX-SPREAD constraint
 *     (spread must be strictly < max; a spread == max is rejected). Each side
 *     carries a volume (size); the counterparty may raise size against you.
 *   • The counterparty is INFORMED: it knows the true value and lifts your ask
 *     (you go short) when your ask < true value, or hits your bid (you go long)
 *     when your bid > true value. If the true value sits inside your market it
 *     usually passes — but on a market that is *too wide* it nibbles the closer
 *     side, and on a *skewed stale* market it presses size on the profitable
 *     side (the "waits and buys all 10 at your unreasonably low ask" lesson).
 *
 * All money math is exact to the cent via integer cents internally; prices are
 * plain numbers at the API boundary. The break-even algorithm is the precise
 * multi-lot pairing algorithm from the doc, unit-tested against its worked
 * scenarios.
 */
import { Rng } from "@/lib/rng";

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

export type Side = "buy" | "sell";

/** A single fill from the player's perspective. */
export interface Fill {
  /** From the PLAYER's perspective: "buy" = player bought (long), "sell" = sold (short). */
  side: Side;
  price: number;
  size: number;
  /** Which round produced this fill (1-based). */
  round: number;
}

/** A two-sided quote the player submits in a tight-market round. */
export interface Quote {
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
}

/** A 95% confidence interval quote (round 1). */
export interface IntervalQuote {
  lower: number;
  upper: number;
}

export type RoundKind = "interval" | "tight";

export interface RoundSpec {
  index: number; // 1-based
  kind: RoundKind;
  /** For tight rounds: the strict max spread (ask − bid must be < this). */
  maxSpread?: number;
}

/** Result of the counterparty acting on a player's quote. */
export interface CounterpartyAction {
  /** null = counterparty passed (no trade this round). */
  fill: Fill | null;
  /** Human-readable counterparty "chat" line, e.g. "Mine, 5 times!". */
  chatter: string;
  /** True if the player got traded on their round-1 interval (a flagged mistake). */
  tradedOnInterval?: boolean;
  /**
   * Which kind of flow produced this action, so coaching can react correctly:
   *   • "informed" — an adverse pick-off (your mid was off, truth outside market)
   *   • "noise"    — uninformed flow that PAID your spread (a good outcome)
   *   • "pass"     — nobody traded this round
   */
  kind?: "informed" | "noise" | "pass";
}

/* ========================================================================== */
/*  Validation                                                                 */
/* ========================================================================== */

export interface QuoteValidation {
  ok: boolean;
  /** Reason for rejection, matching the game's wording where possible. */
  error?: string;
}

/** Round-1 interval validation: lower must be < upper and both finite. */
export function validateInterval(q: IntervalQuote): QuoteValidation {
  if (!Number.isFinite(q.lower) || !Number.isFinite(q.upper)) {
    return { ok: false, error: "Enter a lower and upper bound." };
  }
  if (q.lower >= q.upper) {
    return { ok: false, error: "The lower bound must be below the upper bound." };
  }
  if (q.lower < 0) {
    return { ok: false, error: "Bounds can't be negative for this quantity." };
  }
  return { ok: true };
}

/**
 * Tight-market validation. The spread (ask − bid) must be STRICTLY LESS THAN
 * the max — the doc records that a spread exactly equal to the max was rejected
 * ("The spread should be smaller than: 1").
 */
export function validateQuote(q: Quote, maxSpread: number): QuoteValidation {
  const vals = [q.bid, q.ask, q.bidSize, q.askSize];
  if (vals.some((v) => !Number.isFinite(v))) {
    return { ok: false, error: "Fill in bid, ask, and both sizes." };
  }
  if (q.bid >= q.ask) {
    return { ok: false, error: "Your bid must be below your ask." };
  }
  if (q.bidSize < 1 || q.askSize < 1) {
    return { ok: false, error: "Each side needs a size of at least 1." };
  }
  const spread = round2(q.ask - q.bid);
  if (spread >= maxSpread) {
    return { ok: false, error: `The spread should be smaller than: ${maxSpread}` };
  }
  return { ok: true };
}

/* ========================================================================== */
/*  Counterparty (MIXED flow: informed pick-off + uninformed noise)            */
/* ========================================================================== */

/**
 * MAX probability the INFORMED side acts when your quote is badly OFFSIDE (the
 * truth sits well outside your market). The effective rate scales SMOOTHLY with
 * how far offside you are (see `INFORMED_SPAN`), so a tiny overhang is rarely
 * punished while a gross mis-price is picked off almost every round. This is
 * the fairness fix for F1: a competent-but-imperfect valuation (truth just
 * outside your spread) is no longer picked off 70% of the time.
 */
const INFORMED_RATE_MAX = 0.85;
/**
 * The overhang (how far the truth is outside your market), measured in units of
 * the max spread, at which the informed pick-off rate reaches its max. A miss
 * of ~0.6·maxSpread past your quote ⇒ near-certain adverse selection; a sliver
 * past it ⇒ only an occasional nibble. Small estimation error → ~break-even;
 * gross mis-pricing → punished hard.
 */
const INFORMED_SPAN = 0.6;
/**
 * Base rate of UNINFORMED "noise" flow crossing a razor-tight market. The
 * effective rate is scaled by how tight your spread is relative to the cap.
 */
const NOISE_BASE = 1.0;
/** Largest lot count an uninformed order will take (capped by the size you show). */
const NOISE_MAX_LOTS = 3;

/**
 * The counterparty acts on a TIGHT quote with a REALISTIC mix of flow. This is
 * the fix for the old "informed-only" model that made the game unwinnable, and
 * for F1 (winnable only in a razor-thin valuation band):
 *
 *   1. INFORMED FLOW (adverse) — the counterparty knows `trueValue`. When the
 *      truth is OUTSIDE your market (ask < true, or bid > true) it picks off the
 *      good side, pressing more size the bigger your error. Crucially the rate
 *      now scales with the OVERHANG (how far outside the truth sits, in max-
 *      spread units): a quote that's only a touch offside is rarely and lightly
 *      picked, while a grossly mis-centred quote is adversely selected nearly
 *      every round. So EV falls smoothly and monotonically as |mid − truth|
 *      grows — a competent ±10% valuation is roughly break-even, a wild mis-
 *      price bleeds.
 *
 *   2. UNINFORMED / NOISE FLOW — a trader who just wants to trade crosses your
 *      market on a RANDOM side, paying your edge. Because the side is random it
 *      pays you the HALF-SPREAD on average, which is what lets a tight, well-
 *      centred quote earn money. Its willingness to cross falls LINEARLY as your
 *      spread widens toward the cap, so the expected earn (rate·half-spread)
 *      peaks at a spread near HALF the cap — the sweet spot — and a near-max
 *      spread gets almost no fills (earns ~0, the "stupid-wide is sterilised,
 *      never a real earn" outcome).
 *
 * Net effect (the EV logic that makes it winnable AND fair):
 *   • A well-centred quote (truth inside) never sees informed flow, so its
 *     EV = P(noise)·half-spread·size  > 0, maximised near a half-cap spread.
 *   • A slightly-off quote loses only a little (rare, light pick-offs) → the
 *     game is winnable for a realistic estimator, not only a perfect one.
 *   • A badly-centred quote is picked off almost every round for size-scaled
 *     losses that swamp the half-spread it collects → EV < 0.
 *
 * `aggression` scales how much size the informed side takes when it has edge.
 * All randomness comes from the seeded `rng`, so outcomes stay deterministic.
 */
export function counterpartyTight(
  q: Quote,
  trueValue: number,
  maxSpread: number,
  round: number,
  rng: Rng,
  aggression = 1,
): CounterpartyAction {
  const askEdge = trueValue - q.ask; // >0 → buying your ask is +EV for them (you short)
  const bidEdge = q.bid - trueValue; // >0 → selling to your bid is +EV for them (you long)
  const spread = q.ask - q.bid;

  // 1) INFORMED FLOW — only when the truth is outside your market, fired with a
  //    probability that GROWS with how far offside you are. Pick the profitable
  //    side (larger positive edge) and press size with the edge.
  const overhang = Math.max(askEdge, bidEdge, 0);
  const span = INFORMED_SPAN * Math.max(maxSpread, 1e-9);
  const pInformed = INFORMED_RATE_MAX * clamp01(overhang / span);
  if (overhang > 0 && rng.next() < pInformed) {
    if (askEdge >= bidEdge) {
      const size = edgeToSize(askEdge, maxSpread, q.askSize, aggression, rng);
      return {
        fill: { side: "sell", price: q.ask, size, round },
        chatter: pressChatter(size, "buy"),
        kind: "informed",
      };
    }
    const size = edgeToSize(bidEdge, maxSpread, q.bidSize, aggression, rng);
    return {
      fill: { side: "buy", price: q.bid, size, round },
      chatter: pressChatter(size, "sell"),
      kind: "informed",
    };
  }

  // 2) UNINFORMED / NOISE FLOW — crosses on a random side, paying your edge.
  //    Willingness to cross falls LINEARLY with how wide you quote, so the
  //    expected earn (rate · half-spread) peaks near a HALF-cap spread and a
  //    near-max spread gets almost no fills (earns ~0).
  const tightness = maxSpread > 0 ? clamp01(1 - spread / maxSpread) : 0;
  if (rng.next() < NOISE_BASE * tightness) {
    const buysYourAsk = rng.next() < 0.5;
    if (buysYourAsk) {
      const size = noiseSize(q.askSize, rng);
      return {
        fill: { side: "sell", price: q.ask, size, round },
        chatter: noiseChatter(size, "buy"),
        kind: "noise",
      };
    }
    const size = noiseSize(q.bidSize, rng);
    return {
      fill: { side: "buy", price: q.bid, size, round },
      chatter: noiseChatter(size, "sell"),
      kind: "noise",
    };
  }

  // 3) No trade this round.
  return { fill: null, chatter: "No interest at that market — flow's quiet.", kind: "pass" };
}

/**
 * The counterparty acts on a ROUND-1 interval. A correctly WIDE 95% interval
 * should not be traded on. It only trades if the true value falls OUTSIDE the
 * interval (mid was miles off) or the interval is implausibly tight relative to
 * the scale of the answer — both flagged as a mistake.
 */
export function counterpartyInterval(
  q: IntervalQuote,
  trueValue: number,
  round: number,
): CounterpartyAction {
  // Interval too tight: width < 20% of the true value is "not a 95% interval".
  const width = q.upper - q.lower;
  const tooTight = width < 0.2 * Math.abs(trueValue);

  if (trueValue > q.upper) {
    // True value above your upper bound → they BUY your ask (upper). You short.
    return {
      fill: { side: "sell", price: q.upper, size: 1, round },
      chatter: "I'll buy your upper — you're too low.",
      tradedOnInterval: true,
    };
  }
  if (trueValue < q.lower) {
    return {
      fill: { side: "buy", price: q.lower, size: 1, round },
      chatter: "I'll sell you your lower — you're too high.",
      tradedOnInterval: true,
    };
  }
  if (tooTight) {
    // Inside, but interval implausibly tight → they pick the closer edge.
    const closerIsUpper = trueValue - q.lower > q.upper - trueValue;
    return closerIsUpper
      ? {
          fill: { side: "sell", price: q.upper, size: 1, round },
          chatter: "That's not a 95% interval — I'll take your upper.",
          tradedOnInterval: true,
        }
      : {
          fill: { side: "buy", price: q.lower, size: 1, round },
          chatter: "That's not a 95% interval — I'll hit your lower.",
          tradedOnInterval: true,
        };
  }
  return { fill: null, chatter: "Wide enough — I'll pass. Now tighten it up." };
}

/** Map an edge (in price) to a size the counterparty takes, scaled by aggression. */
function edgeToSize(
  edge: number,
  maxSpread: number,
  offeredSize: number,
  aggression: number,
  rng: Rng,
): number {
  const units = edge / Math.max(maxSpread, 1e-9); // edge in max-spread units
  // Bigger edge → press more size, capped by what the player offered.
  const desired = Math.max(1, Math.round(units * aggression * (1 + rng.next())));
  return Math.min(offeredSize, desired);
}

function pressChatter(size: number, theirSide: Side): string {
  const verb = theirSide === "buy" ? "Mine" : "Yours";
  if (size >= 5) return `${verb}, ${size} times! You're way off.`;
  if (size >= 2) return `${verb}, ${size}.`;
  return `${verb}.`;
}

/** A modest, size-capped uninformed order (pays the player their spread). */
function noiseSize(offeredSize: number, rng: Rng): number {
  return Math.max(1, Math.min(offeredSize, rng.int(1, NOISE_MAX_LOTS)));
}

/** Friendly "just want to trade" chatter for uninformed flow. */
function noiseChatter(size: number, theirSide: Side): string {
  return theirSide === "buy"
    ? `I'll take ${size} at your offer, thanks.`
    : `I'll hit your bid for ${size}.`;
}

/* ========================================================================== */
/*  Position / P&L                                                             */
/* ========================================================================== */

export interface Position {
  /** Signed net lots: + = net long, − = net short. */
  net: number;
  /** Average entry price of the OPEN (net) side, or null if flat. */
  avgOpenPrice: number | null;
}

/** Net signed position from a list of fills (+ long, − short). */
export function netPosition(fills: Fill[]): number {
  return fills.reduce((n, f) => n + (f.side === "buy" ? f.size : -f.size), 0);
}

/**
 * Mark-to-true P&L: every lot is settled at the true value.
 *   buy  → (trueValue − price) per lot
 *   sell → (price − trueValue) per lot
 */
export function markToTrue(fills: Fill[], trueValue: number): number {
  let pnl = 0;
  for (const f of fills) {
    const per = f.side === "buy" ? trueValue - f.price : f.price - trueValue;
    pnl += per * f.size;
  }
  return round2(pnl);
}

/**
 * Parse the intended BREAK-EVEN PRICE out of whatever the player types into the
 * single price box. The quiz fixes the side (BUY/SELL toggle) and the size, so
 * the player only needs to enter a price — but this stays lenient so that
 * typing the WHOLE trade (e.g. "2 @ 600", mirroring the revealed answer format)
 * still grades on the intended price rather than the size.
 *
 * Rules:
 *   • Strip "$" and thousands commas.
 *   • If the string contains "@", take the substring AFTER the LAST "@"
 *     ("2 @ 600" → 600, "@600" → 600).
 *   • Otherwise parse the LAST number in the string (the price is quoted last).
 *   • Return NaN when nothing parseable is present.
 */
export function parseBreakEvenPrice(input: string): number {
  if (input == null) return NaN;
  // Drop currency symbols and thousands separators; keep spaces so distinct
  // numbers stay separate when there is no "@".
  const cleaned = input.replace(/[$,]/g, "");
  if (cleaned.includes("@")) {
    const after = cleaned.slice(cleaned.lastIndexOf("@") + 1).trim();
    const n = parseFloat(after);
    return Number.isNaN(n) ? NaN : n;
  }
  const matches = cleaned.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return NaN;
  return parseFloat(matches[matches.length - 1]);
}

/* ========================================================================== */
/*  Break-even — the precise multi-lot algorithm (doc Game 1)                  */
/* ========================================================================== */

export interface BreakEvenResult {
  /** Max guaranteed loss from pairing highest buys with lowest sells. */
  maxGuaranteedLoss: number;
  /** Signed net leftover position after all cross-pairs. */
  net: number;
  /** Break-even price for the leftover lots, or null if flat. */
  price: number | null;
  /** The side you must trade the leftover at to break even. */
  side: Side | null;
  /** False when the required break-even price is negative → impossible. */
  possible: boolean;
}

/**
 * Break-even algorithm from the doc:
 *   1. MAX GUARANTEED LOSS — repeatedly pair the HIGHEST buy with the LOWEST
 *      sell; each pair's (buy − sell) is a locked loss (only positive losses
 *      count — a favourable pair contributes 0). Continue until one side is
 *      exhausted; leftover lots are the net position.
 *   2. BREAK-EVEN on the leftover — if net SHORT N, average the remaining
 *      (un-crossed) SELL prices and subtract loss/N → the price to BUY N at.
 *      Net LONG is the mirror: avg remaining BUYS + loss/N → price to SELL N.
 *   3. If that price is negative → breaking even is impossible.
 *
 * Fills are expanded to one lot each so multi-lot fills pair correctly.
 */
export function breakEven(fills: Fill[]): BreakEvenResult {
  // Expand to per-lot prices.
  const buys: number[] = [];
  const sells: number[] = [];
  for (const f of fills) {
    for (let i = 0; i < f.size; i++) {
      (f.side === "buy" ? buys : sells).push(f.price);
    }
  }
  // Sort: highest buys first, lowest sells first (worst-case pairing).
  const buyDesc = [...buys].sort((a, b) => b - a);
  const sellAsc = [...sells].sort((a, b) => a - b);

  let maxLoss = 0;
  let bi = 0;
  let si = 0;
  while (bi < buyDesc.length && si < sellAsc.length) {
    const loss = buyDesc[bi] - sellAsc[si]; // buy high, sell low = loss
    if (loss > 0) maxLoss += loss;
    bi++;
    si++;
  }
  maxLoss = round2(maxLoss);

  const leftoverBuys = buyDesc.slice(bi); // net long remainder
  const leftoverSells = sellAsc.slice(si); // net short remainder
  const net = buys.length - sells.length;

  if (net === 0) {
    return { maxGuaranteedLoss: maxLoss, net: 0, price: null, side: null, possible: true };
  }

  if (net < 0) {
    // Net SHORT |net|: average remaining sells, subtract loss/N → BUY price.
    const n = leftoverSells.length;
    const avgSell = mean(leftoverSells);
    const price = round2(avgSell - maxLoss / n);
    return {
      maxGuaranteedLoss: maxLoss,
      net,
      price,
      side: "buy",
      possible: price >= 0,
    };
  }
  // Net LONG net: average remaining buys, add loss/N → SELL price.
  const n = leftoverBuys.length;
  const avgBuy = mean(leftoverBuys);
  const price = round2(avgBuy + maxLoss / n);
  return {
    maxGuaranteedLoss: maxLoss,
    net,
    price,
    side: "sell",
    possible: price >= 0,
  };
}

/* ========================================================================== */
/*  Scoring                                                                     */
/* ========================================================================== */

export const START_BALANCE = 1000;

/** Final balance = start + mark-to-true P&L across all fills. */
export function finalBalance(fills: Fill[], trueValue: number): number {
  return round2(START_BALANCE + markToTrue(fills, trueValue));
}

/* ========================================================================== */
/*  Coaching (the real lesson: SKEW + don't chase price, add size)             */
/* ========================================================================== */

export interface Coaching {
  headline: string;
  detail: string;
}

/**
 * Generate between-round coaching from the fill history AND the kind of flow that
 * just traded. The corrected lessons (matching the mixed-flow model):
 *   • Uninformed flow that PAID your spread → reinforce: a tight, centred, two-
 *     sided quote with real size is exactly how you earn. SIZE helps HERE.
 *   • Informed pick-off → your mid was off (truth outside your market). Recentre
 *     toward the fill; do NOT add size into an offside quote — fix the centre and
 *     keep the spread tight but honest. Widen only when you're genuinely unsure.
 */
export function coachAfterRound(
  fills: Fill[],
  lastAction: CounterpartyAction,
): Coaching | null {
  if (lastAction.tradedOnInterval) {
    return {
      headline: "You got traded on your 95% interval.",
      detail:
        "That should never happen: either your market wasn't wide enough, or your mid was off by miles. A 95% interval should comfortably bracket the truth.",
    };
  }
  if (!lastAction.fill) return null;

  const f = lastAction.fill;

  // Uninformed flow paid you the spread — the whole point of making a market.
  if (lastAction.kind === "noise") {
    return {
      headline: "You earned the spread.",
      detail: `Uninformed flow crossed your market and paid your edge — that's a market maker's bread and butter. A tight, well-centred quote collects this on average, and showing MORE size on both sides earns more when your mid is trustworthy. Keep quoting.`,
    };
  }

  // Everything below is an informed pick-off: the truth was outside your market.
  const sells = fills.filter((x) => x.side === "sell");
  const buys = fills.filter((x) => x.side === "buy");

  if (f.side === "sell" && sells.length >= 2) {
    const lastTwo = sells.slice(-2);
    const notHigher = lastTwo[1].price <= lastTwo[0].price;
    if (notHigher) {
      return {
        headline: "You keep getting lifted — your mid is too low.",
        detail: `Your last sell was at ${fmt(lastTwo[0].price)}; the truth is above your ask. Skew your WHOLE market up so the truth sits back inside your spread. Don't add size to an offside quote — recentre first, then show size.`,
      };
    }
  }
  if (f.side === "buy" && buys.length >= 2) {
    const lastTwo = buys.slice(-2);
    const notLower = lastTwo[1].price >= lastTwo[0].price;
    if (notLower) {
      return {
        headline: "You keep getting hit — your mid is too high.",
        detail: `Your last buy was at ${fmt(lastTwo[0].price)}; the truth is below your bid. Move the whole market DOWN so the truth is inside your spread again — chasing size here just deepens an offside book.`,
      };
    }
  }
  if (f.size >= 3) {
    return {
      headline: "They pressed size on you.",
      detail: `They took ${f.size} lots at ${fmt(f.price)} — the truth was well outside your market. Recentre hard toward the fill; only add size once your mid is trustworthy, never into a quote that's offside.`,
    };
  }
  return {
    headline: "You got picked off.",
    detail: `An informed trader took the good side, so the truth was outside your market. Nudge your mid toward the fill and keep your spread tight but centred — a well-placed quote earns from the flow that ISN'T informed.`,
  };
}

/* ========================================================================== */
/*  Round plan                                                                 */
/* ========================================================================== */

/** Build the round plan: round 1 is the interval, then `tightRounds` tight rounds. */
export function buildRounds(tightRounds: number, maxSpread: number): RoundSpec[] {
  const rounds: RoundSpec[] = [{ index: 1, kind: "interval" }];
  for (let i = 0; i < tightRounds; i++) {
    rounds.push({ index: i + 2, kind: "tight", maxSpread });
  }
  return rounds;
}

/* ========================================================================== */
/*  Helpers                                                                     */
/* ========================================================================== */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Clamp a number into [0, 1]. */
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
