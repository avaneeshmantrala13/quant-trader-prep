import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "@/components/icons";
import { OA_FORMATS } from "@/lib/oa/config";
import type { OaFormatConfig, OaSessionResult, OaSessionState } from "@/lib/oa/types";
import { createOaSession, resumeOaSession } from "@/lib/oa/timedSession";
import { drawOaQuestionsForFormat } from "@/lib/oa/questionPool";
import { summarizeSession } from "@/lib/oa/stats";
import { useProgress } from "@/context/ProgressContext";
import { OaRunner } from "@/components/oa/OaRunner";
import { OaReport } from "@/components/oa/OaReport";

type Phase = "pick" | "run" | "report";

/** A short human summary of a format's key timing/scoring facts for the card. */
function formatFacts(config: OaFormatConfig): string[] {
  const facts: string[] = [`${config.questionCount} questions`];
  if (config.kind === "sprint") {
    facts.push(`~${config.perQuestionSec}s per question`);
    facts.push("auto-advance · no going back");
  } else if (config.kind === "section") {
    const mins = Math.round((config.sectionSec ?? 0) / 60);
    const perQ = Math.round((config.budgetMs ?? 0) / 1000);
    facts.push(`${mins} min section clock (~${perQ}s/q)`);
    facts.push(
      config.freeNavigation
        ? "free navigation · auto-submit at time"
        : "module-locked · no going back · auto-submit",
    );
  } else {
    facts.push("untimed · tracks time per question");
  }
  const s = config.scoring;
  facts.push(`scoring +${s.correct} / ${s.wrong} / ${s.skip}`);
  return facts;
}

/**
 * OaSectionsPage — the `/oa` route. A thin pick → run → report orchestrator over
 * the pure `lib/oa` engine + the `ProgressContext` OA store. Reload-proof: an
 * in-progress session persisted in `progress.oaTimed.active` is resumed on mount
 * (auto-submitted straight to the report if its deadline passed while away).
 */
export function OaSectionsPage() {
  const { progress, saveOaSession, recordOaResult } = useProgress();

  const [phase, setPhase] = useState<Phase>("pick");
  const [session, setSession] = useState<OaSessionState | null>(null);
  const [result, setResult] = useState<OaSessionResult | null>(null);
  const [hardMode, setHardMode] = useState(false);

  // Resume any persisted in-progress session exactly once on mount.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    const active = progress.oaTimed?.active;
    if (!active) return;
    const resumed = resumeOaSession(active, Date.now());
    if (resumed.status === "running") {
      setSession(resumed);
      setPhase("run");
      if (resumed !== active) saveOaSession(resumed);
    } else {
      // Deadline passed while away — finalize into the report.
      const res = summarizeSession(resumed);
      recordOaResult(res);
      setResult(res);
      setSession(resumed);
      setPhase("report");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (config: OaFormatConfig, hard: boolean) => {
    const questions = drawOaQuestionsForFormat(
      config,
      Date.now() % 2_000_000_000,
      config.questionCount,
    );
    const s = createOaSession(config, questions, {
      hardMode: hard,
      nowTs: Date.now(),
    });
    saveOaSession(s);
    setSession(s);
    setResult(null);
    setPhase("run");
  };

  const activeRunning =
    progress.oaTimed?.active &&
    resumeOaSession(progress.oaTimed.active, Date.now()).status === "running";

  return (
    <div className="relative min-h-[100dvh] bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="btn-ghost !px-2 !py-1 text-sm">
            <ChevronLeftIcon width={16} height={16} /> Home
          </Link>
          <span className="label text-accent">Timed Sections</span>
        </div>

        {phase === "pick" && (
          <div className="space-y-6">
            <header>
              <h1 className="font-display text-3xl font-black text-primary">
                Timed Sections
              </h1>
              <p className="mt-1 text-sm text-secondary">
                Interview-condition practice on a real wall clock; it keeps
                running if you leave, so treat it like the live OA. Pick a format
                to begin.
              </p>
            </header>

            {activeRunning && session == null && (
              <button
                onClick={() => {
                  const active = progress.oaTimed?.active;
                  if (!active) return;
                  const resumed = resumeOaSession(active, Date.now());
                  setSession(resumed);
                  setPhase("run");
                  if (resumed !== active) saveOaSession(resumed);
                }}
                className="panel flex w-full items-center justify-between p-4 text-left hover:border-strong"
              >
                <span className="text-sm font-semibold text-primary">
                  Resume in-progress session
                </span>
                <span className="label text-accent">Continue →</span>
              </button>
            )}

            <div className="grid gap-4">
              {OA_FORMATS.map((config) => (
                <div key={config.id} className="panel space-y-3 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-bold text-primary">
                        {config.label}
                      </h2>
                      {config.firmAttribution && (
                        <span className="chip text-accent">
                          {config.firmAttribution}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-secondary">{config.blurb}</p>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {formatFacts(config).map((fact) => (
                      <li key={fact} className="chip text-muted">
                        {fact}
                      </li>
                    ))}
                  </ul>
                  {config.hardModePenalty != null && (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary">
                      <input
                        type="checkbox"
                        checked={hardMode}
                        onChange={(e) => setHardMode(e.target.checked)}
                      />
                      Hard mode ({config.hardModePenalty} per wrong answer)
                    </label>
                  )}
                  <button
                    onClick={() =>
                      start(
                        config,
                        config.hardModePenalty != null ? hardMode : false,
                      )
                    }
                    className="btn-primary w-full"
                  >
                    Start
                  </button>
                </div>
              ))}
            </div>

            <Link
              to="/dashboard"
              className="btn-ghost block text-center text-xs"
            >
              View your timed-section stats
            </Link>
          </div>
        )}

        {phase === "run" && session && (
          <OaRunner
            session={session}
            onChange={(next) => {
              setSession(next);
              saveOaSession(next);
            }}
            onFinish={(fin) => {
              const res = summarizeSession(fin);
              recordOaResult(res);
              setResult(res);
              setSession(fin);
              setPhase("report");
            }}
          />
        )}

        {phase === "report" && result && session && (
          <OaReport
            result={result}
            session={session}
            onAgain={() => {
              setResult(null);
              setSession(null);
              setPhase("pick");
            }}
          />
        )}
      </div>
    </div>
  );
}
