/**
 * leaderboard/seed.ts — the SHARED, deterministic question stream used by BOTH
 * the client and the server-authoritative Lambda (Phase 6).
 *
 * The ranked-leaderboard flow works like this:
 *   1. a ranked run is issued a server `seed` + `preset`;
 *   2. the client plays `arenaQuestionStream(seed, preset)`;
 *   3. on submit, the Lambda regenerates the SAME stream from `(seed, preset)`
 *      and re-scores the answers server-side (see `rescore.ts` / the `.mjs`).
 *
 * ⇒ This function MUST be perfectly deterministic and MUST be a line-for-line
 * twin of `infra/lambda/leaderboard/scoring.mjs`'s `arenaQuestionStream`. A
 * shared JSON fixture (`scoring.fixture.json`) pins the exact stream so the two
 * implementations can never silently drift.
 *
 * The stream only covers INTEGER arithmetic (the `add`/`sub`/`mul`/`div` ops in
 * the shape `{ a, b, op, answer }`) — this is the ranked surface. The richer
 * fraction/decimal/percent packs live in the local-only Custom arena
 * (`src/content/arena/generators.ts`) and are never server-ranked.
 *
 * The PRNG is a self-contained mulberry32 (NOT importing `@/lib/rng`) so the
 * `.mjs` port can copy it verbatim with zero cross-module coupling.
 */
import type { ArenaOp, ArenaPreset } from "@/lib/arena/config";
import { DEFAULT_RANGES } from "@/lib/arena/config";

export interface StreamItem {
  /** Stable id = `q${index}`; the ranked answer references it by id. */
  id: string;
  a: number;
  b: number;
  op: string;
  /** The exact, computed answer (correct by construction). */
  answer: number;
}

/** Max items we will ever materialize (defensive bound on long windows). */
export const MAX_STREAM_ITEMS = 2000;
/** Items generated per second of window when no explicit `questionCap`. */
export const STREAM_ITEMS_PER_SEC = 3;

/** Deterministic mulberry32 → a `() => [0,1)` generator. Copied into the Lambda. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How many items a preset's stream holds (question cap, else window×rate). */
export function streamLength(preset: ArenaPreset): number {
  if (preset.questionCap && preset.questionCap > 0) {
    return Math.min(preset.questionCap, MAX_STREAM_ITEMS);
  }
  const byWindow = Math.ceil(preset.durationSec * STREAM_ITEMS_PER_SEC);
  return Math.min(Math.max(byWindow, 1), MAX_STREAM_ITEMS);
}

function rangeFor(preset: ArenaPreset, op: ArenaOp): [number, number] {
  const r = preset.ranges[op];
  return r ?? DEFAULT_RANGES[op];
}

/**
 * Draw one problem for `op` from a `[0,1)` generator + operand ranges. Division
 * is constructed to be EXACT (a = b × q) so `answer` is always an integer.
 */
function drawItem(
  op: ArenaOp,
  rand: () => number,
  preset: ArenaPreset,
): { a: number; b: number; answer: number } {
  const [lo, hi] = rangeFor(preset, op);
  const draw = () => lo + Math.floor(rand() * (hi - lo + 1));
  if (op === "add") {
    const a = draw();
    const b = draw();
    return { a, b, answer: a + b };
  }
  if (op === "sub") {
    let a = draw();
    let b = draw();
    if (b > a) [a, b] = [b, a]; // keep the answer non-negative
    return { a, b, answer: a - b };
  }
  if (op === "mul") {
    const a = draw();
    const b = draw();
    return { a, b, answer: a * b };
  }
  // div — exact by construction: dividend = divisor × quotient.
  const b = Math.max(1, draw());
  const q = draw();
  const a = b * q;
  return { a, b, answer: q };
}

const OP_SYMBOL: Record<string, string> = {
  add: "+",
  sub: "−",
  mul: "×",
  div: "÷",
};

/** Human-facing prompt for a stream item (client render helper). */
export function streamPrompt(item: StreamItem): string {
  return `${item.a} ${OP_SYMBOL[item.op] ?? "?"} ${item.b} = ?`;
}

/**
 * THE shared deterministic stream. Same `(seed, preset)` ⇒ identical items,
 * every `answer` matching its op exactly. This is the property the server
 * relies on to re-score a ranked submission.
 */
export function arenaQuestionStream(
  seed: number,
  preset: ArenaPreset,
): StreamItem[] {
  const rand = mulberry32(seed);
  const ops: ArenaOp[] = preset.ops.length
    ? preset.ops
    : ["add", "sub", "mul", "div"];
  const n = streamLength(preset);
  const out: StreamItem[] = [];
  for (let i = 0; i < n; i++) {
    const op = ops[Math.floor(rand() * ops.length)];
    const { a, b, answer } = drawItem(op, rand, preset);
    out.push({ id: `q${i}`, a, b, op, answer });
  }
  return out;
}
