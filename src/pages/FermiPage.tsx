import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useProgress } from "@/context/ProgressContext";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { StampSeal } from "@/components/visuals/StampSeal";
import { ChevronLeftIcon, GaugeIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import { DIFFICULTY_META } from "@/types/content";
import {
  computeFermiReference,
  computeRunningSteps,
  gradeFermi,
  gradeInterval,
  intervalCoverage,
  coverageLean,
  formatFermiNumber,
  FERMI_BAND_COPY,
  FERMI_CI_ALPHA,
  type FermiBand,
  type FermiGrade,
  type FermiIntervalGrade,
} from "@/lib/fermi/grader";
import { CiElicitation } from "@/components/fermi/CiElicitation";
import {
  clearFermiRun,
  loadFermiRun,
  saveFermiRun,
} from "@/lib/fermi/persist";
import { FERMI_ITEMS, type FermiItem } from "@/content/fermi/items";

/**
 * The dedicated Fermi Estimation drill (`/fermi`).
 *
 * A SELF-CONTAINED, full-screen estimation game (its own layout, like the lesson
 * player) rather than a level inside a track — this keeps it in a disjoint
 * namespace from the concurrently-built trading simulators and avoids touching
 * the shared level/mode machinery, while still being a first-class destination.
 *
 * Two modes, toggled (not forked) from the intro:
 *  - POINT ESTIMATE (default): commit ONE number, graded by log-distance to a
 *    code-computed reference (`gradeFermi`), then the canonical decomposition is
 *    revealed as a running product. This path is unchanged.
 *  - 90% CI in 60s (calibration): commit a lo/hi range, scored in-round by the
 *    proper Winkler interval score (`gradeInterval`); the debrief reports
 *    empirical coverage ("your 90% CIs contained the truth 6/10 → over-confident").
 *
 * CALIBRATION GUARDRAIL: a 90% CI hit is a BINARY event. It is fed through the
 * EXISTING calibration writer only — `recordCalibrationPair(topicKeyOf("fermi"),
 * 0.9, hit ? 1 : 0)`, once per CI item. The Winkler score stays Fermi-local /
 * in-round and never enters the persisted log; nothing here touches mastery,
 * scoring, locking, or the skill graph.
 *
 * All grading + reference logic lives in the pure, unit-tested grader module;
 * this component is a thin themed renderer (token-only styling, works across
 * every theme in light + dark).
 */

type Phase = "intro" | "drill" | "summary";
type FermiMode = "point" | "ci";

/** Tailwind token classes for each band's solid "verdict" banner. */
const BAND_BANNER: Record<FermiBand, string> = {
  correct: "bg-bull text-bg",
  close: "bg-accent text-accent-contrast",
  incorrect: "bg-bear text-bg",
};

export function FermiPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const { recordCalibrationPair } = useProgress();

  const items = FERMI_ITEMS;

  // Resume a persisted in-progress run (leave/reload-proof). Read once, and only
  // trust a snapshot whose grade arrays still match the current item list.
  const resumed = useMemo(() => {
    const saved = loadFermiRun();
    if (!saved) return undefined;
    if (
      saved.grades.length !== items.length ||
      saved.intervalGrades.length !== items.length
    ) {
      return undefined;
    }
    return saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const [phase, setPhase] = useState<Phase>(resumed ? "drill" : "intro");
  const [mode, setMode] = useState<FermiMode>(resumed?.mode ?? "point");
  const [index, setIndex] = useState(resumed?.index ?? 0);
  // One grade per item per path; null = not yet answered. The two arrays are
  // independent so switching modes never mixes point + interval verdicts.
  const [grades, setGrades] = useState<(FermiGrade | null)[]>(
    () => resumed?.grades ?? items.map(() => null),
  );
  const [intervalGrades, setIntervalGrades] = useState<
    (FermiIntervalGrade | null)[]
  >(() => resumed?.intervalGrades ?? items.map(() => null));

  // Durable persistence: keep the in-progress run saved while drilling so a
  // leave/reload resumes it; finishing (summary) or returning to the intro
  // clears it, so re-entering after a completed run starts fresh.
  useEffect(() => {
    if (phase === "drill") {
      saveFermiRun({ version: 1, mode, index, grades, intervalGrades });
    } else {
      clearFermiRun();
    }
  }, [phase, mode, index, grades, intervalGrades]);

  const item = items[index];
  const answered =
    mode === "point" ? grades[index] !== null : intervalGrades[index] !== null;
  const total = items.length;

  const resetGrades = () => {
    setGrades(items.map(() => null));
    setIntervalGrades(items.map(() => null));
  };

  // Toggling the mode on the intro resets any in-progress verdicts so a run is
  // always entirely one mode (a toggle, not a fork).
  const chooseMode = (m: FermiMode) => {
    if (m === mode) return;
    setMode(m);
    resetGrades();
  };

  const submitPoint = (grade: FermiGrade) => {
    if (grades[index] !== null) return;
    setGrades((prev) => {
      const next = prev.slice();
      next[index] = grade;
      return next;
    });
  };

  const submitInterval = (lo: number, hi: number) => {
    if (intervalGrades[index] !== null) return;
    const reference = computeFermiReference(item.factors);
    const g = gradeInterval({ lo, hi }, reference);
    setIntervalGrades((prev) => {
      const next = prev.slice();
      next[index] = g;
      return next;
    });
    // GUARDRAIL: a 90% CI hit is BINARY. Feed ONLY that through the existing
    // writer as a (0.9, hit) pair — the Winkler score stays in-round.
    recordCalibrationPair(topicKeyOf("fermi"), 0.9, g.hit ? 1 : 0);
  };

  const goNext = () => {
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      setPhase("summary");
      const anyGood =
        mode === "point"
          ? grades.some((g) => g?.band === "correct")
          : intervalGrades.some((g) => g?.hit);
      if (anyGood) setTimeout(themeDef.celebration ?? celebrate, 260);
    }
  };

  const restart = () => {
    resetGrades();
    setIndex(0);
    setPhase("intro");
  };

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => navigate("/")}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back home"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-primary">
              Fermi Estimation Drill
            </div>
            {phase === "drill" && (
              <div className="mt-1 h-1.5 w-full border border-subtle bg-surface">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${((index + (answered ? 1 : 0)) / total) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
          {phase === "drill" && (
            <span className="num text-xs text-secondary">
              {String(index + 1).padStart(2, "0")}/{total}
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6">
        {phase === "intro" && (
          <FermiIntro
            total={total}
            mode={mode}
            onChooseMode={chooseMode}
            onStart={() => setPhase("drill")}
          />
        )}

        {phase === "drill" && item && (
          <FermiCard
            key={`${mode}-${item.id}`}
            item={item}
            mode={mode}
            number={index + 1}
            total={total}
            pointGrade={grades[index]}
            intervalGrade={intervalGrades[index]}
            isLast={index === total - 1}
            onSubmitPoint={submitPoint}
            onSubmitInterval={submitInterval}
            onNext={goNext}
          />
        )}

        {phase === "summary" && (
          <FermiSummary
            items={items}
            mode={mode}
            grades={grades}
            intervalGrades={intervalGrades}
            onRestart={restart}
            onDone={() => navigate("/")}
          />
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mode toggle                                                                */
/* -------------------------------------------------------------------------- */

function ModeToggle({
  mode,
  onChoose,
}: {
  mode: FermiMode;
  onChoose: (m: FermiMode) => void;
}) {
  const opt = (m: FermiMode, label: string, sub: string) => {
    const active = mode === m;
    return (
      <button
        role="radio"
        aria-checked={active}
        onClick={() => onChoose(m)}
        className={`flex-1 border-2 px-3 py-2.5 text-left transition-colors ${
          active
            ? "border-accent bg-surface-muted"
            : "border-subtle bg-surface hover:border-border-strong"
        }`}
      >
        <div
          className={`font-display text-sm font-semibold ${active ? "text-accent" : "text-primary"}`}
        >
          {label}
        </div>
        <div className="mt-0.5 text-xs text-secondary">{sub}</div>
      </button>
    );
  };
  return (
    <div>
      <div className="label text-muted">Mode</div>
      <div
        role="radiogroup"
        aria-label="Estimation mode"
        className="mt-1.5 flex gap-2"
      >
        {opt("point", "Point estimate", "One number, graded by magnitude")}
        {opt("ci", "90% CI in 60s", "A range — calibrate your confidence")}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Intro — what this is + how it's graded                                     */
/* -------------------------------------------------------------------------- */

function FermiIntro({
  total,
  mode,
  onChooseMode,
  onStart,
}: {
  total: number;
  mode: FermiMode;
  onChooseMode: (m: FermiMode) => void;
  onStart: () => void;
}) {
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Estimation Drill</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <GaugeIcon width={20} height={20} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Guesstimate the un-lookup-able
        </h2>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-secondary">
          <p>
            <span className="float-left mr-2 font-display text-5xl font-black leading-[0.8] text-primary">
              A
            </span>
            Fermi problem has no exact answer — you can't look up how many piano
            tuners work in Chicago. Instead you break the unknown into a chain of
            factors you can bound, multiply through, and land near the right
            power of ten. That structured guessing is a daily trading skill:
            quote a fair value from a decomposition, fast.
          </p>
          <p>
            You'll get {total} problems.{" "}
            {mode === "point" ? (
              <>
                Commit a single number for each — enter it any way you like (
                <span className="num">300000</span>,{" "}
                <span className="num">300k</span>, or{" "}
                <span className="num">3e5</span>). Then we reveal a defensible
                decomposition so you can see the path.
              </>
            ) : (
              <>
                For each, commit a{" "}
                <span className="font-semibold text-primary">
                  90% confidence interval
                </span>{" "}
                — a low and a high you're 90% sure bracket the truth. We track
                how often the truth actually lands inside your range.
              </>
            )}
          </p>
        </div>

        <div className="mt-5">
          <ModeToggle mode={mode} onChoose={onChooseMode} />
        </div>

        <div className="mt-5 border-l-2 border-accent bg-surface-muted px-4 py-3">
          <div className="label text-accent">How this is graded</div>
          {mode === "point" ? (
            <>
              <p className="mt-1 text-sm leading-relaxed text-secondary">
                There's no single right answer, so we grade by{" "}
                <span className="font-semibold text-primary">
                  order of magnitude
                </span>
                : how far your estimate is from a code-computed reference,
                measured in powers of ten.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 bg-bull" />
                  <span className="text-secondary">
                    <span className="font-semibold text-primary">
                      Within ~3×
                    </span>{" "}
                    — full credit (spot on)
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 bg-accent" />
                  <span className="text-secondary">
                    <span className="font-semibold text-primary">
                      Within 10×
                    </span>{" "}
                    — partial credit (right ballpark)
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 bg-bear" />
                  <span className="text-secondary">
                    <span className="font-semibold text-primary">
                      Beyond 10×
                    </span>{" "}
                    — off the mark
                  </span>
                </li>
              </ul>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm leading-relaxed text-secondary">
                A well-calibrated forecaster's 90% intervals contain the truth{" "}
                <span className="font-semibold text-primary">
                  ~9 times out of 10
                </span>
                . We reward ranges that are{" "}
                <span className="font-semibold text-primary">
                  both honest and sharp
                </span>{" "}
                (a proper interval score: a wide catch-all range is penalized for
                width, a too-tight range for missing).
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 bg-bull" />
                  <span className="text-secondary">
                    Truth <span className="font-semibold text-primary">inside</span>{" "}
                    your range — a hit
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 bg-bear" />
                  <span className="text-secondary">
                    Truth <span className="font-semibold text-primary">outside</span>{" "}
                    — a miss (penalized by how far out)
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 bg-accent" />
                  <span className="text-secondary">
                    Aim for{" "}
                    <span className="font-semibold text-primary">
                      ~90% coverage
                    </span>{" "}
                    overall — below that you're over-confident
                  </span>
                </li>
              </ul>
            </>
          )}
        </div>

        <p className="mt-4 border-t border-subtle pt-3 font-mono text-xs uppercase tracking-wider text-muted">
          Why firms ask · Guesstimate markets test structured estimation and
          honest uncertainty under pressure.
        </p>
      </article>

      <button onClick={onStart} className="btn-primary w-full">
        {mode === "point" ? "Start Estimating ▸" : "Start Calibrating ▸"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  One problem: enter a number (or range) → reveal decomposition             */
/* -------------------------------------------------------------------------- */

function FermiCard({
  item,
  mode,
  number,
  total,
  pointGrade,
  intervalGrade,
  isLast,
  onSubmitPoint,
  onSubmitInterval,
  onNext,
}: {
  item: FermiItem;
  mode: FermiMode;
  number: number;
  total: number;
  pointGrade: FermiGrade | null;
  intervalGrade: FermiIntervalGrade | null;
  isLast: boolean;
  onSubmitPoint: (grade: FermiGrade) => void;
  onSubmitInterval: (lo: number, hi: number) => void;
  onNext: () => void;
}) {
  const reference = useMemo(
    () => computeFermiReference(item.factors),
    [item],
  );
  const steps = useMemo(() => computeRunningSteps(item.factors), [item]);

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            {mode === "point" ? "Estimate" : "Interval"}{" "}
            {String(number).padStart(2, "0")} / {total}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="chip border-subtle text-secondary">
              {item.category}
            </span>
            <span className="chip border-subtle text-secondary">
              {DIFFICULTY_META[item.difficulty].label}
            </span>
          </div>
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {item.prompt}
        </p>
      </div>

      {mode === "point" ? (
        <PointEntry
          item={item}
          reference={reference}
          grade={pointGrade}
          onSubmit={onSubmitPoint}
        />
      ) : (
        <CiElicitation
          item={item}
          grade={intervalGrade}
          onSubmit={onSubmitInterval}
        />
      )}

      {mode === "point" && pointGrade && (
        <PointReveal
          item={item}
          grade={pointGrade}
          reference={reference}
          steps={steps}
          isLast={isLast}
          onNext={onNext}
        />
      )}

      {mode === "ci" && intervalGrade && (
        <IntervalReveal
          item={item}
          grade={intervalGrade}
          reference={reference}
          steps={steps}
          isLast={isLast}
          onNext={onNext}
        />
      )}
    </div>
  );
}

function PointEntry({
  item,
  reference,
  grade,
  onSubmit,
}: {
  item: FermiItem;
  reference: number;
  grade: FermiGrade | null;
  onSubmit: (grade: FermiGrade) => void;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const answered = grade !== null;
  const money = !!item.money;

  const handleSubmit = () => {
    if (answered) return;
    const g = gradeFermi(reference, raw);
    if (g.parsed === null) {
      setError("Enter a number — e.g. 300000, 300k, or 3e5.");
      return;
    }
    if (g.parsed <= 0) {
      setError("Enter a positive estimate.");
      return;
    }
    setError(null);
    onSubmit(g);
  };

  return (
    <div className="panel p-5">
      <label htmlFor={`fermi-${item.id}`} className="label text-accent">
        Your estimate
        <span className="ml-1 lowercase text-muted">({item.unit})</span>
      </label>
      <div className="mt-2 flex items-stretch gap-2">
        <div className="flex flex-1 items-center border-2 border-border-strong bg-surface focus-within:border-accent">
          {money && (
            <span className="px-3 font-mono text-lg font-semibold text-secondary">
              $
            </span>
          )}
          <input
            id={`fermi-${item.id}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={answered}
            value={answered ? (grade?.parsed ?? "").toLocaleString("en-US") : raw}
            onChange={(e) => {
              setRaw(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="e.g. 300000, 300k, or 3e5"
            aria-label={`Your estimate for ${item.quantity}`}
            aria-invalid={error ? true : undefined}
            className={`num min-h-[44px] w-full bg-transparent py-2 pr-3 text-lg font-semibold text-primary outline-none disabled:opacity-70 ${money ? "" : "pl-3"}`}
          />
        </div>
        {!answered && (
          <button onClick={handleSubmit} className="btn-primary px-5">
            Lock In ▸
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-bear" role="alert">
          {error}
        </p>
      )}
      {!answered && (
        <p className="mt-2 text-xs text-muted">
          Graded by order of magnitude: within ~3× = full credit, within 10× =
          partial.
        </p>
      )}
    </div>
  );
}

/** Shared "defensible decomposition" running-product panel (both modes). */
function DecompositionPanel({
  item,
  reference,
  steps,
}: {
  item: FermiItem;
  reference: number;
  steps: ReturnType<typeof computeRunningSteps>;
}) {
  const money = !!item.money;
  return (
    <div className="panel p-5">
      <span className="label text-accent">A defensible decomposition</span>
      <div className="mt-3 divide-y divide-subtle border border-subtle">
        {steps.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="num grid h-6 w-7 shrink-0 place-items-center border border-subtle font-mono text-xs font-semibold text-secondary">
                {i === 0 ? "=" : s.op === "div" ? "÷" : "×"}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-primary">
                  {s.label}
                </div>
                <div className="num font-mono text-[11px] text-muted">
                  {formatFermiNumber(s.value)}
                  {s.unit ? ` ${s.unit}` : ""}
                </div>
              </div>
            </div>
            <div className="num shrink-0 font-mono text-sm font-semibold text-secondary">
              {formatFermiNumber(s.running, { money })}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 bg-surface-muted px-3 py-2.5">
          <span className="label text-accent">Reference answer</span>
          <span className="num font-mono text-base font-bold text-primary">
            ≈ {formatFermiNumber(reference, { money })}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-secondary">
        {item.takeaway}
      </p>
      <p className="mt-2 text-xs italic text-muted">
        Other decompositions are equally valid — what matters is landing near the
        right magnitude with factors you can defend.
      </p>
      {item.source && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
          Genre · {item.source}
        </p>
      )}
    </div>
  );
}

function PointReveal({
  item,
  grade,
  reference,
  steps,
  isLast,
  onNext,
}: {
  item: FermiItem;
  grade: FermiGrade;
  reference: number;
  steps: ReturnType<typeof computeRunningSteps>;
  isLast: boolean;
  onNext: () => void;
}) {
  const money = !!item.money;
  const bandCopy = FERMI_BAND_COPY[grade.band];
  const factorText =
    grade.factor !== null
      ? grade.factor < 1.15
        ? "essentially spot on"
        : `about ${grade.factor >= 9.95 ? Math.round(grade.factor) : grade.factor.toFixed(1)}× ${
            (grade.parsed ?? 0) > reference ? "too high" : "too low"
          }`
      : "not a valid number";

  return (
    <div className="animate-print-in space-y-4">
      {/* Verdict banner */}
      <div className="border border-subtle">
        <div
          className={`flex items-center justify-between px-4 py-2 ${BAND_BANNER[grade.band]}`}
        >
          <span className="font-mono text-xs font-semibold uppercase tracking-label">
            ● {bandCopy.label}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
            {grade.score === 1
              ? "Full credit"
              : grade.score === 0.5
                ? "Partial credit"
                : "No credit"}
          </span>
        </div>
        <div className="space-y-1 bg-surface p-4">
          <p className="text-sm text-primary">
            <span className="label text-secondary">You said · </span>
            <span className="num font-semibold">
              {formatFermiNumber(grade.parsed ?? 0, { money })}
            </span>
            <span className="text-secondary"> — {factorText}.</span>
          </p>
          <p className="text-sm text-primary">
            <span className="label text-secondary">Reference ≈ </span>
            <span className="num font-semibold">
              {formatFermiNumber(reference, { money })}
            </span>
            <span className="text-secondary"> {item.unit}</span>
          </p>
        </div>
      </div>

      <DecompositionPanel item={item} reference={reference} steps={steps} />

      <button onClick={onNext} className="btn-primary w-full">
        {isLast ? "See Results ▸" : "Next Estimate ▸"}
      </button>
    </div>
  );
}

function IntervalReveal({
  item,
  grade,
  reference,
  steps,
  isLast,
  onNext,
}: {
  item: FermiItem;
  grade: FermiIntervalGrade;
  reference: number;
  steps: ReturnType<typeof computeRunningSteps>;
  isLast: boolean;
  onNext: () => void;
}) {
  const money = !!item.money;
  const hit = grade.hit;

  return (
    <div className="animate-print-in space-y-4">
      {/* Verdict banner */}
      <div className="border border-subtle">
        <div
          className={`flex items-center justify-between px-4 py-2 ${hit ? "bg-bull text-bg" : "bg-bear text-bg"}`}
        >
          <span className="font-mono text-xs font-semibold uppercase tracking-label">
            ● {hit ? "Inside your range" : "Outside your range"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
            {hit ? "Hit" : "Miss"}
          </span>
        </div>
        <div className="space-y-1 bg-surface p-4">
          <p className="text-sm text-primary">
            <span className="label text-secondary">Your range · </span>
            <span className="num font-semibold">
              {formatFermiNumber(grade.lo, { money })}
            </span>
            <span className="text-secondary"> to </span>
            <span className="num font-semibold">
              {formatFermiNumber(grade.hi, { money })}
            </span>
          </p>
          <p className="text-sm text-primary">
            <span className="label text-secondary">Reference ≈ </span>
            <span className="num font-semibold">
              {formatFermiNumber(reference, { money })}
            </span>
            <span className="text-secondary"> {item.unit}</span>
          </p>
          <p className="text-xs text-muted">
            {hit
              ? "The truth landed inside your interval. Sharper (narrower) honest ranges score better."
              : "The truth fell outside your interval — a 90% range should miss only about 1 time in 10."}{" "}
            <span className="num">
              (interval score {formatFermiNumber(grade.score, { money })} · lower
              is better)
            </span>
          </p>
        </div>
      </div>

      <DecompositionPanel item={item} reference={reference} steps={steps} />

      <button onClick={onNext} className="btn-primary w-full">
        {isLast ? "See Results ▸" : "Next Interval ▸"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Summary                                                                    */
/* -------------------------------------------------------------------------- */

function FermiSummary({
  items,
  mode,
  grades,
  intervalGrades,
  onRestart,
  onDone,
}: {
  items: FermiItem[];
  mode: FermiMode;
  grades: (FermiGrade | null)[];
  intervalGrades: (FermiIntervalGrade | null)[];
  onRestart: () => void;
  onDone: () => void;
}) {
  if (mode === "ci") {
    return (
      <IntervalSummary
        items={items}
        intervalGrades={intervalGrades}
        onRestart={onRestart}
        onDone={onDone}
      />
    );
  }
  return (
    <PointSummary
      items={items}
      grades={grades}
      onRestart={onRestart}
      onDone={onDone}
    />
  );
}

function PointSummary({
  items,
  grades,
  onRestart,
  onDone,
}: {
  items: FermiItem[];
  grades: (FermiGrade | null)[];
  onRestart: () => void;
  onDone: () => void;
}) {
  const scored = grades.filter((g): g is FermiGrade => g !== null);
  const totalScore = scored.reduce((s, g) => s + g.score, 0);
  const maxScore = items.length;
  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const counts: Record<FermiBand, number> = {
    correct: scored.filter((g) => g.band === "correct").length,
    close: scored.filter((g) => g.band === "close").length,
    incorrect: scored.filter((g) => g.band === "incorrect").length,
  };
  const strong = pct >= 70;

  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Estimation Scorecard</span>
        <div className="relative mt-4 flex justify-center">
          <StampSeal
            label={strong ? "Sharp Eye" : "Keep Honing"}
            sub={strong ? "Magnitudes Nailed" : "Tighten the Factors"}
            tone={strong ? "bull" : "accent"}
          />
        </div>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 divide-x divide-subtle border-y border-subtle">
          <div className="px-2 py-3">
            <div className="label text-[9px]">Score</div>
            <div className="num mt-1 text-xl font-semibold text-primary">
              {totalScore % 1 === 0 ? totalScore : totalScore.toFixed(1)}/
              {maxScore}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Accuracy</div>
            <div
              className={`num mt-1 text-xl font-semibold ${strong ? "text-bull" : "text-primary"}`}
            >
              {pct}%
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Spot On</div>
            <div className="num mt-1 text-xl font-semibold text-secondary">
              {counts.correct}/{maxScore}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-secondary">
            <span className="inline-block h-2.5 w-2.5 bg-bull" /> {counts.correct}{" "}
            spot on
          </span>
          <span className="flex items-center gap-1.5 text-secondary">
            <span className="inline-block h-2.5 w-2.5 bg-accent" /> {counts.close}{" "}
            ballpark
          </span>
          <span className="flex items-center gap-1.5 text-secondary">
            <span className="inline-block h-2.5 w-2.5 bg-bear" />{" "}
            {counts.incorrect} off
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button onClick={onRestart} className="btn-primary flex-1">
            Estimate Again
          </button>
          <button onClick={onDone} className="btn-secondary flex-1">
            Back Home
          </button>
        </div>
      </div>

      {/* Per-item blotter */}
      <div className="panel">
        <div className="border-b-[3px] border-border-strong px-4 py-2.5">
          <span className="label">Blotter · Review</span>
        </div>
        <ul>
          {items.map((it, i) => {
            const g = grades[i];
            const ref = computeFermiReference(it.factors);
            const tone = g ? BAND_BANNER[g.band] : "bg-surface-muted text-muted";
            return (
              <li
                key={it.id}
                className="flex items-start gap-3 border-b border-subtle p-4 last:border-b-0"
              >
                <span
                  className={`num mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-semibold ${tone}`}
                >
                  {g?.band === "correct" ? "✓" : g?.band === "close" ? "~" : "✕"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-primary">
                    {it.quantity}
                  </div>
                  <div className="num mt-0.5 font-mono text-xs text-secondary">
                    You ·{" "}
                    {g ? formatFermiNumber(g.parsed ?? 0, { money: it.money }) : "—"}
                    {"   "}Ref ≈ {formatFermiNumber(ref, { money: it.money })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function IntervalSummary({
  items,
  intervalGrades,
  onRestart,
  onDone,
}: {
  items: FermiItem[];
  intervalGrades: (FermiIntervalGrade | null)[];
  onRestart: () => void;
  onDone: () => void;
}) {
  const scored = intervalGrades.filter(
    (g): g is FermiIntervalGrade => g !== null,
  );
  const cov = intervalCoverage(scored.map((g) => g.hit));
  const lean = coverageLean(cov);
  const target = Math.round((1 - FERMI_CI_ALPHA) * 100);
  const covPct = Math.round(cov.coverage * 100);

  const leanCopy =
    cov.n === 0
      ? { title: "No intervals yet", tone: "accent" as const, line: "" }
      : lean === "over"
        ? {
            title: "Over-confident",
            tone: "bear" as const,
            line: `Your 90% intervals contained the truth only ${cov.hits}/${cov.n} of the time (${covPct}%). Your ranges are too tight — widen them until you're being surprised only ~1 time in 10.`,
          }
        : lean === "under"
          ? {
              title: "Under-confident",
              tone: "accent" as const,
              line: `Your intervals contained the truth ${cov.hits}/${cov.n} of the time (${covPct}%) — more than the 90% target. You can afford to tighten them and still be well-calibrated.`,
            }
          : {
              title: "Well-calibrated",
              tone: "bull" as const,
              line: `Your 90% intervals contained the truth ${cov.hits}/${cov.n} of the time (${covPct}%) — right around the ${target}% target. Sharp and honest.`,
            };

  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Calibration Scorecard</span>
        <div className="relative mt-4 flex justify-center">
          <StampSeal
            label={leanCopy.title}
            sub={`${target}% CI Coverage`}
            tone={leanCopy.tone}
          />
        </div>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 divide-x divide-subtle border-y border-subtle">
          <div className="px-2 py-3">
            <div className="label text-[9px]">Coverage</div>
            <div
              className={`num mt-1 text-xl font-semibold ${lean === "on-target" ? "text-bull" : "text-primary"}`}
            >
              {covPct}%
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Hits</div>
            <div className="num mt-1 text-xl font-semibold text-secondary">
              {cov.hits}/{cov.n}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Target</div>
            <div className="num mt-1 text-xl font-semibold text-secondary">
              {target}%
            </div>
          </div>
        </div>

        {/* Coverage vs. target bar */}
        <div className="mx-auto mt-5 max-w-sm">
          <div className="relative h-2.5 w-full border border-subtle bg-surface">
            <div
              className={`h-full ${lean === "over" ? "bg-bear" : lean === "under" ? "bg-accent" : "bg-bull"}`}
              style={{ width: `${Math.min(100, covPct)}%` }}
            />
            {/* 90% target marker */}
            <div
              className="absolute top-[-3px] h-[calc(100%+6px)] w-0.5 bg-border-strong"
              style={{ left: `${target}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>0%</span>
            <span>{target}% target</span>
            <span>100%</span>
          </div>
        </div>

        {leanCopy.line && (
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-secondary">
            {leanCopy.line}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button onClick={onRestart} className="btn-primary flex-1">
            Calibrate Again
          </button>
          <button onClick={onDone} className="btn-secondary flex-1">
            Back Home
          </button>
        </div>
      </div>

      {/* Per-item blotter */}
      <div className="panel">
        <div className="border-b-[3px] border-border-strong px-4 py-2.5">
          <span className="label">Blotter · Review</span>
        </div>
        <ul>
          {items.map((it, i) => {
            const g = intervalGrades[i];
            const ref = computeFermiReference(it.factors);
            const tone = g
              ? g.hit
                ? "bg-bull text-bg"
                : "bg-bear text-bg"
              : "bg-surface-muted text-muted";
            return (
              <li
                key={it.id}
                className="flex items-start gap-3 border-b border-subtle p-4 last:border-b-0"
              >
                <span
                  className={`num mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-semibold ${tone}`}
                >
                  {g ? (g.hit ? "✓" : "✕") : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-primary">
                    {it.quantity}
                  </div>
                  <div className="num mt-0.5 font-mono text-xs text-secondary">
                    You ·{" "}
                    {g
                      ? `${formatFermiNumber(g.lo, { money: it.money })}–${formatFermiNumber(g.hi, { money: it.money })}`
                      : "—"}
                    {"   "}Ref ≈ {formatFermiNumber(ref, { money: it.money })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
