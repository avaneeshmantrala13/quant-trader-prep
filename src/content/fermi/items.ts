import type { Difficulty } from "@/types/content";
import type { FermiFactor } from "@/lib/fermi/grader";

/**
 * Content for the dedicated, numerically-VERIFIABLE Fermi estimation drill.
 *
 * Each item is a canonical decomposition: an ordered list of named factors whose
 * product (computed in code by `@/lib/fermi/grader`) IS the reference answer the
 * learner's single estimate is graded against by log-distance. Every item also
 * carries an explicit `reference`, the author-intended magnitude, which the
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
  | "Market Microstructure"
  | "Exchange & Liquidity"
  | "Derivatives & Risk"
  | "Scale & Counting";

/**
 * The markets/trading-flavored categories. The drill is weighted toward these
 * (an estimation muscle quant desks lean on daily); `items.test.ts` asserts at
 * least three of them are represented in the live bank.
 */
export const FERMI_MARKETS_CATEGORIES: readonly FermiCategory[] = [
  "Market Sizing",
  "Markets & Trading",
  "Market Microstructure",
  "Exchange & Liquidity",
  "Derivatives & Risk",
];

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
      "Revenue = throughput × time × ticket size. Market-sizing a single storefront is the same skeleton as sizing a whole segment, just at one location.",
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
      "Even a two-factor decomposition (population × daily-adoption rate) pins the order of magnitude, the number of factors matters less than each one being defensible.",
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
      "Count × average size gives the aggregate. The 'average' is mega-cap-skewed, so anchoring it (~$10–15B) is the crux, the total (~$50T) follows.",
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

  /* ---------------------------------------------------------------------- */
  /*  Markets & Trading, aggregate market activity                          */
  /* ---------------------------------------------------------------------- */
  {
    id: "fermi-spx-emini-contracts-per-day",
    prompt:
      "How many E-mini S&P 500 futures contracts change hands on a typical trading day? Estimate the count.",
    quantity: "E-mini S&P futures contracts/day",
    unit: "contracts",
    category: "Markets & Trading",
    difficulty: "hard",
    factors: [
      { label: "Index-futures notional traded per day", value: 375_000_000_000, unit: "$/day" },
      { label: "Notional value of one E-mini contract (≈$50 × 5,000)", value: 250_000, op: "div", unit: "$/contract" },
    ],
    reference: 1_500_000,
    takeaway:
      "Contracts = dollar flow ÷ dollars per contract. Anchoring the per-contract notional ($50 multiplier × index level) turns a scary derivatives number into simple division.",
    source: "Markets sizing (futures contract count)",
  },
  {
    id: "fermi-treasury-daily-volume",
    prompt:
      "What is the daily trading volume (dollar value) of US Treasury securities? Estimate the dollars per day.",
    quantity: "US Treasury daily $ volume",
    unit: "$ traded per day",
    money: true,
    category: "Markets & Trading",
    difficulty: "hard",
    factors: [
      { label: "Marketable US Treasury debt outstanding", value: 27_000_000_000_000, unit: "$" },
      { label: "Fraction of the stock that turns over each day", value: 0.03, unit: "turnover/day" },
    ],
    reference: 810_000_000_000,
    takeaway:
      "Flow from stock: a big outstanding balance × a small daily turnover fraction. The Treasury market is the deepest on earth, so even ~3% daily turnover is ~$0.8T.",
    source: "Markets sizing (turnover of a stock)",
  },
  {
    id: "fermi-fx-daily-turnover",
    prompt:
      "What is the total daily turnover of the global foreign-exchange market? Estimate the dollars per day.",
    quantity: "global FX daily turnover",
    unit: "$ traded per day",
    money: true,
    category: "Markets & Trading",
    difficulty: "hard",
    factors: [
      { label: "Top-tier FX dealer banks", value: 20, unit: "dealers" },
      { label: "Average FX volume handled per top dealer per day", value: 375_000_000_000, unit: "$/dealer/day" },
    ],
    reference: 7_500_000_000_000,
    takeaway:
      "A concentrated market sizes cleanly as (number of big players) × (throughput each). A handful of dealer banks intermediate most of the ~$7.5T/day FX flow.",
    source: "Markets sizing (dealer intermediation)",
  },
  {
    id: "fermi-crypto-daily-spot-volume",
    prompt:
      "What is the total daily spot trading volume across crypto exchanges? Estimate the dollars per day.",
    quantity: "crypto spot daily $ volume",
    unit: "$ traded per day",
    money: true,
    category: "Markets & Trading",
    difficulty: "medium",
    factors: [
      { label: "Accounts trading on a given day", value: 5_000_000, unit: "active accounts" },
      { label: "Average $ traded per active account per day", value: 12_000, unit: "$/account/day" },
    ],
    reference: 60_000_000_000,
    takeaway:
      "Users × per-user throughput sizes a venue's flow the same way it sizes app usage, the trick is being honest about how few accounts are actually active on a normal day.",
    source: "Markets sizing (participant throughput)",
  },

  /* ---------------------------------------------------------------------- */
  /*  Market Microstructure, messages, ticks, order flow                    */
  /* ---------------------------------------------------------------------- */
  {
    id: "fermi-market-data-messages-per-sec",
    prompt:
      "At a busy moment, how many market-data messages per second flow across US equity and options feeds? Estimate the rate.",
    quantity: "market-data messages per second",
    unit: "messages/sec",
    category: "Market Microstructure",
    difficulty: "hard",
    factors: [
      { label: "Quote/trade messages across US feeds per session", value: 234_000_000_000, unit: "messages/day" },
      { label: "Seconds in a 6.5-hour session", value: 23_400, op: "div", unit: "s/day" },
    ],
    reference: 10_000_000,
    takeaway:
      "A rate is a daily count ÷ seconds in the day. The eye-watering per-second figure (~10M/s) is really just a huge but bounded daily total spread over 23,400 seconds.",
    source: "Microstructure (message rate)",
  },
  {
    id: "fermi-order-messages-per-day",
    prompt:
      "How many order messages (new orders plus cancels) hit a major US stock exchange in a day? Estimate the count.",
    quantity: "order messages/day on an exchange",
    unit: "messages",
    category: "Market Microstructure",
    difficulty: "hard",
    factors: [
      { label: "Executed trades per day on a major exchange", value: 40_000_000, unit: "trades/day" },
      { label: "Order messages per executed trade (heavy cancel/replace)", value: 25, unit: "messages/trade" },
    ],
    reference: 1_000_000_000,
    takeaway:
      "Modern order flow is cancel-dominated: for every fill there are dozens of quotes and cancels. Multiplying fills by that ratio exposes the true message load.",
    source: "Microstructure (order-to-trade ratio)",
  },
  {
    id: "fermi-avg-trade-size-shares",
    prompt:
      "What is the average size, in shares, of a single US equity execution? Estimate the count.",
    quantity: "average execution size",
    unit: "shares/trade",
    category: "Market Microstructure",
    difficulty: "medium",
    factors: [
      { label: "Shares traded per day (US equities)", value: 12_000_000_000, unit: "shares/day" },
      { label: "Trades per day (US equities)", value: 60_000_000, op: "div", unit: "trades/day" },
    ],
    reference: 200,
    takeaway:
      "An average is one aggregate ÷ another. Shares ÷ trades reveals how small modern prints are (~200 shares), a direct consequence of algorithmic order-slicing.",
    source: "Microstructure (average fill size)",
  },
  {
    id: "fermi-mega-cap-quote-updates-per-day",
    prompt:
      "How many times does the quote update in a single trading day for one highly-liquid mega-cap stock? Estimate the count.",
    quantity: "quote updates/day for a mega-cap",
    unit: "quote updates",
    category: "Market Microstructure",
    difficulty: "medium",
    factors: [
      { label: "Seconds in a trading session", value: 23_400, unit: "s/day" },
      { label: "Quote updates per second for a liquid name", value: 500, unit: "updates/s" },
    ],
    reference: 11_700_000,
    takeaway:
      "Rate × duration. A single liquid symbol re-quotes hundreds of times a second, so one name alone generates tens of millions of updates a day.",
    source: "Microstructure (per-symbol quote rate)",
  },

  /* ---------------------------------------------------------------------- */
  /*  Exchange & Liquidity, venues, notional, infrastructure                */
  /* ---------------------------------------------------------------------- */
  {
    id: "fermi-adr-daily-notional",
    prompt:
      "What is the daily dollar notional traded in a single liquid ADR (foreign company listed in the US)? Estimate the dollars per day.",
    quantity: "daily notional of one liquid ADR",
    unit: "$ traded per day",
    money: true,
    category: "Exchange & Liquidity",
    difficulty: "medium",
    factors: [
      { label: "ADR shares traded per day", value: 5_000_000, unit: "shares/day" },
      { label: "ADR share price", value: 60, unit: "$/share" },
    ],
    reference: 300_000_000,
    takeaway:
      "Notional = share volume × price, the same volume×price move used for the whole market, applied to one name. It's the number a desk quotes when sizing a position vs. daily liquidity.",
    source: "Liquidity sizing (single-name notional)",
  },
  {
    id: "fermi-closing-auction-size",
    prompt:
      "How much dollar value executes in the US equity closing auction on a typical day? Estimate the dollars per day.",
    quantity: "closing-auction $ executed/day",
    unit: "$ per day",
    money: true,
    category: "Exchange & Liquidity",
    difficulty: "hard",
    factors: [
      { label: "US equity dollar volume per day", value: 480_000_000_000, unit: "$/day" },
      { label: "Share of the day's volume printed in the close", value: 0.05, unit: "auction share" },
    ],
    reference: 24_000_000_000,
    takeaway:
      "Take a known aggregate and slice it by a structural share. A few percent of the day concentrates into the closing auction, which is why the close is the single most liquid moment.",
    source: "Liquidity sizing (auction share of volume)",
  },
  {
    id: "fermi-colo-racks",
    prompt:
      "How many colocation server racks fit on the trading floor of a major exchange's data center? Estimate the count.",
    quantity: "colo racks in an exchange datacenter",
    unit: "racks",
    category: "Exchange & Liquidity",
    difficulty: "medium",
    factors: [
      { label: "Colocation floor area", value: 100_000, unit: "sq ft" },
      { label: "Floor area per rack incl. aisles + cooling", value: 25, op: "div", unit: "sq ft/rack" },
    ],
    reference: 4_000,
    takeaway:
      "Container ÷ per-unit footprint, the volume-packing move applied to floorspace. Amortizing aisles and cooling into the per-rack area keeps the estimate honest.",
    source: "Infrastructure sizing (colocation)",
  },
  {
    id: "fermi-us-trading-venues",
    prompt:
      "How many separate venues (lit exchanges plus dark pools) can a US stock trade on? Estimate the count.",
    quantity: "US equity trading venues",
    unit: "venues",
    category: "Exchange & Liquidity",
    difficulty: "medium",
    factors: [
      { label: "Registered US stock exchanges", value: 16, unit: "exchanges" },
      { label: "Venues per exchange incl. affiliated dark pools/ATSs", value: 3, unit: "venues/exchange" },
    ],
    reference: 48,
    takeaway:
      "Fragmentation, quantified: liquidity is scattered across dozens of venues, which is exactly why smart-order-routing and best-execution rules exist.",
    source: "Market structure (venue fragmentation)",
  },
  {
    id: "fermi-exchange-annual-shares",
    prompt:
      "How many shares does a major US stock exchange match over a full year? Estimate the count.",
    quantity: "shares matched per year (one exchange)",
    unit: "shares",
    category: "Exchange & Liquidity",
    difficulty: "medium",
    factors: [
      { label: "Shares matched per day by the exchange", value: 1_500_000_000, unit: "shares/day" },
      { label: "Trading days per year", value: 252, unit: "days/yr" },
    ],
    reference: 378_000_000_000,
    takeaway:
      "Daily throughput × ~252 trading days annualizes any market quantity. Note the 252, not 365, markets are closed on weekends and holidays.",
    source: "Liquidity sizing (annualized volume)",
  },

  /* ---------------------------------------------------------------------- */
  /*  Derivatives & Risk, options, futures, funding                         */
  /* ---------------------------------------------------------------------- */
  {
    id: "fermi-options-contracts-per-day",
    prompt:
      "How many US-listed options contracts trade on a typical day? Estimate the count.",
    quantity: "US options contracts/day",
    unit: "contracts",
    category: "Derivatives & Risk",
    difficulty: "medium",
    factors: [
      { label: "Option trades per day (US listed)", value: 30_000_000, unit: "trades/day" },
      { label: "Average contracts per trade", value: 1.5, unit: "contracts/trade" },
    ],
    reference: 45_000_000,
    takeaway:
      "Trades × contracts-per-trade. Options print small clips too, so contract volume is only modestly above trade count, not the 100× a novice might guess.",
    source: "Derivatives sizing (contract volume)",
  },
  {
    id: "fermi-spx-option-notional",
    prompt:
      "What is the dollar notional controlled by one at-the-money S&P 500 (SPX) index option contract? Estimate the dollars.",
    quantity: "notional of one SPX option contract",
    unit: "$ notional",
    money: true,
    category: "Derivatives & Risk",
    difficulty: "easy",
    factors: [
      { label: "S&P 500 index level", value: 5_000, unit: "index points" },
      { label: "SPX contract multiplier", value: 100, unit: "$/point" },
    ],
    reference: 500_000,
    takeaway:
      "Notional = underlying level × contract multiplier. One index-point move is $100, so a single SPX contract controls a half-million dollars of exposure, the crux of position sizing.",
    source: "Derivatives sizing (contract notional)",
  },
  {
    id: "fermi-perp-funding-daily",
    prompt:
      "How much is paid in funding each day across a large perpetual-futures market? Estimate the dollars per day.",
    quantity: "daily perp funding paid",
    unit: "$ per day",
    money: true,
    category: "Derivatives & Risk",
    difficulty: "hard",
    factors: [
      { label: "Open interest in a large perp market", value: 15_000_000_000, unit: "$ OI" },
      { label: "Daily funding rate (≈0.01% × 3 windows)", value: 0.0003, unit: "/day" },
    ],
    reference: 4_500_000,
    takeaway:
      "Funding flow = open interest × the daily funding rate. Tiny per-window rates on a big OI still move millions a day between longs and shorts.",
    source: "Derivatives sizing (perp funding)",
  },
  {
    id: "fermi-vix-futures-open-interest",
    prompt:
      "What is the total open interest, in contracts, of VIX futures? Estimate the count.",
    quantity: "VIX futures open interest",
    unit: "contracts",
    category: "Derivatives & Risk",
    difficulty: "medium",
    factors: [
      { label: "VIX futures contracts traded per day", value: 250_000, unit: "contracts/day" },
      { label: "Open interest as a multiple of daily volume", value: 1.6, unit: "× daily volume" },
    ],
    reference: 400_000,
    takeaway:
      "Open interest scales with daily volume by a market-specific multiple. Estimating that ratio (~1–2× for VIX) converts an easy-to-anchor flow into a stock.",
    source: "Derivatives sizing (open interest)",
  },
  {
    id: "fermi-cme-contracts-per-day",
    prompt:
      "How many futures and options contracts trade across all CME products on a typical day? Estimate the count.",
    quantity: "CME contracts/day (all products)",
    unit: "contracts",
    category: "Derivatives & Risk",
    difficulty: "hard",
    factors: [
      { label: "Actively-traded CME products", value: 200, unit: "products" },
      { label: "Average contracts per product per day", value: 110_000, unit: "contracts/product/day" },
    ],
    reference: 22_000_000,
    takeaway:
      "Breadth × average depth. A handful of giants (ES, Treasuries, crude) dominate, but treating it as products × average captures the ~20M/day aggregate.",
    source: "Derivatives sizing (exchange throughput)",
  },

  /* ---------------------------------------------------------------------- */
  /*  Market Sizing, asset pools & industry AUM                             */
  /* ---------------------------------------------------------------------- */
  {
    id: "fermi-us-401k-assets",
    prompt:
      "What is the total value of assets held in US 401(k) retirement accounts? Estimate the dollars.",
    quantity: "US 401(k) assets",
    unit: "$ assets",
    money: true,
    category: "Market Sizing",
    difficulty: "medium",
    factors: [
      { label: "US workers with a 401(k)", value: 60_000_000, unit: "accounts" },
      { label: "Average account balance", value: 120_000, unit: "$/account" },
    ],
    reference: 7_200_000_000_000,
    takeaway:
      "Accounts × average balance sizes any pooled asset base. The average is skewed by near-retirees, so anchoring it (~$100k) is the crux of the ~$7T total.",
    source: "Market sizing (retirement assets)",
  },
  {
    id: "fermi-global-etf-aum",
    prompt:
      "What is the total assets under management of all ETFs worldwide? Estimate the dollars.",
    quantity: "global ETF AUM",
    unit: "$ AUM",
    money: true,
    category: "Market Sizing",
    difficulty: "medium",
    factors: [
      { label: "ETFs listed worldwide", value: 12_000, unit: "funds" },
      { label: "Average AUM per ETF", value: 1_000_000_000, unit: "$/fund" },
    ],
    reference: 12_000_000_000_000,
    takeaway:
      "Count × average size. A long tail of tiny funds is offset by a few giant index ETFs, so a ~$1B average lands the ~$12T industry total.",
    source: "Market sizing (fund industry AUM)",
  },
  {
    id: "fermi-hedge-fund-aum",
    prompt:
      "What is the total assets under management of the global hedge-fund industry? Estimate the dollars.",
    quantity: "global hedge-fund AUM",
    unit: "$ AUM",
    money: true,
    category: "Market Sizing",
    difficulty: "medium",
    factors: [
      { label: "Hedge funds worldwide", value: 10_000, unit: "funds" },
      { label: "Average AUM per fund", value: 450_000_000, unit: "$/fund" },
    ],
    reference: 4_500_000_000_000,
    takeaway:
      "The same count × average-size skeleton. Anchoring the average against a heavy-tailed distribution (a few multi-tens-of-billions funds) is what makes or breaks it.",
    source: "Market sizing (hedge-fund industry)",
  },

  /* ---------------------------------------------------------------------- */
  /*  Durable classics, logistics, volume, throughput, frequency, scale     */
  /* ---------------------------------------------------------------------- */
  {
    id: "fermi-barbershops-us",
    prompt:
      "How many barbershops and hair salons are there in the United States? Estimate the count.",
    quantity: "barbershops & salons in the US",
    unit: "shops",
    category: "Population & Logistics",
    difficulty: "medium",
    factors: [
      { label: "US population", value: 330_000_000, unit: "people" },
      { label: "Haircuts per person per year", value: 8, unit: "cuts/person/yr" },
      { label: "Haircuts one shop performs per year", value: 6_000, op: "div", unit: "cuts/shop/yr" },
    ],
    reference: 440_000,
    takeaway:
      "Annual demand ÷ per-unit annual throughput. Population × haircut frequency gives national demand; dividing by one shop's yearly capacity yields the store count.",
    source: "Demand ÷ throughput (service businesses)",
  },
  {
    id: "fermi-dentists-us",
    prompt:
      "How many practicing dentists are there in the United States? Estimate the count.",
    quantity: "practicing dentists in the US",
    unit: "dentists",
    category: "Population & Logistics",
    difficulty: "easy",
    factors: [
      { label: "US population", value: 330_000_000, unit: "people" },
      { label: "People one dentist can serve", value: 2_000, op: "div", unit: "people/dentist" },
    ],
    reference: 165_000,
    takeaway:
      "A one-step per-capita ratio: total population ÷ people-served-per-provider. Provider counts often collapse to a single 'how many people does one serve' anchor.",
    source: "Per-capita ratio (professionals)",
  },
  {
    id: "fermi-elevators-nyc",
    prompt:
      "How many passenger elevators are there in New York City? Estimate the count.",
    quantity: "elevators in NYC",
    unit: "elevators",
    category: "Population & Logistics",
    difficulty: "medium",
    factors: [
      { label: "Buildings tall enough to need elevators", value: 45_000, unit: "buildings" },
      { label: "Elevators per such building", value: 2, unit: "elevators/building" },
    ],
    reference: 90_000,
    takeaway:
      "Filter to the relevant stock (tall buildings), then apply a per-unit count. Filtering before multiplying keeps you from scaling by all buildings.",
    source: "Stock × per-unit count (infrastructure)",
  },
  {
    id: "fermi-pingpong-balls-747",
    prompt:
      "How many ping-pong balls would fill the interior of a Boeing 747? Estimate the count.",
    quantity: "ping-pong balls in a 747",
    unit: "balls",
    category: "Counting by Volume",
    difficulty: "medium",
    factors: [
      { label: "Usable interior volume of a 747", value: 1_000_000_000, unit: "cm³" },
      { label: "Sphere-packing efficiency", value: 0.64, unit: "usable fraction" },
      { label: "Volume of one ping-pong ball", value: 40, op: "div", unit: "cm³/ball" },
    ],
    reference: 16_000_000,
    takeaway:
      "Counting-by-volume, again: container volume × packing efficiency ÷ one object's volume. The 64% random-packing haircut is the reusable constant here.",
    source: "Counting by volume (packing efficiency)",
  },
  {
    id: "fermi-water-bottles-olympic-pool",
    prompt:
      "How many half-liter water bottles would it take to fill an Olympic swimming pool? Estimate the count.",
    quantity: "0.5 L bottles to fill a pool",
    unit: "bottles",
    category: "Counting by Volume",
    difficulty: "easy",
    factors: [
      { label: "Volume of an Olympic pool", value: 2_500_000, unit: "L" },
      { label: "Volume of one bottle", value: 0.5, op: "div", unit: "L/bottle" },
    ],
    reference: 5_000_000,
    takeaway:
      "When units already match (liters ÷ liters), counting-by-volume is a single clean division, no packing haircut needed for a fluid.",
    source: "Counting by volume (fluid)",
  },
  {
    id: "fermi-emails-per-day-world",
    prompt:
      "How many emails are sent worldwide in a single day? Estimate the count.",
    quantity: "emails sent per day (world)",
    unit: "emails",
    category: "Throughput & Flow",
    difficulty: "easy",
    factors: [
      { label: "Email users worldwide", value: 4_000_000_000, unit: "users" },
      { label: "Emails sent per user per day", value: 40, unit: "emails/user/day" },
    ],
    reference: 160_000_000_000,
    takeaway:
      "Users × per-user rate. The per-user number quietly includes automated/newsletter mail, which is why the honest rate is dozens, not a handful.",
    source: "Digital-usage sizing (message flow)",
  },
  {
    id: "fermi-card-transactions-us-per-day",
    prompt:
      "How many card (credit + debit) transactions happen in the United States each day? Estimate the count.",
    quantity: "US card transactions per day",
    unit: "transactions",
    category: "Throughput & Flow",
    difficulty: "medium",
    factors: [
      { label: "US cardholders", value: 250_000_000, unit: "people" },
      { label: "Card purchases per person per day", value: 2.6, unit: "txns/person/day" },
    ],
    reference: 650_000_000,
    takeaway:
      "Population × per-capita daily rate. Small everyday frequencies (a couple of taps a day) times a big population produce hundreds of millions of events.",
    source: "Frequency estimation (payments flow)",
  },
  {
    id: "fermi-subway-rides-nyc-per-day",
    prompt:
      "How many rides are taken on the New York City subway on a typical weekday? Estimate the count.",
    quantity: "NYC subway rides per weekday",
    unit: "rides",
    category: "Throughput & Flow",
    difficulty: "medium",
    factors: [
      { label: "People in the NYC subway's service area", value: 8_000_000, unit: "people" },
      { label: "Subway rides per person per day (system-wide average)", value: 0.45, unit: "rides/person/day" },
    ],
    reference: 3_600_000,
    takeaway:
      "Population × an activity rate below 1. Not everyone rides, and riders average two trips, so a ~0.45 blended per-capita rate captures the daily total.",
    source: "Adoption-rate sizing (transit)",
  },
  {
    id: "fermi-netflix-annual-revenue",
    prompt:
      "What is Netflix's approximate annual revenue? Estimate the dollars per year.",
    quantity: "Netflix annual revenue",
    unit: "$ per year",
    money: true,
    category: "Revenue & Frequency",
    difficulty: "easy",
    factors: [
      { label: "Netflix subscribers worldwide", value: 250_000_000, unit: "subscribers" },
      { label: "Average revenue per subscriber per year", value: 140, unit: "$/subscriber/yr" },
    ],
    reference: 35_000_000_000,
    takeaway:
      "Subscription revenue = subscribers × annual ARPU. Converting a ~$12/month price into a yearly ARPU is the one unit-conversion that carries the estimate.",
    source: "Market-sizing (subscription revenue)",
  },
  {
    id: "fermi-superbowl-ad-revenue",
    prompt:
      "How much ad revenue does the broadcaster collect from in-game Super Bowl commercials? Estimate the dollars.",
    quantity: "Super Bowl in-game ad revenue",
    unit: "$ per game",
    money: true,
    category: "Revenue & Frequency",
    difficulty: "medium",
    factors: [
      { label: "30-second ad slots during the game", value: 80, unit: "slots" },
      { label: "Price per 30-second slot", value: 7_000_000, unit: "$/slot" },
    ],
    reference: 560_000_000,
    takeaway:
      "Inventory × unit price. Sizing the ad load (how many 30-second slots actually fit in the broadcast) is the non-obvious half of the estimate.",
    source: "Revenue sizing (advertising inventory)",
  },
  {
    id: "fermi-nyc-taxi-daily-revenue",
    prompt:
      "What is the total daily fare revenue of New York City's yellow-cab fleet? Estimate the dollars per day.",
    quantity: "NYC yellow-cab daily fare revenue",
    unit: "$ per day",
    money: true,
    category: "Revenue & Frequency",
    difficulty: "medium",
    factors: [
      { label: "Active yellow cabs", value: 13_000, unit: "cabs" },
      { label: "Fares per cab per day", value: 25, unit: "fares/cab/day" },
      { label: "Average fare", value: 18, unit: "$/fare" },
    ],
    reference: 5_850_000,
    takeaway:
      "Fleet size × trips-per-unit × ticket size, the storefront revenue skeleton, applied to a moving fleet. Each factor is independently checkable.",
    source: "Revenue sizing (fleet throughput)",
  },
  {
    id: "fermi-words-read-lifetime",
    prompt:
      "How many words does an average person read over their lifetime? Estimate the count.",
    quantity: "words read in a lifetime",
    unit: "words",
    category: "Scale & Counting",
    difficulty: "medium",
    factors: [
      { label: "Words read per minute (casual pace)", value: 200, unit: "words/min" },
      { label: "Minutes reading per day", value: 60, unit: "min/day" },
      { label: "Days per year", value: 365, unit: "days/yr" },
      { label: "Reading years in a life", value: 70, unit: "yr" },
    ],
    reference: 306_600_000,
    takeaway:
      "Unit-chaining a rate to a lifetime total. The reading-minutes-per-day factor is the soft one, bound it deliberately and the powers of ten follow.",
    source: "Unit-chaining estimation (human scale)",
  },
  {
    id: "fermi-breaths-lifetime",
    prompt:
      "How many breaths does a person take over an average lifetime? Estimate the count.",
    quantity: "breaths in a lifetime",
    unit: "breaths",
    category: "Scale & Counting",
    difficulty: "easy",
    factors: [
      { label: "Breaths per minute (resting)", value: 15, unit: "breaths/min" },
      { label: "Minutes per day", value: 1_440, unit: "min/day" },
      { label: "Days per year", value: 365, unit: "days/yr" },
      { label: "Human lifespan", value: 75, unit: "yr" },
    ],
    reference: 591_300_000,
    takeaway:
      "Same per-minute → per-lifetime chain as heartbeats. Cross-checking two biological rates against each other is a great sanity test on your bookkeeping.",
    source: "Unit-chaining estimation (biological scale)",
  },
  {
    id: "fermi-steps-lifetime",
    prompt:
      "How many steps does an average person walk over their lifetime? Estimate the count.",
    quantity: "steps walked in a lifetime",
    unit: "steps",
    category: "Scale & Counting",
    difficulty: "easy",
    factors: [
      { label: "Steps per day", value: 6_000, unit: "steps/day" },
      { label: "Days per year", value: 365, unit: "days/yr" },
      { label: "Walking years in a life", value: 75, unit: "yr" },
    ],
    reference: 164_250_000,
    takeaway:
      "A daily rate × days × years. Anchoring the daily-steps factor (well under the mythical 10,000) is the whole ballgame.",
    source: "Unit-chaining estimation (human scale)",
  },
];

/** Categories present in `FERMI_ITEMS`, in a stable curated display order. */
export const FERMI_CATEGORY_ORDER: FermiCategory[] = [
  "Markets & Trading",
  "Market Microstructure",
  "Exchange & Liquidity",
  "Derivatives & Risk",
  "Market Sizing",
  "Population & Logistics",
  "Counting by Volume",
  "Throughput & Flow",
  "Revenue & Frequency",
  "Scale & Counting",
];
