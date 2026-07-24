import type { Rng } from "@/lib/rng";
import type {
  Flashcard,
  FlashcardGenerator,
  NumericQuestion,
  NumericQuestionGenerator,
  Question,
  QuestionGenerator,
} from "@/types/content";

/**
 * mixFamilies.ts — the ONE shared mechanism that makes "Generate another like
 * this" a TRUE variant of the SAME question family.
 *
 * THE BUG IT FIXES. A level can bundle several distinct question families behind
 * a single `generator` via the `mix*` wrappers (`mix`, `mixQuiz`, `mixNumeric`,
 * `mixEV`, `mixed`, …). The original wrappers were just
 * `(rng) => rng.pick(pool)(rng)` — they RANDOM-PICK a family on EVERY call, so
 * regenerating a "committee of k from n" item would often jump to a "P(A and B)"
 * item (a sibling family). That is the family-jump bug.
 *
 * THE FIX. Every mix wrapper now:
 *   1. Derives a STABLE `family` id for each sub-generator (its `familyId`
 *      override if present, else the function `name`, disambiguated by index).
 *   2. STAMPS each produced item with the id of the family that drew it.
 *   3. Exposes a `.families` map (family id → that family's stamping generator)
 *      on the returned callable, so a specific family can be re-run on demand.
 *
 * Normal play is UNCHANGED: `level.generator(rng)` still random-picks a family
 * per call and consumes the RNG in exactly the same order as before (one
 * `rng.int` to choose the index, then the sub-generator) — the only difference
 * is the extra `family` string stamped on the result. Family-PRESERVING
 * regeneration (`@/lib/regenerate`) reads the current item's `family` and calls
 * `generator.families[family]` with a fresh seed.
 */

/** An item that can be tagged with the family that produced it. */
type Taggable = { family?: string };
/** A seeded generator for one taggable item type. */
type Gen<T extends Taggable> = (rng: Rng) => T;
/** A mix generator: a callable that also exposes its keyed family map. */
export type FamiliedGenerator<T extends Taggable> = Gen<T> & {
  families: Record<string, Gen<T>>;
};

/**
 * Derive STABLE, unique family ids for a pool, parallel to `pool`.
 *
 * Priority: an explicit `familyId` property on the generator, else its function
 * `name`, else a positional `family{i}` fallback (anonymous fns). Collisions
 * (two sub-generators sharing a name — e.g. `[genHotelling, genHotelling]`) are
 * disambiguated deterministically by appending `#2`, `#3`, … in pool order, so
 * every family in a level is addressable by a unique key.
 */
export function deriveFamilyIds<T extends Taggable>(pool: Gen<T>[]): string[] {
  const used = new Set<string>();
  return pool.map((gen, i) => {
    const explicit = (gen as { familyId?: string }).familyId;
    const base =
      explicit && explicit.length > 0
        ? explicit
        : gen.name && gen.name.length > 0
          ? gen.name
          : `family${i}`;
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}#${n++}`;
    used.add(id);
    return id;
  });
}

/** The stable family id of a SINGLE (non-mixed) generator, or `undefined`. */
export function singleFamilyId<T extends Taggable>(
  gen: Gen<T>,
): string | undefined {
  const explicit = (gen as { familyId?: string }).familyId;
  if (explicit && explicit.length > 0) return explicit;
  return gen.name && gen.name.length > 0 ? gen.name : undefined;
}

/**
 * Build the ordered, family-STAMPING generators for a pool: entry `i` runs
 * `pool[i]` and stamps the result with `ids[i]`. Shared by the mix callable and
 * the flashcard family lookup so both stamp identically.
 */
function stampingGens<T extends Taggable>(
  pool: Gen<T>[],
  ids: string[],
): Gen<T>[] {
  return pool.map((gen, i) => (rng: Rng): T => ({ ...gen(rng), family: ids[i] }));
}

/**
 * The generic mix factory. Returns a callable that random-picks a family per
 * call (drawing the RNG identically to the old `rng.pick(pool)(rng)`), stamps
 * the produced item with its family id, and carries a `.families` lookup so any
 * one family can be re-run for family-preserving regeneration.
 */
export function makeMix<T extends Taggable>(
  pool: Gen<T>[],
): FamiliedGenerator<T> {
  const ids = deriveFamilyIds(pool);
  const stamped = stampingGens(pool, ids);
  const families: Record<string, Gen<T>> = {};
  ids.forEach((id, i) => {
    families[id] = stamped[i];
  });
  const mixed = ((rng: Rng): T =>
    stamped[rng.int(0, stamped.length - 1)](rng)) as FamiliedGenerator<T>;
  mixed.families = families;
  return mixed;
}

/** Build ONLY the family lookup for a pool (used by flashcards, which store the
 * pool directly on the level rather than behind a wrapper). */
export function familyMap<T extends Taggable>(
  pool: Gen<T>[],
): Record<string, Gen<T>> {
  return makeMix(pool).families;
}

/* -------------------------------------------------------------------------- */
/*  Typed public wrappers — one per item kind. Each per-topic `mix*` wrapper   */
/*  (`mix`, `mixQuiz`, `mixNumeric`, `mixEV`, `mixed`) delegates to these so    */
/*  the family mechanism is defined in exactly ONE place.                      */
/* -------------------------------------------------------------------------- */

/** Combine several multiple-choice generators into one family-tagged mixer. */
export const mixQuestionGenerators = (
  pool: QuestionGenerator[],
): QuestionGenerator => makeMix<Question>(pool);

/** Combine several numeric generators into one family-tagged mixer. */
export const mixNumericGenerators = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => makeMix<NumericQuestion>(pool);

/** Combine several flashcard generators into one family-tagged mixer. */
export const mixFlashcardGenerators = (
  pool: FlashcardGenerator[],
): FlashcardGenerator => makeMix<Flashcard>(pool);
