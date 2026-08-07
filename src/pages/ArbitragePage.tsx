import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeftIcon, GaugeIcon } from "@/components/icons";
import {
  buildArbitrageDrill,
  gradeNumericItem,
  gradeQuizItem,
  scoreDrill,
  type DrillItem,
} from "@/lib/games/arbitrage/engine";
import {
  clearArbitrageRun,
  loadArbitrageRun,
  saveArbitrageRun,
} from "@/lib/arbitrage/persist";

/**
 * `/arbitrage` — the No-Arbitrage / de-vig reasoning drill (TASK T3).
 *
 * A self-contained, full-screen themed page (its own layout, like FermiPage). It
 * is a thin renderer over the PURE engine in `@/lib/games/arbitrage/engine`: it
 * draws a deterministic interleaved battery of de-vig / arb-direction /
 * basket-vs-parts items from `buildArbitrageDrill(seed, count)` and grades each
 * response with the engine's pure graders. Nothing here touches mastery/progress
 * — it is a disjoint practice surface reachable in Case B via the nav + Games hub.
 */

const DRILL_LENGTH = 8;

type Phase = "intro" | "running" | "summary";

export function ArbitragePage() {
  const navigate = useNavigate();
  const { username } = useAuth();

  // Resume the CURRENT user's persisted in-progress run (leave/reload-proof).
  // Read once, and only trust a snapshot whose response array still matches the
  // drill length. Scoping by user means account B never resumes account A's run.
  const resumed = useMemo(() => {
    const saved = loadArbitrageRun(username);
    if (!saved) return undefined;
    if (saved.responses.length !== DRILL_LENGTH) return undefined;
    return saved;
  }, [username]);

  const [seed, setSeed] = useState(
    () => resumed?.seed ?? Math.floor(Math.random() * 1_000_000),
  );
  const [phase, setPhase] = useState<Phase>(resumed ? "running" : "intro");

  // The battery is deterministic in `seed`, so a resumed run re-materializes the
  // identical items and lines up with the persisted `responses`.
  const items = useMemo(() => buildArbitrageDrill(seed, DRILL_LENGTH), [seed]);

  const [index, setIndex] = useState(resumed?.index ?? 0);
  const [responses, setResponses] = useState<(boolean | null)[]>(
    () => resumed?.responses ?? Array<boolean | null>(DRILL_LENGTH).fill(null),
  );
  const [committed, setCommitted] = useState(resumed?.committed ?? false);
  const [typed, setTyped] = useState(resumed?.typed ?? "");
  const [chosen, setChosen] = useState<number | null>(resumed?.chosen ?? null);

  // Durable persistence: keep the RUNNING run saved so a leave/reload resumes
  // it; reaching the scorecard or restarting clears it (start fresh next time).
  useEffect(() => {
    if (phase === "running") {
      saveArbitrageRun(
        {
          version: 1,
          seed,
          index,
          responses,
          committed,
          chosen,
          typed,
        },
        username,
      );
    } else {
      clearArbitrageRun(username);
    }
  }, [phase, seed, index, responses, committed, chosen, typed, username]);

  const item = items[index];
  const score = scoreDrill(responses, DRILL_LENGTH);

  function commitQuiz(item: Extract<DrillItem, { kind: "quiz" }>, i: number) {
    if (committed) return;
    setChosen(i);
    const { correct } = gradeQuizItem(item, i);
    setResponses((r) => {
      const next = [...r];
      next[index] = correct;
      return next;
    });
    setCommitted(true);
  }

  function commitNumeric(item: Extract<DrillItem, { kind: "numeric" }>) {
    if (committed) return;
    const { correct } = gradeNumericItem(item, typed);
    setResponses((r) => {
      const next = [...r];
      next[index] = correct;
      return next;
    });
    setCommitted(true);
  }

  function advance() {
    if (index + 1 >= DRILL_LENGTH) {
      setPhase("summary");
      return;
    }
    setCommitted(false);
    setTyped("");
    setChosen(null);
    setIndex((i) => i + 1);
  }

  function start() {
    setPhase("running");
  }

  function restart() {
    setSeed(Math.floor(Math.random() * 1_000_000));
    setResponses(Array<boolean | null>(DRILL_LENGTH).fill(null));
    setIndex(0);
    setCommitted(false);
    setTyped("");
    setChosen(null);
    setPhase("intro");
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-6 text-primary sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="chip border-subtle text-secondary hover:border-accent hover:text-primary"
          >
            <ChevronLeftIcon width={14} height={14} /> Back
          </button>
          <span className="label text-accent">No-Arbitrage · De-vig reasoning</span>
        </header>

        {phase === "intro" && (
          <section className="panel space-y-5 p-6">
            <div className="flex items-start gap-4">
              <span className="hidden h-12 w-12 place-items-center border border-border-strong text-accent sm:grid">
                <GaugeIcon width={26} height={26} />
              </span>
              <div>
                <h1 className="font-display text-3xl font-black">Arbitrage &amp; De-vig</h1>
                <p className="mt-2 text-sm leading-relaxed text-secondary">
                  Strip the vig off a book of quoted odds to recover fair
                  probabilities, spot the guaranteed arb, and call the value leg.
                  Every item is drawn fresh and graded exactly; only the method
                  transfers.
                </p>
              </div>
            </div>

            <div className="panel-ruled space-y-1 p-4 text-sm text-secondary">
              <p className="label text-muted">The book-sum rule</p>
              <p className="num">Σ implied probs &gt; 1 ⇒ overround (the vig)</p>
              <p className="num">Σ implied probs = 1 ⇒ fair book</p>
              <p className="num">Σ implied probs &lt; 1 ⇒ arbitrage (a Dutch book in your favour)</p>
            </div>

            <button
              onClick={start}
              className="chip border-accent bg-accent text-accent-contrast"
            >
              Start Drilling →
            </button>
          </section>
        )}

        {phase === "running" && item && (
          <section className="panel-ruled space-y-5 p-6">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="num">
                Problem {index + 1} / {DRILL_LENGTH}
              </span>
              <span className="label">{item.kind === "quiz" ? "Decision" : "Free entry"}</span>
            </div>

            <p className="whitespace-pre-line text-[15px] leading-relaxed text-primary">
              {item.question.prompt}
            </p>

            {item.kind === "quiz" ? (
              <ul className="space-y-2">
                {item.question.choices.map((c, i) => {
                  const isKey = i === item.question.correctIndex;
                  const isChosen = chosen === i;
                  const tone = !committed
                    ? "border-subtle hover:border-accent"
                    : isKey
                      ? "border-bull text-bull"
                      : isChosen
                        ? "border-bear text-bear"
                        : "border-subtle text-muted";
                  return (
                    <li key={i}>
                      <button
                        aria-pressed={isChosen}
                        disabled={committed}
                        onClick={() => commitQuiz(item, i)}
                        className={`panel-ruled w-full p-3 text-left text-sm transition-colors ${tone}`}
                      >
                        {c}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitNumeric(item);
                }}
                className="flex items-center gap-2"
              >
                <input
                  autoFocus
                  inputMode="decimal"
                  value={typed}
                  disabled={committed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Your answer"
                  aria-label="Numeric answer"
                  className="num w-44 border border-border-strong bg-transparent px-3 py-2 text-primary outline-none focus:border-accent"
                />
                <span className="label text-muted">{item.question.unit ?? ""}</span>
                {!committed && (
                  <button type="submit" className="chip border-accent bg-accent text-accent-contrast">
                    Lock In
                  </button>
                )}
              </form>
            )}

            {committed && (
              <div className="space-y-3 border-t border-subtle pt-4">
                <p className={`label ${responses[index] ? "text-bull" : "text-bear"}`}>
                  {responses[index] ? "Correct" : "Not quite"}
                  {item.kind === "numeric" && (
                    <span className="ml-2 text-muted">
                      Answer: {item.question.answer}
                      {item.question.unit ? ` ${item.question.unit}` : ""}
                    </span>
                  )}
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                  {item.question.explanation}
                </p>
                <button
                  onClick={advance}
                  className="chip border-accent bg-accent text-accent-contrast"
                >
                  {index + 1 >= DRILL_LENGTH ? "See Results" : "Next Problem →"}
                </button>
              </div>
            )}
          </section>
        )}

        {phase === "summary" && (
          <section className="panel-ruled space-y-4 p-6 text-center">
            <span className="label text-accent">Arbitrage Scorecard</span>
            <p className="num text-5xl font-black text-primary">
              {score.correct}
              <span className="text-2xl text-muted"> / {score.total}</span>
            </p>
            <p className="text-sm text-secondary">
              Accuracy: {score.pct}% across {score.total} no-arbitrage problems.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={restart}
                className="chip border-accent bg-accent text-accent-contrast"
              >
                Play again
              </button>
              <button
                onClick={() => navigate("/oa")}
                className="chip border-subtle text-secondary hover:border-accent hover:text-primary"
              >
                Timed sections
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
