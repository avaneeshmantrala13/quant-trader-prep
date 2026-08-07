# QA Audit — Timed / Speed-Practice Drills

**Scope (read-only):** Speed Arena (`src/content/arena/**`, `src/lib/arena/**`), Sequences & Pattern
Recognition (`src/content/sequences/**`), Arbitrage / No-Arbitrage (`src/content/arbitrage/**`,
`src/lib/arbitrage/**`), Fermi/estimation (`src/lib/fermi/**`, `src/content/fermi/**`), EV-under-time
(`src/lib/evTimed/**`).

**Method.** For hint-ladder content (Sequences, Arbitrage) I built `buildHintLadder(...)` for every
authored wrong answer across each family (seeded, multiple draws) and scored the 3 metrics on the
resolved rung-1 name-trap, rung-2 plan-of-attack (`planOfAttack`), rung-4 sim link (`simLinkFor`),
rung-5 reveal, and the remediation route (`remediationStep` / `prereqDAG` / `MISCONCEPTION_EDGE`).
For grader-based drills (Fermi, EV-under-time, Speed Arena) I audited the grader + feedback directly
(log-distance / Winkler CI grading, MCQ+speed scoring, arithmetic exact/rounded compare) and the
timing-metadata parity engine. A temporary vitest harness was used to dump ladders and scan for
distractor collisions and rule-uniqueness across 400 seeds, then deleted.

**Verdict headline.** Grading/solver *correctness* is strong everywhere (exact rational / coded-product
verifiers). The weaknesses are concentrated in (a) **rung-2 plan-of-attack mis-routing** for two whole
families in Sequences and most of Arbitrage, (b) one **non-unique sequence rule** (analogy), and
(c) a **systemic ZPD gap**: none of these five drills are wired into the remediation DAG, so
next-topic routing never engages.

> The `nameOnlyCoaching` rung-1 truncation class (clipped name-trap sentences) is being fixed
> elsewhere — noted below where observed, but excluded from scoring.

---

## Metric averages (/10)

| Drill | Accuracy | Thoroughness | Next-topic ZPD | Notes |
|---|---:|---:|---:|---|
| Sequences & Pattern Recognition | 7.5 | 6.5 | 3.0 | analogy non-unique; rung-2 misroute (2 families) |
| Arbitrage / No-Arbitrage | 8.5 | 6.0 | 3.0 | rung-2 de-vig-for-everything; rung-4 sim coarse |
| Speed Arena | 9.0 | 7.0 | — (n/a) | pure right/wrong; no ladder by design |
| Fermi / estimation | 9.5 | 8.5 | — (n/a) | grader excellent; minor CI-score note |
| EV-under-time | 9.5 | 8.5 | — (n/a) | scoring monotonic & correct |
| **Weighted avg** | **8.8** | **7.3** | **3.4** | ZPD dragged down by systemic DAG gap |

ZPD scored low (3.0) for the two ladder drills because their misconception tags route nowhere; "n/a"
drills are grader-only and never invoke remediation. See defect **Z1**.

---

## Ranked worst offenders

1. **Z1 — ZPD routing is inert for all five drills** (High, systemic).
2. **S1 — Sequences `analogyNext`: rule is not unique** (High).
3. **S2 — Sequences rung-2 mis-routing (geometric → probability plan; arithmetic → mental-math plan)** (Medium).
4. **A1 — Arbitrage rung-2: de-vig plan applied to every No-Arbitrage item** (Medium).
5. **A2 — Arbitrage rung-4: every family deep-links to the same "Marble Olympics" sim** (Medium).

---

## Defect table

### Sequences & Pattern Recognition

| ID | Sev | Location | Metric | Defect |
|---|---|---|---|---|
| S1 | **High** | `content/sequences/solvers.ts` `analogyMul`; `generators.ts` `analogyNext` | Accuracy / uniqueness | For `a : b :: c : ?` with `b = a·r`, the **additive** reading `c + (b−a)` is an equally defensible pattern, but it is authored as the `copied_absolute_gap` *misconception* and the explanation asserts a unique "maps a value to r× itself" rule. Harness: **400/400** sampled analogy items have a distinct, positive additive answer ≠ the ×r answer (e.g. `2:6::6:?` → ×3=18 vs +4=10; `4:16::3:?` → ×4=12 vs +12=15). A learner reading it additively is marked wrong on a genuinely ambiguous item. |
| S2 | Medium | `lib/tutor/plans/gamesMiscPlans.ts` + `planOfAttack` order | Thoroughness | Rung-2 plan mis-routes by keyword. `geometricNext` / `geometricNumeric` match `f.includes("geometr")` → the **geometric-PROBABILITY** plan ("What is the FULL set of equally-likely positions or values… which part counts as a success… land on the chance?") for a deterministic sequence. `arithmeticNext` / `arithmeticNumeric` match the `"arithmetic"` section-keyword → the **mental-math** plan ("which operation and quantities… place-value slips"). Neither mentions recovering a generating rule. Confirmed live for all 4 families. |
| S3 | Low | `lib/tutor/hintTopicHelp.ts` `EXPLICIT_NO_LINK_SECTIONS` | Thoroughness (correct) | Sequences is (correctly) in the no-sim set, so rung-4 falls back to the generic enumerate-and-count elicitation. Reasonable; flagged only to confirm it is intentional, not a silent coin-flip misroute. |
| S4 | Low | `generators.ts` `oddOneOut` | Accuracy / uniqueness | Odd-one-out is authored around a single divisibility rule, but four bare integers can share other simple properties (parity, primality), so the "odd one" is not provably unique. Low impact given the tight construction, but the explanation states the rule as if unique. |
| S5 | Low (fixed elsewhere) | `lib/tutor/hintLadder.ts` `nameOnlyCoaching` | Thoroughness | Rung-1 name-traps get clipped mid-clause, e.g. `"Added 5 when the cycle called."`, `"Continued the OTHER interleaved strand."`, `"You summed the share counts."` Belongs to the known truncation class. |

Rung-1 → misread mapping, rung-5 reveal, and every exact next-term / distractor value are **correct**
(no distractor==answer collisions in 400 seeds; all distractors format-parity and positive). Rungs 2/4
are the only weak spots.

### Arbitrage / No-Arbitrage

| ID | Sev | Location | Metric | Defect |
|---|---|---|---|---|
| A1 | Medium | `lib/tutor/plans/gamesMiscPlans.ts` `planFromSection` ("no-arbitrage" → `deVig`) | Thoroughness | Every `No-Arbitrage` item that isn't caught by a family rule gets the **de-vig** plan ("What do the quoted prices or odds imply if you treat each one as a raw chance?… where is the built-in margin hiding?"). Correct for `genImpliedProb`/`genDeVigFair`/`genArbDetect`, but a poor/wrong fit for: **`genBasketArb`** (basket-vs-NAV direction — no odds or margin involved), **`genValueLeg`** (positive-EV `p·o` bet), and **`genArbStake`/`genArbProfit`** (stake sizing / guaranteed profit). Only `genBasketNAV` routes correctly (family contains "nav" → `etfNav` plan). Confirmed live. |
| A2 | Medium | `lib/tutor/hintTopicHelp.ts` `SECTION_SIM_OVERRIDES["No-Arbitrage"]` | Thoroughness | No arbitrage family/tag is in `SIM_BY_FAMILY` / `SIM_BY_MISCONCEPTION`, so **all** items resolve rung-4 to the section default `marble-winner-markets`. Apt for de-vig/detect, but basket items would be better served by `etf-creation-redemption` and value-leg by `poker-pot-odds`, which exist in the catalog. |
| A3 | Low | `content/arbitrage/generators.ts` (`unit: "prob"`) vs `errorModes.ts` `inferAnswerDomain` | Accuracy | Numeric probability items use `unit: "prob"`, which is **not** unitless, and the `No-Arbitrage` section classifies as `generic`, so the rung-1 out-of-domain pointer never fires. Impossible probabilities (e.g. the authored `forgot_stake_term` distractor `1.8`) don't get the "[0,1]" sanity nudge. |
| A4 | Low (fixed elsewhere) | `nameOnlyCoaching` | Thoroughness | Rung-1 clipping again, e.g. `"You used total·(1/o₁)."`, `"You used total·(1 − booksum)."`, `"You added the component PRICES without."` Known truncation class. |

Solver correctness is excellent: exact `fraction.js` for implied prob / de-vig / booksum / arb stakes /
guaranteed profit, and every distractor rationale accurately names its specific error
(complement, decimal-as-fractional, normalize-by-odds, stake-by-odds, forgot-normalize, favorite-trap,
unweighted-basket, …). Distractors correctly dedupe against the answer.

### Speed Arena

| ID | Sev | Location | Metric | Defect |
|---|---|---|---|---|
| AR1 | Low (by design) | `lib/arena/scoring.ts`, `content/arena/generators.ts` | Thoroughness | Arena items (`ArenaItem`) carry no `explanation`/`commonErrors` and never enter `buildHintLadder`; grading is pure exact/rounded right-wrong. Expected for a mental-math sprint, but there is **no elaborated feedback / diagnosis** on a miss. |
| AR2 | Low | `content/arena/firmFormats.ts` `joinFirms` | Accuracy (latent) | Two-firm join returns `"${firms[0]} ${firms[1]}"` with no "and"/comma. Currently masked because the seeded second entries already embed "and other…", but any real two-firm list renders as "Optiver Akuna". |
| AR3 | Low | `content/arena/generators.ts` `genDecimal` | Accuracy (cosmetic) | A `div` op in the decimal pack silently collapses to an addition problem (labeled `op:"add"`); there is no decimal-division drill even when the preset requests division. |

Grading (`zetamacScore`, `optiverScore` +1/−1 with `skipsFree`, `scoreRun`) is **correct**. The OA
timing-parity engine (`oaFormats.ts`) is internally consistent: every `perQuestionSec = totalSec/count`
and every archetype pace band passes (`auditCatalog` returns no failures for the shipped catalog).

### Fermi / estimation (grader + feedback audit)

| ID | Sev | Location | Metric | Defect |
|---|---|---|---|---|
| F1 | Low (design) | `lib/fermi/grader.ts` `gradeInterval` | Thoroughness | The 90%-CI Winkler score is computed in **linear** units, so its magnitude is dominated by the item's scale and isn't comparable across order-of-magnitude items. The scored *calibration* signal (the binary `hit` and `intervalCoverage`) is correct and scale-invariant, and the score is documented as in-round only — so this is a design note, not a grading bug. |
| F2 | Low (cosmetic) | `content/fermi/items.ts` `fermi-piano-tuners-chicago` | Accuracy (cosmetic) | Item id says "chicago" but the prompt and factors are New York City (20M metro). Internal-only; grading is unaffected (reference 400 matches the coded product). |

Point-estimate grading is **correct and appropriate**: `parseFermiInput` robustly handles scientific
notation, k/m/b/t + spelled-out magnitudes, currency and separators (malformed → `null` → incorrect,
never a crash); log-distance bands (≤0.5 correct ≈ within 3.16×, ≤1.0 close = within 10×) match an
order-of-magnitude judgment; non-positive/invalid inputs are graded incorrect. Every item's `reference`
equals `computeFermiReference(factors)` and the sampled references are realistic (gas stations ≈125k,
McDonald's ≈13.75k, US equity notional ≈$480B, FX ≈$7.5T). Reveal chain (`computeRunningSteps`) +
`takeaway` + band copy are accurate and complete.

### EV-under-time (grader + feedback audit)

| ID | Sev | Location | Metric | Defect |
|---|---|---|---|---|
| E1 | Low | `lib/evTimed/engine.ts` `scoreAnswer` / `answerCurrent` | Accuracy (edge) | `withinBudget = elapsedMs <= budgetMs` and `elapsedMs` is clamped to `budgetMs`, so a commit *at* the deadline (a buzzer-beater or an auto-commit) still reports `withinBudget: true`. Harmless for wrong/skipped answers (base 0 excludes them from the summary's `withinBudget` count), but a correct answer at the exact buzzer earns the "within budget" flag with a 0 speed bonus. |

Scoring is **correct**: wrong ⇒ 0 (strictly lowest); correct ⇒ `CORRECT_BASE + round(SPEED_MAX·(1−t))`
is monotonic non-increasing in elapsed time and never below the base; grading is exact MCQ
(`chosen === correctIndex`). The engine is pure/deterministic (caller-supplied `nowTs`), draws are
reproducible, and `summarize` is order-independent and internally consistent. Per-item feedback is the
underlying generator's `explanation`/`distractorRationale`, which is accurate.

---

## Systemic: Next-topic ZPD (applies to all five drills)

| ID | Sev | Location | Metric | Defect |
|---|---|---|---|---|
| Z1 | **High** | `content/remediation/prereqDAG.ts` (`PREREQ_DAG`, `MISCONCEPTION_EDGE`); drills' `levels.ts` | ZPD | None of these drills' topics — `No-Arbitrage`, `Sequences & Pattern Recognition`, Speed Arena, Fermi, EV-under-time — appear in `PREREQ_DAG`, and their levels are explicitly *not registered into any track* (per each `levels.ts` header). So `remediationStep(topicKey)` hits `prereqNode → undefined → exit "no-gap"`: **no retry-in-place, descend, teach-link, or floor-teach ever fires** for a bombed speed drill. Compounding this, the misconception tags these drills emit (`off_by_one_continuation`, `wrong_arb_direction`, `complement_prob`, `unweighted_basket`, …) are **absent from `MISCONCEPTION_EDGE`**, so even if the nodes were added, descent would fall back to `prereqs[0]` rather than the implicated prerequisite. Net: the ZPD/remediation layer is **inert** for every audited drill. If the product intent is "speed drills don't remediate," that's defensible — but it should be explicit, because the misconception tags are computed and then dropped on the floor. |

---

## Severity summary

- **High: 2** — Z1 (ZPD inert, systemic), S1 (analogy rule non-unique).
- **Medium: 3** — S2 (sequence rung-2 misroute), A1 (arbitrage rung-2 de-vig-for-everything), A2 (arbitrage rung-4 sim coarse).
- **Low: 9** — S3, S4, A3, AR1, AR2, AR3, F1, F2, E1.
- **Flagged (fixed elsewhere): 2** — S5, A4 (`nameOnlyCoaching` truncation class).

**Total actionable defects: 14** (2 High, 3 Medium, 9 Low), plus 2 truncation instances of the
already-tracked class.

## Top 5 issues (fix priority)

1. **[High · Z1]** Wire the five drill topics into `prereqDAG` (or explicitly document that speed drills bypass remediation) and add their misconception tags to `MISCONCEPTION_EDGE`; today next-topic routing is inert for all of them.
2. **[High · S1]** `analogyNext` treats the additive reading `c+(b−a)` as a misconception though it is an equally valid analogy rule (400/400 seeds ambiguous). Either disambiguate the prompt (e.g. force a non-additive-consistent triple) or accept both readings.
3. **[Medium · S2]** Rung-2 mis-routes geometric sequences to the geometric-*probability* plan and arithmetic sequences to the mental-math plan; add a Sequences plan resolver (or guard the `"geometr"`/`"arithmetic"` keyword matches against the Sequences section).
4. **[Medium · A1]** The de-vig rung-2 plan is applied to every `No-Arbitrage` item, including basket-direction, value-leg, and stake/profit sizing; add per-family plans (basket-vs-NAV, value-bet-EV, arb-sizing).
5. **[Medium · A2]** All arbitrage items deep-link rung-4 to `marble-winner-markets`; map basket families to `etf-creation-redemption` and value-leg to `poker-pot-odds` via `SIM_BY_FAMILY`.
