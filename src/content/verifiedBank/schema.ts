import type { Difficulty } from "@/types/content";

/**
 * VERIFIED BANK (T9) — schema for a curated, human/expert-authored problem bank.
 *
 * Unlike the parametric generators (which draw infinitely many fresh, solver-
 * verified items), the Verified Bank is a FINITE, hand-authored pool of
 * interview-style quant-TRADER problems. Every item is ORIGINAL prose (freshly
 * phrased for legal distinctness — NO verbatim copies from any book, blog, or
 * question dump) and carries two things the generators cannot: explicit
 * PROVENANCE (the genre/firm/round the phrasing is modeled on) and a full,
 * hand-written WORKED SOLUTION (the complete derivation, not just an answer).
 *
 * The bank is loaded as data alongside the generators; `loader.ts` exposes a
 * pure query API and validates every item at module init via
 * {@link validateVerifiedItem}.
 */

/** Broad trader-interview genre a verified item belongs to. */
export type VerifiedCategory =
  | "mental-math"
  | "probability-ev"
  | "market-making"
  | "sequences"
  | "estimation"
  | "brainteasers"
  | "arbitrage";

/** Every category, in a stable curated display order. */
export const VERIFIED_CATEGORY_ORDER: VerifiedCategory[] = [
  "mental-math",
  "probability-ev",
  "market-making",
  "sequences",
  "estimation",
  "brainteasers",
  "arbitrage",
];

/** Human-friendly labels for each category (for later surfacing in UI). */
export const VERIFIED_CATEGORY_LABEL: Record<VerifiedCategory, string> = {
  "mental-math": "Mental Math",
  "probability-ev": "Probability & EV",
  "market-making": "Market Making",
  sequences: "Sequences & Patterns",
  estimation: "Estimation",
  brainteasers: "Brainteasers",
  arbitrage: "Arbitrage & No-Arbitrage",
};

/**
 * Provenance for a verified item. This records the GENRE (and, where relevant,
 * the firm / interview round / year the phrasing is modeled on) so the bank can
 * be filtered and audited. It is a MODELING reference, not an attribution of a
 * copied question — all prose is original (see `distinctnessReviewed`).
 */
export interface VerifiedProvenance {
  /** Firm whose interview STYLE the item is modeled on (optional). */
  firm?: string;
  /** Interview round the genre is typical of, e.g. "phone-screen", "onsite". */
  round?: string;
  /** Year the genre/format is associated with (optional). */
  year?: number;
  /** REQUIRED free-text genre, e.g. "Optiver-style mental-math sprint". */
  genre: string;
}

/**
 * A single curated, verified problem. REQUIRED provenance + solution fields
 * distinguish it from a generator-drawn item.
 */
export interface VerifiedItem {
  /** Stable unique id, e.g. "vb-mm-001". */
  id: string;
  /** The problem statement, in fully original wording. */
  prompt: string;
  category: VerifiedCategory;
  difficulty: Difficulty;
  /** The correct answer. String OR number (many trader answers are prose). */
  answer: string | number;
  /** REQUIRED full worked derivation — the complete "why", start to finish. */
  workedSolution: string;
  /** REQUIRED provenance (genre mandatory; firm/round/year optional). */
  provenance: VerifiedProvenance;
  /** Free-form tags for querying (concepts, techniques). */
  tags: string[];
  /** Who verified the item (author/reviewer handle or role). */
  verifiedBy: string;
  /**
   * Literal `true`: asserts a human reviewed this item for distinctness from
   * any source material (original phrasing). The type forbids `false`, so an
   * un-reviewed item cannot satisfy the schema.
   */
  distinctnessReviewed: true;
}

/** Result of a per-field emptiness/shape check. */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

const VALID_DIFFICULTIES: ReadonlySet<Difficulty> = new Set<Difficulty>([
  "intro",
  "easy",
  "medium",
  "hard",
  "expert",
]);

const VALID_CATEGORIES: ReadonlySet<string> = new Set<string>(
  VERIFIED_CATEGORY_ORDER,
);

/**
 * Pure validator: returns a list of human-readable errors for a candidate
 * item. An empty array means the item is well-formed. Never throws — callers
 * (e.g. the loader) decide whether to throw or log.
 */
export function validateVerifiedItem(item: VerifiedItem): string[] {
  const errors: string[] = [];
  const where = isNonEmptyString(item?.id) ? item.id : "<missing id>";

  if (!isNonEmptyString(item?.id)) {
    errors.push(`${where}: id must be a non-empty string`);
  }
  if (!isNonEmptyString(item?.prompt)) {
    errors.push(`${where}: prompt must be a non-empty string`);
  } else if (item.prompt.trim().length < 20) {
    errors.push(`${where}: prompt looks too short to be a real problem`);
  }

  if (!VALID_CATEGORIES.has(item?.category as string)) {
    errors.push(`${where}: category "${item?.category}" is not a valid VerifiedCategory`);
  }
  if (!VALID_DIFFICULTIES.has(item?.difficulty as Difficulty)) {
    errors.push(`${where}: difficulty "${item?.difficulty}" is not a valid Difficulty`);
  }

  // answer: string OR number, but must be a real value.
  if (typeof item?.answer === "number") {
    if (!Number.isFinite(item.answer)) {
      errors.push(`${where}: numeric answer must be finite`);
    }
  } else if (typeof item?.answer === "string") {
    if (!isNonEmptyString(item.answer)) {
      errors.push(`${where}: string answer must be non-empty`);
    }
  } else {
    errors.push(`${where}: answer must be a string or a number`);
  }

  // REQUIRED worked solution — a full derivation, not a one-word answer.
  if (!isNonEmptyString(item?.workedSolution)) {
    errors.push(`${where}: workedSolution is required (full derivation)`);
  } else if (item.workedSolution.trim().length < 40) {
    errors.push(`${where}: workedSolution too short to be a full derivation`);
  }

  // REQUIRED provenance with a mandatory genre.
  if (!item?.provenance || typeof item.provenance !== "object") {
    errors.push(`${where}: provenance object is required`);
  } else {
    if (!isNonEmptyString(item.provenance.genre)) {
      errors.push(`${where}: provenance.genre is required`);
    }
    if (
      item.provenance.year !== undefined &&
      (!Number.isInteger(item.provenance.year) ||
        item.provenance.year < 1900 ||
        item.provenance.year > 2100)
    ) {
      errors.push(`${where}: provenance.year, if present, must be a plausible year`);
    }
    if (
      item.provenance.firm !== undefined &&
      !isNonEmptyString(item.provenance.firm)
    ) {
      errors.push(`${where}: provenance.firm, if present, must be non-empty`);
    }
    if (
      item.provenance.round !== undefined &&
      !isNonEmptyString(item.provenance.round)
    ) {
      errors.push(`${where}: provenance.round, if present, must be non-empty`);
    }
  }

  if (!Array.isArray(item?.tags) || item.tags.length === 0) {
    errors.push(`${where}: tags must be a non-empty string array`);
  } else if (!item.tags.every(isNonEmptyString)) {
    errors.push(`${where}: every tag must be a non-empty string`);
  }

  if (!isNonEmptyString(item?.verifiedBy)) {
    errors.push(`${where}: verifiedBy must be a non-empty string`);
  }

  if (item?.distinctnessReviewed !== true) {
    errors.push(`${where}: distinctnessReviewed must be literal true`);
  }

  return errors;
}
