import { useMemo } from "react";
import {
  buildNumberBoxPaper,
  DEFAULT_NUMBERBOX_BUDGET_MS,
  DEFAULT_NUMBERBOX_COUNT,
} from "@/lib/games/numberBox/engine";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  TimedRapidMcqStation,
  useStationSeed,
  type McqRound,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("number-box").key;

export const NUMBERBOX_ROUNDS = 8;

/** Whole-run budget for this slice, scaled from the game's stand-alone clock. */
const BUDGET_MS = Math.round(
  (DEFAULT_NUMBERBOX_BUDGET_MS * NUMBERBOX_ROUNDS) / DEFAULT_NUMBERBOX_COUNT,
);

/**
 * Number Box battery station — reuses `buildNumberBoxPaper` (rapid modular
 * arithmetic) and folds each item into `competency::modular-arithmetic`. Runs
 * against the game's whole-run clock (its `DEFAULT_NUMBERBOX_BUDGET_MS` per
 * `DEFAULT_NUMBERBOX_COUNT`, scaled to this slice) via {@link TimedRapidMcqStation}:
 * items stream forward and any you don't reach before the buzzer count as misses.
 */
export default function NumberBoxStation({ onComplete, seed }: StationProps) {
  const mountSeed = useStationSeed(seed);
  const rounds = useMemo<McqRound[]>(() => {
    const items = buildNumberBoxPaper(mountSeed, NUMBERBOX_ROUNDS);
    return items.map((it) => ({
      id: it.id,
      tag: `Tier ${it.tier} · mod ${it.modulus}`,
      prompt: <span className="num">{it.prompt}</span>,
      options: it.options.map((o) => <span className="num">{o}</span>),
      correctIndex: it.correctIndex,
      explanation: it.explanation,
    }));
  }, [mountSeed]);

  return (
    <TimedRapidMcqStation
      subtopicKey={SUBTOPIC}
      rounds={rounds}
      budgetMs={BUDGET_MS}
      onComplete={onComplete}
    />
  );
}
