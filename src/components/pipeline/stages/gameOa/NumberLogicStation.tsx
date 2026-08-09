import { useMemo } from "react";
import {
  buildNumberLogicPaper,
  DEFAULT_NUMBERLOGIC_BUDGET_MS,
  DEFAULT_NUMBERLOGIC_COUNT,
} from "@/lib/games/numberLogic/engine";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  TimedRapidMcqStation,
  useStationSeed,
  type McqRound,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("numberlogic").key;

/** Rounds played in the battery (a short slice of the full 26-item paper). */
export const NUMBERLOGIC_ROUNDS = 8;

/** Whole-run budget for this slice, scaled from the game's stand-alone clock. */
const BUDGET_MS = Math.round(
  (DEFAULT_NUMBERLOGIC_BUDGET_MS * NUMBERLOGIC_ROUNDS) / DEFAULT_NUMBERLOGIC_COUNT,
);

/**
 * NumberLogic battery station — reuses the pure `buildNumberLogicPaper` engine
 * (sequence pattern recognition) and folds each item's correctness into the
 * `competency::sequence-patterns` subtopic. Runs against the paper's whole-run
 * clock (its `DEFAULT_NUMBERLOGIC_BUDGET_MS` per `DEFAULT_NUMBERLOGIC_COUNT`,
 * scaled to this slice) via {@link TimedRapidMcqStation}: sequences stream
 * forward and any you don't reach before the buzzer count as misses.
 */
export default function NumberLogicStation({ onComplete, seed }: StationProps) {
  const mountSeed = useStationSeed(seed);
  const rounds = useMemo<McqRound[]>(() => {
    const items = buildNumberLogicPaper(mountSeed, NUMBERLOGIC_ROUNDS);
    return items.map((it) => ({
      id: it.id,
      tag: `Tier ${it.tier} · what comes next?`,
      prompt: (
        <span className="num tracking-wide">{it.terms.join(",  ")},  …</span>
      ),
      options: it.options.map((o) => <span className="num">{o}</span>),
      correctIndex: it.correctIndex,
      explanation: it.rule,
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
