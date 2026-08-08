/**
 * ============================================================================
 *  HARD-TO-VALUE QUANTITIES — Stage-4 (game-OA / trading-intuition) content
 * ============================================================================
 * A small, ORIGINAL bank of "make a market on this" prompts for the guided
 * pipeline's Stage-4 trading-intuition game (spec §2 / §3.2 / §10.8). Each
 * prompt is a hard-to-value quantity — "lightbulbs in Texas", "streetlights in
 * a city of 500,000", "options quotes a market maker streams per day" — that a
 * candidate must price COLD, exactly like a make-a-market interview.
 *
 * DESIGN (mirrors `makeMarketScenarios.ts`, reused — NOT copied):
 *   • Every quantity is a PARAMETRIC generator. Each deal re-rolls the underlying
 *     inputs (state population, per-capita rates, requote frequency, …) and
 *     RECOMPUTES the true value from those same inputs, so there is nothing to
 *     memorise — only the estimation METHOD transfers.
 *   • The true value is the EXACT product of the drawn factors (a verifier-style
 *     reference), never a hand-picked per-instance number. Each scenario carries
 *     a {@link QuantityReference} that records the exact base-unit count, the
 *     display scale, and a one-line rationale, so `reference.value` is provably
 *     the honest rounding of a computed reference (unit-tested).
 *
 * These objects are structurally compatible with the make-a-market engine's
 * {@link Scenario} (they extend it), so Stage-4 can feed `trueValue` +
 * `suggestedMaxSpread` straight into `counterpartyTight` / `markToTrue` from
 * `@/lib/games/makeMarket/engine.ts` with zero engine changes.
 */
import { Rng } from "@/lib/rng";
import type { Scenario } from "@/content/games/makeMarketScenarios";

/**
 * The exact, defensible reference behind a dealt quantity. `value` is the true
 * value shown to the engine (in DISPLAY units); `raw` is the exact count in BASE
 * units; `scale` is the divisor from base → display (e.g. 1e6 for "millions").
 * By construction `value === Math.round(raw / scale)`, which is what makes the
 * true value a verifier-checked reference rather than a guess.
 */
export interface QuantityReference {
  /** True value in display units (equals `Scenario.trueValue`). */
  value: number;
  /** Exact computed count in base units (e.g. actual number of bulbs). */
  raw: number;
  /** Divisor from base units → display units (1 when already in base units). */
  scale: number;
  /** One-line, defensible derivation ("pop ÷ people/home × bulbs/home × …"). */
  rationale: string;
}

/** A hard-to-value quantity scenario: an engine {@link Scenario} + its reference. */
export interface HardQuantityScenario extends Scenario {
  reference: QuantityReference;
}

/** A generator turns a seeded Rng into one concrete hard-to-value scenario. */
export type HardQuantityGenerator = (rng: Rng) => HardQuantityScenario;

/* ========================================================================== */
/*  Formatting + math helpers                                                  */
/* ========================================================================== */

function commas(n: number): string {
  return Math.round(n).toLocaleString();
}

/** Human population label: 0.5 → "500,000", 2 → "2 million". */
function popLabel(popM: number): string {
  if (popM < 1) return `${commas(popM * 1_000_000)}`;
  return `${Number.isInteger(popM) ? popM : popM.toFixed(1)} million`;
}

/** Nearest "nice" number of the form {1,2,2.5,5,10}·10^k to a target. */
function niceNumber(target: number): number {
  const t = Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(t)));
  const candidates = [1, 2, 2.5, 5, 10].map((s) => s * mag);
  return candidates.reduce((best, c) =>
    Math.abs(c - t) < Math.abs(best - t) ? c : best,
  );
}

/**
 * A strict max-spread scaled to ~1/3 of the answer's magnitude, rounded nice —
 * generous enough that a competent-but-imperfect valuation can quote a tight-
 * but-real two-sided market (the earning sweet spot sits near HALF the cap), yet
 * strict enough that sloppy pricing gets picked off. Mirrors the calibrated
 * `niceSpread` in `makeMarketScenarios.ts`. Always `< trueValue` for these
 * generators (their true values are all comfortably ≥ 10 display units).
 */
function niceSpread(trueValue: number): number {
  return niceNumber(trueValue * 0.33);
}

/** Build a scenario from a raw base-unit count + a display scale (rounds honestly). */
function mk(
  base: Omit<Scenario, "trueValue" | "suggestedMaxSpread">,
  raw: number,
  scale: number,
  rationale: string,
): HardQuantityScenario {
  const value = Math.max(1, Math.round(raw / scale));
  return {
    ...base,
    trueValue: value,
    suggestedMaxSpread: niceSpread(value),
    reference: { value, raw, scale, rationale },
  };
}

/* ========================================================================== */
/*  Generators (fully parametric; each true value is an EXACT product)         */
/* ========================================================================== */

/** Lightbulbs in a large state (Texas-scale), answer in MILLIONS of bulbs. */
const genLightbulbsState: HardQuantityGenerator = (rng) => {
  const popM = rng.pick([20, 25, 29, 30, 35]); // Texas ≈ 30M
  const peoplePerHome = rng.pick([2.5, 2.7, 3]);
  const bulbsPerHome = rng.pick([30, 40, 45, 50]);
  const commercialFactor = rng.pick([1.2, 1.3, 1.4]); // add offices/streets/public
  const pop = popM * 1_000_000;
  const homes = pop / peoplePerHome;
  const raw = homes * bulbsPerHome * commercialFactor;
  return mk(
    {
      id: "lightbulbs-state",
      category: "Estimation",
      kind: "guesstimate",
      prompt: `How many lightbulbs are there in a state of ${popLabel(popM)} people, in millions?`,
      unit: "million bulbs",
      decomposition: [
        `${popLabel(popM)} people at ~${peoplePerHome} per household ≈ ${commas(homes)} homes.`,
        `~${bulbsPerHome} bulbs per home → ~${commas(homes * bulbsPerHome)} residential bulbs.`,
        `Add ~${Math.round((commercialFactor - 1) * 100)}% for offices, streets and public spaces → ~${commas(raw)} ≈ ${commas(raw / 1_000_000)} million.`,
      ],
      anchor: `A sanity ceiling: even 100 bulbs per person is ${commas((pop * 100) / 1_000_000)} million — your answer should be a MODEST multiple of the population, not a wild one.`,
    },
    raw,
    1_000_000,
    "state_population ÷ people_per_home × bulbs_per_home × commercial_factor",
  );
};

/** Streetlights in a city (incl. a city of 500,000), answer in THOUSANDS. */
const genStreetlightsCity: HardQuantityGenerator = (rng) => {
  const popM = rng.pick([0.5, 0.75, 1, 2]); // 0.5 = a city of 500,000
  const perPerson = rng.pick([0.03, 0.04, 0.05, 0.06]);
  const pop = popM * 1_000_000;
  const raw = pop * perPerson;
  return mk(
    {
      id: "streetlights-city",
      category: "Estimation",
      kind: "guesstimate",
      prompt: `How many streetlights are in a city of ${popLabel(popM)} people, in thousands?`,
      unit: "thousand lights",
      decomposition: [
        `Streetlights scale with road length, which scales with people: ~${perPerson} lights per resident.`,
        `${popLabel(popM)} × ${perPerson} ≈ ${commas(raw)} lights.`,
        `That's ≈ ${commas(raw / 1000)} thousand.`,
      ],
      anchor: `A per-capita rate keeps you honest — a city of ${popLabel(popM)} can't have millions of streetlights.`,
    },
    raw,
    1000,
    "city_population × streetlights_per_person",
  );
};

/**
 * Two-sided option quotes a market maker STREAMS per day across its book, answer
 * in MILLIONS of quotes. (A very trading-native "hard-to-value quantity".)
 */
const genOptionQuotesPerDay: HardQuantityGenerator = (rng) => {
  const symbols = rng.pick([500, 800, 1000, 1500]); // underlyings quoted
  const strikesPerExpiry = rng.pick([20, 30, 40]);
  const expiries = rng.pick([6, 8, 10, 12]);
  const requotesPerHour = rng.pick([50, 100, 150]); // refreshes per contract
  const tradingHours = 6.5;
  const contracts = symbols * strikesPerExpiry * expiries * 2; // calls + puts
  const raw = contracts * requotesPerHour * tradingHours;
  return mk(
    {
      id: "option-quotes-per-day",
      category: "Markets",
      kind: "guesstimate",
      prompt: `A market maker quotes ~${commas(symbols)} underlyings. How many two-sided option quotes does it stream in a trading day, in millions?`,
      unit: "million quotes",
      decomposition: [
        `${commas(symbols)} symbols × ${strikesPerExpiry} strikes × ${expiries} expiries × 2 (calls+puts) ≈ ${commas(contracts)} live contracts.`,
        `Each is refreshed ~${requotesPerHour}×/hour over a ~${tradingHours}h session → ${commas(requotesPerHour * tradingHours)} requotes/contract.`,
        `${commas(contracts)} × ${commas(requotesPerHour * tradingHours)} ≈ ${commas(raw)} ≈ ${commas(raw / 1_000_000)} million.`,
      ],
      anchor: `Requote frequency dominates — an idle book quotes far less; a hot, event-driven book far more.`,
    },
    raw,
    1_000_000,
    "symbols × strikes × expiries × 2 × requotes_per_hour × trading_hours",
  );
};

/** Golf balls that fit inside a school bus, answer in THOUSANDS. */
const genGolfBallsInBus: HardQuantityGenerator = (rng) => {
  const busVolumeM3 = rng.pick([35, 40, 45]); // interior ≈ 40 m³
  const usableFraction = rng.pick([0.7, 0.75, 0.8]); // minus seats/wheel wells
  const packing = rng.pick([0.6, 0.64]); // random close packing of spheres
  const ballVolumeM3 = 41e-6; // Ø 4.27 cm → V ≈ 41 cm³
  const raw = (busVolumeM3 * usableFraction * packing) / ballVolumeM3;
  return mk(
    {
      id: "golf-balls-in-bus",
      category: "Estimation",
      kind: "guesstimate",
      prompt: `How many golf balls fit inside a school bus, in thousands?`,
      unit: "thousand balls",
      decomposition: [
        `Bus interior ≈ ${busVolumeM3} m³; usable ≈ ${Math.round(usableFraction * 100)}% after seats → ${(busVolumeM3 * usableFraction).toFixed(1)} m³.`,
        `Spheres pack at ~${packing} density; a golf ball is ≈ 41 cm³ = 4.1×10⁻⁵ m³.`,
        `${(busVolumeM3 * usableFraction).toFixed(1)} × ${packing} ÷ 4.1×10⁻⁵ ≈ ${commas(raw)} ≈ ${commas(raw / 1000)} thousand.`,
      ],
      anchor: `Sphere packing tops out near 0.74 — you can't fill 100% of the volume with round balls.`,
    },
    raw,
    1000,
    "bus_volume × usable_fraction × packing_density ÷ golf_ball_volume",
  );
};

/** Retail fuel (gas) stations in the U.S., answer in THOUSANDS. */
const genGasStationsUS: HardQuantityGenerator = (rng) => {
  const usPopM = rng.pick([330, 335]);
  const peoplePerStation = rng.pick([2000, 2500, 3000]);
  const pop = usPopM * 1_000_000;
  const raw = pop / peoplePerStation;
  return mk(
    {
      id: "gas-stations-us",
      category: "Estimation",
      kind: "guesstimate",
      prompt: `How many retail gas stations are there in the U.S., in thousands?`,
      unit: "thousand stations",
      decomposition: [
        `U.S. population ≈ ${usPopM} million.`,
        `One station serves on the order of ~${commas(peoplePerStation)} people.`,
        `${commas(pop)} ÷ ${commas(peoplePerStation)} ≈ ${commas(raw)} ≈ ${commas(raw / 1000)} thousand.`,
      ],
      anchor: `Cross-check by counting your own town: a few stations per ~10k people lands in the same place.`,
    },
    raw,
    1000,
    "us_population ÷ people_per_station",
  );
};

/** Trades executed on a major stock exchange in a day, answer in MILLIONS. */
const genTradesPerDay: HardQuantityGenerator = (rng) => {
  const activeSymbols = rng.pick([2000, 3000, 4000]);
  const tradesPerSymbol = rng.pick([3000, 5000, 8000]);
  const raw = activeSymbols * tradesPerSymbol;
  return mk(
    {
      id: "trades-per-day",
      category: "Markets",
      kind: "guesstimate",
      prompt: `About how many individual trades print on a major stock exchange in a day, in millions?`,
      unit: "million trades",
      decomposition: [
        `~${commas(activeSymbols)} names see meaningful volume on a given day.`,
        `A liquid name prints on the order of ~${commas(tradesPerSymbol)} trades/day (thin names far fewer).`,
        `${commas(activeSymbols)} × ${commas(tradesPerSymbol)} ≈ ${commas(raw)} ≈ ${commas(raw / 1_000_000)} million.`,
      ],
      anchor: `Modern prints are tiny (odd-lots, HFT slices), so the count is large even though notional per trade is small.`,
    },
    raw,
    1_000_000,
    "active_symbols × trades_per_symbol",
  );
};

/* ========================================================================== */
/*  Deal                                                                        */
/* ========================================================================== */

/** Every hard-to-value quantity generator (each dealt with equal weight). */
export const HARD_QUANTITY_GENERATORS: readonly HardQuantityGenerator[] = [
  genLightbulbsState,
  genStreetlightsCity,
  genOptionQuotesPerDay,
  genGolfBallsInBus,
  genGasStationsUS,
  genTradesPerDay,
];

/** Deal one fresh, randomized hard-to-value quantity. The player never chooses. */
export function dealHardQuantity(rng: Rng): HardQuantityScenario {
  return rng.pick(HARD_QUANTITY_GENERATORS)(rng);
}
