import { annotateReasoning, type ReasoningSpan, type SpanLabel } from "@/lib/mock";

/**
 * Shows the candidate's OWN submitted reasoning back to them after they answer,
 * with the model-highlighted parts in GREEN (correct step / valid mechanism /
 * reaches the verified answer) and RED (a false stated computation, a
 * contradiction, or a hedge). The detailed feedback + quality verdict render
 * BELOW this in the `ReasoningPanel`. Accessible: each highlight carries an
 * `aria-label` and a `title`, and a plain-text legend + reason list is shown so
 * the good/bad rationale never depends on hover alone.
 *
 * Highlights are DECORATION only — the authoritative reasoning verdict is the
 * deterministic grade; this component never changes correctness.
 */

/** Theme-token color for a span label at a given alpha (bull=green, bear=red). */
function labelColor(label: SpanLabel, alpha: number): string {
  const token = label === "good" ? "--color-bull" : "--color-bear";
  return `rgb(var(${token}) / ${alpha})`;
}

interface Part {
  text: string;
  span?: ReasoningSpan;
}

/**
 * Drop spans whose `why` we've already shown, so the same feedback line never
 * renders twice (the reported duplicate-feedback bug). Order-preserving.
 */
function dedupeReasons(spans: ReasoningSpan[]): ReasoningSpan[] {
  const seen = new Set<string>();
  const out: ReasoningSpan[] = [];
  for (const s of spans) {
    const key = s.why.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Interleave plain text and highlighted spans (spans are disjoint + ordered). */
function toParts(text: string, spans: ReasoningSpan[]): Part[] {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const parts: Part[] = [];
  let cursor = 0;
  for (const span of ordered) {
    if (span.start < cursor) continue; // skip any overlap defensively
    if (span.start > cursor) parts.push({ text: text.slice(cursor, span.start) });
    parts.push({ text: text.slice(span.start, span.end), span });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function SubmittedReasoning({
  text,
  verifiedAnswer,
  mechanismSignals,
  prompt,
  answerWasWrong,
  spans: injectedSpans,
  testId = "submitted-reasoning",
}: {
  text: string | undefined;
  verifiedAnswer?: number | null;
  mechanismSignals?: string[];
  /** The question prompt — enables root-cause / premise-flaw localization. */
  prompt?: string;
  /** Whether the verifier marked this answer wrong (drives the red root span). */
  answerWasWrong?: boolean;
  /**
   * VERIFIER-GROUNDED spans from the real LLM review (`mock-review-reasoning`),
   * when available. Every one has already been reconciled against the
   * deterministic checks (`aiMock.reviewReasoning`), so they are safe to render
   * verbatim. When omitted, we fall back to the deterministic annotator — the
   * offline floor — so the highlight path is identical whether or not the LLM ran.
   */
  spans?: ReasoningSpan[];
  /** Test hook so the base and the follow-up highlight panels are addressable. */
  testId?: string;
}) {
  const trimmed = (text ?? "").trim();
  if (trimmed === "") return null;
  const spans =
    injectedSpans ??
    annotateReasoning(text ?? "", {
      verifiedAnswer,
      mechanismSignals,
      prompt,
      answerWasWrong,
    });
  const parts = toParts(text ?? "", spans);
  const goodCount = spans.filter((s) => s.label === "good").length;
  const flawedCount = spans.filter((s) => s.label === "flawed").length;

  return (
    <div className="aside" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div className="label text-accent">Your reasoning</div>
        {(goodCount > 0 || flawedCount > 0) && (
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider">
            {goodCount > 0 && (
              <span className="flex items-center gap-1 text-bull">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: labelColor("good", 0.85) }}
                />
                {goodCount} correct
              </span>
            )}
            {flawedCount > 0 && (
              <span className="flex items-center gap-1 text-bear">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: labelColor("flawed", 0.85) }}
                />
                {flawedCount} flawed
              </span>
            )}
          </div>
        )}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-primary">
        {parts.map((p, i) =>
          p.span ? (
            <mark
              key={i}
              data-testid={`reasoning-span-${p.span.label}`}
              data-span-label={p.span.label}
              title={p.span.why}
              aria-label={`${p.span.label === "good" ? "Correct" : "Flawed"}: ${p.span.why}`}
              className="rounded-[2px] px-0.5"
              style={{
                backgroundColor: labelColor(p.span.label, 0.18),
                color: labelColor(p.span.label, 1),
                boxShadow: `inset 0 -2px 0 0 ${labelColor(p.span.label, 0.7)}`,
              }}
            >
              {p.text}
            </mark>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>

      {spans.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-xs">
          {dedupeReasons(spans).map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-sm"
                style={{ backgroundColor: labelColor(s.label, 0.9) }}
              />
              <span className={s.label === "good" ? "text-bull" : "text-bear"}>
                {s.why}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">
          No single step stood out to highlight — see the overall reasoning verdict
          below.
        </p>
      )}
    </div>
  );
}
