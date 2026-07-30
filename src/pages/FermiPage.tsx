import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { StampSeal } from "@/components/visuals/StampSeal";
import { ChevronLeftIcon, GaugeIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import { DIFFICULTY_META } from "@/types/content";
import {
  computeFermiReference,
  computeRunningSteps,
  gradeFermi,
  formatFermiNumber,
  FERMI_BAND_COPY,
  type FermiBand,
  type FermiGrade,
} from "@/lib/fermi/grader";
import { FERMI_ITEMS, type FermiItem } from "@/content/fermi/items";

/**
 * The dedicated Fermi Estimation drill (`/fermi`).
 *
 * A SELF-CONTAINED, full-screen estimation game (its own layout, like the lesson
 * player) rather than a level inside a track — this keeps it in a disjoint
 * namespace from the concurrently-built trading simulators and avoids touching
 * the shared level/mode machinery, while still being a first-class destination.
 *
 * The learner commits ONE numeric estimate per item; it is graded by
 * log-distance to a code-computed reference (`@/lib/fermi/grader`), then the
 * canonical decomposition is revealed as a running product so they learn a
 * defensible path. All grading + reference logic lives in the pure, unit-tested
 * grader module; this component is a thin themed renderer (token-only styling,
 * works across every theme in light + dark). It intentionally keeps its own
 * session score and never touches mastery/progress.
 */

type Phase = "intro" | "drill" | "summary";

/** Tailwind token classes for each band's solid "verdict" banner. */
const BAND_BANNER: Record<FermiBand, string> = {
  correct: "bg-bull text-bg",
  close: "bg-accent text-accent-contrast",
  incorrect: "bg-bear text-bg",
};

export function FermiPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();

  const items = FERMI_ITEMS;
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  // One grade per item; null = not yet answered.
  const [grades, setGrades] = useState<(FermiGrade | null)[]>(
    () => items.map(() => null),
  );

  const item = items[index];
  const answered = grades[index] !== null;
  const total = items.length;

  const submit = (grade: FermiGrade) => {
    if (answered) return;
    setGrades((prev) => {
      const next = prev.slice();
      next[index] = grade;
      return next;
    });
  };

  const goNext = () => {
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      setPhase("summary");
      const anyFull = grades.some((g) => g?.band === "correct");
      if (anyFull) setTimeout(themeDef.celebration ?? celebrate, 260);
    }
  };

  const restart = () => {
    setGrades(items.map(() => null));
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
            onStart={() => setPhase("drill")}
          />
        )}

        {phase === "drill" && item && (
          <FermiCard
            key={item.id}
            item={item}
            number={index + 1}
            total={total}
            grade={grades[index]}
            isLast={index === total - 1}
            onSubmit={submit}
            onNext={goNext}
          />
        )}

        {phase === "summary" && (
          <FermiSummary
            items={items}
            grades={grades}
            onRestart={restart}
            onDone={() => navigate("/")}
          />
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Intro — what this is + how it's graded                                     */
/* -------------------------------------------------------------------------- */

function FermiIntro({
  total,
  onStart,
}: {
  total: number;
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
            You'll get {total} problems. Commit a single number for each — enter
            it any way you like (<span className="num">300000</span>,{" "}
            <span className="num">300k</span>, or <span className="num">3e5</span>
            ). Then we reveal a defensible decomposition so you can see the path.
          </p>
        </div>

        <div className="mt-5 border-l-2 border-accent bg-surface-muted px-4 py-3">
          <div className="label text-accent">How this is graded</div>
          <p className="mt-1 text-sm leading-relaxed text-secondary">
            There's no single right answer, so we grade by{" "}
            <span className="font-semibold text-primary">order of magnitude</span>
            : how far your estimate is from a code-computed reference, measured in
            powers of ten.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 bg-bull" />
              <span className="text-secondary">
                <span className="font-semibold text-primary">Within ~3×</span> —
                full credit (spot on)
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 bg-accent" />
              <span className="text-secondary">
                <span className="font-semibold text-primary">Within 10×</span> —
                partial credit (right ballpark)
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 bg-bear" />
              <span className="text-secondary">
                <span className="font-semibold text-primary">Beyond 10×</span> —
                off the mark
              </span>
            </li>
          </ul>
        </div>

        <p className="mt-4 border-t border-subtle pt-3 font-mono text-xs uppercase tracking-wider text-muted">
          Why firms ask · Guesstimate markets test structured estimation under
          pressure.
        </p>
      </article>

      <button onClick={onStart} className="btn-primary w-full">
        Start Estimating ▸
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  One estimation problem: enter a number → reveal decomposition             */
/* -------------------------------------------------------------------------- */

function FermiCard({
  item,
  number,
  total,
  grade,
  isLast,
  onSubmit,
  onNext,
}: {
  item: FermiItem;
  number: number;
  total: number;
  grade: FermiGrade | null;
  isLast: boolean;
  onSubmit: (grade: FermiGrade) => void;
  onNext: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reference = useMemo(
    () => computeFermiReference(item.factors),
    [item],
  );
  const steps = useMemo(() => computeRunningSteps(item.factors), [item]);
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
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            Estimate {String(number).padStart(2, "0")} / {total}
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

      {/* Estimate entry */}
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
              value={
                answered
                  ? (grade?.parsed ?? "").toLocaleString("en-US")
                  : raw
              }
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

      {answered && grade && (
        <Reveal
          item={item}
          grade={grade}
          reference={reference}
          steps={steps}
          isLast={isLast}
          onNext={onNext}
        />
      )}
    </div>
  );
}

function Reveal({
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

      {/* Canonical decomposition — running product */}
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
          Other decompositions are equally valid — what matters is landing near
          the right magnitude with factors you can defend.
        </p>
        {item.source && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
            Genre · {item.source}
          </p>
        )}
      </div>

      <button onClick={onNext} className="btn-primary w-full">
        {isLast ? "See Results ▸" : "Next Estimate ▸"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Summary                                                                    */
/* -------------------------------------------------------------------------- */

function FermiSummary({
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
                    You · {g ? formatFermiNumber(g.parsed ?? 0, { money: it.money }) : "—"}
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
