import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useProgress } from "@/context/ProgressContext";
import type { StageComponentProps } from "../stageRegistry";
import type { ItemAttempt } from "@/types/mastery";
import { Rng } from "@/lib/rng";
import { gradeFreeResponse, parseFreeResponse, formatNumericAnswer } from "@/lib/numeric";
import { buildHintLadder } from "@/lib/tutor/hintLadder";
import { buildWorkedSibling } from "@/lib/tutor/workedSibling";
import { drillWorkedSiblingLevel } from "@/lib/tutor/drillSibling";
import { resolveNumericTag } from "@/lib/tutor/misconception";
import {
  startEpisode,
  submitAttempt,
  isResolved,
  type HintEpisode,
} from "@/lib/tutor/hintEpisode";
import { HintLadder } from "@/components/tutor/HintLadder";
import {
  buildContentDrillAttempt,
  buildBrainteaserDrillAttempt,
  brainteaserSignature,
  contentSignature,
  drawBrainteaserDrill,
  drawContentDrill,
  drillingProgress,
  drillPlanTargets,
  DRILL_ROUND_SIZE,
  type ContentDrillResult,
  type DrillTarget,
} from "@/lib/pipeline/drilling";
import {
  gradeBrainteaserNumeric,
  type MaterializedBrainteaserItem,
  type MaterializedNumericItem,
} from "@/lib/diagnostic/untimedRun";
import {
  buildTimedDrillSection,
  TIMED_DRILL_BUDGET_MS,
  TIMED_DRILL_ROUND_SIZE,
} from "@/lib/pipeline/timedDrill";
import { stationForSubtopic } from "./gameOa/battery";
import { TimerBar, useShotClock } from "./gameOa/kit";

/**
 * ============================================================================
 *  STAGE 6 — DRILLING LOOP screen  (guided pipeline, Phase P6)
 * ============================================================================
 * Serves drills WEAKEST-FIRST (spec §2 Stage 6) driven entirely by the pure
 * orchestrator (`@/lib/pipeline/drilling`): {@link pickNextDrillTarget} chooses
 * the next node from live mastery, and each round REUSES an existing engine —
 *
 *   • content nodes  → the untimed-diagnostic free-response items + the
 *     answer-withholding HINT LADDER; a correct answer's credit DECAYS with the
 *     highest rung used (`buildContentDrillAttempt`), so mastery is earned with
 *     progressively less help.
 *   • timed-weak topic → a SHOT-CLOCKED retake (`TimedDrillRound`) of the same
 *     bank under a per-question clock; a passing section rewrites
 *     `pipeline.timed` (via `recordTimedDrillSection`) so the 0.90 timed gate
 *     can genuinely clear — the fix for the "good untimed / bad timed" stall.
 *   • brainteaser competency → the brainteaser flashcards (hybrid grading).
 *   • trading SUBTOPIC        → re-mounts that subtopic's Game-OA battery
 *     station (the exact game), which folds into the subtopic's Beta itself.
 *
 * EVERY resolved item is persisted through `useProgress().recordItemAttempt`
 * (the single mastery entry point), so the Beta posteriors move and the live
 * gate re-derives. The loop is DONE exactly when `passesDrillingGate` holds —
 * `onComplete()` fires once, then, and only then (relock can revoke it).
 *
 * CONTRACT: a {@link StageComponent} taking only `onComplete`. DEFAULT export.
 */

/** The active drill round the stage is serving (frozen at round start). */
type ActiveRound =
  | { serve: "numeric"; target: DrillTarget; items: MaterializedNumericItem[] }
  | { serve: "timed-drill"; target: DrillTarget; items: MaterializedNumericItem[] }
  | { serve: "brainteaser"; target: DrillTarget; items: MaterializedBrainteaserItem[] }
  | { serve: "trading"; target: DrillTarget }
  | { serve: "timed-info"; target: DrillTarget };

export default function DrillingStage({ onComplete }: StageComponentProps) {
  const { progress, recordItemAttempt, recordTimedDrillSection } = useProgress();

  const rngRef = useRef<Rng>(new Rng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<ActiveRound | null>(null);
  const doneRef = useRef(false);
  // Every content signature served THIS drill session. Passed to each draw so no
  // exact-duplicate question is ever re-served across rounds (bug: the same
  // rendered problem repeating within a session).
  const seenSigRef = useRef<Set<string>>(new Set());

  const prog = useMemo(() => drillingProgress(progress), [progress]);

  const record = useCallback(
    (attempt: ItemAttempt) => recordItemAttempt(attempt),
    [recordItemAttempt],
  );

  // Merge a finished timed-drill section into `pipeline.timed` (superseding the
  // topic's prior failing per-topic section) so a passing shot-clocked retake
  // can flip the 0.90 timed gate.
  const recordTimed = useCallback(
    (topicKey: string, correct: number, total: number) =>
      recordTimedDrillSection(buildTimedDrillSection(topicKey, correct, total)),
    [recordTimedDrillSection],
  );

  // Freeze the next round from LIVE progress (target + materialized items).
  // V1 BACKSTOP: walk the weakest-first plan and serve the FIRST target that
  // yields a non-empty round; a numeric topic that (hypothetically) draws dry
  // ROUND-ROBINS to the next weak target instead of dead-ending on a button-less
  // panel. The list always ends with the residual timed-info target, so the loop
  // can always progress until the gate clears — a freeze is structurally
  // impossible even if some topic could ever run out of novel items.
  const startNextRound = useCallback(() => {
    const targets = drillPlanTargets(progress);
    if (targets.length === 0) {
      setRound(null);
      return;
    }
    const seed = rngRef.current.int(0, 2_000_000_000);
    for (const target of targets) {
      if (target.serve === "numeric" && target.topicKey) {
        const items = drawContentDrill(
          target.topicKey,
          seed,
          DRILL_ROUND_SIZE,
          seenSigRef.current,
        );
        if (items.length === 0) continue; // dry topic ⇒ round-robin to next weak target
        for (const it of items) seenSigRef.current.add(contentSignature(it));
        setRound({ serve: "numeric", target, items });
        return;
      }
      if (target.serve === "timed-drill" && target.topicKey) {
        // A timed-weak topic: re-draw its bank UNDER A CLOCK (same untimed
        // materializer as content, but shot-clocked). A passing section rewrites
        // `pipeline.timed`. A dry topic round-robins on to the next weak target.
        const items = drawContentDrill(
          target.topicKey,
          seed,
          TIMED_DRILL_ROUND_SIZE,
          seenSigRef.current,
        );
        if (items.length === 0) continue;
        for (const it of items) seenSigRef.current.add(contentSignature(it));
        setRound({ serve: "timed-drill", target, items });
        return;
      }
      if (target.serve === "brainteaser") {
        const items = drawBrainteaserDrill(seed, DRILL_ROUND_SIZE, seenSigRef.current);
        if (items.length === 0) continue;
        for (const it of items) seenSigRef.current.add(brainteaserSignature(it));
        setRound({ serve: "brainteaser", target, items });
        return;
      }
      if (target.serve === "trading") {
        setRound({ serve: "trading", target });
        return;
      }
      // Residual timed-info target: a servable panel with a Continue affordance.
      setRound({ serve: "timed-info", target });
      return;
    }
    setRound(null);
  }, [progress]);

  // Drive the loop: finish once the gate holds, else keep a round in flight.
  useEffect(() => {
    if (prog.done) {
      if (!doneRef.current) {
        doneRef.current = true;
        onComplete();
      }
      return;
    }
    if (round === null) startNextRound();
  }, [prog.done, round, startNextRound, onComplete]);

  const onRoundDone = () => setRound(null);

  return (
    <section className="panel space-y-5 p-6" data-testid="drilling-stage">
      <header className="space-y-1">
        <span className="label text-accent">Stage 6 · Drilling loop</span>
        <h2 className="font-display text-2xl font-bold text-primary">
          {prog.done ? "All gates cleared" : "Drill your weakest topic"}
        </h2>
        <p className="text-sm text-secondary">
          Work weakest-first with the hint ladder. Fewer hints ⇒ more mastery
          credit. Every topic must clear its bar before you advance.
        </p>
      </header>

      <GatePanel prog={prog} target={round?.target ?? null} />

      {prog.done ? (
        <div className="panel-ruled p-6 text-center" data-testid="drilling-cleared">
          <span className="label text-accent">Stage 6 gate</span>
          <div className="mt-2 font-display text-3xl font-black leading-tight text-bull">
            Cleared
          </div>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            Content, timed, and both competencies all clear their bars. Advancing
            to the mock stage.
          </p>
        </div>
      ) : round === null ? (
        <div className="panel flex items-center gap-2.5 p-6 font-mono text-sm text-muted">
          <span className="cursor" aria-hidden />
          Preparing your next drill…
        </div>
      ) : round.serve === "numeric" ? (
        <NumericDrillRound
          key={`${round.target.topicKey}-${round.items[0]?.question.id}`}
          target={round.target}
          items={round.items}
          record={record}
          onDone={onRoundDone}
        />
      ) : round.serve === "timed-drill" ? (
        <TimedDrillRound
          key={`timed-${round.target.topicKey}-${round.items[0]?.question.id}`}
          target={round.target}
          items={round.items}
          recordTimed={recordTimed}
          onDone={onRoundDone}
        />
      ) : round.serve === "brainteaser" ? (
        <BrainteaserDrillRound
          key={`bt-${round.items[0]?.flashcard.id ?? "x"}`}
          items={round.items}
          record={record}
          onDone={onRoundDone}
        />
      ) : round.serve === "trading" ? (
        <TradingStationRound
          key={round.target.topicKey ?? "trading"}
          target={round.target}
          onDone={onRoundDone}
        />
      ) : (
        <TimedInfoPanel target={round.target} onContinue={onRoundDone} />
      )}
    </section>
  );
}

/* ========================================================================== */
/*  Live gate panel                                                            */
/* ========================================================================== */

function GatePanel({
  prog,
  target,
}: {
  prog: ReturnType<typeof drillingProgress>;
  target: DrillTarget | null;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="drilling-gates">
        <GateStat
          label="Content"
          value={`${prog.contentMastered}/${prog.contentTotal}`}
          ok={prog.contentMastered === prog.contentTotal}
        />
        <GateStat label="Timed" value={prog.timedClear ? "Clear" : "Open"} ok={prog.timedClear} />
        <GateStat
          label="Brainteaser"
          value={prog.brainteaserMastered ? "Clear" : "Open"}
          ok={prog.brainteaserMastered}
        />
        <GateStat
          label="Trading"
          value={`${prog.tradingSubtopicsMastered}/${prog.tradingSubtopicTotal}`}
          ok={prog.tradingMastered}
        />
      </div>
      {target && !prog.done && (
        <div className="rule-row">
          <span className="label text-muted">Now drilling</span>
          <span className="text-sm font-semibold text-primary" data-testid="drilling-target">
            {target.label}
          </span>
        </div>
      )}
    </div>
  );
}

function GateStat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="stat">
      <div className="label text-muted">{label}</div>
      <div className={`num text-lg font-semibold ${ok ? "text-bull" : "text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Content drill (free-response + answer-withholding hint ladder)            */
/* ========================================================================== */

function NumericDrillRound({
  target,
  items,
  record,
  onDone,
}: {
  target: DrillTarget;
  items: MaterializedNumericItem[];
  record: (a: ItemAttempt) => void;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const item = items[index];
  const isLast = index >= items.length - 1;

  const next = () => {
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  };

  return (
    <div className="space-y-3" data-testid="drilling-numeric">
      <div className="rule-row">
        <span className="label text-muted">
          {target.label} · item <span className="num text-primary">{index + 1}</span> /{" "}
          <span className="num">{items.length}</span>
        </span>
      </div>
      <NumericDrillItem
        key={item.question.id + index}
        item={item}
        section={target.label}
        isLast={isLast}
        onResolve={(r) => record(buildContentDrillAttempt(item, r))}
        onNext={next}
      />
    </div>
  );
}

function NumericDrillItem({
  item,
  section,
  isLast,
  onResolve,
  onNext,
}: {
  item: MaterializedNumericItem;
  /** The drill topic label, threaded into the hint ladder for topic-aware hints. */
  section: string;
  isLast: boolean;
  onResolve: (r: ContentDrillResult) => void;
  onNext: () => void;
}) {
  const { question } = item;
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [episode, setEpisode] = useState<HintEpisode>(() => startEpisode());
  const [lastWrong, setLastWrong] = useState<number | null>(null);
  const firstWrongRef = useRef<number | undefined>(undefined);
  const resolvedRef = useRef(false);

  const resolved = isResolved(episode);
  const isCorrect = episode.status === "correct";

  const ladder = useMemo(
    () =>
      lastWrong !== null
        ? buildHintLadder({
            question,
            chosenValue: lastWrong,
            misconceptionTag: resolveNumericTag(question, lastWrong),
            section,
          })
        : null,
    [question, lastWrong, section],
  );

  // Rung-3 worked sibling for the drill item. Adapter (hard-ceiling) items can
  // regenerate a genuine same-family instance with different numbers; authored
  // singletons cannot, so this is null and the ladder drops the worked-sibling
  // rung (header ⇔ steps invariant — no orphan header).
  const sibling = useMemo(() => {
    if (!ladder) return null;
    const level = drillWorkedSiblingLevel(item);
    return level ? buildWorkedSibling({ level, question }) : null;
  }, [ladder, item, question]);

  const submit = () => {
    if (resolved) return;
    const g = gradeFreeResponse(question, raw);
    if (g.parsed === null) {
      setError("Enter a number, fraction, or expression (e.g. 2.8 or 1/3).");
      return;
    }
    setError(null);
    const nextEp = submitAttempt(episode, g.correct);
    setEpisode(nextEp);
    if (!g.correct) {
      if (firstWrongRef.current === undefined) firstWrongRef.current = g.parsed;
      setLastWrong(g.parsed);
      setRaw("");
    }
    if (isResolved(nextEp) && !resolvedRef.current) {
      resolvedRef.current = true;
      onResolve({
        correct: nextEp.status === "correct",
        highestRung: nextEp.highestRung,
        finalValue: g.parsed,
        firstWrongValue: firstWrongRef.current,
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {question.concept && (
          <span className="chip border-subtle text-secondary">{question.concept}</span>
        )}
        <p className="font-display text-lg font-semibold leading-relaxed text-primary">
          {question.prompt}
        </p>
      </div>

      {!resolved && (
        <div className="space-y-3">
          <input
            autoFocus
            inputMode={question.decimals != null ? "decimal" : "numeric"}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Type a number — e.g. 0.25, 3/8, 5%"
            aria-label="Your answer"
            className="input"
          />
          {error && <p className="text-sm text-bear">{error}</p>}
          <button type="button" className="btn-primary w-full" onClick={submit} disabled={raw.trim() === ""}>
            {episode.revealed > 0 ? "Re-attempt ▸" : "Submit ▸"}
          </button>
          {episode.revealed > 0 && (
            <p className="text-xs text-muted">
              Not quite. Read the coaching below, then re-enter your answer.
            </p>
          )}
        </div>
      )}

      {ladder && episode.revealed > 0 && (
        <HintLadder
          rungs={ladder}
          siblingWorked={sibling}
          controlledRevealed={episode.revealed}
        />
      )}

      {resolved && (
        <div className="space-y-3">
          <div
            className={`verdict ${isCorrect ? "bg-bull text-bg" : "bg-bear text-bg"}`}
            data-testid="drilling-item-result"
          >
            {isCorrect
              ? episode.highestRung === 0
                ? "● Correct"
                : `● Correct after ${episode.highestRung} hint${episode.highestRung > 1 ? "s" : ""}`
              : "● Not quite"}
          </div>
          <div className="reveal">
            {!isCorrect && (
              <p>
                <span className="label text-secondary">Answer · </span>
                <span className="num font-semibold">{formatNumericAnswer(question)}</span>
                {question.unit ? ` ${question.unit}` : ""}
              </p>
            )}
            <p className="text-secondary">{question.explanation}</p>
          </div>
          <button type="button" className="btn-primary w-full" onClick={onNext}>
            {isLast ? "Finish round ▸" : "Next ▸"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*  Timed drill (shot-clocked per-topic retake → rewrites pipeline.timed)      */
/* ========================================================================== */

/**
 * A SHOT-CLOCKED, per-topic timed retake for a content-mastered-but-slow topic.
 * It streams the SAME untimed-materializer free-response items (drawn by
 * `drawContentDrill`) but under a per-question clock reusing the Game-OA kit's
 * {@link useShotClock} / {@link TimerBar} — a timeout auto-advances and counts
 * as a MISS, exactly like the timed diagnostic. On completion it reports the
 * topic's `correct/total` up via `recordTimed`, which merges a per-topic timed
 * section into `pipeline.timed` (superseding the topic's failing section) so a
 * genuinely fast+accurate retake can flip the 0.90 timed gate. No hints here:
 * this measures the speed of correct thinking, not scaffolded recovery.
 */
function TimedDrillRound({
  target,
  items,
  recordTimed,
  onDone,
}: {
  target: DrillTarget;
  items: MaterializedNumericItem[];
  recordTimed: (topicKey: string, correct: number, total: number) => void;
  onDone: () => void;
}) {
  const topicKey = target.topicKey as string;
  const total = items.length;
  const [index, setIndex] = useState(0);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const correctRef = useRef(0);
  const doneRef = useRef(false);

  const item = items[index];

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFinished(true);
    recordTimed(topicKey, correctRef.current, total);
    onDone();
  }, [recordTimed, topicKey, total, onDone]);

  // Advance to the next item (or finish after the last). Shared by a manual
  // submit and a shot-clock timeout so both paths stay in lockstep.
  const advance = useCallback(() => {
    setRaw("");
    setError(null);
    if (index + 1 >= total) finish();
    else setIndex((i) => i + 1);
  }, [index, total, finish]);

  // A miss on timeout — do NOT credit, then advance the same way a submit does.
  const onTimeout = useCallback(() => {
    if (doneRef.current) return;
    advance();
  }, [advance]);

  const { remainingMs } = useShotClock({
    durationMs: TIMED_DRILL_BUDGET_MS,
    running: !finished,
    onExpire: onTimeout,
    resetKey: index,
  });

  const submit = () => {
    if (doneRef.current) return;
    const g = gradeFreeResponse(item.question, raw);
    if (g.parsed === null) {
      setError("Enter a number, fraction, or expression (e.g. 2.8 or 1/3).");
      return;
    }
    if (g.correct) correctRef.current += 1;
    advance();
  };

  if (!item) return null;

  return (
    <div className="space-y-3" data-testid="drilling-timed-drill">
      <TimerBar remainingMs={remainingMs} durationMs={TIMED_DRILL_BUDGET_MS} />
      <div className="rule-row">
        <span className="label text-muted">
          {target.label} · timed item{" "}
          <span className="num text-primary">{index + 1}</span> /{" "}
          <span className="num">{total}</span>
        </span>
        <span className="chip num border-bull text-bull">
          {correctRef.current} correct
        </span>
      </div>

      <div className="space-y-2">
        {item.question.concept && (
          <span className="chip border-subtle text-secondary">
            {item.question.concept}
          </span>
        )}
        <p className="font-display text-lg font-semibold leading-relaxed text-primary">
          {item.question.prompt}
        </p>
      </div>

      <div className="space-y-3">
        <input
          autoFocus
          key={item.question.id + index}
          inputMode={item.question.decimals != null ? "decimal" : "numeric"}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Beat the clock — type your answer"
          aria-label="Your answer"
          className="input"
        />
        {error && <p className="text-sm text-bear">{error}</p>}
        <button
          type="button"
          className="btn-primary w-full"
          onClick={submit}
          disabled={raw.trim() === ""}
        >
          {index + 1 >= total ? "Finish timed round ▸" : "Submit ▸"}
        </button>
      </div>

      <p className="text-center text-xs text-muted">
        Under the clock — a timeout counts as a miss. Clear ≥ 90% to pass the
        timed gate for this topic.
      </p>
    </div>
  );
}

/* ========================================================================== */
/*  Brainteaser competency drill (hybrid grading)                             */
/* ========================================================================== */

function BrainteaserDrillRound({
  items,
  record,
  onDone,
}: {
  items: MaterializedBrainteaserItem[];
  record: (a: ItemAttempt) => void;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const item = items[index];
  const isLast = index >= items.length - 1;
  const next = () => {
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  };

  if (!item) return <div className="panel p-6 text-sm text-muted">No brainteasers available.</div>;

  return (
    <div className="space-y-3" data-testid="drilling-brainteaser">
      <div className="rule-row">
        <span className="label text-muted">
          Brainteaser reasoning · item{" "}
          <span className="num text-primary">{index + 1}</span> /{" "}
          <span className="num">{items.length}</span>
        </span>
      </div>
      <BrainteaserDrillItem
        key={item.flashcard.id + index}
        item={item}
        isLast={isLast}
        onResolve={(got) => record(buildBrainteaserDrillAttempt(got))}
        onNext={next}
      />
    </div>
  );
}

function BrainteaserDrillItem({
  item,
  isLast,
  onResolve,
  onNext,
}: {
  item: MaterializedBrainteaserItem;
  isLast: boolean;
  onResolve: (got: boolean) => void;
  onNext: () => void;
}) {
  const { flashcard, numericGradable } = item;
  const [entry, setEntry] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState<boolean | null>(null);

  const commitNumeric = () => {
    if (graded !== null || entry.trim() === "") return;
    const value = parseFreeResponse(entry);
    const got = value !== null && gradeBrainteaserNumeric(flashcard, value);
    setGraded(got);
    setRevealed(true);
    onResolve(got);
  };
  const selfEval = (got: boolean) => {
    if (graded !== null) return;
    setGraded(got);
    onResolve(got);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="chip border-accent text-accent">Brainteaser</span>
        <p className="font-display text-lg font-semibold leading-relaxed text-primary">
          {flashcard.prompt}
        </p>
      </div>

      {numericGradable ? (
        graded === null ? (
          <div className="space-y-3">
            <input
              autoFocus
              inputMode="decimal"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNumeric();
              }}
              placeholder="Enter your numeric answer"
              aria-label="Your brainteaser answer"
              className="input"
            />
            <button type="button" className="btn-primary w-full" onClick={commitNumeric} disabled={entry.trim() === ""}>
              Commit &amp; reveal
            </button>
          </div>
        ) : (
          <RevealBlock flashcard={flashcard} good={graded} onNext={onNext} isLast={isLast} />
        )
      ) : !revealed ? (
        <button type="button" className="btn-secondary w-full" onClick={() => setRevealed(true)}>
          Show answer
        </button>
      ) : graded === null ? (
        <div className="space-y-3">
          <RevealBody flashcard={flashcard} />
          <div className="flex gap-3">
            <button type="button" className="btn-primary flex-1" onClick={() => selfEval(true)}>
              I got it
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => selfEval(false)}>
              I missed it
            </button>
          </div>
        </div>
      ) : (
        <RevealBlock flashcard={flashcard} good={graded} onNext={onNext} isLast={isLast} />
      )}
    </div>
  );
}

function RevealBody({ flashcard }: { flashcard: MaterializedBrainteaserItem["flashcard"] }) {
  return (
    <div className="reveal">
      <p>
        <span className="label text-secondary">Answer · </span>
        <span className="text-primary">{flashcard.answer}</span>
      </p>
      <p className="text-secondary">{flashcard.explanation}</p>
    </div>
  );
}

function RevealBlock({
  flashcard,
  good,
  onNext,
  isLast,
}: {
  flashcard: MaterializedBrainteaserItem["flashcard"];
  good: boolean;
  onNext: () => void;
  isLast: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className={`verdict ${good ? "bg-bull text-bg" : "bg-bear text-bg"}`}>
        {good ? "● Got it" : "● Missed"}
      </div>
      <RevealBody flashcard={flashcard} />
      <button type="button" className="btn-primary w-full" onClick={onNext}>
        {isLast ? "Finish round ▸" : "Next ▸"}
      </button>
    </div>
  );
}

/* ========================================================================== */
/*  Trading SUBTOPIC drill — re-mount the weak subtopic's Game-OA station       */
/* ========================================================================== */

/**
 * Re-drill a weak trading subtopic by mounting its EXACT Game-OA battery station
 * (the same game that seeded it). The station folds its rounds into the subtopic
 * Beta itself (via `useStationFold`), so this wrapper only needs to look the
 * station up by the target's subtopic key and advance the loop when it finishes.
 */
function TradingStationRound({
  target,
  onDone,
}: {
  target: DrillTarget;
  onDone: () => void;
}) {
  // A stable per-mount seed so the re-drilled station's content is reproducible
  // across re-renders (same contract as the diagnostics / battery mounts).
  const seedRef = useRef<number>(Math.floor(Math.random() * 1e9));
  const station = target.topicKey
    ? stationForSubtopic(target.topicKey)
    : undefined;

  if (!station) {
    // No station for this key (should never happen for a trading target) —
    // don't stall the loop.
    return (
      <div className="note" data-testid="drilling-trading">
        <p className="font-semibold text-primary">{target.label}</p>
        <p className="mt-1 leading-relaxed">{target.reason}</p>
        <button type="button" className="btn-primary mt-3 w-full" onClick={onDone}>
          Continue ▸
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="drilling-trading">
      <div className="rule-row">
        <span className="label text-muted">
          {station.title} · <span className="text-secondary">{station.skillLabel}</span>
        </span>
      </div>
      <Suspense
        fallback={
          <div className="panel-ruled p-8 text-center text-sm text-muted">
            Loading game…
          </div>
        }
      >
        <station.Component seed={seedRef.current} onComplete={onDone} />
      </Suspense>
    </div>
  );
}

/* ========================================================================== */
/*  Timed-overlay residual info                                                */
/* ========================================================================== */

function TimedInfoPanel({
  target,
  onContinue,
}: {
  target: DrillTarget;
  onContinue: () => void;
}) {
  return (
    <div className="note" data-testid="drilling-timed-info">
      <p className="font-semibold text-primary">{target.label}</p>
      <p className="mt-1 leading-relaxed">{target.reason}</p>
      {/* V1 backstop: a Continue affordance so this residual panel can never be a
          dead end — dismissing it re-drives the loop to the next weak target. */}
      <button
        type="button"
        className="btn-primary mt-3 w-full"
        data-testid="drilling-timed-info-continue"
        onClick={onContinue}
      >
        Continue ▸
      </button>
    </div>
  );
}
