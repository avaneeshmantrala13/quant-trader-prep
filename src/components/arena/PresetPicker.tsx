import { useState } from "react";
import {
  CUSTOM_DEFAULT,
  OPTIVER_DEFAULT,
  WEAKSPOT_DEFAULT,
  ZETAMAC_DEFAULT,
  ZETAMAC_DURATIONS,
  type ArenaMode,
  type ArenaOp,
  type ArenaPack,
  type ArenaPreset,
} from "@/lib/arena/config";
import { perQuestionBudgetMs } from "@/lib/arena/budget";
import { auditPresetBudget } from "@/content/arena/oaFormats";

/** OA-format id each built-in mode mirrors (for the budget-parity audit). */
const MODE_OA_FORMAT: Partial<Record<ArenaMode, string>> = {
  optiver: "optiver-80-8",
};

/**
 * PresetPicker — thin view that lets the learner choose a built-in preset or
 * build a Custom preset. All scoring/timing logic lives in the pure `arena/*`
 * modules; this component only assembles an `ArenaPreset` and hands it up.
 */
const ALL_OPS: ArenaOp[] = ["add", "sub", "mul", "div"];
const ALL_PACKS: ArenaPack[] = ["int", "fraction", "decimal", "percent"];
const OP_LABEL: Record<ArenaOp, string> = {
  add: "+",
  sub: "−",
  mul: "×",
  div: "÷",
};

export function PresetPicker({
  onStart,
}: {
  onStart: (preset: ArenaPreset) => void;
}) {
  const [mode, setMode] = useState<ArenaMode>("zetamac");
  const [custom, setCustom] = useState<ArenaPreset>({ ...CUSTOM_DEFAULT });
  const [interview, setInterview] = useState(false);
  const [adaptive, setAdaptive] = useState(false);

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  /** Layer the interview pacing overlay onto whichever preset was chosen. */
  const withOverlay = (p: ArenaPreset): ArenaPreset => ({
    ...p,
    interview,
    adaptive: interview && adaptive,
    oaFormatId: MODE_OA_FORMAT[p.mode],
  });

  const start = () => {
    if (mode === "zetamac") return onStart(withOverlay({ ...ZETAMAC_DEFAULT }));
    if (mode === "optiver") return onStart(withOverlay({ ...OPTIVER_DEFAULT }));
    if (mode === "weakspot")
      return onStart(withOverlay({ ...WEAKSPOT_DEFAULT }));
    onStart(withOverlay({ ...custom }));
  };

  const selected =
    mode === "zetamac"
      ? ZETAMAC_DEFAULT
      : mode === "optiver"
        ? OPTIVER_DEFAULT
        : mode === "weakspot"
          ? WEAKSPOT_DEFAULT
          : custom;
  const budgetMs = perQuestionBudgetMs(selected);
  const oaId = MODE_OA_FORMAT[mode];
  const parity = oaId ? auditPresetBudget(oaId, budgetMs) : undefined;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["zetamac", "Zetamac", "120s · count · no penalty"],
            [
              "optiver",
              "Rapid-Fire Arithmetic Sprint",
              "80Q / 8:00 · +1 / −1 · skips free",
            ],
            [
              "weakspot",
              "Weak-Spot Trainer",
              "120s · over-samples your weakest ops",
            ],
            ["custom", "Custom", "Your ops, packs & clock"],
          ] as [ArenaMode, string, string][]
        ).map(([m, title, sub]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              "panel p-4 text-left transition-colors",
              mode === m
                ? "border-accent ring-1 ring-accent"
                : "hover:border-border-strong",
            ].join(" ")}
          >
            <div className="font-display text-lg font-bold text-primary">
              {title}
            </div>
            <div className="mt-1 text-xs text-secondary">{sub}</div>
          </button>
        ))}
      </div>

      {mode === "weakspot" && (
        <div className="panel-ruled space-y-1 p-3 text-xs text-muted">
          <span className="label text-[9px]">Adaptive drill</span>
          <p className="text-secondary">
            Buckets your past attempts by operation × operand size and
            over-samples the buckets you miss most, spending practice where it
            pays off. Same count-only scoring as Zetamac; only the question mix
            adapts.
          </p>
        </div>
      )}

      {mode === "custom" && (
        <div className="panel-ruled space-y-4 p-4">
          <div>
            <span className="label">Duration</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {ZETAMAC_DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setCustom({ ...custom, durationSec: d })}
                  className={`chip ${
                    custom.durationSec === d
                      ? "border-accent text-accent"
                      : "border-subtle text-secondary"
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Operations</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_OPS.map((op) => (
                <button
                  key={op}
                  onClick={() =>
                    setCustom({ ...custom, ops: toggle(custom.ops, op) })
                  }
                  className={`chip num ${
                    custom.ops.includes(op)
                      ? "border-accent text-accent"
                      : "border-subtle text-muted"
                  }`}
                >
                  {OP_LABEL[op]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Packs</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_PACKS.map((pack) => (
                <button
                  key={pack}
                  onClick={() =>
                    setCustom({ ...custom, packs: toggle(custom.packs, pack) })
                  }
                  className={`chip ${
                    custom.packs.includes(pack)
                      ? "border-accent text-accent"
                      : "border-subtle text-muted"
                  }`}
                >
                  {pack}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={custom.penalty}
              onChange={(e) =>
                setCustom({ ...custom, penalty: e.target.checked })
              }
            />
            Penalize wrong answers (+1 / −1)
          </label>
        </div>
      )}

      {/* Interview pacing overlay — Case B speed focus. Additive: it adds a
          per-question budget + live pacing feedback + speed stats; it never
          changes scoring or the leaderboard bucket. */}
      <div className="panel-ruled space-y-3 p-4">
        <label className="flex items-start gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={interview}
            onChange={(e) => setInterview(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold text-primary">Interview pacing</span>
            : per-question budget, live countdown, and speed stats (median solve,
            % within budget) at the end.
          </span>
        </label>

        {interview && (
          <>
            <label className="flex items-start gap-2 pl-6 text-sm text-secondary">
              <input
                type="checkbox"
                checked={adaptive}
                onChange={(e) => setAdaptive(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold text-primary">
                  Adaptive pressure
                </span>
                : tighten the budget as your accuracy stabilizes.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2 pl-6 text-xs text-muted">
              <span className="chip border-subtle text-[9px] uppercase">
                budget {(budgetMs / 1000).toFixed(1)}s/q
              </span>
              {parity && (
                <span
                  className={`chip text-[9px] uppercase ${
                    parity.faithful ? "border-bull text-bull" : "border-gold text-gold"
                  }`}
                >
                  {parity.faithful
                    ? "matches real OA pace"
                    : `${Math.round(parity.drift * 100)}% off OA pace`}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <button
        onClick={start}
        disabled={
          mode === "custom" &&
          (custom.ops.length === 0 || custom.packs.length === 0)
        }
        className="btn-primary w-full disabled:opacity-50"
      >
        Start run
      </button>
    </div>
  );
}
