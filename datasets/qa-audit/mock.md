# QA Audit — Quant Mock Interview (feedback quality, end-to-end)

**Scope (read-only):** `src/lib/mock/**` (engine, reasoning, followups, marketMaking, diagnosis, aiMock, scoring, types) + contract `datasets/MOCK_AI_CONTRACT.md`.
**Method:** temp Vitest harness (`src/lib/mock/__qa_audit_temp.test.ts`, deleted after) drove the pure engine + deterministic fallbacks across many seeds; the three LLM modes were reasoned about from `aiMock.ts` + the contract + the client-side normalizers/graders that own the correctness decision.
**No app source was modified. Nothing was fixed.**

## Can the real LLM be exercised from a harness? No.
The live endpoint sits behind a Cognito JWT authorizer. `postAi` reads the ID token from `localStorage`; in any script/test context there is no token, so:

```
POST https://a3uyqqj6s0.execute-api.us-east-1.amazonaws.com/ai   →   HTTP 401 {"message":"Unauthorized"}
```

(Confirmed by direct curl.) `res.ok === false` → `postAi` returns `null` → every mode falls back to its deterministic implementation. **This is exactly the graceful-degradation path**, so the harness measured the fallbacks directly and I reasoned about the LLM-on paths separately. Two consequences matter for scoring:

- The **reasoning-quality** grade and the **diagnosis prose** only fall back to deterministic when the LLM is *unreachable* (network/401/malformed). On a logged-in production session the LLM is primary there.
- The **follow-up correctness decision is *always* client-side and deterministic** (contract invariant), on **both** AI-on and AI-off. So the follow-up grading defects below bite in production regardless of the LLM.

---

## Axis scores (/10)

| Axis | Score | One-line |
|---|---:|---|
| 1. ACCURACY | **5/10** | MM pick-off/reward is strong & directionally correct; but reasoning verification can't catch wrong-but-fluent or marker-word-vague text, and AI follow-up grading matches *any* number in the note (decoys pass, true decimal fails). Correctness-never-flipped invariant **holds**. |
| 2. THOROUGHNESS | **7/10** | Deterministic diagnosis is always complete, coherent, correctly excludes mental-math brevity from "correct-but-vague", and strengths/weaknesses are grounded in the real numbers. Docked for a graceful-degradation gap (verdict-only AI reply surfaces an incomplete report) and under-detection of vagueness in the fallback grader. |
| 3. NEXT-STEPS (ZPD) | **6/10** | Targeted for math-speed, vague-reasoning, and MM weaknesses; but a follow-up-conversion weakness and a fast-but-inaccurate weakness both get only generic boilerplate. |

**Invariant check (passed):** No path reads a model-decided correctness. `normalizeReasoningPayload` never lifts a correctness field (`correct` is input-only); `normalizeDiagnosisPayload` has no correctness field; follow-up correctness is `scoreMathAnswer`/`gradeAgainstReference` (client). The deterministic verifier owns every correctness/score number. Confirmed by code + by the schema having structurally no channel for it.

---

## Scenario-by-scenario

Legend: ✅ correct behaviour · ⚠️ defect · 🔴 serious defect. Reasoning grades from the **deterministic fallback** (the LLM-on path is designed to be better but its downstream follow-up grading is broken — see D1).

### (a) Correct answer + strong reasoning — **9/10** ✅
Full worked derivation of P(2 heads)=3/8 → graded `sound`, `issues: []`. Correct.

### (b) Correct answer + vague / hand-wavy reasoning — **5/10** ⚠️ (D2)
- `"it's obvious"` → `vague` ✅ (word-count gate fires).
- **`"Obviously it is just the probability, so yeah trust me."` → `sound` 🔴** — it is ≥4 words and name-drops the marker tokens `probability`/`so`, so `showsWork=true` and the vagueness gate is skipped. A hand-wavy non-answer is rated as fully sound. False negative on vagueness → it is never counted into `correctButVagueCount` → the diagnosis will *not* warn the candidate they'd fold under pressure.

### (c) Correct final number + WRONG reasoning — **3/10** 🔴 (D2)
Fluent nonsense derivation (`"independent, so I multiply 3 × 1/2 = 3/8"`) → graded **`sound`**. The deterministic grader has no semantic model; any fluent text with numbers + a marker word that lands on a correct number is "sound." In the AI-off/failure regime this is the *only* grader, so confidently-wrong reasoning is rewarded as sound. (The LLM-on path is meant to catch this; unverifiable here, and it is precisely the ~56%-reliable judgement the design distrusts.)

### (d) Wrong answer + plausible reasoning — **8/10** ✅
`"8 outcomes, I count 4 with two heads → 4/8"` (`correct=false`) → `partial`, issue "structured but reaches the wrong result — locate the broken step." Sensible and does not leak the answer.

### (e) Mental-math terse-but-correct — **10/10** ✅
`"111"` and even `""` on a mental-math item → `sound`. Brevity never penalized, per contract. Correct-but-vague count explicitly excludes math steps (verified). This is handled well.

### (f) Market-making, bad vs good quote — **7/10** ✅ w/ ⚠️ verdicts
Fixed scenario true=700, cap=40, 3 rounds, aggression 2, **200 seeds each**:

| Quote | avg P&L | pos / neg / zero | verdict quality |
|---|---:|---|---|
| Centred tight 695/705 | **+17.3** | 192 / 0 / 8 | mostly "Earned the spread" ✅; **8 seeds mislabeled "Quoted too wide"** ⚠️ |
| Centred 688/712 | +10.3 | 77 / 0 / 123 | 123 "too wide" (spread ~0.6·cap → little flow) |
| **Offside low 650/670** | **−146.6** | 9 / 188 / 3 | "Picked off … offside" ✅; **~4% mislabeled "Earned the spread"/"Net positive"** ⚠️ |
| **Offside high 730/745** | **−144.2** | 8 / 191 / 1 | same as above |
| Too-wide 681/719 | +0.1 | 1 / 0 / 199 | "Quoted too wide" ✅ |
| Razor 699/701 | +5.4 | 200 / 0 / 0 | "Earned the spread" ✅ |

The bot **correctly picks off bad quotes into deeply negative P&L (~−145) and rewards centred quotes (+5…+17)** — the core accuracy claim holds strongly in aggregate. Two verdict-labeling defects (D6, D7) below.

### Graceful degradation — **8/10** ✅ w/ one gap (D3)
- Transport 401 → `null` → deterministic fallback ✅.
- Malformed `mock-reason-grade` payloads → contract defaults (`quality:"partial"`, `issues:[]`, `probe:""`), non-string issues dropped ✅.
- Deterministic diagnosis always complete (verdict templated; strengths/nextSteps have non-empty floors) ✅.
- **Gap:** a *partial* AI diagnosis (verdict present, arrays empty or sent as strings) is **kept**, not floored — see D3.

---

## Defects, ranked (worst offender first)

### 🔴 D1 — AI follow-up grading matches ANY numeric token in `idealAnswerNote` (decoys pass, real answer fails)
`gradeAgainstReference` extracts numbers from the note with `numbersIn` (a digit-run regex) and marks the candidate correct if their number equals **any** of them. `numbersIn("1/4")` yields `{1, 4}` (it splits on the slash), not `0.25`.
Empirical, note = *"… = (1/8)/(1/2) = 1/4. Watch for memorylessness errors."* (the contract's own example note):

```
candidate "3" → CORRECT   "1" → CORRECT   "2" → CORRECT   "8" → CORRECT   "4" → CORRECT
candidate "0.25" (the ACTUAL answer) → WRONG    "0.5" → WRONG    "0.125" → WRONG
```

So plausible wrong answers (3, 8) score **correct** while the true answer (0.25) scores **wrong**. This runs on **both** AI-on and AI-off (correctness is always client-side), and corrupts `followupCorrect` → `scorePct` → the whole diagnosis. Files: `followups.ts:136-162`, `reasoning.ts:19-28`.
Severity: **HIGH** (production, silent, inverts correctness).

### 🔴 D2 — Deterministic reasoning grader cannot distinguish sound / wrong / marker-word-vague
`gradeReasoningDeterministic` gates vagueness only on word-count and presence of *any* number or any of ~22 marker words (`so`, `probability`, `expected`, `=`, …). Consequences (empirical): confidently-**wrong** fluent reasoning → `sound` (c); hand-wavy text that name-drops a marker → `sound` (b'). It therefore *undercounts* `correctButVagueCount`, so the "correct but you'd fold under pressure" warning is omitted for exactly the candidates who need it. Only active when the LLM is unreachable, but that is the guaranteed floor the design leans on. File: `reasoning.ts:98-155`.
Severity: **HIGH** (feedback correctness in the degraded regime).

### ⚠️ D3 — `getDiagnosis` keeps an incomplete AI reply instead of flooring to deterministic
Fallback triggers only when `verdict===""` **and** all of strengths/weaknesses/nextSteps are empty. A verbose model truncated by the token cap (contract warns the deployed model is verbose and fenced) can emit a verdict then get cut off, or return the lists as strings. Both normalize to *verdict + empty lists* and are surfaced as-is:

```
{verdict:"You are borderline.", strengths:[], weaknesses:[], nextSteps:[]}   // shown to candidate
```

The user then sees a diagnosis with **no strengths, no weaknesses, no next steps**. Should fall back to the complete deterministic diagnosis. Files: `aiMock.ts:126-136`, `diagnosis.ts:234-255`.
Severity: **MEDIUM** (incomplete final feedback; reachable on a real model).

### ⚠️ D4 — Authored follow-ups are generic arithmetic, not adversarial or concept-relevant
The always-on follow-up backbone (and the only follow-up when AI is off) is one of six mechanical transforms of the *number*: "double your answer", "10% of your answer", "add 25", "halve", "your answer minus 100", "3× your answer". None probe the concept (probability, series, %) or stress the candidate's logic; they test arithmetic on a scalar. The contract's intent ("harder variation testing understanding vs memorization") is not met by the fallback. File: `followups.ts:48-100`.
Severity: **MEDIUM** (follow-up *relevance/adversarialness* — a graded axis).

### ⚠️ D5 — Authored follow-up says "double **your** answer" but grades against double the **true** answer
`deriveAuthoredFollowup` computes the truth from `step.answer` (ground truth). A candidate who was **wrong** on the main item and correctly doubles *their own* stated value is marked **wrong**; only holding the true value passes. Empirical: main truth 50, candidate believed 40 → answers 80 ("double my answer") → **WRONG**; answers 100 → CORRECT. The wording is misleading and the grade is unfair to the literal instruction. File: `followups.ts:87-100` vs `gradeFollowup`.
Severity: **MEDIUM**.

### ⚠️ D6 — MM verdict calls a tight, centred, no-flow quote "Quoted too wide"
`verdictFor` returns "Quoted too wide" whenever `traded.length===0`. A perfectly centred, tight quote that simply drew no noise flow (bad luck over 2-3 rounds) is told it quoted **too wide** — the opposite of the truth — and the diagnosis then recommends "keep spreads tight." Empirical: 8/200 seeds for a 695/705 (10-wide, cap 40) quote; and the E2E ±2 centred quote (seed 42) got "Quoted too wide (0)". Compounded: `deterministicDiagnosis` describes `mmPnl===0` as a **"positive market-making sim."** Files: `marketMaking.ts:253-256`, `diagnosis.ts:216-220`.
Severity: **LOW-MEDIUM** (misdiagnosis + contradictory coaching).

### ⚠️ D7 — MM occasionally rewards a losing offside quote as "Earned the spread"
`INFORMED_RATE=0.7`, so on ~1-4% of seeds the informed side never fires across the short round set and an offside quote (avg −145) lands "Earned the spread"/"Net positive." Verdict/reward not robust to variance over 2-3 rounds. File: `marketMaking.ts` counterparty + `verdictFor`.
Severity: **LOW**.

### ⚠️ D8 — Next-steps miss the follow-up-weakness and accuracy-only-weakness profiles (not ZPD)
`deterministicDiagnosis` has targeted next-steps for math *speed* (`avgMathMs>12000`), vague reasoning, and MM (`mmPnl<=0`) — but none for (i) a follow-up-conversion weakness or (ii) fast-but-inaccurate math. Empirical:
- Fast+accurate math, 0/4 follow-ups: weakness correctly cited, next-steps = only *"Keep reps up across all four sections…"* (boilerplate).
- 2/6 (33%) math, fast: weakness cited, next-steps = same boilerplate (no accuracy drill).
File: `diagnosis.ts:186-197`.
Severity: **LOW-MEDIUM** (NEXT-STEPS axis).

### ⚠️ D9 — Conceptual AI follow-ups (no numeric anchor) are asked but silently ungradable
When `idealAnswerNote` has no number, `gradeFollowup` returns `null` and the follow-up is excluded from the tally. A good *conceptual* adversarial follow-up ("why does conditioning change the distribution?") is posed to the candidate but contributes nothing — neither reward nor penalty. Empirical: `grade = null`. File: `followups.ts:187-190`.
Severity: **LOW**.

### D10 (cosmetic) — Verdict always says "clear a first-round screen" regardless of tier
Even against the "top-tier prop desk" bar the sentence ends "…would (not) clear a **first-round screen**." Minor coherence nit. File: `diagnosis.ts:216-220`.

### Positive findings
- **Correctness never flipped** by any AI path (structural + verified). ✅
- MM pick-off economics are correct and robust in aggregate (offside ≈ −145, centred ≈ +10…+17). ✅
- Mental-math brevity is never charged as vagueness (math excluded from `correctButVagueCount`). ✅
- Deterministic strengths/weaknesses are specific and grounded in the real counts/P&L, not generic. ✅
- Malformed-payload normalization returns safe contract defaults without crashing. ✅

---

## Defect counts by severity
- 🔴 HIGH: **2** (D1, D2)
- ⚠️ MEDIUM: **4** (D3, D4, D5, D6*) — *D6 is LOW-MEDIUM
- ⚠️ LOW: **4** (D7, D8, D9, D10) — D8 is LOW-MEDIUM
- Total defects: **10** (+ 5 positive findings)

## Top 5 issues
1. **D1 (HIGH):** AI follow-up grader matches *any* number in the note → decoys (3, 8) pass, the real answer (0.25) fails; corrupts score & diagnosis, runs in production on both AI-on/off.
2. **D2 (HIGH):** Deterministic reasoning grader rates wrong-but-fluent and marker-word-vague text as `sound`, so "correct-but-vague" goes undetected in the AI-off floor.
3. **D3 (MEDIUM):** `getDiagnosis` surfaces a verdict-only / string-typed AI reply (empty strengths/weaknesses/next-steps) instead of flooring to the complete deterministic diagnosis.
4. **D4 (MEDIUM):** Authored follow-ups are generic arithmetic on the answer — not adversarial or concept-relevant — and are the sole follow-up whenever the LLM is off.
5. **D6 (LOW-MED):** MM verdict labels a tight, centred, no-flow quote "Quoted too wide" (and reports P&L 0 as a "positive" sim), giving contradictory coaching.
