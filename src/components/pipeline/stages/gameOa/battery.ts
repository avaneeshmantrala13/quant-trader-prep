import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { StationProps } from "./kit";
import {
  TRADING_SUBTOPICS,
  type TradingGameId,
} from "@/lib/mastery/tradingSubtopics";

/**
 * THE GAME-OA BATTERY — the ordered sequence of embedded game "stations" the
 * guided pipeline plays the learner through in Stage 4. Each station reuses its
 * game's pure engine and folds into its own trading-intuition subtopic (single
 * source of truth: `@/lib/mastery/tradingSubtopics`). This module joins that
 * decomposition to the station COMPONENTS (lazy-loaded, so the heavy game code
 * is only pulled in when its station mounts).
 *
 * Reused by BOTH the battery driver (`GameOaStage`) and the drilling loop
 * (`DrillingStage` re-mounts a single station to re-drill a weak subtopic), so a
 * game is embedded in exactly one place.
 */
export interface BatteryStation {
  gameId: TradingGameId;
  /** The trading-intuition subtopic this station feeds. */
  subtopicKey: string;
  /** Short battery-step title. */
  title: string;
  /** The competency this game trains. */
  skillLabel: string;
  blurb: string;
  Component: LazyExoticComponent<ComponentType<StationProps>>;
}

/** Lazy station component per game id. */
const STATION_COMPONENTS: Record<
  TradingGameId,
  LazyExoticComponent<ComponentType<StationProps>>
> = {
  "make-market": lazy(() => import("./MakeMarketStation")),
  "trading-floor": lazy(() => import("./TradingFloorStation")),
  "cards-mm": lazy(() => import("./CardsMarketMakingStation")),
  "next-card": lazy(() => import("./NextCardStation")),
  arbitrage: lazy(() => import("./ArbitrageStation")),
  fermi: lazy(() => import("./FermiStation")),
  numberlogic: lazy(() => import("./NumberLogicStation")),
  "beat-the-odds": lazy(() => import("./BeatTheOddsStation")),
  stockmaster: lazy(() => import("./StockmasterStation")),
  "number-box": lazy(() => import("./NumberBoxStation")),
  "shape-shift": lazy(() => import("./ShapeShiftStation")),
};

/** Per-game battery-step titles. */
const STATION_TITLES: Record<TradingGameId, string> = {
  "make-market": "Make a market",
  "trading-floor": "The trading floor",
  "cards-mm": "Cards market making",
  "next-card": "Next-card betting",
  arbitrage: "Arbitrage & de-vig",
  fermi: "Fermi estimation",
  numberlogic: "NumberLogic",
  "beat-the-odds": "Beat the odds",
  stockmaster: "Stockmaster",
  "number-box": "Number box",
  "shape-shift": "Shape shift",
};

/** The battery, in play order (matches the subtopic decomposition order). */
export const BATTERY: BatteryStation[] = TRADING_SUBTOPICS.map((s) => ({
  gameId: s.gameId,
  subtopicKey: s.key,
  title: STATION_TITLES[s.gameId],
  skillLabel: s.label,
  blurb: s.blurb,
  Component: STATION_COMPONENTS[s.gameId],
}));

/** Look up a station by the game it embeds. */
export function stationForGame(gameId: TradingGameId): BatteryStation {
  const st = BATTERY.find((b) => b.gameId === gameId);
  if (!st) throw new Error(`No battery station for game: ${gameId}`);
  return st;
}

/** Look up a station by the subtopic node key it feeds (undefined if none). */
export function stationForSubtopic(
  subtopicKey: string,
): BatteryStation | undefined {
  return BATTERY.find((b) => b.subtopicKey === subtopicKey);
}
