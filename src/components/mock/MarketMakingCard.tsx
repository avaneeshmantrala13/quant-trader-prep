import { useState } from "react";
import {
  validateMmQuote,
  type MarketMakingStep,
  type MockAction,
  type MockResponse,
  type MmState,
} from "@/lib/mock";

/**
 * The MARKET-MAKING card: the candidate quotes a two-sided market each round and
 * a DETERMINISTIC adversarial bot (reusing the Make-Me-a-Market math) trades
 * against them, picking off bad / offside / stupid-wide quotes. Fully local and
 * LLM-free — a poor quote loses money, shown live and rolled into the diagnosis.
 */
export function MarketMakingCard({
  step,
  response,
  isLast,
  dispatch,
  onNext,
}: {
  step: MarketMakingStep;
  response: MockResponse | null;
  isLast: boolean;
  dispatch: (a: MockAction) => void;
  onNext: () => void;
}) {
  const mm: MmState | null = response?.mm ?? null;
  const done = mm?.done ?? false;
  const round = (mm?.results.length ?? 0) + 1;

  const [bid, setBid] = useState("");
  const [ask, setAsk] = useState("");
  const [bidSize, setBidSize] = useState("1");
  const [askSize, setAskSize] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const quote = {
      bid: Number(bid),
      ask: Number(ask),
      bidSize: Number(bidSize),
      askSize: Number(askSize),
    };
    const v = validateMmQuote(step, quote);
    if (!v.ok) {
      setError(v.error ?? "Invalid quote.");
      return;
    }
    setError(null);
    dispatch({ type: "submitMmQuote", stepId: step.id, quote });
    setBid("");
    setAsk("");
  };

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label text-accent">Market Making · Quote me</span>
          <span className="num chip border-subtle text-secondary">
            {done ? "settled" : `Round ${round}/${step.totalRounds}`}
          </span>
        </div>
        <p className="mt-3 font-display text-lg font-semibold leading-relaxed text-primary">
          {step.prompt}
        </p>
        <p className="mt-2 text-sm text-secondary">{step.contextHint}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
          Max spread &lt; {step.maxSpread} · a counterparty who knows the true value trades against you
        </p>
      </div>

      {/* Round history */}
      {mm && mm.results.length > 0 && (
        <div className="panel">
          <div className="border-b-[3px] border-border-strong px-4 py-2.5">
            <span className="label">Tape</span>
          </div>
          <ul>
            {mm.results.map((r) => (
              <li key={r.round} className="border-b border-subtle p-3 last:border-b-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="num text-primary">
                    R{r.round}: {r.quote.bid} / {r.quote.ask}{" "}
                    <span className="text-muted">
                      ({r.quote.bidSize}×{r.quote.askSize})
                    </span>
                  </span>
                  <span
                    className={`chip ${
                      r.kind === "informed"
                        ? "border-bear text-bear"
                        : r.kind === "noise"
                          ? "border-bull text-bull"
                          : "border-subtle text-muted"
                    }`}
                  >
                    {r.kind === "informed" ? "picked off" : r.kind === "noise" ? "earned spread" : "no trade"}
                  </span>
                </div>
                <p className="mt-1 text-sm italic text-secondary">{r.chatter}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quote entry */}
      {!done && (
        <div className="panel space-y-3 p-5">
          <span className="label text-accent">Your two-sided market</span>
          <div className="grid grid-cols-2 gap-3">
            <QuoteInput label="Bid" value={bid} onChange={setBid} />
            <QuoteInput label="Ask" value={ask} onChange={setAsk} />
            <QuoteInput label="Bid size" value={bidSize} onChange={setBidSize} />
            <QuoteInput label="Ask size" value={askSize} onChange={setAskSize} />
          </div>
          {error && (
            <p className="text-sm text-bear" role="alert">
              {error}
            </p>
          )}
          <button onClick={submit} className="btn-primary w-full">
            Show market ▸
          </button>
        </div>
      )}

      {/* Settlement */}
      {done && mm && (
        <div className="animate-print-in space-y-4">
          <div className="border border-subtle">
            <div
              className={`flex items-center justify-between px-4 py-2 ${
                mm.pnl > 0 ? "bg-bull text-bg" : mm.pnl < 0 ? "bg-bear text-bg" : "bg-surface-muted text-muted"
              }`}
            >
              <span className="font-mono text-xs font-semibold uppercase tracking-label">
                P&amp;L {mm.pnl > 0 ? "+" : ""}
                {mm.pnl}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
                true value {mm.trueValue}
              </span>
            </div>
            <div className="bg-surface p-4 text-sm text-secondary">{mm.verdict}</div>
          </div>
          <button onClick={onNext} className="btn-primary w-full">
            {isLast ? "See Results ▸" : "Next Question ▸"}
          </button>
        </div>
      )}
    </div>
  );
}

function QuoteInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="label text-secondary">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="num mt-1 min-h-[44px] w-full rounded border-2 border-border-strong bg-surface px-3 py-2 text-lg font-semibold text-primary outline-none transition-colors focus:border-accent"
      />
    </label>
  );
}
