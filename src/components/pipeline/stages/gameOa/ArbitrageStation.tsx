import { useMemo } from "react";
import {
  buildArbitrageDrill,
  type DrillItem,
} from "@/lib/games/arbitrage/engine";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import { McqStation, freshSeed, type McqRound, type StationProps } from "./kit";

const SUBTOPIC = tradingSubtopicByGame("arbitrage").key;

export const ARBITRAGE_ROUNDS = 6;

/**
 * Arbitrage & de-vig battery station — reuses `buildArbitrageDrill` and plays
 * its QUIZ items (overround removal / Dutch-book detection) through
 * {@link McqStation}, folding into `competency::arbitrage-devig`. (The drill's
 * numeric de-vig items are a stand-alone-mode feature; the battery uses the
 * multiple-choice detection items, which capture the same skill without a
 * free-entry pad.)
 */
export default function ArbitrageStation({ onComplete }: StationProps) {
  const rounds = useMemo<McqRound[]>(() => {
    const drawn = buildArbitrageDrill(freshSeed(), ARBITRAGE_ROUNDS * 3);
    const quiz = drawn.filter(
      (it): it is Extract<DrillItem, { kind: "quiz" }> => it.kind === "quiz",
    );
    return quiz.slice(0, ARBITRAGE_ROUNDS).map((it) => ({
      id: it.id,
      tag: it.family,
      prompt: it.question.prompt,
      options: it.question.choices.map((o) => <span>{o}</span>),
      correctIndex: it.question.correctIndex,
      explanation: it.question.explanation,
    }));
  }, []);

  return (
    <McqStation subtopicKey={SUBTOPIC} rounds={rounds} onComplete={onComplete} />
  );
}
