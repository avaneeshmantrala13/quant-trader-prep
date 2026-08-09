# AI Lambda Mode Contract (`mock-reason-grade`, `mock-clarify-grade`, `mock-extract-claims`, `mock-review-reasoning`, `mock-followup`, `mock-diagnosis`, `parse-drill-intent`)

Client-facing request/response contract for the additional LLM modes on the AI
Lambda (`infra/lambda/ai-flavor/index.mjs`): the four **mock-interview** modes
(`mock-reason-grade`, `mock-clarify-grade`, `mock-followup`, `mock-diagnosis`)
plus the Custom Drill Builder's **`parse-drill-intent`** mode (see
[Mode 4](#mode-4--parse-drill-intent-custom-drill-builder)). The client builds
strictly against this document.

- **Endpoint:** `POST ${VITE_AI_ENDPOINT}/ai`
  (AWS: `https://<api-id>.execute-api.<region>.amazonaws.com/ai`; local dev:
  `http://localhost:8788/ai` via `npm run ai:dev` — see
  [`infra/AI_ENABLE.md`](../infra/AI_ENABLE.md)).
- **One router, two hosts:** the prompt builders + guardrails + mode dispatch
  live in `infra/lambda/ai-flavor/core.mjs` (`routeAiRequest`), imported by BOTH
  the AWS Lambda (`index.mjs`) and the local dev server
  (`scripts/ai-dev-server.mjs`), so localhost behavior === prod behavior for
  every mode below.
- **Transport:** same as every existing mode — call `postAi(cfg, env, body, signal)`
  from `src/lib/aiFlavor.ts`. Dispatch is by the request `body.mode` string.
- **Auth:** the route has a **Cognito JWT authorizer**. `postAi` already attaches
  the Cognito ID token as the `Authorization` header. An unauthenticated request
  returns HTTP `401 {"message":"Unauthorized"}` from API Gateway *before* the
  Lambda runs.
- **Content type:** `application/json` in and out. CORS allow-origin is the
  configured origin (localhost + prod Amplify URL).

## Non-negotiable design invariant (why these modes are safe)

The LLM is **~56% reliable as a grader**, so it **never decides correctness**.
A deterministic client-side verifier owns every correctness/score number and
passes it in. These modes only:

1. judge **reasoning quality** on the *committed conclusion* (`mock-reason-grade`),
   emitting an `ambiguous` verdict + `clarifyPrompt` for mixed/contradictory answers,
2. grade the ONE **clarifying answer** strictly (`mock-clarify-grade`) — resolved yes/no,
3. generate **adversarial follow-ups** (`mock-followup`), and
4. write the final **diagnosis prose + specific weaknesses** (`mock-diagnosis`).

**The response schemas contain NO correctness/score field.** There is structurally
no channel for the model to flip or override the client's `correct` verdict or the
client-computed score — the Lambda never echoes a model-decided correctness back.
`correct` (in `mock-reason-grade`) is passed *to* the model as fixed context only.

## Universal response guarantees (all mock modes)

- On a successful model call the Lambda returns HTTP **200** with `{"ok": true, ...}`
  and **every documented field always present** with the correct type.
- **Graceful degradation:** the model is prompted for strict JSON, but the Lambda
  **never trusts it**. It parses defensively (tolerating markdown ` ```json ` fences
  or stray prose around the object). If parsing fails or a field is missing/wrong-typed,
  that field falls back to a safe default (see each mode). The client therefore
  **never crashes** on a malformed model reply — it just gets defaults.
- **Hard failures** (LLM network/error, SSM key missing, bad JSON *in the request*)
  return a non-200 (`502`/`500`/`400`) with `{"ok": false, "error": "..."}`. Per
  `postAi`, any non-2xx makes the client receive `null` and fall back. Callers
  should treat `null` as "AI unavailable, proceed without it."
- Enum fields are validated server-side against their allowed set; an out-of-set
  value from the model is replaced by the default.
- `string[]` fields drop any non-string / blank entries (may be `[]`).

> Note on the deployed model: the live endpoint currently runs an
> OpenAI-compatible gateway model (`claude-...`) that may wrap output in
> ` ```json ` fences and can be verbose. The Lambda strips fences and uses token
> caps sized for full responses (600 / 700 / 1400 tokens respectively), so the
> defensive parser rarely has to fall back in practice.

---

## Mode 1 — `mock-reason-grade`

Judge the QUALITY of a candidate's written/spoken reasoning for ONE question,
given the ground-truth answer and the verifier's authoritative `correct` verdict.

### Request

```jsonc
{
  "mode": "mock-reason-grade",
  "prompt": "string — the interview question",
  "correctAnswer": "string — ground-truth answer (verifier's truth)",
  "correct": true,            // boolean — verifier's verdict; AUTHORITATIVE, model may not contradict
  "reasoning": "string — the candidate's written/spoken reasoning",
  "concept": "probability",   // optional string
  "isMentalMath": false,       // optional boolean
  "mechanismSignals": [        // optional string[] — accepted phrasings that PROVE the
    "second difference",       //   candidate engaged this question's MECHANISM. When
    "differences grow by 6",   //   present, a `sound` verdict REQUIRES ≥1 to appear;
    "quadratic"                //   a conclusion-only / hand-wave answer must NOT be sound.
  ]
}
```

### Response (HTTP 200)

```jsonc
{
  "ok": true,
  "reasoningQuality": "partial",   // "sound" | "partial" | "flawed" | "ambiguous" | "vague" | "absent"
  "issues": [                       // string[] — concrete, specific critiques; [] if none
    "states the formula but never plugs in the given 0.3"
  ],
  "clarifyPrompt": "",              // string — non-empty ONLY when reasoningQuality === "ambiguous"; else ""
  "probe": "One sharp adversarial follow-up…"   // string; "" if nothing useful
}
```

### Field semantics

| Field | Meaning |
|---|---|
| `reasoningQuality` | Graded on the **committed conclusion**, not keyword presence. `sound` = commits to ONE answer, every step correct, complete, and **demonstrates the underlying MECHANISM / justification specific to the question** — it must NOT merely restate the final numeric answer or the last arithmetic step (e.g. "65 + 30 is 95"), nor assert correctness without substance ("the math checks out / it's obvious / I computed it / trust me"). When `mechanismSignals` are supplied, a `sound` verdict REQUIRES the reasoning to convey ≥1 of them (or an equivalent mechanism); a conclusion-only / hand-wave answer is **`partial`** (or `ambiguous` if it has a partial right idea), never `sound`. `partial` = commits clearly but a step/justification/mechanism is missing, or it reaches a wrong result; `flawed` = contains a **false arithmetic step** or a **nonsensical / non-sequitur** chain that doesn't validly reach the answer — **used even when the final answer is correct**; `ambiguous` = **mixed / self-contradictory / hedged / both-sides**, OR the conclusion conflicts with its own stated reason, OR a single committed conclusion cannot be confidently extracted (this is the **anti-gaming verdict**: a true fact quoted alongside a wrong-side commitment lands here, never in `sound`/`partial`) — it triggers a **clarifying follow-up**; `vague` = hand-wavy, asserts without showing work; `absent` = no real reasoning. |
| `issues` | Specific, concrete critiques of the *reasoning* (never of the answer's correctness). For a `flawed` grade the issue **names the exact wrong step and the correct value** (e.g. `you wrote "1 divided by 2 is 5" — that's wrong; 1 ÷ 2 = 0.5`). For `ambiguous`, it names the two sides in tension (e.g. `you concluded "yes, same" but "both can't occur" implies DIFFERENT`). `[]` when the reasoning is clean. |
| `clarifyPrompt` | Present (non-empty) **only** when `reasoningQuality === "ambiguous"`. ONE sentence that NAMES the two sides/values in tension and forces the candidate to commit (e.g. `You concluded X but your reasoning suggests Y — commit to ONE answer and give the single reason it's correct.`). The client also has a deterministic generic fallback, and uses this AI prompt when supplied. `""` for every other quality. |
| `probe` | ONE sharp adversarial follow-up / challenge that stress-tests or breaks their logic, or asks a harder variation. `""` when nothing useful. |

### Committed-conclusion grading & the anti-gaming rule (added 2026-08)

The grader (both the deterministic client fallback and this AI prompt) judges **what
side/value the candidate actually committed to**, then checks that valid,
non-contradictory reasoning supports it. Quoting the correct term or a true fact
somewhere is **not** enough. **Concrete gaming example that MUST NOT pass:**

- Question: *"Would this probability be the same if the two events were mutually
  exclusive instead of independent?"* — verified answer **NO / DIFFERENT**
  (independent nonzero events have `P(A∩B)=P(A)P(B)>0`; mutually exclusive have
  `P(A∩B)=0`).
- Gaming answer: *"yes, it would because they are mutually exclusive so it would not
  be possible for both of the events to occur."* — commits to the **wrong** side
  ("yes, same") while quoting a **true** fact ("both can't occur"), and is internally
  **contradictory** (the reason implies DIFFERENT).
- **Correct handling:** `reasoningQuality: "ambiguous"` with a `clarifyPrompt` naming
  the tension → triggers ONE clarify round. It is **never** `sound`/`partial`. A
  clarification that still hedges/contradicts or commits wrong → **missed**; a
  clarification that now commits to "no / different" with a valid reason → **correct**.
  (One clarify round only — no loops.)

### Rules honored by the server prompt

- **Critical evaluation:** the model **recomputes every explicit stated step** and checks
  logical validity. A correct FINAL answer does **not** make the reasoning `sound`; a
  false/nonsensical step is rated `flawed` even when `correct` is `true`.
- **Mechanism required for `sound`:** restating the final answer / last arithmetic
  ("65 + 30 is 95") or asserting correctness with no substance ("the math checks out",
  "it's obvious", "trivially", "by inspection", "trust me", "I just computed it")
  **never** earns `sound` on its own — the reasoning must articulate the justifying
  MECHANISM (e.g. for `5, 11, 23, 41, 65 → 95`: the first differences grow by a constant
  6, so the SECOND difference is constant — a quadratic pattern — hence the next gap is
  30). When `mechanismSignals` are provided, require ≥1 (or a clear equivalent) before
  grading `sound`; otherwise grade `partial`. **Do NOT over-reject** a concise-but-correct
  explanation that names the mechanism tersely (e.g. "second differences are constant at
  6, so next gap 30 → 95") — that is `sound`.
  (Verified: reasoning `"1 divided by 2 is 5 so … 0.5"` on a correct item → `"flawed"`,
  with an issue naming `1 ÷ 2 = 0.5`.)
- **Mental math:** if `isMentalMath` is `true`, terse reasoning is **not** penalized —
  a fast correct number is fine, so it will **not** be rated `vague`/`absent` merely
  for brevity. (Verified: reasoning `"102"` on a MM item → `"sound"`.) A **wrong stated
  computation is still `flawed`** even in mental math.
- **Incorrect answers:** if `correct` is `false`, the `probe` nudges toward the flaw
  **without revealing the final answer**. (Verified: no leak of `3/8`.)
- The model treats `correct` as fixed truth and never contradicts/re-grades it.
- **Phrasing/notation/method neutrality (recall guard, added 2026-08):** the prompt now
  explicitly instructs the model NOT to penalize varied wording, notation (symbolic
  recurrences like `aₙ = aₙ₋₁ + aₙ₋₂`, plain English, fractions vs. decimals vs.
  percentages, spelled numbers like "two-thirds", currency like `-$0.50`), brevity, or a
  **different-but-valid method** that correctly reaches the conclusion — it judges the
  **logic**, not the phrasing. Mirrors the deterministic grader, which now word-boundary-
  matches short conclusion words and parses spelled fractions / currency-signed negatives.
  **Requires a Lambda deploy to take effect.**

### Graceful-degradation defaults

| Field | Default on parse failure / missing / wrong type |
|---|---|
| `reasoningQuality` | `"partial"` (neutral, non-punitive) |
| `issues` | `[]` |
| `clarifyPrompt` | `""` (client falls back to its deterministic generic clarify prompt) |
| `probe` | `""` |

> **DEPLOY REQUIRED.** The committed-conclusion grading, the new `ambiguous`
> verdict, the `clarifyPrompt` field, and the `mock-clarify-grade` mode below are
> all server-prompt/handler changes in `infra/lambda/ai-flavor/index.mjs` that only
> take effect after a Lambda deploy. Until then the client uses its **conservative
> deterministic path**, which already implements committed-conclusion grading and
> `ambiguous` → clarify, so nothing regresses pre-deploy.

### Working curl (requires a valid Cognito ID token)

```bash
JWT="<paste a valid Cognito ID token>"
curl -s -X POST "$VITE_AI_ENDPOINT/ai" \
  -H "content-type: application/json" \
  -H "authorization: $JWT" \
  -d '{
    "mode": "mock-reason-grade",
    "prompt": "A fair coin is flipped 3 times. P(exactly 2 heads)?",
    "correctAnswer": "3/8",
    "correct": true,
    "reasoning": "There are 8 outcomes and 3 have two heads so 3/8.",
    "concept": "probability",
    "isMentalMath": false
  }'
```

Example 200 response (from the live smoke test):

```json
{
  "ok": true,
  "reasoningQuality": "partial",
  "issues": [
    "Candidate states '3 of them have two heads' without identifying which outcomes (HHT, HTH, THH)",
    "Does not show how the 8 total outcomes were derived (2^3)"
  ],
  "probe": "Can you derive the count of 3 favorable outcomes using C(n,k) and confirm it matches your enumeration?"
}
```

---

## Mode 1b — `mock-clarify-grade`

Grade the candidate's ONE clarifying answer **strictly**. A clarify round only
fires after an `ambiguous` (mixed / contradictory / hedged) first answer; the
candidate must now COMMIT to the correct side with a valid, non-contradictory
reason. This is a hard pass/fail — there is **no second clarify round**, and an
unresolved clarification means the item is **missed**.

The deterministic client is authoritative (it grades the clarification with the
same committed-conclusion logic); this mode only sharpens the resolved/unresolved
judgement when the AI layer is on. The model may **never** flip a clarification the
client already resolved into "correct" — it only returns `resolved` + `issues`.

### Request

```jsonc
{
  "mode": "mock-clarify-grade",
  "prompt": "string — the original interview question",
  "correctAnswer": "string — ground-truth answer (verifier's truth)",
  "clarifyPrompt": "string — the clarify prompt that was shown (names the tension)",
  "reasoning": "string — the candidate's ORIGINAL (ambiguous) reasoning",
  "clarification": "string — the candidate's ONE clarifying answer",
  "concept": "probability"   // optional string
}
```

### Response (HTTP 200)

```jsonc
{
  "ok": true,
  "resolved": "no",           // "yes" | "no" — "yes" ONLY if they now commit to the correct side with a valid reason
  "issues": [                  // string[] — why it is still unresolved; [] when resolved
    "still says 'yes, the same' — that commits to the wrong side"
  ]
}
```

### Field semantics & rules

| Field | Meaning |
|---|---|
| `resolved` | `"yes"` **only** when the clarification commits clearly to the **correct** side/value AND gives a valid, non-contradictory reason. `"no"` if it still hedges, contradicts itself, commits to the wrong side, or names the right side with an irrelevant/invalid justification. |
| `issues` | Concrete critiques naming exactly why it is unresolved; `[]` when resolved. |

- **SAFETY DEFAULT:** when unsure whether they cleanly committed to the correct side
  with a valid reason, return `"no"`. Ambiguity never resolves to correct.
- **Graceful degradation:** malformed/partial JSON → `resolved: "no"`, `issues: []`
  (conservative: an unparseable clarification is treated as unresolved → missed).
- Mirrors the deterministic client helpers `gradeClarification` /
  `gradeMainClarification`, which grade the clarification in **strict** mode.

---

## Mode 1c — `mock-extract-claims` (EXTRACT-AND-VERIFY translator)

The backbone of the **claims-based** reasoning grader (`src/lib/mock/claims.ts`).
The model's ONLY job is **TRANSLATION**: turn the candidate's free-text reasoning
into a STRUCTURED list of discrete, checkable **claims**. It **does not judge
correctness** — the client re-derives the verdict 100% deterministically from the
returned claims (`gradeReasoningFromClaims`), so this mode is **non-jailbreakable**
by construction (a correct final answer paired with a false/missing load-bearing
claim still fails on the client). This is what makes grading both **general**
(accepts any wording/method the model can normalize) and **safe**.

### Request

```jsonc
{
  "mode": "mock-extract-claims",
  "prompt": "…the question text…",
  "correctAnswer": "129",     // string — context ONLY; the model must NOT copy it into claims
  "reasoning": "…candidate's free-text reasoning…",
  "concept": "seqn-poly-demo" // string | null — archetype hint (optional)
}
```

### Response (HTTP 200)

```jsonc
{
  "ok": true,
  "claims": [
    { "kind": "arithmetic",   "text": "24 + 6 = 30", "expr": "24 + 6", "value": 30 },
    { "kind": "mechanism",    "text": "the gaps grow by a constant 6", "mechanism": "first differences grow by a constant" },
    { "kind": "final-answer", "text": "so the next term is 129", "value": 129 }
  ]
}
```

### Field semantics

| Field | Meaning |
|---|---|
| `claims[].kind` | One of `"arithmetic"` \| `"final-answer"` \| `"mechanism"` \| `"quantity"`. Anything else is dropped by `normalizeClaimsPayload`. |
| `claims[].text` | The clause the claim came from (verbatim-ish); used for feedback. |
| `claims[].expr` | `arithmetic` only: the left-hand expression, e.g. `"24 + 6"`. The client **re-evaluates** it and rejects the claim if it does not equal `value` (false-arithmetic guard). |
| `claims[].value` | `arithmetic`/`final-answer`/`quantity`: the stated numeric value. Strings are parsed with `parseNumericValue`. |
| `claims[].mechanism` | `mechanism` only: a short **canonicalized** description of the method invoked (the model normalizes arbitrary wording onto a method phrase). |

### Rules honored by the server prompt

- **Translate, do not judge.** Never emit a verdict, score, or the word "correct".
  Never invent claims not present in the reasoning; never copy `correctAnswer` into
  a `final-answer` claim unless the candidate actually stated it.
- **Faithful arithmetic.** Report the stated `expr` and stated `value` **as written**
  (even if wrong) — the client catches false steps. Do NOT silently "fix" the math.
- **Canonicalize mechanisms.** Map paraphrases ("the jumps get bigger by the same
  amount") onto a concise method phrase ("first differences grow by a constant").

### Graceful-degradation defaults

- Malformed/partial JSON, a non-200, a stubbed/absent AI config, or an **empty**
  `claims` array → the client falls back to `extractClaimsDeterministic` (regex over
  `=`-chains + stated-result values + signal/rubric mechanism matches). A `ClaimSet`
  is therefore **always** produced and the verdict is **byte-identical** to
  `gradeReasoningDeterministic` when the AI layer is off — no behavior regression.
- Because the verdict is deterministic, a hostile or broken extraction can only make
  grading **stricter** (drop claims) — it can never manufacture a passing verdict.

---

## Mode 1d — `mock-review-reasoning` (verifier-GROUNDED span review)

The backbone of the **real LLM reasoning REVIEW** (`src/lib/mock/aiMock.ts#reviewReasoning`).
Distinct from the translation-only `mock-extract-claims`: here the model reads the
candidate's reasoning **against the verified answer + a canonical derivation** and
returns **disjoint character spans** over the candidate text tagged `good`/`bad`,
each with **specific, human feedback**, plus an overall assessment.

**Non-jailbreakable by construction.** The deterministic verifier stays
AUTHORITATIVE for correctness. The client decides pass/fail on the candidate's
COMMITTED answer deterministically; this mode NEVER carries a correctness verdict.
Every returned span is **reconciled** against deterministic checks on the client
(`reconcileReviewSpans`): a `good` span that is actually a FALSE stated computation
is **flipped** to `bad` with the corrected arithmetic; a `good` span that isn't
grounded (a coincidental number, or any "correct value" claim on an answer the
verifier marked wrong) is **dropped**. So a hallucinated green (e.g. the `2` inside
`(n+1)²` on a wrong answer) can never survive, and the review can never upgrade a
wrong committed answer to correct.

### Request

```jsonc
{
  "mode": "mock-review-reasoning",
  "prompt": "…the question text…",
  "correctAnswer": "a = 2, b = -1, c = 3", // string — context
  "verifiedAnswer": 2,                       // number | null — the numeric truth, grounds "good" value spans
  "canonicalDerivation": "Second differences are constant at 4 ⇒ a = Δ²/2 = 2 …", // string | null
  "closedForm": "2n² − n + 3",              // string | null
  "keyShortcut": "constant second difference ⇒ a = Δ²/2", // string | null
  "reasoning": "The sequence is just (n+1)^2 … so a,b,c are 1,2,1", // candidate text
  "concept": "seqn-quadratic",              // string | null
  "mechanismSignals": ["second difference", "Δ²/2"], // string[] — accepted method phrasings
  // VERIFIER-COMPUTED FACTS (sequence family; null for non-sequences). The client
  // computes these DETERMINISTICALLY from the prompt + the candidate's own text
  // (`aiMock.ts#buildVerifierFacts`, reusing the `reasoning.ts` parsers) and hands
  // them to the model to GROUND localization — see rules below.
  "verifierFacts": {
    "trueTerms": [5, 11, 23, 41, 65],       // number[] — the prompt's actual terms
    "candidateFormula": "3n^2 - n + 3",     // string | null — the candidate's PARSED committed closed form
    "candidateValues": [5, 13, 27, 47, 73], // number[] | null — that formula's values at n = 1,2,…
    "counterexample": "your formula 3n^2 - n + 3 gives 13 at n=2 but the sequence is 11", // string | null
    "earliestFalseClaim": "1 more at n=2",  // string | null — the earliest FALSE per-n residual/pattern claim
    "earliestFalseClaimWhy": "3n^2 is 12 at n=2 and the term is 11 — that's 1 less, not 1 more." // string | null
  }
}
```

### Response (HTTP 200)

```jsonc
{
  "ok": true,
  "spans": [
    // start/end are character offsets into the EXACT `reasoning` string above.
    { "start": 0,  "end": 30, "label": "bad",  "why": "You assumed the sequence is (n+1)², but that gives 4, 9, 16, 25 — not the actual terms — so the whole a,b,c falls out wrong." },
    { "start": 45, "end": 50, "label": "good", "why": "You correctly set up three equations in a, b, c." }
  ],
  "assessment": "The setup method is right, but the pattern was mis-identified at the very first step."
}
```

### Field semantics

| Field | Meaning |
|---|---|
| `spans[].start` / `spans[].end` | Character offsets into the candidate `reasoning`. Clamped to bounds and de-overlapped client-side (flawed wins). |
| `spans[].label` | `"good"` (correct/load-bearing) or `"bad"`/`"flawed"` (a specific wrong claim). Reconciled: an ungrounded `good` is dropped; a false-arithmetic `good` is flipped to flawed. |
| `spans[].why` | Specific, human feedback that QUOTES the candidate's own words; never a generic template. Kept verbatim for flawed spans; corrected for flipped ones. |
| `assessment` | Advisory overall note; never changes correctness. |

### Rules honored by the server prompt

- **Localize + explain, never grade correctness.** No pass/fail, no score, no
  "correct" verdict in the payload — correctness is the client's deterministic call.
- **Ground every "good" span.** Only mark a step `good` if it is a genuinely correct
  load-bearing step (a holding computation, a valid named mechanism, or the committed
  answer equal to `verifiedAnswer`). NEVER mark a number `good` just because it
  happens to match part of the answer.
- **Localize the root cause when wrong.** Point the `bad` span at the specific broken
  premise / mis-identified closed form and explain WHY against the actual terms,
  without revealing the final answer.
- **Verifier-grounded localization (`verifierFacts`, added 2026-08, sequence family).**
  When `verifierFacts` is present the model is instructed to (1) critique the
  candidate's **actual committed formula** (`candidateFormula`) — never a mis-read or
  mid-word substring, and **never** invent/evaluate an expression the candidate did not
  write (this kills the reported `n 3n^2` → `3n^3` cubic hallucination); (2) make the
  primary `bad` span map to the exact literal `earliestFalseClaim` text when present
  (the earliest FALSE per-`n` residual claim — earlier and more load-bearing than the
  final formula line); and (3) phrase every counterexample with the verifier's real
  numbers (`counterexample` / `candidateValues` vs `trueTerms`), not its own arithmetic.
  These facts are **advisory grounding only** — `reconcileReviewSpans` stays
  AUTHORITATIVE and still drops/flips any span that contradicts the deterministic
  verifier, so a hostile or empty `verifierFacts` can never upgrade a wrong answer.
  The client computes them via `aiMock.ts#buildVerifierFacts` (reusing
  `parseCommittedClosedForm` / `checkCommittedFormula` / `findFalseResidualClaim` in
  `reasoning.ts`), so the grounding facts match the offline annotator exactly.

### Graceful-degradation defaults

- Malformed/partial JSON, a non-200, a stubbed/absent AI config, or **no usable span
  surviving reconciliation** → the client falls back to the DETERMINISTIC annotator
  (`annotateReasoning` + `findPremiseFlaw` + `findClosedFormMismatch`), the offline
  floor. The highlight path is therefore identical whether or not the LLM ran.

---

## Mode 2 — `mock-followup`

Generate ONE standalone adversarial follow-up question, independent of reasoning
grading (e.g. after a correct answer, ask a harder variation to test genuine
understanding vs. memorization).

### Request

```jsonc
{
  "mode": "mock-followup",
  "prompt": "string — the original question",
  "correctAnswer": "string — reference answer to the original",
  "reasoning": "string",       // optional — the candidate's reasoning, for targeting
  "concept": "probability",    // optional string
  "difficulty": "harder"        // optional: "harder" | "variation" | "break-logic" (default "harder")
}
```

`difficulty` semantics:
- `harder` — raise the difficulty (understanding vs. memorization).
- `variation` — change the setup to test transfer of the idea.
- `break-logic` — designed to expose a likely misconception / break flawed logic.

An unknown/absent `difficulty` is treated as `"harder"`.

> **No schema change for the 2026 firm-signature follow-ups.** The authored
> AI-off backbone now includes firm-signature adversarial styles transcribed from
> `FIRM_INTERVIEW_LIVE_RESEARCH_2026.md` — Jane Street's *mutation cascade*
> (probe changes a rule; adversarial generalizes-to-n), IMC's *challenge-a-correct-
> answer* (hold firm with justification; caving is graded wrong), SIG's
> *confidence→bet-size*, Citadel's *bet-on-your-own-probability*, and DRW's
> *deliberately-underdetermined triage* item. These are **authored `FollowupSeed`s**
> on the question generators and are graded 100% client-side via conclusion value(s)
> + keyword groups (`answerKind:"reasoning"`) or exact numeric targets — so this
> `mock-followup` request/response contract is UNCHANGED and the LLM still never
> decides correctness. The live AI follow-up may still be requested and, when
> present, is classified + graded exactly as before. **No new Lambda deploy is
> required for these patterns** (the earlier `mock-diagnosis` prompt rewrite is
> still the only pending deploy).

### Response (HTTP 200)

```jsonc
{
  "ok": true,
  "question": "string — one standalone follow-up question",
  "idealAnswerNote": "string — brief note on what a strong answer contains (for the client to STORE, not necessarily shown)"
}
```

### Field semantics

| Field | Meaning |
|---|---|
| `question` | A single, self-contained, answerable follow-up question. |
| `idealAnswerNote` | Interviewer-side note describing a strong answer (grading aid / storage). Not required to be shown to the candidate. |

> **Deterministic-gradability rule (added 2026-08, requires Lambda deploy).** The client
> extracts the intended target from `idealAnswerNote` via `extractTargetAnswer`: it reads the
> value after the **last** `=`/`→`. The prompt now instructs the model, for a numeric
> follow-up, to **end the note with the single final value after an `=`** (e.g. `… = 0.25`)
> and emit **no stray trailing numbers**, and for a conceptual follow-up to state the required
> conclusion in plain words. This keeps AI follow-ups gradable by the same client-side verifier
> that owns correctness. The authored follow-up backbone (`questionPools.ts`) is unaffected.

### Graceful-degradation defaults

| Field | Default |
|---|---|
| `question` | `""` — client should treat empty `question` as "no follow-up available." |
| `idealAnswerNote` | `""` |

### Working curl

```bash
curl -s -X POST "$VITE_AI_ENDPOINT/ai" \
  -H "content-type: application/json" \
  -H "authorization: $JWT" \
  -d '{
    "mode": "mock-followup",
    "prompt": "A fair coin is flipped 3 times. P(exactly 2 heads)?",
    "correctAnswer": "3/8",
    "reasoning": "8 outcomes, 3 favorable, 3/8.",
    "concept": "probability",
    "difficulty": "harder"
  }'
```

Example 200 response (from the live smoke test):

```json
{
  "ok": true,
  "question": "You flip a fair coin until you get heads. Given that you needed more than one flip, what is the conditional probability that you needed exactly 3 flips?",
  "idealAnswerNote": "P(exactly 3 | >1 flip) = P(TTH)/P(first flip tails) = (1/8)/(1/2) = 1/4. Watch for candidates who misapply memorylessness or confuse the conditioning event."
}
```

---

## Mode 3 — `mock-diagnosis`

Write the final brutal-but-fair interview diagnosis. The **client** computes every
performance number deterministically and passes a compact, PII-minimized summary.
The LLM turns those numbers into honest prose + specific weaknesses. It must **not**
invent stats beyond what is provided.

### Request

```jsonc
{
  "mode": "mock-diagnosis",
  "summary": {
    "scorePct": 62,              // number — overall %
    "mathCorrect": 7,            // number — BLENDED math accuracy (all scored math)
    "mathTotal": 10,             // number
    "avgMathMs": 14200,          // number — avg ms per math item
    "brainteaserCorrect": 2,     // number
    "brainteaserTotal": 4,       // number
    "followupCorrect": 1,        // number — probe + adversarial combined
    "followupTotal": 3,          // number
    "probeCorrect": 1,           // number — Follow-up 1 (deepen the principle)
    "probeTotal": 2,             // number
    "adversarialCorrect": 0,     // number — Follow-up 2 (challenge the logic / generalize)
    "adversarialTotal": 1,       // number
    "mmPnl": -120,               // optional number — market-making P&L
    "mmVerdict": "quoted too wide, missed flow",  // optional string
    "reasoningTags": { "sound": 3, "partial": 4, "flawed": 2, "vague": 5, "absent": 1 },
    "correctButVagueCount": 4,   // number — correct answers with weak/flawed reasoning
    "tier": "top-tier prop desk", // string — target desk tier
    // PER-COMPETENCY tallies ({correct,total}); a competency the preset did not
    // test is OMITTED (e.g. SIG has no `speed`). The model grades each separately.
    "speed": { "correct": 2, "total": 3 },       // optional — mental-math speed gate
    "speedAvgMs": 7200,                            // optional — avg ms per speed item
    "probEv": { "correct": 3, "total": 5 },       // optional — probability & EV
    "sequences": { "correct": 1, "total": 2 },    // optional — pattern recognition
    "estimation": { "correct": 1, "total": 2 }    // optional — Fermi estimation
  }
}
```

The client is the source of truth for these numbers; the model is told to ground
everything strictly in them and not fabricate any statistic not present.

> **DEPLOY REQUIRED.** The `mock-diagnosis` server prompt in
> `infra/lambda/ai-flavor/index.mjs` was updated to a STRICT, PER-COMPETENCY,
> site-routing diagnosis (grades speed / probability-EV / sequences / estimation /
> brainteaser / market-making / follow-up / reasoning separately, calls out
> correct-but-vague and "folded on the adversarial follow-up", and routes each gap
> to a specific page: `/arena`, `/ev-timed`, `/drill`, `/fermi`, `/make-market`,
> `/cards-market-making`, `/mock`). The Lambda must be redeployed for the live AI
> prose to reflect this; until then the AI still returns the contract shape and the
> client floors any gaps with the deterministic competency diagnosis, so behavior
> is correct either way.

### Response (HTTP 200)

```jsonc
{
  "ok": true,
  "verdict": "string — one honest sentence on where they stand",
  "wouldPass": "no",            // "yes" | "borderline" | "no"
  "strengths": ["string", ...],  // string[]
  "weaknesses": ["string", ...], // string[] — SPECIFIC
  "nextSteps": ["string", ...]   // string[]
}
```

### Field semantics

| Field | Meaning |
|---|---|
| `verdict` | One brutally-honest-but-fair sentence, grounded only in the numbers (e.g. "Would not clear a first-round screen at a top desk"). |
| `wouldPass` | Overall gate: `yes` / `borderline` / `no`. |
| `strengths` | Specific strengths cited from the numbers. |
| `weaknesses` | SPECIFIC weaknesses. If `correctButVagueCount > 0` it is called out explicitly (e.g. "correct answers but vague reasoning on N items — you'd get pressed and fold"). Vagueness is **never** attributed to mental-math brevity. |
| `nextSteps` | Concrete, actionable practice recommendations. |

### Graceful-degradation defaults

| Field | Default |
|---|---|
| `verdict` | `""` |
| `wouldPass` | `"borderline"` |
| `strengths` | `[]` |
| `weaknesses` | `[]` |
| `nextSteps` | `[]` |

### Working curl

```bash
curl -s -X POST "$VITE_AI_ENDPOINT/ai" \
  -H "content-type: application/json" \
  -H "authorization: $JWT" \
  -d '{
    "mode": "mock-diagnosis",
    "summary": {
      "scorePct": 62, "mathCorrect": 7, "mathTotal": 10, "avgMathMs": 14200,
      "brainteaserCorrect": 2, "brainteaserTotal": 4,
      "followupCorrect": 1, "followupTotal": 3,
      "mmPnl": -120, "mmVerdict": "quoted too wide, missed flow",
      "reasoningTags": {"sound": 3, "partial": 4, "flawed": 2, "vague": 5, "absent": 1},
      "correctButVagueCount": 4, "tier": "top-tier prop desk"
    }
  }'
```

Example 200 response (abridged, from the live smoke test):

```json
{
  "ok": true,
  "verdict": "At 62% overall against a top-tier prop desk bar, with a losing market-making simulation and only 1/3 follow-ups converted, this candidate would not clear a first-round screen.",
  "wouldPass": "no",
  "strengths": [
    "Mental-math accuracy solid at 7/10 (70%).",
    "3 items with sound reasoning show rigor when fully engaged."
  ],
  "weaknesses": [
    "Market-making P&L of -120 ('quoted too wide, missed flow') is a hard red flag on the core skill.",
    "Avg mental-math time 14,200ms is far too slow for a top desk.",
    "4 items answered correctly but with vague reasoning — you got the number right but couldn't defend it; interviewers will press and you will fold."
  ],
  "nextSteps": [
    "Drill mental math under a strict 5s target; cut the 14.2s average by 60%+.",
    "For every correct answer, write the full reasoning chain before checking.",
    "Rebuild the market-making framework: spread theory, adverse selection, inventory risk."
  ]
}
```

---

## Mode 4 — `parse-drill-intent` (Custom Drill Builder)

Translate a learner's **free-text practice request** ("3 questions on markov
chains", "bayes and EV, medium, 12 questions") into a strict JSON **drill spec**.
Used by the Custom Drill Builder (`/drill`, `src/lib/drill/*`). The client calls
this on **Build**; on any failure it silently falls back to the offline
deterministic parser (`parseDrillIntent`).

### Non-negotiable safety invariant

Same "LLM proposes, code verifies" rule as the mock modes: **the model only
PARSES intent — it never invents content and its output is never trusted as-is.**

- The model may **only** choose `topicKey`s from the `vocabulary` array the client
  sends; it is told never to invent a key.
- The client (`snapToVocabulary` in `src/lib/drill/aiIntent.ts`) then **validates
  and clamps** every field before anything is built: unknown `topicKey`s are
  dropped, `minOrder`/`maxOrder` are clamped to `[0, 4]` (and swapped if
  inverted), and `count` is clamped to `[DRILL_COUNT_MIN, DRILL_COUNT_MAX]`
  (`clampCount`). If **no** proposed topic survives validation, the client treats
  the reply as unusable and falls back to the deterministic parser.
- The model never selects a question, an answer, or a difficulty a section
  doesn't have — it only proposes topic keys + a difficulty window + a count.

### Request

```jsonc
{
  "mode": "parse-drill-intent",
  "text": "3 questions on markov chains",   // string — the learner's raw request
  "vocabulary": [                             // the ONLY topicKeys the model may choose
    { "topicKey": "probability::Markov Chains", "label": "Markov Chains",
      "aliases": ["markov", "markov chain", "stationary", "random walk"] }
    // … one entry per drillable section (topicKey + label + up to 6 aliases)
  ],
  "difficultyOrders": { "intro": 0, "easy": 1, "medium": 2, "hard": 3, "expert": 4 },
  "countBand": { "min": 1, "max": 25 }        // allowed inclusive count range
}
```

### Response (HTTP 200)

```jsonc
{
  "ok": true,
  "topicKeys": ["probability::Markov Chains"],  // string[]; chosen from the vocabulary, most relevant first
  "minOrder": 0,                                 // integer difficulty order (inclusive lower bound)
  "maxOrder": 4,                                 // integer difficulty order (inclusive upper bound)
  "count": 3                                     // integer number of questions requested
}
```

### Field semantics

| Field | Meaning |
|---|---|
| `topicKeys` | The sections to draw from, as exact `topicKey` strings taken from the request `vocabulary`. `[]` ⇒ the model recognized no supported topic (client falls back). |
| `minOrder` / `maxOrder` | Inclusive difficulty window on the provided order scale. If the learner named no difficulty, span the full range (`0`…`4`). |
| `count` | Number of questions requested. If the learner named no count, use `10`. |

### Graceful-degradation defaults

The Lambda parses defensively (strips ` ```json ` fences / stray prose) and never
trusts the reply. The **client** owns the final clamping, so the server passes
best-effort values through; anything missing/garbage degrades safely on the
client:

| Field | Behavior on parse failure / missing / wrong type |
|---|---|
| `topicKeys` | `[]` (non-string entries dropped server-side; unknown keys dropped client-side) → client falls back to the deterministic parser |
| `minOrder` | client default `0` (via `clampOrder`) |
| `maxOrder` | client default `4` (via `clampOrder`) |
| `count` | client default `10` (via `clampCount`) |

A reply the Lambda cannot parse at all still returns **HTTP 200** with
`topicKeys: []` (not a `502`), which the client reads as "no usable topic" and
handles by falling back — so a model quirk never surfaces an error to the user.

### Working curl

```bash
curl -s -X POST "$VITE_AI_ENDPOINT/ai" \
  -H "content-type: application/json" \
  -H "authorization: $JWT" \
  -d '{
    "mode": "parse-drill-intent",
    "text": "3 questions on markov chains",
    "vocabulary": [
      { "topicKey": "probability::Markov Chains", "label": "Markov Chains",
        "aliases": ["markov", "markov chain", "stationary", "random walk"] }
    ],
    "difficultyOrders": { "intro": 0, "easy": 1, "medium": 2, "hard": 3, "expert": 4 },
    "countBand": { "min": 1, "max": 25 }
  }'
```

Expected 200 response:

```json
{ "ok": true, "topicKeys": ["probability::Markov Chains"], "minOrder": 0, "maxOrder": 4, "count": 3 }
```

---

## Testing note (JWT authorizer)

Because `POST /ai` sits behind a Cognito JWT authorizer, a raw curl without a
valid `Authorization: <Cognito ID token>` header returns:

```
HTTP 401
{"message":"Unauthorized"}
```

This is expected and confirms auth is enforced. The three modes above were
functionally validated end-to-end by invoking the Lambda directly
(`quant-trader-prep-ai`, `us-east-1`) with synthesized API Gateway v2 events,
which exercises the exact SSM-key → LLM → strict-JSON → defensive-parse path that
serves an authenticated `POST /ai` request. In the running app, `postAi` supplies
the JWT automatically, so the client sees these same 200 response shapes.
