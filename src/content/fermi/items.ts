import type { Difficulty } from "@/types/content";
import type { FermiFactor } from "@/lib/fermi/grader";

/**
 * Content for the dedicated, numerically-VERIFIABLE Fermi estimation drill.
 *
 * Each item is a canonical decomposition: an ordered list of named factors whose
 * product (computed in code by `@/lib/fermi/grader`) IS the reference answer the
 * learner's single estimate is graded against by log-distance. Every item also
 * carries an explicit `reference` — the author-intended magnitude — which the
 * test suite asserts equals the coded product, so the whole content set stays
 * numerically self-consistent (a typo'd factor fails CI).
 *
 * These are freshly authored (not copied from any dataset). They are a step up
 * in rigor from the existing Fermi FLASHCARDS in Interview Games (reveal + self-
 * assess): here the learner commits to a number and is objectively scored.
 */

/** Broad genre a Fermi item belongs to (used to group the drill's item list). */
export type FermiCategory =
  | "Population & Logistics"
  | "Counting by Volume"
  | "Throughput & Flow"
  | "Revenue & Frequency"
  | "Market Sizing"
  | "Markets & Trading"
  | "Scale & Counting";

export interface FermiItem {
  id: string;
  /** The estimation challenge, phrased as a crisp one-liner. */
  prompt: string;
  /** What quantity is being estimated (short noun phrase for the answer chip). */
  quantity: string;
  /** Unit of the answer, e.g. "piano tuners", "golf balls". */
  unit: string;
  /** True when the answer is a dollar amount (renders a $ affordance). */
  money?: boolean;
  category: FermiCategory;
  difficulty: Difficulty;
  /** Ordered canonical decomposition; its coded product is the reference. */
  factors: FermiFactor[];
  /**
   * Author-intended reference magnitude. Asserted (in `items.test.ts`) to match
   * the coded product of `factors` within a tight tolerance, so a factor typo
   * can never silently drift the graded answer.
   */
  reference: number;
  /** One-line "why this decomposition is defensible / the technique" note. */
  takeaway: string;
  /** Genre / provenance label (never copied dataset text). */
  source?: string;
}

export const FERMI_ITEMS: FermiItem[] = [
  {
    id: "fermi-piano-tuners-chicago",
    prompt:
      "Roughly how many working piano tuners does it take to serve the New York City metro area? Estimate the count.",
    quantity: "piano tuners in NYC",
    unit: "piano tuners",
    category: "Population & Logistics",
    difficulty: "medium",
    factors: [
      { label: "People in the New York City metro area", value: 20_000_000, unit: "people" },
      { label: "People per household", value: 2.5, op: "div", unit: "people/household" },
      { label: "Share of households owning a piano", value: 0.05, unit: "pianos/household" },
      { label: "Tunings per piano per year", value: 1, unit: "tunings/piano/yr" },
      { label: "Tunings one tuner does per year (≈4/day × 250 days)", value: 1000, op: "div", unit: "tunings/tuner/yr" },
    ],
    reference: 400,
    takeaway:
      "The canonical Fermi: population → households → pianos → annual tunings, then divide by one tuner's yearly throughput. Any reasonable set of these factors lands in the few-hundreds.",
    source: "Classic Fermi estimation (piano tuners)",
  },
  {
    id: "fermi-golf-balls-school-bus",
    prompt:
      "How many golf balls would fit inside a standard school bus? Estimate the count.",
    quantity: "golf balls in a school bus",
    unit: "golf balls",
    category: "Counting by Volume",
    difficulty: "medium",
    factors: [
      { label: "Usable interior volume of a school bus", value: 40_000_000, unit: "cm³" },
      { label: "Random sphere-packing efficiency", value: 0.65, unit: "usable fraction" },
      { label: "Volume occupied by one golf ball", value: 40, op: "div", unit: "cm³/ball" },
    ],
    reference: 650_000,
    takeaway:
      "Counting-by-volume: estimate the container volume, apply a packing-efficiency haircut (~65% for loose spheres), then divide by the volume of one object.",
    source: "Classic Fermi estimation (counting by volume)",
  },
  {
    id: "fermi-starbucks-daily-revenue",
    prompt:
      "What is the daily revenue of a busy Manhattan Starbucks? Estimate the dollars per day.",
    quantity: "daily revenue of a busy café",
    unit: "$ per day",
    money: true,
    category: "Revenue & Frequency",
    difficulty: "easy",
    factors: [
      { label: "Customers served per hour (busy location)", value: 50, unit: "customers/hr" },
      { label: "Hours open per day", value: 14, unit: "hr" },
      { label: "Average spend per customer", value: 7, unit: "$/customer" },
    ],
    reference: 4900,
    takeaway:
      "Revenue = throughput × time × ticket size. Market-sizing a single storefront is the same skeleton as sizing a whole segment — just at one location.",
    source: "Market-sizing (single-store revenue)",
  },
  {
    id: "fermi-gas-stations-us",
    prompt: "How many gas stations are there in the United States? Estimate the count.",
    quantity: "gas stations in the US",
    unit: "gas stations",
    category: "Throughput & Flow",
    difficulty: "medium",
    factors: [
      { label: "Passenger vehicles in the US", value: 250_000_000, unit: "cars" },
      { label: "Fill-ups per car per week", value: 1, unit: "fills/car/wk" },
      { label: "Fill-ups one station serves per week", value: 2000, op: "div", unit: "fills/station/wk" },
    ],
    reference: 125_000,
    takeaway:
      "Demand ÷ per-unit throughput: total weekly fill-ups divided by what one station can handle. The true figure (~120k) sits right in this band.",
    source: "Demand ÷ throughput (US gas stations)",
  },
  {
    id: "fermi-pizzas-us-per-day",
    prompt:
      "How many pizzas are sold in the United States on a typical day? Estimate the count.",
    quantity: "pizzas sold per day (US)",
    unit: "pizzas",
    category: "Revenue & Frequency",
    difficulty: "medium",
    factors: [
      { label: "US population", value: 330_000_000, unit: "people" },
      { label: "Pizzas one person eats per year", value: 9, unit: "pizzas/person/yr" },
      { label: "Days per year", value: 365, op: "div", unit: "days/yr" },
    ],
    reference: 8_100_000,
    takeaway:
      "Annual per-capita consumption × population, then spread over the year. Converting a yearly rate to a daily flow (÷365) is a workhorse Fermi move.",
    source: "Frequency estimation (consumption rate)",
  },
  {
    id: "fermi-coffee-cups-us-per-day",
    prompt:
      "How many cups of coffee are consumed in the United States each day? Estimate the count.",
    quantity: "cups of coffee per day (US)",
    unit: "cups",
    category: "Revenue & Frequency",
    difficulty: "easy",
    factors: [
      { label: "US population", value: 330_000_000, unit: "people" },
      { label: "Share who drink coffee", value: 0.6, unit: "coffee drinkers" },
      { label: "Cups per coffee-drinker per day", value: 2, unit: "cups/drinker/day" },
    ],
    reference: 396_000_000,
    takeaway:
      "Population → filter to the relevant sub-population (coffee drinkers) → per-person daily rate. Filtering before multiplying keeps the estimate honest.",
    source: "Frequency estimation (per-capita rate)",
  },
  {
    id: "fermi-google-searches-per-day",
    prompt:
      "How many Google searches happen worldwide in a single day? Estimate the count.",
    quantity: "Google searches per day",
    unit: "searches",
    category: "Throughput & Flow",
    difficulty: "medium",
    factors: [
      { label: "People online worldwide", value: 5_000_000_000, unit: "people" },
      { label: "Share who search on a given day", value: 0.6, unit: "active searchers" },
      { label: "Searches per active user per day", value: 3, unit: "searches/user" },
    ],
    reference: 9_000_000_000,
    takeaway:
      "Reach × activation × intensity. This 'users × active-fraction × per-user rate' pattern sizes almost any digital-usage quantity.",
    source: "Digital-usage sizing (global throughput)",
  },
  {
    id: "fermi-mcdonalds-us",
    prompt:
      "How many McDonald's restaurants are there in the United States? Estimate the count.",
    quantity: "McDonald's locations in the US",
    unit: "restaurants",
    category: "Market Sizing",
    difficulty: "medium",
    factors: [
      { label: "US population", value: 330_000_000, unit: "people" },
      { label: "Share eating at McDonald's on a given day", value: 0.05, unit: "customers/day" },
      { label: "Customers one restaurant serves per day", value: 1200, op: "div", unit: "customers/store/day" },
    ],
    reference: 13_750,
    takeaway:
      "Daily customers nationwide ÷ per-store daily capacity yields the store count. Lands right on the real figure (~13,500) from demand-side reasoning alone.",
    source: "Market-sizing (store count from demand)",
  },
  {
    id: "fermi-planes-airborne-us",
    prompt:
      "At any given moment, how many commercial airliners are in the air over the United States? Estimate the count.",
    quantity: "airliners airborne over the US",
    unit: "aircraft",
    category: "Throughput & Flow",
    difficulty: "hard",
    factors: [
      { label: "Commercial flights per day in US airspace", value: 45_000, unit: "flights/day" },
      { label: "Average time a flight spends airborne", value: 2, unit: "hr/flight" },
      { label: "Hours in a day", value: 24, op: "div", unit: "hr/day" },
    ],
    reference: 3_750,
    takeaway:
      "Little's Law in disguise: things-in-system = arrival rate × time-in-system. Daily flights × hours-aloft ÷ 24 gives the instantaneous count aloft.",
    source: "Little's Law / flow (aircraft aloft)",
  },
  {
    id: "fermi-rideshare-trips-us-per-day",
    prompt:
      "How many rideshare trips (Uber/Lyft) are taken in the United States on a typical day? Estimate the count.",
    quantity: "US rideshare trips per day",
    unit: "trips",
    category: "Throughput & Flow",
    difficulty: "easy",
    factors: [
      { label: "US population", value: 330_000_000, unit: "people" },
      { label: "Share taking a rideshare on a given day", value: 0.02, unit: "riders/day" },
    ],
    reference: 6_600_000,
    takeaway:
      "Even a two-factor decomposition (population × daily-adoption rate) pins the order of magnitude — the number of factors matters less than each one being defensible.",
    source: "Adoption-rate sizing (daily trips)",
  },
  {
    id: "fermi-us-equity-daily-dollar-volume",
    prompt:
      "What is the total dollar value traded across US equity markets on a typical day? Estimate the dollars per day.",
    quantity: "US equity daily $ volume",
    unit: "$ traded per day",
    money: true,
    category: "Markets & Trading",
    difficulty: "hard",
    factors: [
      { label: "Shares traded per day across US equity markets", value: 12_000_000_000, unit: "shares/day" },
      { label: "Average traded share price", value: 40, unit: "$/share" },
    ],
    reference: 480_000_000_000,
    takeaway:
      "Dollar volume = share volume × average price. Sizing market activity from volume × price is the daily instinct behind liquidity and impact estimates.",
    source: "Markets sizing (traded notional)",
  },
  {
    id: "fermi-us-stock-market-cap",
    prompt:
      "What is the total market capitalization of all publicly listed US companies? Estimate the dollars.",
    quantity: "total US stock-market cap",
    unit: "$ market cap",
    money: true,
    category: "Markets & Trading",
    difficulty: "hard",
    factors: [
      { label: "Publicly listed US companies", value: 4_000, unit: "companies" },
      { label: "Average market capitalization", value: 12_000_000_000, unit: "$/company" },
    ],
    reference: 48_000_000_000_000,
    takeaway:
      "Count × average size gives the aggregate. The 'average' is mega-cap-skewed, so anchoring it (~$10–15B) is the crux — the total (~$50T) follows.",
    source: "Markets sizing (aggregate market cap)",
  },
  {
    id: "fermi-heartbeats-lifetime",
    prompt:
      "How many times does a human heart beat over an average lifetime? Estimate the count.",
    quantity: "heartbeats in a lifetime",
    unit: "beats",
    category: "Scale & Counting",
    difficulty: "easy",
    factors: [
      { label: "Heartbeats per minute", value: 70, unit: "beats/min" },
      { label: "Minutes per day", value: 1440, unit: "min/day" },
      { label: "Days per year", value: 365, unit: "days/yr" },
      { label: "Human lifespan", value: 75, unit: "yr" },
    ],
    reference: 2_760_000_000,
    takeaway:
      "Chaining unit conversions (per-minute → per-day → per-year → per-lifetime) is pure Fermi bookkeeping. Keep the units glued together and the powers of ten take care of themselves.",
    source: "Unit-chaining estimation (biological scale)",
  },
];

/** Categories present in `FERMI_ITEMS`, in a stable curated display order. */
export const FERMI_CATEGORY_ORDER: FermiCategory[] = [
  "Population & Logistics",
  "Counting by Volume",
  "Throughput & Flow",
  "Revenue & Frequency",
  "Market Sizing",
  "Markets & Trading",
  "Scale & Counting",
];
