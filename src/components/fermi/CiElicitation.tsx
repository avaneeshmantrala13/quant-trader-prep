import { useRef, useState } from "react";
import {
  parseFermiInput,
  formatFermiNumber,
  type FermiIntervalGrade,
} from "@/lib/fermi/grader";
import type { FermiItem } from "@/content/fermi/items";

/**
 * The "90% CI in 60s" elicitation control — the calibration-mode counterpart to
 * the point-estimate input on the Fermi drill. Instead of one number the learner
 * commits a LOW and HIGH bound they're 90% sure brackets the truth; the page
 * grades that range with the Winkler interval score and logs the binary
 * hit/miss as a (0.9, hit) calibration pair.
 *
 * Fully keyboard-accessible: both bounds are real labeled `<input>`s inside a
 * `<fieldset>`/`<legend>` group, Enter submits from either field, errors are
 * announced via `role="alert"` + `aria-invalid`, and focus jumps to the first
 * offending field. Styling is token-only so it renders in every theme, light or
 * dark. Parsing reuses the shared `parseFermiInput`, so `300k`, `3e5`, and
 * `$1.2m` all work exactly as in point mode.
 */
export function CiElicitation({
  item,
  grade,
  onSubmit,
}: {
  item: FermiItem;
  /** Non-null once answered — locks the inputs and shows the committed bounds. */
  grade: FermiIntervalGrade | null;
  /** Fires with the two parsed, positive bounds; the page grades + logs them. */
  onSubmit: (lo: number, hi: number) => void;
}) {
  const [loRaw, setLoRaw] = useState("");
  const [hiRaw, setHiRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const loRef = useRef<HTMLInputElement>(null);
  const hiRef = useRef<HTMLInputElement>(null);

  const answered = grade !== null;
  const money = !!item.money;

  const handleSubmit = () => {
    if (answered) return;
    const lo = parseFermiInput(loRaw);
    const hi = parseFermiInput(hiRaw);
    if (lo === null || lo <= 0) {
      setError("Enter a positive lower bound — e.g. 300000, 300k, or 3e5.");
      loRef.current?.focus();
      return;
    }
    if (hi === null || hi <= 0) {
      setError("Enter a positive upper bound — e.g. 3m, 3e6, or 3,000,000.");
      hiRef.current?.focus();
      return;
    }
    setError(null);
    onSubmit(lo, hi);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const loId = `fermi-ci-lo-${item.id}`;
  const hiId = `fermi-ci-hi-${item.id}`;
  const errId = `fermi-ci-err-${item.id}`;

  return (
    <div className="panel p-5">
      <fieldset
        className="min-w-0 border-0 p-0"
        disabled={answered}
        aria-describedby={error ? errId : undefined}
      >
        <legend className="label text-accent">
          Your 90% confidence interval
          <span className="ml-1 lowercase text-muted">({item.unit})</span>
        </legend>

        <p className="mt-1 text-xs text-muted">
          Pick a range you're{" "}
          <span className="font-semibold text-primary">90% sure</span> contains
          the truth — wide enough to be right ~9 times in 10, tight enough to
          still say something.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Lower bound */}
          <div>
            <label htmlFor={loId} className="label text-secondary">
              Low (P5)
            </label>
            <div className="mt-1 flex items-center border-2 border-border-strong bg-surface focus-within:border-accent">
              {money && (
                <span className="px-3 font-mono text-lg font-semibold text-secondary">
                  $
                </span>
              )}
              <input
                id={loId}
                ref={loRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={
                  answered
                    ? (grade?.lo ?? "").toLocaleString("en-US")
                    : loRaw
                }
                onChange={(e) => {
                  setLoRaw(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={onKeyDown}
                placeholder="e.g. 100k"
                aria-label={`Lower bound for ${item.quantity}`}
                aria-invalid={error && parseFermiInput(loRaw) === null ? true : undefined}
                className={`num min-h-[44px] w-full bg-transparent py-2 pr-3 text-lg font-semibold text-primary outline-none disabled:opacity-70 ${money ? "" : "pl-3"}`}
              />
            </div>
          </div>

          {/* Upper bound */}
          <div>
            <label htmlFor={hiId} className="label text-secondary">
              High (P95)
            </label>
            <div className="mt-1 flex items-center border-2 border-border-strong bg-surface focus-within:border-accent">
              {money && (
                <span className="px-3 font-mono text-lg font-semibold text-secondary">
                  $
                </span>
              )}
              <input
                id={hiId}
                ref={hiRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={
                  answered
                    ? (grade?.hi ?? "").toLocaleString("en-US")
                    : hiRaw
                }
                onChange={(e) => {
                  setHiRaw(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={onKeyDown}
                placeholder="e.g. 3m"
                aria-label={`Upper bound for ${item.quantity}`}
                aria-invalid={error && parseFermiInput(hiRaw) === null ? true : undefined}
                className={`num min-h-[44px] w-full bg-transparent py-2 pr-3 text-lg font-semibold text-primary outline-none disabled:opacity-70 ${money ? "" : "pl-3"}`}
              />
            </div>
          </div>
        </div>
      </fieldset>

      {error && (
        <p id={errId} className="mt-2 text-sm text-bear" role="alert">
          {error}
        </p>
      )}

      {!answered ? (
        <button onClick={handleSubmit} className="btn-primary mt-3 w-full">
          Lock In Range ▸
        </button>
      ) : (
        <p className="mt-3 text-xs text-muted">
          You said{" "}
          <span className="num font-semibold text-primary">
            {formatFermiNumber(grade?.lo ?? 0, { money })}
          </span>{" "}
          to{" "}
          <span className="num font-semibold text-primary">
            {formatFermiNumber(grade?.hi ?? 0, { money })}
          </span>
          .
        </p>
      )}
    </div>
  );
}
