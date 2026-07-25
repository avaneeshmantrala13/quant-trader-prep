import { useState } from "react";
import {
  CUSTOM_DEFAULT,
  OPTIVER_DEFAULT,
  ZETAMAC_DEFAULT,
  ZETAMAC_DURATIONS,
  type ArenaMode,
  type ArenaOp,
  type ArenaPack,
  type ArenaPreset,
} from "@/lib/arena/config";
import { firmFormatFor, firmSummary } from "@/content/arena/firmFormats";

/**
 * PresetPicker — thin view that lets the learner choose Zetamac / Optiver, or
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

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const start = () => {
    if (mode === "zetamac") return onStart({ ...ZETAMAC_DEFAULT });
    if (mode === "optiver") return onStart({ ...OPTIVER_DEFAULT });
    onStart({ ...custom });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["zetamac", "Zetamac", "120s · count · no penalty"],
            [
              "optiver",
              "80/8 Mental-Math Sprint",
              "80Q / 8:00 · +1 / −1 · skips free",
            ],
            ["custom", "Custom", "Your ops, packs & clock"],
          ] as [ArenaMode, string, string][]
        ).map(([m, title, sub]) => {
          const attribution = firmFormatFor(m);
          return (
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
              {attribution && (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <span className="chip border-subtle text-[9px] uppercase text-muted">
                    community-reported
                  </span>
                  <span className="text-[10px] text-muted">
                    {firmSummary(attribution)}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Firm attribution lives in the dated `firmFormats` data layer, never
          baked into this component as fact. Shown for the selected mode and
          clearly flagged as community lore that may be stale. */}
      {(() => {
        const attribution = firmFormatFor(mode);
        if (!attribution) return null;
        return (
          <div className="panel-ruled space-y-1 p-3 text-xs text-muted">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label text-[9px]">Format attribution</span>
              <span className="chip border-subtle text-[9px] uppercase text-muted">
                confidence: {attribution.confidence}
              </span>
              <span className="chip border-subtle text-[9px] uppercase text-muted">
                as of {attribution.asOf}
              </span>
            </div>
            <p className="text-secondary">{firmSummary(attribution)}.</p>
            <p>{attribution.caveat}</p>
          </div>
        );
      })()}

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
