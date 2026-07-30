/**
 * Pure grading + reference-computation engine for the dedicated Fermi
 * estimation drill.
 *
 * A Fermi problem has NO single exact answer — the goal is a defensible
 * decomposition landing near the right ORDER OF MAGNITUDE. So instead of an
 * exact-match compare (the `@/lib/numeric` path used by Kelly/basket levels),
 * every item is defined as an ordered chain of named factors whose product is
 * computed IN CODE (`computeFermiReference`). The learner's single numeric
 * estimate is then graded by LOG-DISTANCE to that coded reference
 * (`gradeFermi`), so "right" means "within a tunable factor of the reference",
 * which is exactly how a Fermi estimate is judged.
 *
 * Everything here is pure and framework-free so it can be exhaustively unit
 * tested (see `grader.test.ts`): the coded product of each item's factors, the
 * log-distance bands, and the large-number input parser.
 */

/** How a factor combines into the running product: multiply (default) or divide. */
export type FermiOp = "mul" | "div";

/**
 * One named factor in a canonical Fermi decomposition. `value` is a positive,
 * finite estimate; `op` says whether it multiplies into or divides out of the
 * running product (division models the classic "demand ÷ throughput" and
 * "count ÷ rate" steps — e.g. tunings-per-year ÷ tunings-per-tuner). The
 * `label`/`unit` make the revealed chain read like a defensible argument.
 */
export interface FermiFactor {
  /** Human-readable name of this factor, e.g. "People per household". */
  label: string;
  /** The estimated magnitude of this factor (must be finite and > 0). */
  value: number;
  /** Multiply (default) or divide the running product by `value`. */
  op?: FermiOp;
  /** Optional unit shown beside the value, e.g. "people", "$/customer". */
  unit?: string;
}

/** One step of the revealed decomposition: the factor plus the running product after it. */
export interface FermiRunningStep {
  label: string;
  value: number;
  op: FermiOp;
  unit?: string;
  /** The running product AFTER applying this factor. */
  running: number;
}

/**
 * Fold a decomposition into its coded reference value. Starting from 1, each
 * factor multiplies (or divides) the accumulator. This is the single source of
 * truth for an item's reference answer — the value the estimate is graded
 * against — so it is asserted equal to each item's stated `reference` in tests.
 */
export function computeFermiReference(factors: readonly FermiFactor[]): number {
  return factors.reduce(
    (acc, f) => (f.op === "div" ? acc / f.value : acc * f.value),
    1,
  );
}

/** Build the step-by-step running product for the post-answer reveal. */
export function computeRunningSteps(
  factors: readonly FermiFactor[],
): FermiRunningStep[] {
  const steps: FermiRunningStep[] = [];
  let running = 1;
  for (const f of factors) {
    const op: FermiOp = f.op === "div" ? "div" : "mul";
    running = op === "div" ? running / f.value : running * f.value;
    steps.push({ label: f.label, value: f.value, op, unit: f.unit, running });
  }
  return steps;
}

/* -------------------------------------------------------------------------- */
/*  Input parsing — large / scientific / suffixed number entry                */
/* -------------------------------------------------------------------------- */

/**
 * Parse a free-entry estimate to a finite number, or `null` if unparseable.
 *
 * Fermi answers span many orders of magnitude, so we accept far more than a
 * plain integer: scientific notation (`3e5`, `3E+5`), magnitude suffixes
 * (`300k`, `1.5m`, `9b`, `48t`, plus the words thousand/million/billion/
 * trillion and the finance shorthands `mm`/`bn`), a leading currency symbol,
 * thousands separators, and surrounding whitespace. Malformed input yields
 * `null`, which the grader treats as incorrect (never a crash).
 */
export function parseFermiInput(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase();
  if (s === "") return null;
  // Strip currency symbols, thousands separators, and internal whitespace.
  s = s.replace(/[,$£€\s]/g, "");
  if (s === "") return null;
  // Normalize spelled-out and shorthand magnitudes to single-letter suffixes.
  s = s
    .replace(/thousand$/, "k")
    .replace(/trillion$/, "t")
    .replace(/billion$/, "b")
    .replace(/million$/, "m")
    .replace(/bn$/, "b")
    .replace(/mm$/, "m");

  const mults: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  let mult = 1;
  const last = s.slice(-1);
  if (last in mults) {
    mult = mults[last];
    s = s.slice(0, -1);
  }
  if (s === "" || s === "-" || s === "+" || s === ".") return null;
  // A plain (optionally signed) decimal, with optional scientific exponent.
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(s)) return null;
  const n = Number(s) * mult;
  return Number.isFinite(n) ? n : null;
}

/* -------------------------------------------------------------------------- */
/*  Log-distance grading                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Tolerance bands, expressed as |log10(estimate) − log10(reference)|.
 *  - `<= 0.5`  → CORRECT  (within ~3.16×, i.e. "right order of magnitude and
 *                close"): full credit.
 *  - `<= 1.0`  → CLOSE    (within one full order of magnitude / 10×): partial.
 *  - `> 1.0`   → INCORRECT.
 * These are deliberately generous on purpose — a Fermi answer is judged by
 * magnitude, not precision — and documented on the drill's "how this is graded"
 * panel so the scoring is transparent to the learner.
 */
export const FERMI_FULL_CREDIT_LOG = 0.5;
export const FERMI_PARTIAL_CREDIT_LOG = 1.0;

export type FermiBand = "correct" | "close" | "incorrect";

export interface FermiGrade {
  /** The parsed estimate, or null when the entry could not be parsed. */
  parsed: number | null;
  /** The coded reference answer this was graded against. */
  reference: number;
  /** |log10(estimate) − log10(reference)|, or null for invalid input. */
  logDistance: number | null;
  /** Multiplicative distance (always >= 1), or null for invalid input. */
  factor: number | null;
  /** Which tolerance band the estimate fell into. */
  band: FermiBand;
  /** Credit awarded: 1 (correct), 0.5 (close), or 0 (incorrect/invalid). */
  score: number;
}

/** Map a raw log-distance to its band + credit. */
function bandFor(logDistance: number): { band: FermiBand; score: number } {
  if (logDistance <= FERMI_FULL_CREDIT_LOG) return { band: "correct", score: 1 };
  if (logDistance <= FERMI_PARTIAL_CREDIT_LOG) return { band: "close", score: 0.5 };
  return { band: "incorrect", score: 0 };
}

/** Grade an already-parsed numeric estimate against a reference value. */
export function gradeFermiValue(
  reference: number,
  value: number | null,
): FermiGrade {
  const invalid = (): FermiGrade => ({
    parsed: value,
    reference,
    logDistance: null,
    factor: null,
    band: "incorrect",
    score: 0,
  });
  if (
    value === null ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isFinite(reference) ||
    reference <= 0
  ) {
    return invalid();
  }
  const logDistance = Math.abs(Math.log10(value) - Math.log10(reference));
  const { band, score } = bandFor(logDistance);
  return {
    parsed: value,
    reference,
    logDistance,
    factor: 10 ** logDistance,
    band,
    score,
  };
}

/** Parse + grade a raw free-entry estimate against a reference value. */
export function gradeFermi(reference: number, raw: string): FermiGrade {
  return gradeFermiValue(reference, parseFermiInput(raw));
}

/* -------------------------------------------------------------------------- */
/*  Display helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Round to `sig` significant figures (for tidy magnitude display). */
function toSig(n: number, sig = 2): number {
  if (n === 0 || !Number.isFinite(n)) return n;
  const digits = Math.ceil(Math.log10(Math.abs(n)));
  const power = sig - digits;
  const factor = 10 ** power;
  return Math.round(n * factor) / factor;
}

/**
 * Human-friendly magnitude string, e.g. `180`, `650,000`, `8.1 million`,
 * `9 billion`, `$48 trillion`. Below one million we show grouped digits; above,
 * a rounded value with a scale word so orders of magnitude stay legible.
 */
export function formatFermiNumber(n: number, opts?: { money?: boolean }): string {
  const prefix = opts?.money ? "$" : "";
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const scales: [number, string][] = [
    [1e12, "trillion"],
    [1e9, "billion"],
    [1e6, "million"],
  ];
  for (const [base, word] of scales) {
    if (abs >= base) {
      const scaled = toSig(n / base, 3);
      return `${prefix}${scaled.toLocaleString("en-US")} ${word}`;
    }
  }
  if (abs >= 1000) {
    return `${prefix}${Math.round(n).toLocaleString("en-US")}`;
  }
  return `${prefix}${toSig(n, 2).toLocaleString("en-US")}`;
}

/** Copy for each grading band, used by the reveal UI. */
export const FERMI_BAND_COPY: Record<
  FermiBand,
  { label: string; tone: "bull" | "accent" | "bear" }
> = {
  correct: { label: "On the money", tone: "bull" },
  close: { label: "Right ballpark", tone: "accent" },
  incorrect: { label: "Off the mark", tone: "bear" },
};
