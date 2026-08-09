import { useMemo } from "react";
import {
  buildShapeShiftPaper,
  DEFAULT_SHAPESHIFT_BUDGET_MS,
  DEFAULT_SHAPESHIFT_COUNT,
  type Shape,
} from "@/lib/games/shapeShift/engine";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  TimedRapidMcqStation,
  useStationSeed,
  type McqRound,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("shape-shift").key;

export const SHAPESHIFT_ROUNDS = 8;

/** Whole-run budget for this slice, scaled from the game's stand-alone clock. */
const BUDGET_MS = Math.round(
  (DEFAULT_SHAPESHIFT_BUDGET_MS * SHAPESHIFT_ROUNDS) / DEFAULT_SHAPESHIFT_COUNT,
);

/** Render a normalized {@link Shape} as a small filled/empty cell grid. */
function ShapeGrid({ shape, size = 12 }: { shape: Shape; size?: number }) {
  const filled = new Set(shape.cells.map((c) => `${c.r},${c.c}`));
  return (
    <span
      className="inline-grid gap-px"
      style={{
        gridTemplateColumns: `repeat(${shape.cols}, ${size}px)`,
        gridTemplateRows: `repeat(${shape.rows}, ${size}px)`,
      }}
      aria-hidden
    >
      {Array.from({ length: shape.rows }).map((_, r) =>
        Array.from({ length: shape.cols }).map((__, c) => (
          <span
            key={`${r},${c}`}
            className={
              filled.has(`${r},${c}`)
                ? "rounded-[2px] bg-accent"
                : "rounded-[2px] bg-surface"
            }
            style={{ width: size, height: size }}
          />
        )),
      )}
    </span>
  );
}

/**
 * Shape Shift battery station — reuses `buildShapeShiftPaper` (mental rotation)
 * and folds each item into `competency::mental-rotation`. Options are rendered
 * as small shape grids in a five-wide row. Runs against the game's whole-run
 * clock (its `DEFAULT_SHAPESHIFT_BUDGET_MS` per `DEFAULT_SHAPESHIFT_COUNT`,
 * scaled to this slice) via {@link TimedRapidMcqStation}: shapes stream forward
 * and any you don't reach before the buzzer count as misses.
 */
export default function ShapeShiftStation({ onComplete, seed }: StationProps) {
  const mountSeed = useStationSeed(seed);
  const rounds = useMemo<McqRound[]>(() => {
    const items = buildShapeShiftPaper(mountSeed, SHAPESHIFT_ROUNDS);
    return items.map((it) => ({
      id: it.id,
      tag: `Tier ${it.tier} · ${it.transformLabel}`,
      prompt: (
        <span className="flex items-center gap-4">
          <ShapeGrid shape={it.base} size={16} />
          <span className="text-sm font-normal text-secondary">
            → {it.transformLabel.toLowerCase()} → which one?
          </span>
        </span>
      ),
      options: it.options.map((s) => <ShapeGrid shape={s} />),
      correctIndex: it.correctIndex,
    }));
  }, [mountSeed]);

  return (
    <TimedRapidMcqStation
      subtopicKey={SUBTOPIC}
      rounds={rounds}
      budgetMs={BUDGET_MS}
      optionLayout="grid"
      onComplete={onComplete}
    />
  );
}
