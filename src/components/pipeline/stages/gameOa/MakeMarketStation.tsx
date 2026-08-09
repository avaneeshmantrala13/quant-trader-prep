import { useRef, useState } from "react";
import { Rng } from "@/lib/rng";
import { marketMakingCredit } from "@/lib/mastery/competency";
import {
  counterpartyTight,
  markToTrue,
  noFillCredit,
  round2,
  validateQuote,
  type CounterpartyAction,
  type Fill,
  type Quote,
} from "@/lib/games/makeMarket/engine";
import {
  dealHardQuantity,
  type HardQuantityScenario,
} from "@/content/games/hardToValueQuantities";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  StationProgress,
  fmtNum,
  useStationFold,
  useStationSeed,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("make-market").key;

export const MAKE_MARKET_ROUNDS = 6;

/**
 * Make-a-market battery station — the classic quote-a-tight-two-sided-market
 * drill (spread-setting & adverse-selection avoidance). Reuses the pure
 * make-a-market engine + hard-to-value quantity bank and the P2 scorer
 * (`marketMakingCredit`: informed pick-off ⇒ 0, non-picked-off positive P&L ⇒ 1),
 * folding each round into `competency::spread-setting`.
 */
export default function MakeMarketStation({ onComplete, seed }: StationProps) {
  const { record, summary } = useStationFold(SUBTOPIC);
  const mountSeed = useStationSeed(seed);
  const rngRef = useRef<Rng>(new Rng(mountSeed));
  const [index, setIndex] = useState(0);
  const [scenario, setScenario] = useState<HardQuantityScenario>(() =>
    dealHardQuantity(rngRef.current),
  );
  const [reveal, setReveal] = useState<{
    action: CounterpartyAction;
    pnl: number;
    earned: boolean;
    noFill: boolean;
  } | null>(null);
  const earnedRef = useRef(0);
  const pnlRef = useRef(0);
  const doneRef = useRef(false);

  const [bid, setBid] = useState("");
  const [ask, setAsk] = useState("");
  const isLast = index >= MAKE_MARKET_ROUNDS - 1;

  const maxSpread = scenario.suggestedMaxSpread;
  const spread =
    bid && ask && Number.isFinite(parseFloat(bid)) && Number.isFinite(parseFloat(ask))
      ? parseFloat(ask) - parseFloat(bid)
      : null;
  const spreadOk = spread !== null && spread > 0 && spread < maxSpread;

  const submit = () => {
    if (reveal) return;
    const q: Quote = {
      bid: parseFloat(bid),
      ask: parseFloat(ask),
      bidSize: 1,
      askSize: 1,
    };
    if (!validateQuote(q, maxSpread).ok) return;
    const at = new Date().toISOString();
    const action = counterpartyTight(
      q,
      scenario.trueValue,
      maxSpread,
      index + 1,
      rngRef.current,
      0.8,
    );
    const fills: Fill[] = action.fill ? [action.fill] : [];
    const noFill = !action.fill;
    const pnl = round2(markToTrue(fills, scenario.trueValue));
    const pickedOff = action.kind === "informed";
    // A quiet no-fill round is NOT an automatic miss: a well-centred, tight quote
    // that simply drew no counterparty is scored on whether it bracketed the
    // truth (would-have-earned), not credited 0 like a pick-off.
    const credit = noFill
      ? noFillCredit(q, scenario.trueValue)
      : marketMakingCredit({ pnl, pickedOff, at });
    const earned = credit >= 1;
    if (earned) earnedRef.current += 1;
    pnlRef.current = round2(pnlRef.current + pnl);
    record(credit, at);
    setReveal({ action, pnl, earned, noFill });
  };

  const advance = () => {
    if (isLast) {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete(
        summary(
          `${earnedRef.current}/${MAKE_MARKET_ROUNDS} edge · P&L ${
            pnlRef.current >= 0 ? "+" : "−"
          }${fmtNum(Math.abs(pnlRef.current))}`,
        ),
      );
      return;
    }
    setReveal(null);
    setBid("");
    setAsk("");
    setScenario(dealHardQuantity(rngRef.current));
    setIndex((n) => n + 1);
  };

  return (
    <div className="space-y-4" data-testid="make-market-station">
      <StationProgress
        index={index}
        total={MAKE_MARKET_ROUNDS}
        correct={earnedRef.current}
      />

      <div className="panel-ruled p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="label text-accent">{scenario.category}</span>
          <span className="chip border-accent text-accent">
            max spread {fmtNum(maxSpread)}
          </span>
        </div>
        <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-primary">
          {scenario.prompt}
        </h3>
        <p className="mt-2 text-xs text-muted">
          Answer in <span className="text-secondary">{scenario.unit}</span>
        </p>
      </div>

      {reveal === null ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label mb-1 block text-bull">Bid — you buy</span>
              <input
                className="input w-full"
                inputMode="decimal"
                value={bid}
                onChange={(e) => setBid(e.target.value)}
                aria-label="bid"
              />
            </label>
            <label className="block">
              <span className="label mb-1 block text-bear">Ask — you sell</span>
              <input
                className="input w-full"
                inputMode="decimal"
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                aria-label="ask"
              />
            </label>
          </div>
          <div className="rule-row !border-y-0">
            <span className="label text-muted">Spread</span>
            <span
              className={`num text-sm font-semibold ${
                spread === null ? "text-muted" : spreadOk ? "text-bull" : "text-bear"
              }`}
            >
              {spread === null ? "—" : fmtNum(spread)}
            </span>
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={submit}
            disabled={!spreadOk}
          >
            Show market
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`verdict ${reveal.earned ? "bg-bull text-bg" : "bg-bear text-bg"}`}
          >
            {reveal.noFill
              ? reveal.earned
                ? "● Quiet round — well-centred market (no fill)"
                : "● Quiet round — but your market was offside"
              : reveal.earned
                ? "● Captured the edge"
                : "● Picked off / no edge"}
          </div>
          <p className="reveal text-secondary">
            “{reveal.action.chatter}” · P&amp;L{" "}
            <span className={reveal.pnl >= 0 ? "text-bull" : "text-bear"}>
              {reveal.pnl >= 0 ? "+" : "−"}
              {fmtNum(Math.abs(reveal.pnl))}
            </span>{" "}
            · true value{" "}
            <span className="num text-primary">{fmtNum(scenario.trueValue)}</span>{" "}
            {scenario.unit}
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={advance}
            data-testid="station-advance"
          >
            {isLast ? "Finish game →" : "Next round →"}
          </button>
        </div>
      )}
    </div>
  );
}
