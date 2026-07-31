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

/** The trader's seat in each game — the single most orienting fact. */
export type GameRole = "Maker" | "Taker" | "Bettor" | "Estimator";

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
      "Quote a two-sided market and defend it against an informed counterparty.",
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
    tagline: "Turn stated odds into implied probability, find the edge, size with Kelly.",
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
    tagline: "Price a hidden card sum as the taker — and pay only for information worth it.",
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
    tagline: "Be the maker at a full table — quote both sides against adaptive bots.",
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
    tagline: "Speed mental math — value the basket and beat the clock before the quote moves.",
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
    tagline: "Price a product of cards and dice — and know its standard deviation cold.",
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
    tagline: "Count the deck, compute the true probability, stake the Kelly fraction.",
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
    tagline: "Order-of-magnitude estimation — decompose, anchor, and defend a number.",
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
];

export const GAME_BY_ID: Record<string, GameMeta> = Object.fromEntries(
  GAMES.map((g) => [g.id, g]),
);

export const DIFFICULTY_ORDER: GameDifficulty[] = ["Warm-up", "Core", "Advanced"];

export function gamesByDifficulty(d: GameDifficulty): GameMeta[] {
  return GAMES.filter((g) => g.difficulty === d);
}
