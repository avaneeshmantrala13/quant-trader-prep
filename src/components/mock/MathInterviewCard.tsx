import { useEffect, useRef, useState } from "react";
import {
  gradeReasoning,
  generateFollowup,
  reviewReasoning,
  aiReviewActive,
  buildReasoningClarifyPrompt,
  type FollowupRecord,
  type MathStep,
  type MockAction,
  type MockResponse,
  type ReasoningSpan,
} from "@/lib/mock";
import { formatNumericAnswer } from "@/lib/numeric";
import { AnswerField } from "./AnswerField";
import { ReasoningPanel } from "./ReasoningPanel";
import { SubmittedReasoning } from "./SubmittedReasoning";
import { ClarifyBlock } from "./ClarifyBlock";
import type { UseMockSpeech } from "./useMockSpeech";

/**
 * The scored numeric card (mental-math, probability/EV, sequences, estimation),
 * an ADVERSARIAL, reasoning-verifying exchange with TWO distinct, SEQUENTIAL,
 * graded follow-ups — PLUS a rock-solid CLARIFY gate:
 *
 *   1. The candidate submits an answer AND their reasoning.
 *   2. The deterministic verifier owns correctness; the reasoning is graded for
 *      QUALITY (AI or deterministic) and can NEVER flip correctness.
 *   3. If the reasoning is MIXED / contradictory / hedged (`ambiguous`), a single
 *      CLARIFYING follow-up forces the candidate to commit to ONE answer before
 *      the flow continues.
 *   4. Follow-up 1 (PROBE) then Follow-up 2 (ADVERSARIAL). Each reasoning
 *      follow-up is graded on the COMMITTED CONCLUSION; a MIXED/contradictory
 *      answer triggers its own ONE clarify round (strictly graded — hedge again
 *      and it's missed).
 *
 * Every AI call degrades gracefully; the clarify grading is 100% deterministic
 * and conservative (when unsure it asks to clarify, never passes an ambiguous
 * answer as correct).
 */
export function MathInterviewCard({
  step,
  response,
  speech,
  isLast,
  dispatch,
  onNext,
}: {
  step: MathStep;
  response: MockResponse | null;
  speech: UseMockSpeech;
  isLast: boolean;
  dispatch: (a: MockAction) => void;
  onNext: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [probeAnswer, setProbeAnswer] = useState("");
  const [advAnswer, setAdvAnswer] = useState("");
  const [reviewSpans, setReviewSpans] = useState<ReasoningSpan[] | undefined>(
    undefined,
  );
  // True while the real-LLM review of the BASE reasoning is round-tripping.
  const [reviewPending, setReviewPending] = useState(false);
  const [mainClarify, setMainClarify] = useState("");
  const [probeClarify, setProbeClarify] = useState("");
  const [advClarify, setAdvClarify] = useState("");
  const startRef = useRef<number>(Date.now());
  const probeStartRef = useRef<number>(0);
  const advStartRef = useRef<number>(0);
  const mainClarifyStartRef = useRef<number>(0);
  const probeClarifyStartRef = useRef<number>(0);
  const advClarifyStartRef = useRef<number>(0);

  const answered = response !== null;
  const score = response?.score;
  const grade = response?.reasoningGrade ?? null;
  const probe = response?.followups?.probe ?? null;
  const adversarial = response?.followups?.adversarial ?? null;
  const mainClarifyState = response?.clarify ?? null;
  const correctAnswer = formatNumericAnswer(step);
  const isMentalMath = step.qtype === "mental-math";
  const isSprintGate = isMentalMath && step.regime === "sprint";
  const hasFollowups = step.authoredProbe != null;

  const submit = () => {
    if (answered || answer.trim() === "") return;
    const elapsedMs = Date.now() - startRef.current;
    dispatch({
      type: "recordMath",
      raw: answer,
      viaSpeech: speech.listening || speech.interim !== "",
      elapsedMs,
      reasoning,
    });
    speech.stopListening();
  };

  // --- Effect: grade reasoning once the answer is in (AI or deterministic) ---
  const gradingRef = useRef(false);
  useEffect(() => {
    if (!answered || !score || grade || gradingRef.current) return;
    gradingRef.current = true;
    let cancelled = false;
    gradeReasoning(
      {
        prompt: step.prompt,
        correctAnswer,
        correct: score.correct,
        reasoning: response?.reasoningRaw ?? "",
        isMentalMath,
        mechanismSignals: step.requiredReasoning?.mechanismSignals,
        bannedAsSoleJustification: step.requiredReasoning?.bannedAsSoleJustification,
      },
      { concept: step.concept },
    )
      .then((g) => {
        if (!cancelled)
          dispatch({ type: "applyReasoningGrade", stepId: step.id, grade: g });
      })
      .catch(() => {
        /* aiMock never rejects; belt-and-suspenders */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, score?.correct, grade]);

  // --- Effect: run the REAL LLM reasoning REVIEW (grounded by the verifier) --
  // The LLM only supplies span localization + human feedback; every span is
  // reconciled against deterministic checks in `reviewReasoning`, so it can never
  // upgrade a wrong answer to correct. With the AI layer off it returns the
  // DETERMINISTIC annotator spans (the offline floor), so the highlight is
  // identical either way — the panel below never depends on the network.
  const reviewRef = useRef(false);
  useEffect(() => {
    if (isSprintGate) return;
    if (!answered || !score || reviewRef.current) return;
    const raw = response?.reasoningRaw ?? "";
    if (raw.trim() === "") return;
    reviewRef.current = true;
    let cancelled = false;
    if (aiReviewActive()) setReviewPending(true);
    reviewReasoning(
      {
        prompt: step.prompt,
        correctAnswer,
        correct: score.correct,
        reasoning: raw,
        isMentalMath,
        mechanismSignals: step.requiredReasoning?.mechanismSignals,
      },
      {
        concept: step.concept,
        verifiedAnswer: step.answer,
        answerWasWrong: !score.correct,
        mechanismSignals: step.requiredReasoning?.mechanismSignals,
        canonicalDerivation: step.explanation,
      },
    )
      .then((r) => {
        if (!cancelled) setReviewSpans(r.spans);
      })
      .catch(() => {
        /* reviewReasoning never rejects; belt-and-suspenders */
      })
      .finally(() => {
        if (!cancelled) setReviewPending(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, score?.correct]);

  // --- Effect: ask the MAIN clarify when the reasoning is ambiguous ---------
  // A MIXED / contradictory / hedged reasoning must be committed to ONE answer
  // before follow-ups. Skipped on the pure mental-math speed gate.
  const mainClarifyAskedRef = useRef(false);
  useEffect(() => {
    if (isSprintGate) return;
    if (!grade || grade.quality !== "ambiguous") return;
    if (mainClarifyState || mainClarifyAskedRef.current) return;
    mainClarifyAskedRef.current = true;
    mainClarifyStartRef.current = Date.now();
    dispatch({
      type: "askClarify",
      stepId: step.id,
      target: "main",
      prompt:
        grade.clarifyPrompt ??
        buildReasoningClarifyPrompt({
          prompt: step.prompt,
          correctAnswer,
          correct: score?.correct ?? false,
          reasoning: response?.reasoningRaw ?? "",
          isMentalMath,
        }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, mainClarifyState]);

  // Main reasoning is "resolved" when it isn't ambiguous, or the ambiguity's
  // clarify has been answered.
  const mainResolved =
    grade != null &&
    (grade.quality !== "ambiguous" || (mainClarifyState?.graded ?? false));

  // --- Effect: ask the PROBE (Follow-up 1) once the main is resolved ---------
  const probeAskedRef = useRef(false);
  useEffect(() => {
    if (!hasFollowups || !step.authoredProbe) return;
    if (!mainResolved || probe || probeAskedRef.current) return;
    probeAskedRef.current = true;
    probeStartRef.current = Date.now();
    dispatch({ type: "askFollowup", stepId: step.id, followup: step.authoredProbe });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainResolved, probe, hasFollowups]);

  // --- Effect: ask the PROBE clarify when its reasoning was mixed ------------
  const probeClarifyAskedRef = useRef(false);
  useEffect(() => {
    if (!probe?.graded || probe.score?.verdict !== "clarify") return;
    if (probe.clarify || probeClarifyAskedRef.current) return;
    probeClarifyAskedRef.current = true;
    probeClarifyStartRef.current = Date.now();
    dispatch({
      type: "askClarify",
      stepId: step.id,
      target: "probe",
      prompt: probe.score.clarifyPrompt ?? DEFAULT_CLARIFY,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probe?.graded, probe?.score?.verdict, probe?.clarify]);

  const probeResolved = followupResolved(probe);

  // --- Effect: ask the ADVERSARIAL (Follow-up 2) once the probe is resolved --
  const advAskedRef = useRef(false);
  useEffect(() => {
    if (!step.authoredAdversarial) return;
    if (!probeResolved || adversarial || advAskedRef.current) return;
    advAskedRef.current = true;
    let cancelled = false;
    generateFollowup({
      prompt: step.prompt,
      correctAnswer,
      reasoning: response?.reasoningRaw ?? "",
      concept: step.concept,
      difficulty: score?.correct ? "harder" : "break-logic",
      authored: step.authoredAdversarial,
    })
      .then((fp) => {
        if (!cancelled) {
          advStartRef.current = Date.now();
          dispatch({ type: "askFollowup", stepId: step.id, followup: fp });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeResolved, adversarial]);

  // --- Effect: ask the ADVERSARIAL clarify when its reasoning was mixed ------
  const advClarifyAskedRef = useRef(false);
  useEffect(() => {
    if (!adversarial?.graded || adversarial.score?.verdict !== "clarify") return;
    if (adversarial.clarify || advClarifyAskedRef.current) return;
    advClarifyAskedRef.current = true;
    advClarifyStartRef.current = Date.now();
    dispatch({
      type: "askClarify",
      stepId: step.id,
      target: "adversarial",
      prompt: adversarial.score.clarifyPrompt ?? DEFAULT_CLARIFY,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adversarial?.graded, adversarial?.score?.verdict, adversarial?.clarify]);

  const advResolved = followupResolved(adversarial);

  const submitProbe = () => {
    if (!probe || probe.graded || probeAnswer.trim() === "") return;
    const elapsedMs = Date.now() - (probeStartRef.current || Date.now());
    dispatch({
      type: "recordFollowup",
      stepId: step.id,
      role: "probe",
      raw: probeAnswer,
      viaSpeech: speech.listening || speech.interim !== "",
      elapsedMs,
    });
    speech.stopListening();
  };

  const submitAdversarial = () => {
    if (!adversarial || adversarial.graded || advAnswer.trim() === "") return;
    const elapsedMs = Date.now() - (advStartRef.current || Date.now());
    dispatch({
      type: "recordFollowup",
      stepId: step.id,
      role: "adversarial",
      raw: advAnswer,
      viaSpeech: speech.listening || speech.interim !== "",
      elapsedMs,
    });
    speech.stopListening();
  };

  const submitClarify = (
    target: "main" | "probe" | "adversarial",
    value: string,
    startRefMs: number,
  ) => {
    if (value.trim() === "") return;
    const elapsedMs = Date.now() - (startRefMs || Date.now());
    dispatch({
      type: "recordClarify",
      stepId: step.id,
      target,
      raw: value,
      viaSpeech: speech.listening || speech.interim !== "",
      elapsedMs,
    });
    speech.stopListening();
  };

  // Mental-math is done as soon as its reasoning is resolved; conceptual
  // questions are done only after BOTH follow-ups are fully resolved (including
  // any clarify round).
  const allDone = hasFollowups ? advResolved : mainResolved;

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label text-accent">{stageLabel(step)}</span>
          <span className="chip border-subtle text-secondary">
            {step.concept ?? "Arithmetic"}
          </span>
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {step.prompt}
        </p>
      </div>

      {/* Answer + reasoning entry */}
      {!answered && (
        <div className="panel space-y-4 p-5">
          <div>
            <label className="label text-accent">Your answer</label>
            <div className="mt-2">
              <AnswerField
                value={answer}
                onChange={setAnswer}
                onSubmit={submit}
                speech={speech}
                inputMode="decimal"
                placeholder="Say or type a number, e.g. 144, 0.25, 3/8"
                ariaLabel={`Your answer to: ${step.prompt}`}
                submitLabel="Lock in ▸"
              />
            </div>
          </div>
          <div>
            <label className="label text-accent">
              {isSprintGate
                ? "Your reasoning (optional)"
                : "Your reasoning (I'll grade how you got there)"}
            </label>
            <div className="mt-2">
              <AnswerField
                value={reasoning}
                onChange={setReasoning}
                onSubmit={submit}
                speech={speech}
                multiline
                placeholder={
                  isSprintGate
                    ? "Optional — jot the shortcut if you like"
                    : "Show the shortcut / steps you used"
                }
                ariaLabel="Your reasoning"
                submitLabel="Submit ▸"
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {isSprintGate
                ? `Speed gate — target ~${Math.round(step.targetMs / 1000)}s. Just lock in the number; reasoning is optional and won't be pressed.`
                : `Reasoning — take ~${Math.round(step.targetMs / 1000)}s and narrate. A correct number is correct regardless of pace — but I'll press you on the reasoning, and if it points both ways I'll make you commit.`}
            </p>
          </div>
        </div>
      )}

      {/* Verdict (deterministic) + reasoning grade */}
      {answered && score && (
        <div className="animate-print-in space-y-4">
          <div className="border border-subtle">
            <div
              className={`flex items-center justify-between px-4 py-2 ${
                score.correct ? "bg-bull text-bg" : "bg-bear text-bg"
              }`}
            >
              <span className="font-mono text-xs font-semibold uppercase tracking-label">
                {score.correct ? "● Correct" : "● Not quite"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
                {score.timing === "fast" ? "Fast" : score.timing === "ok" ? "On pace" : "Slow"}{" "}
                · {(score.elapsedMs / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="space-y-1 bg-surface p-4 text-sm text-primary">
              <p>
                <span className="label text-secondary">You said · </span>
                <span className="num font-semibold">{score.parsed ?? "(unparsed)"}</span>
              </p>
              {!score.correct && score.matchedError && (
                <p className="text-secondary">{score.matchedError.feedback}</p>
              )}
              <p className="text-secondary">{step.explanation}</p>
            </div>
          </div>

          {/* The candidate's OWN submitted reasoning, with model-highlighted
              GOOD (green) and FLAWED (red) spans — shown ABOVE the verdict so
              they see exactly which of their words were right/wrong. */}
          {!isSprintGate && (
            <SubmittedReasoning
              text={response?.reasoningRaw}
              verifiedAnswer={step.answer}
              mechanismSignals={step.requiredReasoning?.mechanismSignals}
              prompt={step.prompt}
              answerWasWrong={!score.correct}
              spans={reviewSpans}
              reviewing={reviewPending}
            />
          )}

          <ReasoningPanel grade={grade} loading={!grade} />

          {/* MAIN clarify — force a single committed answer when ambiguous */}
          {mainClarifyState && (
            <ClarifyBlock
              clarify={mainClarifyState}
              value={mainClarify}
              onChange={setMainClarify}
              onSubmit={() =>
                submitClarify("main", mainClarify, mainClarifyStartRef.current)
              }
              speech={speech}
              prompt={step.prompt}
              verifiedAnswer={step.answer}
              correctAnswer={correctAnswer}
              mechanismSignals={step.requiredReasoning?.mechanismSignals}
              canonicalDerivation={step.explanation}
              concept={step.concept}
            />
          )}

          {/* Learn-from-it: when the MAIN reasoning is anything less than sound
              (partial / flawed / vague / absent, or an unresolved commit), show
              the correct answer + the ideal reasoning. Skipped on the pure
              speed gate, where reasoning is optional. Correctness of the numeric
              answer is judged separately above and is never implied wrong here. */}
          {!isSprintGate &&
            grade &&
            mainResolved &&
            grade.quality !== "sound" && (
              <ModelExplanationReveal
                answer={correctAnswer}
                reasoning={step.explanation}
                note={
                  score.correct
                    ? "Shown because your reasoning wasn't fully sound — your numeric answer was still graded correct above; reasoning never changes that."
                    : "Here's the ideal answer and reasoning so you know how to get there next time."
                }
              />
            )}

          {/* Follow-up 1 of 2 — the PROBE (answerable + graded) */}
          {hasFollowups && mainResolved && (
            <>
              <FollowupBlock
                followup={probe}
                value={probeAnswer}
                onChange={setProbeAnswer}
                onSubmit={submitProbe}
                speech={speech}
              />
              {probe?.clarify && (
                <ClarifyBlock
                  clarify={probe.clarify}
                  value={probeClarify}
                  onChange={setProbeClarify}
                  onSubmit={() =>
                    submitClarify("probe", probeClarify, probeClarifyStartRef.current)
                  }
                  speech={speech}
                  prompt={probe.presentation.prompt}
                  verifiedAnswer={probe.presentation.conclusionTargets?.[0] ?? null}
                  verifiedValues={
                    probe.presentation.correctValues ??
                    probe.presentation.conclusionTargets ??
                    undefined
                  }
                  mechanismSignals={probe.presentation.mechanismSignals}
                  canonicalDerivation={
                    probe.presentation.modelReasoning ?? probe.presentation.referenceNote
                  }
                  concept={step.concept}
                />
              )}
            </>
          )}

          {/* Follow-up 2 of 2 — the ADVERSARIAL, shown ONLY after the probe */}
          {hasFollowups && probeResolved && (
            <>
              <FollowupBlock
                followup={adversarial}
                value={advAnswer}
                onChange={setAdvAnswer}
                onSubmit={submitAdversarial}
                speech={speech}
              />
              {adversarial?.clarify && (
                <ClarifyBlock
                  clarify={adversarial.clarify}
                  value={advClarify}
                  onChange={setAdvClarify}
                  onSubmit={() =>
                    submitClarify("adversarial", advClarify, advClarifyStartRef.current)
                  }
                  speech={speech}
                  prompt={adversarial.presentation.prompt}
                  verifiedAnswer={adversarial.presentation.conclusionTargets?.[0] ?? null}
                  verifiedValues={
                    adversarial.presentation.correctValues ??
                    adversarial.presentation.conclusionTargets ??
                    undefined
                  }
                  mechanismSignals={adversarial.presentation.mechanismSignals}
                  canonicalDerivation={
                    adversarial.presentation.modelReasoning ??
                    adversarial.presentation.referenceNote
                  }
                  concept={step.concept}
                />
              )}
            </>
          )}

          {allDone && (
            <button onClick={onNext} className="btn-primary w-full">
              {isLast ? "See Results ▸" : "Next Question ▸"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_CLARIFY =
  "Commit to ONE final answer and give the single reason it's correct — no both-sides, no contradictions.";

/**
 * A follow-up is fully RESOLVED when it is graded and either did not need a
 * clarify (`verdict !== "clarify"`) or its clarify has been answered.
 */
function followupResolved(rec: FollowupRecord | null): boolean {
  if (!rec || !rec.graded) return false;
  if (rec.score?.verdict === "clarify") return rec.clarify?.graded ?? false;
  return true;
}

function stageLabel(step: MathStep): string {
  switch (step.qtype) {
    case "probability-ev":
      return "Probability & EV";
    case "sequences":
      return "Sequences · Pattern";
    case "estimation":
      return "Estimation · Fermi";
    default:
      return "Mental Math · Out loud";
  }
}

function FollowupBlock({
  followup,
  value,
  onChange,
  onSubmit,
  speech,
}: {
  followup: FollowupRecord | null;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  speech: UseMockSpeech;
}) {
  // VERIFIER-GROUNDED spans for a reasoning follow-up: routed through the SAME
  // `reviewReasoning` pipeline as the base question (LLM localization reconciled
  // against the deterministic verifier, word-boundary-snapped). With the AI
  // layer off it returns the deterministic annotator floor, so the highlight is
  // identical either way and never depends on the network.
  const [fuSpans, setFuSpans] = useState<ReasoningSpan[] | undefined>(undefined);
  const [fuReviewPending, setFuReviewPending] = useState(false);
  const fuReviewRef = useRef(false);
  const pres = followup?.presentation ?? null;
  const rawFollowup = followup?.raw ?? "";
  const isReasoningPre = pres?.answerKind === "reasoning";
  // A follow-up reasoning answer is RED-highlighted ONLY when it committed to a
  // genuinely WRONG conclusion (`missed`) — never on a `clarify` (right side,
  // value still pending) or a correct answer — so a correct load-bearing claim
  // (e.g. "memoryless") is never reddened.
  const followupWrong = followup?.score?.verdict === "missed";
  const followupGraded = followup?.graded ?? false;
  useEffect(() => {
    if (!pres || !followupGraded || !isReasoningPre || rawFollowup.trim() === "") return;
    if (fuReviewRef.current) return;
    fuReviewRef.current = true;
    let cancelled = false;
    if (aiReviewActive()) setFuReviewPending(true);
    reviewReasoning(
      {
        prompt: pres.prompt,
        correctAnswer:
          pres.conclusionTargets != null ? String(pres.conclusionTargets[0]) : "",
        correct: followup?.score?.correct ?? false,
        reasoning: rawFollowup,
        isMentalMath: false,
        mechanismSignals: pres.mechanismSignals,
      },
      {
        verifiedAnswer: pres.conclusionTargets?.[0] ?? null,
        // The FULL correct value set grounds partial greens over a multi-part
        // committed answer (e.g. a = 2, b = −1, c = 3) even when the answer is
        // missed; falls back to the single graded target for other follow-ups.
        verifiedValues: pres.correctValues ?? pres.conclusionTargets ?? undefined,
        answerWasWrong: followupWrong,
        mechanismSignals: pres.mechanismSignals,
        canonicalDerivation: pres.modelReasoning ?? pres.referenceNote,
      },
    )
      .then((r) => {
        if (!cancelled) setFuSpans(r.spans);
      })
      .catch(() => {
        /* reviewReasoning never rejects; belt-and-suspenders */
      })
      .finally(() => {
        if (!cancelled) setFuReviewPending(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followupGraded, isReasoningPre, rawFollowup]);

  if (!followup) {
    return (
      <div className="aside">
        <div className="label text-accent">Follow-up</div>
        <p className="mt-1 flex items-center gap-2 text-sm text-secondary" role="status">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          The interviewer is preparing the next follow-up…
        </p>
      </div>
    );
  }

  const graded = followup.graded;
  const fuScore = followup.score;
  const p = followup.presentation;
  const isProbe = p.role === "probe";
  const isReasoning = p.answerKind === "reasoning";
  const needsClarify = fuScore?.verdict === "clarify" && !followup.clarify?.graded;
  const clarifyKind = fuScore?.clarifyKind;
  const notUnderstood = clarifyKind === "uninterpretable";

  // The canonical answer to REVEAL when this follow-up was not fully correct: a
  // reasoning follow-up uses its authored `modelAnswer` stance; a numeric one
  // falls back to the graded numeric target when no stance was authored.
  const modelAnswerText =
    p.modelAnswer ??
    (!isReasoning && p.answer != null
      ? formatNumericAnswer({ answer: p.answer, decimals: p.decimals })
      : undefined);
  // Show the learn-from-it block whenever the candidate missed / caved on this
  // follow-up (never while a clarify is still pending — they can still commit).
  const showModel = graded && !needsClarify && !!fuScore && !fuScore.correct;

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between border-b border-subtle pb-2">
        <span className="label text-accent">{followup.presentation.label}</span>
        <span
          className={`chip ${isProbe ? "border-subtle text-secondary" : "border-accent text-accent"}`}
        >
          {isReasoning
            ? "reasoning"
            : followup.presentation.source === "ai"
              ? "adaptive"
              : isProbe
                ? "probe"
                : "adversarial"}
        </span>
      </div>
      <p className="mt-3 text-[15px] font-medium leading-relaxed text-primary">
        {p.prompt}
      </p>

      {!graded ? (
        <div className="mt-3">
          <AnswerField
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            speech={speech}
            multiline={isReasoning}
            inputMode={isReasoning ? "text" : "decimal"}
            placeholder={
              isReasoning
                ? "Explain your reasoning and state the key conclusion (e.g. the number + what it means)"
                : "Your answer to this follow-up"
            }
            ariaLabel={`Your ${isProbe ? "probe" : "adversarial"} follow-up answer`}
            submitLabel="Answer ▸"
          />
          {isReasoning && (
            <p className="mt-2 text-xs text-muted">
              Open follow-up — I grade whether your reasoning COMMITS to the right
              conclusion, not just a single number. State your one final answer
              and the takeaway; a both-sides answer gets a clarify.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* The candidate's OWN follow-up reasoning, with the SAME green (good)
              / red (flawed, root-cause-localized) highlighting as the base
              question — wired through the same annotate + SubmittedReasoning
              path. Shown for reasoning-graded follow-ups (incl. the adversarial). */}
          {isReasoning && (
            <div className="mt-3">
              <SubmittedReasoning
                text={followup.raw}
                verifiedAnswer={p.conclusionTargets?.[0] ?? null}
                verifiedValues={p.correctValues ?? p.conclusionTargets ?? undefined}
                mechanismSignals={p.mechanismSignals}
                prompt={p.prompt}
                answerWasWrong={followupWrong}
                spans={fuSpans}
                reviewing={fuReviewPending}
                testId="followup-submitted-reasoning"
              />
            </div>
          )}
          <div className="mt-3 border border-subtle">
            <div
              className={`px-4 py-2 font-mono text-xs font-semibold uppercase tracking-label ${
                needsClarify
                  ? "bg-accent text-bg"
                  : fuScore?.correct
                    ? "bg-bull text-bg"
                    : "bg-bear text-bg"
              }`}
            >
              {needsClarify
                ? notUnderstood
                  ? "● Response not understood — restate below"
                  : clarifyKind === "hedge"
                    ? "● Points both ways — commit below"
                    : clarifyKind === "contradiction"
                      ? "● Contradiction — commit below"
                      : "● Couldn't confirm — commit below"
                : fuScore?.correct
                  ? "● Follow-up correct"
                  : fuScore
                    ? "● Follow-up missed"
                    : "● Recorded"}
            </div>
            <div className="bg-surface p-3 text-sm text-secondary">
              {needsClarify
                ? notUnderstood
                  ? "I couldn't understand that response — it didn't read as a claim about the problem. Restate your reasoning in plain words below."
                  : clarifyKind === "contradiction"
                    ? "Your explanation mixes a correct part with a contradictory one — commit to one answer below."
                    : clarifyKind === "hedge"
                      ? "Your explanation points both ways instead of committing — pick one answer below."
                      : "I couldn't confirm a clean committed conclusion — state your one answer below."
                : fuScore
                  ? fuScore.correct
                    ? isReasoning
                      ? "Sound — your reasoning committed to the right conclusion under pressure."
                      : isProbe
                        ? "Nailed the probe — you understand the quantity, not just the arithmetic."
                        : "Held up under pressure — you defended the idea, not just the number."
                    : isReasoning
                      ? "Not the right conclusion — the specific step that breaks it is highlighted in red above, with why."
                      : isProbe
                        ? "Missed the probe — revisit what the quantity actually means."
                        : "You folded on the press — this is exactly where interviewers dig in."
                  : "Noted."}
            </div>
          </div>
          {/* Learn-from-it: after the red mistake above, offer a collapsible
              "See model explanation" reveal with the CORRECT answer + model
              reasoning so the candidate learns how to answer this next time. */}
          {showModel && (
            <ModelExplanationReveal
              answer={modelAnswerText}
              reasoning={p.modelReasoning ?? p.referenceNote}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * The "learn-from-it" block: whenever a candidate's answer/reasoning is not
 * fully correct, reveal the CORRECT answer (or committed stance) plus a concise
 * MODEL reasoning showing HOW to get there, so they know how to answer next
 * time. Styled in the interview's green "correct" accent (this is the ideal
 * answer), consistent with the dark theme.
 */
function ModelAnswerBlock({
  answer,
  reasoning,
  note,
}: {
  answer?: string;
  reasoning?: string;
  note?: string;
}) {
  if (!answer && !reasoning) return null;
  return (
    <div className="border-l-2 border-bull bg-surface-muted px-4 py-3">
      <div className="label text-bull">Model answer</div>
      {answer && (
        <p className="mt-1 text-sm text-primary">
          <span className="font-semibold">Answer: </span>
          {answer}
        </p>
      )}
      {reasoning && (
        <p className="mt-1 text-sm text-secondary">
          <span className="font-semibold text-primary">How to get there: </span>
          {reasoning}
        </p>
      )}
      {note && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * A COLLAPSIBLE "See model explanation" reveal shown after a FLAWED / wrong
 * reasoning: the red mistake is already highlighted above, so the canonical
 * correct answer + model reasoning stay hidden behind a button until the learner
 * asks for it (default collapsed). Wraps the shared {@link ModelAnswerBlock} so
 * the content/copy is never duplicated. Accessible: a real <button> with
 * `aria-expanded`, keyboard-focusable, toggles open/closed. Renders nothing when
 * no canonical answer/reasoning is available.
 */
function ModelExplanationReveal({
  answer,
  reasoning,
  note,
  testId = "model-explanation-toggle",
}: {
  answer?: string;
  reasoning?: string;
  note?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!answer && !reasoning) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        data-testid={testId}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost border border-subtle text-xs font-mono uppercase tracking-label hover:border-accent"
      >
        {open ? "Hide model explanation ▴" : "See model explanation ▾"}
      </button>
      {open && (
        <div className="mt-2">
          <ModelAnswerBlock answer={answer} reasoning={reasoning} note={note} />
        </div>
      )}
    </div>
  );
}
