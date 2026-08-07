/**
 * ============================================================================
 *  MAKE ME A MARKET. SCENARIO GENERATORS
 * ============================================================================
 * Anti-memorization scenario engine for Game 1 (`QuantGames-Mechanics.md`).
 *
 * Instead of a fixed list of scenarios with fixed answers (memorizable after a
 * few plays), scenarios are DEALT from generators:
 *
 *   • GUESSTIMATES are fully PARAMETRIC. Each play randomizes the underlying
 *     inputs (city population, ownership rates, flights/day, …) and RECOMPUTES
 *     the true value, the prompt, the decomposition, and the anchor from those
 *     same inputs. Memorizing "300k bottles" is useless when next round the city
 *     is 3.5M people. The decomposition always reconciles to the drawn answer,
 *     so the teaching stays exactly correct.
 *
 *   • FACTS keep their real, true values (you can't jitter Everest's height) but
 *     are drawn at random from a larger pool, so you don't know which you'll get.
 *
 * `dealScenario(rng)` picks a generator and produces a concrete Scenario. The
 * player never chooses, they're dealt a question and must price it cold, like a
 * real interview. Pure data + math, no React.
 */
import { Rng } from "@/lib/rng";

export type ScenarioKind = "fact" | "guesstimate";

export interface Scenario {
  id: string;
  category: string;
  kind: ScenarioKind;
  /** The prompt shown to the player. */
  prompt: string;
  /** The unit of the answer (e.g. "kg", "km", "years"). */
  unit: string;
  /** The true value everything settles against. */
  trueValue: number;
  /** A sensible strict max-spread for the tight rounds (absolute, answer units). */
  suggestedMaxSpread: number;
  /** Canonical decomposition steps revealed after the round (teaching payoff). */
  decomposition: string[];
  /** One-line "why this matters" / anchoring note. */
  anchor: string;
}

/** A generator turns a seeded Rng into one concrete scenario instance. */
export type ScenarioGenerator = (rng: Rng) => Scenario;

/* ========================================================================== */
/*  Formatting + math helpers                                                  */
/* ========================================================================== */

/** Human population label: 0.5 → "500k", 1 → "1 million", 3.5 → "3.5 million". */
function popLabel(popM: number): string {
  if (popM < 1) return `${Math.round(popM * 1000)}k`;
  return `${Number.isInteger(popM) ? popM : popM.toFixed(1)} million`;
}

function commas(n: number): string {
  return Math.round(n).toLocaleString();
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
 * A strict max-spread scaled to ~1/3 of the answer's magnitude, rounded nice.
 * This is deliberately generous: the counterparty mixes informed pick-offs with
 * uninformed flow that pays your spread, so a fair, winnable game needs enough
 * room to quote a tight-but-real two-sided market (the earning sweet spot sits
 * near HALF the cap). The cap must be wide enough that a competent-but-imperfect
 * estimate (say ±10% of the true value) can be BRACKETED by a sensible spread:
 * a half-cap spread then has a half-spread ≈ 1/6 of the value, which comfortably
 * covers a ~10% valuation error so the player earns the noise flow instead of
 * being adversely selected every round. Too small a cap (the old ~25%) demanded
 * near-perfect valuation (F1); ~33% keeps it challenging but winnable for a
 * skilled-but-human estimator.
 */
function niceSpread(trueValue: number): number {
  return niceNumber(trueValue * 0.33);
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/* ========================================================================== */
/*  Guesstimate generators (fully parametric)                                  */
/* ========================================================================== */

/** Single-use water bottles sold per day in a city, answer in thousands. */
const genWaterBottles: ScenarioGenerator = (rng) => {
  const popM = rng.pick([0.5, 0.8, 1, 1.5, 2, 3]);
  const buyPct = rng.pick([25, 30, 33, 40]);
  const pop = popM * 1_000_000;
  const buyers = pop * (buyPct / 100);
  const trueThousands = Math.round(buyers / 1000);
  return {
    id: "water-bottles",
    category: "Everyday Life",
    kind: "guesstimate",
    prompt: `How many single-use water bottles are sold per day in a city of ${popLabel(popM)} people, in thousands?`,
    unit: "thousand bottles",
    trueValue: trueThousands,
    suggestedMaxSpread: niceSpread(trueThousands),
    decomposition: [
      `Assume about ${buyPct}% of the ${popLabel(popM)} residents buy a bottle on a given day → ~${commas(buyers)} people.`,
      `Most buy exactly one, so ~${commas(buyers)} bottles ≈ ${commas(trueThousands)} thousand.`,
      `Cautionary check: if your answer implies MORE than one bottle per resident, you've over-priced, that's the classic "730k in a 1M city" trap.`,
    ],
    anchor: `Hard ceiling: even 1 bottle per resident is only ${commas(pop / 1000)}k. A defensible answer is a FRACTION of the population, never a multiple.`,
  };
};

/** Piano tuners working in a city (the classic Fermi problem, parametric). */
const genPianoTuners: ScenarioGenerator = (rng) => {
  const popM = rng.pick([2, 3, 4, 5, 6, 8]);
  const perHousehold = rng.pick([2, 2.5, 3]);
  const pianoPct = rng.pick([4, 5, 6]);
  const perTuner = rng.pick([800, 1000, 1200]);
  const pop = popM * 1_000_000;
  const households = pop / perHousehold;
  const pianos = households * (pianoPct / 100);
  const tuners = roundTo(pianos / perTuner, 10); // once-a-year tunings
  return {
    id: "piano-tuners",
    category: "Everyday Life",
    kind: "guesstimate",
    prompt: `How many piano tuners work in a city of ${popLabel(popM)} people?`,
    unit: "tuners",
    trueValue: Math.max(10, tuners),
    suggestedMaxSpread: niceSpread(Math.max(10, tuners)),
    decomposition: [
      `${popLabel(popM)} people at ~${perHousehold} per household ≈ ${commas(households)} households.`,
      `~${pianoPct}% own a piano → ~${commas(pianos)} pianos, each tuned about once a year.`,
      `A tuner does ~${commas(perTuner)} tunings/year → ${commas(pianos)} ÷ ${commas(perTuner)} ≈ ${commas(tuners)} tuners.`,
    ],
    anchor: `The famous Enrico Fermi estimation, the STRUCTURE (households → pianos → tunings → tuners) beats the exact number every time.`,
  };
};

/** Passengers through a major airport per year, answer in millions. */
const genAirportPax: ScenarioGenerator = (rng) => {
  const flightsPerDay = rng.pick([1500, 1800, 2200, 2500, 2800]);
  const paxPerFlight = rng.pick([100, 120, 140, 160]);
  const paxYear = flightsPerDay * paxPerFlight * 365;
  const millions = Math.round(paxYear / 1_000_000);
  return {
    id: "airport-pax",
    category: "Business & Economy",
    kind: "guesstimate",
    prompt: `A major hub airport runs about ${commas(flightsPerDay)} flights a day. How many passengers pass through it per year, in millions?`,
    unit: "million pax",
    trueValue: millions,
    suggestedMaxSpread: niceSpread(millions),
    decomposition: [
      `~${commas(flightsPerDay)} flights/day × ~${paxPerFlight} passengers each ≈ ${commas(flightsPerDay * paxPerFlight)} pax/day.`,
      `× 365 days ≈ ${commas(paxYear)} per year.`,
      `That's ≈ ${commas(millions)} million.`,
    ],
    anchor: `World population is ~8 billion; a single airport handling more than ~1 billion/yr would be absurd, cap your upper bound.`,
  };
};

/** Streetlights in a city, answer in thousands. */
const genStreetlights: ScenarioGenerator = (rng) => {
  const popM = rng.pick([0.5, 1, 2, 3, 5]);
  const perPerson = rng.pick([0.04, 0.06, 0.08]);
  const pop = popM * 1_000_000;
  const lights = pop * perPerson;
  const thousands = Math.round(lights / 1000);
  return {
    id: "streetlights",
    category: "Everyday Life",
    kind: "guesstimate",
    prompt: `How many streetlights are there in a city of ${popLabel(popM)} people, in thousands?`,
    unit: "thousand lights",
    trueValue: thousands,
    suggestedMaxSpread: niceSpread(thousands),
    decomposition: [
      `A city runs on the order of ~${perPerson} streetlights per resident (main roads plus side streets).`,
      `${popLabel(popM)} × ${perPerson} ≈ ${commas(lights)} lights.`,
      `That's ≈ ${commas(thousands)} thousand.`,
    ],
    anchor: `Sanity check against roads: streetlights scale with road length, which scales with people, a per-capita rate keeps you honest.`,
  };
};

/** Cars passing a point on a busy highway per hour. */
const genHighwayCars: ScenarioGenerator = (rng) => {
  const lanesEachWay = rng.pick([2, 3, 4]);
  const carsPerLaneHour = rng.pick([1200, 1500, 1800]);
  const total = 2 * lanesEachWay * carsPerLaneHour;
  return {
    id: "highway-cars",
    category: "Everyday Life",
    kind: "guesstimate",
    prompt: `A highway has ${lanesEachWay} lanes each way. At free-flow, how many cars pass a fixed point per hour (both directions)?`,
    unit: "cars/hour",
    trueValue: total,
    suggestedMaxSpread: niceSpread(total),
    decomposition: [
      `Each lane carries on the order of ~${commas(carsPerLaneHour)} cars/hour at free-flow.`,
      `${lanesEachWay} lanes × 2 directions = ${2 * lanesEachWay} lanes.`,
      `${2 * lanesEachWay} × ${commas(carsPerLaneHour)} ≈ ${commas(total)} cars/hour.`,
    ],
    anchor: `A single lane tops out near ~2,000 cars/hour before it jams, that's your per-lane ceiling.`,
  };
};

const GUESSTIMATE_GENERATORS: ScenarioGenerator[] = [
  genWaterBottles,
  genPianoTuners,
  genAirportPax,
  genStreetlights,
  genHighwayCars,
];

/* ========================================================================== */
/*  Fact pool (real values, a larger pool so you can't predict the draw)      */
/* ========================================================================== */

/** Static fact scenarios; drawn at random. Real values, hand-tuned spreads. */
const FACT_POOL: Scenario[] = [
  {
    id: "sumo-heaviest",
    category: "Sports & Games",
    kind: "fact",
    prompt: "What was the weight of the heaviest sumo wrestler ever recorded, in kilograms?",
    unit: "kg",
    trueValue: 293,
    suggestedMaxSpread: 5,
    decomposition: [
      "A typical top-division sumo wrestler is ~150–180 kg.",
      "The record-holder is famously an outlier, roughly double a normal heavyweight.",
      "That lands near ~290 kg.",
    ],
    anchor: "Hard ceiling: no human has ever been credibly recorded above ~450 kg.",
  },
  {
    id: "marathon-wr",
    category: "Sports & Games",
    kind: "fact",
    prompt: "What is the men's marathon world record time, in minutes?",
    unit: "min",
    trueValue: 120,
    suggestedMaxSpread: 2,
    decomposition: [
      "The barrier everyone talks about is 2 hours = 120 minutes.",
      "The official record sits just above it, around 2:00–2:01.",
      "So ~120 minutes.",
    ],
    anchor: "A hard floor: nobody has broken 2 hours in a record-eligible race.",
  },
  {
    id: "nile-length",
    category: "Geography & Places",
    kind: "fact",
    prompt: "How long is the River Nile, in kilometres?",
    unit: "km",
    trueValue: 6650,
    suggestedMaxSpread: 100,
    decomposition: [
      "The Nile and the Amazon are the two contenders for longest river.",
      "Both are in the 6,000–7,000 km range.",
      "The Nile is usually quoted around 6,650 km.",
    ],
    anchor: "Earth's circumference is ~40,000 km, no river exceeds a fraction of that.",
  },
  {
    id: "everest-height",
    category: "Geography & Places",
    kind: "fact",
    prompt: "How tall is Mount Everest above sea level, in metres?",
    unit: "m",
    trueValue: 8849,
    suggestedMaxSpread: 50,
    decomposition: [
      "Everest is famously just under 8,850 m.",
      "It's the tallest of the '8,000 m peaks'.",
      "So ~8,849 m.",
    ],
    anchor: "Commercial jets cruise at ~11,000 m. Everest is below cruising altitude.",
  },
  {
    id: "moon-distance",
    category: "Space & Astronomy",
    kind: "fact",
    prompt: "What is the average distance from Earth to the Moon, in thousands of km?",
    unit: "thousand km",
    trueValue: 384,
    suggestedMaxSpread: 20,
    decomposition: [
      "Light takes ~1.3 seconds to reach the Moon.",
      "1.3 s × 300,000 km/s ≈ 384,000 km.",
      "So ~384 thousand km.",
    ],
    anchor: "Earth's diameter is ~12,700 km, the Moon is ~30 Earth-diameters away.",
  },
  {
    id: "blue-whale-weight",
    category: "Animals & Nature",
    kind: "fact",
    prompt: "How heavy is an adult blue whale, in metric tonnes?",
    unit: "tonnes",
    trueValue: 150,
    suggestedMaxSpread: 12,
    decomposition: [
      "The blue whale is the largest animal ever, bigger than any dinosaur.",
      "It runs ~25–30 m long and weighs on the order of ~150 tonnes.",
      "That's roughly 25 elephants.",
    ],
    anchor: "An elephant is ~6 tonnes; a blue whale is a couple dozen of them, not a couple hundred.",
  },
  {
    id: "eiffel-height",
    category: "Geography & Places",
    kind: "fact",
    prompt: "How tall is the Eiffel Tower to its tip, in metres?",
    unit: "m",
    trueValue: 330,
    suggestedMaxSpread: 8,
    decomposition: [
      "It's often quoted as ~300 m to the roof.",
      "With antennas it reaches ~330 m.",
      "So ~330 m.",
    ],
    anchor: "A typical storey is ~3 m, 330 m is about a 100-storey building.",
  },
  {
    id: "speed-of-sound",
    category: "Space & Astronomy",
    kind: "fact",
    prompt: "What is the speed of sound in air at sea level, in metres per second?",
    unit: "m/s",
    trueValue: 343,
    suggestedMaxSpread: 8,
    decomposition: [
      "Sound travels ~1 km in about 3 seconds (the thunder rule).",
      "1000 m ÷ 3 s ≈ 330–340 m/s.",
      "The standard figure is ~343 m/s.",
    ],
    anchor: "Light is ~million× faster, that's why you see lightning before you hear it.",
  },
  {
    id: "human-bones",
    category: "Animals & Nature",
    kind: "fact",
    prompt: "How many bones are in the adult human body?",
    unit: "bones",
    trueValue: 206,
    suggestedMaxSpread: 6,
    decomposition: [
      "Babies are born with ~300; many fuse with age.",
      "Adults settle at ~206.",
      "So ~206 bones.",
    ],
    anchor: "Over half are in the hands and feet, a useful cross-check.",
  },
  {
    id: "great-wall-length",
    category: "Geography & Places",
    kind: "fact",
    prompt: "How long is the Great Wall of China (all branches), in thousands of km?",
    unit: "thousand km",
    trueValue: 21,
    suggestedMaxSpread: 2,
    decomposition: [
      "Counting every branch and period, surveys put it at ~21,000 km.",
      "That's about half Earth's circumference.",
      "So ~21 thousand km.",
    ],
    anchor: "Earth's circumference is ~40,000 km, the Wall is a sizeable fraction, which is why the figure surprises people.",
  },
];

const genFact: ScenarioGenerator = (rng) => rng.pick(FACT_POOL);

/* ========================================================================== */
/*  Dealing                                                                    */
/* ========================================================================== */

/**
 * The full generator pool. Each guesstimate generator counts once, and facts
 * enter via a single `genFact` that samples the fact pool, a roughly even
 * split between (parametric) guesstimates and (real-valued) facts per deal.
 */
export const GENERATORS: ScenarioGenerator[] = [
  ...GUESSTIMATE_GENERATORS,
  genFact,
  genFact, // weight facts so the guesstimate/fact split stays ~balanced
];

/** Deal a fresh, randomized scenario. The player never chooses. */
export function dealScenario(rng: Rng): Scenario {
  return rng.pick(GENERATORS)(rng);
}
