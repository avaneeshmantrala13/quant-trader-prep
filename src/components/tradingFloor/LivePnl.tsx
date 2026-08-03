/**
 * LivePnl + InventoryPill — the small, presentational readouts used in the
 * playing header: the running marked P&L (bull/bear toned) and a LONG / SHORT /
 * FLAT inventory pill. Kept token-only so they theme across light + dark.
 */
import { signed, pnlTone } from "./format";

export function LivePnl({ pnl }: { pnl: number }): JSX.Element {
  return (
    <div className="text-right">
      <span className="label text-[9px] text-muted">P&amp;L</span>
      <div className={`num text-lg font-black leading-none ${pnlTone(pnl)}`}>
        {signed(pnl)}
      </div>
    </div>
  );
}

export function InventoryPill({ inventory }: { inventory: number }): JSX.Element {
  const flat = inventory === 0;
  const long = inventory > 0;
  const cls = flat
    ? "border-subtle text-secondary"
    : long
      ? "border-bull text-bull"
      : "border-bear text-bear";
  return (
    <span className={`chip num ${cls}`} title="Your net inventory">
      {flat ? "FLAT" : long ? `LONG ${inventory}` : `SHORT ${Math.abs(inventory)}`}
    </span>
  );
}
