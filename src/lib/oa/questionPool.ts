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
import { SEQUENCE_QUIZ_GENERATORS } from "@/content/sequences/generators";
import { ARBITRAGE_QUIZ_GENERATORS } from "@/content/arbitrage/generators";
import { AUCTION_QUIZ_GENERATORS } from "@/content/auctions/generators";
import { HARD_OA_GENERATORS } from "./hardContent/generators";
import { selectSequenceServed } from "./store";
import type { OaFormatConfig, OaQuestion, OaTimedStore } from "./types";

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
 * interview-grade generator (no fabricated content). The pools now include
 * dedicated pattern-recognition (`SEQUENCE_QUIZ_GENERATORS`), no-arbitrage /
 * de-vig (`ARBITRAGE_QUIZ_GENERATORS`), and common-value / winner's-curse
 * auction (`AUCTION_QUIZ_GENERATORS`) archetypes, so those firm-tested skills
 * are FIRST-CLASS rather than approximated by a nearby generator.
 *
 * The firm pools (blitz / rapidMixed / derivation / deepSet) are further
 * anchored by the HARD, exact-verified archetypes in `hardContent/generators`
 * (built on `hardContent/solvers`) — the flagship lattice path-intersection
 * (parity trap), biased-ruin duration, secretary optimal-stopping, exact graph
 * hitting/meeting times, Conway pattern waits, hidden-composition & fair-vs-
 * biased Bayes, dice order statistics, order-flow adverse selection, the
 * one-reroll game value, the DRW step-landing recurrence, and Kelly sizing.
 * These are correct-by-construction (each answer comes from an exact solver) and
 * are ADDED to the existing curated generators, not replacements.
 *
 *  - `mixed`      — the default interview pool (`OA_QUESTION_GENERATORS`); the
 *                   three original formats draw from it unchanged.
 *  - `rapidMixed` — Citadel-style rapid mixed battery: quick probability / EV /
 *                   estimation, number/letter SEQUENCE pattern items, and
 *                   de-vig / value-leg / basket ARBITRAGE decisions that reward
 *                   fast intuition.
 *  - `blitz`      — Five Rings-style probability + combinatorics + estimation,
 *                   now anchored by real number / interleaved / letter SEQUENCE
 *                   pattern-recognition items alongside dice-combinatorics and
 *                   geometry/Fermi estimation.
 *  - `derivation` — IMC-style harder multi-step derivations (optimal stopping,
 *                   Wald/martingale, random-walk EV, recursion, conditioning),
 *                   plus multi-step no-arbitrage value/direction and
 *                   common-value AUCTION winner's-curse reasoning.
 *  - `deepSet`    — DRW-style deep problems: Markov chains + recursion + deep
 *                   probability/EV, plus common-value AUCTION winner's-curse
 *                   conditional-EV problems. (A linear-algebra archetype is still
 *                   unavailable — a noted content gap; the rest are covered.)
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
    // Sequences & pattern recognition (quick number/letter series + analogy).
    SEQUENCE_QUIZ_GENERATORS.arithmeticNext,
    SEQUENCE_QUIZ_GENERATORS.geometricNext,
    SEQUENCE_QUIZ_GENERATORS.caesarNext,
    SEQUENCE_QUIZ_GENERATORS.alternatingShiftNext,
    SEQUENCE_QUIZ_GENERATORS.analogyNext,
    // No-arbitrage / de-vig / basket decisions (fast Dutch-book intuition).
    ARBITRAGE_QUIZ_GENERATORS.genArbDetect,
    ARBITRAGE_QUIZ_GENERATORS.genValueLeg,
    ARBITRAGE_QUIZ_GENERATORS.genBasketArb,
    // Hard, exact-verified quick-quant (dice order stats, DRW recurrence, Kelly,
    // fair-vs-biased Bayes) — correct-by-construction from `hardContent/solvers`.
    HARD_OA_GENERATORS.hardDiceOrderStat,
    HARD_OA_GENERATORS.hardStepLanding,
    HARD_OA_GENERATORS.hardKelly,
    HARD_OA_GENERATORS.hardCoinBias,
  ],
  blitz: [
    // Combinatorics (dice-combinatorics).
    genDiceSumQuiz,
    genParitySymmetry,
    genDieCompare,
    // Estimation / geometry.
    genGeoArea,
    TRADING_QUIZ_GENERATORS.genFermiMagnitude,
    // Probability.
    genBoth,
    genGivenSum,
    genBertrand,
    genAllOn,
    genBayesTest,
    genWhichDie,
    genTwoDiceMatch,
    // Sequence pattern-recognition (number / interleaved / letter series).
    SEQUENCE_QUIZ_GENERATORS.polynomialNext,
    SEQUENCE_QUIZ_GENERATORS.interleavedNext,
    SEQUENCE_QUIZ_GENERATORS.fibonacciNext,
    SEQUENCE_QUIZ_GENERATORS.tribonacciNext,
    SEQUENCE_QUIZ_GENERATORS.alternatingOpNext,
    SEQUENCE_QUIZ_GENERATORS.oddOneOut,
    // Hard, exact-verified probability + combinatorics anchors (the flagship
    // lattice path-intersection with its parity trap, optimal stopping, Bayes,
    // dice order statistics).
    HARD_OA_GENERATORS.hardPathIntersect,
    HARD_OA_GENERATORS.hardSecretary,
    HARD_OA_GENERATORS.hardHiddenComposition,
    HARD_OA_GENERATORS.hardDiceOrderStat,
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
    // Multi-step no-arbitrage value/direction reasoning.
    ARBITRAGE_QUIZ_GENERATORS.genValueLeg,
    ARBITRAGE_QUIZ_GENERATORS.genBasketArb,
    // Common-value auction / winner's-curse decisions.
    AUCTION_QUIZ_GENERATORS.genBidEvDecision,
    AUCTION_QUIZ_GENERATORS.genShadingWithN,
    AUCTION_QUIZ_GENERATORS.genAcquireDecision,
    // Hard, exact-verified multi-step derivations (flagship path intersection,
    // biased-ruin duration, secretary, graph hitting time, order-flow Bayes,
    // one-reroll EV, Conway pattern waits, fair-vs-biased coin).
    HARD_OA_GENERATORS.hardPathIntersect,
    HARD_OA_GENERATORS.hardRuinDuration,
    HARD_OA_GENERATORS.hardSecretary,
    HARD_OA_GENERATORS.hardGraphHitting,
    HARD_OA_GENERATORS.hardInformedLift,
    HARD_OA_GENERATORS.hardOneReroll,
    HARD_OA_GENERATORS.hardPatternWait,
    HARD_OA_GENERATORS.hardCoinBias,
  ],
  deepSet: [
    // Markov chains / recursion (the DRW signature).
    genPatternWait,
    genPatternRace,
    genRuinReach,
    genBoldPlay,
    genRuin,
    // Deep probability / EV.
    genWald,
    EV_GENERATORS.genReRollDie,
    genRRRespun,
    genCheerLoser,
    genWalkDuration,
    // Deep common-value auction / winner's-curse conditional-EV problems.
    AUCTION_QUIZ_GENERATORS.genBidEvDecision,
    AUCTION_QUIZ_GENERATORS.genShadingWithN,
    AUCTION_QUIZ_GENERATORS.genAcquireDecision,
    // Hardest exact-verified deep problems (flagship path intersection,
    // biased-ruin duration, exact graph hitting times, reset coupon collector,
    // cycle meeting time with the parity trap, Conway pattern waits).
    HARD_OA_GENERATORS.hardPathIntersect,
    HARD_OA_GENERATORS.hardRuinDuration,
    HARD_OA_GENERATORS.hardGraphHitting,
    HARD_OA_GENERATORS.hardResetCollector,
    HARD_OA_GENERATORS.hardCycleMeeting,
    HARD_OA_GENERATORS.hardPatternWait,
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

/**
 * Cache of a generator → its stable `family` signature. A generator's `family`
 * is a per-generator string literal, so probing it once (with a throwaway rng)
 * discovers it without ever perturbing a draw's rng. WeakMap-keyed so shared
 * generator references across pools resolve identically and cost one probe.
 */
const GENERATOR_FAMILY_CACHE = new WeakMap<QuestionGenerator, string>();

/**
 * The rotation SIGNATURE of a generator = the `family` id its items carry
 * (matching the "signature = family" contract). A few legacy generators don't
 * stamp a `family`; those fall back to a stable `concept`/`id` so every
 * generator still has a deterministic, distinct-enough signature to rotate on.
 */
function generatorFamily(gen: QuestionGenerator): string {
  const cached = GENERATOR_FAMILY_CACHE.get(gen);
  if (cached !== undefined) return cached;
  const probe = gen(new Rng(0));
  const sig = probe.family ?? probe.concept ?? probe.id;
  GENERATOR_FAMILY_CACHE.set(gen, sig);
  return sig;
}

/**
 * ROTATION-AWARE draw (ADDITIVE — the pure `drawOaQuestions*` above are
 * UNCHANGED and remain the entry points existing formats + tests rely on).
 *
 * Selects `count` generators from the format's pool BIASED AWAY from the
 * `family` signatures most recently served (the bounded ring persisted in the
 * OA store's `rotation`), materializes one question per chosen generator, and
 * returns the questions ALONGSIDE the advanced store (with the served
 * signatures recorded). Deterministic given `(config, seed, count, store)`: one
 * `Rng(seed)` drives BOTH the rotation-biased selection and the per-question
 * generation, and ids are forced unique (`oa-${seed}-${i}`).
 *
 * The store is threaded ONLY through `selectSequenceServed` from `./store` (the
 * sanctioned rotation API); this module never touches the persisted rotation
 * shape directly and never mutates the input store.
 */
export function drawOaQuestionsForFormatRotated(
  config: OaFormatConfig,
  seed: number,
  count: number,
  store: OaTimedStore | undefined,
): { questions: OaQuestion[]; store: OaTimedStore } {
  const rng = new Rng(seed);
  const pool = poolForFormat(config);
  const { chosen, store: nextStore } = selectSequenceServed(
    store,
    pool,
    rng,
    Math.max(0, count),
    generatorFamily,
  );
  const questions = chosen.map((gen, i) =>
    toOaQuestion(gen(rng), `oa-${seed}-${i}`),
  );
  return { questions, store: nextStore };
}
