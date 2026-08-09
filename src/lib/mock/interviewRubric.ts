/**
 * mock/interviewRubric.ts — the "SENIOR QUANT INTERVIEWER" rubric reviewer.
 *
 * This is the LLM half of the interview-grade acceptance gate. Where
 * `interviewGate.ts` is a deterministic STRUCTURAL check, this module models an
 * adversarial senior interviewer who rates each generated item + its follow-ups
 * as INTERVIEW-GRADE or not, flagging the exact failure modes the user called
 * out: trivial/easy openers, follow-ups that merely decompose the base, and
 * back-to-back duplicate topics.
 *
 * MOCKABILITY (so committed unit tests stay deterministic): the LLM is injected
 * as a plain `RubricLlm` function (`prompt → Promise<string>` returning JSON).
 * Tests pass a canned mock; the offline sampler passes a real client OR falls
 * back to `reviewItemHeuristic`, a deterministic reviewer that reuses the
 * structural predicates so metrics can be produced with NO network at all.
 *
 * PURE: no React, DOM, storage, or direct network. The only I/O is the injected
 * `RubricLlm` (which the caller owns).
 */
import type {
  FollowupType,
  MathStep,
  MockScript,
  MockStep,
  PoolDifficultyLike,
  TopicFamily,
} from "./types";
import {
  belowFloorReason,
  decompositionReason,
  difficultyRank,
  familyOfStep,
  missingTypeReason,
  MIN_ITEM_DIFFICULTY_RANK,
} from "./interviewGate";

/* -------------------------------------------------------------------------- */
/*  The reviewable item shape                                                 */
/* -------------------------------------------------------------------------- */

/** One follow-up as the reviewer sees it. */
export interface RubricFollowup {
  role: string;
  prompt: string;
  type?: FollowupType;
  difficulty?: PoolDifficultyLike | string;
  answerKind?: "numeric" | "reasoning";
  answer?: number;
}

/** One scored item (base question + its follow-ups) submitted for review. */
export interface RubricItem {
  id: string;
  family: TopicFamily | null;
  difficulty?: PoolDifficultyLike | string;
  prompt: string;
  baseAnswer: number;
  baseIntermediates?: number[];
  followups: RubricFollowup[];
  /** The family of the item IMMEDIATELY BEFORE this one (for duplicate-topic). */
  prevFamily?: TopicFamily | null;
}

/** The distinct failure modes the reviewer can raise. */
export type RubricFlag =
  | "trivial-base"
  | "easy-base"
  | "decomposition-followup"
  | "easy-followup"
  | "untyped-followup"
  | "shallow-followup"
  | "duplicate-topic";

export interface RubricVerdict {
  id: string;
  /** true ⇒ this item + follow-ups would survive a real screen. */
  interviewGrade: boolean;
  flags: RubricFlag[];
  /** Human-readable justification (from the LLM, or the heuristic). */
  notes: string;
}

/* -------------------------------------------------------------------------- */
/*  Extracting reviewable items from a built script                          */
/* -------------------------------------------------------------------------- */

/** Turn a built interview script into the scored items a reviewer rates. */
export function rubricItemsFromScript(script: MockScript): RubricItem[] {
  const out: RubricItem[] = [];
  let prevFamily: TopicFamily | null = null;
  for (const step of script.steps) {
    const fam = familyOfStep(step as MockStep);
    if (fam === null) continue; // behavioral — unscored
    if (step.kind === "math" && step.qtype !== "mental-math") {
      out.push(rubricItemFromMathStep(step, prevFamily));
    }
    prevFamily = fam;
  }
  return out;
}

function rubricItemFromMathStep(
  step: MathStep,
  prevFamily: TopicFamily | null,
): RubricItem {
  const followups: RubricFollowup[] = [];
  const push = (
    fu:
      | {
          prompt: string;
          type?: FollowupType;
          difficulty?: PoolDifficultyLike;
          answerKind?: "numeric" | "reasoning";
          answer?: number;
        }
      | undefined,
    role: string,
  ) => {
    if (!fu) return;
    followups.push({
      role,
      prompt: fu.prompt,
      type: fu.type,
      difficulty: fu.difficulty,
      answerKind: fu.answerKind,
      answer: fu.answer,
    });
  };
  push(step.authoredProbe, "probe");
  push(step.authoredAdversarial, "adversarial");
  return {
    id: step.id,
    family: step.family ?? null,
    // The generator's intrinsic difficulty (falls back to the slot label) so a
    // `hard` item in a `stretch` pacing slot isn't judged against `stretch`.
    difficulty: step.baseDifficulty ?? step.difficulty,
    prompt: step.prompt,
    baseAnswer: step.answer,
    baseIntermediates: step.baseIntermediates,
    followups,
    prevFamily,
  };
}

/* -------------------------------------------------------------------------- */
/*  Deterministic HEURISTIC reviewer (offline; no network)                   */
/* -------------------------------------------------------------------------- */

/**
 * Trivial-base tells the reviewer flags even before difficulty: a base whose
 * prompt reads like a freshman drill ("make a market on 12 x 14", a bare small
 * product, "the average is …, find the missing number"). Mirrors the purge
 * blocklist so the LLM and the structural gate agree.
 */
const TRIVIAL_BASE_PHRASES: RegExp[] = [
  /make (me )?a market on\s*\d{1,2}\s*[x*×]\s*\d{1,2}\b/i,
  /missing number/i,
  /\bfind the average\b/i,
  /what is\s*\d{1,2}\s*[x*×]\s*\d{1,2}\s*\??$/i,
];

/**
 * A deterministic stand-in for the senior interviewer. It reuses the structural
 * predicates (decomposition, difficulty floor, taxonomy) and adds a couple of
 * "would a real interviewer bother?" heuristics (trivial phrasing, base
 * difficulty floor, duplicate adjacent topic). Same input ⇒ same verdict, so
 * the sampler produces reproducible metrics with no LLM configured.
 */
export function reviewItemHeuristic(item: RubricItem): RubricVerdict {
  const flags = new Set<RubricFlag>();
  const notes: string[] = [];

  for (const re of TRIVIAL_BASE_PHRASES) {
    if (re.test(item.prompt)) {
      flags.add("trivial-base");
      notes.push(`base reads as a trivial drill (${re})`);
      break;
    }
  }

  if (difficultyRank(item.difficulty) < MIN_ITEM_DIFFICULTY_RANK) {
    flags.add("easy-base");
    notes.push(`base difficulty "${item.difficulty}" is below the hard floor`);
  }

  if (item.prevFamily && item.family && item.prevFamily === item.family) {
    flags.add("duplicate-topic");
    notes.push(`same topic-family "${item.family}" as the previous item`);
  }

  const base = {
    answer: item.baseAnswer,
    difficulty: item.difficulty,
    baseIntermediates: item.baseIntermediates,
  };
  for (const fu of item.followups) {
    const like = {
      prompt: fu.prompt,
      answerKind: fu.answerKind,
      answer: fu.answer,
      type: fu.type,
      difficulty: fu.difficulty,
    };
    if (decompositionReason(base, like)) {
      flags.add("decomposition-followup");
      notes.push(`${fu.role}: ${decompositionReason(base, like)}`);
    }
    if (belowFloorReason(base, like)) {
      flags.add("easy-followup");
      notes.push(`${fu.role}: ${belowFloorReason(base, like)}`);
    }
    if (missingTypeReason(like)) {
      flags.add("untyped-followup");
      notes.push(`${fu.role}: ${missingTypeReason(like)}`);
    }
  }

  if (item.followups.length < 2) {
    flags.add("shallow-followup");
    notes.push(`only ${item.followups.length} follow-up(s); expected ≥ 2`);
  }

  return {
    id: item.id,
    interviewGrade: flags.size === 0,
    flags: [...flags],
    notes: notes.join("; ") || "interview-grade",
  };
}

/* -------------------------------------------------------------------------- */
/*  LLM reviewer (mockable)                                                   */
/* -------------------------------------------------------------------------- */

/** The injected LLM: a prompt in, a JSON verdict string out. */
export type RubricLlm = (prompt: string) => Promise<string>;

export const RUBRIC_SYSTEM_PREAMBLE =
  "You are a SENIOR QUANT TRADER conducting a live interview screen at a top " +
  "prop shop (Optiver, Jane Street, SIG, Citadel, IMC, DRW, HRT). You are " +
  "adversarial and impatient. You must reject anything a real screen would " +
  "never ask. Rate the item below and its follow-ups.";

/** Build the reviewer prompt for one item (deterministic given the item). */
export function buildRubricPrompt(item: RubricItem): string {
  const fus = item.followups
    .map(
      (f, i) =>
        `  ${i + 1}. [${f.role}] type=${f.type ?? "MISSING"} ` +
        `difficulty=${f.difficulty ?? "(=base)"} ` +
        `${f.answerKind === "reasoning" ? "(reasoning)" : `answer=${f.answer}`}\n` +
        `     "${f.prompt}"`,
    )
    .join("\n");
  return [
    RUBRIC_SYSTEM_PREAMBLE,
    "",
    "Reject (interviewGrade=false) and add the matching flag if ANY of:",
    "  - trivial-base: the base is a freshman drill (bare small product, " +
      "make-a-market on a tiny integer product, missing-number-from-average).",
    "  - easy-base: the base is easier than a conditional-probability urn or a " +
      "lattice-path intersection (the gold anchors).",
    "  - decomposition-followup: a follow-up asks for a sub-step already " +
      "computed in the base (a numerator, a sub-count, an intermediate).",
    "  - easy-followup: a follow-up is easier than the base.",
    "  - untyped-followup: a follow-up is not one of generalize-n / invert / " +
      "add-constraint / change-regime / adversarial-trap / act-on-it.",
    "  - shallow-followup: fewer than two genuine curveball follow-ups.",
    "  - duplicate-topic: this item repeats the previous item's topic-family.",
    "",
    `PREVIOUS TOPIC-FAMILY: ${item.prevFamily ?? "(none)"}`,
    `THIS ITEM  id=${item.id}  family=${item.family ?? "?"}  ` +
      `difficulty=${item.difficulty ?? "?"}`,
    `BASE PROMPT: "${item.prompt}"`,
    `BASE ANSWER: ${item.baseAnswer}`,
    `BASE INTERMEDIATES (already computed — a follow-up must NOT re-ask these): ` +
      `${JSON.stringify(item.baseIntermediates ?? [])}`,
    "FOLLOW-UPS:",
    fus || "  (none)",
    "",
    'Respond with ONLY JSON: {"interviewGrade": boolean, "flags": string[], ' +
      '"notes": string}. flags must be a subset of the flag names above.',
  ].join("\n");
}

const ALL_FLAGS: ReadonlySet<string> = new Set<RubricFlag>([
  "trivial-base",
  "easy-base",
  "decomposition-followup",
  "easy-followup",
  "untyped-followup",
  "shallow-followup",
  "duplicate-topic",
]);

/** Parse an LLM JSON response into a verdict, tolerating fenced/greedy text. */
export function parseRubricResponse(raw: string, id: string): RubricVerdict {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      id,
      interviewGrade: false,
      flags: [],
      notes: `unparseable reviewer response: ${raw.slice(0, 120)}`,
    };
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const flags = Array.isArray(obj.flags)
    ? (obj.flags.filter(
        (f): f is RubricFlag => typeof f === "string" && ALL_FLAGS.has(f),
      ) as RubricFlag[])
    : [];
  const interviewGrade =
    typeof obj.interviewGrade === "boolean"
      ? obj.interviewGrade
      : flags.length === 0;
  return {
    id,
    interviewGrade,
    flags,
    notes: typeof obj.notes === "string" ? obj.notes : "",
  };
}

/** Review ONE item via the injected LLM (mock or real). */
export async function reviewItemWithLlm(
  item: RubricItem,
  llm: RubricLlm,
): Promise<RubricVerdict> {
  const raw = await llm(buildRubricPrompt(item));
  return parseRubricResponse(raw, item.id);
}

/**
 * Review one item: uses the injected LLM when provided, else the deterministic
 * heuristic. Async so both paths share one call site.
 */
export async function reviewItem(
  item: RubricItem,
  llm?: RubricLlm | null,
): Promise<RubricVerdict> {
  return llm ? reviewItemWithLlm(item, llm) : reviewItemHeuristic(item);
}

/** Review every scored item in a built script. */
export async function reviewScript(
  script: MockScript,
  llm?: RubricLlm | null,
): Promise<RubricVerdict[]> {
  const items = rubricItemsFromScript(script);
  const out: RubricVerdict[] = [];
  for (const item of items) out.push(await reviewItem(item, llm));
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Metrics                                                                   */
/* -------------------------------------------------------------------------- */

export interface RubricSummary {
  total: number;
  interviewGrade: number;
  rejected: number;
  passRate: number;
  flagCounts: Record<string, number>;
}

/** Aggregate a batch of verdicts into a metrics summary. */
export function summarizeVerdicts(verdicts: RubricVerdict[]): RubricSummary {
  const flagCounts: Record<string, number> = {};
  let pass = 0;
  for (const v of verdicts) {
    if (v.interviewGrade) pass += 1;
    for (const f of v.flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
  }
  return {
    total: verdicts.length,
    interviewGrade: pass,
    rejected: verdicts.length - pass,
    passRate: verdicts.length ? pass / verdicts.length : 1,
    flagCounts,
  };
}
