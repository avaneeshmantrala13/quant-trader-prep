import type { NumericQuestion, Question } from "@/types/content";
import { formatNumericAnswer } from "@/lib/numeric";
import type { NaturalFrequencyTree } from "./naturalFrequency";
import { MAX_TRIALS, type MonteCarloSpec } from "./monteCarlo";
import { confrontForTag } from "./misconception";
import { containsFinalAnswer } from "./answerWithholding";
import { simLinkFor } from "./hintTopicHelp";
import { planOfAttack } from "./planOfAttack";
import {
  arithmeticSlipCoaching,
  domainPointerCoaching,
  genericFallbackCoaching,
  inferAnswerDomain,
  isArithmeticSlip,
  isDeterministicContext,
  isLogicOrConstructionContext,
  isOutOfDomain,
} from "./errorModes";

/**
 * The answer-WITHHOLDING hint ladder (PHASE_2 §5).
 *
 * On a WRONG primary answer, instead of revealing, we build an ordered ladder of
 * five rungs keyed on the tripped misconception, escalating support while
 * WITHHOLDING the final answer until the last rung:
 *   1. name-trap        — name the specific error (never the answer).
 *   2. representation    — a GUIDED PLAN OF ATTACK: leading questions naming
 *                          WHAT to determine at each step (never the method).
 *   3. worked-sibling    — study the same step on a fresh sibling, then redo.
 *   4. elicit-confront   — simulate/enumerate to confront a durable misconception.
 *   5. reveal            — only now, the full worked solution.
 *
 * Research anchors: Shute 2008 & Van der Kleij et al. 2015 (elaborated,
 * answer-withholding feedback d ≈ 0.49 ≫ right/wrong d ≈ 0.05); Gigerenzer &
 * Hoffrage 1995 (natural frequencies); GAISE 2016 / Fischbein & Schnarch 1997
 * (elicit-then-confront via simulation); VanLehn 2011 (step-based tutoring).
 *
 * INVARIANT: rungs 1–4 satisfy `containsFinalAnswer(text, answer) === false`.
 * Rung 1's authored rationale is sanitised to a generic nudge if it would leak
 * the answer; rungs 2–4 are authored generically; only rung 5 reveals.
 */

export interface HintRung {
  rung: 1 | 2 | 3 | 4 | 5;
  kind:
    | "name-trap"
    | "representation"
    | "worked-sibling"
    | "elicit-confront"
    | "reveal";
  /** Never contains the final answer for rungs 1–4 (asserted in tests). */
  text: string;
  /** Optional structured payload the thin view renders. */
  payload?:
    | NaturalFrequencyTree
    | MonteCarloSpec
    | { siblingPrompt: string };
  /**
   * Optional deep link to the single most relevant Simulations-tab sim
   * (independent of `payload`). Set on rung 4 so the view can render a themed
   * "Open <sim> →" button. Never contains the final answer.
   */
  simLink?: { href: string; title: string; blurb: string };
}

/** A stable non-negative seed derived from a string (for reproducible sims). */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2_000_000_000 || 1;
}

function isQuiz(q: Question | NumericQuestion): q is Question {
  return "choices" in q;
}

/** The final answer used only for the withholding guard (never shown pre-reveal). */
function finalAnswerOf(q: Question | NumericQuestion): number | string {
  return isQuiz(q) ? q.choices[q.correctIndex] : q.answer;
}

/**
 * STRUCTURAL corrective markers: each reliably sits at a CLAUSE EDGE that
 * separates the naming clause (what the learner did) from the corrective
 * directive (what to do instead). Because they are boundaries, the text BEFORE
 * the earliest one is already a complete naming clause.
 */
const STRUCTURAL_MARKERS = [
  " but ",
  " — ",
  " – ",
  "; ",
  " you should",
  " instead",
  " to get",
];

/**
 * OPERATION-word markers: the tail of a corrective directive ("…so divide by
 * k!", "…instead multiply"). These are RISKIER than the structural markers
 * because the same words can appear INSIDE a naming clause ("you divided by 4").
 * We therefore only fall back to them when NO structural marker is present, and
 * when we cut on one we back off to the previous clause boundary so we never
 * ship the half-clause the operation word started.
 */
const OPERATION_MARKERS = [
  " multiply",
  " add (",
  " subtract",
  " divide",
  " use 1",
  "1 − p",
  "1-p",
];

/** Minimum length for the reduced naming clause before we treat it as clipped. */
const MIN_NAMING = 15;

/**
 * Trailing function words that make a fragment read as CUT mid-thought. We strip
 * these (plus any trailing separators) off a reduced clause so it never ends on
 * a dangling connective/preposition/article such as "…keep or", "…the", "…to".
 */
const DANGLING_WORDS = new Set([
  "or", "and", "so", "but", "nor", "yet", "then", "because", "thus", "hence",
  "of", "to", "the", "a", "an", "for", "with", "by", "in", "on", "at", "as",
  "that", "which", "if", "when", "you", "your", "it", "its", "into", "from",
  "than", "per", "via", "not", "no", "should", "must", "do", "does",
]);

/** Clause boundaries used to back off a mid-clause operation-word cut. */
const CLAUSE_BOUNDARIES = [". ", "? ", "! ", "; ", ", ", ": ", " — ", " – "];

/**
 * Verbs that, when they OPEN a sentence, make it an IMPERATIVE corrective
 * directive ("Weight each by its share.", "Multiply the two probabilities.")
 * rather than a naming clause. A trailing run of such sentences is the method
 * "what to do instead" and is dropped so rung 1 stays name-only. (Only a
 * NON-FIRST directive sentence is dropped — a feedback that opens imperatively
 * is left intact so we never return empty.)
 */
const DIRECTIVE_LEAD =
  /^(?:so|then|now|instead|next|first|again|here|note|so,|instead,|then,|now,)?[,\s]*(multiply|divide|subtract|add|weight|re-?weight|compute|normali[sz]e|count|use|condition|rescale|scale|keep|treat|split|factor|reduce|convert|combine|average)\b/i;

/** True iff `s` already ends at a sentence terminator (optionally quoted). */
function endsTerminal(s: string): boolean {
  return /[.?!]["')\]]?\s*$/.test(s);
}

/** Append a period unless `s` is empty or already ends in terminal punctuation. */
function terminate(s: string): string {
  const t = s.trimEnd();
  if (!t) return t;
  return endsTerminal(t) ? t : `${t}.`;
}

/**
 * Strip trailing separators and dangling function words so the clause ends on a
 * content word. Preserves an existing terminal `? ! .` (a coherent authored
 * question/statement is left intact). Only bites when the last *content* token
 * is a bare connective/preposition — the signature of a mid-sentence cut.
 */
function stripDangling(input: string): string {
  let s = input.trimEnd();
  // Keep coherent, already-terminated thoughts as authored.
  if (endsTerminal(s)) return s.replace(/\s+$/, "");
  for (;;) {
    const next = s.replace(/[\s,;:\u2014\u2013-]+$/, "");
    if (next !== s) {
      s = next;
      continue;
    }
    const m = s.match(/([\p{L}\p{N}']+)$/u);
    if (m && DANGLING_WORDS.has(m[1].toLowerCase()) && s.length > m[1].length) {
      s = s.slice(0, s.length - m[1].length);
      continue;
    }
    break;
  }
  return s.trimEnd();
}

/**
 * Back off `head` (everything before an operation-word cut) to the previous
 * clean clause boundary, dropping the half-clause the operation word began. When
 * `head` has no internal boundary it is a single clause — returned as-is (the
 * caller's length guard then decides whether it was a naming-word collision).
 */
function backOffToClauseBoundary(head: string): string {
  let bestEnd = -1;
  for (const bnd of CLAUSE_BOUNDARIES) {
    const idx = head.lastIndexOf(bnd);
    if (idx === -1) continue;
    // Keep sentence terminators (they end a complete thought); drop a trailing
    // comma/semicolon/colon/dash separator.
    const keepEnd = /[.?!]/.test(bnd[0]) ? idx + 1 : idx;
    if (keepEnd > bestEnd) bestEnd = keepEnd;
  }
  return bestEnd === -1 ? head : head.slice(0, bestEnd);
}

/** Earliest index at which any of `markers` occurs in `lower` (or -1). */
function earliestMarker(lower: string, markers: string[]): number {
  let cut = -1;
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1 && (cut === -1 || idx < cut)) cut = idx;
  }
  return cut;
}

/** The feedback's first sentence (up to the first terminal `. ? !`), trimmed. */
function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.?!](?=["')\]]?\s|["')\]]?$)/);
  return (m ? m[0] : text).trim();
}

/**
 * Split into sentences at a terminal `. ? !` that is followed by whitespace/end
 * (so decimals like `10.0000` and `1/256).` mid-token dots don't split). Each
 * returned chunk keeps its own terminator and trailing space.
 */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[.?!]["')\]]?(?=\s|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    out.push(text.slice(last, end));
    last = end;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.filter((s) => s.trim().length > 0);
}

/**
 * Drop a TRAILING run of imperative corrective-directive sentences ("… Weight
 * each by its share."), keeping the naming sentence(s) before them. Only strips
 * a NON-FIRST directive sentence and only when the kept naming portion is still
 * substantial, so we never return an empty or bare result.
 */
function stripDirectiveSentences(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) return text;
  let cutIdx = -1;
  for (let i = 1; i < sentences.length; i++) {
    if (DIRECTIVE_LEAD.test(sentences[i].trim())) {
      cutIdx = i;
      break;
    }
  }
  if (cutIdx === -1) return text;
  const kept = sentences.slice(0, cutIdx).join("").trim();
  return namingLength(kept) >= MIN_NAMING ? kept : text;
}

/** Length of `s` ignoring any trailing terminal punctuation (for the guard). */
function namingLength(s: string): number {
  return s.replace(/[.?!"')\]]+\s*$/, "").trim().length;
}

/**
 * Reduce ANY matched rung-1 `feedback` to its NAME-ONLY clause: keep the part
 * that names the mistake and drop the trailing corrective directive (the "but
 * you should multiply", "instead …", "…so divide by k!" tail) so rung 1 never
 * reveals the method — while GUARANTEEING the result is a coherent, complete
 * thought (never a mid-sentence fragment). Central safety net for families whose
 * inline feedback we don't edit.
 *
 * Algorithm (pure, deterministic):
 *  1. Drop any TRAILING imperative-directive sentence(s) ("… Weight each by its
 *     share.") so a method stated as its own sentence never survives.
 *  2. Prefer the earliest STRUCTURAL marker (a clause edge): the text before it
 *     is already a complete naming clause. Fall back to an OPERATION-word marker
 *     only when no structural one exists — and then back off to the previous
 *     clause boundary, dropping the half-clause the operation word began, so we
 *     never keep a fragment like "…so should you keep or".
 *  3. Strip trailing separators / dangling connectives and TERMINATE with proper
 *     punctuation (add a period when the clause doesn't already end in `. ? !`).
 *  4. If the cut left too little (the marker sat INSIDE the naming clause), fall
 *     back to the first full sentence so we still name the mistake.
 *  5. When NO corrective marker is present the remaining text is all naming —
 *     returned as authored, only trimmed and terminated (coherent questions are
 *     kept, e.g. "… what total must you normalise by?").
 *
 * Guarantees for any non-empty input: never empty; ends in terminal punctuation;
 * never ends on a dangling conjunction/preposition; never a bare (<15-char)
 * fragment when the source has any nameable clause; never keeps a stand-alone
 * corrective-directive sentence.
 */
export function nameOnlyCoaching(feedback: string): string {
  if (!feedback) return feedback;
  const text = stripDirectiveSentences(feedback.trim());
  if (!text) return feedback;
  const lower = text.toLowerCase();

  const structuralCut = earliestMarker(lower, STRUCTURAL_MARKERS);
  let candidate: string;
  if (structuralCut !== -1) {
    candidate = text.slice(0, structuralCut);
  } else {
    const opCut = earliestMarker(lower, OPERATION_MARKERS);
    if (opCut === -1) {
      // No corrective directive at all — the whole feedback names the mistake.
      return terminate(stripDangling(text)) || text;
    }
    candidate = backOffToClauseBoundary(text.slice(0, opCut));
  }

  let cleaned = terminate(stripDangling(candidate));

  if (namingLength(cleaned) < MIN_NAMING) {
    // The marker clipped the naming clause itself (e.g. a naming verb that
    // happens to be an operation word). Keep the first full sentence instead.
    const first = firstSentence(text);
    cleaned =
      namingLength(first) >= MIN_NAMING
        ? terminate(stripDangling(first))
        : terminate(stripDangling(text));
  }

  return cleaned || text;
}

/**
 * The rung-4 generic elicitation shown when NO sim confidently fits. A
 * probability confront ("run trials, count how often the event happens") is a
 * category error for a DETERMINISTIC arithmetic / logic / construction / number-
 * theory / sequence item — there is no random "event" to sample. For those we
 * ask the learner to re-derive on a concrete, checkable instance instead.
 */
const DETERMINISTIC_ELICITATION =
  "Re-derive the result from scratch on a smaller, concrete version of this " +
  "problem that you can check by hand: work through each step in order, write " +
  "down every intermediate value as you go, and see whether the reasoning that " +
  "produced your answer actually holds up end to end.";

const PROBABILISTIC_ELICITATION =
  "Re-create this situation from scratch and let the data settle it: " +
  "enumerate the full set of equally-likely outcomes (or run many quick trials), " +
  "then count how often the event actually happens and compare that empirical " +
  "frequency against the answer you reported.";

/** Pick the rung-4 generic elicitation that fits the item's domain. */
function genericRung4Elicitation(ctx: {
  section?: string;
  family?: string;
}): string {
  return isDeterministicContext(ctx)
    ? DETERMINISTIC_ELICITATION
    : PROBABILISTIC_ELICITATION;
}

/** Tolerance used when detecting/redacting a leaked answer token in feedback. */
const ANSWER_LEAK_TOL = 1e-9;

/** Parse a formatted answer string to a number, or `null` (mirrors the guard). */
function answerToNumber(answer: number | string): number | null {
  if (typeof answer === "number") return Number.isFinite(answer) ? answer : null;
  const trimmed = answer.trim();
  const frac = /^(-?\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (frac) {
    const denom = Number(frac[2]);
    return denom === 0 ? null : Number(frac[1]) / denom;
  }
  const isPercent = /%\s*$/.test(trimmed);
  const cleaned = trimmed.replace(/[$,%\s]/g, "");
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return isPercent ? n / 100 : n;
}

/** Tidy up the artefacts left behind after answer tokens are excised. */
function cleanupRedaction(input: string): string {
  return (
    input
      // A "= ", "≈ ", "→ ", ": " that now precedes nothing meaningful.
      .replace(/[=≈→:]\s*(?=[\s.,;)]|$)/g, " ")
      // An orphaned lead-in word left dangling before punctuation/end.
      .replace(/\b(?:is|are|was|equals?|gives?|of|to|by|=)\s*(?=[.,;)]|$)/gi, " ")
      // "not <removed>" left dangling.
      .replace(/\bnot\s*(?=[.,;)]|$)/gi, " ")
      // Empty parentheses left by a removed token.
      .replace(/\(\s*\)/g, " ")
      // Doubled or orphaned separators.
      .replace(/,\s*(?=[.,;)])/g, "")
      .replace(/\s+([.,;:!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/**
 * Remove every token in `text` whose numeric value equals `answer` (within a
 * tiny tolerance) — a fraction `a/b`, a plain/`$`/`%` number — plus the small
 * connective artefacts that removal leaves behind. For a non-numeric decision
 * answer, strip the answer PHRASE. Used to sanitise a matched rung-1 feedback
 * that quotes the correct value to contrast against, so we can keep the naming
 * clause instead of discarding the whole diagnosis.
 */
function redactAnswerTokens(text: string, answer: number | string): string {
  const answerNum = answerToNumber(answer);
  let out = text;
  if (answerNum !== null) {
    // Fractions first (so "1/2" is treated as 0.5, not the integers 1 and 2).
    out = out.replace(/\d+\s*\/\s*\d+/g, (m) => {
      const [a, b] = m.split("/").map((s) => Number(s.trim()));
      if (!b) return m;
      return Math.abs(a / b - answerNum) <= ANSWER_LEAK_TOL ? " " : m;
    });
    // Plain / currency / percent numbers.
    out = out.replace(/-?\$?\s*\d[\d,]*(?:\.\d+)?\s*%?/g, (m) => {
      const isPercent = /%\s*$/.test(m);
      const cleaned = m.replace(/[$,%\s]/g, "");
      if (cleaned === "" || cleaned === "-") return m;
      let v = Number(cleaned);
      if (!Number.isFinite(v)) return m;
      if (isPercent) v = v / 100;
      return Math.abs(v - answerNum) <= ANSWER_LEAK_TOL ? " " : m;
    });
  } else {
    const needle = String(answer).trim();
    if (needle) {
      const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(esc, "gi"), " ");
    }
  }
  return cleanupRedaction(out);
}

/**
 * Turn a matched rung-1 `feedback` into a NAME-ONLY, answer-free coaching line.
 *
 * Prefers the plain `nameOnlyCoaching` trim. When that would still LEAK the
 * final answer (a distractor/common-error feedback frequently quotes the correct
 * value to contrast against — "…so it's 1·3, not 1·2", "…= E[T]/a = 1/2",
 * "…= 6"), we do NOT silently fall back to the content-free generic nudge
 * (which self-defeatingly denies the mistake exists). Instead we REDACT the
 * leaked answer token(s) and re-trim, keeping the specific naming clause. Only
 * when nothing nameable survives (too short, or still leaking) do we return `""`
 * so the caller uses the honest generic fallback.
 *
 * Guarantees: the result is either `""` or a coherent, terminated clause of at
 * least `MIN_NAMING` chars that passes `containsFinalAnswer(_, answer)`.
 */
export function nameTrapWithoutAnswer(
  feedback: string,
  answer: number | string,
): string {
  if (!feedback) return "";
  const base = nameOnlyCoaching(feedback);
  if (!base) return "";
  if (!containsFinalAnswer(base, answer, ANSWER_LEAK_TOL)) return base;

  // The naming trim still leaks the answer → redact the leaked token(s) and
  // re-trim, preserving the naming clause (build on nameOnlyCoaching). Redaction
  // can leave a trailing connective ("…added the two and.") right before the
  // terminator that `stripDangling` skips because the string already ends
  // terminal, so force one more dangling-strip pass on the result.
  const trimmed = nameOnlyCoaching(redactAnswerTokens(feedback, answer));
  const redacted = terminate(
    stripDangling(trimmed.replace(/[.?!"')\]]+\s*$/, "")),
  );
  if (
    redacted &&
    namingLength(redacted) >= MIN_NAMING &&
    !containsFinalAnswer(redacted, answer, ANSWER_LEAK_TOL)
  ) {
    return redacted;
  }
  return "";
}

/**
 * Build the ordered 5-rung ladder for a wrong attempt, keyed on the tripped
 * misconception `misconceptionTag` (resolved by the caller via the Phase-2
 * `misconception` helpers). Always returns exactly 5 rungs in order 1..5.
 */
export function buildHintLadder(args: {
  question: Question | NumericQuestion;
  chosenIndex?: number;
  chosenValue?: number;
  misconceptionTag?: string;
  /** `Level.section` topic, threaded from the caller for topic-aware hints. */
  section?: string;
}): HintRung[] {
  const { question, chosenIndex, chosenValue, misconceptionTag, section } = args;
  const family = question.family;
  const answer = finalAnswerOf(question);
  const confront = confrontForTag(misconceptionTag);

  /* -- Rung 1: name the trap (name-ONLY; never the method or the answer) ----- */
  // Prioritised behaviour (numeric free-response): (1) an out-of-domain value
  // gets a basic sanity-check pointer; (2) a matched misconception is reduced to
  // its NAME-ONLY clause; (3) a close-but-not-exact value gets an arithmetic-slip
  // nudge; (4) otherwise the method-free generic nudge. Quiz items keep the
  // distractor rationale, also passed through `nameOnlyCoaching`.
  let rung1Text = "";
  if (isQuiz(question) && chosenIndex != null) {
    rung1Text = nameTrapWithoutAnswer(
      question.distractorRationale?.[chosenIndex] ?? "",
      answer,
    );
  } else if (!isQuiz(question) && chosenValue != null) {
    const matched = question.commonErrors?.find((e) =>
      question.decimals == null
        ? e.value === chosenValue
        : Math.round(e.value * 10 ** question.decimals) ===
          Math.round(chosenValue * 10 ** question.decimals),
    );
    if (typeof answer === "number") {
      const domain = inferAnswerDomain({
        section,
        family,
        unit: question.unit,
        decimals: question.decimals,
        answer,
      });
      if (isOutOfDomain(chosenValue, domain)) {
        rung1Text = domainPointerCoaching(domain);
      } else if (matched) {
        // Sanitise (redact any leaked answer) rather than DROP to generic when
        // the matched feedback quotes the correct value to contrast against.
        rung1Text = nameTrapWithoutAnswer(matched.feedback, answer);
      } else if (
        isArithmeticSlip(chosenValue, answer) &&
        // Gate the "your logic is spot on — just re-check the arithmetic" nudge
        // to genuine numeric-arithmetic contexts: it's misleading on logic /
        // construction / conceptual puzzles where the error isn't a slipped digit.
        // `concept` is threaded so STATIC pooled derivation items (order
        // statistics, optimal stopping) — which carry no section/family — are
        // still recognised and don't get the misleading "logic is spot on" nudge.
        !isLogicOrConstructionContext({
          section,
          family,
          concept: question.concept,
        })
      ) {
        rung1Text = arithmeticSlipCoaching();
      } else {
        rung1Text = genericFallbackCoaching({ section, family });
      }
    } else if (matched) {
      rung1Text = nameTrapWithoutAnswer(matched.feedback, answer);
    }
  }
  if (!rung1Text || containsFinalAnswer(rung1Text, answer)) {
    rung1Text = genericFallbackCoaching({ section, family });
  }

  /* -- Rung 2: GUIDED PLAN OF ATTACK (leading questions, never the method) --- */
  // Bridges rung 1 (names the mistake) → rung 3 (worked walkthrough). It names
  // WHAT to determine at each step without stating the operation/rule/answer,
  // and deliberately holds NO visualization (that is rung 4's simulation).
  const rung2: HintRung = {
    rung: 2,
    kind: "representation",
    text: planOfAttack({ section, family, misconceptionTag }),
  };

  /* -- Rung 3: worked sibling (completion) ---------------------------------- */
  const rung3: HintRung = {
    rung: 3,
    kind: "worked-sibling",
    text: "Here's the SAME kind of problem with different numbers, worked one step at a time. Study the step you slipped on, then come back and redo yours.",
    payload: {
      siblingPrompt:
        "A fresh same-family instance is worked below; mirror its critical step on your own item.",
    },
  };

  /* -- Rung 4: elicit-then-confront (open the exact sim) --------------------- */
  // Resolve the single most relevant Simulations-tab sim for this item and
  // point at it by name. The inline coin/dice ConfrontSim payload is retained
  // (so the deterministic confront still renders) — the deep link is additive.
  // When NO sim is a confident match, `simLinkFor` returns null and we fall back
  // to an answer-free generic elicitation rather than misdirecting the learner
  // to an unrelated sim (the old code silently pointed everything at coin-flips).
  const sim = simLinkFor({ section, family, misconceptionTag });
  const rung4Base: HintRung = sim
    ? {
        rung: 4,
        kind: "elicit-confront",
        text: `Open the Simulations tab → “${sim.title}” and ${sim.blurb}`,
        simLink: { href: sim.href, title: sim.title, blurb: sim.blurb },
      }
    : {
        rung: 4,
        kind: "elicit-confront",
        text: genericRung4Elicitation({ section, family }),
      };
  let rung4: HintRung;
  if (confront === "coin-sim") {
    rung4 = {
      ...rung4Base,
      payload: {
        kind: "coin",
        trials: MAX_TRIALS,
        seed: hashSeed(question.id + ":coin"),
        params: { pHeads: 0.5 },
      },
    };
  } else if (confront === "dice-sim") {
    rung4 = {
      ...rung4Base,
      payload: {
        kind: "dice",
        trials: MAX_TRIALS,
        seed: hashSeed(question.id + ":dice"),
        params: { sides: 6, face: 6 },
      },
    };
  } else {
    // nested-set + generic: the named-sim deep link is the whole confront.
    rung4 = rung4Base;
  }

  /* -- Rung 5: reveal (the only rung allowed to contain the answer) ---------- */
  const rung5: HintRung = {
    rung: 5,
    kind: "reveal",
    text: question.explanation,
  };

  return [
    { rung: 1, kind: "name-trap", text: rung1Text },
    rung2,
    rung3,
    rung4,
    rung5,
  ];
}

/** Convenience for views/tests: the numeric answer string for a numeric item. */
export function numericAnswerText(q: NumericQuestion): string {
  return `${q.unit ?? "$"}${formatNumericAnswer(q)}`;
}
