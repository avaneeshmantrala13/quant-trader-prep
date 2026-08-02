import { Link } from "react-router-dom";
import { MOTIF_ICON } from "@/components/icons";

/**
 * Bespoke, quant-flavored feature visuals for the landing page. All are pure
 * SVG/DOM built on the app's semantic tokens, so they render correctly in both
 * the newsprint (light) and terminal (dark) themes and stay crisp at any size.
 */

function PanelHead({ tag, right }: { tag: string; right?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-subtle px-3 py-2">
      <span className="label">{tag}</span>
      {right && <span className="label text-[9px]">{right}</span>}
    </div>
  );
}

/* ---------- 1. Candy-Crush charted roadmap ---------- */
export function RoadmapVisual() {
  const nodes = [
    { x: 18, y: 78, s: "done" },
    { x: 40, y: 58, s: "done" },
    { x: 58, y: 70, s: "live" },
    { x: 76, y: 44, s: "lock" },
    { x: 88, y: 22, s: "lock" },
  ] as const;
  const color = (s: string) =>
    s === "done"
      ? "rgb(var(--color-bull))"
      : s === "live"
        ? "rgb(var(--color-accent))"
        : "rgb(var(--color-border-strong))";
  return (
    <div className="panel overflow-hidden">
      <PanelHead tag="The Route" right="Y·Mastery  X·Progression →" />
      <div className="tex-grid relative aspect-[4/3] w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {nodes.slice(0, -1).map((n, i) => {
            const nx = nodes[i + 1];
            return (
              <line
                key={i}
                x1={n.x}
                y1={n.y}
                x2={nx.x}
                y2={nx.y}
                stroke={color(n.s)}
                strokeWidth={2}
                strokeDasharray={n.s === "lock" ? "2 4" : undefined}
                strokeOpacity={n.s === "lock" ? 0.6 : 0.95}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        {nodes.map((n, i) => (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
          >
            <div
              className={`grid h-9 w-9 place-items-center border-2 font-mono text-xs font-semibold ${
                n.s === "done"
                  ? "border-bull bg-bull text-bg"
                  : n.s === "live"
                    ? "border-accent bg-surface text-accent"
                    : "border-subtle bg-surface-muted text-muted"
              }`}
            >
              {n.s === "done" ? "✓" : n.s === "lock" ? "" : String(i + 1).padStart(2, "0")}
              {n.s === "lock" && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              )}
              {n.s === "live" && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-blink bg-accent" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 2. Socratic tutor: hint ladder ---------- */
export function TutorVisual() {
  const rungs = [
    { who: "You", t: "I'm stuck on P(at least one six in 4 rolls)." },
    { who: "Tutor", t: "What's the opposite of “at least one”?" },
    { who: "You", t: "…none at all?" },
    { who: "Tutor", t: "Right. So compute P(none) first — then?" },
  ];
  return (
    <div className="panel overflow-hidden">
      <PanelHead tag="Socratic Tutor" right="Hints · Never the answer" />
      <div className="space-y-2 p-3">
        {rungs.map((r, i) => {
          const tutor = r.who === "Tutor";
          return (
            <div key={i} className={`flex ${tutor ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] border px-3 py-1.5 ${
                  tutor
                    ? "border-accent bg-surface-muted"
                    : "border-subtle bg-surface"
                }`}
              >
                <div className={`label text-[8px] ${tutor ? "text-accent" : ""}`}>{r.who}</div>
                <div className="mt-0.5 text-[13px] leading-snug text-primary">{r.t}</div>
              </div>
            </div>
          );
        })}
        <div className="flex justify-start">
          <div className="border border-dashed border-subtle bg-surface px-3 py-1.5">
            <div className="label text-[8px]">Answer</div>
            <div className="mt-0.5 font-mono text-[13px] tracking-widest text-muted">
              ██████ withheld
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 3. Fresh, verifier-checked questions ---------- */
export function FreshVisual() {
  return (
    <div className="relative">
      {/* ghost variants behind */}
      <div className="absolute inset-0 translate-x-2 translate-y-2 panel opacity-40" />
      <div className="absolute inset-0 translate-x-1 translate-y-1 panel opacity-70" />
      <div className="panel relative overflow-hidden">
        <PanelHead tag="Fresh Instance" right="Seed #48213 ↻" />
        <div className="space-y-3 p-4">
          <p className="font-display text-base font-semibold leading-snug text-primary">
            A fair coin is flipped 5 times. P(exactly 2 heads)?
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {["0.3125", "0.0313", "0.4000", "0.2500"].map((c, i) => (
              <div
                key={i}
                className={`border px-2 py-1.5 font-mono text-xs ${
                  i === 0 ? "border-bull bg-success-soft text-primary" : "border-subtle text-secondary"
                }`}
              >
                {String.fromCharCode(65 + i)}. {c}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-subtle pt-2">
            <span className="label text-bull">✓ Verifier-checked</span>
            <span className="label text-[9px]">Regenerates forever</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 4. Full curriculum coverage ---------- */
export function CurriculumVisual({ linked = false }: { linked?: boolean }) {
  const mods = [
    { motif: "probability" as const, id: "probability", name: "Probability", n: "5 levels" },
    { motif: "mentalMath" as const, id: "mental-math", name: "Mental Math", n: "4 levels" },
    { motif: "brainteasers" as const, id: "brainteasers", name: "Brainteasers", n: "6 levels" },
    { motif: "interviewGames" as const, id: "interview-games", name: "Interview Games", n: "5 levels" },
  ];
  return (
    <div className="panel overflow-hidden">
      <PanelHead tag="Coverage" right={linked ? "Tap to enter →" : "OA · Technical · Superday"} />
      <div className="grid grid-cols-2">
        {mods.map((m, i) => {
          const Icon = MOTIF_ICON[m.motif];
          const cls = `flex items-center gap-3 p-4 ${i % 2 === 0 ? "border-r border-subtle" : ""} ${i < 2 ? "border-b border-subtle" : ""} ${linked ? "transition-colors hover:bg-surface-muted" : ""}`;
          const inner = (
            <>
              <span className="grid h-10 w-10 shrink-0 place-items-center border border-border-strong text-primary">
                <Icon width={22} height={22} />
              </span>
              <div>
                <div className="font-display text-sm font-semibold text-primary">{m.name}</div>
                <div className="num text-[11px] text-muted">{m.n}</div>
              </div>
            </>
          );
          return linked ? (
            <Link key={m.name} to={`/track/${m.id}`} className={cls}>
              {inner}
            </Link>
          ) : (
            <div key={m.name} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 5. Mental-math speed drill ---------- */
export function MentalMathVisual() {
  const sums = ["47 × 8", "816 ÷ 12", "23 × 41", "18% of 250", "3/8 = ?", "7:1 → P?"];
  return (
    <div className="panel overflow-hidden">
      <PanelHead tag="Speed Drill" right="80 in 8:00" />
      <div className="flex items-center gap-4 p-4">
        {/* countdown ring */}
        <div className="relative grid h-20 w-20 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(var(--color-border))" strokeWidth="2" />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="rgb(var(--color-accent))"
              strokeWidth="2"
              strokeDasharray="100"
              strokeDashoffset="28"
              strokeLinecap="round"
            />
          </svg>
          <span className="num text-lg font-semibold text-primary">0:07</span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          {sums.map((s, i) => (
            <div
              key={i}
              className={`border px-2 py-1.5 text-center font-mono text-xs ${
                i === 0 ? "border-accent text-accent" : "border-subtle text-secondary"
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
