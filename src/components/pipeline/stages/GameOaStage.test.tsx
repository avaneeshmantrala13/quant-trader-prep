// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import { deriveVerdict } from "@/lib/mastery/verdict";
import { MASTERY_BAR } from "@/lib/mastery/config";
import {
  COMPETENCY_TRADING,
  foldMarketMakingRound,
  marketMakingCredit,
  type MarketMakingRoundOutcome,
} from "@/lib/mastery/competency";
import {
  TRADING_SUBTOPIC_KEYS,
  tradingSubtopicByGame,
  type TradingGameId,
} from "@/lib/mastery/tradingSubtopics";
import {
  COMPETENCY_BRAINTEASER,
  scoredContentTopicKeys,
} from "@/lib/pipeline/gates";
import { pickNextDrillTarget } from "@/lib/pipeline/drilling";

/**
 * Stage-4 (game-OA) tests. The stage is now the full trading-intuition BATTERY: it
 * sequences the eleven embedded game stations, each of which reuses its game's
 * pure engine and folds into its OWN trading-intuition subtopic. These tests
 * lock (a) the P2 make-a-market scorer still maps outcomes → credit and reaches
 * mastery over N rounds, (b) the battery driver mounts the first station and
 * advances station-to-station, folding into the RIGHT subtopic, and (c) the
 * completion payload reports the rolled-up subtopic mastery.
 */

const MAKE_MARKET_KEY = tradingSubtopicByGame("make-market").key;

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "game-oa-user",
    loadProgress: () => CURRENT,
    saveProgress: (_u: string, next: UserProgress) => {
      CURRENT = next;
    },
    getTheme: () => "light",
    setTheme: () => {},
    getThemeId: () => "minimalist",
    setThemeId: () => {},
    logOut: () => {},
    signUp: async () => ({ ok: true }),
    logIn: async () => ({ ok: true }),
  },
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

// eslint-disable-next-line import/first
import { AuthProvider } from "@/context/AuthContext";
// eslint-disable-next-line import/first
import { ProgressProvider, useProgress } from "@/context/ProgressContext";
// eslint-disable-next-line import/first
import GameOaStage, { buildBatteryResult } from "./GameOaStage";
// eslint-disable-next-line import/first
import { MAKE_MARKET_ROUNDS } from "./gameOa/MakeMarketStation";
// eslint-disable-next-line import/first
import {
  BATTERY,
  stationForGame,
  stationForSubtopic,
} from "./gameOa/battery";

beforeEach(() => {
  CURRENT = emptyProgress();
});
afterEach(cleanup);

/** Exposes the make-a-market subtopic bucket so the test can read its evidence. */
function SpreadProbe() {
  const { getTopicMastery } = useProgress();
  const m = getTopicMastery(MAKE_MARKET_KEY);
  return <span data-testid="spread-n">{m?.n ?? 0}</span>;
}

function renderStage(onComplete: (r?: unknown) => void) {
  return render(
    <AuthProvider>
      <ProgressProvider>
        <GameOaStage onComplete={onComplete} />
        <SpreadProbe />
      </ProgressProvider>
    </AuthProvider>,
  );
}

/** Play one make-a-market station round (tight 100/101 market), then advance. */
function playMakeMarketRound(isLast: boolean) {
  fireEvent.change(screen.getByLabelText("bid"), { target: { value: "100" } });
  fireEvent.change(screen.getByLabelText("ask"), { target: { value: "101" } });
  fireEvent.click(screen.getByRole("button", { name: /show market/i }));
  fireEvent.click(
    screen.getByRole("button", {
      name: isLast ? /finish game/i : /next round/i,
    }),
  );
}

/* -------------------------------------------------------------------------- */
/*  Credit mapping (the P2 scorer the make-market station folds through)       */
/* -------------------------------------------------------------------------- */

describe("round outcome → trading-intuition credit (P2 scorer)", () => {
  it("a pick-off round yields 0 credit, even with incidental positive P&L", () => {
    expect(marketMakingCredit({ pnl: 6, pickedOff: true, at: "t" })).toBe(0);
    expect(marketMakingCredit({ pnl: -4, pickedOff: true, at: "t" })).toBe(0);
  });

  it("a tight, non-picked-off, positive-P&L round captures full credit", () => {
    expect(marketMakingCredit({ pnl: 8, at: "t" })).toBe(1);
  });

  it("a break-even / no-fill round captures no edge (0 credit)", () => {
    expect(marketMakingCredit({ pnl: 0, at: "t" })).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Mastery over N rounds (the make-market Beta path)                          */
/* -------------------------------------------------------------------------- */

describe("edge-capturing rounds accrue toward mastery over N rounds", () => {
  const N = 16;
  function foldRounds(rounds: MarketMakingRoundOutcome[]): TopicMastery | undefined {
    let m: TopicMastery | undefined;
    for (const r of rounds) m = foldMarketMakingRound(m, r);
    return m;
  }

  it("a full run of clean edge-capturing rounds pushes Beta CI_low ≥ 0.80", () => {
    const rounds = Array.from({ length: N }, () => ({ pnl: 10, at: "t" }));
    const v = deriveVerdict(foldRounds(rounds), COMPETENCY_TRADING);
    expect(v.lo).toBeGreaterThanOrEqual(MASTERY_BAR);
    expect(v.mastered).toBe(true);
  });

  it("a thin winning streak (a few rounds) is NOT yet mastery", () => {
    const rounds = Array.from({ length: 6 }, () => ({ pnl: 10, at: "t" }));
    expect(deriveVerdict(foldRounds(rounds), COMPETENCY_TRADING).mastered).toBe(false);
  });

  it("repeated pick-offs keep the node below the bar", () => {
    const rounds = Array.from({ length: N }, () => ({
      pnl: -5,
      pickedOff: true,
      at: "t",
    }));
    expect(deriveVerdict(foldRounds(rounds), COMPETENCY_TRADING).mastered).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Battery result payload (pure)                                              */
/* -------------------------------------------------------------------------- */

describe("buildBatteryResult — rolls up subtopic mastery", () => {
  it("reports how many of the trading subtopics clear their bar", () => {
    const p = emptyProgress();
    p.topicMastery = {
      [TRADING_SUBTOPIC_KEYS[0]]: {
        theta: 2,
        n: 62,
        alpha: 60,
        beta: 2,
        lastSeen: "t",
        misconceptions: {},
      },
    };
    const results: Parameters<typeof buildBatteryResult>[0] = [];
    const r = buildBatteryResult(results, p);
    expect(r.rounds).toBe(0);
    expect(typeof r.pnl).toBe("number");
    expect(r.verdict).toBe(`1/${TRADING_SUBTOPIC_KEYS.length} trading skills mastered`);
  });
});

/* -------------------------------------------------------------------------- */
/*  Battery config (station ↔ subtopic wiring)                                 */
/* -------------------------------------------------------------------------- */

describe("BATTERY — station ↔ subtopic wiring", () => {
  it("has one station per subtopic, in decomposition order, each playable", () => {
    expect(BATTERY).toHaveLength(TRADING_SUBTOPIC_KEYS.length);
    expect(BATTERY.map((b) => b.subtopicKey)).toEqual(TRADING_SUBTOPIC_KEYS);
    for (const b of BATTERY) {
      expect(b.Component).toBeTruthy();
      expect(stationForSubtopic(b.subtopicKey)).toBe(b);
      expect(stationForGame(b.gameId)).toBe(b);
    }
    expect(stationForSubtopic("competency::not-real")).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  Weak game-OA subtopic → re-drills that EXACT game (not generic MCQs)        */
/* -------------------------------------------------------------------------- */

/** A Beta bucket whose CI_low sits well above the 0.80 bar (mastered). */
function masteredBucket(): TopicMastery {
  return { theta: 2, n: 62, alpha: 60, beta: 2, lastSeen: "t", misconceptions: {} };
}
/** A weak Beta bucket whose CI_low is far below 0.80 (not mastered). */
function weakBucket(): TopicMastery {
  return { theta: -1, n: 6, alpha: 1, beta: 6, lastSeen: "t", misconceptions: {} };
}

/**
 * Everything cleared (all content + timed + brainteaser + every trading
 * subtopic) EXCEPT the one game subtopic under test, which is left weak — so the
 * ONLY thing the drilling loop can pick is that game's re-drill.
 */
function onlyOneGameWeak(weakGame: TradingGameId): UserProgress {
  const p = emptyProgress();
  const tm: Record<string, TopicMastery> = {};
  for (const key of scoredContentTopicKeys()) tm[key] = masteredBucket();
  tm[COMPETENCY_BRAINTEASER] = masteredBucket();
  for (const key of TRADING_SUBTOPIC_KEYS) tm[key] = masteredBucket();
  tm[tradingSubtopicByGame(weakGame).key] = weakBucket();
  p.topicMastery = tm;
  p.pipeline = {
    stage: "drilling",
    timed: {
      correct: 28,
      total: 30,
      sections: [{ label: "timed-diagnostic", correct: 28, total: 30 }],
    },
  };
  return p;
}

/**
 * The games the user asked about by name: market-making, the Zap-N cognitive
 * games (Stockmaster / Number Box / Shape Shift), NumberLogic, and Beat the
 * Odds. Each must re-drill its OWN game — not a generic numeric MCQ.
 */
const NAMED_GAMES: TradingGameId[] = [
  "make-market",
  "stockmaster",
  "number-box",
  "shape-shift",
  "numberlogic",
  "beat-the-odds",
];

describe("drilling — a weak game subtopic re-serves THAT game's station", () => {
  it.each(NAMED_GAMES)(
    "routes a weak %s subtopic back to its own Game-OA station (real engine, not a generic MCQ)",
    (game) => {
      const weakKey = tradingSubtopicByGame(game).key;
      const target = pickNextDrillTarget(onlyOneGameWeak(game));
      // The loop picks the trading metric and serves it as a game (not numeric).
      expect(target?.kind).toBe("trading");
      expect(target?.serve).toBe("trading");
      // …for the SPECIFIC weak subtopic node (so drilling knows which game).
      expect(target?.topicKey).toBe(weakKey);
      // …and that key resolves to the EXACT battery station for this game — the
      // same reusable game component the Stage-4 battery mounts.
      const station = stationForSubtopic(target!.topicKey!);
      expect(station?.gameId).toBe(game);
      expect(station?.Component).toBeTruthy();
    },
  );

  it("every one of the 11 trading subtopics resolves to a real, mountable game station", () => {
    for (const key of TRADING_SUBTOPIC_KEYS) {
      const station = stationForSubtopic(key);
      expect(station, `no station for ${key}`).toBeTruthy();
      expect(station!.Component).toBeTruthy();
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Battery driver (sequences stations, folds into the right subtopic)         */
/* -------------------------------------------------------------------------- */

describe("GameOaStage — the battery driver", () => {
  it("renders the intro listing every game and can start", async () => {
    renderStage(() => {});
    expect(screen.getByTestId("game-oa-stage")).toBeTruthy();
    // The intro lists all eleven games.
    expect(screen.getByText("Make a market")).toBeTruthy();
    expect(screen.getByText("Shape shift")).toBeTruthy();
    fireEvent.click(screen.getByTestId("battery-start"));
    // The first station (make-a-market) mounts.
    await waitFor(() =>
      expect(screen.getByTestId("make-market-station")).toBeTruthy(),
    );
  });

  it("folds the first game's rounds into its OWN subtopic and advances", async () => {
    renderStage(() => {});
    fireEvent.click(screen.getByTestId("battery-start"));
    await waitFor(() =>
      expect(screen.getByTestId("make-market-station")).toBeTruthy(),
    );
    expect(screen.getByTestId("spread-n").textContent).toBe("0");

    for (let i = 1; i <= MAKE_MARKET_ROUNDS; i++) {
      playMakeMarketRound(i === MAKE_MARKET_ROUNDS);
    }

    // Every round folded exactly one attempt into the make-market subtopic…
    expect(screen.getByTestId("spread-n").textContent).toBe(
      String(MAKE_MARKET_ROUNDS),
    );
    // …and the driver advanced to the next station (the trading floor).
    await waitFor(() =>
      expect(screen.getByTestId("trading-floor-station")).toBeTruthy(),
    );
  });
});
