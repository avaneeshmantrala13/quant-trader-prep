# Mock Interview — Grading-Accuracy QA Report

_Scope: the DETERMINISTIC graders in `src/lib/mock/` (`followups.ts`,
`reasoning.ts`, `gradeReasoningConclusion`, question generators in
`questionPools.ts`). These are the always-on fallback that runs whenever the
server-side AI grader is unavailable, so they must be excellent on their own. The
AI (Lambda) path was strengthened separately (see “AI-path changes” below) and
needs a deploy._

Corpus/harness: `src/lib/mock/grading-accuracy.test.ts` — a multi-pass
“candidate simulator” that, for every scored non-mental-math question type across
all three presets and BOTH follow-ups (numeric probe + reasoning adversarial),
samples 40 seeded instances per generator and feeds the grader many
genuinely-correct answers (varied wording/notation/length/method) and many flawed
variants (right number + hand-wavy, wrong conclusion, wrong method, caving to a
misconception).

## The reported bug (JOB 1) — root cause & fix

**Repro.** Optiver mock, a Fibonacci sequence question answered `87` (correct).
The adversarial follow-up (reasoning): _“State the RULE generating this sequence
in one phrase, and give the value at position 10.”_ A correct rule + correct
position-10 value was graded **“FOLLOW-UP MISSED.”**

**Root cause.** `gradeReasoningConclusion` combined its two signals — the numeric
`conclusionTargets` and the `conclusionKeywords` groups — with a strict **AND**.
A candidate who stated the rule in a form outside our keyword bank (e.g.
`aₙ = aₙ₋₁ + aₙ₋₂`, or “each term equals the previous plus the one before”) failed
the keyword gate even though they gave the correct far-out value, which is
**un-guessable and fully proves the rule**. So a correct answer was marked missed.

**Fix.**
1. Added a `conclusionMode: "all" | "any"` to `FollowupSeed`/`FollowupPresentation`
   (default `"all"`, back-compatible). In `"any"` mode a reasoning follow-up is
   correct if **either** every numeric target matches **or** every keyword group
   is satisfied.
2. Set the sequence “state the rule + value” adversarial (`makeSeq`) to `"any"`,
   and **tightened every sequence rule-keyword bank to be rule-IDENTIFYING** (no
   generic op-words like bare “add”/“multiply”/“differences”), so a *wrong* rule
   can’t trip a keyword under OR-semantics. Net: correct value ⇒ correct; correct
   rule ⇒ correct; only **both wrong** ⇒ missed.
3. Also set the mutually-exclusive “exactly two of three” adversarial (target `0`,
   conclusion literally “impossible”) to `"any"`.

Additional grader hardening (helps recall & precision everywhere):
- **Whole-word keyword matching for short words** (`keywordHit`): short, purely
  alphabetic conclusion words (“no”, “up”, “so”, “rate”, “mode”, “less”) now match
  only as whole words, so a WRONG answer can’t trip them inside “known”,
  “suppose”, “accurate”, “model”, “unless” (a precision leak). Longer/non-alpha
  keywords keep substring matching so inflections still count (“double”→“doubles”,
  “reset”→“resets”).
- **Spelled fractions** (“two-thirds”, “three-quarters”, …) are parsed to their
  decimal value in `valuesIn`, so a worded conclusion still has its numeric target
  detected (fixed a Monty-Hall “two-thirds” false-negative).
- **Currency-signed negatives** (`-$0.50`) parse as `-0.5` (not `+0.5`) in both
  `valuesIn` and `parseNumericValue` (fixed a Citadel bet-EV false-negative).
- **Near-zero targets** use an absolute tolerance so `0` requires an actual `0`,
  not any small number.

## Measured results (deterministic graders)

40 seeds × every generator (prob/EV, sequences, estimation) + the 5 firm
archetypes; both follow-ups.

| Grader path | Recall (correct accepted) | Flaw-rejection (flawed rejected) | Canonical FN |
|---|---|---|---|
| Numeric **probe** | **100.0%** (3607/3607) | **100.0%** (2072/2072) | 0 |
| Reasoning **adversarial** | **100.0%** (4440/4440) | **100.0%** (4080/4080) | 0 |

Per-concept adversarial recall / flaw-rejection = **100% / 100%** for every one of:
`pev-bet, pev-twoof3, pev-2dice, pev-die, pev-coin, pev-urn, pev-geo, pev-condgeo,
pev-choose, pev-die-reroll, pev-max2dice, pev-bayes, pev-bankroll, pev-monty,
pev-citadel, pev-sig, pev-triage, est-stadium, est-cars, est-search, est-heart,
seqn-arith, seqn-geo, seqn-fib, seqn-poly, seqn-alt`.

**Targets** (≥98% recall, ≥95% flaw-rejection, 0 canonical false-negatives,
0 malformed questions) — **met with margin.**

### Before → after (iteration log)

The harness surfaced real gaps; each was fixed and re-measured:

| Symptom (first pass) | Root cause | Fix |
|---|---|---|
| adversarial recall 96.4% | Fibonacci-style AND-gate on keywords | `conclusionMode:"any"` on sequences + specific rule keywords |
| `pev-monty` recall 66.7% | “two-thirds” (worded) had no numeric token | parse spelled fractions in `valuesIn` |
| `pev-citadel` recall 66.7% | `-$0.50` parsed as `+0.5` | strip currency before parsing |
| `seqn-geo/alt` flaw-reject 66.7% | (corpus) near-miss wrong values fell inside 2% tol on huge r⁸ terms; wrong-family strings reused a family’s own keyword | corpus now uses clearly-wrong values + rules that name a *different* family |
| probe recall 40% | (corpus) prose in a NUMBER-ENTRY field | corpus uses realistic numeric entries (bare / comma-grouped / fixed-decimals) |

## Question correctness (JOB 2)

The harness also validates every generated item (40 seeds × all generators +
archetypes): finite main answer, non-empty prompt/explanation/concept, both
follow-ups present and distinct, the probe’s target ≠ the main answer (it truly
deepens), and every reasoning target finite. **0 malformed / ambiguous questions
found.** Market-making items are graded by their own quote/pick-off mechanics
(not `gradeReasoningConclusion`) and are out of scope for this corpus.

## AI-path changes (require a Lambda deploy)

`infra/lambda/ai-flavor/index.mjs` + `datasets/MOCK_AI_CONTRACT.md`:

- **`mock-reason-grade`:** the prompt now explicitly forbids penalizing varied
  wording, notation (symbolic recurrences, fractions/decimals/percentages,
  spelled numbers, currency), brevity, or a **different-but-valid method** that
  correctly reaches the conclusion — “judge the LOGIC, not the phrasing.” Mirrors
  the deterministic recall guards.
- **`mock-followup`:** the prompt now requires the `idealAnswerNote` to **end with
  the single final numeric value after an `=`** (no stray trailing numbers) for
  numeric follow-ups, or state the required conclusion in words for conceptual
  ones — so the client’s `extractTargetAnswer` grades AI follow-ups reliably.

> **Deploy required:** these are prompt-only changes; no schema change. Correctness
> stays 100% client-side (deterministic verifier owns the verdict); the model only
> narrates/authors. Redeploy `ai-flavor` for them to take effect.

## Residual risks

- Recall/precision are measured against a hand-authored corpus of realistic
  phrasings; genuinely novel phrasings a candidate invents could still miss the
  keyword path — but for value-bearing follow-ups the numeric target is the
  primary, un-guessable anchor, so this is low-risk.
- The AI path can only be validated by a live smoke test post-deploy; the
  deterministic fallback (measured above) is the guarantee if the Lambda is down.
