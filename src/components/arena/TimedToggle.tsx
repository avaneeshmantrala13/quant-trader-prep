import { useEffect, useRef, useState } from "react";

/**
 * TimedToggle — a SELF-CONTAINED soft-timing overlay the arena owns (Phase 6).
 *
 * It shows a shrinking budget bar with a suggested time budget that NEVER
 * blocks, auto-submits, or fails a question — it is a gentle pacing cue only,
 * grounded in the speed-accuracy tradeoff (reasoning stays untimed by default).
 *
 * DEFERRED integration: mounting this on the LessonPage reasoning tabs would
 * touch a HOT file (owned serially by Phases 2/4), so per the spec + coordination
 * rules we do NOT wire it into LessonPage during the parallel run. This
 * component is shipped standalone so that follow-up is a one-line mount with no
 * logic change here. Anything using it is explicitly NOT leaderboard-eligible.
 */
export function TimedToggle({
  budgetSec,
  running = true,
  label = "Suggested pace",
}: {
  budgetSec: number;
  running?: boolean;
  label?: string;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [running, budgetSec]);

  const budgetMs = Math.max(1, budgetSec * 1000);
  const remaining = Math.max(0, 1 - elapsedMs / budgetMs);
  const over = elapsedMs > budgetMs;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <span className="label text-[9px]">{label}</span>
        <span className="label text-[9px] text-muted">
          {over ? "over budget — no rush" : `${Math.ceil((budgetMs - elapsedMs) / 1000)}s`}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-surface-muted">
        <div
          className={`h-full transition-[width] duration-100 ease-linear ${
            over ? "bg-warning" : "bg-accent"
          }`}
          style={{ width: `${remaining * 100}%` }}
        />
      </div>
    </div>
  );
}
