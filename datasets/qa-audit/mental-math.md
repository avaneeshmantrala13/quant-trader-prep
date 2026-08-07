# QA Audit — Mental Math & Applied Math (speed arithmetic / applied math)

**Repo:** `quant-trader-prep` · **Scope (READ-ONLY):** the speed-arithmetic and
applied-math content modules and their generated hint ladders. No app source under
`src/**` was modified.

**Modules audited**

| key | source | levels |
|---|---|---|
| mentalMath | `src/content/mentalMath/{levels,generators}.ts` | mm-1 … mm-4 (all `numeric`) |
| mathQuestions | `src/content/mathQuestions/{levels,generators}.ts` | mq-1 … mq-5 `numeric` (mq-6 is `flashcard` — no ladder) |

## Method

A temporary vitest harness (`src/qa_audit_tmp.test.ts`, since **deleted**) imported the
**real** production generators, family-stamped each item exactly as the level's
`mixNumericGenerators(...)` wrapper does, and materialized every family across **120
seeds**. For **each authored wrong answer** (`commonErrors[j].value`) it resolved the
tag with the production `resolveNumericTag(...)` and called the exact production
`buildHintLadder({ question, chosenValue, misconceptionTag, section })` — threading
`section` from the owning `Level` (mental-math levels carry **no** `section`;
math-questions levels carry their real section string). For every (family, wrong-answer)
it captured all 5 rungs, the rung-4 `simLink`/confront kind, whether rung-1 was silently
replaced by `genericFallbackCoaching`, whether rung-2 was the topic-neutral `GENERIC_PLAN`,
and the remediation descent target implied by `prereqDAG.ts` + `policy.ts`.

**Scoring** (each metric /10, judged for a *speed* track — terse-but-correct coaching is
**not** penalized; a fast correct answer is not "vague"):
- **ACCURACY** — rung-1 names the *specific* slip for that exact wrong value (arithmeticSlip
  vs commonError path per `hintLadder.ts` + `errorModes.ts`), and does not misdiagnose.
- **THOROUGHNESS** — every rung is a complete, coherent, on-domain sentence; rung-5
  `explanation` is correct **and teaches the shortcut/method**.
- **NEXT-TOPIC ZPD** — a failure routes sensibly per `policy.ts` / `prereqDAG.ts` /
  `skillGraph.ts` (mental math is the L0 arithmetic **floor**).

**Severity:** **S1** critical (wrong/contradictory diagnosis or explanation, broken
routing) · **S2** major (specific coaching silently replaced by a generic nudge, rung
incoherent for the domain, tailored plan never fires) · **S3** minor (slightly-generic
plan, sub-optimal edge, the known truncation class).

> **Truncation class (out of scope, flagged only):** the `nameOnlyCoaching`
> mid-sentence truncation is being fixed by another worker. It *does* manifest in
> mathQuestions rungs — e.g. `genCircleRadius` → *"√((D/2)²+(E/2)²) forgets."*,
> `genWordArrangementsNumeric` → *"You divided by 2!"*, `genUnfoldedBox` → *"That is the
> SURFACE AREA (2(lw+lh+wh))."* — but it is **not** scored below; this audit focuses on
> the other defect classes.

---

## Summary metrics (per-module averages, /10)

| module | families audited | Accuracy | Thoroughness | ZPD | overall |
|---|---|---|---|---|---|
| mentalMath | 8 | **8.5** | **5.9** | **9.0** | 7.8 |
| mathQuestions | 20 (numeric) | **8.2** | **5.3** | **8.5** | 7.3 |

Headline: **accuracy of the rung-1 slip diagnosis and ZPD routing are strong**; the drag
is **thoroughness**, driven by two systemic issues — a rung-4 confront that is
probability-domain (incoherent for deterministic arithmetic) and an answer-leak guard that
silently deletes a large share of the *correct* rung-1 diagnoses in mathQuestions.

---

## Defect table

| ID | Sev | Module / families | Defect | Evidence |
|---|---|---|---|---|
| **D1** | S2 (systemic) | **all 28 families** | **Rung-4 is a probability confront, incoherent for a speed-arithmetic / deterministic-math track.** For mental-math + Rates + Geometry, `simLinkFor` returns `null` (no `section`/family match; those sections are in `EXPLICIT_NO_LINK_SECTIONS`) so rung-4 = the generic *"enumerate the full set of equally-likely outcomes (or run many quick trials), then count how often the event actually happens…"* elicitation. For the Number-Theory & Counting section it resolves to the **"Two-Dice Sample Space"** probability sim. Neither fits "615 + 621 = ?", "sum of odd integers", or "duckweed doubling". | r4-generic-prob = **100%** for all mental-math + Rates + Geometry families; r4-sim = **100%** ("Two-Dice Sample Space") for all 8 Counting/Number-Theory numeric families. |
| **D2** | S2 (systemic, mathQuestions) | genPaintPots, genTriangularTotal, genTwoLegTrip, genRiverDrift, genHeadsLegs, genEscalatorSteps, genCircleRadius, (+ genFillDrainTank/genClockAngle/genGamesNet rarely) | **Answer-leak guard silently replaces a correct rung-1 diagnosis with a *false* "no known mistake" nudge.** Many authored `feedback` strings embed the final answer in their corrective clause ("… = 6", "= 32", "36 + 36", "rows 1..28 … = 406", "found from 31 − 14"). `containsFinalAnswer(text, answer)` then trips and `buildHintLadder` swaps in `genericFallbackCoaching` — which asserts *"it doesn't line up with any of the usual mistakes … so I won't guess"* even though the value **did** match a known error. Accuracy **and** thoroughness hit. | Fallback rate per family: **genPaintPots 67%**, genTriangularTotal 50%, genTwoLegTrip 49%, genRiverDrift 38%, genHeadsLegs 34%, genEscalatorSteps 33%, genCircleRadius 10%, genPercent 2%, genFillDrainTank/genClockAngle/genDivision ~1%. Mental-math (well-authored, relative phrasing) ≈ 0%. |
| **D3** | S1 (mathQuestions) | genFractionToDecimalNumeric (also its quiz twin) | **Rung-1 coaching & rung-5 explanation cite the *unreduced* numerator/denominator, contradicting the reduced fraction shown in the prompt.** `fracStr(num,den)` reduces for the PROMPT, but `explanation` and every `commonErrors.feedback` interpolate the raw `num`/`den`. A learner sees "Express **3/5** as a decimal", then is told rung-1 *"You used **11** on the bottom, the denominator is **10**"* and rung-5 *"**3/5** = **6 ÷ 10** = 0.60"*. The stated denominator is factually wrong relative to the displayed problem. | Seed example: prompt `3/5`, R1 `inverted_fraction` = *"You divided 10 by 6…"*, R1 `wrong_denominator` = *"…the denominator is 10."*, R5 = *"3/5 = 6 ÷ 10 = 0.60."* Occurs on every reducible draw (den ∈ {4,8,10,16,20,25}). |
| **D4** | S2 (mentalMath + mathQuestions) | mental: genSubtraction, genMultiply2x1, genMultiply2x2, genDivision, genFractionToDecimal, genOddsToProb; math: all Rates (9) + all Geometry (4) | **Rung-2 falls through to the topic-neutral `GENERIC_PLAN` — the tailored plan never fires.** `gamesMiscPlans.mentalMath`/`marketMaking`/… key off family-name substrings ("addition","multiplication","percent") and section keywords ("mental","arithmetic","math question"). Mental-math family ids are `genMultiply2x1Numeric`/`genDivisionNumeric`/… (no "multiplication"/"division" substring) and the levels carry **no** `section`, so only `genAdditionNumeric` + `genPercentNumeric` reach the mental-math plan. Math-questions section strings ("Rates, Algebra & Word Problems", "Geometry & Derivations") match no resolver → generic. | r2-generic = **100%** for the 6 listed mental families and every Rates/Geometry family; **0%** only for genAddition, genPercent, and the Counting/Number-Theory families. |
| **D5** | S3 (mathQuestions) | genSumOddsRangeNumeric, genSumRangeNumeric, genDoublingCoverageNumeric | **Rung-2 uses the COUNTING/selection plan for arithmetic-series & growth problems.** Section "Number Theory & Counting" trips `planForKeyword("counting")` → `PLAN_COUNTING` (*"Are you picking a GROUP where order is irrelevant, or an ARRANGEMENT where order matters? Can an item repeat?…"*). That plan is right for `genColdStorage`/`genGridRectangles`/`genRoundRobin`/`genCountMultiples`, but semantically off for "sum of odd integers", "sum of a range", and "doubling backward by periods". | R2 for genSumOddsRangeNumeric/genSumRangeNumeric/genDoublingCoverageNumeric = *"…Are you picking a GROUP where order is irrelevant…"*. |
| **D6** | S3 (mathQuestions, ZPD) | genColdStorageNumeric, genGridRectanglesNumeric, genWordArrangementsNumeric, genRoundRobinNumeric | **Counting-family misconceptions have no combinatorics prereq edge, so failures descend to the arithmetic floor, not a counting foundation.** The math-questions "Number Theory & Counting" node's only prereq is `L0_ARITHMETIC`, and none of the counting tags (`squares_not_rectangles`, `forgot_meetings`, `over_divided_repeats`, `volume_division_pack`…) appear in `MISCONCEPTION_EDGE`. A learner who over-counts a multiset is routed to *mental arithmetic* drills rather than combinatorial reasoning (the probability-track `COUNTING` node is not a prereq of the math spine). | `descentTarget(NUMBER_THEORY, tag)` → `prereqs[0]` = `mental-math::_core` for all four counting tags. |
| **D7** | S3 (mentalMath) | genMultiply2x2Numeric | **Rung-5 explanation teaches a 2-term split, not the four-cross-term shortcut the lesson & rung-1 reference.** rung-1 says *"You lost one of the four cross-products in (tens+ones)(tens+ones)…"* and the lesson stresses the four cross-terms, but the reveal only splits **one** factor: *"Expand (30+4)(34) = 1020 + 136"*. Arithmetically correct, but it does not model the taught shortcut. | R5 example: `34 × 34` → *"Expand (30+4)(34) = 1020 + 136"* (b never split). |
| **D8** | S3 (mentalMath) | all mental-math families | **`genericFallbackCoaching` never classifies mental-math items as `"mental-math"`.** With no `section` and family ids lacking `mental/arithmetic/zetamac/optiver/sprint`, `classifyFallbackTopic` returns `"generic"`, so the dropped-carry / place-value self-check in `SELF_CHECK_BY_TOPIC["mental-math"]` is dead code for this track. Low impact (authored errors almost always match, so the fallback rarely shows), but the intended tailoring is unreachable. | `classifyFallbackTopic({section: undefined, family: "genAdditionNumeric"})` → `"generic"`. |

**Counts by severity:** S1 = **1**, S2 = **3**, S3 = **4** (8 defect classes). Systemic
reach: D1 touches **28/28** audited families; D2 materially affects **7** mathQuestions
families (≥10% of wrong answers) plus a long tail.

---

## Per-family scores (/10)

### mentalMath

| family | level | Acc | Thor | ZPD | notes |
|---|---|---|---|---|---|
| genAdditionNumeric | mm-1 | 9 | 6.5 | 9 | tailored R2 (via "addition"); R4 incoherent (D1) |
| genSubtractionNumeric | mm-1 | 9 | 6 | 9 | R2 generic (D4); R4 incoherent (D1) |
| genMultiply2x1Numeric | mm-1/2 | 9 | 6 | 9 | R2 generic (D4); R4 incoherent |
| genMultiply2x2Numeric | mm-2/3 | 9 | 5.5 | 9 | R2 generic (D4); R5 shortcut mismatch (D7) |
| genDivisionNumeric | mm-2/3 | 9 | 6 | 9 | R2 generic (D4); ~1% answer-leak fallback |
| genPercentNumeric | mm-1/2/4 | 9 | 6.5 | 9 | tailored R2 (via "percent"); ~2% fallback |
| genFractionToDecimalNumeric | mm-2/3/4 | 5 | 5 | 9 | **D3** reduced-vs-unreduced mismatch |
| genOddsToProbNumeric | mm-3/4 | 9 | 6 | 9 | R2 generic (D4); diagnosis solid |

### mathQuestions

| family | section | Acc | Thor | ZPD | notes |
|---|---|---|---|---|---|
| genFillDrainTank | Rates | 9 | 5 | 9 | R2 generic; R4 incoherent; ~1% fallback |
| genTwoLegTrip | Rates | 5 | 4.5 | 9 | **D2** 49% fallback |
| genRiverDrift | Rates | 6 | 5 | 9 | **D2** 38% fallback |
| genEscalatorSteps | Rates | 6 | 5 | 9 | **D2** 33% fallback |
| genTriangularTotal | Rates | 5 | 4.5 | 9 | **D2** 50% fallback |
| genHeadsLegs | Rates | 6 | 5 | 9 | **D2** 34% fallback |
| genGamesNet | Rates | 9 | 5 | 9 | diagnosis solid; R4 incoherent |
| genLongFish | Rates | 9 | 5 | 9 | diagnosis solid; R4 incoherent |
| genPairwiseProducts | Rates | 9 | 5 | 9 | diagnosis solid; R4 incoherent |
| genClockAngle | Geometry | 9 | 5 | 8 | ~1% fallback; R4 incoherent |
| genPaintPots | Geometry | 3 | 4.5 | 8 | **D2** 67% fallback (worst) |
| genUnfoldedBox | Geometry | 8 | 5 | 8 | truncation class only; R4 incoherent |
| genCircleRadius | Geometry | 8 | 4.5 | 8 | **D2** 10% fallback + truncation |
| genColdStorageNumeric | Number Theory & Counting | 9 | 5.5 | 6 | R2 tailored (counting); R4 two-dice sim (D1); ZPD D6 |
| genGridRectanglesNumeric | Number Theory & Counting | 9 | 5.5 | 6 | as above |
| genWordArrangementsNumeric | Number Theory & Counting | 8 | 5.5 | 6 | R2 arrangements plan (good); truncation |
| genRoundRobinNumeric | Number Theory & Counting | 9 | 5.5 | 6 | as ColdStorage |
| genSumOddsRangeNumeric | Number Theory & Counting | 9 | 5 | 8 | **D5** counting plan mismatch; R4 two-dice sim |
| genSumRangeNumeric | Number Theory & Counting | 9 | 5 | 8 | **D5**; R4 two-dice sim |
| genCountMultiplesNumeric | Number Theory & Counting | 9 | 5.5 | 8 | R4 two-dice sim |
| genDoublingCoverageNumeric | Number Theory & Counting | 9 | 5 | 8 | **D5**; R4 two-dice sim |

---

## Ranked worst offenders

1. **genPaintPots (Acc 3)** — 67% of authored wrong answers are silently downgraded to the
   false *"no known mistake, I won't guess"* nudge (D2), because every `feedback` ends in
   "… = `<answer>`". The single most degraded family.
2. **genFractionToDecimalNumeric (Acc 5, S1)** — on every reducible draw the rung-1 coaching
   and rung-5 explanation state a denominator/numerator that contradicts the reduced fraction
   in the prompt ("the denominator is 10" for a "3/5" item) — D3, the only S1.
3. **genTriangularTotal (50%) & genTwoLegTrip (49%)** — half of all wrong answers hit the D2
   answer-leak fallback; the accurate off-by-one / round-trip diagnoses are discarded.
4. **genRiverDrift (38%), genHeadsLegs (34%), genEscalatorSteps (33%)** — same D2 pattern; the
   "that's the current, not the length" / "that's the other unknown" / "you averaged the
   counts" diagnoses are frequently nuked.
5. **Systemic D1 — rung-4 domain mismatch (all 28 families)** — every audited item's rung-4
   is a probability confront (generic "run many trials / count the event" elicitation, or the
   "Two-Dice Sample Space" sim). Coherent for probability items, but wrong-domain for a speed
   arithmetic / deterministic-math track; highest aggregate leverage even though per-item
   severity is S2.

---

## Notes / scope boundaries

- **mq-6 "Solving Unknowns & Derivations"** is a `flashcard` level (non-scalar tuples /
  derivations); `buildHintLadder` does not apply to flashcards, so it is out of ladder scope.
- **Rung-1 accuracy is genuinely strong** where the guard does not fire: every mental-math
  slip (`off_by_carry`, `place_value_slip`, `off_by_one`, `operation_confused`,
  `dropped_cross_term`, `wrong_denominator`, `inverted_fraction`, `odds_direction_flipped`,
  `odds_ratio_as_prob`, `swapped_operands`) is diagnosed precisely and answer-free, and the
  arithmeticSlip fallback is correctly out-prioritized by the matched-error path.
- **Withholding invariant holds**: no rungs 1–4 leak the final answer — where a `feedback`
  would, D2's guard (over-)fires. The fix for D2 is content-side (phrase the diagnosis
  without the answer, like the mental-math families do), not loosening the guard.
- **ZPD is sound at the foundations**: mental-math failures floor-teach in place (L0
  arithmetic floor), Rates floor-teaches, Geometry descends to Rates/algebra — all sensible;
  the only ZPD nit is D6 (counting families lack a combinatorics edge).

*Harness `src/qa_audit_tmp.test.ts` was deleted after the run; no `src/**` app source was modified.*
