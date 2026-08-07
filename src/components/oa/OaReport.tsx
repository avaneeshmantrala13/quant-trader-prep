import type { OaSessionResult, OaSessionState } from "@/lib/oa/types";
import { isCorrect } from "@/lib/oa/scoring";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-3 text-center">
      <div className="label text-[9px]">{label}</div>
      <div className="num mt-1 text-xl font-bold text-primary">{value}</div>
    </div>
  );
}

/**
 * OaReport — the read-only summary + per-question review of a FINISHED Timed OA
 * session. All numbers come straight from the pure `OaSessionResult`
 * (`lib/oa/stats.summarizeSession`); correctness marks reuse `scoring.isCorrect`
 * so the review agrees with the score.
 */
export function OaReport({
  result,
  session,
  onAgain,
}: {
  result: OaSessionResult;
  session: OaSessionState;
  onAgain: () => void;
}) {
  const expired = result.outcome === "expired";
  const accuracyPct = Math.round(result.accuracy * 100);
  const withinPct = Math.round(result.pctWithinBudget * 100);

  return (
    <div className="space-y-6">
      {/* ---- outcome + headline score ---- */}
      <div className="space-y-3 text-center">
        <span
          className={`chip ${expired ? "text-bear" : "text-bull"}`}
        >
          {expired
            ? "Expired: time ran out while you were away"
            : "Submitted"}
        </span>
        <div>
          <span className="label">Score</span>
          <div className="num text-6xl font-black text-accent">
            {result.score}
            <span className="text-2xl text-muted"> / {result.maxScore}</span>
          </div>
          {result.hardMode && (
            <div className="label mt-1 text-gold">Hard mode · −1 penalty</div>
          )}
        </div>
      </div>

      {/* ---- summary tiles ---- */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Accuracy" value={`${accuracyPct}%`} />
        <Stat label="Attempted" value={`${result.attempted}/${result.total}`} />
        <Stat label="Correct" value={result.correct} />
        <Stat
          label="Median / q"
          value={`${(result.medianMsPerQuestion / 1000).toFixed(1)}s`}
        />
        <Stat
          label="Avg / q"
          value={`${(result.avgMsPerQuestion / 1000).toFixed(1)}s`}
        />
        <Stat label="In budget" value={`${withinPct}%`} />
      </div>

      {/* ---- per-question review ---- */}
      <div className="space-y-3">
        <div className="label">Review</div>
        {session.questions.map((q, i) => {
          const answer = session.answers[i];
          const chosen = answer ? answer.chosen : null;
          const correct = answer ? isCorrect(q, answer) : false;
          const skipped = chosen == null;
          return (
            <div key={q.id} className="panel space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-line text-sm font-semibold text-primary">
                  <span className="num text-muted">{i + 1}. </span>
                  {q.prompt}
                </p>
                <span
                  className={`chip shrink-0 ${
                    skipped ? "text-muted" : correct ? "text-bull" : "text-bear"
                  }`}
                >
                  {skipped ? "skipped" : correct ? "correct" : "wrong"}
                </span>
              </div>

              <div className="space-y-1 text-sm">
                <div className="text-secondary">
                  <span className="label mr-2">Your answer</span>
                  <span
                    className={`num ${
                      skipped
                        ? "text-muted"
                        : correct
                          ? "text-bull"
                          : "text-bear"
                    }`}
                  >
                    {skipped ? "skipped" : q.choices[chosen as number]}
                  </span>
                </div>
                {!correct && (
                  <div className="text-secondary">
                    <span className="label mr-2">Correct</span>
                    <span className="num text-bull">
                      {q.choices[q.correctIndex]}
                    </span>
                  </div>
                )}
              </div>

              <p className="whitespace-pre-line text-xs text-muted">
                {q.explanation}
              </p>
            </div>
          );
        })}
      </div>

      <button onClick={onAgain} className="btn-primary w-full">
        Practice again
      </button>
    </div>
  );
}
