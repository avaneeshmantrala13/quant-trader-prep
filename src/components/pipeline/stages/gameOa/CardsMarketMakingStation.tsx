import { useRef, useState } from "react";
import { Rng } from "@/lib/rng";
import {
  analyzeEdge,
  dealConditionalRound,
  rankLabel,
  type Action,
  type ConditionalCardsRound,
  type RoundConfig,
} from "@/lib/games/cardsMarketMaking/engine";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  StationProgress,
  fmtNum,
  useStationFold,
  useStationSeed,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("cards-mm").key;

export const CARDS_MM_ROUNDS = 6;

const CONFIG: RoundConfig = { numCards: 3, aceValue: 14, replace: true };
/** One card is turned face-up before the trade → the taker prices the posterior. */
const NUM_REVEALED = 1;

/**
 * Cards market-making battery station — trains VALUE OF INFORMATION / conditional
 * updating (not static edge detection). A maker quotes B–A CENTERED on the prior
 * EV of the SUM of three cards; then one card is turned FACE-UP. Because the
 * quote sits on the prior, the only edge lives in the POSTERIOR expected sum
 * (`revealed + hidden·mean`): you Buy when the ask is below the *updated* EV,
 * Sell when the bid is above it, else Pass. Each posterior-EV-correct decision
 * folds into `competency::conditional-pricing` — a taker who ignores the reveal
 * and prices off the static prior would pass every round and score poorly.
 */
export default function CardsMarketMakingStation({
  onComplete,
  seed,
}: StationProps) {
  const { record, summary } = useStationFold(SUBTOPIC);
  const mountSeed = useStationSeed(seed);
  const rngRef = useRef<Rng>(new Rng(mountSeed));
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<ConditionalCardsRound>(() =>
    dealConditionalRound(rngRef.current, CONFIG, NUM_REVEALED),
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
    // Grade against the POSTERIOR EV — the whole point is conditional updating.
    const edge = analyzeEdge(round.quote, round.posteriorEv);
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
    setRound(dealConditionalRound(rngRef.current, CONFIG, NUM_REVEALED));
    setIndex((n) => n + 1);
  };

  const actionWord = (a: Action) =>
    a === "buy" ? "Buy (lift ask)" : a === "sell" ? "Sell (hit bid)" : "Pass";

  const hiddenCount = CONFIG.numCards - round.numRevealed;

  return (
    <div className="space-y-4" data-testid="cards-mm-station">
      <StationProgress
        index={index}
        total={CARDS_MM_ROUNDS}
        correct={correctRef.current}
      />

      <div className="panel-ruled p-5 text-center">
        <span className="label text-accent">
          Market on the SUM of {CONFIG.numCards} cards
        </span>
        <div className="mt-3 flex items-center justify-center gap-6">
          <span className="chip num border-bull text-bull text-base">
            Bid {round.quote.bid}
          </span>
          <span className="chip num border-bear text-bear text-base">
            Ask {round.quote.ask}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          {round.revealed.map((c, i) => (
            <span
              key={`up-${i}`}
              className="num inline-flex h-12 w-9 items-center justify-center rounded border border-subtle bg-surface text-lg font-bold text-primary"
              aria-label={`revealed card ${rankLabel(c.rank)}${c.suit}`}
            >
              {rankLabel(c.rank)}
              {c.suit}
            </span>
          ))}
          {Array.from({ length: hiddenCount }).map((_, i) => (
            <span
              key={`down-${i}`}
              className="inline-flex h-12 w-9 items-center justify-center rounded border border-subtle bg-muted/20 text-lg text-muted"
              aria-label="face-down card"
            >
              ?
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          The quote is centered on the prior EV (
          <span className="num text-secondary">{fmtNum(round.evSum)}</span>).
          Update on the shown card: posterior EV ={" "}
          <span className="num text-secondary">{fmtNum(round.posteriorEv)}</span>.
          Trade only if the quote is on the wrong side of THAT.
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
              ? "● Priced the posterior correctly"
              : `● Better: ${actionWord(reveal.correctAction)}`}
          </div>
          <p className="reveal text-secondary">
            All cards:{" "}
            <span className="num text-primary">
              {round.cards.map((c) => `${rankLabel(c.rank)}${c.suit}`).join("  ")}
            </span>{" "}
            → sum <span className="num text-primary">{round.sum}</span>. Posterior
            EV after the reveal was{" "}
            <span className="num text-primary">{fmtNum(round.posteriorEv)}</span>{" "}
            (prior {fmtNum(round.evSum)}).
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
