/**
 * lib/oa/questionPool.ts — deterministic, seeded source of INTERVIEW-GRADE
 * conceptual multiple-choice questions for the Timed OA practice sections.
 *
 * It does NOT author new content. Instead it curates a handful of the app's
 * EXISTING conceptual quiz `QuestionGenerator`s (EV / optimal-stopping,
 * fair-value / market-making / arbitrage, and general probability) and adapts
 * each generated `Question` into the OA feature's `OaQuestion` shape.
 *
 * Determinism contract: `drawOaQuestions(seed, count)` builds ONE `Rng(seed)`,
 * shuffles the curated pool with it, then draws `count` items by cycling the
 * shuffled pool and calling each generator with that SAME rng — so the numbers
 * vary per draw yet the whole sequence is fully reproducible from `seed`. Ids
 * are forced unique (`oa-${seed}-${i}`) so reusing a generator never collides.
 */
import type { Question, QuestionGenerator } from "@/types/content";
import { Rng } from "@/lib/rng";
import { EV_GENERATORS } from "@/content/interviewGames/generators";
import { TRADING_QUIZ_GENERATORS } from "@/content/interviewGames/tradingGames";
import {
  genAllOn,
  genBayesTest,
  genBertrand,
  genBoth,
  genCheerLoser,
  genGivenSum,
  genInversion,
  genRRFixed,
  genRRRespun,
  genWhichDie,
} from "@/content/probabilityStats/conditionalProbability/generators";
import {
  genHigherDiffer,
  genMartingaleDoubling,
  genSecondMoment,
  genThreeDicePayoff,
  genTwoDiceMatch,
  genWald,
  genWalkDuration,
  genWalkReach,
} from "@/content/probabilityStats/expectedValue/generators";
import {
  genDiceSumQuiz,
  genDieCompare,
  genParitySymmetry,
} from "@/content/probabilityStats/combinatorialAnalysis/genGeneralDice";
import { genGeoArea } from "@/content/probabilityStats/geometricProbability/generators";
import {
  genBoldPlay,
  genPatternRace,
  genPatternWait,
  genRuinReach,
} from "@/content/probabilityStats/markovChains/generators";
import { genRuin } from "@/content/probabilityStats/markovChains/genGeneralWalks";
import type { OaFormatConfig, OaQuestion } from "./types";

/**
 * The curated interview-grade pool. Spans three genre clusters, favoring
 * medium/hard difficulty:
 *  - EV / optimal-stopping / fair value: genReRollDie, genFairValue
 *  - Market-making / arbitrage / betting: genBasketArb, genVigArb,
 *    genNextCardBet, genMakeMarketPnl
 *  - General probability: genBayesTest, genWhichDie (Bayes), genWald,
 *    genMartingaleDoubling (martingales / random walks)
 */
export const OA_QUESTION_GENERATORS: QuestionGenerator[] = [
  // EV / optimal-stopping / fair value
  EV_GENERATORS.genReRollDie,
  EV_GENERATORS.genFairValue,
  // Market-making / arbitrage / betting
  TRADING_QUIZ_GENERATORS.genBasketArb,
  TRADING_QUIZ_GENERATORS.genVigArb,
  TRADING_QUIZ_GENERATORS.genNextCardBet,
  TRADING_QUIZ_GENERATORS.genMakeMarketPnl,
  // General probability (Bayes + martingales / random walks)
  genBayesTest,
  genWhichDie,
  genWald,
  genMartingaleDoubling,
];

/**
 * Per-format curated pools mapping each research-derived format to the
 * archetypes the firm actually tests. Every entry reuses an EXISTING
 * interview-grade generator (no fabricated content); where a firm's ideal
 * archetype is missing from the app (pure combinatorics, true Fermi word
 * problems, linear algebra) we fall back to the closest available generator and
 * flag the gap in the build report rather than authoring low-quality filler.
 *
 *  - `mixed`      — the default interview pool (`OA_QUESTION_GENERATORS`); the
 *                   three original formats draw from it unchanged.
 *  - `rapidMixed` — Citadel-style rapid mixed battery: quick probability / EV /
 *                   estimation / arbitrage that reward fast intuition.
 *  - `blitz`      — Five Rings-style probability + combinatorics + estimation
 *                   (dice-combinatorics + geometry/Fermi stand in for the thin
 *                   pure-combinatorics/estimation archetypes).
 *  - `derivation` — IMC-style harder multi-step derivations (optimal stopping,
 *                   Wald/martingale, random-walk EV, recursion, conditioning).
 *  - `deepSet`    — DRW-style deep problems: Markov chains + recursion + deep
 *                   probability/EV. (Linear-algebra archetype unavailable — a
 *                   noted content gap; Markov/recursion cover the rest.)
 */
export const OA_CONTENT_POOLS: Record<string, QuestionGenerator[]> = {
  mixed: OA_QUESTION_GENERATORS,
  rapidMixed: [
    genTwoDiceMatch,
    genThreeDicePayoff,
    genHigherDiffer,
    EV_GENERATORS.genFairValue,
    EV_GENERATORS.genReRollDie,
    TRADING_QUIZ_GENERATORS.genNextCardBet,
    TRADING_QUIZ_GENERATORS.genFermiMagnitude,
    TRADING_QUIZ_GENERATORS.genBasketArb,
    TRADING_QUIZ_GENERATORS.genVigArb,
    genBayesTest,
    genWhichDie,
    genDiceSumQuiz,
  ],
  blitz: [
    // Combinatorics (dice-combinatorics — closest available archetype)
    genDiceSumQuiz,
    genParitySymmetry,
    genDieCompare,
    // Estimation / geometry
    genGeoArea,
    TRADING_QUIZ_GENERATORS.genFermiMagnitude,
    // Probability
    genBoth,
    genGivenSum,
    genBertrand,
    genAllOn,
    genBayesTest,
    genWhichDie,
    genTwoDiceMatch,
  ],
  derivation: [
    EV_GENERATORS.genReRollDie,
    genWald,
    genMartingaleDoubling,
    genWalkReach,
    genWalkDuration,
    genSecondMoment,
    genRRFixed,
    genRRRespun,
    genCheerLoser,
    genInversion,
    genPatternWait,
    TRADING_QUIZ_GENERATORS.genMakeMarketPnl,
  ],
  deepSet: [
    // Markov chains / recursion (the DRW signature)
    genPatternWait,
    genPatternRace,
    genRuinReach,
    genBoldPlay,
    genRuin,
    // Deep probability / EV
    genWald,
    EV_GENERATORS.genReRollDie,
    genRRRespun,
    genCheerLoser,
    genWalkDuration,
  ],
};

/** Resolve a format's generator pool, defaulting to the mixed interview pool. */
export function poolForFormat(config: OaFormatConfig): QuestionGenerator[] {
  const id = config.contentPool;
  return (id && OA_CONTENT_POOLS[id]) || OA_QUESTION_GENERATORS;
}

/**
 * Adapt a generated `Question` into the feature's `OaQuestion` shape, forcing a
 * caller-supplied unique id so repeated draws of the same generator (whose ids
 * are template-stable, e.g. `ig-fair-50`) never collide within a session.
 */
export function toOaQuestion(q: Question, uniqueId: string): OaQuestion {
  return {
    id: uniqueId,
    prompt: q.prompt,
    choices: q.choices,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    concept: q.concept,
    difficulty: q.difficulty,
    source: q.source,
  };
}

/**
 * Deterministically draw exactly `count` OA questions from an explicit
 * `generators` pool. Same `(seed, count, generators)` ⇒ identical output (ids,
 * prompts, correctIndex): one `Rng(seed)` shuffles the pool, then draws by
 * cycling it and calling each generator with that SAME rng, so numbers vary per
 * draw yet the whole sequence is reproducible. Ids are forced unique
 * (`oa-${seed}-${i}`) so reusing a generator never collides.
 */
export function drawOaQuestionsFromPool(
  seed: number,
  count: number,
  generators: QuestionGenerator[],
): OaQuestion[] {
  const rng = new Rng(seed);
  const pool = rng.shuffle(generators);
  const out: OaQuestion[] = [];
  if (pool.length === 0) return out;
  for (let i = 0; i < count; i++) {
    const gen = pool[i % pool.length];
    const q = gen(rng);
    out.push(toOaQuestion(q, `oa-${seed}-${i}`));
  }
  return out;
}

/**
 * Deterministically draw exactly `count` OA questions from the default mixed
 * interview pool (`OA_QUESTION_GENERATORS`). Kept as the stable, pool-agnostic
 * entry point the original formats + tests rely on.
 */
export function drawOaQuestions(seed: number, count: number): OaQuestion[] {
  return drawOaQuestionsFromPool(seed, count, OA_QUESTION_GENERATORS);
}

/**
 * Draw `count` questions for a specific format, using that format's curated
 * archetype pool (`config.contentPool` → `OA_CONTENT_POOLS`, default mixed).
 */
export function drawOaQuestionsForFormat(
  config: OaFormatConfig,
  seed: number,
  count: number,
): OaQuestion[] {
  return drawOaQuestionsFromPool(seed, count, poolForFormat(config));
}
