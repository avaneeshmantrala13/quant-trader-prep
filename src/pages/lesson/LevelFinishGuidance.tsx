import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { betaMean } from "@/lib/mastery/beta";
import { SKILL_GRAPH } from "@/lib/roadmap/skillGraph";
import {
  suggestPrereqsToStrengthen,
  type PrereqSuggestion,
} from "@/lib/remediation/suggestPrereqs";
import {
  describeRepeatedMistake,
  repeatedMistakesForTopic,
  type RepeatedMistake,
} from "@/lib/remediation/misconceptionTally";
import { assessNoMasteryGuidance } from "@/lib/remediation/noMastery";
import { TargetedMistakePractice } from "@/pages/lesson/remediation";

/**
 * LEVEL-FINISH ZPD GUIDANCE (ZPD remediation surface).
 *
 * Rendered ABOVE the settlement summary, this is the calm, non-forcing home for
 * the three learner-facing ZPD signals:
 *
 *  1. REPEATED MISTAKE feedback (pass OR fail) — "You <mistake> N times", with a
 *     button to drill exactly that error mode via the UNSCORED
 *     {@link TargetedMistakePractice}.
 *  2. "SUGGESTED TO STRENGTHEN FIRST" (fail only) — the failed topic's ~0.85,
 *     most-relevant prerequisites to reinforce (suggestion, never forced).
 *  3. NO-MASTERY FALLBACK guidance (fail, essentially nothing mastered) —
 *     escalating advice to try Mental Probability, the Simulations, then a
 *     textbook / high-school math review.
 *
 * It reads only deterministic progress state and NEVER mutates mastery.
 */
export function LevelFinishGuidance({
  topicKey,
  mastered,
  misconceptionTag,
}: {
  topicKey: string;
  /** Whether the just-finished level passed (drives which surfaces show). */
  mastered: boolean;
  /** The misconception tag behind the learner's latest miss this round. */
  misconceptionTag?: string;
}) {
  const { progress, getTopicMastery, getTopicVerdict } = useProgress();
  const [practice, setPractice] = useState<RepeatedMistake | null>(null);

  // Repeated mistakes surface on PASS or FAIL (a recurring error is worth naming
  // even on a passing round).
  const repeated = useMemo(
    () => repeatedMistakesForTopic(progress.misconceptionsByTopic, topicKey),
    [progress.misconceptionsByTopic, topicKey],
  );

  // ~0.85 prerequisite suggestions only make sense on a FAILED finish.
  const suggestions = useMemo<PrereqSuggestion[]>(() => {
    if (mastered) return [];
    return suggestPrereqsToStrengthen({
      failedTopicKey: topicKey,
      misconceptionTag,
      masteryOf: (k) => {
        const m = getTopicMastery(k);
        return m ? { mean: betaMean(m.alpha, m.beta), n: m.n } : undefined;
      },
    });
  }, [topicKey, mastered, misconceptionTag, getTopicMastery]);

  // No-mastery fallback: evaluate across the whole (registered) skill graph.
  const noMastery = useMemo(() => {
    const verdicts = SKILL_GRAPH.filter((s) => !s.external).map((s) =>
      getTopicVerdict(s.topicKey),
    );
    return assessNoMasteryGuidance({ verdicts, justFailed: !mastered });
  }, [getTopicVerdict, mastered]);

  // When drilling a specific mistake, take over the surface with the drill.
  if (practice) {
    return (
      <div className="panel p-5">
        <TargetedMistakePractice
          topicKey={topicKey}
          tag={practice.tag}
          label={practice.label}
          onClose={() => setPractice(null)}
        />
      </div>
    );
  }

  if (!repeated.length && !suggestions.length && !noMastery.triggered) {
    return null;
  }

  return (
    <div className="animate-print-in space-y-4">
      {repeated.length > 0 && (
        <div className="panel p-5">
          <span className="label text-accent">Recurring Mistake · Worth a Targeted Rep</span>
          <p className="mt-2 text-sm text-secondary">
            A specific slip keeps coming up in this topic. Naming it plainly is the
            fastest way to stop repeating it:
          </p>
          <ul className="mt-3 space-y-2">
            {repeated.map((m) => (
              <li
                key={m.tag}
                className="flex flex-col gap-2 border-l-2 border-bear bg-danger-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-medium text-primary">
                  {describeRepeatedMistake(m)}
                </span>
                <button
                  onClick={() => setPractice(m)}
                  className="btn-secondary shrink-0 !min-h-0 !py-1.5 text-sm"
                >
                  Practice just this ↻
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
            Targeted reps are not scored — they never change your mastery.
          </p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="panel p-5">
          <span className="label text-accent">Suggested to Strengthen First</span>
          <p className="mt-2 text-sm text-secondary">
            You&rsquo;re close on this one. These foundations underneath it are
            solid-but-not-perfect — a quick refresh usually makes the topic click.
            Totally optional; just a suggestion.
          </p>
          <ul className="mt-3 divide-y divide-subtle border border-subtle">
            {suggestions.map((s) => (
              <li
                key={s.topicKey}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-primary">
                    {s.label}
                    {s.misconceptionLinked && (
                      <span className="ml-2 chip border-subtle text-accent">
                        linked to your mistake
                      </span>
                    )}
                  </div>
                  <div className="num text-xs text-muted">
                    ~{Math.round(s.mean * 100)}% mastery · strong, not perfect
                  </div>
                </div>
                {s.trackId && s.firstLevelId ? (
                  <Link
                    to={`/track/${s.trackId}/level/${s.firstLevelId}`}
                    className="btn-secondary shrink-0 !min-h-0 !py-1.5 text-sm"
                  >
                    Refresh ▸
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {noMastery.triggered && (
        <div className="panel p-5">
          <span className="label text-accent">{noMastery.headline}</span>
          <p className="mt-2 whitespace-pre-line text-sm text-secondary">
            {noMastery.body}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {noMastery.actions.map((a) =>
              a.href ? (
                <Link
                  key={a.label}
                  to={a.href}
                  className="btn-secondary flex-1 text-center text-sm"
                >
                  {a.label}
                </Link>
              ) : (
                <span
                  key={a.label}
                  className="flex-1 border border-subtle px-3 py-2 text-center text-sm text-secondary"
                >
                  {a.label}
                </span>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
