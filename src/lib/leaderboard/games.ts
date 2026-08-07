/**
 * leaderboard/games.ts — the registry of COMPETITIVE games the unified
 * leaderboard ranks, and the (documented) score model for each.
 *
 * This is a pure DATA module (no React, no I/O) so it is trivially importable
 * by both the local board store, the Leaderboard UI, and the game pages. Adding
 * a new competitive game = add one entry here + submit its final score from the
 * page via `submitLocalScore` (see `localBoard.ts`).
 *
 * SCORE MODEL. Every board is HIGHER-IS-BETTER: each game reduces a finished
 * run to a single numeric score (P&L, ending balance, or a composite
 * skill×P&L). Scores can be NEGATIVE (a losing run) — the ranking still holds
 * (a bigger number ranks higher). Ties break toward the EARLIER timestamp (the
 * run that reached the score first ranks ahead). See `compareScores`.
 */

/** A game the unified leaderboard covers. `id` matches the games catalog id. */
export interface LeaderboardGame {
  /** Stable board id (also the catalog id + the localStorage board key). */
  id: string;
  /** Human title shown in the leaderboard UI. */
  title: string;
  /** Router path to launch the game. */
  to: string;
  /** What the ranked score MEANS for this game (shown under the board). */
  scoreLabel: string;
  /** Short unit/suffix for a score value (e.g. "pts", "$", "P&L"). */
  scoreUnit: string;
  /** One-line description of the ranking rule (documented, honest). */
  ranking: string;
}

/**
 * The competitive games covered by the unified leaderboard, in a sensible
 * display order (makers → takers → bettors → live/timed arenas).
 */
export const LEADERBOARD_GAMES: LeaderboardGame[] = [
  {
    id: "make-market",
    title: "Make Me a Market",
    to: "/make-market",
    scoreLabel: "Final settlement balance, marked to the true value.",
    scoreUnit: "$",
    ranking: "Higher ending balance ranks first; ties go to the earlier run.",
  },
  {
    id: "market-of-cards",
    title: "Market of Cards",
    to: "/market-of-cards",
    scoreLabel: "Net position marked to the true table total (P&L).",
    scoreUnit: "P&L",
    ranking: "Higher mark-to-true P&L ranks first; ties go to the earlier run.",
  },
  {
    id: "cards-market-making",
    title: "Cards Market Making",
    to: "/cards-market-making",
    scoreLabel: "Ending points balance after every round settles.",
    scoreUnit: "pts",
    ranking: "Higher ending balance ranks first; ties go to the earlier run.",
  },
  {
    id: "probability-betting",
    title: "Probability Betting",
    to: "/probability-betting",
    scoreLabel: "Composite skill × P&L leaderboard score.",
    scoreUnit: "pts",
    ranking: "Higher skill-weighted P&L ranks first; ties go to the earlier run.",
  },
  {
    id: "fruit-market",
    title: "Fruit Market",
    to: "/fruit-market",
    scoreLabel: "Raw profit × first-click accuracy.",
    scoreUnit: "pts",
    ranking: "Higher accuracy-weighted profit ranks first; ties by earlier run.",
  },
  {
    id: "dice-and-cards",
    title: "Dice & Cards",
    to: "/dice-and-cards",
    scoreLabel: "Ending points balance after four rounds.",
    scoreUnit: "pts",
    ranking: "Higher ending balance ranks first; ties go to the earlier run.",
  },
  {
    id: "next-card-betting",
    title: "Next Card Betting",
    to: "/next-card-betting",
    scoreLabel: "Bankroll × Kelly-sizing skill leaderboard score.",
    scoreUnit: "pts",
    ranking: "Higher skill-weighted bankroll ranks first; ties by earlier run.",
  },
  {
    id: "trading-floor",
    title: "The Trading Floor",
    to: "/trading-floor",
    scoreLabel: "Final P&L versus the honest desk on the same flow.",
    scoreUnit: "P&L",
    ranking: "Higher final P&L ranks first; ties go to the earlier run.",
  },
  {
    id: "speed-arena",
    title: "Speed Arena",
    to: "/arena",
    scoreLabel: "Best run score (correct answers, speed-weighted).",
    scoreUnit: "pts",
    ranking: "Higher run score ranks first; ties go to the earlier run.",
  },
  {
    id: "numberlogic",
    title: "NumberLogic",
    to: "/numberlogic",
    scoreLabel: "Tier-weighted score across the 26-item sequence paper.",
    scoreUnit: "pts",
    ranking: "Higher weighted score ranks first; ties go to the earlier run.",
  },
  {
    id: "beat-the-odds",
    title: "Beat the Odds",
    to: "/beat-the-odds",
    scoreLabel: "Speed-weighted probability/EV score (tier-weighted).",
    scoreUnit: "pts",
    ranking: "Higher speed-weighted score ranks first; ties by earlier run.",
  },
  {
    id: "stockmaster",
    title: "Stockmaster",
    to: "/stockmaster",
    scoreLabel: "Attention score: fast hits minus false buys and misses.",
    scoreUnit: "pts",
    ranking: "Higher attention score ranks first; ties go to the earlier run.",
  },
  {
    id: "number-box",
    title: "Number Box",
    to: "/number-box",
    scoreLabel: "Net modular-math score (+1 correct, −1 wrong).",
    scoreUnit: "pts",
    ranking: "Higher net score ranks first; ties go to the earlier run.",
  },
  {
    id: "shape-shift",
    title: "Shape Shift",
    to: "/shape-shift",
    scoreLabel: "Tier-weighted mental-rotation score.",
    scoreUnit: "pts",
    ranking: "Higher weighted score ranks first; ties go to the earlier run.",
  },
];

/** Fast lookup of a leaderboard game by its board id. */
export const LEADERBOARD_GAME_BY_ID: Record<string, LeaderboardGame> =
  Object.fromEntries(LEADERBOARD_GAMES.map((g) => [g.id, g]));

/** True iff `id` is a known competitive leaderboard board. */
export function isLeaderboardGame(id: string): boolean {
  return id in LEADERBOARD_GAME_BY_ID;
}
