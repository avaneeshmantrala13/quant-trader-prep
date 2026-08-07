/**
 * QuotePad — the four levers a maker posts each round: mid, half-spread, skew,
 * and size. Fully controlled/presentational (owns only its own input strings),
 * so it renders without any app providers and is unit-testable in isolation.
 *
 * It shows a LIVE two-sided readout `[ bid ⟷ ask ]` derived exactly like the
 * engine's maker quote: center = mid − skew·inventory, bid = center − half,
 * ask = center + half. For BINARY packs the mid/half are entered as PERCENT
 * probabilities (0–100) and converted to [0,1] fractions on submit — the mid IS
 * your stated probability.
 */
import { useState } from "react";
import type { UserQuote } from "@/lib/tradingFloor";
import { fmtNum, fmtPct } from "./format";

export interface QuotePadDefaults {
  mid?: string;
  half?: string;
  skew?: string;
  size?: string;
}

export interface QuotePadProps {
  kind: "binary" | "quantity";
  /** Unit label for quantity packs (e.g. "pips"); "" for binary. */
  unit: string;
  /** Max quote size the config allows. */
  maxSize: number;
  /** Current signed inventory (drives the skew term in the readout). */
  inventory: number;
  onSubmit: (quote: UserQuote) => void;
  disabled?: boolean;
  /** Seed the pad's inputs in DISPLAY units (percent for binary mids). */
  defaults?: QuotePadDefaults;
}

const num = (s: string): number => parseFloat(s.replace(/,/g, ""));

export function QuotePad(props: QuotePadProps): JSX.Element {
  const { kind, unit, maxSize, inventory, onSubmit, disabled, defaults } = props;
  const binary = kind === "binary";

  const [mid, setMid] = useState(defaults?.mid ?? "");
  const [half, setHalf] = useState(defaults?.half ?? (binary ? "8" : "1"));
  const [skew, setSkew] = useState(defaults?.skew ?? "0");
  const [size, setSize] = useState(defaults?.size ?? "1");

  const midNum = num(mid);
  const halfNum = num(half);
  const skewNum = Number.isFinite(num(skew)) ? num(skew) : 0;
  const valid =
    Number.isFinite(midNum) && Number.isFinite(halfNum) && halfNum >= 0;

  // Display → fraction (binary mids/halves are percents; quantity are raw).
  const toFrac = (x: number): number => (binary ? x / 100 : x);
  const fracMid = toFrac(midNum);
  const fracHalf = toFrac(halfNum);
  const center = fracMid - skewNum * inventory;
  const bid = center - fracHalf;
  const ask = center + fracHalf;

  const fmtSide = (frac: number): string => (binary ? fmtPct(frac) : fmtNum(frac));

  const submit = () => {
    if (disabled || !valid) return;
    const sizeNum = Math.max(
      0,
      Math.min(maxSize, Math.round(Number.isFinite(num(size)) ? num(size) : 0)),
    );
    onSubmit({ mid: fracMid, half: fracHalf, skew: skewNum, size: sizeNum });
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit();
  };

  const midLabel = binary ? "Probability: your mid (%)" : `Mid: fair value (${unit})`;
  const halfLabel = binary ? "Half-spread (%)" : `Half-spread (${unit})`;

  return (
    <article className="panel-ruled p-5">
      <div className="flex items-center justify-between">
        <span className="label text-accent">Your quote</span>
        <span className="label text-muted">size ≤ {maxSize}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label mb-1 block text-secondary">{midLabel}</span>
          <input
            className="input num"
            inputMode="decimal"
            value={mid}
            disabled={disabled}
            onChange={(e) => setMid(e.target.value)}
            onKeyDown={onKey}
            placeholder={binary ? "e.g. 50" : "e.g. 28"}
            aria-label="mid"
          />
        </label>
        <label className="block">
          <span className="label mb-1 block text-secondary">{halfLabel}</span>
          <input
            className="input num"
            inputMode="decimal"
            value={half}
            disabled={disabled}
            onChange={(e) => setHalf(e.target.value)}
            onKeyDown={onKey}
            placeholder={binary ? "e.g. 8" : "e.g. 2"}
            aria-label="half-spread"
          />
        </label>
        <label className="block">
          <span className="label mb-1 block text-secondary">Inventory skew</span>
          <input
            className="input num"
            inputMode="decimal"
            value={skew}
            disabled={disabled}
            onChange={(e) => setSkew(e.target.value)}
            onKeyDown={onKey}
            placeholder="0"
            aria-label="skew"
          />
        </label>
        <label className="block">
          <span className="label mb-1 block text-secondary">Size (max {maxSize})</span>
          <input
            className="input num"
            inputMode="numeric"
            value={size}
            disabled={disabled}
            onChange={(e) => setSize(e.target.value)}
            onKeyDown={onKey}
            placeholder="1"
            aria-label="size"
          />
        </label>
      </div>

      {/* Live two-sided readout: [ bid ⟷ ask ] */}
      <div className="mt-4 flex items-center justify-center gap-3 border border-subtle bg-surface-muted px-4 py-3">
        {valid ? (
          <span className="num text-lg font-semibold">
            <span className="text-muted">[ </span>
            <span className="text-bull" aria-label="bid">
              {fmtSide(bid)}
            </span>
            <span className="mx-2 text-muted">⟷</span>
            <span className="text-bear" aria-label="ask">
              {fmtSide(ask)}
            </span>
            <span className="text-muted"> ]</span>
          </span>
        ) : (
          <span className="num text-lg font-semibold text-muted">[ — ⟷ — ]</span>
        )}
      </div>
      {skewNum !== 0 && inventory !== 0 ? (
        <p className="mt-1 text-center text-[11px] text-muted">
          Skewed off a {inventory > 0 ? "long" : "short"} book to lean your market.
        </p>
      ) : null}

      {!disabled && (
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="btn-primary mt-4 w-full"
        >
          Quote market
        </button>
      )}
    </article>
  );
}
