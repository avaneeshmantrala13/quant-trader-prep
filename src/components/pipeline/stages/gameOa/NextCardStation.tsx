import { useMemo, useRef, useState } from "react";
import { Rng } from "@/lib/rng";
import {
  bestOption,
  dealCycle,
  evaluateHigherLower,
  freshDeck,
  rankValue,
  roundKellyCredit,
  type BetOption,
  type Card,
  type CycleState,
  type GameConfig,
} from "@/lib/games/nextCardBetting/engine";
import { rankLabel } from "@/lib/games/format";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  StationProgress,
  useStationFold,
  useStationSeed,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("next-card").key;

export const NEXT_CARD_ROUNDS = 6;

const CONFIG: GameConfig = { numSuits: 4, aceMode: "high" };

/** Bankroll-fraction stake options the player sizes with (even-money Kelly). */
const STAKE_OPTIONS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.75] as const;

/** A round counts toward the "correct" tally once it earns most of its credit. */
const WELL_PLAYED = 0.5;

type Side = "higher" | "lower";
type Phase = "decide" | "size";

/**
 * Next-card betting battery station — reuses the pure card-counting engine
 * (`dealCycle` + `evaluateHigherLower`) AND now scores KELLY SIZING. Each round
 * is two steps: (1) COUNT the depleting deck and pick the >50% side (or skip when
 * neither clears 50%), then (2) SIZE the stake as a fraction of bankroll. Credit
 * folds the engine's `roundKellyCredit` (counting + closeness to f* = 2p − 1)
 * into `competency::card-counting-kelly`, so the station tests both the read and
 * the bet sizing it claims to.
 */
export default function NextCardStation({ onComplete, seed }: StationProps) {
  const mountSeed = useStationSeed(seed);
  const rngRef = useRef<Rng>(new Rng(mountSeed));
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
  const [phase, setPhase] = useState<Phase>("decide");
  const [pendingSide, setPendingSide] = useState<Side | null>(null);
  const [reveal, setReveal] = useState<{
    credit: number;
    options: BetOption[];
    best: BetOption;
    chosenSide: string;
    chosenFraction: number;
  } | null>(null);
  const correctRef = useRef(0);
  const creditRef = useRef(0);
  const doneRef = useRef(false);

  const isLast = index >= NEXT_CARD_ROUNDS - 1;

  // Options for the CURRENT reference against the remaining deck.
  const options = useMemo(
    () => evaluateHigherLower(cycle.reference, cycle.deck, CONFIG.aceMode),
    [cycle],
  );
  const remaining = cycle.deck.length;

  const score = (chosenSide: string, chosenFraction: number) => {
    const best = bestOption(options);
    const credit = roundKellyCredit(options, chosenSide, chosenFraction);
    if (credit >= WELL_PLAYED) correctRef.current += 1;
    creditRef.current += credit;
    record(credit);
    setReveal({ credit, options, best, chosenSide, chosenFraction });
  };

  const chooseSide = (side: Side) => {
    if (reveal || phase !== "decide") return;
    setPendingSide(side);
    setPhase("size");
  };

  const skip = () => {
    if (reveal || phase !== "decide") return;
    score("skip", 0);
  };

  const chooseStake = (fraction: number) => {
    if (reveal || phase !== "size" || !pendingSide) return;
    score(pendingSide, fraction);
  };

  const advance = () => {
    if (isLast) {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete(
        summary(`${creditRef.current.toFixed(1)} / ${NEXT_CARD_ROUNDS} Kelly-skill`),
      );
      return;
    }
    const c = dealCycle(rngRef.current, deckRef.current, CONFIG, visibleRef.current);
    deckRef.current = c.deck;
    visibleRef.current = c.visible;
    setReveal(null);
    setPendingSide(null);
    setPhase("decide");
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
          what's left, pick the &gt;50% side, then size your bet.
        </p>
      </div>

      {reveal !== null ? (
        <div className="space-y-3">
          <div
            className={`verdict ${reveal.credit >= WELL_PLAYED ? "bg-bull text-bg" : "bg-bear text-bg"}`}
          >
            {reveal.best.p > 0.5
              ? `● Best: bet ${reveal.best.label} at Kelly ${(reveal.best.kelly * 100).toFixed(0)}%`
              : "● Best: skip — neither side clears 50%"}{" "}
            · you earned {(reveal.credit * 100).toFixed(0)}%
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
            {reveal.chosenSide !== "skip" && (
              <>
                {" "}
                · you staked{" "}
                <span className="num text-primary">
                  {(reveal.chosenFraction * 100).toFixed(0)}%
                </span>{" "}
                on {reveal.chosenSide}
              </>
            )}
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
      ) : phase === "decide" ? (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className="btn-ghost border border-bull text-bull"
            onClick={() => chooseSide("higher")}
            aria-label="higher"
          >
            Higher
          </button>
          <button
            type="button"
            className="btn-ghost border border-subtle"
            onClick={skip}
            aria-label="skip"
          >
            Skip
          </button>
          <button
            type="button"
            className="btn-ghost border border-bear text-bear"
            onClick={() => chooseSide("lower")}
            aria-label="lower"
          >
            Lower
          </button>
        </div>
      ) : (
        <div className="space-y-3" data-testid="next-card-sizing">
          <p className="text-center text-xs text-muted">
            Betting{" "}
            <span className={pendingSide === "higher" ? "text-bull" : "text-bear"}>
              {pendingSide}
            </span>{" "}
            — stake what fraction of your bankroll? (Kelly = 2p − 1)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {STAKE_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                className="btn-ghost justify-center border border-subtle hover:border-accent"
                onClick={() => chooseStake(f)}
                aria-label={`stake ${Math.round(f * 100)} percent`}
              >
                <span className="num">{Math.round(f * 100)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
