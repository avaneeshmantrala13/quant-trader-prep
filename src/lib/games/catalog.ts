/**
 * ============================================================================
 *  QUANT GAMES CATALOG — the single source of truth for the Games hub
 * ============================================================================
 * Every interview game the app ships lives here as one metadata entry. The
 * Games hub (`/games`) renders launchable tiles from this list, and the app
 * nav points at the hub rather than carrying one link per game. Adding a new
 * game = add one route in `App.tsx` + one entry here; the hub updates itself.
 *
 * Faithful to `QuantGames-Mechanics.md`: each entry names the underlying skill,
 * the trader ROLE (maker vs taker vs bettor), and a difficulty read so the
 * learner can pick a game that matches what they want to drill. Icons are keyed
 * by a stable string so this stays a pure data module (no JSX / React import) —
 * the hub maps the key to a component.
 */

/** Icon keys resolved to components by the hub (keeps this module pure data). */
export type GameIconKey =
  | "candlestick"
  | "gauge"
  | "cards"
  | "dice"
  | "sigma"
  | "brain"
  | "bolt";

/** The trader's seat in each game — the single most orienting fact. The
 * `Cognitive` role tags the Optiver-style assessment drills (sequences,
 * modular math, attention, spatial rotation) that train aptitude rather than a
 * trading seat. */
export type GameRole = "Maker" | "Taker" | "Bettor" | "Estimator" | "Cognitive";

export type GameDifficulty = "Warm-up" | "Core" | "Advanced";

export interface GameMeta {
  /** Stable id, also used as the hub tile key. */
  id: string;
  /** Router path the tile launches. */
  to: string;
  title: string;
  /** One-line hook shown on the tile. */
  tagline: string;
  /** The skill this game trains (shown as a chip). */
  skill: string;
  role: GameRole;
  difficulty: GameDifficulty;
  icon: GameIconKey;
  /** `QuantGames-Mechanics.md` game number, for provenance. */
  gameNo: number;
  /** Two or three concrete "what you'll do" bullets. */
  highlights: string[];
}

export const GAMES: GameMeta[] = [
  {
    id: "make-market",
    to: "/make-market",
    title: "Make Me a Market",
    tagline:
      "Set a fair buy and sell price, then trade and defend it.",
    skill: "Market making",
    role: "Maker",
    difficulty: "Core",
    icon: "candlestick",
    gameNo: 1,
    highlights: [
      "Quote a 95% interval, then tighten under a max-spread cap",
      "Skew and add size when you get lifted",
      "Close on position, max loss and exact break-even",
    ],
  },
  {
    id: "probability-betting",
    to: "/probability-betting",
    title: "Probability Betting",
    tagline: "Turn odds into a real chance, spot good bets, and size them.",
    skill: "Odds · edge · Kelly",
    role: "Bettor",
    difficulty: "Core",
    icon: "gauge",
    gameNo: 2,
    highlights: [
      "Convert odds ↔ implied probability on the fly",
      "Bet only when your fair beats the implied",
      "Stake the Kelly fraction, watch the arb board",
    ],
  },
  {
    id: "cards-market-making",
    to: "/cards-market-making",
    title: "Cards Market Making",
    tagline: "Guess a hidden card total and pay for a peek only when it's worth it.",
    skill: "EV · value of info",
    role: "Taker",
    difficulty: "Core",
    icon: "cards",
    gameNo: 3,
    highlights: [
      "Value the hand's EV, take the side with edge",
      "State your P&L from memory after the cards hide",
      "Asymmetric scoring punishes an unrecognised loss",
    ],
  },
  {
    id: "market-of-cards",
    to: "/market-of-cards",
    title: "Market of Cards",
    tagline: "Set buy and sell prices at a busy table against smart bots.",
    skill: "Group market making",
    role: "Maker",
    difficulty: "Advanced",
    icon: "cards",
    gameNo: 4,
    highlights: [
      "Price the signed table total from just your two cards",
      "Update the mid the instant a community card flips",
      "Trade both directions — the risk-manager test",
    ],
  },
  {
    id: "fruit-market",
    to: "/fruit-market",
    title: "Fruit Market",
    tagline: "Do fast mental math to value a basket before time runs out.",
    skill: "Speed arithmetic",
    role: "Taker",
    difficulty: "Warm-up",
    icon: "sigma",
    gameNo: 5,
    highlights: [
      "value = (total apples) × (total oranges)",
      "Apply the market event BEFORE you multiply",
      "First click in each 15s window captures the most edge",
    ],
  },
  {
    id: "dice-and-cards",
    to: "/dice-and-cards",
    title: "Dice & Cards",
    tagline: "Price a mix of dice and cards, and judge how much it can swing.",
    skill: "Products · variance",
    role: "Taker",
    difficulty: "Advanced",
    icon: "dice",
    gameNo: 6,
    highlights: [
      "Answer the standard-deviation question first",
      "Read the quote from the computer's side, then trade",
      "Track your running P&L to the last question",
    ],
  },
  {
    id: "next-card-betting",
    to: "/next-card-betting",
    title: "Next Card Betting",
    tagline: "Track the deck and bet on what the next card will be.",
    skill: "Counting · Kelly",
    role: "Bettor",
    difficulty: "Core",
    icon: "bolt",
    gameNo: 9,
    highlights: [
      "Every dealt card stays visible — count what's left",
      "Higher/Lower, Inside/Outside, New-Suit bets",
      "Skill = how close your stake sits to Kelly",
    ],
  },
  {
    id: "fermi",
    to: "/fermi",
    title: "Fermi Drill",
    tagline: "Estimate a huge number by breaking it into smaller guesses.",
    skill: "Estimation",
    role: "Estimator",
    difficulty: "Warm-up",
    icon: "brain",
    gameNo: 10,
    highlights: [
      "Break a scary question into knowable factors",
      "Commit to a number and a confidence band",
      "See a defensible decomposition every round",
    ],
  },
  {
    id: "arbitrage",
    to: "/arbitrage",
    title: "Arbitrage & De-vig",
    tagline: "Find the risk-free win hidden inside a set of betting odds.",
    skill: "No-arbitrage · de-vig",
    role: "Bettor",
    difficulty: "Core",
    icon: "gauge",
    gameNo: 7,
    highlights: [
      "Remove the overround to recover fair probabilities",
      "Flag when a book of odds is a guaranteed arb",
      "Pick the value leg and the basket-vs-parts trade",
    ],
  },
  {
    id: "ev-timed",
    to: "/ev-timed",
    title: "EV Under Time",
    tagline: "Pick the smarter bet before the clock runs out.",
    skill: "EV · fair value",
    role: "Bettor",
    difficulty: "Core",
    icon: "bolt",
    gameNo: 8,
    highlights: [
      "Decide fair value / optimal-stopping under a countdown",
      "Speed adds points — but only when you're right",
      "Every item is exact-verified from the EV generators",
    ],
  },
  /* ---- Optiver-style Assessment cluster (Zap-N / NumberLogic / Beat the
     Odds). Cognitive-aptitude drills that mimic Optiver's 2026 online
     assessment sections rather than a trading seat. ------------------------- */
  {
    id: "numberlogic",
    to: "/numberlogic",
    title: "NumberLogic",
    tagline: "Find the next number in the pattern, puzzle after puzzle.",
    skill: "Sequence patterns",
    role: "Cognitive",
    difficulty: "Core",
    icon: "sigma",
    gameNo: 11,
    highlights: [
      "Find the next term as the rule escalates in difficulty",
      "Ratio+offset, second-difference, interleaved & Fibonacci traps",
      "Harder items are worth more — check differences, then ratios",
    ],
  },
  {
    id: "beat-the-odds",
    to: "/beat-the-odds",
    title: "Beat the Odds",
    tagline: "Answer quick chance-and-odds questions fast, and beat the clock.",
    skill: "Probability · EV",
    role: "Cognitive",
    difficulty: "Core",
    icon: "gauge",
    gameNo: 12,
    highlights: [
      "~20 questions, five options, strictly no going back",
      "Dice/coin/card odds up to conditional probability & expectations",
      "A correct answer scores a speed bonus that decays with the clock",
    ],
  },
  {
    id: "stockmaster",
    to: "/stockmaster",
    title: "Stockmaster",
    tagline: "Watch the signals and buy at the exact right moment.",
    skill: "Attention · reflex",
    role: "Cognitive",
    difficulty: "Warm-up",
    icon: "bolt",
    gameNo: 13,
    highlights: [
      "Go/no-go: buy only on arrow-up AND green-light ticks",
      "Fast hits score most; false buys and misses cost you",
      "A sustained-attention and impulse-control test",
    ],
  },
  {
    id: "number-box",
    to: "/number-box",
    title: "Number Box",
    tagline: "Solve quick number puzzles against a two-minute clock.",
    skill: "Modular math",
    role: "Cognitive",
    difficulty: "Warm-up",
    icon: "brain",
    gameNo: 14,
    highlights: [
      "Compute residues mod m — add, subtract, multiply, square",
      "Fill-the-box congruences as difficulty ramps",
      "Optiver-style scoring: +1 correct, −1 wrong",
    ],
  },
  {
    id: "shape-shift",
    to: "/shape-shift",
    title: "Shape Shift",
    tagline: "Rotate a shape in your head and pick the one that matches.",
    skill: "Spatial rotation",
    role: "Cognitive",
    difficulty: "Warm-up",
    icon: "dice",
    gameNo: 15,
    highlights: [
      "Rotate 90°/180°, mirror, or a combination — in your head",
      "Distractors are the shape's other orientations, so no eliminating",
      "Fast rounds against the clock, escalating transforms",
    ],
  },
];

export const GAME_BY_ID: Record<string, GameMeta> = Object.fromEntries(
  GAMES.map((g) => [g.id, g]),
);

export const DIFFICULTY_ORDER: GameDifficulty[] = ["Warm-up", "Core", "Advanced"];

export function gamesByDifficulty(d: GameDifficulty): GameMeta[] {
  return GAMES.filter((g) => g.difficulty === d);
}
