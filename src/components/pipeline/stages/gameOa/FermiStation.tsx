import { useMemo, useRef, useState } from "react";
import {
  buildFermiDrill,
  type GeneratedFermiItem,
} from "@/content/games/fermiGenerators";
import {
  gradeFermi,
  formatFermiNumber,
  FERMI_BAND_COPY,
  type FermiGrade,
} from "@/lib/fermi/grader";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  StationProgress,
  TimerBar,
  useShotClock,
  useStationFold,
  useStationSeed,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("fermi").key;

export const FERMI_ROUNDS = 6;

/**
 * Per-estimate shot clock, consistent with the stand-alone Fermi timed mode
 * ("90% CI in 60s") and the other timed battery stations: a live countdown per
 * item, and letting it lapse auto-commits a MISS.
 */
export const FERMI_ITEM_BUDGET_MS = 60_000;

/**
 * Fermi estimation battery station — now draws FRESH parametric estimates from
 * `buildFermiDrill` (sampled factors whose coded product is the graded
 * reference) instead of a static pool, and runs LIVE against a per-estimate shot
 * clock. The pure `gradeFermi` log-distance grader folds each item's band credit
 * (1 correct / 0.5 close / 0 off) into `competency::estimation`; a per-item
 * TIMEOUT auto-commits a miss (credit 0), so slow estimation is penalised like
 * the other timed stations.
 */
export default function FermiStation({ onComplete, seed }: StationProps) {
  const { record, summary } = useStationFold(SUBTOPIC);
  const mountSeed = useStationSeed(seed);
  const items = useMemo<GeneratedFermiItem[]>(
    () => buildFermiDrill(mountSeed, FERMI_ROUNDS),
    [mountSeed],
  );

  const [index, setIndex] = useState(0);
  const [raw, setRaw] = useState("");
  const [grade, setGrade] = useState<FermiGrade | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const creditRef = useRef(0);
  const doneRef = useRef(false);

  const item = items[index];
  const isLast = index >= items.length - 1;

  const commit = (expired: boolean) => {
    if (grade || !item) return;
    // A timeout grades an empty entry (score 0); an answer grades the entry.
    const g = gradeFermi(item.reference, expired ? "" : raw);
    creditRef.current += g.score;
    record(g.score);
    setTimedOut(expired);
    setGrade(g);
  };

  const clock = useShotClock({
    durationMs: FERMI_ITEM_BUDGET_MS,
    running: grade === null && !doneRef.current && !!item,
    resetKey: index,
    onExpire: () => commit(true),
  });

  const advance = () => {
    if (isLast) {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete(
        summary(`${creditRef.current.toFixed(1)} / ${items.length} est. credit`),
      );
      return;
    }
    setGrade(null);
    setTimedOut(false);
    setRaw("");
    setIndex((n) => n + 1);
  };

  if (!item) return null;

  return (
    <div className="space-y-4" data-testid="fermi-station">
      {grade === null && (
        <TimerBar remainingMs={clock.remainingMs} durationMs={FERMI_ITEM_BUDGET_MS} />
      )}
      <StationProgress index={index} total={items.length} label="Estimate" />

      <div className="panel-ruled p-5">
        <span className="label text-accent">{item.category}</span>
        <h3 className="mt-1 font-display text-lg font-semibold leading-snug text-primary">
          {item.prompt}
        </h3>
        <p className="mt-2 text-xs text-muted">
          Answer in <span className="text-secondary">{item.unit}</span>
          {item.money ? " (dollars)" : ""}
        </p>
      </div>

      {grade === null ? (
        <div className="space-y-3">
          <input
            className="input w-full"
            inputMode="decimal"
            placeholder="e.g. 300k, 1.5m, 9e6"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit(false)}
            aria-label="estimate"
          />
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => commit(false)}
            disabled={raw.trim() === ""}
          >
            Lock in estimate
          </button>
          <p className="text-center text-xs text-muted">
            Beat the clock — an estimate you don't lock in counts as a miss.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`verdict ${
              timedOut
                ? "bg-bear text-bg"
                : grade.band === "correct"
                  ? "bg-bull text-bg"
                  : grade.band === "close"
                    ? "bg-accent text-bg"
                    : "bg-bear text-bg"
            }`}
          >
            {timedOut ? "● Out of time" : `● ${FERMI_BAND_COPY[grade.band].label}`}
            {!timedOut && grade.factor != null && grade.band !== "correct"
              ? ` — ${grade.factor.toFixed(1)}× off`
              : ""}
          </div>
          <p className="reveal text-secondary">
            Reference ≈{" "}
            <span className="num text-primary">
              {formatFermiNumber(item.reference, { money: item.money })}
            </span>
            . {item.takeaway}
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={advance}
            data-testid="station-advance"
          >
            {isLast ? "Finish game →" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}
