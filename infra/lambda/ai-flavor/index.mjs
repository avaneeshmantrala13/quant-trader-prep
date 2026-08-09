/**
 * quant-trader-prep — AI "flavor / open-ended" Lambda.
 *
 * Sits behind its OWN API Gateway HTTP API (see
 * `infra/cloudformation/quant-trader-prep-ai.yaml`) with a Cognito JWT
 * authorizer, so only signed-in users can call it and the API Gateway has
 * already verified the caller before we run. This handler:
 *
 *   - reads the LLM provider API KEY from SSM Parameter Store (SecureString) —
 *     the key NEVER lives in the browser bundle or in CloudFormation;
 *   - FLAVOR mode: asks the LLM to reskin ONLY the narrative of a
 *     parametrically-generated question, then re-runs the numeric GUARDRAIL
 *     server-side (defense in depth — the client runs the authoritative check
 *     too) and refuses if the math changed;
 *   - OPEN-ENDED mode: asks the LLM for a brand-new question and returns it as
 *     an explicitly-unverified flashcard (never graded as truth);
 *   - HINT mode (Phase 7): rephrases ONE deterministic Phase-2 hint rung's
 *     WORDING only, then re-guards server-side (preserve context numbers AND
 *     never state the final answer — `verifyHint`). On any guardrail failure it
 *     returns `{ok:false}` so the client keeps its original deterministic rung.
 *     The LLM never chooses the hint logic or reveals the answer;
 *   - SELF-EXPLAIN mode (Phase 7, decompose-then-verify): the CLIENT's verifier
 *     has already decided correctness + the failed structural check; this branch
 *     ONLY narrates encouragement around that FIXED verdict and echoes the
 *     verdict back verbatim. The LLM can never flip correctness;
 *   - (optional) enforces a per-user DAILY QUOTA via a DynamoDB counter to cap
 *     spend, degrading gracefully to "no quota" when the table isn't configured.
 *
 * Runtime: nodejs20.x — `fetch` is global and the AWS SDK v3 (`@aws-sdk/*`) is
 * bundled in the runtime, so this file needs NO npm install / packaging.
 *
 * Provider: OpenAI-compatible by default (`AI_PROVIDER=openai`). The OpenAI
 * branch talks to ANY OpenAI-compatible `/chat/completions` endpoint via a
 * configurable base URL (`AI_BASE_URL`) + model (`AI_MODEL`) + `Bearer` key, so
 * it works unchanged against a raw OpenAI key OR an OpenAI-compatible LLM gateway
 * such as the TrueFoundry AI Gateway (`AI_BASE_URL=https://gateway.truefoundry.ai`,
 * `AI_MODEL=provider_account/model_name`, and a TrueFoundry PAT/VAT in SSM). Set
 * `AI_PROVIDER=anthropic` to use Anthropic's native API instead — both branches
 * are implemented below.
 *
 * Env vars (set by the CloudFormation template):
 *   AI_PROVIDER        "openai" (default) | "openai-compatible" | "anthropic"
 *   AI_BASE_URL        OpenAI-compatible base URL (default the OpenAI API);
 *                      e.g. https://gateway.truefoundry.ai for TrueFoundry SaaS
 *   AI_MODEL           model id (default gpt-4o-mini / claude-3-5-haiku); for
 *                      TrueFoundry use the `provider_account/model_name` form
 *   AI_SSM_PARAM       SSM SecureString name holding the API key (a provider key
 *                      for raw OpenAI/Anthropic, or a TrueFoundry PAT/VAT)
 *   AI_DAILY_QUOTA     integer; 0/unset disables the quota check
 *   AI_QUOTA_TABLE     DynamoDB table for the quota counter (optional)
 *   ALLOW_ORIGIN       CORS allow-origin (default "*")
 */
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const REGION = process.env.AWS_REGION || "us-east-1";
const PROVIDER = (process.env.AI_PROVIDER || "openai").toLowerCase();
const MODEL =
  process.env.AI_MODEL ||
  (PROVIDER === "anthropic" ? "claude-3-5-haiku-latest" : "gpt-4o-mini");
// OpenAI-compatible base URL. Defaults to the raw OpenAI API so nothing changes
// for a plain-OpenAI user. Point it at any OpenAI-compatible gateway (e.g.
// TrueFoundry SaaS `https://gateway.truefoundry.ai`) to use that instead.
const BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const SSM_PARAM = process.env.AI_SSM_PARAM || "/quant-trader-prep/ai/api-key";
const DAILY_QUOTA = Number(process.env.AI_DAILY_QUOTA || "0");
const QUOTA_TABLE = process.env.AI_QUOTA_TABLE || "";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

const ssm = new SSMClient({ region: REGION });

// Cache the API key across warm invocations (never logged).
let cachedKey = null;
async function getApiKey() {
  if (cachedKey) return cachedKey;
  const out = await ssm.send(
    new GetParameterCommand({ Name: SSM_PARAM, WithDecryption: true }),
  );
  cachedKey = out.Parameter?.Value || null;
  return cachedKey;
}

const CORS = {
  "content-type": "application/json",
  "access-control-allow-origin": ALLOW_ORIGIN,
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const reply = (statusCode, obj) => ({
  statusCode,
  headers: CORS,
  body: JSON.stringify(obj),
});

/* ----------------------------- numeric guardrail -------------------------- */
// Mirror of the client's `extractNumbers` / `verifyFlavor` (defense in depth).
function extractNumbers(text) {
  const out = [];
  const re = /\$?\s?(\d[\d,]*(?:\.\d+)?)\s?%?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(String(n));
  }
  return out;
}
function verifyFlavor(original, candidate, requiredNumbers) {
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
function extractAnswerNumbers(text) {
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
function answerToNumber(value) {
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
function containsFinalAnswer(text, answer, tolerance = 0) {
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
function verifyHint(originalRung, candidate, answer, requiredNumbers) {
  const base = verifyFlavor(originalRung, candidate, requiredNumbers);
  if (!base.ok) return base;
  if (containsFinalAnswer(candidate, answer)) {
    return { ok: false, reason: "leaks-answer" };
  }
  return { ok: true };
}

/* --------------------------------- prompts -------------------------------- */
function flavorMessages(body) {
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
function openEndedMessages(body) {
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
function hintMessages(body) {
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
function parseDrillIntentMessages(body) {
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
function selfExplainMessages(body) {
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
 * or flip it (mirrors self-explain / the ~56%-reliable-grader research). The
 * model rates ONLY the reasoning process and may pose ONE adversarial probe. The
 * response schema deliberately carries NO correctness field, so nothing the
 * model returns can override the client's `correct`.
 */
function mockReasonGradeMessages(body) {
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
 * MOCK-REVIEW-REASONING mode (mock-interview): a verifier-GROUNDED span review.
 * The model reads the candidate's reasoning against the VERIFIED answer + a
 * canonical derivation and returns DISJOINT character spans over the candidate
 * text tagged good/bad, each with specific human feedback, plus an overall
 * assessment. It NEVER decides correctness (the client's deterministic verifier
 * is authoritative and reconciles every span): the response carries no
 * correctness field, and a "good" span the client can't ground (a coincidental
 * number, a false step) is dropped/flipped client-side. So the model can never
 * upgrade a wrong committed answer to correct.
 */
function mockReviewReasoningMessages(body) {
  const sys =
    "You are a sharp, warm quant-interview coach REVIEWING a candidate's written " +
    "reasoning. A deterministic verifier ALREADY knows the correct answer (given " +
    "to you as context) and will RE-CHECK everything you return — you must NEVER " +
    "state a pass/fail verdict, a score, or the word 'correct' as a judgement. " +
    "Your job is to LOCALIZE and EXPLAIN. Return DISJOINT character spans over the " +
    "EXACT candidate reasoning string (0-based [start,end) offsets into it), each " +
    "tagged good or bad with SPECIFIC, human feedback that QUOTES the candidate's " +
    "own words. GROUND every 'good' span: only mark a step good if it is a " +
    "genuinely correct load-bearing step (a computation that actually holds, a " +
    "valid named mechanism/shortcut, or the committed answer equal to the verified " +
    "answer). NEVER mark a number good just because it happens to match part of the " +
    "answer (e.g. a coincidental digit). When the reasoning is wrong, point a 'bad' " +
    "span at the SPECIFIC broken premise or mis-identified pattern and explain WHY " +
    "against the actual quantities, WITHOUT revealing the final answer. Respond as " +
    'strict JSON with EXACTLY these keys: "spans" (array of {"start":int, "end":int, ' +
    '"label":"good"|"bad", "why":string}) and "assessment" (one or two sentences of ' +
    "overall, advisory feedback). No markdown, no extra keys.";
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
    `\nCandidate's reasoning (offsets are into THIS exact string):\n${body.reasoning || "(none)"}\n\n` +
    "Return the JSON now (localize + explain; do NOT state a correctness verdict):";
  return { sys, user };
}

/**
 * MOCK-CLARIFY-GRADE mode (mock-interview): grade the candidate's ONE clarifying
 * response STRICTLY. A clarify round only fires after an ambiguous / mixed /
 * contradictory answer; here the candidate must now COMMIT to the correct side
 * with valid, non-contradictory reasoning. This is a hard pass/fail — there is no
 * second clarify. The deterministic client is authoritative and only consults
 * this when the AI layer is on; the model may NEVER flip a clarification that the
 * client already resolved, it only sharpens the resolved/unresolved judgement.
 */
function mockClarifyGradeMessages(body) {
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
 * follow-up question, independent of reasoning grading (e.g. after a correct
 * answer, probe genuine understanding vs. memorization). The model never grades
 * anything; it only writes a question plus an internal note on a strong answer.
 */
function mockFollowupMessages(body) {
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
 * diagnosis. The CLIENT computes EVERY performance number deterministically
 * (accuracy incl. follow-ups, timing, reasoning-quality tallies, MM P&L) and
 * passes a compact, PII-minimized summary. The model turns those numbers into
 * honest prose + specific strengths/weaknesses/next-steps and MUST NOT invent any
 * statistic that is not in the summary.
 */
function mockDiagnosisMessages(body) {
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
// Join an OpenAI-compatible base URL with the chat-completions path, robustly:
//   - trims trailing slashes on the base;
//   - if the base already ends in `/chat/completions`, uses it as-is;
//   - otherwise appends `/chat/completions`.
// So `https://api.openai.com/v1` → `.../v1/chat/completions` (raw OpenAI) and
// `https://gateway.truefoundry.ai` → `.../chat/completions` (TrueFoundry SaaS),
// with no double `/v1` for operators who set the full base themselves.
export function chatCompletionsUrl(base) {
  const b = String(base || "").trim().replace(/\/+$/, "");
  return /\/chat\/completions$/.test(b) ? b : `${b}/chat/completions`;
}

// Optional per-call tuning `opts`: `{ maxTokens, temperature }`. Both are
// OPTIONAL and BACKWARD-COMPATIBLE — existing 4-arg callers get the historical
// defaults (temperature 0.9, and no OpenAI `max_tokens` cap / Anthropic's 1024).
// The new mock-interview modes pass a low temperature + a tight token cap so the
// per-question calls stay cheap and produce stable JSON.
async function callOpenAI(key, sys, user, wantJson, opts = {}) {
  const res = await fetch(chatCompletionsUrl(BASE_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
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
async function callAnthropic(key, sys, user, opts = {}) {
  // To switch providers set AI_PROVIDER=anthropic (+ store an Anthropic key).
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
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
async function callLLM(key, sys, user, wantJson, opts = {}) {
  if (PROVIDER === "anthropic") return callAnthropic(key, sys, user, opts);
  return callOpenAI(key, sys, user, wantJson, opts);
}

/* ---------------------- defensive JSON coercion helpers ------------------- */
// The mock-interview modes ask the model for STRICT JSON, but we NEVER trust it
// to be well-formed: every field is coerced with a safe fallback so a malformed
// or partial model reply degrades to sane defaults instead of crashing the
// client. None of these helpers can ever surface a correctness verdict.
function safeParseJson(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    // Tolerate stray prose / code fences around the JSON object.
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
function asString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}
function asStringArray(v) {
  return Array.isArray(v)
    ? v.filter((x) => typeof x === "string" && x.trim().length > 0)
    : [];
}
function oneOf(v, allowed, fallback) {
  return typeof v === "string" && allowed.includes(v) ? v : fallback;
}

/* ------------------------------- daily quota ------------------------------ */
// Best-effort per-user daily cap. Uses a DynamoDB atomic counter with a
// conditional expression; on ANY error (or when unconfigured) we allow the call
// rather than hard-fail — the hard spend cap is your provider-side budget.
async function checkQuota(sub) {
  if (!DAILY_QUOTA || !QUOTA_TABLE || !sub) return { ok: true };
  try {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, UpdateCommand } = await import(
      "@aws-sdk/lib-dynamodb"
    );
    const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
    const day = new Date().toISOString().slice(0, 10);
    const ttl = Math.floor(Date.now() / 1000) + 3 * 24 * 3600; // auto-expire
    await doc.send(
      new UpdateCommand({
        TableName: QUOTA_TABLE,
        Key: { pk: `${sub}#${day}` },
        UpdateExpression: "SET #c = if_not_exists(#c, :z) + :one, #t = :ttl",
        ConditionExpression: "attribute_not_exists(#c) OR #c < :limit",
        ExpressionAttributeNames: { "#c": "count", "#t": "ttl" },
        ExpressionAttributeValues: {
          ":z": 0,
          ":one": 1,
          ":limit": DAILY_QUOTA,
          ":ttl": ttl,
        },
      }),
    );
    return { ok: true };
  } catch (e) {
    if (e?.name === "ConditionalCheckFailedException") {
      return { ok: false, reason: "quota" };
    }
    return { ok: true }; // fail-open on infra errors
  }
}

/* --------------------------------- handler -------------------------------- */
export const handler = async (event) => {
  const method =
    event?.requestContext?.http?.method || event?.httpMethod || "POST";
  if (method === "OPTIONS") return reply(200, { ok: true });

  let body = {};
  try {
    body = JSON.parse(event?.body || "{}");
  } catch {
    return reply(400, { ok: false, error: "bad json" });
  }

  const sub =
    event?.requestContext?.authorizer?.jwt?.claims?.sub || null;

  const quota = await checkQuota(sub);
  if (!quota.ok) {
    return reply(429, { ok: false, error: "daily AI quota reached" });
  }

  let key;
  try {
    key = await getApiKey();
  } catch (e) {
    console.warn("SSM getParameter failed:", e?.message);
    return reply(500, { ok: false, error: "AI key not configured" });
  }
  if (!key) return reply(500, { ok: false, error: "AI key not configured" });

  try {
    if (body.mode === "open-ended") {
      const { sys, user } = openEndedMessages(body);
      const text = await callLLM(key, sys, user, true);
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return reply(502, { ok: false, error: "model returned non-JSON" });
      }
      return reply(200, {
        ok: true,
        prompt: parsed.prompt || "",
        answer: parsed.answer || "",
        explanation: parsed.explanation || "",
        verified: false,
      });
    }

    if (body.mode === "parse-drill-intent") {
      // Map free text onto the KNOWN drill vocabulary. The model proposes a
      // spec (topicKeys + difficulty window + count); the CLIENT snaps it back
      // onto the vocabulary (drops unknown keys, clamps orders/count) before use,
      // so a malformed proposal degrades safely to the deterministic parser.
      //
      // Low temperature + a tight token cap keep the spec stable and cheap, and
      // we parse DEFENSIVELY (tolerating ```json fences / stray prose). A reply
      // we can't parse degrades to `topicKeys: []` — a 200 the client reads as
      // "no usable topic" and falls back to its deterministic parser, rather
      // than a hard error. Non-string topicKeys are dropped so the client's
      // vocabulary check only ever sees candidate strings.
      const { sys, user } = parseDrillIntentMessages(body);
      const text = await callLLM(key, sys, user, true, {
        maxTokens: 200,
        temperature: 0.1,
      });
      const parsed = safeParseJson(text) || {};
      return reply(200, {
        ok: true,
        topicKeys: asStringArray(parsed.topicKeys),
        minOrder: parsed.minOrder,
        maxOrder: parsed.maxOrder,
        count: parsed.count,
      });
    }

    if (body.mode === "hint") {
      // Rephrase ONE deterministic rung's wording, then re-guard server-side:
      // preserve the context numbers AND never leak the answer. On any failure
      // we tell the client to keep its original deterministic rung.
      const { sys, user } = hintMessages(body);
      const candidate = await callLLM(key, sys, user, false);
      const check = verifyHint(
        body.rung || "",
        candidate,
        body.answer,
        body.requiredNumbers,
      );
      if (!check.ok) {
        return reply(200, { ok: false, error: `guardrail:${check.reason}` });
      }
      return reply(200, { ok: true, hint: candidate });
    }

    if (body.mode === "self-explain") {
      // Decompose-then-verify: the client already ran the VERIFIER and sends its
      // FIXED verdict (correct + failedCheck). The LLM ONLY narrates around it.
      // We echo the verifier's verdict back verbatim and add advisory narration;
      // the client ignores anything but the narration string regardless.
      const { sys, user } = selfExplainMessages(body);
      const narration = await callLLM(key, sys, user, false);
      return reply(200, {
        ok: true,
        correct: !!body.correct,
        failedCheck: body.failedCheck ?? null,
        narration: narration || "",
      });
    }

    if (body.mode === "mock-reason-grade") {
      // Judge ONLY reasoning quality around the client's FIXED `correct` verdict.
      // The response carries no correctness field, so the model can never flip it.
      // Malformed/partial JSON degrades to safe defaults ("partial", [], "").
      const { sys, user } = mockReasonGradeMessages(body);
      const text = await callLLM(key, sys, user, true, {
        maxTokens: 600,
        temperature: 0.3,
      });
      const parsed = safeParseJson(text) || {};
      const reasoningQuality = oneOf(
        parsed.reasoningQuality,
        ["sound", "partial", "flawed", "ambiguous", "vague", "absent"],
        "partial",
      );
      // A clarify prompt only rides along with the ambiguous verdict; drop it
      // otherwise so a stray field can never trigger a needless clarify round.
      const clarifyPrompt =
        reasoningQuality === "ambiguous"
          ? asString(parsed.clarifyPrompt, "")
          : "";
      return reply(200, {
        ok: true,
        reasoningQuality,
        issues: asStringArray(parsed.issues),
        probe: asString(parsed.probe, ""),
        clarifyPrompt,
      });
    }

    if (body.mode === "mock-review-reasoning") {
      // Verifier-GROUNDED span review. The response carries NO correctness field;
      // the client reconciles every span against deterministic checks (drops a
      // coincidental green, flips a false-arithmetic green) so the model can never
      // manufacture correctness. Malformed JSON degrades to an empty span list,
      // which the client reads as "fall back to the deterministic annotator".
      const { sys, user } = mockReviewReasoningMessages(body);
      const text = await callLLM(key, sys, user, true, {
        maxTokens: 900,
        temperature: 0.3,
      });
      const parsed = safeParseJson(text) || {};
      const rawSpans = Array.isArray(parsed.spans) ? parsed.spans : [];
      const spans = [];
      for (const s of rawSpans) {
        if (!s || typeof s !== "object") continue;
        const start = Number(s.start);
        const end = Number(s.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        // Normalize the model's "bad" onto the client's "flawed" vocabulary.
        const label =
          s.label === "good" ? "good" : s.label === "bad" || s.label === "flawed" ? "flawed" : null;
        if (!label) continue;
        spans.push({
          start,
          end,
          label,
          why: asString(s.why, ""),
        });
      }
      return reply(200, {
        ok: true,
        spans,
        assessment: asString(parsed.assessment, ""),
      });
    }

    if (body.mode === "mock-clarify-grade") {
      // Grade the ONE clarifying answer strictly. The client stays authoritative;
      // this only returns resolved yes/no + issues. Malformed JSON degrades to the
      // conservative default ("no" — unresolved), so ambiguity never passes.
      const { sys, user } = mockClarifyGradeMessages(body);
      const text = await callLLM(key, sys, user, true, {
        maxTokens: 400,
        temperature: 0.2,
      });
      const parsed = safeParseJson(text) || {};
      return reply(200, {
        ok: true,
        resolved: oneOf(parsed.resolved, ["yes", "no"], "no"),
        issues: asStringArray(parsed.issues),
      });
    }

    if (body.mode === "mock-followup") {
      // Generate ONE standalone adversarial follow-up. No grading happens here;
      // missing fields degrade to empty strings so the client never crashes.
      const { sys, user } = mockFollowupMessages(body);
      const text = await callLLM(key, sys, user, true, {
        maxTokens: 700,
        temperature: 0.8,
      });
      const parsed = safeParseJson(text) || {};
      return reply(200, {
        ok: true,
        question: asString(parsed.question, ""),
        idealAnswerNote: asString(parsed.idealAnswerNote, ""),
      });
    }

    if (body.mode === "mock-diagnosis") {
      // Turn the client's deterministically-computed summary into honest prose.
      // The model may not invent stats; malformed JSON degrades to safe defaults
      // ("borderline", empty arrays) so the diagnosis screen still renders.
      const { sys, user } = mockDiagnosisMessages(body);
      const text = await callLLM(key, sys, user, true, {
        maxTokens: 1400,
        temperature: 0.4,
      });
      const parsed = safeParseJson(text) || {};
      return reply(200, {
        ok: true,
        verdict: asString(parsed.verdict, ""),
        wouldPass: oneOf(parsed.wouldPass, ["yes", "borderline", "no"], "borderline"),
        strengths: asStringArray(parsed.strengths),
        weaknesses: asStringArray(parsed.weaknesses),
        nextSteps: asStringArray(parsed.nextSteps),
      });
    }

    // Default: flavor mode.
    const { sys, user } = flavorMessages(body);
    const candidate = await callLLM(key, sys, user, false);
    const check = verifyFlavor(body.prompt || "", candidate, body.requiredNumbers);
    if (!check.ok) {
      // Server-side guardrail failed — tell the client to fall back.
      return reply(200, { ok: false, error: `guardrail:${check.reason}` });
    }
    return reply(200, { ok: true, prompt: candidate });
  } catch (e) {
    console.warn("LLM call failed:", e?.message);
    return reply(502, { ok: false, error: "LLM call failed" });
  }
};
