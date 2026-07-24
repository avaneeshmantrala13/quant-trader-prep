/**
 * A rubber-stamp seal — the on-brand replacement for a generic "success" badge.
 * Slams in at a slight angle like an ink stamp on a settlement ticket.
 */
export function StampSeal({
  label,
  sub,
  tone = "bull",
}: {
  label: string;
  sub?: string;
  tone?: "bull" | "accent" | "bear";
}) {
  const color =
    tone === "bull"
      ? "text-bull"
      : tone === "bear"
        ? "text-bear"
        : "text-accent";
  const border =
    tone === "bull"
      ? "border-bull"
      : tone === "bear"
        ? "border-bear"
        : "border-accent";

  return (
    <div
      className={`animate-stamp-in inline-flex select-none flex-col items-center gap-1 border-[3px] px-6 py-3 ${border} ${color}`}
      style={{ boxShadow: "0 0 0 2px rgb(var(--color-surface)) inset" }}
    >
      <span className="font-mono text-2xl font-semibold uppercase tracking-label">
        {label}
      </span>
      {sub && (
        <span className="font-mono text-[10px] uppercase tracking-label opacity-80">
          {sub}
        </span>
      )}
    </div>
  );
}
