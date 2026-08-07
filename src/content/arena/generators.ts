/**
 * content/arena/generators.ts, seeded arithmetic item generator for the Speed
 * Arena's local Custom / casual mode, extending Zetamac's integer drills with
 * fraction / decimal / percent packs (Phase 6).
 *
 * Distinct from `@/lib/leaderboard/seed.ts`:
 *  - `seed.ts` is the INTEGER-only, server-authoritative ranked stream (shape
 *    `{a,b,op,answer}`, mirrored line-for-line in the Lambda);
 *  - THIS module is the LOCAL-only, richer generator (fraction/decimal/percent)
 *    that produces free-entry `ArenaItem`s with a `decimals` grading precision.
 *
 * It reuses the timed mental-arithmetic patterns from
 * `@/content/mentalMath/generators.ts` (we import the shared `Rng`; we do NOT
 * edit that file). Every answer is computed directly, so it is correct by
 * construction, and each item is deterministic in the seeded `Rng`.
 */
import { Rng } from "@/lib/rng";
import type { ArenaOp, ArenaPack, ArenaPreset } from "@/lib/arena/config";
import { DEFAULT_RANGES } from "@/lib/arena/config";

export interface ArenaItem {
  id: string;
  prompt: string;
  /** Exact answer. Graded by exact match when `decimals` is absent, else by
   * rounded compare to `decimals` places (mirrors the numeric play mode). */
  answer: number;
  op: ArenaOp;
  pack: ArenaPack;
  decimals?: number;
}

const OP_SYMBOL: Record<ArenaOp, string> = {
  add: "+",
  sub: "−",
  mul: "×",
  div: "÷",
};

/** Denominators whose fractions terminate in ≤ 4 decimals (typeable exactly). */
const TERMINATING_DENOMS = [2, 4, 5, 8, 10, 20, 25] as const;

function round(n: number, dp: number): number {
  return Number(n.toFixed(dp));
}

function rangeFor(preset: ArenaPreset, op: ArenaOp): [number, number] {
  return preset.ranges[op] ?? DEFAULT_RANGES[op];
}

/** Integer pack, the classic Zetamac drill (exact, no penalty by default). */
function genInt(rng: Rng, op: ArenaOp, preset: ArenaPreset): ArenaItem {
  const [lo, hi] = rangeFor(preset, op);
  const draw = () => rng.int(lo, hi);
  let a: number;
  let b: number;
  let answer: number;
  if (op === "add") {
    a = draw();
    b = draw();
    answer = a + b;
  } else if (op === "sub") {
    a = draw();
    b = draw();
    if (b > a) [a, b] = [b, a];
    answer = a - b;
  } else if (op === "mul") {
    a = draw();
    b = draw();
    answer = a * b;
  } else {
    b = Math.max(1, draw());
    const q = draw();
    a = b * q;
    answer = q;
  }
  return {
    id: `int-${op}-${a}-${b}`,
    prompt: `${a} ${OP_SYMBOL[op]} ${b} = ?`,
    answer,
    op,
    pack: "int",
  };
}

/** Fraction pack, convert a proper terminating fraction to a decimal. */
function genFraction(rng: Rng): ArenaItem {
  const den = rng.pick(TERMINATING_DENOMS);
  const num = rng.int(1, den - 1);
  const answer = round(num / den, 4);
  return {
    id: `frac-${num}-${den}`,
    prompt: `${num}/${den} = ? (decimal)`,
    answer,
    op: "div",
    pack: "fraction",
    decimals: 4,
  };
}

/** Decimal pack, one-decimal-place operands, answer to 2 places. */
function genDecimal(rng: Rng, op: ArenaOp, preset: ArenaPreset): ArenaItem {
  const [lo, hi] = rangeFor(preset, op);
  const a = round(rng.int(lo, hi) + rng.int(0, 9) / 10, 1);
  const b = round(rng.int(lo, hi) + rng.int(0, 9) / 10, 1);
  let x = a;
  let y = b;
  let answer: number;
  if (op === "sub") {
    if (y > x) [x, y] = [y, x];
    answer = round(x - y, 2);
  } else if (op === "mul") {
    answer = round(x * y, 2);
  } else {
    // add (and any div fallback collapses to add for clean decimals)
    answer = round(x + y, 2);
    return {
      id: `dec-add-${x}-${y}`,
      prompt: `${x} + ${y} = ?`,
      answer,
      op: "add",
      pack: "decimal",
      decimals: 2,
    };
  }
  return {
    id: `dec-${op}-${x}-${y}`,
    prompt: `${x} ${OP_SYMBOL[op]} ${y} = ?`,
    answer,
    op,
    pack: "decimal",
    decimals: 2,
  };
}

/** Percent pack, p% of a round base. */
function genPercent(rng: Rng): ArenaItem {
  const p = rng.pick([5, 10, 12, 15, 20, 25, 30, 40, 50, 75]);
  const base = rng.int(2, 40) * 10;
  const answer = round((p / 100) * base, 2);
  return {
    id: `pct-${p}-${base}`,
    prompt: `${p}% of ${base} = ?`,
    answer,
    op: "mul",
    pack: "percent",
    decimals: 2,
  };
}

/** Draw one item for a given pack + op from the seeded Rng. */
export function generateArenaItem(
  rng: Rng,
  op: ArenaOp,
  pack: ArenaPack,
  preset: ArenaPreset,
): ArenaItem {
  switch (pack) {
    case "fraction":
      return genFraction(rng);
    case "decimal":
      return genDecimal(rng, op, preset);
    case "percent":
      return genPercent(rng);
    case "int":
    default:
      return genInt(rng, op, preset);
  }
}

/**
 * Deterministic local stream of `count` items drawn across the preset's ops ×
 * packs. Same `(seed, preset, count)` ⇒ identical items. Ids are suffixed with
 * their position so a run never has duplicate keys even when the same problem
 * is drawn twice.
 */
export function arenaItemStream(
  seed: number,
  preset: ArenaPreset,
  count: number,
): ArenaItem[] {
  const rng = new Rng(seed);
  const ops: ArenaOp[] = preset.ops.length
    ? preset.ops
    : ["add", "sub", "mul", "div"];
  const packs: ArenaPack[] = preset.packs.length ? preset.packs : ["int"];
  const out: ArenaItem[] = [];
  for (let i = 0; i < count; i++) {
    const op = rng.pick(ops);
    const pack = rng.pick(packs);
    const item = generateArenaItem(rng, op, pack, preset);
    out.push({ ...item, id: `${item.id}#${i}` });
  }
  return out;
}
