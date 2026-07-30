# Per-Section Build Spec — MCQ → Free-Response Conversion (Phase 2)

Turnkey recipe for a per-section sub-worker to convert eligible MCQs to
free-response and author the parametric error-mode catalogs, on top of the stable
Phase-1 infrastructure. See `FREE_RESPONSE_HINT_CREDIT_DESIGN.md` for the credit
schedule + rationale, and the worked example in
`src/content/probabilityStats/geometricProbability/` (geo-1 conversion) +
`src/content/probabilityStats/errorModeCatalogs.ts`.

## Golden rules

1. **Keep `tsc -b` and `npx vitest run` GREEN.** Never leave the tree broken.
2. **Additive & back-compatible.** Do not change shared types, the mastery layer,
   or the players — Phase 1 is frozen. Only touch your assigned content files.
3. **Every computed value is code-verified** by the family's exact solver; never
   hand-type a wrong value. Coaching sentences NEVER state the answer.
4. **Disjoint file ownership** (below) — never edit another section's files.

## What is ELIGIBLE for conversion (CONFIRMED SCOPE)

Convert to free-response ONLY MCQs whose answer is **numeric or a clean
expression** (numbers, fractions, decimals, percentages, simple expressions).

**Leave as MCQ / flashcard** (do NOT convert):
- identification ("which distribution…"), strategy/decision answers, orderings,
  multi-part answers, and any genuinely non-numeric answer.
- Existing `numeric` and `flashcard` levels stay in their mode (they already get
  the improved hint ladder + error-mode feedback + partial credit via the shared
  `FreeResponseCard`; just enrich their `commonErrors` with `misconception` tags
  and coaching where missing).

## Conversion recipe (per eligible quiz family)

Model exactly on the geo-1 conversion:

1. In the family's `generators.ts`, add a `build<Family>NumericInstance(rng, diff)`
   that returns `{ answer, numeric: NumericQuestion }`:
   - compute `value` with the SAME exact solver as the MCQ;
   - `dp = numDp(value)`, `answer = Number(decText(value, dp))`, `decimals: dp`,
     `unit: ""`;
   - build `commonErrors` via `numericErrors(answer, dp)` and `push(wrongValue,
     coaching, MISCONCEPTION.<tag>)` for EACH genuine error mode (see below);
   - `explanation` = the worked solution (rung 5), code-verified;
   - append "(Enter a fraction or decimal.)" to the prompt.
2. Add an adapter `export const gen<Family>Numeric = (rng) => build...(rng, diff).numeric;`
3. In `levels.ts`, flip the level: `mode: "numeric"`, replace `generator:
   mixQuiz([...])` with `numericGenerator: mixNumeric([gen<Family>Numeric])`, and
   fix the imports (drop now-unused `mixQuiz`/quiz adapter — `noUnusedLocals` is on).
4. Keep the original quiz generator + its test if the test references it (as geo-1
   did), OR migrate the test. Add the new numeric generator to the file's
   `NUMERIC_GENS` round-trip test.

## Error-mode catalog authoring (heart of rung 1)

- Enumerate the GENUINE modes by mining the family's existing
  `distractorRationale` / `commonErrors` and the dataset reasoning. Typically
  5–15 per family; **cap 50; never pad with implausible modes.**
- Each mode = a parametric solver (wrong value for ANY params) + a
  `MISCONCEPTION.*` tag + an encouraging coaching sentence that NAMES the mistake
  and asks a leading question, WITHOUT the answer (style: *"Close! You added the
  probabilities. But the wording says 'A AND B' — what do probabilities do on
  AND?"*).
- Reuse canonical tags in `src/lib/tutor/misconception.ts` (`MISCONCEPTION`). If a
  family needs a NEW tag: add it to `MISCONCEPTION`, add a matching label to
  `MISCONCEPTION_LABELS` in `src/lib/dashboard/misconceptionLabels.ts`
  (a test enforces full coverage), and optionally map it in `CONFRONT_BY_TAG`
  and `hintTopicHelp.ts` (`SIM_BY_MISCONCEPTION` / `RESTATE_*`).
- Prefer authoring a typed `ErrorModeCatalog<P>` in a shared
  `errorModeCatalogs.ts` and calling `buildCommonErrors(catalog, params, correct,
  { decimals })` (see `src/content/probabilityStats/errorModeCatalogs.ts`), OR the
  inline `numericErrors().push(value, coaching, tag)` pattern (see geo-1). Either
  emits the same `commonErrors` shape.

## Rungs 2–5 (already wired; verify per family)

- Rung 2 (guided intuition): `restateAndVisualize` in `hintTopicHelp.ts` — add a
  `RESTATE_*` for your family/section if the generic default is too vague.
- Rung 3 (diff-numbers walkthrough): auto — a fresh same-family sibling is worked
  by `regenerate.ts` + `deriveWorkedSteps`. Ensure the family regenerates.
- Rung 4 (sim deep-link): confirm `SIM_BY_SECTION`/`SIM_BY_FAMILY` in
  `hintTopicHelp.ts` points your family at the CONCEPTUALLY-CORRECT sim in
  `src/lib/simulations/catalog.ts`. Add a mapping if missing.
- Rung 5 (exact solution): the item's `explanation` — must be complete & verified.

## Section ownership map (assign one sub-worker per row; disjoint files)

| Section | Files owned |
|---|---|
| Core Probability | `src/content/probability/**` |
| Conditional Probability & Bayes | `src/content/probabilityStats/conditionalProbability/**` |
| Combinatorial Analysis | `src/content/probabilityStats/combinatorialAnalysis/**` |
| Expected Value | `src/content/probabilityStats/expectedValue/**` |
| Geometric Probability | `src/content/probabilityStats/geometricProbability/**` (geo-1 DONE — pattern reference) |
| Markov Chains / Structure | `src/content/probabilityStats/markov*/**` |
| Variance/Covariance/CLT | `src/content/probabilityStats/varianceCovarianceClt/**` |
| MGF | `src/content/probabilityStats/mgf/**` |
| Game Theory & Puzzles | `src/content/probabilityStats/gameTheory/**`, `gamePuzzle/**` |
| Limit Theorems | `src/content/probabilityStats/limitTheorems/**` |
| Order Statistics / Joint / Poisson / Continuous / Brownian / Branching / CTMC / Gamma / betting | one worker each under `src/content/probabilityStats/<subtopic>/**` |
| Math Questions | `src/content/mathQuestions/**` |
| Brainteasers (flashcards) | `src/content/brainteasers/**` — mostly stay flashcards; enrich tags only |
| Interview Games | `src/content/interviewGames/**` |
| Mental Math | `src/content/mentalMath/**` — timed arithmetic; stays numeric, enrich tags |

SHARED files (coordinator-owned; a sub-worker may APPEND a new `MISCONCEPTION`
tag + its label but must not restructure): `src/lib/tutor/misconception.ts`,
`src/lib/dashboard/misconceptionLabels.ts`, `src/lib/tutor/hintTopicHelp.ts`,
`src/lib/simulations/catalog.ts`. Coordinate additions to avoid merge conflicts.

## Definition of done (per section)

- Eligible numeric MCQs converted to `mode: "numeric"` free-response; non-numeric
  items left as MCQ/flashcard (documented count).
- Every converted family has a tagged parametric error-mode catalog (5–50 modes),
  rung-1 coaching, and a verified rung-5 explanation.
- Rung-4 sim link verified correct for the family.
- `tsc -b` clean; `vitest` green (add/extend the family's round-trip test to cover
  the new numeric generator + assert `misconception` present on every commonError).
