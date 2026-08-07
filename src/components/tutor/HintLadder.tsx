import { useState } from "react";
import { Link } from "react-router-dom";
import type { HintRung } from "@/lib/tutor/hintLadder";
import type { NaturalFrequencyTree } from "@/lib/tutor/naturalFrequency";
import type { MonteCarloSpec } from "@/lib/tutor/monteCarlo";
import { NaturalFreqTree } from "./NaturalFreqTree";
import { ConfrontSim } from "./ConfrontSim";

/** A worked sibling instance for rung 3 (completion practice). */
export interface SiblingWorked {
  prompt: string;
  steps: string[];
  /** The sibling's OWN final answer (different numbers → never the current answer). */
  answer?: string;
}

function isNfTree(p: HintRung["payload"]): p is NaturalFrequencyTree {
  return !!p && "branches" in p && "finalRatioBlank" in p;
}
function isMcSpec(p: HintRung["payload"]): p is MonteCarloSpec {
  return !!p && "kind" in p && "trials" in p;
}

const RUNG_LABEL: Record<HintRung["kind"], string> = {
  "name-trap": "Name the trap",
  representation: "Make a plan of attack",
  "worked-sibling": "Study a worked sibling",
  "elicit-confront": "Confront it",
  reveal: "Full solution",
};

/**
 * Answer-WITHHOLDING hint ladder view (PHASE_2 §5/§6). Reveals rungs ONE AT A
 * TIME (learner-paced), so the final answer (rung 5) only appears after the
 * learner has worked through the escalating support. All logic is in
 * `buildHintLadder`; this view just discloses rungs and renders their payloads.
 * Works fully with the LLM flag OFF (Phase 7 may later rephrase rung text).
 *
 * Phase 7 (ADDITIVE, no logic change): an optional `phrasedText` map lets the
 * parent swap in an LLM-rephrased WORDING for a given rung (rungs 1–4 only; the
 * reveal rung is never rephrased). The value is produced by
 * `requestHintPhrasing`, which is re-guarded to never leak the answer or change a
 * number and falls back to the original text on any failure — so display is
 * visually identical when the flag is OFF or a rephrase is rejected. The hint
 * LOGIC/order and answer-withholding remain 100% Phase-2 deterministic.
 */
export function HintLadder({
  rungs,
  siblingWorked,
  phrasedText,
  controlledRevealed,
}: {
  rungs: HintRung[];
  /** Optional regenerated same-family worked instance for rung 3. */
  siblingWorked?: SiblingWorked | null;
  /**
   * Optional Phase-7 LLM-rephrased WORDING per rung number (1–4). When present
   * and different from the deterministic text, it is shown with an "✨
   * AI-assisted" chip. Absent ⇒ the deterministic rung text (the default).
   */
  phrasedText?: Partial<Record<HintRung["rung"], string>>;
  /**
   * PHASE_1 re-attempt flow (ADDITIVE): when set, the number of rungs shown is
   * CONTROLLED by the parent (disclosure is driven by re-attempts, not the
   * internal "show another hint" button, which is hidden). Absent ⇒ the original
   * learner-paced self-disclosure behaviour is unchanged.
   */
  controlledRevealed?: number;
}) {
  const controlled = controlledRevealed != null;
  const [selfRevealed, setSelfRevealed] = useState(1);
  const revealed = controlled
    ? Math.max(0, Math.min(controlledRevealed, rungs.length))
    : selfRevealed;
  const shown = rungs.slice(0, revealed);
  const hasMore = !controlled && revealed < rungs.length;
  const nextRung = rungs[revealed];

  /** The wording to display for a rung: LLM phrasing (non-reveal) else original. */
  const displayText = (rung: HintRung): { text: string; aiAssisted: boolean } => {
    if (rung.kind === "reveal") return { text: rung.text, aiAssisted: false };
    const phrased = phrasedText?.[rung.rung];
    if (phrased && phrased.trim().length > 0 && phrased !== rung.text) {
      return { text: phrased, aiAssisted: true };
    }
    return { text: rung.text, aiAssisted: false };
  };

  return (
    <div className="animate-print-in space-y-3 border border-subtle bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="label text-accent">Coaching · not the answer yet</span>
        <span className="num text-[10px] uppercase tracking-label text-muted">
          Hint {Math.min(revealed, rungs.length)} / {rungs.length}
        </span>
      </div>

      <ol className="space-y-3">
        {shown.map((rung) => {
          const disp = displayText(rung);
          return (
          <li key={rung.rung} className="border-l-2 border-accent pl-3">
            <div className="flex items-center justify-between gap-2">
              <div className="label text-[10px] text-secondary">
                Rung {rung.rung} · {RUNG_LABEL[rung.kind]}
              </div>
              {disp.aiAssisted && (
                <span className="chip text-[10px] text-accent">✨ AI-assisted</span>
              )}
            </div>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-primary">
              {disp.text}
            </p>

            {rung.kind === "representation" && isNfTree(rung.payload) && (
              <div className="mt-3">
                <NaturalFreqTree tree={rung.payload} />
              </div>
            )}

            {rung.kind === "worked-sibling" && siblingWorked && (
              <div className="panel-ruled mt-3 p-4">
                <div className="label text-accent">
                  Worked sibling · different numbers
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-secondary">
                  {siblingWorked.prompt}
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  {siblingWorked.steps.map((s, i) => (
                    <li key={i} className="whitespace-pre-line text-sm text-primary">
                      {s}
                    </li>
                  ))}
                </ol>
                {siblingWorked.answer && (
                  <p className="mt-2 text-sm text-primary">
                    <span className="label text-accent">Sibling answer · </span>
                    <span className="num font-semibold">{siblingWorked.answer}</span>
                  </p>
                )}
                <p className="mt-2 text-xs text-muted">
                  Study the step you slipped on above, then mirror it on your own
                  item (your numbers differ) and re-derive your answer.
                </p>
              </div>
            )}

            {rung.kind === "elicit-confront" && isMcSpec(rung.payload) && (
              <div className="mt-3">
                <ConfrontSim spec={rung.payload} />
              </div>
            )}

            {rung.simLink && (
              <Link
                to={rung.simLink.href}
                className="btn-secondary mt-2 inline-flex items-center gap-1 text-xs"
              >
                Open “{rung.simLink.title}” →
              </Link>
            )}
          </li>
          );
        })}
      </ol>

      {hasMore && nextRung && (
        <button
          onClick={() => setSelfRevealed((r) => r + 1)}
          className="btn-secondary w-full"
        >
          {nextRung.kind === "reveal"
            ? "I've tried: show the full solution ▸"
            : "Still stuck: show another hint ▾"}
        </button>
      )}
    </div>
  );
}
