import { useMemo, useRef, useState } from "react";
import { Rng } from "@/lib/rng";
import { FERMI_ITEMS, type FermiItem } from "@/content/fermi/items";
import {
  gradeFermi,
  formatFermiNumber,
  FERMI_BAND_COPY,
  type FermiGrade,
} from "@/lib/fermi/grader";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  StationProgress,
  freshSeed,
  useStationFold,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("fermi").key;

export const FERMI_ROUNDS = 6;

/**
 * Fermi estimation battery station — reuses the pure `gradeFermi` log-distance
 * grader over the numerically-verified `FERMI_ITEMS` bank and folds each item's
 * band credit (1 correct / 0.5 close / 0 off) into `competency::estimation`. The
 * partial-credit `grade.score` flows straight through {@link useStationFold}.
 */
export default function FermiStation({ onComplete }: StationProps) {
  const { record, summary } = useStationFold(SUBTOPIC);
  const items = useMemo<FermiItem[]>(() => {
    const rng = new Rng(freshSeed());
    const pool = FERMI_ITEMS.filter(
      (it) => it.factors.length >= 3 && it.factors.length <= 6,
    );
    return rng.shuffle(pool).slice(0, FERMI_ROUNDS);
  }, []);

  const [index, setIndex] = useState(0);
  const [raw, setRaw] = useState("");
  const [grade, setGrade] = useState<FermiGrade | null>(null);
  const creditRef = useRef(0);
  const doneRef = useRef(false);

  const item = items[index];
  const isLast = index >= items.length - 1;

  const submit = () => {
    if (grade) return;
    const g = gradeFermi(item.reference, raw);
    creditRef.current += g.score;
    record(g.score);
    setGrade(g);
  };

  const advance = () => {
    if (isLast) {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete(
        summary(
          `${creditRef.current.toFixed(1)} / ${items.length} est. credit`,
        ),
      );
      return;
    }
    setGrade(null);
    setRaw("");
    setIndex((n) => n + 1);
  };

  if (!item) return null;

  return (
    <div className="space-y-4" data-testid="fermi-station">
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
            onKeyDown={(e) => e.key === "Enter" && submit()}
            aria-label="estimate"
          />
          <button
            type="button"
            className="btn-primary w-full"
            onClick={submit}
            disabled={raw.trim() === ""}
          >
            Lock in estimate
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`verdict ${
              grade.band === "correct"
                ? "bg-bull text-bg"
                : grade.band === "close"
                  ? "bg-accent text-bg"
                  : "bg-bear text-bg"
            }`}
          >
            ● {FERMI_BAND_COPY[grade.band].label}
            {grade.factor != null && grade.band !== "correct"
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
