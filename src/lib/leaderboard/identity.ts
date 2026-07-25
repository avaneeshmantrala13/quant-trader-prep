/**
 * leaderboard/identity.ts — PURE display-name validation + weekly bucket key
 * for the Speed Arena leaderboard (Phase 6).
 *
 * Privacy: the leaderboard ranks by an OPT-IN display name (never email). A
 * name must be 3–20 chars, letters/digits/spaces/`_`/`-` only, and pass a small
 * profanity screen. The weekly league key is a UTC ISO-week string so leagues
 * reset every week. Both are pure so the Lambda can share the exact same rules.
 */

/** Result of validating a proposed display name. */
export interface NameCheck {
  ok: boolean;
  /** Normalized (trimmed, collapsed whitespace) name when `ok`. */
  value?: string;
  reason?: string;
}

export const NAME_MIN = 3;
export const NAME_MAX = 20;

/** Minimal substring profanity screen (case-insensitive). Tunable. */
const BANNED = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot", "asshole"];

/**
 * Validate + normalize a proposed display name. Rejects empties, out-of-range
 * lengths, disallowed characters, and names containing a banned substring.
 */
export function validateDisplayName(raw: string): NameCheck {
  const value = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (value.length < NAME_MIN) return { ok: false, reason: "too-short" };
  if (value.length > NAME_MAX) return { ok: false, reason: "too-long" };
  if (!/^[A-Za-z0-9 _-]+$/.test(value)) {
    return { ok: false, reason: "bad-chars" };
  }
  const lower = value.toLowerCase();
  if (BANNED.some((w) => lower.includes(w))) {
    return { ok: false, reason: "profanity" };
  }
  return { ok: true, value };
}

/**
 * UTC ISO-week key (`YYYY-Www`) for a timestamp — the weekly league bucket.
 * Uses the ISO-8601 rule (weeks start Monday; week 1 contains the first
 * Thursday), so it matches the Lambda's key and rolls over predictably.
 */
export function isoWeekKey(atMs: number): string {
  const d = new Date(atMs);
  // Shift to the Thursday of the current ISO week (UTC).
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = date.getUTCDay() || 7; // Sun=0 → 7
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
