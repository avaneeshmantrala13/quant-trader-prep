import { useEffect, useMemo, useState } from "react";
import {
  computePerformance,
  getDiagnosis,
  type MockDiagnosis,
  type MockSession,
} from "@/lib/mock";
import { StampSeal } from "@/components/visuals/StampSeal";

/**
 * The final REPORT screen: a DETERMINISTIC numeric performance summary plus a
 * brutally-honest diagnosis. Every number is computed client-side by
 * `computePerformance`; the prose comes from `mock-diagnosis` when the AI layer
 * is on, and from the deterministic fallback otherwise. It never blocks — the
 * fallback renders instantly and the AI prose swaps in when it lands.
 */
export function DiagnosisReport({
  session,
  themeCelebration,
  onRestart,
  onDone,
}: {
  session: MockSession;
  themeCelebration: () => void;
  onRestart: () => void;
  onDone: () => void;
}) {
  const perf = useMemo(() => computePerformance(session), [session]);
  const [diagnosis, setDiagnosis] = useState<MockDiagnosis | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDiagnosis(perf).then((d) => {
      if (!cancelled) setDiagnosis(d);
    });
    return () => {
      cancelled = true;
    };
  }, [perf]);

  const strong = perf.scorePct >= 70;
  useEffect(() => {
    if (strong) setTimeout(themeCelebration, 260);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passChip =
    diagnosis?.wouldPass === "yes"
      ? "border-bull text-bull"
      : diagnosis?.wouldPass === "no"
        ? "border-bear text-bear"
        : "border-accent text-accent";

  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Debrief · Performance Report</span>
        <div className="relative mt-4 flex justify-center">
          <StampSeal
            label={`${perf.scorePct}%`}
            sub={perf.tier}
            tone={strong ? "bull" : "accent"}
          />
        </div>

        <div className="mx-auto mt-6 grid max-w-lg grid-cols-4 divide-x divide-subtle border-y border-subtle">
          <Stat label="Math" value={`${perf.mathCorrect}/${perf.mathTotal}`} />
          <Stat
            label="Follow-ups"
            value={`${perf.followupCorrect}/${perf.followupTotal}`}
          />
          <Stat
            label="Teasers"
            value={`${perf.brainteaserCorrect}/${perf.brainteaserTotal}`}
          />
          <Stat
            label="MM P&L"
            value={perf.mmPnl !== undefined ? `${perf.mmPnl > 0 ? "+" : ""}${perf.mmPnl}` : "—"}
          />
        </div>

        <div className="mx-auto mt-3 grid max-w-lg grid-cols-3 divide-x divide-subtle border-b border-subtle text-secondary">
          <Stat
            label="Avg time"
            value={perf.avgMathMs > 0 ? `${(perf.avgMathMs / 1000).toFixed(1)}s` : "—"}
          />
          <Stat
            label="Sound reasoning"
            value={`${perf.reasoningTags.sound}`}
          />
          <Stat
            label="Correct-but-vague"
            value={`${perf.correctButVagueCount}`}
          />
        </div>

        {/* Per-competency breakdown (only competencies this preset tested) */}
        <div className="mx-auto mt-3 flex max-w-lg flex-wrap justify-center gap-2">
          <Competency label="Speed / arithmetic" tally={perf.speed} />
          <Competency label="Probability & EV" tally={perf.probEv} />
          <Competency label="Sequences" tally={perf.sequences} />
          <Competency label="Estimation" tally={perf.estimation} />
          <Competency
            label="Probe follow-ups"
            tally={{ correct: perf.probeCorrect, total: perf.probeTotal }}
          />
          <Competency
            label="Adversarial follow-ups"
            tally={{ correct: perf.adversarialCorrect, total: perf.adversarialTotal }}
          />
        </div>
      </div>

      {/* Diagnosis prose */}
      <div className="panel">
        <div className="flex items-center justify-between border-b-[3px] border-border-strong px-4 py-2.5">
          <span className="label">Interviewer's verdict</span>
          {diagnosis && (
            <span className={`chip ${passChip}`}>
              Would pass: {diagnosis.wouldPass}
            </span>
          )}
        </div>
        <div className="space-y-4 p-5">
          {!diagnosis ? (
            <p className="flex items-center gap-2 text-sm text-secondary" role="status">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
              Writing your diagnosis…
            </p>
          ) : (
            <>
              <p className="text-[15px] font-medium leading-relaxed text-primary">
                {diagnosis.verdict}
              </p>
              <DiagnosisList
                title="Strengths"
                items={diagnosis.strengths}
                labelClass="text-bull"
                dotClass="bg-bull"
              />
              <DiagnosisList
                title="Weaknesses"
                items={diagnosis.weaknesses}
                labelClass="text-bear"
                dotClass="bg-bear"
              />
              <DiagnosisList
                title="Next steps"
                items={diagnosis.nextSteps}
                labelClass="text-accent"
                dotClass="bg-accent"
              />
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Numbers computed on-device · prose{" "}
                {diagnosis.source === "ai" ? "written by the interviewer (AI)" : "generated deterministically"} · grounded only in your results
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onRestart} className="btn-primary flex-1">
          New Interview
        </button>
        <button onClick={onDone} className="btn-secondary flex-1">
          Back Home
        </button>
      </div>
    </div>
  );
}

function Competency({
  label,
  tally,
}: {
  label: string;
  tally?: { correct: number; total: number };
}) {
  if (!tally || tally.total === 0) return null;
  const pct = Math.round((tally.correct / tally.total) * 100);
  const tone =
    pct >= 80 ? "border-bull text-bull" : pct >= 60 ? "border-accent text-accent" : "border-bear text-bear";
  return (
    <span className={`chip ${tone}`}>
      {label}: {tally.correct}/{tally.total}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3">
      <div className="label text-[9px]">{label}</div>
      <div className="num mt-1 text-lg font-semibold text-primary">{value}</div>
    </div>
  );
}

function DiagnosisList({
  title,
  items,
  labelClass,
  dotClass,
}: {
  title: string;
  items: string[];
  labelClass: string;
  dotClass: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`label ${labelClass}`}>{title}</div>
      <ul className="mt-2 space-y-1.5 text-sm text-secondary">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 ${dotClass}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
