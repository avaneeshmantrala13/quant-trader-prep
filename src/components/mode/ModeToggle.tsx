import { useProgress } from "@/context/ProgressContext";
import { GOAL_MODES, MODE_META, resolveGoalMode } from "@/lib/mode/goalMode";
import type { GoalMode } from "@/types/progress";

/**
 * Two-way Goal-Mode segmented control (Course mastery ⇄ Interview prep). Reads +
 * writes ONLY `goalMode` via the progress context, so switching is instant and
 * non-destructive — all mastery/level/streak/xp state is untouched and shared
 * across the toggle. Appears in the AppShell header meta-bar and on the
 * dashboard. `size="sm"` renders the compact header variant.
 */
export function ModeToggle({
  size = "md",
  onSwitched,
}: {
  size?: "sm" | "md";
  onSwitched?: (mode: GoalMode) => void;
}) {
  const { progress, setGoalMode } = useProgress();
  const active = resolveGoalMode(progress);
  const compact = size === "sm";

  return (
    <div
      role="radiogroup"
      aria-label="Goal mode"
      className={`inline-flex items-center rounded-sm border border-subtle bg-surface-muted ${
        compact ? "p-0.5" : "p-1"
      }`}
    >
      {GOAL_MODES.map((mode) => {
        const selected = mode === active;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (mode === active) return;
              setGoalMode(mode);
              onSwitched?.(mode);
            }}
            title={MODE_META[mode].blurb}
            className={[
              "label whitespace-nowrap rounded-[3px] transition-colors",
              compact ? "px-2 py-1 text-[9px]" : "px-3 py-1.5 text-[10px]",
              selected
                ? "bg-accent text-accent-contrast"
                : "text-secondary hover:text-primary",
            ].join(" ")}
          >
            {MODE_META[mode].label}
          </button>
        );
      })}
    </div>
  );
}
