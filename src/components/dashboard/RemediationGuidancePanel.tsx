import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { betaMean } from "@/lib/mastery/beta";
import { SKILL_GRAPH, skillByKey } from "@/lib/roadmap/skillGraph";
import { topicDisplayName } from "@/lib/dashboard/misconceptionLabels";
import {
  describeRepeatedMistake,
  repeatedMistakesForTopic,
  type RepeatedMistake,
} from "@/lib/remediation/misconceptionTally";
import {
  suggestPrereqsToStrengthen,
  type PrereqSuggestion,
} from "@/lib/remediation/suggestPrereqs";
import { assessNoMasteryGuidance } from "@/lib/remediation/noMastery";
import { TargetedMistakePractice } from "@/pages/lesson/remediation";

/**
 * DASHBOARD ZPD GUIDANCE PANEL — the dashboard mirror of the lesson-finish
 * remediation surface (`LevelFinishGuidance`). It reflects, across ALL topics:
 *
 *  - REPEATED mistakes worth a targeted (unscored) rep, with an inline drill.
 *  - "Strengthen first" ~0.85 prerequisite SUGGESTIONS for the learner's weakest
 *    evidenced, non-mastered topic.
 *  - The escalating NO-MASTERY fallback guidance (Mental Probability →
 *    Simulations → textbook / high-school math).
 *
 * Read-only over deterministic progress state (mirrors `SrsReviewPanel`): it
 * NEVER mutates mastery and renders nothing when there is nothing to surface.
 */
export function RemediationGuidancePanel() {
  const { progress, getTopicMastery, getTopicVerdict } = useProgress();
  const [practice, setPractice] = useState<{
    topicKey: string;
    mistake: RepeatedMistake;
  } | null>(null);

  const registered = useMemo(
    () => SKILL_GRAPH.filter((s) => !s.external),
    [],
  );

  const verdicts = useMemo(
    () => registered.map((s) => ({ node: s, v: getTopicVerdict(s.topicKey) })),
    [registered, getTopicVerdict],
  );

  // No-mastery: dashboard view omits `justFailed`, so it only fires once real
  // graded evidence exists (never nags a brand-new user).
  const noMastery = useMemo(
    () => assessNoMasteryGuidance({ verdicts: verdicts.map((x) => x.v) }),
    [verdicts],
  );

  const repeated = useMemo(() => {
    const map = progress.misconceptionsByTopic;
    if (!map) return [];
    const rows: { topicKey: string; label: string; mistake: RepeatedMistake }[] = [];
    for (const topicKey of Object.keys(map)) {
      const topicLabel = topicDisplayName(
        topicKey,
        skillByKey(topicKey)?.label ?? topicKey,
      );
      for (const m of repeatedMistakesForTopic(map, topicKey)) {
        rows.push({ topicKey, label: topicLabel, mistake: m });
      }
    }
    return rows
      .sort((a, b) => b.mistake.count - a.mistake.count)
      .slice(0, 4);
  }, [progress.misconceptionsByTopic]);

  const suggest = useMemo<
    { topicKey: string; label: string; suggestions: PrereqSuggestion[] } | undefined
  >(() => {
    const failed = verdicts
      .filter((x) => x.v.n > 0 && !x.v.mastered)
      .sort((a, b) => a.v.mean - b.v.mean);
    for (const f of failed) {
      const suggestions = suggestPrereqsToStrengthen({
        failedTopicKey: f.node.topicKey,
        masteryOf: (k) => {
          const m = getTopicMastery(k);
          return m ? { mean: betaMean(m.alpha, m.beta), n: m.n } : undefined;
        },
      });
      if (suggestions.length) {
        return {
          topicKey: f.node.topicKey,
          label: topicDisplayName(f.node.topicKey, f.node.label),
          suggestions,
        };
      }
    }
    return undefined;
  }, [verdicts, getTopicMastery]);

  if (!noMastery.triggered && !repeated.length && !suggest) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-8">
      <div className="panel p-5" data-testid="remediation-guidance-panel">
        <h2 className="text-lg font-semibold text-primary">Shore Up Your Foundations</h2>

        {practice ? (
          <div className="mt-3">
            <TargetedMistakePractice
              topicKey={practice.topicKey}
              tag={practice.mistake.tag}
              label={practice.mistake.label}
              onClose={() => setPractice(null)}
            />
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {noMastery.triggered && (
              <div className="border-l-2 border-accent bg-surface-muted px-4 py-3">
                <div className="label text-accent">{noMastery.headline}</div>
                <p className="mt-1 whitespace-pre-line text-sm text-secondary">
                  {noMastery.body}
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
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

            {repeated.length > 0 && (
              <div>
                <div className="label text-muted">Recurring mistakes</div>
                <ul className="mt-2 divide-y divide-subtle border border-subtle">
                  {repeated.map((r) => (
                    <li
                      key={`${r.topicKey}::${r.mistake.tag}`}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-primary">
                          {describeRepeatedMistake(r.mistake)}
                        </div>
                        <div className="label text-muted">{r.label}</div>
                      </div>
                      <button
                        onClick={() =>
                          setPractice({ topicKey: r.topicKey, mistake: r.mistake })
                        }
                        className="btn-secondary shrink-0 !min-h-0 !py-1.5 text-sm"
                      >
                        Practice ↻
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {suggest && (
              <div>
                <div className="label text-muted">
                  Strengthen first · underneath {suggest.label}
                </div>
                <ul className="mt-2 divide-y divide-subtle border border-subtle">
                  {suggest.suggestions.map((s) => (
                    <li
                      key={s.topicKey}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-primary">
                          {s.label}
                        </div>
                        <div className="num text-xs text-muted">
                          ~{Math.round(s.mean * 100)}% · strong, not perfect
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
          </div>
        )}
      </div>
    </section>
  );
}
