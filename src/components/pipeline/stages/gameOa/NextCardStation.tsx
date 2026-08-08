import { useMemo, useRef, useState } from "react";
import { Rng } from "@/lib/rng";
import {
  bestOption,
  dealCycle,
  evaluateHigherLower,
  freshDeck,
  rankValue,
  type BetOption,
  type Card,
  type CycleState,
  type GameConfig,
} from "@/lib/games/nextCardBetting/engine";
import { rankLabel } from "@/lib/games/format";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  StationProgress,
  freshSeed,
  useStationFold,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("next-card").key;

export const NEXT_CARD_ROUNDS = 6;

const CONFIG: GameConfig = { numSuits: 4, aceMode: "high" };

type Choice = "higher" | "lower" | "skip";

/**
 * Next-card betting battery station — reuses the pure card-counting engine
 * (`dealCycle` + `evaluateHigherLower` + Kelly's `bestOption`). The deck depletes
 * across rounds and every dealt card stays visible, so the +EV call demands
 * COUNTING the remaining deck and pricing the conditional probability. A correct
 * decision (bet the >50% side; skip when neither clears 50%) folds into
 * `competency::card-counting-kelly`.
 */
export default function NextCardStation({ onComplete }: StationProps) {
  const rngRef = useRef<Rng>(new Rng(freshSeed()));
  const { record, summary } = useStationFold(SUBTOPIC);

  const deckRef = useRef<Card[]>(freshDeck(CONFIG));
  const visibleRef = useRef<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState<CycleState>(() => {
    const c = dealCycle(rngRef.current, deckRef.current, CONFIG, visibleRef.current);
    deckRef.current = c.deck;
    visibleRef.current = c.visible;
    return c;
  });
  const [reveal, setReveal] = useState<{
    choice: Choice;
    correct: boolean;
    options: BetOption[];
    best: BetOption;
  } | null>(null);
  const correctRef = useRef(0);
  const doneRef = useRef(false);

  const isLast = index >= NEXT_CARD_ROUNDS - 1;

  // Options for the CURRENT reference against the remaining deck.
  const options = useMemo(
    () => evaluateHigherLower(cycle.reference, cycle.deck, CONFIG.aceMode),
    [cycle],
  );
  const remaining = cycle.deck.length;

  const decide = (choice: Choice) => {
    if (reveal) return;
    const best = bestOption(options);
    const shouldBet = best.p > 0.5;
    const correct = shouldBet ? choice === best.side : choice === "skip";
    if (correct) correctRef.current += 1;
    record(correct ? 1 : 0);
    setReveal({ choice, correct, options, best });
  };

  const advance = () => {
    if (isLast) {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete(summary(`${correctRef.current} / ${NEXT_CARD_ROUNDS} correct`));
      return;
    }
    const c = dealCycle(rngRef.current, deckRef.current, CONFIG, visibleRef.current);
    deckRef.current = c.deck;
    visibleRef.current = c.visible;
    setReveal(null);
    setCycle(c);
    setIndex((n) => n + 1);
  };

  const refLabel = `${rankLabel(cycle.reference.rank)}${cycle.reference.suit}`;

  return (
    <div className="space-y-4" data-testid="next-card-station">
      <StationProgress
        index={index}
        total={NEXT_CARD_ROUNDS}
        correct={correctRef.current}
      />

      <div className="panel-ruled p-5 text-center">
        <span className="label text-accent">Will the next card be…</span>
        <div className="mt-3 font-display text-5xl font-black text-primary">
          {refLabel}
        </div>
        <p className="mt-2 text-xs text-muted">
          <span className="num text-secondary">{remaining}</span> cards remain (
          reference value {rankValue(cycle.reference.rank, CONFIG.aceMode)}). Count
          what's left before you bet.
        </p>
      </div>

      {reveal === null ? (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className="btn-ghost border border-bull text-bull"
            onClick={() => decide("higher")}
            aria-label="higher"
          >
            Higher
          </button>
          <button
            type="button"
            className="btn-ghost border border-subtle"
            onClick={() => decide("skip")}
            aria-label="skip"
          >
            Skip
          </button>
          <button
            type="button"
            className="btn-ghost border border-bear text-bear"
            onClick={() => decide("lower")}
            aria-label="lower"
          >
            Lower
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`verdict ${reveal.correct ? "bg-bull text-bg" : "bg-bear text-bg"}`}
          >
            {reveal.correct
              ? "● Correct call"
              : reveal.best.p > 0.5
                ? `● Better: bet ${reveal.best.label} (Kelly ${reveal.best.kelly})`
                : "● Better: skip — neither side clears 50%"}
          </div>
          <p className="reveal text-secondary">
            P(higher) ={" "}
            <span className="num text-bull">
              {(reveal.options[0].p * 100).toFixed(0)}%
            </span>{" "}
            · P(lower) ={" "}
            <span className="num text-bear">
              {(reveal.options[1].p * 100).toFixed(0)}%
            </span>
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={advance}
            data-testid="station-advance"
          >
            {isLast ? "Finish game →" : "Next card →"}
          </button>
        </div>
      )}
    </div>
  );
}
