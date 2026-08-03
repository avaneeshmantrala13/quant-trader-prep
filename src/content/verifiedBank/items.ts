import type { VerifiedItem } from "./schema";
import { MENTAL_MATH_ITEMS } from "./itemsMentalMath";
import { PROBABILITY_EV_ITEMS } from "./itemsProbabilityEv";
import { MARKET_MAKING_ITEMS } from "./itemsMarketMaking";
import { SEQUENCE_ITEMS } from "./itemsSequences";
import { ESTIMATION_ITEMS } from "./itemsEstimation";
import { BRAINTEASER_ITEMS } from "./itemsBrainteasers";
import { ARBITRAGE_ITEMS } from "./itemsArbitrage";

/**
 * The full curated Verified Bank seed set (T9): >= 50 ORIGINAL, human-authored
 * interview-style quant-trader problems, each with provenance and a full worked
 * solution. Split by category into sibling files for authorability; this module
 * simply concatenates them in the curated category order.
 *
 * SCALE / CADENCE: the roadmap target is 300–500 items with a +50/month
 * sourcing cadence. This is the initial solid seed; new batches append to the
 * per-category files and flow through automatically.
 */
export const VERIFIED_ITEMS: VerifiedItem[] = [
  ...MENTAL_MATH_ITEMS,
  ...PROBABILITY_EV_ITEMS,
  ...MARKET_MAKING_ITEMS,
  ...SEQUENCE_ITEMS,
  ...ESTIMATION_ITEMS,
  ...BRAINTEASER_ITEMS,
  ...ARBITRAGE_ITEMS,
];
