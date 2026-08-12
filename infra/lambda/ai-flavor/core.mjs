/**
 * quant-trader-prep — SHARED AI core (provider-agnostic, transport-agnostic).
 *
 * This module is the ONE source of truth for every AI "mode": the prompt
 * builders, the server-side numeric guardrails, the defensive JSON coercers, the
 * OpenAI/Anthropic provider calls, and the mode ROUTER. It is imported by BOTH:
 *
 *   • the deployed AWS Lambda (`index.mjs`) — which adds SSM key retrieval, the
 *     Cognito authorizer context, the DynamoDB daily quota, and the API-Gateway
 *     event/response envelope; and
 *   • the LOCAL dev server (`scripts/ai-dev-server.mjs`) — which reads the key
 *     from a NON-`VITE_` env var (so it never reaches the browser bundle), skips
 *     auth/quota, and serves `POST /ai` for the Vite origin.
 *
 * Keeping the logic here guarantees localhost === prod behavior (DRY): the same
 * prompts, the same guardrails, the same contract JSON in both environments.
 *
 * SECURITY: this file never reads a key from the environment and never logs one.
 * The caller passes an already-bound `callLLM` (created via `makeLlmCaller`), so
 * the key lives only in the caller's scope. Nothing here is `VITE_*`.
 *
 * Runtime: pure ESM, uses only global `fetch` — no npm deps, no AWS SDK — so the
 * Lambda still needs zero packaging and the local server needs zero installs.
 */

/* ----------------------------- numeric guardrail -------------------------- */
// Mirror of the client's `extractNumbers` / `verifyFlavor` (defense in depth).
export function extractNumbers(text) {
  const out = [];
  const re = /\$?\s?(\d[\d,]*(?:\.\d+)?)\s?%?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(String(n));
  }
  return out;
}
export function verifyFlavor(original, candidate, requiredNumbers) {
  if (!candidate || !candidate.trim()) return { ok: false, reason: "empty" };
  const required = new Set(
    requiredNumbers && requiredNumbers.length
      ? requiredNumbers.map(String)
      : extractNumbers(original),
  );
  const cand = new Set(extractNumbers(candidate));
  for (const n of required) if (!cand.has(n)) return { ok: false, reason: "missing" };
  for (const n of cand) if (!required.has(n)) return { ok: false, reason: "introduced" };
  return { ok: true };
}

/* ------------------- no-final-answer guard (Phase 7, hint) ---------------- */
// Server-side mirror of the client's Phase-2 `containsFinalAnswer` (defense in
// depth): the hint-phrasing branch MUST refuse any rephrase that states the
// final answer, whether written as a plain number, `$1,000` currency, `12%`
// percentage, or `a/b` fraction. Deterministic; the LLM never decides this.
export function extractAnswerNumbers(text) {
  const out = [];
  const fracRe = /(\d+)\s*\/\s*(\d+)/g;
  const consumed = [];
  let m;
  while ((m = fracRe.exec(text)) !== null) {
    const denom = Number(m[2]);
    if (denom !== 0) out.push(Number(m[1]) / denom);
    consumed.push([m.index, m.index + m[0].length]);
  }
  const numRe = /-?\$?\s*\d[\d,]*(?:\.\d+)?\s*%?/g;
  while ((m = numRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (consumed.some(([s, e]) => start < e && end > s)) continue;
    const isPercent = /%\s*$/.test(m[0]);
    const cleaned = m[0].replace(/[$,%\s]/g, "");
    if (cleaned === "" || cleaned === "-") continue;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) continue;
    out.push(isPercent ? n / 100 : n);
  }
  return out;
}
export function answerToNumber(value) {
  const trimmed = String(value).trim();
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
export function containsFinalAnswer(text, answer, tolerance = 0) {
  if (!text) return false;
  const answerNum = typeof answer === "number" ? answer : answerToNumber(answer);
  if (answerNum !== null && Number.isFinite(answerNum)) {
    const nums = extractAnswerNumbers(text);
    if (nums.some((n) => Math.abs(n - answerNum) <= tolerance)) return true;
    if (typeof answer !== "string") return false;
  }
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
  const needle = norm(answer);
  if (needle.length === 0) return false;
  return norm(text).includes(needle);
}
// The hint guardrail: preserve context numbers (no new numbers) AND never state
// the answer. On failure the client keeps the ORIGINAL deterministic rung.
export function verifyHint(originalRung, candidate, answer, requiredNumbers) {
  const base = verifyFlavor(originalRung, candidate, requiredNumbers);
  if (!base.ok) return base;
  if (containsFinalAnswer(candidate, answer)) {
    return { ok: false, reason: "leaks-answer" };
  }
  return { ok: true };
}

/* --------------------------------- prompts -------------------------------- */
export function flavorMessages(body) {
  const sys =
    "You reskin quantitative-finance practice questions. You are given a question. " +
    "Rewrite ONLY the surface narrative/scenario (make it a vivid quant/trading story). " +
    "You MUST keep EVERY number, quantity, and answer choice EXACTLY as given — do not add, " +
    "remove, round, or change any number. Do not solve the question. Do not add new numbers " +
    "(no times, dates, prices, or counts that weren't already present). Keep the same question " +
    "being asked. Reply with ONLY the rewritten question text, no preamble.";
  const nums = (body.requiredNumbers || []).join(", ");
  const user =
    `Question:\n${body.prompt}\n\n` +
    (body.concept ? `Concept: ${body.concept}\n` : "") +
    (nums ? `Numbers that MUST appear unchanged: ${nums}\n` : "") +
    (body.choices ? `Answer choices (do not alter): ${JSON.stringify(body.choices)}\n` : "") +
    "\nRewrite the narrative now:";
  return { sys, user };
}
export function openEndedMessages(body) {
  const sys =
    "You are a quant-interview question writer. Propose ONE original practice question for the " +
    "given topic. Keep the math self-contained and unambiguous. Respond as strict JSON with keys " +
    '"prompt" (the question), "answer" (the concise final answer), and "explanation" (the full ' +
    "worked reasoning). No markdown, no extra keys.";
  const user = `Topic: ${body.topic}\nReturn the JSON now:`;
  return { sys, user };
}

/**
 * HINT mode (Phase 7): rephrase ONE deterministic hint rung's wording. The model
 * must NOT choose the hint, add/remove/change any number, or state the final
 * answer. The server re-guards the output; a violation → client keeps the rung.
 */
export function hintMessages(body) {
  const sys =
    "You are a warm, concise quant tutor rewording a SINGLE coaching hint. Rewrite ONLY the " +
    "wording of the hint below for clarity and encouragement. You MUST NOT reveal, state, or " +
    "compute the final answer. You MUST keep EVERY number exactly as given and introduce NO new " +
    "numbers. Keep it to one or two short sentences that nudge the learner's thinking WITHOUT " +
    "giving the solution. Reply with ONLY the rephrased hint text, no preamble.";
  const nums = (body.requiredNumbers || []).join(", ");
  const user =
    `Hint to reword:\n${body.rung}\n\n` +
    (nums ? `Numbers that MUST appear unchanged: ${nums}\n` : "") +
    "Do NOT state the final answer. Reword the hint now:";
  return { sys, user };
}

/**
 * PARSE-DRILL-INTENT mode (Custom Drill Builder): map a free-text practice
 * request onto the app's KNOWN drill vocabulary. "LLM proposes, code verifies":
 * the model may ONLY choose `topicKey`s from the provided vocabulary and a
 * difficulty window / count; the client then snaps the proposal back onto that
 * same vocabulary (drops unknown keys, clamps orders + count) before it is ever
 * used. The model never invents a section, a question, or an answer.
 */
export function parseDrillIntentMessages(body) {
  const vocab = Array.isArray(body.vocabulary) ? body.vocabulary : [];
  const orders = body.difficultyOrders || {};
  const band = body.countBand || { min: 5, max: 25 };
  const sys =
    "You translate a learner's free-text practice request into a strict JSON drill spec. " +
    "You may ONLY select topics from the provided vocabulary, choosing each by its exact " +
    '"topicKey" string. Respond with strict JSON having keys: "topicKeys" (array of the chosen ' +
    'topicKey strings, most relevant first), "minOrder" and "maxOrder" (integers giving the ' +
    "inclusive difficulty window using the provided difficulty order scale), and \"count\" (integer " +
    "number of questions requested). If the learner names no difficulty, span the full range. If " +
    "they name no count, use 10. Never invent a topicKey that is not in the vocabulary. Return no " +
    "markdown and no extra keys.";
  const user =
    `Learner request:\n${body.text || ""}\n\n` +
    `Vocabulary (choose topicKeys ONLY from these):\n${JSON.stringify(vocab)}\n\n` +
    `Difficulty order scale: ${JSON.stringify(orders)}\n` +
    `Count must be between ${band.min} and ${band.max}.\n\n` +
    "Return the JSON spec now:";
  return { sys, user };
}

/**
 * SELF-EXPLAIN mode (Phase 7, decompose-then-verify): the VERIFIER has ALREADY
 * decided correctness + which structural check failed. The model ONLY narrates
 * encouragement/elaboration around that fixed verdict — it cannot change it.
 */
export function selfExplainMessages(body) {
  const sys =
    "You are an encouraging quant tutor. The learner's explanation has ALREADY been graded by a " +
    "deterministic verifier — that verdict is FINAL and you must NOT contradict or re-grade it. " +
    "Given the verifier's verdict, write ONE or TWO short, supportive sentences of feedback: if " +
    "correct, affirm the key reasoning; if incorrect, gently point at the failed check WITHOUT " +
    "revealing the final answer. Reply with ONLY the feedback text, no preamble.";
  const verdict = body.correct ? "CORRECT" : "INCORRECT";
  const failed = body.failedCheck ? `Failed check: ${body.failedCheck}\n` : "";
  const user =
    `Question:\n${body.prompt}\n\n` +
    `Verifier verdict: ${verdict}\n` +
    failed +
    `Learner's explanation:\n${body.explanation || "(none)"}\n\n` +
    "Write the short feedback now (do NOT state the final answer):";
  return { sys, user };
}

/**
 * MOCK-REASON-GRADE mode (mock-interview): judge the QUALITY of a candidate's
 * reasoning for ONE question. The CLIENT's deterministic verifier has ALREADY
 * decided whether the final answer is correct and passes that verdict in
 * `correct` — it is AUTHORITATIVE and the model must NEVER contradict, re-grade,
 * or flip it. The response schema deliberately carries NO correctness field.
 */
export function mockReasonGradeMessages(body) {
  const sys =
    "You are a demanding quant-trading interview coach judging the QUALITY of a " +
    "candidate's REASONING for ONE question. A deterministic verifier has ALREADY " +
    "decided whether their final answer is correct; that verdict is FINAL and " +
    "provided to you — you must NEVER contradict it, re-grade the answer, or state " +
    "your own correctness judgement. Assess ONLY the reasoning process. " +
    "GRADE THE COMMITTED CONCLUSION, NOT KEYWORD PRESENCE. First determine which " +
    "single side/value the candidate actually COMMITTED to (what they assert as " +
    "their final stance), then judge whether their reasoning validly and " +
    "non-contradictorily supports it. Merely quoting a correct fact or the correct " +
    "term somewhere does NOT earn credit if the committed conclusion is wrong, " +
    "unsupported, or self-contradictory. This is the key anti-gaming rule: an " +
    "answer that COMMITS to the wrong side while quoting a true fact (e.g. concludes " +
    "'yes, the same' but then states a fact that actually implies 'no, different') " +
    "is CONTRADICTORY and must be rated 'ambiguous', never 'sound' or 'partial'. " +
    "CRITICALLY EVALUATE EVERY STATED STEP for logical validity AND arithmetic " +
    "correctness: recompute each explicit claim the candidate writes (e.g. \u201c1 " +
    "divided by 2 is 5\u201d, \u201c3 \u00d7 4 = 11\u201d) and check it. A correct " +
    "FINAL answer does NOT make the reasoning sound: if any step is arithmetically " +
    "wrong, is a non-sequitur, or is a made-up rule that doesn't actually produce " +
    "the answer, the reasoning is FLAWED even though the answer was marked correct. " +
    "Respond as " +
    'strict JSON with EXACTLY these keys: "reasoningQuality" (one of "sound", ' +
    '"partial", "flawed", "ambiguous", "vague", "absent" — sound=commits to ONE ' +
    "answer, every step correct, complete, well-justified; partial=commits clearly " +
    "but a step or justification is missing, or it reaches a wrong result; " +
    "flawed=contains a FALSE arithmetic step or a nonsensical/non-sequitur chain " +
    "that doesn't validly reach the answer (USE THIS even when the final answer is " +
    "correct); ambiguous=MIXED or self-CONTRADICTORY or HEDGED / both-sides / " +
    "'either could be right', OR commits to a conclusion that conflicts with its " +
    "own stated reason, OR you cannot CONFIDENTLY extract a single committed " +
    "conclusion (USE THIS for gaming answers that state a correct fact but commit to " +
    "the wrong side — do NOT rescue them into 'sound'); vague=hand-wavy, asserts " +
    "without showing work; absent=no real reasoning), \"issues\" (array of specific, " +
    "concrete critiques that NAME the exact flawed/contradictory step and give the " +
    "correct value, e.g. 'you concluded \\\"yes, the same\\\" but your reason " +
    "\\\"both can't occur\\\" implies they are DIFFERENT'; use [] if none), " +
    "\"clarifyPrompt\" (REQUIRED and non-empty when reasoningQuality is " +
    "\"ambiguous\": ONE sentence that NAMES the two sides/values in tension and " +
    "forces the candidate to commit, e.g. 'You concluded X but your reasoning " +
    "suggests Y — commit to ONE answer and give the single reason it is correct.'; " +
    "use \"\" for every other quality), and \"probe\" (ONE sharp adversarial " +
    "follow-up that stress-tests or breaks their logic or asks a harder variation; " +
    "use \"\" if nothing useful). Rules: if the answer was marked CORRECT, do not " +
    "claim it is wrong — but you MUST still call out wrong/nonsensical/contradictory " +
    "reasoning as flawed or ambiguous. If it was marked INCORRECT, the probe and " +
    "clarifyPrompt must nudge toward the flaw WITHOUT revealing the correct final " +
    "answer. SAFETY DEFAULT: when you are unsure whether the reasoning cleanly " +
    "commits to the correct side, PREFER 'ambiguous' (which triggers a clarifying " +
    "follow-up) over 'sound'/'partial' — never let a mixed or contradictory answer " +
    "pass as good reasoning. If this is mental math, DO NOT penalize brevity: a " +
    "fast correct number with terse or no explanation is acceptable and must NOT be " +
    "rated 'vague', 'absent', or 'ambiguous' merely for being short — HOWEVER a " +
    "wrong stated computation is never acceptable and is 'flawed' even in mental " +
    "math. DO NOT penalize varied WORDING, NOTATION, or METHOD: symbolic recurrences " +
    "(e.g. \u201ca\u2099 = a\u2099\u208b\u2081 + a\u2099\u208b\u2082\u201d), plain-English rules, " +
    "fractions vs. decimals vs. percentages, spelled-out numbers (\u201ctwo-thirds\u201d), and " +
    "currency forms (\u201c-$0.50\u201d) are all equivalent, and a DIFFERENT-but-valid method " +
    "that correctly and unambiguously reaches the conclusion is fully 'sound'. Judge " +
    "the LOGIC and the COMMITMENT, never the phrasing. No markdown, no extra keys.";
  const user =
    `Question:\n${body.prompt || ""}\n\n` +
    (body.concept ? `Concept: ${body.concept}\n` : "") +
    `Ground-truth answer: ${body.correctAnswer ?? ""}\n` +
    `Verifier verdict (FINAL, authoritative): ${body.correct ? "CORRECT" : "INCORRECT"}\n` +
    `Mental math: ${body.isMentalMath ? "yes" : "no"}\n` +
    `Candidate's reasoning:\n${body.reasoning || "(none)"}\n\n` +
    "Return the JSON now:";
  return { sys, user };
}

/**
 * MOCK-EXTRACT-CLAIMS mode (mock-interview): TRANSLATION ONLY. Turn the
 * candidate's free-text reasoning into a STRUCTURED list of discrete, checkable
 * claims (arithmetic / final-answer / mechanism / quantity). The model NEVER
 * judges correctness — the client re-derives the verdict deterministically from
 * these claims (`gradeReasoningFromClaims`), so a false/missing load-bearing
 * claim still fails on the client. See MOCK_AI_CONTRACT.md Mode 1c.
 */
export function mockExtractClaimsMessages(body) {
  const sys =
    "You are a precise translator for a quant-interview grader. Your ONLY job is to " +
    "convert a candidate's free-text REASONING into a STRUCTURED list of discrete, " +
    "checkable CLAIMS. You NEVER judge correctness, never emit a verdict/score/the " +
    "word 'correct', and never invent claims that aren't in the reasoning. A " +
    "deterministic verifier re-checks everything you return. Respond as strict JSON " +
    'with EXACTLY one key: "claims" — an array of objects, each with: "kind" (one of ' +
    '"arithmetic", "final-answer", "mechanism", "quantity"), "text" (the clause the ' +
    'claim came from, verbatim-ish). For "arithmetic" also include "expr" (the ' +
    'left-hand expression exactly as written, e.g. "24 + 6") and "value" (the stated ' +
    'numeric result, e.g. 30) — report them AS WRITTEN even if the math is wrong; do ' +
    'NOT silently fix it (the verifier catches false steps). For "final-answer" and ' +
    '"quantity" include "value" (the stated numeric value). For "mechanism" include ' +
    '"mechanism" (a short CANONICALIZED method phrase, e.g. map "the jumps get bigger ' +
    'by the same amount" onto "first differences grow by a constant"). Do NOT copy the ' +
    "provided correct answer into a final-answer claim unless the candidate actually " +
    "stated it. No markdown, no extra keys.";
  const user =
    `Question:\n${body.prompt || ""}\n\n` +
    (body.concept ? `Concept: ${body.concept}\n` : "") +
    `Correct answer (context ONLY — do not copy into claims): ${body.correctAnswer ?? ""}\n\n` +
    `Candidate's reasoning:\n${body.reasoning || "(none)"}\n\n` +
    "Return the JSON now (translate into claims; do NOT judge):";
  return { sys, user };
}

/**
 * MOCK-REVIEW-REASONING mode (mock-interview): a verifier-GROUNDED span review.
 * The model reads the candidate's reasoning against the VERIFIED answer + a
 * canonical derivation and returns DISJOINT character spans over the candidate
 * text tagged good/bad, each with specific human feedback, plus an overall
 * assessment. It NEVER decides correctness (the client's deterministic verifier
 * is authoritative and reconciles every span).
 */
export function mockReviewReasoningMessages(body) {
  const sys =
    "You are a sharp, warm quant-interview coach REVIEWING a candidate's written " +
    "reasoning. A deterministic verifier ALREADY knows the correct answer (given " +
    "to you as context) and will RE-CHECK everything you return — you must NEVER " +
    "state a pass/fail verdict, a score, or the word 'correct' as a judgement. " +
    "Your job is to LOCALIZE and EXPLAIN. Return DISJOINT spans over the candidate's " +
    "reasoning. For EACH span, return the EXACT verbatim substring it refers to as " +
    "`quote`: copy it CHARACTER-FOR-CHARACTER out of the candidate's reasoning (same " +
    "words, same punctuation, same casing) — do NOT paraphrase, summarize, or " +
    "re-spell it, and do NOT compute or return character offsets. Each span is " +
    "tagged good or bad with SPECIFIC, human feedback that QUOTES the candidate's " +
    "own words. GROUND every 'good' span: only mark a step good if it is a " +
    "genuinely correct load-bearing step (a computation that actually holds, a " +
    "valid named mechanism/shortcut, or the committed answer equal to the verified " +
    "answer). NEVER mark a number good just because it happens to match part of the " +
    "answer (e.g. a coincidental digit). When the reasoning is wrong, point a 'bad' " +
    "span at the SPECIFIC broken premise or mis-identified pattern and explain WHY " +
    "against the actual quantities, WITHOUT revealing the final answer. " +
    "COVER EVERYTHING LOAD-BEARING, AS WHOLE CLAUSES: mark EVERY correct " +
    "load-bearing step or explanation good and EVERY flawed/unjustified step bad — " +
    "do not stop after one span and do not leave the meat of a correct explanation " +
    "un-highlighted. Prefer WHOLE CLAUSES/PHRASES over single tokens: green the " +
    "entire mechanistic clause (e.g. the whole 'the constant second difference can " +
    "be determined and then divided by 2 to get a' and the whole 'solving a linear " +
    "equation for b and c which can be done with any two of the three terms'), not " +
    "just a keyword or a lone number inside it. Do NOT green a bare number token on " +
    "its own (e.g. the '2' in 'any 2 of the three terms') — only green a number when " +
    "it is the committed final answer stated as such. " +
    "NEVER GREEN A RESTATEMENT OR A CIRCULAR JUSTIFICATION: a clause that merely " +
    "repeats the question's own words, or 'justifies' a claim with the claim itself " +
    "('three terms are enough because it is quadratic', 'because that is enough', " +
    "'because that's how it works'), explains NOTHING and MUST be tagged bad — even " +
    "when the final answer is correct — with feedback that names what a real reason " +
    "would say (e.g. 'a quadratic has three unknowns a, b, c, so three terms give " +
    "three equations that pin them down; naming the degree is not the reason'). " +
    "DO NOT MANUFACTURE FLAWS: a substantially-correct load-bearing explanation is " +
    "GOOD even if terse or slightly loose in WORDING — do NOT redden it for a minor " +
    "imprecision that does not change the method (e.g. saying 'a linear equation' " +
    "for a small 2x2 linear system, 'divide by 2' for the second-difference step, " +
    "or 'any two terms' for two chosen equations are all acceptable and GOOD). " +
    "Reserve 'bad' for a GENUINELY broken step: false arithmetic, a non-sequitur, a " +
    "mis-identified pattern/formula, a circular restatement, a hedge, or a wrong " +
    "conclusion. When in doubt on a CORRECT answer, prefer 'good' for a clause that " +
    "conveys the right mechanism. " +
    "VERIFIER-GROUNDED LOCALIZATION (when 'Verifier-computed facts' are provided): " +
    "critique the candidate's ACTUAL committed formula, NEVER a re-read or mid-word " +
    "substring, and NEVER invent or evaluate an expression the candidate did not " +
    "write. If the verifier lists an 'earliest false claim', your primary 'bad' " +
    "span MUST map to that exact literal text in the candidate's reasoning. Phrase " +
    "every counterexample using the verifier's real numbers (the candidate " +
    "formula's own value at that n vs the true term) — do not compute your own. " +
    "IMPORTANT: your primary 'bad' span must QUOTE the circular/restatement " +
    "JUSTIFICATION clause itself (e.g. \"because it is quadratic\"), NEVER the " +
    "candidate's correct committed answer values (e.g. \"a = 2, b = -1, c = 3\") — a " +
    "correct committed answer is never reddened just for lacking a stated reason. " +
    "Respond as " +
    'strict JSON with EXACTLY these keys: "spans" (array of {"quote":string, ' +
    '"label":"good"|"bad", "why":string} where "quote" is the EXACT verbatim ' +
    "substring copied from the candidate's reasoning) and \"assessment\" (one or two " +
    "sentences of overall, advisory feedback). No markdown, no extra keys.";
  const f = body.verifierFacts && typeof body.verifierFacts === "object" ? body.verifierFacts : null;
  const factsBlock = f
    ? "Verifier-computed facts (AUTHORITATIVE — highlight/critique ONLY within these):\n" +
      (Array.isArray(f.trueTerms) && f.trueTerms.length
        ? `  • True sequence terms (n=1,2,…): ${f.trueTerms.join(", ")}\n`
        : "") +
      (body.closedForm ? `  • True closed form: ${body.closedForm}\n` : "") +
      (f.candidateFormula
        ? `  • Candidate's committed formula (parsed from their text): ${f.candidateFormula}\n`
        : "") +
      (Array.isArray(f.candidateValues) && f.candidateValues.length
        ? `  • That formula's values at n=1,2,…: ${f.candidateValues.join(", ")}\n`
        : "") +
      (f.counterexample ? `  • First-divergence counterexample: ${f.counterexample}\n` : "") +
      (f.earliestFalseClaim
        ? `  • EARLIEST FALSE CLAIM (make this your primary 'bad' span): "${f.earliestFalseClaim}"` +
          (f.earliestFalseClaimWhy ? ` — ${f.earliestFalseClaimWhy}` : "") +
          "\n"
        : "")
    : "";
  const user =
    `Question:\n${body.prompt || ""}\n\n` +
    (body.concept ? `Concept: ${body.concept}\n` : "") +
    `Verified answer (FINAL, authoritative context): ${body.correctAnswer ?? body.verifiedAnswer ?? ""}\n` +
    (body.canonicalDerivation ? `Canonical derivation: ${body.canonicalDerivation}\n` : "") +
    (body.closedForm ? `Closed form: ${body.closedForm}\n` : "") +
    (body.keyShortcut ? `Key shortcut: ${body.keyShortcut}\n` : "") +
    (Array.isArray(body.mechanismSignals) && body.mechanismSignals.length
      ? `Accepted mechanism phrasings: ${body.mechanismSignals.join(", ")}\n`
      : "") +
    (factsBlock ? `\n${factsBlock}` : "") +
    `\nCandidate's reasoning (quote EXACT substrings copied verbatim from THIS text):\n${body.reasoning || "(none)"}\n\n` +
    "Return the JSON now (localize + explain; do NOT state a correctness verdict):";
  return { sys, user };
}

/**
 * MOCK-CLARIFY-GRADE mode (mock-interview): grade the candidate's ONE clarifying
 * response STRICTLY. A hard pass/fail — there is no second clarify.
 */
export function mockClarifyGradeMessages(body) {
  const sys =
    "You are a demanding quant-trading interviewer grading a candidate's SINGLE " +
    "clarifying answer. Context: their first explanation was MIXED / contradictory " +
    "/ hedged, so they were asked to COMMIT to one answer and give the single " +
    "reason it is correct. This is the FINAL round — there is no second chance. " +
    "Grade STRICTLY on the COMMITTED CONCLUSION, not keyword presence. Respond as " +
    'strict JSON with EXACTLY these keys: "resolved" (one of "yes" or "no" — "yes" ' +
    "ONLY if they now commit clearly to the correct side/value AND give a valid, " +
    "non-contradictory reason for it; \"no\" if they still hedge, contradict " +
    "themselves, commit to the wrong side, or give an irrelevant/invalid " +
    "justification even while naming the right side), and \"issues\" (array of " +
    "concrete critiques naming exactly why it is unresolved; use [] when resolved). " +
    "SAFETY DEFAULT: if you are not confident they cleanly committed to the correct " +
    "side with a valid reason, answer \"no\". Ignore wording/notation/method " +
    "differences; judge only the commitment and its logic. No markdown, no extra " +
    "keys.";
  const user =
    `Question:\n${body.prompt || ""}\n\n` +
    (body.concept ? `Concept: ${body.concept}\n` : "") +
    `Correct answer: ${body.correctAnswer ?? ""}\n` +
    `The tension they must resolve / clarify prompt shown:\n${body.clarifyPrompt || ""}\n\n` +
    `Their original (ambiguous) reasoning:\n${body.reasoning || "(none)"}\n\n` +
    `Their clarifying answer:\n${body.clarification || "(none)"}\n\n` +
    "Return the JSON now:";
  return { sys, user };
}

/**
 * MOCK-FOLLOWUP mode (mock-interview): generate ONE standalone adversarial
 * follow-up question, independent of reasoning grading.
 */
export function mockFollowupMessages(body) {
  const difficulty = oneOf(
    body.difficulty,
    ["harder", "variation", "break-logic"],
    "harder",
  );
  const styleLine =
    difficulty === "variation"
      ? "Change the setup to test whether they can TRANSFER the idea to a new scenario."
      : difficulty === "break-logic"
        ? "Design it to expose a likely misconception or break flawed reasoning."
        : "Raise the difficulty to test genuine understanding vs. memorization.";
  const sys =
    "You are a sharp quant-trading interviewer generating ONE standalone adversarial " +
    "follow-up question. It must be self-contained and answerable on its own. Respond " +
    'as strict JSON with EXACTLY these keys: "question" (the single follow-up question) ' +
    'and "idealAnswerNote" (a brief internal note, for the interviewer only, on what a ' +
    "strong answer contains). " +
    styleLine +
    " CRITICAL for grading: the client extracts the intended answer from your note " +
    "DETERMINISTICALLY. If the follow-up has a single numeric answer, END the note with " +
    "that final value after an '=' (e.g. \u201c\u2026 = 0.25\u201d) and include NO other stray " +
    "numbers after it; give ONE unambiguous target. If it is conceptual (no single " +
    "number), state the required conclusion in plain words. Write the question so a " +
    "correct answer can be phrased many ways (symbolic, plain-English, fraction or " +
    "decimal) and still be gradable. No markdown, no extra keys.";
  const user =
    `Original question:\n${body.prompt || ""}\n\n` +
    (body.concept ? `Concept: ${body.concept}\n` : "") +
    `Reference answer: ${body.correctAnswer ?? ""}\n` +
    (body.reasoning ? `Candidate's reasoning:\n${body.reasoning}\n` : "") +
    `Follow-up style: ${difficulty}\n\n` +
    "Return the JSON now:";
  return { sys, user };
}

/**
 * MOCK-DIAGNOSIS mode (mock-interview): write the final brutal-but-fair interview
 * diagnosis from a compact, already-computed performance summary.
 */
export function mockDiagnosisMessages(body) {
  const summary = body.summary && typeof body.summary === "object" ? body.summary : {};
  const sys =
    "You are a brutally honest but fair quant-trading interview coach writing a final, " +
    "STRICT, PER-COMPETENCY diagnosis. You are given a compact, already-computed " +
    "performance summary — a deterministic scorer produced EVERY number. Ground " +
    "EVERYTHING strictly in these numbers; you MUST NOT invent, assume, or fabricate any " +
    "statistic that is not present. Respond as strict JSON with EXACTLY these keys: " +
    "\"verdict\" (one honest sentence on where they stand vs the target firm, e.g. " +
    "'Would not clear a first-round screen at a top desk'), \"wouldPass\" (one of \"yes\", " +
    "\"borderline\", \"no\" — be strict: a losing market-making sim, a weak probability/EV " +
    "or speed competency, any flawed reasoning, or folding on adversarial follow-ups should " +
    "cap the verdict), \"strengths\" (array), \"weaknesses\" (array of SPECIFIC weaknesses), " +
    "and \"nextSteps\" (array of CONCRETE steps that ROUTE the student to specific places on " +
    "THIS site). Grade each competency SEPARATELY (speed/arithmetic, probability & EV, " +
    "sequences, estimation, brainteaser logic, market-making, follow-up/critical-thinking, " +
    "reasoning quality) and call out EVERY gap — including 'correct answer but vague/hand-" +
    "wavy reasoning' (when correctButVagueCount>0) and 'answered the main question but folded " +
    "on the adversarial follow-up' (when adversarialCorrect is well below probeCorrect). NEVER " +
    "attribute vagueness to mental-math brevity. For nextSteps, name concrete destinations: " +
    "Speed Arena (/arena) and EV-Timed (/ev-timed) for speed; the Custom Drill Builder (/drill) " +
    "on Conditional Probability / Bayes / Expected Value and those lessons for probability; Fermi " +
    "drills (/fermi) for estimation; Make-a-Market (/make-market) and Cards Market-Making " +
    "(/cards-market-making) for market-making; re-running the mock (/mock) to defend and " +
    "generalize follow-ups for critical thinking. Be direct and cite the actual figures. No " +
    "markdown, no extra keys.";
  const user =
    `Performance summary (JSON):\n${JSON.stringify(summary)}\n\n` +
    "Field guide: scorePct=overall %, mathCorrect/mathTotal=blended math accuracy, " +
    "avgMathMs=avg ms per math item; PER-COMPETENCY tallies (each {correct,total}, may be " +
    "absent if that competency was not tested): speed=mental-math speed gate, probEv=probability " +
    "& EV, sequences=pattern recognition, estimation=Fermi; speedAvgMs=avg ms per speed item. " +
    "probeCorrect/probeTotal=Follow-up 1 (deepen the principle), adversarialCorrect/" +
    "adversarialTotal=Follow-up 2 (challenge the logic / generalize), followupCorrect/" +
    "followupTotal=both combined, brainteaserCorrect/brainteaserTotal, mmPnl=market-making P&L, " +
    "mmVerdict=market-making assessment, reasoningTags=counts of reasoning quality " +
    "{sound,partial,flawed,vague,absent}, correctButVagueCount=# items answered correctly but " +
    "with weak/flawed reasoning, tier=target desk tier.\n\n" +
    "Return the JSON now:";
  return { sys, user };
}

/* -------------------------------- providers ------------------------------- */
/**
 * Build the provider config from an env bag (works for BOTH the Lambda's env and
 * the local dev server's `.env.local`). Accepts friendly aliases so the local
 * `.env.local` can use `AI_PROVIDER_MODEL` / `AI_PROVIDER_BASE_URL` while the
 * Lambda keeps its CloudFormation `AI_MODEL` / `AI_BASE_URL`. Never reads a key.
 */
export function buildProviderConfig(env = {}) {
  const provider = String(env.AI_PROVIDER || "openai").toLowerCase();
  const model =
    env.AI_MODEL ||
    env.AI_PROVIDER_MODEL ||
    (provider === "anthropic" ? "claude-3-5-haiku-latest" : "gpt-4o-mini");
  const baseUrl =
    env.AI_BASE_URL ||
    env.AI_PROVIDER_BASE_URL ||
    (provider === "anthropic"
      ? "https://api.anthropic.com"
      : "https://api.openai.com/v1");
  return { provider, model, baseUrl };
}

// Join an OpenAI-compatible base URL with the chat-completions path, robustly.
export function chatCompletionsUrl(base) {
  const b = String(base || "").trim().replace(/\/+$/, "");
  return /\/chat\/completions$/.test(b) ? b : `${b}/chat/completions`;
}

// Join an Anthropic-compatible base URL (real API or a gateway like TrueFoundry)
// with the Messages path, robustly. If the base already ends in `/v1/messages`
// or `/messages`, don't double-append.
export function messagesUrl(base) {
  const b = String(base || "").trim().replace(/\/+$/, "");
  return /\/(?:v1\/)?messages$/.test(b) ? b : `${b}/v1/messages`;
}

async function callOpenAI(key, sys, user, wantJson, opts, config) {
  const res = await fetch(chatCompletionsUrl(config.baseUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      temperature: opts.temperature ?? 0.9,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      ...(wantJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content?.trim() || "";
}
async function callAnthropic(key, sys, user, opts, config) {
  // Use the configured base URL so requests can reach either the real Anthropic
  // API or an Anthropic-compatible gateway (e.g. TrueFoundry). Auth scheme is
  // host-aware: the real Anthropic API authenticates with `x-api-key`, while a
  // gateway authenticates with a Bearer token in `authorization`. Sending BOTH
  // makes some gateways reject the request (they validate `x-api-key` first and
  // a gateway key is not a valid native Anthropic key -> 401), so pick one.
  const url = messagesUrl(config.baseUrl);
  const isNativeAnthropic = /(^|\.)api\.anthropic\.com$/i.test(
    (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return "";
      }
    })()
  );
  const authHeaders = isNativeAnthropic
    ? { "x-api-key": key }
    : { authorization: `Bearer ${key}` };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.9,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.content?.[0]?.text || "").trim();
}

/**
 * Bind an API key + provider config into a `callLLM(sys, user, wantJson, opts)`
 * function. The KEY lives only in this closure — it is never stored on the
 * config, logged, or returned. The router below receives ONLY this bound caller,
 * so it never sees the key.
 */
export function makeLlmCaller({ key, config }) {
  const cfg = config || buildProviderConfig();
  return (sys, user, wantJson, opts = {}) =>
    cfg.provider === "anthropic"
      ? callAnthropic(key, sys, user, opts, cfg)
      : callOpenAI(key, sys, user, wantJson, opts, cfg);
}

/* ---------------------- defensive JSON coercion helpers ------------------- */
export function safeParseJson(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}
export function asString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}
export function asStringArray(v) {
  return Array.isArray(v)
    ? v.filter((x) => typeof x === "string" && x.trim().length > 0)
    : [];
}
export function oneOf(v, allowed, fallback) {
  return typeof v === "string" && allowed.includes(v) ? v : fallback;
}
function toNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/* --------------------------------- router --------------------------------- */
/**
 * Route ONE parsed request body to the right mode and return `{ status, payload }`
 * — the SAME contract JSON in every environment. `callLLM(sys, user, wantJson,
 * opts)` is the key-bound provider caller (real in prod/local, mocked in tests).
 * This function owns NO transport, NO auth, NO key, and NO env access, so it is
 * trivially testable with a mocked provider and identical on Lambda and locally.
 */
export async function routeAiRequest({ body, callLLM }) {
  body = body && typeof body === "object" ? body : {};
  try {
    if (body.mode === "open-ended") {
      const { sys, user } = openEndedMessages(body);
      const text = await callLLM(sys, user, true);
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { status: 502, payload: { ok: false, error: "model returned non-JSON" } };
      }
      return {
        status: 200,
        payload: {
          ok: true,
          prompt: parsed.prompt || "",
          answer: parsed.answer || "",
          explanation: parsed.explanation || "",
          verified: false,
        },
      };
    }

    if (body.mode === "parse-drill-intent") {
      const { sys, user } = parseDrillIntentMessages(body);
      const text = await callLLM(sys, user, true, { maxTokens: 200, temperature: 0.1 });
      const parsed = safeParseJson(text) || {};
      return {
        status: 200,
        payload: {
          ok: true,
          topicKeys: asStringArray(parsed.topicKeys),
          minOrder: parsed.minOrder,
          maxOrder: parsed.maxOrder,
          count: parsed.count,
        },
      };
    }

    if (body.mode === "hint") {
      const { sys, user } = hintMessages(body);
      const candidate = await callLLM(sys, user, false);
      const check = verifyHint(body.rung || "", candidate, body.answer, body.requiredNumbers);
      if (!check.ok) {
        return { status: 200, payload: { ok: false, error: `guardrail:${check.reason}` } };
      }
      return { status: 200, payload: { ok: true, hint: candidate } };
    }

    if (body.mode === "self-explain") {
      const { sys, user } = selfExplainMessages(body);
      const narration = await callLLM(sys, user, false);
      return {
        status: 200,
        payload: {
          ok: true,
          correct: !!body.correct,
          failedCheck: body.failedCheck ?? null,
          narration: narration || "",
        },
      };
    }

    if (body.mode === "mock-reason-grade") {
      const { sys, user } = mockReasonGradeMessages(body);
      const text = await callLLM(sys, user, true, { maxTokens: 600, temperature: 0.3 });
      const parsed = safeParseJson(text) || {};
      const reasoningQuality = oneOf(
        parsed.reasoningQuality,
        ["sound", "partial", "flawed", "ambiguous", "vague", "absent"],
        "partial",
      );
      const clarifyPrompt =
        reasoningQuality === "ambiguous" ? asString(parsed.clarifyPrompt, "") : "";
      return {
        status: 200,
        payload: {
          ok: true,
          reasoningQuality,
          issues: asStringArray(parsed.issues),
          probe: asString(parsed.probe, ""),
          clarifyPrompt,
        },
      };
    }

    if (body.mode === "mock-extract-claims") {
      // TRANSLATION only: text → structured claims. No correctness field. The
      // client re-derives the verdict deterministically from these claims, so a
      // malformed/hostile extraction can only make grading stricter (drop claims),
      // never manufacture a passing verdict. Empty array ⇒ client uses its own
      // deterministic extractor.
      const { sys, user } = mockExtractClaimsMessages(body);
      const text = await callLLM(sys, user, true, { maxTokens: 700, temperature: 0.1 });
      const parsed = safeParseJson(text) || {};
      const rawClaims = Array.isArray(parsed.claims) ? parsed.claims : [];
      const claims = [];
      for (const c of rawClaims) {
        if (!c || typeof c !== "object") continue;
        const kind = oneOf(
          c.kind,
          ["arithmetic", "final-answer", "mechanism", "quantity"],
          null,
        );
        if (!kind) continue;
        const claim = { kind, text: asString(c.text, "") };
        if (typeof c.expr === "string") claim.expr = c.expr;
        if (typeof c.mechanism === "string") claim.mechanism = c.mechanism;
        const v = toNum(c.value);
        if (v !== undefined) claim.value = v;
        claims.push(claim);
      }
      return { status: 200, payload: { ok: true, claims } };
    }

    if (body.mode === "mock-review-reasoning") {
      const { sys, user } = mockReviewReasoningMessages(body);
      const text = await callLLM(sys, user, true, { maxTokens: 900, temperature: 0.3 });
      const parsed = safeParseJson(text) || {};
      const rawSpans = Array.isArray(parsed.spans) ? parsed.spans : [];
      const spans = [];
      for (const s of rawSpans) {
        if (!s || typeof s !== "object") continue;
        // Normalize the model's "bad" onto the client's "flawed" vocabulary.
        const label =
          s.label === "good"
            ? "good"
            : s.label === "bad" || s.label === "flawed"
              ? "flawed"
              : null;
        if (!label) continue;
        // PREFER a verbatim quote (LLMs can't count character offsets reliably);
        // keep optional numeric start/end only as a legacy fallback.
        const quote = typeof s.quote === "string" && s.quote.trim() ? s.quote : "";
        const start = Number(s.start);
        const end = Number(s.end);
        const hasOffsets = Number.isFinite(start) && Number.isFinite(end);
        if (!quote && !hasOffsets) continue;
        const span = { label, why: asString(s.why, "") };
        if (quote) span.quote = quote;
        if (hasOffsets) {
          span.start = start;
          span.end = end;
        }
        spans.push(span);
      }
      return {
        status: 200,
        payload: { ok: true, spans, assessment: asString(parsed.assessment, "") },
      };
    }

    if (body.mode === "mock-clarify-grade") {
      const { sys, user } = mockClarifyGradeMessages(body);
      const text = await callLLM(sys, user, true, { maxTokens: 400, temperature: 0.2 });
      const parsed = safeParseJson(text) || {};
      return {
        status: 200,
        payload: {
          ok: true,
          resolved: oneOf(parsed.resolved, ["yes", "no"], "no"),
          issues: asStringArray(parsed.issues),
        },
      };
    }

    if (body.mode === "mock-followup") {
      const { sys, user } = mockFollowupMessages(body);
      const text = await callLLM(sys, user, true, { maxTokens: 700, temperature: 0.8 });
      const parsed = safeParseJson(text) || {};
      return {
        status: 200,
        payload: {
          ok: true,
          question: asString(parsed.question, ""),
          idealAnswerNote: asString(parsed.idealAnswerNote, ""),
        },
      };
    }

    if (body.mode === "mock-diagnosis") {
      const { sys, user } = mockDiagnosisMessages(body);
      const text = await callLLM(sys, user, true, { maxTokens: 1400, temperature: 0.4 });
      const parsed = safeParseJson(text) || {};
      return {
        status: 200,
        payload: {
          ok: true,
          verdict: asString(parsed.verdict, ""),
          wouldPass: oneOf(parsed.wouldPass, ["yes", "borderline", "no"], "borderline"),
          strengths: asStringArray(parsed.strengths),
          weaknesses: asStringArray(parsed.weaknesses),
          nextSteps: asStringArray(parsed.nextSteps),
        },
      };
    }

    // Default: flavor mode (verifier-gated reskin).
    const { sys, user } = flavorMessages(body);
    const candidate = await callLLM(sys, user, false);
    const check = verifyFlavor(body.prompt || "", candidate, body.requiredNumbers);
    if (!check.ok) {
      return { status: 200, payload: { ok: false, error: `guardrail:${check.reason}` } };
    }
    return { status: 200, payload: { ok: true, prompt: candidate } };
  } catch (e) {
    console.warn("LLM call failed:", e?.message);
    return { status: 502, payload: { ok: false, error: "LLM call failed" } };
  }
}

/** Every mode the router understands (handy for tests + docs). */
export const AI_MODES = [
  "flavor",
  "open-ended",
  "hint",
  "self-explain",
  "parse-drill-intent",
  "mock-reason-grade",
  "mock-extract-claims",
  "mock-review-reasoning",
  "mock-clarify-grade",
  "mock-followup",
  "mock-diagnosis",
];
