/**
 * srs/store.ts — the PERSISTED spaced-repetition card store + its pure operations
 * (the retention layer, T14). The store is a flat map of `cardId → SrsCard`
 * scheduling state (SM-2 ease / interval / reps / lapses + an ABSOLUTE
 * wall-clock `dueAtMs`). Card CONTENT is never stored here — it is regenerated
 * deterministically from the mode-scoped catalog in `srs/deck.ts` and joined by
 * id — so the persisted footprint stays tiny and reload-proof (absolute due
 * timestamps survive leave/resume/re-login across sessions).
 *
 * Everything here is PURE + framework-free (mirrors `srs/schedule.ts`): given a
 * store and a `nowMs`, each helper returns a NEW store/array so React state and
 * the debounced persistence in `ProgressContext` keep their immutable-snapshot
 * semantics. Nothing here touches mastery, level unlock, or the adaptive engine.
 */

import {
  dueQueue,
  isDue,
  newCard,
  reviewCard,
  type SrsCard,
  type SrsGrade,
} from "./schedule";

export type { SrsCard, SrsGrade } from "./schedule";

/**
 * The persisted SRS store. Additive, optional field on `UserProgress` (see
 * `src/types/progress.ts`): older saves without it load unchanged, and it NEVER
 * gates content or affects scoring / mastery / the level-unlock migration.
 */
export interface SrsStore {
  /**
   * `cardId → SM-2 scheduling state`. The id is a STABLE catalog id (e.g.
   * `concept:probability:pr-1:idea` or `fact:squares:13`) so the same card
   * always resolves to the same scheduling row across sessions and deck
   * regenerations.
   */
  cards: Record<string, SrsCard>;
  /** Monotonic count of graded reviews ever completed (surfaced as progress). */
  reviews: number;
}

/** A fresh, empty store. */
export function emptySrsStore(): SrsStore {
  return { cards: {}, reviews: 0 };
}

/** Normalize a possibly-absent/partial store into a valid `SrsStore`. */
export function coerceSrsStore(store: SrsStore | undefined | null): SrsStore {
  if (!store || typeof store !== "object") return emptySrsStore();
  return {
    cards: store.cards ?? {},
    reviews: typeof store.reviews === "number" ? store.reviews : 0,
  };
}

/** The stored scheduling state for one card, or `undefined` if never seeded. */
export function getSrsCard(
  store: SrsStore | undefined,
  id: string,
): SrsCard | undefined {
  return store?.cards[id];
}

/**
 * Ensure every id in `ids` has a scheduling row: any MISSING id gets a fresh
 * `newCard(nowMs)` (due immediately). Existing rows are left EXACTLY as-is.
 * Returns the same store instance when nothing was added (cheap no-op).
 */
export function ensureCardsSeeded(
  store: SrsStore,
  ids: readonly string[],
  nowMs: number,
): SrsStore {
  let changed = false;
  const cards = { ...store.cards };
  for (const id of ids) {
    if (!cards[id]) {
      cards[id] = newCard(nowMs);
      changed = true;
    }
  }
  return changed ? { ...store, cards } : store;
}

/**
 * Apply a recall `grade` to one card at `nowMs`, returning the NEXT store. An
 * unseeded card is treated as brand-new (seeded, then graded) so a first-ever
 * review schedules correctly. Increments the monotonic `reviews` counter.
 */
export function applyReview(
  store: SrsStore,
  id: string,
  grade: SrsGrade,
  nowMs: number,
): SrsStore {
  const current = store.cards[id] ?? newCard(nowMs);
  return {
    cards: { ...store.cards, [id]: reviewCard(current, grade, nowMs) },
    reviews: store.reviews + 1,
  };
}

/**
 * Merge the catalog with the store into an ordering-ready view: every catalog
 * id maps to its stored `SrsCard`, or to an ephemeral `newCard(nowMs)` when it
 * has never been seeded (a NEW card is due immediately). Used to build the
 * review queue + due count without mutating the store.
 */
function mergedView(
  store: SrsStore,
  catalogIds: readonly string[],
  nowMs: number,
): Record<string, SrsCard> {
  const view: Record<string, SrsCard> = {};
  for (const id of catalogIds) view[id] = store.cards[id] ?? newCard(nowMs);
  return view;
}

/**
 * The ordered review queue for a catalog: every catalog card that is NEW
 * (never seeded) or currently DUE, most-overdue first (stable by id on ties, so
 * a fresh deck reviews in catalog order). Cards absent from the catalog (e.g. a
 * retired id lingering in the store) are ignored.
 */
export function buildReviewQueue(
  store: SrsStore,
  catalogIds: readonly string[],
  nowMs: number,
): string[] {
  return dueQueue(mergedView(store, catalogIds, nowMs), nowMs);
}

/** How many catalog cards are currently due (new or overdue) — the nav badge. */
export function dueCount(
  store: SrsStore,
  catalogIds: readonly string[],
  nowMs: number,
): number {
  const view = mergedView(store, catalogIds, nowMs);
  let n = 0;
  for (const id of catalogIds) if (isDue(view[id], nowMs)) n++;
  return n;
}

/**
 * How many catalog cards a learner has "learned to keep" — cards whose current
 * inter-review interval has reached `graduatedDays` (default 21d, the classic
 * SRS graduation bar). These are the fact cards ready to graduate to timed
 * Speed-Arena practice (Case B linkage). Only seeded rows count.
 */
export function graduatedCount(
  store: SrsStore,
  catalogIds: readonly string[],
  graduatedDays = 21,
): number {
  let n = 0;
  for (const id of catalogIds) {
    const c = store.cards[id];
    if (c && c.intervalDays >= graduatedDays) n++;
  }
  return n;
}

/** True when a specific card has graduated (interval ≥ `graduatedDays`). */
export function isGraduated(
  store: SrsStore | undefined,
  id: string,
  graduatedDays = 21,
): boolean {
  const c = store?.cards[id];
  return !!c && c.intervalDays >= graduatedDays;
}
