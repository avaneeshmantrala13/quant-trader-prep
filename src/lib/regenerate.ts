import { Rng } from "@/lib/rng";
import type { Flashcard, Level, NumericQuestion, Question } from "@/types/content";
import { makeMix, singleFamilyId } from "@/content/mixFamilies";

/**
 * "Generate another like this" — the client-side bonus-practice mechanism.
 *
 * Every parametric level already encodes its reasoning as a `generator` /
 * `numericGenerator` (a seeded RNG → exact-verified instance). These helpers
 * simply re-invoke that generator with a FRESH random seed to produce one brand
 * new question. There is NO LLM / API / backend involved: the generator IS the
 * reasoning, and the exact solver embedded in each item (`correctIndex` /
 * `answer` + `commonErrors`) grades it exactly like a normal question.
 *
 * FAMILY PRESERVATION (the "same question family" fix). A level can bundle
 * several distinct question families behind one `generator` via the `mix*`
 * wrappers (see `@/content/mixFamilies`). Passing the CURRENT on-screen item's
 * `family` re-runs ONLY that family's sub-generator, so "Generate another like
 * this" stays on the same concept (new numbers) instead of jumping to a sibling
 * family. When no `family` is given (or it can't be resolved), the whole-level
 * mix is used — this is exactly what the AI "✨ Fresh variant" button wants
 * (intentional variety within the level) and the correct fallback for
 * single-family / legacy levels.
 *
 * NEVER-REPEAT (the "identical regeneration" fix). Reseeding alone is not
 * enough: a family's parameter space can be small (e.g. "committee of k from n"
 * has only a handful of (n, k) pairs), so a fresh seed can redraw the SAME
 * concrete item the learner is already looking at. Each helper therefore accepts
 * the CURRENT on-screen item (`avoid`) and keeps drawing new (deterministically
 * derived) seeds until the produced item is meaningfully DIFFERENT — compared on
 * concrete CONTENT (prompt + correct answer), NOT the id. It retries up to
 * `MAX_REGEN_ATTEMPTS`; if the family's space is genuinely tiny and can't yield
 * a different item within the cap, it returns the freshest attempt (never loops
 * forever, never throws). It is fully deterministic per starting `seed`, so
 * tests stay reproducible.
 *
 * These items are EXTRA practice only. Callers must NOT feed them into
 * `recordAttempt` / mastery / streak / resume accounting — see `LessonPage`.
 */

/** Max reseed attempts before accepting a repeat (tiny parameter spaces). */
export const MAX_REGEN_ATTEMPTS = 20;

/** A fresh random seed in the same range the level players use for attempts. */
export function freshPracticeSeed(): number {
  return Math.floor(Math.random() * 2_000_000_000);
}

/* -------------------------------------------------------------------------- */
/*  Content signatures + the reseed-until-different driver                     */
/* -------------------------------------------------------------------------- */

/**
 * A content fingerprint used to decide "same item?". Deliberately based on the
 * concrete question CONTENT (prompt + the correct answer value), NOT the id or
 * choice order — two draws are "identical" only when both the prompt AND the
 * answer coincide, which is exactly the case the learner perceives as a repeat.
 */
export function questionSignature(q: Question): string {
  return `${q.prompt}\u0001${q.choices[q.correctIndex]}`;
}
export function numericSignature(q: NumericQuestion): string {
  return `${q.prompt}\u0001${q.answer}`;
}
export function flashcardSignature(c: Flashcard): string {
  return `${c.prompt}\u0001${c.answer}`;
}

/**
 * What a caller may pass as the "don't reproduce this" set. Broadened from a
 * single item to the WHOLE run: a single item, an array of items, or a
 * precomputed set of content signatures (so `LessonPage` can pass every
 * materialized round question PLUS every bonus already generated this run).
 */
export type AvoidArg<Q> =
  | Q
  | readonly Q[]
  | ReadonlySet<string>
  | null
  | undefined;

/** Collapse any `AvoidArg` into a set of content signatures. */
function toAvoidSet<Q>(avoid: AvoidArg<Q>, sig: (q: Q) => string): Set<string> {
  const set = new Set<string>();
  if (!avoid) return set;
  if (avoid instanceof Set) {
    for (const s of avoid) set.add(s);
  } else if (Array.isArray(avoid)) {
    for (const q of avoid as readonly Q[]) set.add(sig(q));
  } else {
    set.add(sig(avoid as Q));
  }
  return set;
}

/**
 * The item to infer a family from when button #1 locks and the `family` string
 * is missing/stale: the explicit `current` on-screen item if provided, else a
 * single-item `avoid` (kept for callers that pass just the current item).
 */
function inferenceSource<Q>(
  avoid: AvoidArg<Q>,
  current: Q | null | undefined,
): Q | undefined {
  if (current) return current;
  if (avoid && !(avoid instanceof Set) && !Array.isArray(avoid)) {
    return avoid as Q;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/*  Family resolution (button #1 lock) — robust against un-stamped items       */
/* -------------------------------------------------------------------------- */

/** An item that can be mapped back to the family that produced it. */
type FamiliedItem = { id: string; concept?: string; family?: string };

/**
 * The family-specific PREFIX of a generator id (the leading alpha/hyphen run
 * before the first numeric parameter). E.g. `pr-comb-6-2` → `pr-comb`,
 * `cp-givensum-6-7-3` → `cp-givensum`. Used to recover an item's family when its
 * stamped `family` tag is missing (e.g. a legacy/resumed item saved before the
 * family mechanism existed).
 */
function idPrefix(id: string): string {
  const m = /^([a-zA-Z]+(?:-[a-zA-Z]+)*)/.exec(id);
  return m ? m[1] : id;
}

/**
 * Resolve WHICH family in `families` an item belongs to. Order of trust:
 *   1. the item's own stamped `family` (the fast, exact path for fresh items);
 *   2. the family whose sample shares the item's id prefix (id templates are
 *      family-specific by construction);
 *   3. the family whose sample shares the item's `concept`.
 * Returns `undefined` only when the item genuinely doesn't come from any family
 * (e.g. a static flashcard-pool card) — callers decide what to do then.
 */
function inferFamilyKey<T extends FamiliedItem>(
  families: Record<string, (rng: Rng) => T>,
  item: T,
): string | undefined {
  if (item.family && families[item.family]) return item.family;
  const keys = Object.keys(families);
  const wantPrefix = idPrefix(item.id);
  for (const k of keys) {
    if (idPrefix(families[k](new Rng(1)).id) === wantPrefix) return k;
  }
  if (item.concept) {
    for (const k of keys) {
      if (families[k](new Rng(1)).concept === item.concept) return k;
    }
  }
  return undefined;
}

/**
 * Resolve the family key to LOCK onto for a regeneration.
 *  - An explicit, valid `family` always wins.
 *  - When `lockFamily` (button #1) is set, we MUST stay in the current item's
 *    family: infer it from `inferItem` (stamped tag → id prefix → concept). We
 *    never silently fall back to the whole-level mix here — that was the leak bug.
 *  - Otherwise (button #2 / no families / legacy) return `undefined` → the
 *    caller uses the whole-level mix.
 */
function resolveFamilyKey<T extends FamiliedItem>(
  families: Record<string, (rng: Rng) => T> | undefined,
  family: string | undefined,
  inferItem: T | undefined,
  lockFamily: boolean,
): string | undefined {
  if (!families) return undefined;
  if (family && families[family]) return family;
  if (lockFamily && inferItem) return inferFamilyKey(families, inferItem);
  return undefined;
}

/**
 * Draw an item whose signature is NOT in `avoidSet`, deriving each attempt's
 * seed deterministically from the starting `seed` so the result is reproducible
 * in tests. Falls back to the freshest attempt if the family's parameter space
 * is too small to avoid everything within `cap` — never infinite-loops or throws.
 */
function drawDistinct<T>(
  seed: number,
  produce: (attemptSeed: number) => T,
  signature: (item: T) => string,
  avoidSet: ReadonlySet<string>,
  cap: number = MAX_REGEN_ATTEMPTS,
): T {
  const driver = new Rng(seed);
  let last: T | null = null;
  for (let i = 0; i < cap; i++) {
    const attemptSeed = driver.int(1, 2_000_000_000);
    const item = produce(attemptSeed);
    last = item;
    if (!avoidSet.has(signature(item))) return item;
  }
  // Cap hit (tiny parameter space): accept the freshest attempt.
  return last as T;
}

/** True iff this level can produce a fresh parametric multiple-choice item. */
export function canRegenerateQuiz(level: Level): boolean {
  return typeof level.generator === "function";
}

/** True iff this level can produce a fresh parametric numeric item. */
export function canRegenerateNumeric(level: Level): boolean {
  return typeof level.numericGenerator === "function";
}

/** True iff this level can produce a fresh parametric flashcard (brainteasers). */
export function canRegenerateFlashcard(level: Level): boolean {
  return (level.flashcardGenerators?.length ?? 0) > 0;
}

/** True iff "Generate another like this" is applicable to this level at all. */
export function canRegenerate(level: Level): boolean {
  return (
    canRegenerateQuiz(level) ||
    canRegenerateNumeric(level) ||
    canRegenerateFlashcard(level)
  );
}

/**
 * Produce ONE fresh multiple-choice question from the level's parametric
 * generator using `seed`. Returns `null` when the level has no `generator`
 * (fixed pool / flashcard levels), so callers can hide the control.
 *
 * The `id` is suffixed with the seed to guarantee a stable, unique React key
 * across successive regenerations (two seeds can otherwise map to the same
 * parameters and thus the same base id).
 *
 * `avoid` is the run-wide "don't reproduce" set: a single item, an array of
 * items, or a set of precomputed signatures (see `AvoidArg`). The result is
 * guaranteed meaningfully different from EVERY item in it whenever the family
 * can produce a different item within the reseed cap. `current` is the on-screen
 * item, used only to infer the family for the lock path when `family` is stale.
 *
 * `lockFamily` is the button #1 ("Generate another like this") switch: when set,
 * the result STRICTLY stays in the current item's family — resolved from
 * `family`, else inferred from `current`/`avoid` — and NEVER leaks to a sibling
 * family via the whole-level mix. Button #2 ("✨ Fresh variant") leaves it off
 * to get whole-level variety.
 */
export function generateFreshQuestion(
  level: Level,
  seed: number,
  family?: string,
  avoid?: AvoidArg<Question>,
  lockFamily = false,
  current?: Question | null,
): Question | null {
  const base = level.generator;
  if (!base) return null;
  // Family-preserving path (button #1): re-run ONLY the current item's family.
  // Whole-level path (button #2 / no families): random-pick across the mix.
  const inferItem = inferenceSource(avoid, current);
  const key = resolveFamilyKey(base.families, family, inferItem, lockFamily);
  const gen = key ? base.families![key] : base;
  const q = drawDistinct(
    seed,
    (s) => gen(new Rng(s)),
    questionSignature,
    toAvoidSet(avoid, questionSignature),
  );
  const stamped = q.family ?? singleFamilyId(base);
  return {
    ...q,
    ...(stamped ? { family: stamped } : {}),
    id: `${q.id}-practice-${seed}`,
  };
}

/**
 * Produce ONE fresh numeric (free-entry) question from the level's parametric
 * `numericGenerator` using `seed`. Returns `null` when the level has no
 * numeric generator.
 */
export function generateFreshNumericQuestion(
  level: Level,
  seed: number,
  family?: string,
  avoid?: AvoidArg<NumericQuestion>,
  lockFamily = false,
  current?: NumericQuestion | null,
): NumericQuestion | null {
  const base = level.numericGenerator;
  if (!base) return null;
  const inferItem = inferenceSource(avoid, current);
  const key = resolveFamilyKey(base.families, family, inferItem, lockFamily);
  const gen = key ? base.families![key] : base;
  const q = drawDistinct(
    seed,
    (s) => gen(new Rng(s)),
    numericSignature,
    toAvoidSet(avoid, numericSignature),
  );
  const stamped = q.family ?? singleFamilyId(base);
  return {
    ...q,
    ...(stamped ? { family: stamped } : {}),
    id: `${q.id}-practice-${seed}`,
  };
}

/**
 * Produce ONE fresh flashcard from the level's parametric flashcard families
 * using `seed`. A single seeded `Rng` both PICKS a family (when the level bundles
 * several — e.g. Classics has Adjacent Cross + Walking the Offer Down) and draws
 * that family's parameters, so every seed yields a genuinely fresh, exact-solved
 * card. Returns `null` for levels with no `flashcardGenerators` (the static
 * "famous classic" levels), so callers fall back to reshuffling the fixed pool.
 *
 * These are BONUS practice only — the flashcard player NEVER feeds them into the
 * `understood` set / mastery / streak, exactly like the quiz/numeric regenerate
 * path. The `id` is seed-suffixed for a stable, unique React key.
 */
export function generateFreshFlashcard(
  level: Level,
  seed: number,
  family?: string,
  avoid?: AvoidArg<Flashcard>,
  lockFamily = false,
  current?: Flashcard | null,
): Flashcard | null {
  const pool = level.flashcardGenerators;
  if (!pool || pool.length === 0) return null;
  // Flashcard families are stored directly on the level (no wrapper), so build
  // the same family-tagging mixer here. Button #1 (`lockFamily`) stays in the
  // current card's family (resolved/inferred from `current`/`avoid`); a static
  // pool card has no generator family, so inference returns undefined and we
  // fall back to the original random-family pick. Either branch stamps the card.
  const mix = makeMix(pool);
  const inferItem = inferenceSource(avoid, current);
  const key = resolveFamilyKey(mix.families, family, inferItem, lockFamily);
  const draw = (s: number): Flashcard => {
    const rng = new Rng(s);
    return key ? mix.families[key](rng) : mix(rng);
  };
  const card = drawDistinct(
    seed,
    draw,
    flashcardSignature,
    toAvoidSet(avoid, flashcardSignature),
  );
  return { ...card, id: `${card.id}-practice-${seed}` };
}
