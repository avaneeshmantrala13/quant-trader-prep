import type { MasteryState } from "@/lib/mastery/verdict";

/**
 * STRONG / WEAK / UNCERTAIN badge (PHASE_5 §6). UNCERTAIN is FIRST-CLASS — it
 * has its own accent styling and is NEVER rounded to STRONG or WEAK.
 */
const BADGE: Record<
  MasteryState,
  { label: string; glyph: string; cls: string }
> = {
  STRONG: { label: "Strong", glyph: "▲", cls: "border-bull text-bull" },
  WEAK: { label: "Weak", glyph: "▼", cls: "border-bear text-bear" },
  UNCERTAIN: { label: "Uncertain", glyph: "◆", cls: "border-accent text-accent" },
};

export function MasteryBadge({ state }: { state: MasteryState }) {
  const b = BADGE[state];
  return (
    <span className={`chip ${b.cls}`} title={`${b.label} — calibration-aware verdict`}>
      <span aria-hidden="true" className="mr-1">
        {b.glyph}
      </span>
      {b.label}
    </span>
  );
}
