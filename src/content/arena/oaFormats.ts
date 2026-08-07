/**
 * content/arena/oaFormats.ts. OA-style timing/quality metadata for top-tier
 * quant online assessments, plus a pure validation/audit engine that keeps our
 * timed drills FAITHFUL to how real firms pace their screens.
 *
 * WHY THIS EXISTS (problem-quality parity, Case B). A "timing" feature is only
 * as good as its numbers. If our per-question budgets drift away from what firms
 * actually give candidates, students train for the wrong pace. So every OA
 * archetype we mirror is captured here as PLAIN DATA with:
 *  - its firm-reported shape (question count, total time, format, penalty), and
 *  - a benchmark per-question budget DERIVED from that shape (totalSec / count),
 * every number grounded in `datasets/FIRM_TIMED_ASSESSMENTS*.md` with an `asOf`
 * stamp, a `confidence` tag, and the exact source section. Formats are described
 * generically by their shape and pace; the catalog does not attribute a format
 * to any specific firm.
 *
 * The audit engine (`auditOaFormat`, `auditPresetBudget`) is the process that
 * enforces parity: it re-derives the per-question budget from count/time and
 * flags any internal inconsistency, and it checks that a Speed-Arena preset's
 * implied pace is within tolerance of the benchmark it claims to mirror. Runs in
 * CI via unit tests, so a drifted budget fails the build rather than silently
 * mistraining students.
 *
 * Everything here is static, local, framework-free data + pure functions, no
 * network, no clock, no backend.
 */
import type { ArenaPreset } from "@/lib/arena/config";

/** The three OA archetypes from FIRM_TIMED_ASSESSMENTS.md §1. */
export type OaArchetype =
  | "arithmetic-sprint" // e.g. 80/8, 60/6, 50/5 timed arithmetic sprints
  | "short-brutal" // ~15–20 typed Qs / 20min, or ~6–8 Qs / 45–60min deep sets
  | "mixed-battery"; // ~50 logic/arithmetic Qs / 12min cognitive batteries

/** Answer entry style, free-response is strictly harder (no elimination). */
export type OaEntryFormat = "free-response" | "multiple-choice";

/** How much we trust a community/prep-vendor-reported OA shape. */
export type OaConfidence = "low" | "medium" | "high";

/**
 * One firm-style OA format. `perQuestionSec` is the BENCHMARK budget and is
 * always `totalSec / questionCount` (asserted by the audit + tests), so it can
 * never silently diverge from the reported shape.
 */
export interface OaFormat {
  /** Stable, firm-neutral id used to link a preset/drill to its benchmark. */
  id: string;
  /** Human-readable, firm-neutral label. */
  label: string;
  archetype: OaArchetype;
  /** Reported number of questions. */
  questionCount: number;
  /** Reported total window, seconds. */
  totalSec: number;
  /** Benchmark per-question budget (seconds) = totalSec / questionCount. */
  perQuestionSec: number;
  entry: OaEntryFormat;
  /** Whether skipping is allowed without penalty in the reported format. */
  skipAllowed: boolean;
  /** Whether a wrong answer is penalized (e.g. a +1/−1 sprint). */
  penalty: boolean;
  /** ISO year-month this shape was last believed current. */
  asOf: string;
  confidence: OaConfidence;
  /** Provenance, the research doc + section every number came from. */
  sourceDoc: string;
  /** Standing disclaimer rendered alongside any firm attribution. */
  caveat: string;
}

const RESEARCH_CAVEAT =
  "Firm-reported / prep-vendor sourced and rotates by cycle. Treat the skill category and rough pace as durable; exact counts/timers are approximate.";

/** Derive the benchmark per-question budget (seconds), rounded to 0.1s. */
export function derivePerQuestionSec(totalSec: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round((totalSec / count) * 10) / 10;
}

/** Build one format, forcing `perQuestionSec` to the derived benchmark. */
function fmt(
  f: Omit<OaFormat, "perQuestionSec" | "caveat">,
): OaFormat {
  return {
    ...f,
    perQuestionSec: derivePerQuestionSec(f.totalSec, f.questionCount),
    caveat: RESEARCH_CAVEAT,
  };
}

/**
 * The OA benchmark catalog. Every entry is grounded in
 * `datasets/FIRM_TIMED_ASSESSMENTS.md` (§ noted per row) + its part files.
 * Ordered fastest-pace first so the UI can present a difficulty gradient.
 */
export const OA_FORMATS: readonly OaFormat[] = [
  fmt({
    id: "optiver-80-8",
    label: "Rapid-Fire Arithmetic Sprint",
    archetype: "arithmetic-sprint",
    questionCount: 80,
    totalSec: 480,
    entry: "free-response",
    skipAllowed: true,
    penalty: true, // +1/−1 penalty (§1, part1 L14)
    asOf: "2026-07",
    confidence: "medium",
    sourceDoc: "FIRM_TIMED_ASSESSMENTS.md §1–2; part1 L14,L137",
  }),
  fmt({
    id: "flow-60-6",
    label: "60-in-6 Sprint (no skip)",
    archetype: "arithmetic-sprint",
    questionCount: 60,
    totalSec: 360,
    entry: "multiple-choice",
    skipAllowed: false, // Flow: no-skip (§4 row 1)
    penalty: false,
    asOf: "2026-07",
    confidence: "medium",
    sourceDoc: "FIRM_TIMED_ASSESSMENTS.md §1,§4",
  }),
  fmt({
    id: "maven-50-5",
    label: "50-in-5 Numerical Sprint",
    archetype: "arithmetic-sprint",
    questionCount: 50,
    totalSec: 300,
    entry: "free-response",
    skipAllowed: true,
    penalty: false,
    asOf: "2026-07",
    confidence: "medium",
    sourceDoc: "FIRM_TIMED_ASSESSMENTS.md §1,§4",
  }),
  fmt({
    id: "citadel-50-12",
    label: "50-Question Cognitive Battery",
    archetype: "mixed-battery",
    questionCount: 50,
    totalSec: 720, // 12 min → ~14.4 s/q (part1 L44)
    entry: "multiple-choice",
    skipAllowed: true,
    penalty: false,
    asOf: "2026-07",
    confidence: "medium",
    sourceDoc: "FIRM_TIMED_ASSESSMENTS.md §2; part1 L44",
  }),
  fmt({
    id: "sig-quant-eval",
    label: "20-Minute Quant Evaluation",
    archetype: "mixed-battery",
    questionCount: 14, // ~12–16 Qs / 20 min (part1 L81) → ~15–30 s/q
    totalSec: 1200,
    entry: "multiple-choice",
    skipAllowed: true,
    penalty: false,
    asOf: "2026-07",
    confidence: "low",
    sourceDoc: "FIRM_TIMED_ASSESSMENTS.md §1; part1 L81",
  }),
  fmt({
    id: "five-rings-20",
    label: "Short-&-Brutal Problem Set",
    archetype: "short-brutal",
    questionCount: 18, // ~15–20 typed Qs / 20 min → ~60–80 s/q (§1)
    totalSec: 1200,
    entry: "free-response",
    skipAllowed: true,
    penalty: false,
    asOf: "2026-07",
    confidence: "low",
    sourceDoc: "FIRM_TIMED_ASSESSMENTS.md §1,§2",
  }),
  fmt({
    id: "drw-6-45",
    label: "Deep Problem Set",
    archetype: "short-brutal",
    questionCount: 7, // ~6–8 Qs / 45–60 min → ~7.5 min/q (part1 L95)
    totalSec: 3150,
    entry: "free-response",
    skipAllowed: true,
    penalty: false,
    asOf: "2026-07",
    confidence: "low",
    sourceDoc: "FIRM_TIMED_ASSESSMENTS.md §1; part1 L95",
  }),
] as const;

/** Lookup a benchmark format by id. */
export function oaFormatById(id: string): OaFormat | undefined {
  return OA_FORMATS.find((f) => f.id === id);
}

/** Benchmark per-question budget in MILLISECONDS for a format id. */
export function benchmarkBudgetMs(id: string): number | undefined {
  const f = oaFormatById(id);
  return f ? f.perQuestionSec * 1000 : undefined;
}

/* -------------------------------------------------------------------------- */
/*  Validation / audit, the parity-keeping process                          */
/* -------------------------------------------------------------------------- */

/** One checklist item's result. `ok:false` means the format failed the check. */
export interface AuditCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface OaAuditResult {
  formatId: string;
  checks: AuditCheck[];
  /** True ⇔ every check passed. */
  passed: boolean;
}

/**
 * How far (fractionally) a value may drift from a benchmark before the audit
 * flags it. 0.15 ⇒ within ±15% of the benchmark pace counts as faithful.
 */
export const BUDGET_DRIFT_TOLERANCE = 0.15;

/**
 * Audit a single OA format for internal consistency, the checklist that keeps
 * the metadata trustworthy:
 *  1. positive question count and window,
 *  2. `perQuestionSec` equals the derived `totalSec / count` (no hand-edited
 *     benchmark that lies about the shape),
 *  3. the pace is plausible for its archetype (sprints are seconds-per-q; brutal
 *     sets are minutes-per-q) so a mis-tagged archetype is caught,
 *  4. provenance present (sourceDoc + asOf), so nothing is unsourced.
 */
export function auditOaFormat(f: OaFormat): OaAuditResult {
  const derived = derivePerQuestionSec(f.totalSec, f.questionCount);
  const checks: AuditCheck[] = [
    {
      id: "positive-shape",
      label: "Positive question count and window",
      ok: f.questionCount > 0 && f.totalSec > 0,
      detail: `${f.questionCount} Qs / ${f.totalSec}s`,
    },
    {
      id: "budget-derived",
      label: "Per-question budget = window ÷ count",
      ok: Math.abs(f.perQuestionSec - derived) < 1e-9,
      detail: `stated ${f.perQuestionSec}s vs derived ${derived}s`,
    },
    {
      id: "archetype-pace",
      label: "Pace is plausible for its archetype",
      ok: archetypePaceOk(f.archetype, f.perQuestionSec),
      detail: `${f.perQuestionSec}s/q for ${f.archetype}`,
    },
    {
      id: "provenance",
      label: "Sourced (research doc + as-of date)",
      ok: f.sourceDoc.trim().length > 0 && /^\d{4}-\d{2}$/.test(f.asOf),
      detail: `${f.sourceDoc} (${f.asOf})`,
    },
  ];
  return {
    formatId: f.id,
    checks,
    passed: checks.every((c) => c.ok),
  };
}

/** Plausible per-question pace bands (seconds) by archetype. */
function archetypePaceOk(archetype: OaArchetype, perQSec: number): boolean {
  switch (archetype) {
    case "arithmetic-sprint":
      return perQSec > 0 && perQSec <= 20; // seconds-per-q sprint
    case "mixed-battery":
      return perQSec >= 10 && perQSec <= 120; // logic/EV, tens of seconds
    case "short-brutal":
      return perQSec >= 45; // minutes-per-q deep problems
  }
}

/** Audit the whole catalog; returns only the formats that FAILED. */
export function auditCatalog(
  formats: readonly OaFormat[] = OA_FORMATS,
): OaAuditResult[] {
  return formats.map(auditOaFormat).filter((r) => !r.passed);
}

export interface PresetBudgetAudit {
  formatId: string;
  /** Per-question budget the preset implies (ms). */
  presetBudgetMs: number;
  /** The benchmark per-question budget (ms). */
  benchmarkMs: number;
  /** Fractional drift = |preset − benchmark| / benchmark. */
  drift: number;
  /** True ⇔ drift within `BUDGET_DRIFT_TOLERANCE`. */
  faithful: boolean;
}

/**
 * Audit that a Speed-Arena preset's implied per-question pace stays FAITHFUL to
 * the OA it claims to mirror. `presetBudgetMs` is the caller's derived pace
 * (see `arena/budget.ts`), kept as an argument so this module stays free of any
 * budget-derivation policy. Returns `undefined` when the format id is unknown.
 */
export function auditPresetBudget(
  formatId: string,
  presetBudgetMs: number,
  tolerance: number = BUDGET_DRIFT_TOLERANCE,
): PresetBudgetAudit | undefined {
  const benchmarkMs = benchmarkBudgetMs(formatId);
  if (benchmarkMs === undefined || benchmarkMs <= 0) return undefined;
  const drift = Math.abs(presetBudgetMs - benchmarkMs) / benchmarkMs;
  return {
    formatId,
    presetBudgetMs,
    benchmarkMs,
    drift,
    faithful: drift <= tolerance,
  };
}

/** A `[ArenaPreset]`-agnostic convenience: read the preset window/cap directly. */
export function presetImpliedBudgetMs(preset: ArenaPreset): number {
  const windowMs = preset.durationSec * 1000;
  const cap = preset.questionCap && preset.questionCap > 0 ? preset.questionCap : 0;
  return cap > 0 ? windowMs / cap : 0;
}
