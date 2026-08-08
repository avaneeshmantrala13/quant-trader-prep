import { useEffect, useRef } from "react";
import { useProgress } from "@/context/ProgressContext";
import { celebrate } from "@/lib/celebrate";
import { mockPassStreak } from "@/lib/pipeline/mockLoop";
import type { StageComponentProps } from "../stageRegistry";

/**
 * ============================================================================
 *  STAGE 8 — GREENLIGHT  (guided pipeline, Phase P7 — the terminal stage)
 * ============================================================================
 * The celebratory, TERMINAL screen shown once every gate is cleared (spec §2
 * Stage 8): the untimed + timed diagnostics, the trading-intuition game, the
 * drilling loop (all content nodes at 0.80, timed sections at 0.90, both
 * competencies), and the mock gate (≥90% on 3 consecutive mocks). Reaching it
 * means the pipeline resolved to `greenlight`, which only happens when
 * `passesMockGate` (and every upstream gate) holds.
 *
 * It is TERMINAL — there is NO forced advance, so `onComplete` is optional and
 * deliberately not called (readiness can still be REVOKED later by a relock,
 * which un-resolves this stage; the screen just reflects "cleared now"). A
 * restrained, on-brand confetti fires once on mount.
 *
 * CONTRACT: a {@link StageComponent} with a DEFAULT export.
 */
export default function GreenlightStage({ onComplete }: StageComponentProps) {
  // Terminal stage: no forced advance. `onComplete` is intentionally unused —
  // touch it so the contract stays explicit without tripping unused-arg lint.
  void onComplete;

  const { progress } = useProgress();
  const mocks = progress.pipeline?.mocks ?? [];
  const streak = mockPassStreak(mocks);
  const bestMock = mocks.reduce((max, m) => Math.max(max, m.scorePct), 0);

  // A single, on-brand celebration on mount (guarded; a no-op under
  // reduced-motion or if the confetti canvas is unavailable, e.g. in tests).
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    try {
      celebrate();
    } catch {
      /* confetti is decorative — never let it break the terminal screen */
    }
  }, []);

  return (
    <section
      className="panel-ruled space-y-6 p-8 text-center"
      data-testid="greenlight-stage"
    >
      <div className="space-y-2">
        <span className="label text-bull">Stage 8 · Greenlight</span>
        <h2 className="font-display text-3xl font-black leading-tight text-primary sm:text-4xl">
          You're cleared — greenlit to apply to quant firms.
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-secondary">
          Every gate is green: the diagnostics, the trading-intuition game, the
          drilling loop, and three consecutive firm-style mocks at ≥90%. This is
          real, interview-grade readiness — go apply.
        </p>
      </div>

      <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">
        <Stat
          label="Consecutive mocks ≥90%"
          value={`${Math.min(streak, 3)} / 3`}
        />
        <Stat label="Best mock score" value={`${bestMock}%`} />
      </div>

      <div className="note border-l-bull mx-auto max-w-sm text-left">
        <p className="label text-bull">Every stage cleared</p>
        <ul className="mt-2 space-y-1.5 text-xs text-secondary">
          {CLEARED_GATES.map((g) => (
            <li key={g} className="flex items-start gap-2">
              <span className="mt-px font-mono text-bull">✓</span>
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
        Readiness stays earned — a decayed skill can re-open drilling, so keep
        your reps up.
      </p>
    </section>
  );
}

const CLEARED_GATES = [
  "Untimed + timed diagnostics",
  "Trading-intuition game",
  "Every topic mastered (drilling loop)",
  "3 consecutive mocks ≥ 90%",
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="label text-muted">{label}</div>
      <div className="num text-lg font-semibold text-bull">{value}</div>
    </div>
  );
}
