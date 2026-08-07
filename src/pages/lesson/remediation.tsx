import { useEffect, useRef, useState } from "react";
import { useProgress } from "@/context/ProgressContext";
import { isAiLayerEnabled, requestFlavoredVariant } from "@/lib/aiFlavor";
import { resolveFlavoredItem } from "@/lib/flavorPractice";
import { numericMatches } from "@/lib/numeric";
import {
  freshPracticeSeed,
  generateFreshQuestion,
  generateFreshNumericQuestion,
  questionSignature,
  numericSignature,
} from "@/lib/regenerate";
import { isNodeCleared } from "@/lib/remediation/climbBack";
import {
  buildTargetedMistakeItems,
  type TargetedItem,
} from "@/lib/remediation/targetedPractice";
import { Rng } from "@/lib/rng";
import {
  probeTierFor,
  remediationStep,
  type RemediationAction,
  type RemediationInput,
} from "@/lib/remediation/policy";
import { buildProbeItem, type ProbeItem } from "@/lib/remediation/probe";
import {
  descendTo,
  startRemediation,
  type RemediationSession,
} from "@/lib/remediation/session";
import {
  resolveQuizTag,
  resolveNumericTag,
  resolveQuizMisconceptionKeys,
  resolveNumericMisconceptionKeys,
} from "@/lib/tutor/misconception";
import {
  misconceptionTagOf,
  prereqNode,
} from "@/content/remediation/prereqDAG";
import {
  QuizCard,
  NumericCard,
  PracticeHeader,
} from "@/pages/lesson/cards";
import type {
  Difficulty,
  Level,
  Question,
  NumericQuestion,
} from "@/types/content";

/* -------------------------------------------------------------------------- */
/*  Remediation (Phase 4) — bounded backtracking down the prerequisite DAG.    */
/*                                                                             */
/*  Triggered on a REPEATED miss (never the first) when `remediationStep`      */
/*  decides to descend/teach. It walks DOWN the static DAG, probing each        */
/*  prerequisite at its ~85%-predicted tier, stops at the first passed probe    */
/*  (teach the edge up), the graph floor, or the depth cap — then teaches the   */
/*  foundation using the SAME QuizCard/NumericCard + Phase-2 hint ladder.       */
/*                                                                             */
/*  Remediation items call `recordItemAttempt` for the PREREQ topic (so its     */
/*  mastery updates) but are ISOLATED like bonus practice: they never touch     */
/*  the round score, `recordAttempt`, resume, or `LevelProgress.mastered`.      */
/*  All policy logic lives in pure, tested `src/lib/remediation/**` modules;    */
/*  this component is a thin renderer. Guarded by `REMEDIATION_MODE === "dag"`. */
/* -------------------------------------------------------------------------- */

export function RemediationFlow({
  origin,
  onExit,
}: {
  /** The origin-node decision input built by the lesson player on a repeated miss. */
  origin: RemediationInput;
  onExit: () => void;
}) {
  const { recordItemAttempt, getTopicMastery } = useProgress();
  const [session, setSession] = useState<RemediationSession>(() =>
    startRemediation(origin.topicKey),
  );
  const [action, setAction] = useState<RemediationAction>(() =>
    remediationStep({ ...origin, depthThisSession: 0 }),
  );
  const [probe, setProbe] = useState<ProbeItem | null>(null);
  const [teachItem, setTeachItem] = useState<ProbeItem | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [entered, setEntered] = useState<number | null>(null);
  const [pending, setPending] = useState<RemediationAction | null>(null);
  const shownAtRef = useRef<number>(Date.now());

  // Materialize content for the current decision: a probe on `descend`, a worked
  // example on `teach-link`/`floor-teach`. Advancing the depth counter happens
  // here so it stays in lockstep with the descent.
  useEffect(() => {
    if (action.kind === "descend") {
      // Honor the policy's ~0.85-target probe tier (probe.ts degrades to the
      // node's easy levelRef when it has no such tier variant).
      const p = buildProbeItem(
        action.toTopicKey,
        freshPracticeSeed(),
        action.probeTier,
      );
      setProbe(p);
      setSelected(null);
      setEntered(null);
      setPending(null);
      shownAtRef.current = Date.now();
      setSession((s) => descendTo(s, action.toTopicKey));
      // No materializable item at the prereq ⇒ teach the foundation directly.
      if (!p) setAction({ kind: "floor-teach", atTopicKey: action.toTopicKey });
    } else if (action.kind === "teach-link" || action.kind === "floor-teach") {
      setTeachItem(buildProbeItem(action.atTopicKey, freshPracticeSeed()));
    }
     
  }, [action]);

  const answered = selected !== null || entered !== null;

  // Fold ONE probe answer into the PREREQ topic's mastery, then stage the next
  // descent/teach decision (applied on "Continue"). Never scores the round.
  const stageNext = (
    topicKey: string,
    correct: boolean,
    tag: string | undefined,
  ) => {
    const m = getTopicMastery(topicKey);
    setPending(
      remediationStep({
        topicKey,
        theta: m?.theta ?? 0,
        alpha: m?.alpha ?? 1,
        beta: m?.beta ?? 1,
        n: m?.n ?? 0,
        consecutiveMisses: correct ? 0 : 1,
        atFloorTier: true,
        misconceptionTag: tag,
        responseFast: false,
        depthThisSession: session.depth,
      }),
    );
  };

  const answerQuiz = (choice: number) => {
    if (!probe?.question || answered) return;
    const correct = choice === probe.question.correctIndex;
    setSelected(choice);
    recordItemAttempt({
      topicKey: probe.topicKey,
      tier: probe.level.difficulty,
      correct,
      mode: "quiz",
      kOptions: probe.question.choices.length,
      chosenIndex: choice,
      misconceptions: resolveQuizMisconceptionKeys(
        probe.topicKey,
        probe.question,
        choice,
      ),
      responseMs: Date.now() - shownAtRef.current,
      at: new Date().toISOString(),
    });
    stageNext(
      probe.topicKey,
      correct,
      correct
        ? undefined
        : misconceptionTagOf(resolveQuizTag(probe.question, choice)),
    );
  };

  const answerNumeric = (value: number) => {
    if (!probe?.numericQuestion || answered) return;
    const correct = numericMatches(probe.numericQuestion, value);
    setEntered(value);
    recordItemAttempt({
      topicKey: probe.topicKey,
      tier: probe.level.difficulty,
      correct,
      mode: "numeric",
      chosenValue: value,
      misconceptions: resolveNumericMisconceptionKeys(
        probe.topicKey,
        probe.numericQuestion,
        value,
      ),
      responseMs: Date.now() - shownAtRef.current,
      at: new Date().toISOString(),
    });
    stageNext(
      probe.topicKey,
      correct,
      correct
        ? undefined
        : misconceptionTagOf(resolveNumericTag(probe.numericQuestion, value)),
    );
  };

  const advance = () => {
    if (pending) setAction(pending);
  };

  const interstitial = (
    <div className="flex items-center justify-between">
      <span className="label text-accent">Shoring Up the Foundation</span>
      <span className="chip border-subtle text-secondary">
        Not scored · builds mastery
      </span>
    </div>
  );

  const teachNode =
    action.kind === "teach-link" || action.kind === "floor-teach"
      ? prereqNode(action.atTopicKey)
      : undefined;

  return (
    <div className="animate-print-in space-y-4 border-t-2 border-dashed border-accent pt-5">
      {interstitial}
      <p className="text-sm text-secondary">
        Good: you're in the productive zone, not simply &ldquo;wrong.&rdquo; Two
        misses in a row here usually means a foundation underneath needs a quick
        top-up. Let&rsquo;s check it, then climb straight back.
      </p>

      {action.kind === "descend" && probe && (
        <>
          <p className="text-xs text-muted">
            Prerequisite check ·{" "}
            <span className="text-secondary">{probe.level.title}</span>
          </p>
          {probe.mode === "quiz" && probe.question ? (
            <QuizCard
              key={probe.question.id}
              question={probe.question}
              number={0}
              total={0}
              answered={answered}
              selected={selected}
              isLast={false}
              onSelect={answerQuiz}
              onNext={advance}
              headerLabel="Foundation Probe"
              nextLabel="Continue ▸"
              hintLevel={probe.level}
            />
          ) : probe.numericQuestion ? (
            <NumericCard
              key={probe.numericQuestion.id}
              question={probe.numericQuestion}
              number={0}
              total={0}
              answered={answered}
              entered={entered}
              isLast={false}
              onSubmit={answerNumeric}
              onNext={advance}
              headerLabel="Foundation Probe"
              nextLabel="Continue ▸"
              hintLevel={probe.level}
            />
          ) : null}
        </>
      )}

      {teachNode && (
        <div className="panel p-5">
          <span className="label text-accent">
            {action.kind === "floor-teach"
              ? "Foundation · Start Here"
              : "Bridge Up · How It Composes"}
          </span>
          <h3 className="mt-2 font-display text-lg font-semibold text-primary">
            {teachNode.label}
          </h3>
          {teachNode.topicKey && teachItem?.level.lesson.keyIdea && (
            <div className="mt-3 border-l-2 border-accent bg-surface-muted px-4 py-3">
              <div className="label text-accent">Key idea</div>
              <div className="mt-1 font-display text-base font-semibold text-primary">
                {teachItem.level.lesson.keyIdea}
              </div>
            </div>
          )}
          {teachItem && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-primary">
                {teachItem.question?.prompt ?? teachItem.numericQuestion?.prompt}
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                {teachItem.question?.explanation ??
                  teachItem.numericQuestion?.explanation}
              </p>
            </div>
          )}
          <button onClick={onExit} className="btn-primary mt-4 w-full">
            Got the foundation. Resume the lesson ▸
          </button>
        </div>
      )}

      {action.kind === "exit" && (
        <div className="panel p-5">
          <p className="text-sm text-secondary">
            That looked like a slip more than a gap, so no detour needed. Keep
            going.
          </p>
          <button onClick={onExit} className="btn-primary mt-3 w-full">
            Resume the lesson ▸
          </button>
        </div>
      )}

      {action.kind === "retry-in-place" && (
        <div className="panel p-5">
          <p className="text-sm text-secondary">
            Let&rsquo;s ease the difficulty and try one more here before digging
            deeper.
          </p>
          <button onClick={onExit} className="btn-primary mt-3 w-full">
            Resume the lesson ▸
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Finish-time remediation (Phase 4) — the WHOLE descent → probe → climb-back */
/*  journey, auto-launched when a level is FINISHED below its mastery bar.      */
/*                                                                             */
/*  Unlike the mid-lesson `RemediationFlow` (a single descend/probe/teach step */
/*  interleaved into an in-progress round), this runs the full loop before the  */
/*  learner reaches the summary: it descends the prereq DAG from the failed     */
/*  topic (probing each prerequisite at its ~0.85 tier), teaches at the frontier*/
/*  / floor, then CLIMBS BACK up the visited path to the origin — re-serving one */
/*  probe per ancestor and reading the ~0.80 CI-low "node cleared" gate         */
/*  (`isNodeCleared`) as a progress cue. Every probe updates ONLY the PREREQ     */
/*  topic's mastery (isolated from the round score, exactly like bonus practice) */
/*  and the learner can ALWAYS bail to their results — never an inescapable loop.*/
/*  All decisions come from the same pure `remediation/**` modules.             */
/* -------------------------------------------------------------------------- */

export function FinishRemediation({
  origin,
  onDone,
}: {
  /** The origin-node decision input built by the lesson player at finish time. */
  origin: RemediationInput;
  /** Called when remediation is finished / skipped — the caller shows the summary. */
  onDone: () => void;
}) {
  const { progress, recordItemAttempt, getTopicMastery } = useProgress();

  const [session, setSession] = useState<RemediationSession>(() =>
    startRemediation(origin.topicKey),
  );
  const [action, setAction] = useState<RemediationAction>(() =>
    remediationStep({ ...origin, depthThisSession: 0 }),
  );
  const [probe, setProbe] = useState<ProbeItem | null>(null);
  const [teachItem, setTeachItem] = useState<ProbeItem | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [entered, setEntered] = useState<number | null>(null);
  const [pending, setPending] = useState<RemediationAction | null>(null);
  const [cleared, setCleared] = useState<boolean | null>(null);
  // Climb-back queue: ancestor topicKeys from the taught node UP to the origin.
  const [climb, setClimb] = useState<{ queue: string[]; i: number } | null>(
    null,
  );
  const shownAtRef = useRef<number>(Date.now());

  // Serve the probe/climb tier at the learner's ~0.85 band for that node. T12:
  // the adaptive engine refines this — the fitted IRT ability (when confident)
  // stands in for the incremental Elo θ, the per-tier Glicko difficulty ratings
  // sharpen the difficulty view, and a seeded RNG turns the hard argmin into
  // Thompson-sampled ZPD exploration so the climb-back varies within the band.
  const tierFor = (topicKey: string): Difficulty => {
    const m = getTopicMastery(topicKey);
    return probeTierFor(m?.theta ?? origin.theta, topicKey, progress.tierDifficulty ?? {}, {
      glickoD: progress.glickoDifficulty,
      irtAbility: m?.irtAbility,
      irtAbilitySe: m?.irtAbilitySe,
      rng: new Rng(freshPracticeSeed()),
    });
  };

  // Materialize content for the current DESCENT decision (the climb has its own
  // probe loader). Advancing the depth counter happens here in lockstep.
  useEffect(() => {
    if (climb) return;
    if (action.kind === "descend") {
      const p = buildProbeItem(
        action.toTopicKey,
        freshPracticeSeed(),
        action.probeTier,
      );
      setProbe(p);
      setSelected(null);
      setEntered(null);
      setPending(null);
      setCleared(null);
      shownAtRef.current = Date.now();
      setSession((s) => descendTo(s, action.toTopicKey));
      // No materializable item at the prereq ⇒ teach the foundation directly.
      if (!p) setAction({ kind: "floor-teach", atTopicKey: action.toTopicKey });
    } else if (action.kind === "teach-link" || action.kind === "floor-teach") {
      setTeachItem(buildProbeItem(action.atTopicKey, freshPracticeSeed()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const answered = selected !== null || entered !== null;

  // Fold ONE probe answer into the current node's mastery, note the ~0.80 clear
  // gate, and (on a DESCENT probe) stage the next descend/teach decision.
  const afterAnswer = (
    topicKey: string,
    correct: boolean,
    tag: string | undefined,
  ) => {
    const m = getTopicMastery(topicKey);
    setCleared(isNodeCleared(m?.alpha ?? 1, m?.beta ?? 1, correct ? 1 : 0));
    if (climb) return; // the climb advances via its own "Continue" button
    setPending(
      remediationStep({
        topicKey,
        theta: m?.theta ?? 0,
        alpha: m?.alpha ?? 1,
        beta: m?.beta ?? 1,
        n: m?.n ?? 0,
        consecutiveMisses: correct ? 0 : 1,
        atFloorTier: true,
        misconceptionTag: tag,
        responseFast: false,
        depthThisSession: session.depth,
      }),
    );
  };

  const answerQuiz = (choice: number) => {
    if (!probe?.question || answered) return;
    const correct = choice === probe.question.correctIndex;
    setSelected(choice);
    recordItemAttempt({
      topicKey: probe.topicKey,
      tier: probe.level.difficulty,
      correct,
      mode: "quiz",
      kOptions: probe.question.choices.length,
      chosenIndex: choice,
      misconceptions: resolveQuizMisconceptionKeys(
        probe.topicKey,
        probe.question,
        choice,
      ),
      responseMs: Date.now() - shownAtRef.current,
      at: new Date().toISOString(),
    });
    afterAnswer(
      probe.topicKey,
      correct,
      correct
        ? undefined
        : misconceptionTagOf(resolveQuizTag(probe.question, choice)),
    );
  };

  const answerNumeric = (value: number) => {
    if (!probe?.numericQuestion || answered) return;
    const correct = numericMatches(probe.numericQuestion, value);
    setEntered(value);
    recordItemAttempt({
      topicKey: probe.topicKey,
      tier: probe.level.difficulty,
      correct,
      mode: "numeric",
      chosenValue: value,
      misconceptions: resolveNumericMisconceptionKeys(
        probe.topicKey,
        probe.numericQuestion,
        value,
      ),
      responseMs: Date.now() - shownAtRef.current,
      at: new Date().toISOString(),
    });
    afterAnswer(
      probe.topicKey,
      correct,
      correct
        ? undefined
        : misconceptionTagOf(resolveNumericTag(probe.numericQuestion, value)),
    );
  };

  const advanceDescend = () => {
    if (pending) setAction(pending);
  };

  // Load the next climb-back probe (or finish if that ancestor can't be probed —
  // bounded, never trapping the learner).
  const loadClimbProbe = (topicKey: string) => {
    const p = buildProbeItem(topicKey, freshPracticeSeed(), tierFor(topicKey));
    setProbe(p);
    setSelected(null);
    setEntered(null);
    setCleared(null);
    shownAtRef.current = Date.now();
    return p;
  };

  // Begin the climb back: re-serve each ancestor from just above the taught node
  // up to (and including) the origin. Nothing to climb ⇒ straight to results.
  const startClimb = () => {
    const queue: string[] = [];
    for (let d = session.depth - 1; d >= 0; d--) queue.push(session.path[d]);
    let start = 0;
    while (start < queue.length && !loadClimbProbe(queue[start])) start++;
    if (start >= queue.length) {
      onDone();
      return;
    }
    setClimb({ queue, i: start });
  };

  const advanceClimb = () => {
    if (!climb) return;
    let next = climb.i + 1;
    while (next < climb.queue.length && !loadClimbProbe(climb.queue[next]))
      next++;
    if (next >= climb.queue.length) {
      onDone();
      return;
    }
    setClimb({ queue: climb.queue, i: next });
  };

  const teachNode =
    !climb && (action.kind === "teach-link" || action.kind === "floor-teach")
      ? prereqNode(action.atTopicKey)
      : undefined;

  const showProbe =
    !!probe && (climb !== null || action.kind === "descend");
  const onProbeNext = climb ? advanceClimb : advanceDescend;

  return (
    <div className="animate-print-in space-y-4 border-t-2 border-dashed border-accent pt-5">
      <div className="flex items-center justify-between">
        <span className="label text-accent">
          Foundation Check Before You Move On
        </span>
        <span className="chip border-subtle text-secondary">
          Not scored · builds mastery
        </span>
      </div>
      <p className="text-sm text-secondary">
        That attempt finished below the mastery bar. Instead of moving on with a
        gap, let&rsquo;s quickly check the foundation underneath this topic and
        shore it up, then climb straight back and review your results.
      </p>

      {showProbe && probe && (
        <>
          <p className="text-xs text-muted">
            {climb ? "Climbing back · " : "Prerequisite check · "}
            <span className="text-secondary">{probe.level.title}</span>
          </p>
          {probe.mode === "quiz" && probe.question ? (
            <QuizCard
              key={probe.question.id}
              question={probe.question}
              number={0}
              total={0}
              answered={answered}
              selected={selected}
              isLast={false}
              onSelect={answerQuiz}
              onNext={onProbeNext}
              headerLabel={climb ? "Climb-Back Check" : "Foundation Probe"}
              nextLabel="Continue ▸"
              hintLevel={probe.level}
            />
          ) : probe.numericQuestion ? (
            <NumericCard
              key={probe.numericQuestion.id}
              question={probe.numericQuestion}
              number={0}
              total={0}
              answered={answered}
              entered={entered}
              isLast={false}
              onSubmit={answerNumeric}
              onNext={onProbeNext}
              headerLabel={climb ? "Climb-Back Check" : "Foundation Probe"}
              nextLabel="Continue ▸"
              hintLevel={probe.level}
            />
          ) : null}
          {answered && cleared !== null && (
            <p className="text-xs text-muted">
              {cleared
                ? "Looking solid here. Climbing back toward the topic."
                : "Let’s keep shoring this up as we climb back."}
            </p>
          )}
        </>
      )}

      {teachNode && (
        <div className="panel p-5">
          <span className="label text-accent">
            {action.kind === "floor-teach"
              ? "Foundation · Start Here"
              : "Bridge Up · How It Composes"}
          </span>
          <h3 className="mt-2 font-display text-lg font-semibold text-primary">
            {teachNode.label}
          </h3>
          {teachNode.topicKey && teachItem?.level.lesson.keyIdea && (
            <div className="mt-3 border-l-2 border-accent bg-surface-muted px-4 py-3">
              <div className="label text-accent">Key idea</div>
              <div className="mt-1 font-display text-base font-semibold text-primary">
                {teachItem.level.lesson.keyIdea}
              </div>
            </div>
          )}
          {teachItem && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-primary">
                {teachItem.question?.prompt ?? teachItem.numericQuestion?.prompt}
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                {teachItem.question?.explanation ??
                  teachItem.numericQuestion?.explanation}
              </p>
            </div>
          )}
          <button onClick={startClimb} className="btn-primary mt-4 w-full">
            {session.depth > 0
              ? "Got it. Climb back up ▸"
              : "Got the foundation. See results ▸"}
          </button>
        </div>
      )}

      {!climb && action.kind === "exit" && (
        <div className="panel p-5">
          <p className="text-sm text-secondary">
            That looked more like a slip than a gap, so no detour needed.
          </p>
          <button onClick={onDone} className="btn-primary mt-3 w-full">
            See my results ▸
          </button>
        </div>
      )}

      {!climb && action.kind === "retry-in-place" && (
        <div className="panel p-5">
          <p className="text-sm text-secondary">
            Let&rsquo;s ease the difficulty and size a fresh set when you&rsquo;re
            ready.
          </p>
          <button onClick={onDone} className="btn-primary mt-3 w-full">
            See my results ▸
          </button>
        </div>
      )}

      {/* Always-available escape: never trap the learner in a remediation loop. */}
      <button onClick={onDone} className="btn-ghost w-full text-sm">
        Skip remediation: see my results ▸
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Targeted repeated-mistake practice (ZPD) — UNSCORED drill of ONE error mode */
/*                                                                             */
/*  Launched from the lesson-finish "you made this specific mistake N times"   */
/*  feedback. It serves a small set of the SAME topic's questions that trip     */
/*  EXACTLY that misconception tag (via `buildTargetedMistakeItems`), rendered  */
/*  with the plain QuizCard/NumericCard. It is RE-PREP ONLY: it NEVER calls      */
/*  `recordItemAttempt`, so it can't move any topic's mastery (exactly like     */
/*  bonus practice). Grading/feedback is the card's local display grade.        */
/* -------------------------------------------------------------------------- */

export function TargetedMistakePractice({
  topicKey,
  tag,
  label,
  onClose,
}: {
  topicKey: string;
  /** The misconception tag to drill (bare, no topicKey prefix). */
  tag: string;
  /** Learner-facing description of the mistake (from MISCONCEPTION_LABELS). */
  label: string;
  onClose: () => void;
}) {
  // Build the fixed targeted set once (deterministic in a fresh seed). Never
  // scored — no `recordItemAttempt` anywhere in this component.
  const [items] = useState<TargetedItem[]>(() =>
    buildTargetedMistakeItems(topicKey, tag, freshPracticeSeed(), 5),
  );
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [entered, setEntered] = useState<number | null>(null);

  const item = items[idx];
  const answered = selected !== null || entered !== null;
  const isLast = idx >= items.length - 1;

  const advance = () => {
    if (isLast) {
      onClose();
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setEntered(null);
  };

  const header = (
    <div className="flex items-center justify-between">
      <span className="label text-accent">Targeted Practice · Just This Mistake</span>
      <span className="chip border-subtle text-secondary">Not scored · re-prep only</span>
    </div>
  );

  // No item carried the tag (rare/untagged error mode) ⇒ graceful fallback.
  if (!item) {
    return (
      <div className="animate-print-in space-y-3 border-t-2 border-dashed border-accent pt-5">
        {header}
        <p className="text-sm text-secondary">
          We couldn&rsquo;t assemble a targeted set for &ldquo;{label}&rdquo; right
          now. Re-running the lesson will keep surfacing this error when it comes up.
        </p>
        <button onClick={onClose} className="btn-primary w-full">
          Back to results ▸
        </button>
      </div>
    );
  }

  return (
    <div className="animate-print-in space-y-3 border-t-2 border-dashed border-accent pt-5">
      {header}
      <p className="text-sm text-secondary">
        Drilling one thing only: <span className="font-semibold text-primary">{label}</span>.
        These don&rsquo;t affect your score or mastery — they&rsquo;re pure reps on
        the exact spot that keeps tripping you.
      </p>
      <p className="text-xs text-muted">
        Rep {idx + 1} / {items.length}
      </p>
      {item.mode === "quiz" && item.question ? (
        <QuizCard
          key={`${item.question.id}-tm`}
          question={item.question}
          number={0}
          total={0}
          answered={answered}
          selected={selected}
          isLast={isLast}
          onSelect={(i) => setSelected(i)}
          onNext={advance}
          headerLabel="Targeted Rep"
          nextLabel={isLast ? "Done ▸" : "Next rep ▸"}
          hintLevel={item.level}
        />
      ) : item.numericQuestion ? (
        <NumericCard
          key={`${item.numericQuestion.id}-tm`}
          question={item.numericQuestion}
          number={0}
          total={0}
          answered={answered}
          entered={entered}
          isLast={isLast}
          onSubmit={(v) => setEntered(v)}
          onNext={advance}
          headerLabel="Targeted Rep"
          nextLabel={isLast ? "Done ▸" : "Next rep ▸"}
          hintLevel={item.level}
        />
      ) : null}
      <button onClick={onClose} className="btn-ghost w-full text-sm">
        Done with this drill ▸
      </button>
    </div>
  );
}

export function QuizPractice({
  level,
  current,
  roundSigs,
  bonusSigsRef,
}: {
  level: Level;
  /** The on-screen question this practice is attached to (for family preservation). */
  current: Question;
  /** Signatures of ALL of this run's original questions (incl. upcoming ones). */
  roundSigs: ReadonlySet<string>;
  /** Accumulates signatures of bonuses generated this run (survives remounts). */
  bonusSigsRef: React.MutableRefObject<Set<string>>;
}) {
  // The optional LLM flavor layer is OFF by default: when disabled, this
  // component renders BYTE-IDENTICALLY to the plain parametric practice below.
  const aiEnabled = isAiLayerEnabled();
  const [item, setItem] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // The run-wide avoid-set: every original question this round + every bonus
  // already generated this run. A new bonus must differ from ALL of them.
  const avoidSet = (): Set<string> =>
    new Set([...roundSigs, ...bonusSigsRef.current]);
  const remember = (q: Question) => bonusSigsRef.current.add(questionSignature(q));

  // Button #1 — "Generate another like this": STRICTLY the same family as the
  // current on-screen item (new seed → same concept, different numbers). We pass
  // `current.family` + `lockFamily = true` so regenerate locks to that family
  // (inferring it if the tag is missing), and the whole run-wide avoid-set so it
  // never collides with any original OR earlier bonus.
  const generate = () => {
    const fresh = generateFreshQuestion(
      level,
      freshPracticeSeed(),
      current.family,
      avoidSet(),
      true,
      current,
    );
    if (fresh) remember(fresh);
    setItem(fresh);
    setSelected(null);
  };

  // Button #2 — "✨ Fresh variant" (AI): intentional variety WITHIN THE LEVEL.
  // We DELIBERATELY do NOT pass a family, so the whole-level mix may land on a
  // sibling family, then the flavor layer reskins ONLY the prompt. The run-wide
  // avoid-set still applies. On null / guardrail-rejected fallback we keep the
  // fresh parametric item verbatim (safe degrade). The solver
  // answer/options/explanation stay the parametric truth.
  const generateFlavored = async () => {
    const fresh = generateFreshQuestion(
      level,
      freshPracticeSeed(),
      undefined,
      avoidSet(),
      false,
      current,
    );
    if (!fresh) return;
    remember(fresh);
    setBusy(true);
    try {
      const variant = await requestFlavoredVariant(fresh);
      setItem(resolveFlavoredItem(fresh, variant));
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  // With AI on, advancing returns to the chooser so either path stays reachable.
  const reset = () => {
    setItem(null);
    setSelected(null);
  };

  const answered = selected !== null;

  return (
    <div className="space-y-4 border-t-2 border-dashed border-subtle pt-5">
      <PracticeHeader />
      {!item ? (
        <>
          <p className="text-sm text-secondary">
            Want more reps on this idea? Generate a brand-new same-concept
            question with fresh numbers. It won't affect your score or mastery.
          </p>
          {aiEnabled ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={generate}
                disabled={busy}
                className="btn-secondary w-full disabled:opacity-60"
              >
                Generate another like this ↻
              </button>
              <button
                onClick={generateFlavored}
                disabled={busy}
                aria-busy={busy}
                className="btn-secondary w-full disabled:opacity-60"
              >
                {busy ? "✨ Reskinning…" : "✨ Fresh variant"}
              </button>
            </div>
          ) : (
            <button onClick={generate} className="btn-secondary w-full">
              Generate another like this ↻
            </button>
          )}
        </>
      ) : (
        <QuizCard
          key={item.id}
          question={item}
          number={0}
          total={0}
          answered={answered}
          selected={selected}
          isLast={false}
          onSelect={(i) => setSelected(i)}
          onNext={aiEnabled ? reset : generate}
          headerLabel="Bonus Practice"
          nextLabel={aiEnabled ? "Practice another ↻" : "Generate another like this ↻"}
          hintLevel={level}
        />
      )}
    </div>
  );
}

export function NumericPractice({
  level,
  current,
  roundSigs,
  bonusSigsRef,
}: {
  level: Level;
  /** The on-screen question this practice is attached to (for family preservation). */
  current: NumericQuestion;
  /** Signatures of ALL of this run's original questions (incl. upcoming ones). */
  roundSigs: ReadonlySet<string>;
  /** Accumulates signatures of bonuses generated this run (survives remounts). */
  bonusSigsRef: React.MutableRefObject<Set<string>>;
}) {
  // The optional LLM flavor layer is OFF by default: when disabled, this
  // component renders BYTE-IDENTICALLY to the plain parametric practice below.
  const aiEnabled = isAiLayerEnabled();
  const [item, setItem] = useState<NumericQuestion | null>(null);
  const [entered, setEntered] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Run-wide avoid-set: every original this round + every bonus already made.
  const avoidSet = (): Set<string> =>
    new Set([...roundSigs, ...bonusSigsRef.current]);
  const remember = (q: NumericQuestion) =>
    bonusSigsRef.current.add(numericSignature(q));

  // Button #1 — "Generate another like this": STRICTLY the same family as the
  // current on-screen item (new seed → same concept, different numbers).
  // `lockFamily = true` locks to that family (inferring it if the tag is
  // missing); the run-wide avoid-set prevents any collision with the round.
  const generate = () => {
    const fresh = generateFreshNumericQuestion(
      level,
      freshPracticeSeed(),
      current.family,
      avoidSet(),
      true,
      current,
    );
    if (fresh) remember(fresh);
    setItem(fresh);
    setEntered(null);
  };

  // Button #2 — "✨ Fresh variant" (AI): intentional variety WITHIN THE LEVEL —
  // NO family passed, so the whole-level mix may land on a sibling family; then
  // the flavor layer reskins ONLY the prompt. The run-wide avoid-set still
  // applies. On null / guardrail-rejected fallback we keep the fresh parametric
  // item verbatim (safe degrade). The solver answer/explanation stay truth.
  const generateFlavored = async () => {
    const fresh = generateFreshNumericQuestion(
      level,
      freshPracticeSeed(),
      undefined,
      avoidSet(),
      false,
      current,
    );
    if (!fresh) return;
    remember(fresh);
    setBusy(true);
    try {
      const variant = await requestFlavoredVariant(fresh);
      setItem(resolveFlavoredItem(fresh, variant));
      setEntered(null);
    } finally {
      setBusy(false);
    }
  };

  // With AI on, advancing returns to the chooser so either path stays reachable.
  const reset = () => {
    setItem(null);
    setEntered(null);
  };

  const answered = entered !== null;

  return (
    <div className="space-y-4 border-t-2 border-dashed border-subtle pt-5">
      <PracticeHeader />
      {!item ? (
        <>
          <p className="text-sm text-secondary">
            Want more reps on this idea? Generate a brand-new same-concept
            problem with fresh numbers. It won't affect your score or mastery.
          </p>
          {aiEnabled ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={generate}
                disabled={busy}
                className="btn-secondary w-full disabled:opacity-60"
              >
                Generate another like this ↻
              </button>
              <button
                onClick={generateFlavored}
                disabled={busy}
                aria-busy={busy}
                className="btn-secondary w-full disabled:opacity-60"
              >
                {busy ? "✨ Reskinning…" : "✨ Fresh variant"}
              </button>
            </div>
          ) : (
            <button onClick={generate} className="btn-secondary w-full">
              Generate another like this ↻
            </button>
          )}
        </>
      ) : (
        <NumericCard
          key={item.id}
          question={item}
          number={0}
          total={0}
          answered={answered}
          entered={entered}
          isLast={false}
          onSubmit={(v) => setEntered(v)}
          onNext={aiEnabled ? reset : generate}
          headerLabel="Bonus Practice"
          nextLabel={aiEnabled ? "Practice another ↻" : "Generate another like this ↻"}
          hintLevel={level}
        />
      )}
    </div>
  );
}
