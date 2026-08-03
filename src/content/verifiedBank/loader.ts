import type { Difficulty } from "@/types/content";
import {
  validateVerifiedItem,
  type VerifiedCategory,
  type VerifiedItem,
} from "./schema";
import { VERIFIED_ITEMS } from "./items";

/**
 * Pure loader / query API for the Verified Bank (T9).
 *
 * The item pool is validated ONCE at module initialization: every item is run
 * through `validateVerifiedItem`, and ids are checked for uniqueness. Any
 * problem is thrown (fail-fast) so a malformed bank can never ship silently.
 * The query functions below are pure and return fresh arrays.
 */

function assertBankIntegrity(items: VerifiedItem[]): void {
  const problems: string[] = [];

  const seen = new Set<string>();
  for (const item of items) {
    problems.push(...validateVerifiedItem(item));
    if (seen.has(item.id)) {
      problems.push(`duplicate id: ${item.id}`);
    }
    seen.add(item.id);
  }

  if (problems.length > 0) {
    const msg = `Verified Bank failed validation:\n- ${problems.join("\n- ")}`;
    // Log for visibility, then fail fast so CI/dev catch it immediately.
    console.error(msg);
    throw new Error(msg);
  }
}

assertBankIntegrity(VERIFIED_ITEMS);

/** All verified items (a defensive copy in curated order). */
export function getVerifiedItems(): VerifiedItem[] {
  return [...VERIFIED_ITEMS];
}

/** Items in a given category. */
export function getByCategory(category: VerifiedCategory): VerifiedItem[] {
  return VERIFIED_ITEMS.filter((i) => i.category === category);
}

/**
 * Items whose provenance firm matches (case-insensitive, exact match on the
 * `provenance.firm` field). Items without a firm are never returned.
 */
export function getByFirm(firm: string): VerifiedItem[] {
  const needle = firm.trim().toLowerCase();
  return VERIFIED_ITEMS.filter(
    (i) => i.provenance.firm?.trim().toLowerCase() === needle,
  );
}

/** Items at a given difficulty. */
export function getByDifficulty(difficulty: Difficulty): VerifiedItem[] {
  return VERIFIED_ITEMS.filter((i) => i.difficulty === difficulty);
}

/** Look up a single item by id (undefined if absent). */
export function getById(id: string): VerifiedItem | undefined {
  return VERIFIED_ITEMS.find((i) => i.id === id);
}

/** Total number of verified items currently in the bank. */
export function getVerifiedItemCount(): number {
  return VERIFIED_ITEMS.length;
}

/** Distinct firms present in the bank's provenance (sorted, de-duplicated). */
export function getFirms(): string[] {
  const firms = new Set<string>();
  for (const i of VERIFIED_ITEMS) {
    if (i.provenance.firm) firms.add(i.provenance.firm);
  }
  return [...firms].sort();
}
