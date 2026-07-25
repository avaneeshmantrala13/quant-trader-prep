/**
 * infra/lambda/leaderboard/scoring.mjs — the server-side twin of the client's
 * shared scoring logic (Phase 6). This is a LINE-FOR-LINE PORT of:
 *   - src/lib/leaderboard/seed.ts     (arenaQuestionStream / streamLength)
 *   - src/lib/arena/scoring.ts        (zetamacScore / optiverScore / scoreRun)
 *   - src/lib/leaderboard/rescore.ts  (gradeRankedAnswers / checkPlausibility / rescore)
 *
 * The client and server MUST agree bit-for-bit so a ranked run re-scores
 * identically. `scoring.fixture.json` (generated from THIS file by
 * gen-fixture.mjs) pins the exact stream + score; a vitest `.ts` test asserts
 * the TypeScript implementation reproduces the same fixture, so the two sides
 * can never silently drift.
 *
 * Pure — no AWS, no I/O. The DynamoDB / handler wiring lives in index.mjs.
 */

const DEFAULT_RANGES = {
  add: [2, 100],
  sub: [2, 100],
  mul: [2, 12],
  div: [2, 12],
};

export const MAX_STREAM_ITEMS = 2000;
export const STREAM_ITEMS_PER_SEC = 3;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function streamLength(preset) {
  if (preset.questionCap && preset.questionCap > 0) {
    return Math.min(preset.questionCap, MAX_STREAM_ITEMS);
  }
  const byWindow = Math.ceil(preset.durationSec * STREAM_ITEMS_PER_SEC);
  return Math.min(Math.max(byWindow, 1), MAX_STREAM_ITEMS);
}

function rangeFor(preset, op) {
  const r = preset.ranges && preset.ranges[op];
  return r ?? DEFAULT_RANGES[op];
}

function drawItem(op, rand, preset) {
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
    if (b > a) [a, b] = [b, a];
    return { a, b, answer: a - b };
  }
  if (op === "mul") {
    const a = draw();
    const b = draw();
    return { a, b, answer: a * b };
  }
  const b = Math.max(1, draw());
  const q = draw();
  const a = b * q;
  return { a, b, answer: q };
}

export function arenaQuestionStream(seed, preset) {
  const rand = mulberry32(seed);
  const ops = preset.ops && preset.ops.length
    ? preset.ops
    : ["add", "sub", "mul", "div"];
  const n = streamLength(preset);
  const out = [];
  for (let i = 0; i < n; i++) {
    const op = ops[Math.floor(rand() * ops.length)];
    const { a, b, answer } = drawItem(op, rand, preset);
    out.push({ id: `q${i}`, a, b, op, answer });
  }
  return out;
}

export function zetamacScore(items) {
  let n = 0;
  for (const it of items) if (!it.skipped && it.correct) n++;
  return n;
}

export function optiverScore(items, skipsFree) {
  let s = 0;
  for (const it of items) {
    if (it.skipped) {
      if (!skipsFree) s -= 1;
      continue;
    }
    s += it.correct ? 1 : -1;
  }
  return s;
}

export function scoreRun(items, preset) {
  return preset.penalty
    ? optiverScore(items, preset.skipsFree)
    : zetamacScore(items);
}

function median(xs) {
  if (xs.length === 0) return 0;
  if (xs.length === 1) return xs[0];
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = 0.5 * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export const PLAUSIBILITY = {
  MAX_QPS: 2.5,
  MIN_ATTEMPTS_FOR_SPEED_CHECK: 20,
  IMPLAUSIBLE_MEDIAN_MS: 250,
  IMPLAUSIBLE_ACCURACY: 0.8,
  MAX_ELAPSED_OVER_WINDOW: 1.25,
  ELAPSED_DIVERGENCE_MS: 5000,
};

export function gradeRankedAnswers(seed, preset, answers) {
  const stream = arenaQuestionStream(seed, preset);
  const byId = new Map(stream.map((s) => [s.id, s]));
  const graded = [];
  for (const ans of answers) {
    const q = byId.get(ans.id);
    if (!q) continue;
    const skipped = ans.value === null || ans.value === undefined;
    graded.push({
      id: ans.id,
      correct: !skipped && ans.value === q.answer,
      skipped,
      rtMs: ans.rtMs,
      op: q.op,
    });
  }
  return graded;
}

export function checkPlausibility(graded, input) {
  const attempted = graded.filter((g) => !g.skipped);
  const windowMs = input.preset.durationSec * 1000;
  if (input.clientElapsedMs > windowMs * PLAUSIBILITY.MAX_ELAPSED_OVER_WINDOW) {
    return "elapsed>window";
  }
  if (
    input.serverElapsedMs !== undefined &&
    Math.abs(input.clientElapsedMs - input.serverElapsedMs) >
      PLAUSIBILITY.ELAPSED_DIVERGENCE_MS
  ) {
    return "elapsed-divergence";
  }
  const elapsedSec = Math.max(1, input.clientElapsedMs) / 1000;
  const qps = attempted.length / elapsedSec;
  if (qps > PLAUSIBILITY.MAX_QPS) return "qps>max";
  if (attempted.length >= PLAUSIBILITY.MIN_ATTEMPTS_FOR_SPEED_CHECK) {
    const medianRt = median(attempted.map((a) => a.rtMs));
    const accuracy =
      attempted.filter((a) => a.correct).length / attempted.length;
    if (
      medianRt < PLAUSIBILITY.IMPLAUSIBLE_MEDIAN_MS &&
      accuracy > PLAUSIBILITY.IMPLAUSIBLE_ACCURACY
    ) {
      return "speed-accuracy";
    }
  }
  return null;
}

export function rescore(input) {
  const graded = gradeRankedAnswers(input.seed, input.preset, input.answers);
  const attempts = graded.filter((g) => !g.skipped).length;
  const correct = graded.filter((g) => !g.skipped && g.correct).length;
  const reason = checkPlausibility(graded, input);
  if (reason) return { ok: false, score: 0, correct, attempts, reason };
  return { ok: true, score: scoreRun(graded, input.preset), correct, attempts };
}

/* ISO-week key + display-name validation — twins of leaderboard/identity.ts. */
export function isoWeekKey(atMs) {
  const d = new Date(atMs);
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const BANNED = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot", "asshole"];
export function validateDisplayName(raw) {
  const value = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (value.length < 3) return { ok: false, reason: "too-short" };
  if (value.length > 20) return { ok: false, reason: "too-long" };
  if (!/^[A-Za-z0-9 _-]+$/.test(value)) return { ok: false, reason: "bad-chars" };
  const lower = value.toLowerCase();
  if (BANNED.some((w) => lower.includes(w))) {
    return { ok: false, reason: "profanity" };
  }
  return { ok: true, value };
}
