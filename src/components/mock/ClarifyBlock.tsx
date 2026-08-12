import { useEffect, useRef, useState } from "react";
import { AnswerField } from "./AnswerField";
import { SubmittedReasoning } from "./SubmittedReasoning";
import {
  reviewReasoning,
  aiReviewActive,
  type ClarifyState,
  type ReasoningSpan,
} from "@/lib/mock";
import type { UseMockSpeech } from "./useMockSpeech";

/**
 * The CLARIFY block: when an answer's reasoning pointed both ways (mixed /
 * contradictory / hedged), the interviewer forces a SINGLE committed answer.
 * Strictly graded — hedge or contradict again and it is MISSED.
 *
 * Once the candidate COMMITS, their clarification is treated exactly like the
 * initial reasoning question: the committed text is shown back with GOOD (green)
 * and FLAWED (red) highlighted spans + per-span feedback, wired through the SAME
 * verifier-grounded {@link reviewReasoning} pipeline and rendered by the shared
 * {@link SubmittedReasoning} panel. Correctness stays 100% deterministic (the
 * `clarify.score` verdict, which drives `answerWasWrong`); the review only
 * localizes + explains and can never flip a parroted/circular commit to green.
 * Grounding is optional — when omitted the block still renders the bare verdict.
 */
export function ClarifyBlock({
  clarify,
  value,
  onChange,
  onSubmit,
  speech,
  prompt,
  verifiedAnswer,
  correctAnswer,
  mechanismSignals,
  canonicalDerivation,
  concept,
}: {
  clarify: ClarifyState;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  speech: UseMockSpeech;
  /** The question/clarify prompt — enables root-cause / mechanism grounding. */
  prompt?: string;
  /** The verifier's answer, if numeric (grounds every "good" value span). */
  verifiedAnswer?: number | null;
  /** The verifier's answer as a string, when not a bare number. */
  correctAnswer?: string;
  /** Accepted mechanism phrasings (question signals + rubric classes). */
  mechanismSignals?: string[];
  /** A canonical worked derivation the reviewer may reference. */
  canonicalDerivation?: string;
  concept?: string;
}) {
  const graded = clarify.graded;
  const cScore = clarify.score;
  const raw = clarify.raw ?? "";
  // RED-highlight the committed clarification only when it committed to a
  // genuinely WRONG conclusion — mirrors the base question, so a correct commit
  // is never blanket-reddened.
  const committedWrong = graded && cScore != null && !cScore.correct;
  const canReview = graded && raw.trim() !== "" && prompt != null;

  // VERIFIER-GROUNDED spans for the committed clarification, routed through the
  // SAME `reviewReasoning` path as the base question. With the AI layer off it
  // returns the deterministic annotator floor, so the highlight is identical
  // either way and never depends on the network.
  const [spans, setSpans] = useState<ReasoningSpan[] | undefined>(undefined);
  const [reviewPending, setReviewPending] = useState(false);
  const reviewRef = useRef(false);
  useEffect(() => {
    if (!canReview || reviewRef.current) return;
    reviewRef.current = true;
    let cancelled = false;
    if (aiReviewActive()) setReviewPending(true);
    reviewReasoning(
      {
        prompt: prompt!,
        correctAnswer:
          correctAnswer ?? (verifiedAnswer != null ? String(verifiedAnswer) : ""),
        correct: cScore?.correct ?? false,
        reasoning: raw,
        isMentalMath: false,
        mechanismSignals,
      },
      {
        verifiedAnswer: verifiedAnswer ?? null,
        answerWasWrong: committedWrong,
        mechanismSignals,
        canonicalDerivation,
        concept,
      },
    )
      .then((r) => {
        if (!cancelled) setSpans(r.spans);
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
  }, [canReview, raw]);

  return (
    <div className="panel border-l-2 border-accent p-5">
      <div className="flex items-center justify-between border-b border-subtle pb-2">
        <span className="label text-accent">Commit to one answer</span>
        <span className="chip border-accent text-accent">clarify</span>
      </div>
      <p className="mt-3 text-[15px] font-medium leading-relaxed text-primary">
        {clarify.prompt}
      </p>
      {!graded ? (
        <div className="mt-3">
          <AnswerField
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            speech={speech}
            multiline
            inputMode="text"
            placeholder="State your ONE final answer and the single reason it's correct"
            ariaLabel="Your committed clarification"
            submitLabel="Commit ▸"
          />
          <p className="mt-2 text-xs text-muted">
            One shot — I grade whether you commit to the correct answer with a
            clean, non-contradictory reason. Hedge or point both ways again and
            it's marked missed.
          </p>
        </div>
      ) : (
        <>
          {/* The candidate's OWN committed clarification, with the SAME green
              (good) / red (flawed, root-cause-localized) highlighting + per-span
              feedback as the base question — wired through the same review +
              SubmittedReasoning path. */}
          {canReview && (
            <div className="mt-3">
              <SubmittedReasoning
                text={clarify.raw}
                verifiedAnswer={verifiedAnswer ?? null}
                mechanismSignals={mechanismSignals}
                prompt={prompt}
                answerWasWrong={committedWrong}
                spans={spans}
                reviewing={reviewPending}
                testId="clarify-submitted-reasoning"
              />
            </div>
          )}
          <div className="mt-3 border border-subtle">
            <div
              className={`px-4 py-2 font-mono text-xs font-semibold uppercase tracking-label ${
                cScore?.correct ? "bg-bull text-bg" : "bg-bear text-bg"
              }`}
            >
              {cScore?.correct ? "● Committed — correct" : "● Still unresolved — missed"}
            </div>
            <div className="bg-surface p-3 text-sm text-secondary">
              {cScore?.correct
                ? "Good — you committed to the right answer with a clean reason. The load-bearing parts of your commit are highlighted above."
                : "You still didn't commit to the correct answer cleanly — the step that breaks it is highlighted in red above, with why. That's the miss an interviewer pushes on."}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
