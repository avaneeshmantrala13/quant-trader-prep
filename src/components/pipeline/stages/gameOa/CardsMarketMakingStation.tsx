import { useRef, useState } from "react";
import { Rng } from "@/lib/rng";
import {
  analyzeEdge,
  dealRound,
  rankLabel,
  type Action,
  type CardsRound,
  type RoundConfig,
} from "@/lib/games/cardsMarketMaking/engine";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  StationProgress,
  fmtNum,
  freshSeed,
  useStationFold,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("cards-mm").key;

export const CARDS_MM_ROUNDS = 6;

const CONFIG: RoundConfig = { numCards: 3, aceValue: 14, replace: true };

/**
 * Cards market-making battery station — reuses `dealRound` + `analyzeEdge` to
 * train conditional pricing / value-of-information: a maker quotes B–A on the
 * SUM of three hidden cards; you trade only when the quote sits on the wrong
 * side of the unconditional EV (buy when ask < EV, sell when bid > EV, else
 * pass). Each EV-correct decision folds into `competency::conditional-pricing`.
 */
export default function CardsMarketMakingStation({ onComplete }: StationProps) {
  const { record, summary } = useStationFold(SUBTOPIC);
  const rngRef = useRef<Rng>(new Rng(freshSeed()));
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<CardsRound>(() =>
    dealRound(rngRef.current, CONFIG),
  );
  const [reveal, setReveal] = useState<{
    action: Action;
    correct: boolean;
    correctAction: Action;
  } | null>(null);
  const correctRef = useRef(0);
  const doneRef = useRef(false);

  const isLast = index >= CARDS_MM_ROUNDS - 1;

  const decide = (action: Action) => {
    if (reveal) return;
    const edge = analyzeEdge(round.quote, round.evSum);
    const correct = action === edge.correctAction;
    if (correct) correctRef.current += 1;
    record(correct ? 1 : 0);
    setReveal({ action, correct, correctAction: edge.correctAction });
  };

  const advance = () => {
    if (isLast) {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete(summary(`${correctRef.current} / ${CARDS_MM_ROUNDS} correct`));
      return;
    }
    setReveal(null);
    setRound(dealRound(rngRef.current, CONFIG));
    setIndex((n) => n + 1);
  };

  const actionWord = (a: Action) =>
    a === "buy" ? "Buy (lift ask)" : a === "sell" ? "Sell (hit bid)" : "Pass";

  return (
    <div className="space-y-4" data-testid="cards-mm-station">
      <StationProgress
        index={index}
        total={CARDS_MM_ROUNDS}
        correct={correctRef.current}
      />

      <div className="panel-ruled p-5 text-center">
        <span className="label text-accent">
          Market on the SUM of {CONFIG.numCards} hidden cards
        </span>
        <div className="mt-3 flex items-center justify-center gap-6">
          <span className="chip num border-bull text-bull text-base">
            Bid {round.quote.bid}
          </span>
          <span className="chip num border-bear text-bear text-base">
            Ask {round.quote.ask}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted">
          A random card averages 8, so three cards average{" "}
          <span className="num text-secondary">{fmtNum(round.evSum)}</span>. Trade
          only when the quote is on the wrong side of that.
        </p>
      </div>

      {reveal === null ? (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className="btn-ghost border border-bull text-bull"
            onClick={() => decide("buy")}
            aria-label="buy"
          >
            Buy
          </button>
          <button
            type="button"
            className="btn-ghost border border-subtle"
            onClick={() => decide("none")}
            aria-label="pass"
          >
            Pass
          </button>
          <button
            type="button"
            className="btn-ghost border border-bear text-bear"
            onClick={() => decide("sell")}
            aria-label="sell"
          >
            Sell
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`verdict ${reveal.correct ? "bg-bull text-bg" : "bg-bear text-bg"}`}
          >
            {reveal.correct
              ? "● EV-correct decision"
              : `● Better: ${actionWord(reveal.correctAction)}`}
          </div>
          <p className="reveal text-secondary">
            Cards:{" "}
            <span className="num text-primary">
              {round.cards.map((c) => `${rankLabel(c.rank)}${c.suit}`).join("  ")}
            </span>{" "}
            → sum <span className="num text-primary">{round.sum}</span> (EV{" "}
            {fmtNum(round.evSum)}).
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
