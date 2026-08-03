/**
 * community/moderation.ts — DETERMINISTIC, self-contained content moderation for
 * user-submitted community text (experience reports, comments, solutions). NO
 * network, NO external API, NO randomness, NO clock: every function is a total
 * function of its input, so the same text always yields the same verdict (client
 * and any future Lambda can share it verbatim, exactly like `aggregate.ts`).
 *
 * What it does:
 *  - `containsProfanity(text)` — cheap boolean screen.
 *  - `maskProfanity(text)`     — replace disallowed words with `*` (length-kept).
 *  - `moderateContent(text)`   — full verdict: `allow` | `mask` | `block`, with
 *                                machine-readable `reasons` + matched terms.
 *
 * Obfuscation handling (deterministic, best-effort — NOT a guarantee):
 *  - case-insensitive.
 *  - leetspeak / character substitution: `@→a $→s 0→o 1→i 3→e 4→a 5→s 7→t 8→b !→i`.
 *  - extra spacing / separators between letters ("f u c k", "s-h-i-t", "b.i.t.c.h")
 *    via a cross-token condensed scan.
 *  - elongation ("shiiit", "fuuuck") via a collapsed-run scan.
 *
 * Word lists are bundled and intentionally small/curated. Distinctive terms are
 * matched as substrings (after normalization); short/ambiguous terms (e.g. "ass")
 * are matched only as whole tokens to avoid the classic Scunthorpe false
 * positives ("class", "grass", "pass"). This is a first-line automated filter,
 * NOT a substitute for human moderation — see the report's legal to-dos.
 */

// --- normalization ----------------------------------------------------------

/** Character-level leetspeak / substitution map applied before matching. */
const LEET: Record<string, string> = {
  "@": "a",
  "4": "a",
  "8": "b",
  "3": "e",
  "1": "i",
  "!": "i",
  "0": "o",
  "5": "s",
  $: "s",
  "7": "t",
};

/** A "word-ish" token: letters/digits plus the leet symbols we understand. */
const TOKEN_RE = /[A-Za-z0-9@$!]+/g;

function applyLeet(s: string): string {
  let out = "";
  for (const ch of s) out += LEET[ch] ?? ch;
  return out;
}

/** Lowercase, de-leet, and strip everything that isn't `a-z`. */
function lettersOnly(s: string): string {
  return applyLeet(s.toLowerCase()).replace(/[^a-z]/g, "");
}

/** Collapse any run of a repeated character to a single one ("shiiit" → "shit"). */
function collapse(s: string): string {
  return s.replace(/(.)\1+/g, "$1");
}

// --- bundled word lists -----------------------------------------------------

/**
 * Distinctive profanity — matched as a normalized SUBSTRING (and via the
 * collapsed-run form for elongation). These have no common innocent
 * superstrings, so substring matching is safe.
 */
export const PROFANITY_SUBSTRING: readonly string[] = [
  "fuck",
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "dumbass",
  "jackass",
  "bullshit",
  "motherfucker",
  "pussy",
  "slut",
  "whore",
  "wanker",
  "bollocks",
  "dickhead",
  "cocksucker",
  "douchebag",
];

/**
 * Short / ambiguous profanity — matched only as a WHOLE token (with elongation
 * + leet), so "class"/"pass"/"cockpit"/"dickens" are never flagged.
 */
export const PROFANITY_WHOLE: readonly string[] = [
  "ass",
  "damn",
  "dick",
  "piss",
  "cock",
  "crap",
  "arse",
  "twat",
  "prick",
  "cunt",
  "tit",
  "tits",
];

/**
 * Slurs / hate terms that have no common innocent superstrings — matched as a
 * normalized substring. A hit always BLOCKS.
 */
export const SLURS_SUBSTRING: readonly string[] = [
  "nigger",
  "faggot",
  "kike",
  "wetback",
];

/**
 * Slurs that DO have innocent superstrings ("spice", "raccoon", "retardant") —
 * matched only as a whole token so we don't over-block. A hit always BLOCKS.
 */
export const SLURS_WHOLE: readonly string[] = [
  "nigga",
  "spic",
  "chink",
  "gook",
  "coon",
  "tranny",
  "retard",
  "fag",
  "kkk",
];

/**
 * Content-safety phrases (self-harm / direct threats). Checked on a spaced,
 * normalized rendering so word order matters. A hit always BLOCKS.
 */
export const UNSAFE_PHRASES: readonly string[] = [
  "kill yourself",
  "kill your self",
  "hang yourself",
  "kill you",
  "end your life",
  "go die",
];

/** No-space content-safety tokens (checked against the fully-condensed text). */
export const UNSAFE_TOKENS: readonly string[] = [
  "kys",
  "killyourself",
  "killurself",
];

// --- matchers ---------------------------------------------------------------

/** True iff any `list` word appears in the condensed/collapsed haystack. */
function anySubstring(
  list: readonly string[],
  condensed: string,
  collapsed: string,
  out?: Set<string>,
): boolean {
  let hit = false;
  for (const w of list) {
    if (condensed.includes(w)) {
      out?.add(w);
      hit = true;
      continue;
    }
    const dd = collapse(w);
    if (dd.length >= 4 && collapsed.includes(dd)) {
      out?.add(w);
      hit = true;
    }
  }
  return hit;
}

/**
 * True iff the token (already reduced to `collapsedLetters`, with original
 * letter-length `len`) IS one of the whole-word entries — allowing elongation
 * ("assss") but not truncation ("as").
 */
function anyWholeToken(
  list: readonly string[],
  collapsedLetters: string,
  len: number,
  out?: Set<string>,
): boolean {
  let hit = false;
  for (const w of list) {
    if (collapsedLetters === collapse(w) && len >= w.length) {
      out?.add(w);
      hit = true;
    }
  }
  return hit;
}

/** Is a single original token disallowed (profanity or slur)? */
function tokenDisallowed(tok: string): boolean {
  const L = lettersOnly(tok);
  if (!L) return false;
  const C = collapse(L);
  return (
    anySubstring(PROFANITY_SUBSTRING, L, C) ||
    anyWholeToken(PROFANITY_WHOLE, C, L.length) ||
    anySubstring(SLURS_SUBSTRING, L, C) ||
    anyWholeToken(SLURS_WHOLE, C, L.length)
  );
}

// --- public API -------------------------------------------------------------

export type ModerationVerdict = "allow" | "mask" | "block";

export interface ModerationResult {
  /** `allow` = store as-is, `mask` = store `text`, `block` = reject entirely. */
  verdict: ModerationVerdict;
  /** For `allow` the original text; for `mask` the masked text; for `block` the original. */
  text: string;
  /** Machine-readable reason codes (empty when `allow`). */
  reasons: string[];
  /** The dictionary terms / phrases that matched (for transparency + tests). */
  matches: string[];
}

/**
 * Cheap boolean screen: does `text` contain profanity or a slur (token-level or
 * via the cross-token condensed scan)? Content-safety phrases are NOT counted
 * here — use `moderateContent` for the full verdict.
 */
export function containsProfanity(text: string): boolean {
  const src = String(text ?? "");
  const tokens = src.match(TOKEN_RE) ?? [];
  for (const tok of tokens) if (tokenDisallowed(tok)) return true;

  const condensed = lettersOnly(src);
  const collapsed = collapse(condensed);
  return (
    anySubstring(PROFANITY_SUBSTRING, condensed, collapsed) ||
    anySubstring(SLURS_SUBSTRING, condensed, collapsed)
  );
}

/**
 * Replace every disallowed WHOLE token with `*` of the same length. Punctuation,
 * spacing, and clean words are preserved. (Cross-token / spaced obfuscation is
 * intentionally NOT re-spelled here — `moderateContent` blocks that instead.)
 */
export function maskProfanity(text: string): string {
  return String(text ?? "").replace(TOKEN_RE, (tok) =>
    tokenDisallowed(tok) ? "*".repeat(tok.length) : tok,
  );
}

/**
 * Full moderation verdict for a piece of user text.
 *
 *  - Any slur or unsafe-content phrase → `block`.
 *  - Profanity that can be masked at the token level → `mask`.
 *  - Profanity detected only across tokens (spaced/obfuscated evasion) that
 *    cannot be cleanly masked → `block` (reason `obfuscated-profanity`).
 *  - Otherwise → `allow`.
 */
export function moderateContent(text: string): ModerationResult {
  const src = String(text ?? "");
  const tokens = src.match(TOKEN_RE) ?? [];

  const reasons = new Set<string>();
  const matches = new Set<string>();

  // 1) token-level classification (maskable when profanity).
  const tokenProfanity = new Set<string>();
  const tokenSlur = new Set<string>();
  for (const tok of tokens) {
    const L = lettersOnly(tok);
    if (!L) continue;
    const C = collapse(L);
    if (
      anySubstring(SLURS_SUBSTRING, L, C, tokenSlur) ||
      anyWholeToken(SLURS_WHOLE, C, L.length, tokenSlur)
    ) {
      continue; // a slur token is block-worthy regardless of profanity status
    }
    anySubstring(PROFANITY_SUBSTRING, L, C, tokenProfanity);
    anyWholeToken(PROFANITY_WHOLE, C, L.length, tokenProfanity);
  }

  // 2) cross-token condensed scan (catches spaced / separator obfuscation).
  const condensed = lettersOnly(src);
  const collapsed = collapse(condensed);
  const condensedSlur = new Set<string>();
  anySubstring(SLURS_SUBSTRING, condensed, collapsed, condensedSlur);
  const condensedProfanity = new Set<string>();
  anySubstring(PROFANITY_SUBSTRING, condensed, collapsed, condensedProfanity);

  // 3) content-safety phrases.
  const spaced = tokens.map(lettersOnly).filter(Boolean).join(" ");
  const unsafe = new Set<string>();
  for (const phrase of UNSAFE_PHRASES) {
    if (spaced.includes(phrase.replace(/\s+/g, " "))) unsafe.add(phrase);
  }
  for (const t of UNSAFE_TOKENS) if (condensed.includes(t)) unsafe.add(t);

  const hasSlur = tokenSlur.size > 0 || condensedSlur.size > 0;
  const hasUnsafe = unsafe.size > 0;

  // Profanity found ONLY across tokens (not on any single token) = obfuscation
  // we can't cleanly mask.
  const obfuscated = [...condensedProfanity].filter((w) => !tokenProfanity.has(w));

  for (const w of tokenSlur) matches.add(w);
  for (const w of condensedSlur) matches.add(w);
  for (const w of tokenProfanity) matches.add(w);
  for (const w of obfuscated) matches.add(w);
  for (const u of unsafe) matches.add(u);

  if (hasSlur) reasons.add("slur");
  if (hasUnsafe) reasons.add("unsafe-content");

  if (hasSlur || hasUnsafe) {
    return {
      verdict: "block",
      text: src,
      reasons: [...reasons],
      matches: [...matches],
    };
  }

  if (obfuscated.length > 0) {
    reasons.add("obfuscated-profanity");
    return {
      verdict: "block",
      text: src,
      reasons: [...reasons],
      matches: [...matches],
    };
  }

  if (tokenProfanity.size > 0) {
    reasons.add("profanity");
    return {
      verdict: "mask",
      text: maskProfanity(src),
      reasons: [...reasons],
      matches: [...matches],
    };
  }

  return { verdict: "allow", text: src, reasons: [], matches: [] };
}
