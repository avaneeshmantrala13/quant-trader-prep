import { Rng } from "@/lib/rng";
import { computeFermiReference, type FermiFactor } from "@/lib/fermi/grader";
import type { FermiCategory, FermiItem } from "@/content/fermi/items";

/**
 * PARAMETRIC Fermi generators — the drill's fresh-estimate engine.
 *
 * The static `FERMI_ITEMS` bank is a fixed, memorizable list. These generators
 * instead SAMPLE plausible factor magnitudes from a seeded `Rng` and build a
 * canonical decomposition on the fly, so every mount draws FRESH estimation
 * problems (numbers change, the reasoning skeleton stays). Crucially the
 * reference answer is ALWAYS the coded product of the sampled factors
 * (`computeFermiReference`), so a generated item is numerically self-consistent
 * by construction — exactly the invariant `items.test.ts` asserts for the static
 * bank — and every scored answer stays engine-graded (log-distance to that
 * coded reference), never author-typed.
 *
 * `buildFermiDrill(seed, count)` mirrors the arbitrage drill's determinism
 * contract: one `Rng(seed)`, shuffle the generator pool, then draw `count`
 * items by cycling the shuffled pool with that SAME rng, forcing unique ids.
 */

/** Round a value to `sig` significant figures (keeps sampled factors tidy). */
function toSig(n: number, sig = 2): number {
  if (n === 0 || !Number.isFinite(n)) return n;
  const digits = Math.ceil(Math.log10(Math.abs(n)));
  const power = sig - digits;
  const factor = 10 ** power;
  return Math.round(n * factor) / factor;
}

/** A generated item is shaped exactly like a static {@link FermiItem}. */
export type GeneratedFermiItem = FermiItem;

/** Assemble an item from sampled factors, computing the reference from them. */
function assembleFermi(args: {
  idBase: string;
  rng: Rng;
  prompt: string;
  quantity: string;
  unit: string;
  money?: boolean;
  category: FermiCategory;
  factors: FermiFactor[];
  takeaway: string;
  source: string;
}): GeneratedFermiItem {
  const reference = computeFermiReference(args.factors);
  return {
    id: `${args.idBase}-${Math.floor(args.rng.next() * 1e9)}`,
    prompt: args.prompt,
    quantity: args.quantity,
    unit: args.unit,
    money: args.money,
    category: args.category,
    difficulty: "medium",
    factors: args.factors,
    reference,
    takeaway: args.takeaway,
    source: args.source,
  };
}

/* -------------------------------------------------------------------------- */
/*  Generators                                                                  */
/* -------------------------------------------------------------------------- */

/** Providers-per-capita: population ÷ people-served-per-provider. */
function genProvidersPerCapita(rng: Rng): GeneratedFermiItem {
  const scene = rng.pick([
    { who: "practicing dentists", unit: "dentists", per: [1500, 2500] },
    { who: "barbershops & salons", unit: "shops", per: [700, 1200] },
    { who: "primary-care physicians", unit: "doctors", per: [1000, 1800] },
    { who: "pharmacies", unit: "pharmacies", per: [3000, 5000] },
  ] as const);
  const population = rng.pick([2_000_000, 8_000_000, 40_000_000, 330_000_000]);
  const peoplePer = rng.int(scene.per[0], scene.per[1]);
  const factors: FermiFactor[] = [
    { label: "Population served", value: population, unit: "people" },
    { label: `People per ${scene.who.replace(/s$/, "")}`, value: peoplePer, op: "div", unit: "people/provider" },
  ];
  return assembleFermi({
    idBase: "fermi-gen-providers",
    rng,
    prompt: `Roughly how many ${scene.who} serve a population of about ${population.toLocaleString("en-US")}? Estimate the count.`,
    quantity: scene.who,
    unit: scene.unit,
    category: "Population & Logistics",
    factors,
    takeaway:
      "A one-step per-capita ratio: total population ÷ people-served-per-provider. Provider counts collapse to a single 'how many does one serve' anchor.",
    source: "Per-capita ratio (professionals)",
  });
}

/** Container packing: volume × packing-efficiency ÷ object volume. */
function genContainerPacking(rng: Rng): GeneratedFermiItem {
  const scene = rng.pick([
    { obj: "golf balls", container: "a school bus", vol: [30_000_000, 50_000_000], objVol: [35, 45] },
    { obj: "ping-pong balls", container: "a Boeing 747", vol: [800_000_000, 1_200_000_000], objVol: [30, 45] },
    { obj: "marbles", container: "a bathtub", vol: [250_000, 400_000], objVol: [3, 6] },
    { obj: "tennis balls", container: "a small car", vol: [3_000_000, 5_000_000], objVol: [150, 200] },
  ] as const);
  const containerVol = toSig(rng.int(scene.vol[0], scene.vol[1]), 2);
  const packing = rng.pick([0.6, 0.64, 0.65]);
  const objVol = rng.int(scene.objVol[0], scene.objVol[1]);
  const factors: FermiFactor[] = [
    { label: `Usable interior volume of ${scene.container}`, value: containerVol, unit: "cm³" },
    { label: "Random sphere-packing efficiency", value: packing, unit: "usable fraction" },
    { label: `Volume of one ${scene.obj.replace(/s$/, "")}`, value: objVol, op: "div", unit: "cm³/object" },
  ];
  return assembleFermi({
    idBase: "fermi-gen-packing",
    rng,
    prompt: `How many ${scene.obj} would fit inside ${scene.container}? Estimate the count.`,
    quantity: `${scene.obj} in ${scene.container}`,
    unit: scene.obj,
    category: "Counting by Volume",
    factors,
    takeaway:
      "Counting-by-volume: container volume × a packing-efficiency haircut (~65% for loose spheres) ÷ the volume of one object.",
    source: "Counting by volume (packing efficiency)",
  });
}

/** Single-store revenue: customers/hr × hours × ticket size. */
function genStoreRevenue(rng: Rng): GeneratedFermiItem {
  const scene = rng.pick([
    { place: "a busy coffee shop", rate: [40, 60], hours: [12, 16], ticket: [5, 9] },
    { place: "a fast-food counter", rate: [60, 100], hours: [10, 14], ticket: [8, 14] },
    { place: "a downtown food truck", rate: [20, 40], hours: [6, 9], ticket: [10, 16] },
  ] as const);
  const rate = rng.int(scene.rate[0], scene.rate[1]);
  const hours = rng.int(scene.hours[0], scene.hours[1]);
  const ticket = rng.int(scene.ticket[0], scene.ticket[1]);
  const factors: FermiFactor[] = [
    { label: "Customers served per hour", value: rate, unit: "customers/hr" },
    { label: "Hours open per day", value: hours, unit: "hr" },
    { label: "Average spend per customer", value: ticket, unit: "$/customer" },
  ];
  return assembleFermi({
    idBase: "fermi-gen-revenue",
    rng,
    prompt: `What is the daily revenue of ${scene.place} that serves about ${rate} customers an hour? Estimate the dollars per day.`,
    quantity: "daily revenue of one storefront",
    unit: "$ per day",
    money: true,
    category: "Revenue & Frequency",
    factors,
    takeaway:
      "Revenue = throughput × time × ticket size. Sizing one storefront is the same skeleton as sizing a whole segment.",
    source: "Market-sizing (single-store revenue)",
  });
}

/** Traded notional: shares/day × price. */
function genTradedNotional(rng: Rng): GeneratedFermiItem {
  const scene = rng.pick([
    { name: "a mega-cap tech stock", shares: [30_000_000, 60_000_000], price: [120, 300] },
    { name: "a liquid ADR", shares: [3_000_000, 8_000_000], price: [40, 90] },
    { name: "a mid-cap name", shares: [1_000_000, 4_000_000], price: [20, 60] },
  ] as const);
  const shares = toSig(rng.int(scene.shares[0], scene.shares[1]), 2);
  const price = rng.int(scene.price[0], scene.price[1]);
  const factors: FermiFactor[] = [
    { label: "Shares traded per day", value: shares, unit: "shares/day" },
    { label: "Average traded price", value: price, unit: "$/share" },
  ];
  return assembleFermi({
    idBase: "fermi-gen-notional",
    rng,
    prompt: `What is the daily dollar notional traded in ${scene.name} (about ${shares.toLocaleString("en-US")} shares/day)? Estimate the dollars per day.`,
    quantity: "daily notional of one name",
    unit: "$ traded per day",
    money: true,
    category: "Markets & Trading",
    factors,
    takeaway:
      "Notional = share volume × price. Anchoring both factors lands the daily turnover of a single name.",
    source: "Markets sizing (single-name notional)",
  });
}

/** Digital usage: users × active-share × per-user rate. */
function genDigitalUsage(rng: Rng): GeneratedFermiItem {
  const scene = rng.pick([
    { what: "searches", verb: "search", users: [3_000_000_000, 5_000_000_000], active: [0.4, 0.7], rate: [2, 5] },
    { what: "app opens", verb: "open the app", users: [500_000_000, 2_000_000_000], active: [0.3, 0.6], rate: [3, 8] },
    { what: "messages", verb: "message", users: [1_000_000_000, 3_000_000_000], active: [0.5, 0.8], rate: [10, 30] },
  ] as const);
  const users = toSig(rng.int(scene.users[0], scene.users[1]), 2);
  const active = rng.pick([0.3, 0.4, 0.5, 0.6, 0.7]);
  const rate = rng.int(scene.rate[0], scene.rate[1]);
  const factors: FermiFactor[] = [
    { label: "People online worldwide", value: users, unit: "people" },
    { label: "Share who are active on a given day", value: active, unit: "active fraction" },
    { label: `${scene.what} per active user per day`, value: rate, unit: `${scene.what}/user` },
  ];
  return assembleFermi({
    idBase: "fermi-gen-digital",
    rng,
    prompt: `How many ${scene.what} happen worldwide in a single day, if about ${users.toLocaleString("en-US")} people are online? Estimate the count.`,
    quantity: `${scene.what} per day`,
    unit: scene.what,
    category: "Throughput & Flow",
    factors,
    takeaway:
      "Reach × activation × intensity. This 'users × active-fraction × per-user rate' pattern sizes almost any digital-usage quantity.",
    source: "Digital-usage sizing (global throughput)",
  });
}

/** Demand ÷ throughput: total demand vs one unit's capacity. */
function genDemandThroughput(rng: Rng): GeneratedFermiItem {
  const scene = rng.pick([
    { unitName: "gas stations", pop: [200_000_000, 260_000_000], perCap: [40, 60], cap: [1500, 2500], demand: "fill-ups" },
    { unitName: "grocery stores", pop: [40_000_000, 330_000_000], perCap: [80, 120], cap: [30000, 60000], demand: "shopping trips" },
  ] as const);
  const pop = toSig(rng.int(scene.pop[0], scene.pop[1]), 2);
  const perCap = rng.int(scene.perCap[0], scene.perCap[1]);
  const cap = toSig(rng.int(scene.cap[0], scene.cap[1]), 2);
  const factors: FermiFactor[] = [
    { label: "Population", value: pop, unit: "people" },
    { label: `${scene.demand} per person per year`, value: perCap, unit: `${scene.demand}/person/yr` },
    { label: `${scene.demand} one unit serves per year`, value: cap, op: "div", unit: `${scene.demand}/unit/yr` },
  ];
  return assembleFermi({
    idBase: "fermi-gen-demand",
    rng,
    prompt: `How many ${scene.unitName} serve a population of about ${pop.toLocaleString("en-US")}? Estimate the count.`,
    quantity: scene.unitName,
    unit: scene.unitName,
    category: "Throughput & Flow",
    factors,
    takeaway:
      "Annual demand ÷ per-unit annual throughput. Population × frequency gives national demand; dividing by one unit's yearly capacity yields the count.",
    source: "Demand ÷ throughput",
  });
}

/** The full parametric generator pool, keyed by family (mirrors arbitrage). */
export const FERMI_GENERATORS: Record<string, (rng: Rng) => GeneratedFermiItem> = {
  genProvidersPerCapita,
  genContainerPacking,
  genStoreRevenue,
  genTradedNotional,
  genDigitalUsage,
  genDemandThroughput,
};

const FERMI_GEN_POOL = Object.values(FERMI_GENERATORS);

/**
 * Draw exactly `count` FRESH Fermi items reproducibly from `seed`. Same
 * `(seed, count)` ⇒ identical items (prompts, factors, references).
 */
export function buildFermiDrill(seed: number, count: number): GeneratedFermiItem[] {
  const rng = new Rng(seed);
  const pool = rng.shuffle(FERMI_GEN_POOL);
  const out: GeneratedFermiItem[] = [];
  if (pool.length === 0) return out;
  for (let i = 0; i < count; i += 1) {
    const gen = pool[i % pool.length];
    const item = gen(rng);
    out.push({ ...item, id: `fermi-drill-${seed}-${i}` });
  }
  return out;
}
