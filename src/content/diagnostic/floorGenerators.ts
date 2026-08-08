import type { NumericQuestion, NumericQuestionGenerator } from "@/types/content";
import { Rng } from "@/lib/rng";

/**
 * PARAMETRIC floor generators for the untimed diagnostic / drilling bank.
 *
 * A handful of authored diagnostic FLOOR items were fixed, static questions —
 * most notably the "two pipes fill a tank" combined-rates word problem. Because
 * the drilling loop re-draws a topic's floor item every round, a STATIC question
 * re-emitted the EXACT same rendered problem (same prompt, same numbers) within
 * a single session. The whole point of the bank is that it feels infinite, so a
 * floor family that CAN be parameterised must be.
 *
 * These generators are the exact-verified, parametric replacements: the answer
 * is COMPUTED from the drawn numbers by the same closed form the worked
 * explanation narrates (never a hardcoded table), the `commonErrors` are the
 * family's canonical misconceptions computed from the same numbers, and every
 * instance carries a stable `family` tag so the rung-3 worked sibling can
 * re-run the SAME family with different numbers.
 */

/** Capitalise the first letter (theme subjects render mid-sentence and lead). */
function cap(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** Stable family id for the combined-rates "how long together" floor family. */
export const RATES_COMBINED_FAMILY = "rates-combined-together";

interface RateTheme {
  /** First agent (already capitalised for the sentence lead). */
  a: string;
  /** Second agent (lower-case, appears mid-sentence). */
  b: string;
  /** The verb phrase, e.g. "fills". */
  verb: string;
  /** The object being worked on, e.g. "the tank". */
  obj: string;
  /** Unit noun (plural), e.g. "hours". */
  unit: string;
}

const RATE_THEMES: RateTheme[] = [
  { a: "Pipe A", b: "pipe B", verb: "fills", obj: "the tank", unit: "hours" },
  { a: "Hose A", b: "hose B", verb: "fills", obj: "the pool", unit: "hours" },
  { a: "Inlet A", b: "inlet B", verb: "fills", obj: "the reservoir", unit: "hours" },
  { a: "Alice", b: "Bob", verb: "can paint the fence", obj: "the fence", unit: "hours" },
  { a: "Printer A", b: "printer B", verb: "prints the report", obj: "the report", unit: "minutes" },
  { a: "Crew A", b: "crew B", verb: "can pave the road", obj: "the road", unit: "days" },
];

/**
 * Combined-rates "how long together" floor family (rates add, NOT the times).
 *
 * Two agents each complete one unit of work alone in `ta` / `tb` units; working
 * together their rates ADD, so the joint time is `1 / (1/ta + 1/tb) = ta·tb /
 * (ta + tb)`. The two classic traps — averaging the times `(ta+tb)/2` and adding
 * the times `ta+tb` — are emitted as `commonErrors` from the same numbers.
 *
 * Deterministic given `rng`. Answers are graded to 2 dp when non-integral so any
 * `(ta, tb)` pair is fair game (a genuinely large parameter space), keeping the
 * bank effectively infinite.
 */
export function genCombinedRatesTogether(rng: Rng): NumericQuestion {
  const theme = rng.pick(RATE_THEMES);
  // Draw two DISTINCT solo times. A wide range × two draws × 6 themes gives a
  // large space, so successive draws are overwhelmingly distinct on their own
  // (the drilling dedup guarantees the rest).
  const ta = rng.int(2, 15);
  let tb = rng.int(2, 15);
  while (tb === ta) tb = rng.int(2, 15);

  const exact = (ta * tb) / (ta + tb);
  const isInteger = Number.isInteger(exact);
  const decimals = isInteger ? undefined : 2;
  const answerText = isInteger ? String(exact) : exact.toFixed(2);

  const averaged = (ta + tb) / 2; // trap: averaged the TIMES
  const summed = ta + tb; // trap: added the TIMES

  const u = theme.unit;
  const prompt =
    `${cap(theme.a)} ${theme.verb} alone in ${ta} ${u}; ${theme.b} does the same alone in ${tb} ${u}. ` +
    `Working together at their combined rate, how many ${u} does it take?`;

  const explanation =
    `Add the RATES, not the times: 1/${ta} + 1/${tb} = ${ta + tb}/${ta * tb} of ${theme.obj} per ${u.replace(/s$/, "")}. ` +
    `The joint time is the reciprocal: ${ta}·${tb} ÷ (${ta} + ${tb}) = ${ta * tb}/${ta + tb} = ${answerText} ${u}.`;

  return {
    id: `rates-together-${ta}-${tb}`,
    prompt,
    answer: exact,
    ...(decimals != null ? { decimals } : {}),
    difficulty: "medium",
    concept: "Combined rates",
    unit: u,
    explanation,
    commonErrors: [
      {
        value: averaged,
        feedback: `You averaged the times ((${ta} + ${tb})/2 = ${averaged}); you must add the RATES, not the times.`,
      },
      {
        value: summed,
        feedback: `You added the times (${ta} + ${tb} = ${summed}); working together is FASTER than either alone, not slower.`,
      },
    ],
    source: "Untimed diagnostic · Combined rates",
    family: RATES_COMBINED_FAMILY,
  };
}

/** The combined-rates floor family as a single-family numeric generator. */
export const combinedRatesFloorGenerator: NumericQuestionGenerator =
  genCombinedRatesTogether;
