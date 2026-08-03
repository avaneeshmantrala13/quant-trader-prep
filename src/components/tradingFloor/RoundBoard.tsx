/**
 * RoundBoard — the prompt + information board for the current round. Purely
 * presentational: shows the scenario prompt, the latest reveal (highlighted),
 * the running reveal history, and — when the coach is on — the textbook fair +
 * posterior sd entering this round.
 */
import type { RevealInfo } from "@/lib/tradingFloor";
import { fmtNum, fmtPct } from "./format";

export interface CoachRead {
  fair: number;
  sd: number;
}

export interface RoundBoardProps {
  prompt: string;
  kind: "binary" | "quantity";
  unit: string;
  latestReveal?: RevealInfo;
  history: RevealInfo[];
  coach?: CoachRead | null;
}

export function RoundBoard(props: RoundBoardProps): JSX.Element {
  const { prompt, kind, unit, latestReveal, history, coach } = props;
  const binary = kind === "binary";
  const fmtFair = (v: number): string => (binary ? fmtPct(v) : fmtNum(v));

  // Everything revealed BEFORE the latest one (the running history).
  const prior = latestReveal
    ? history.filter((h) => h !== latestReveal)
    : history;

  return (
    <article className="panel-ruled p-5">
      <span className="label text-accent">Order flow</span>
      <h2 className="mt-2 font-display text-lg font-semibold leading-snug text-primary">
        {prompt}
      </h2>

      {latestReveal && (
        <div className="mt-4 border-l-4 border-accent bg-surface-muted px-4 py-3">
          <div className="label text-accent">Just revealed</div>
          <p className="num mt-1 text-base font-semibold text-primary">
            {latestReveal.label}
          </p>
          {latestReveal.detail && (
            <p className="mt-1 text-sm text-secondary">{latestReveal.detail}</p>
          )}
        </div>
      )}

      {coach && (
        <div className="mt-4 border border-dashed border-subtle bg-surface px-4 py-3">
          <div className="label text-accent">Coach · textbook read</div>
          <div className="mt-2 flex flex-wrap gap-4">
            <div>
              <div className="label text-[9px] text-muted">Fair value</div>
              <div className="num text-sm font-semibold text-primary">
                {fmtFair(coach.fair)}
                {!binary && unit ? ` ${unit}` : ""}
              </div>
            </div>
            <div>
              <div className="label text-[9px] text-muted">Posterior sd</div>
              <div className="num text-sm font-semibold text-primary">
                {binary ? coach.sd.toFixed(3) : fmtNum(coach.sd)}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            The honest desk centers here and quotes ≈ this sd wide. Beat it by
            being tighter where you're sure and wider where you're not.
          </p>
        </div>
      )}

      {prior.length > 0 && (
        <div className="mt-4">
          <div className="label text-muted">Revealed so far</div>
          <ul className="mt-2 divide-y divide-subtle">
            {prior.map((h, i) => (
              <li
                key={i}
                className="num flex items-center justify-between py-1.5 text-sm text-secondary"
              >
                <span className="text-muted">R{h.round + 1}</span>
                <span>{h.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
