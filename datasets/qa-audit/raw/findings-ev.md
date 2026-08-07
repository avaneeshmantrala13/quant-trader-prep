# QA Sub-Audit — Hint-Ladder Quality: `expectedValue` module

READ-ONLY audit. No files under `src/**` were modified. Data source:
`datasets/qa-audit/raw/ev.txt` (harness output, 8 seeds, `qa_harness.ts ev 12`),
cross-checked against `src/lib/tutor/hintLadder.ts`, `hintTopicHelp.ts`,
`planOfAttack.ts` + `plans/evCombinatoricsPlans.ts`, `errorModes.ts`,
`misconception.ts`, `content/remediation/prereqDAG.ts`,
`src/content/probabilityStats/expectedValue/levels.ts`, and
`src/lib/simulations/catalog.ts`.

## 1. Scope & method

- 8 levels enumerated: `ev-1` Dice & Coin (numeric), `ev-2` Stop or Roll (numeric),
  `ev-3` Waiting Games (numeric), `ev-4` Indicators & Linearity (numeric),
  `ev-5` Distributions/Variance/CLT (numeric), `ev-6` Conditional & Geometric
  (numeric), `ev-7` Random Walks & Martingales (quiz), `ev-8` Infinity &
  Simulation Desk (flashcard).
- **~506 (item, wrong-answer) rungs** dumped; scored a representative sample of
  **72 distinct `(family, tag)` groups** across all 8 levels (deduped by family+tag).
- **`ev-8` produced 0 laddered items** — flashcard mode is not materialized by the
  harness and does not pass through `buildHintLadder`. The divergent-EV sentinels
  (St.-Petersburg infinite EV) and coin-procedure cards are therefore **outside
  ladder coverage entirely**. Not a ladder defect, but a coverage gap: the
  "infinite / diverges" special cases get no name-trap / plan / sim scaffolding.

## 2. Per-metric averages (n = 72 distinct family+tag)

| Metric | Avg /10 | Driver |
|---|---|---|
| **ACCURACY** (R1 names the specific trap) | **7.9** | R1 naming is usually correct; dragged down by (a) 7 items where the answer-withholding guard nukes an authored rationale to the generic fallback, and (b) op-word/`;`-collision truncations that drop the leading question. |
| **THOROUGHNESS** (rungs complete+coherent, R2 useful, R4 right sim, R5 correct) | **4.8** | **Dominated by R4: 502 / 506 rungs point at the single generic `expected-value` sim**, mismatched for ~10 families that have a purpose-built sim. Also 3 R2 plan mis-selections, R5 cosmetic dupes, and 2 giant unreduced-fraction reveals. |
| **NEXT-TOPIC ZPD** (routes to appropriate prereq) | **4.9** | **Every EV item routes to L1 (Meaning of Probability & Sample Space).** Correct-ish for dice/sample-space errors, but too-easy/wrong for expectation-technique, and outright wrong for variance/CLT errors (should implicate Variance/CLT) and random-walk errors (should implicate Markov/Cond. Expectation). |

Overall composite ≈ **5.9 / 10**. R1 authoring is strong; the ladder's
*context routing* (sim + prereq) is the weak layer for EV specifically.

## 3. Headline defects (root cause + source verification)

### D1 — R4 sim mismatch: 502/506 rungs → generic "Expected Value (Long-Run Average)" sim  (S2, systemic)
Sim-link tally over the whole dump:
```
502  Expected Value (Long-Run Average)  (/simulations#expected-value)
  4  Venn Diagram: Two Events           (/simulations#venn-two-events)
```
Root cause (verified in `hintTopicHelp.ts`): EV's ~25 generator families are
**absent from `SIM_BY_FAMILY`**, and EV's authored tags are non-canonical
(`subtracted_variances`, `variance_not_second_moment`, `single_die_mean`, …) so
they **miss `SIM_BY_MISCONCEPTION`**. Every EV item therefore falls to
`SECTION_SIM_OVERRIDES["Expected Value"] = "expected-value"`. Purpose-built sims
**exist in the catalog but are never reached**:

| Family (misconception) | Currently links | Should link (verified in `catalog.ts`) |
|---|---|---|
| `genCltVarianceNumeric`, `genSecondMomentNumeric`, `genExpMomentNumeric`, `genHeadsTimesTailsNumeric` (variance / 2nd-moment / CLT) | `expected-value` | `clt` (id `clt`, topics *Variance…CLT*) — the running-average sim does NOT show variance adding |
| `genCoupon` (coupon collector) | `expected-value` | `coupon-collector` (id exists, topic *Expected Value*) |
| `genMaxDice`, `genUniformSpacing` (order statistics) | `expected-value` | `order-statistics` (id exists) |
| `genOverlap`, `genMeetWithin` (2-D area probability) | `expected-value` | `geometric-dartboard` (id exists) — these are **probabilities, not EVs**; the EV averaging sim illustrates nothing here |
| `genWalkReach`, `genWalkDuration`, `genMartingaleDoubling` (gambler's ruin / walk) | `expected-value` | `gamblers-ruin` (id "Gambler's Ruin / Random Walk") |
| `genTwoDiceMatchNumeric`, `genDifferNumeric`, `genAllSameCoinsNumeric` (P(match/differ/all-same)) | `expected-value` | `dice-rolls` / `sample-space` — again a probability, not an average |

For the genuine EV-averaging families (three-dice payoff, re-roll, geometric-sum,
Wald, running-sum, martingale EV) `expected-value` is a *reasonable* fit; the
defect is concentrated in the ~10 families above.

### D2 — Answer-withholding guard nukes valid authored R1 → generic fallback  (S2, 7 instances, systemic pattern)
`genericFallbackCoaching` ("*That's not the right answer yet — and it doesn't
line up with any of the usual mistakes…*") appears **7 times despite a fully
authored rationale** — a defect per the audit brief. Root cause: in
`hintLadder.ts`, `if (!rung1Text || containsFinalAnswer(rung1Text, answer))` the
answer literally appears inside the correct rationale, so the guard discards the
specific naming:

- `genMartingaleDoubling` idx:3 / idx:0 (×4): answer is **0**; rationale ends
  "*…they sum to 0*" → `containsFinalAnswer(…, 0)` trips → generic. The EV of a
  fair game is *unavoidably* 0, so this recurs whenever the "sum to 0" phrasing
  survives `nameOnlyCoaching`.
- `genSumUniformsNumeric` / `uniform_mean_is_full_L`: answer is **1**; rationale
  "*…Over the interval [0, 1], what is a single draw's average?*" contains "1".
- `genOneReroll` / `err:0.5`: answer is **7/2 (=3.5)**; rationale cites the
  continuation value "*(7/2 − 3)*" → the fraction form of the answer trips the guard.

Effect: the learner sees the least-helpful rung 1 exactly on some of the cleanest,
most-teachable traps.

### D3 — Universal mis-routing to L1; variance/CLT & random-walk errors land at the wrong prereq  (S1/S2, systemic ZPD)
Every ROUTE line resolves `node=Expected Value … target=Meaning of Probability &
Sample Space (L1)`. EV node prereqs are `[L1_MEANING, COUNTING]` and
`prereqs[0]=L1`. Because EV's authored tags are non-canonical they miss
`MISCONCEPTION_EDGE`, so *even variance errors* default to L1:
- `genCltVarianceNumeric`/`genSecondMomentNumeric`/`genExpMomentNumeric`/
  `genHeadsTimesTailsNumeric` are second-moment/variance errors → ideally
  `Variance, Covariance & the CLT` (the edge `n_vs_n_minus_one → VARIANCE_CLT`
  exists but the tags used here are not that canonical tag). Routing them to "the
  meaning of probability" is **too-easy and off-topic**.
- `genWalkReach`/`genWalkDuration`/`genWald`/`genMartingaleDoubling` (hard random-walk
  quiz) → L1. Ideal implication is Markov/Random-Walks or Conditional Expectation.
- Counting/sample-space errors (dice match/differ/all-same, coupon, order stats)
  arguably implicate **Counting** (also a prereq of the node) rather than L1.

### D4 — R2 plan mis-selection from keyword collisions  (S2, ~32 items)
Plan-type usage: `PLAN_EV`=470, probability-plan=15, binomial-plan=13,
conditional-plan=4, `GENERIC_PLAN`=0. The non-EV plans are **wrong** for EV items:
- `genNegBinomial` → **PLAN_BINOMIAL** ("*…what single probability are you
  after?*") because "neg**binomial**" contains "binomial" (`planForKeyword`). But
  the target is an **expected count** (r/p), not a probability.
- `genGeometricSum` → **probability plan** ("*…compare the size of the success part
  against the whole to land on the chance*") — it's an **EV of total payout**, not a
  chance. (`resolveProbabilityPlan` claims it via "geometric".)
- `genConditionalGeo` → **conditional-probability plan** ("*what fraction has the
  feature*") — the item is a conditional **expectation** E[A|A<B]. Mild.

### D5 — R1 over-truncation drops the leading question / corrective clause  (S3, ~20 items; brief says truncation-class is being fixed elsewhere)
`nameOnlyCoaching` frequently keeps a correct naming clause but drops the useful
coaching question. Two mechanisms:
- **op-word collision** — the naming *verb* is an operation word, so the algorithm
  falls back to first-sentence-only. e.g. `genCltVarianceNumeric/subtracted_variances`:
  authored "*You SUBTRACTED the variances … For INDEPENDENT terms, what does variance
  always do, even for D − H?*" → R1 = "*You SUBTRACTED the variances because the
  quantity is a difference.*" (the leading question is gone; " subtract" matched the
  operation marker).
- **`;` / sentence cut** dropping the actionable fix — e.g. `genCoupon/err:11.417`:
  "*That's the expected number of BOXES (137/12).*" drops "*…the question asks for
  the total COST, so multiply by \$2*", i.e. the whole point of the distractor.
Naming survives (Accuracy mostly OK) but Thoroughness suffers.

### D6 — R5 reveal formatting: duplicated tokens & giant unreduced fractions  (S3, cosmetic)
- Duplicated "`= X = X ≈`" reveals: `probability 1/N = 1/N ≈` (match trap, ×13),
  `2/λ² = 2/9 = 2/9 ≈` / `= 2/25 = 2/25` (exp-moment), `= 12 ≈ 12` / `= 13 ≈ 13`
  (sum-of-uniforms). The exact form already equals the simplified form.
- Un-simplified monster fractions in R5, e.g. `genEmptyBoxes`:
  `E[empty] = 20·(19/20)^34 = 30034640110980377619945846078500632729311721/8589934592000000000000000000000000000000000 ≈ 3.496`
  and `genDistinct`: `791266575/134217728 ≈ 5.895`. Correct but unreadable.

### D7 — `ev-7` quiz distractors carry no misconception tags  (S2, data gap)
Every `ev-7` group shows `tag=idx:N` (positional fallback), meaning the quiz
generators author `distractorRationale` but not `misconceptions[]`. Consequence:
misconception tracking degrades to `idx:` keys and `MISCONCEPTION_EDGE` can never
fire for the hardest EV topic (walks/martingales) — reinforcing D3's L1 mis-route.

## 4. Defect table (representative sample, grouped by level; quotes are actual output)

Severity: **S1** critical (wrong explanation/diagnosis/routing) · **S2** major
(generic-when-should-be-specific / mismatched sim / incomplete explanation /
missing rationale / wrong ZPD) · **S3** minor (formatting / slightly generic /
known truncation).

| Level / family | item id | wrong ans | Actual bad output (quoted) | Metric(s) failed | Sev |
|---|---|---|---|---|---|
| ev-7 `genMartingaleDoubling` idx:3 | ev-martingale-9-0 | -511 | R1 "*That's not the right answer yet — and it doesn't line up with any of the usual mistakes…*" (authored: "*That's the loss on the ruin path only… they sum to 0*") | ACCURACY, THOROUGH | **S2** |
| ev-7 `genMartingaleDoubling` idx:0 | ev-martingale-6-5 | -63 | same generic R1 despite authored "*…Weight it against the 63/64 chance of +\$1, they sum to 0*" | ACCURACY | **S2** |
| ev-5 `genSumUniformsNumeric` uniform_mean_is_full_L | ev-sumunifnum-2-1-4 | 2 | generic-fallback R1 despite authored "*You treated each uniform's mean as 1…*" (answer 1 tripped guard) | ACCURACY | **S2** |
| ev-2 `genOneReroll` err:0.5 | ev-reroll-6-3-3 | 0.5 | generic-fallback R1 despite authored "*That's the value of choosing to reroll (7/2 − 3)…*" (7/2 = answer tripped guard) | ACCURACY | **S2** |
| ev-5 `genCltVarianceNumeric` subtracted_variances | ev-cltvarnum-300-50-1 | 70.83 | R4 → "*Expected Value (Long-Run Average)*"; R1 drops the leading Q: "*You SUBTRACTED the variances because the quantity is a difference.*" | THOROUGH (R4 sim), ZPD | **S2** |
| ev-5 `genSecondMomentNumeric` mean_squared_not_second_moment | ev-2ndmomentnum-10-3 | 30.3 | R4 → `expected-value` sim (should be `clt`); ROUTE → L1 (should be Variance/CLT) | THOROUGH, ZPD | **S2** |
| ev-5 `genExpMomentNumeric` forgot_factor_two_exp | ev-expmomentnum-3-2 | 0.111 | R4 → `expected-value` sim; R5 "*= 2/λ² = 2/9 = 2/9 ≈ 0.222*" (dup token); ROUTE L1 | THOROUGH, ZPD | **S2** |
| ev-5 `genHeadsTimesTailsNumeric` product_of_means_dependent | ev-headstailsnum-16-3 | 64 | R4 → `expected-value` (dependence/variance concept); R1 truncated "*You used E[H]·E[T] = (n/2)².*" | THOROUGH, ZPD | **S2** |
| ev-4 `genCoupon` err:10 | ev-coupon-5-2-5 | 10 | R4 → "*Expected Value (Long-Run Average)*" — a dedicated `coupon-collector` sim exists and is never linked | THOROUGH (R4) | **S2** |
| ev-4 `genCoupon` err:11.417 | ev-coupon-5-2-5 | 11.417 | R1 "*That's the expected number of BOXES (137/12).*" drops "*…multiply by \$2*" (the actual fix); R4 mismatch | THOROUGH | **S2** |
| ev-6 `genOverlap` err:0.9 | ev-overlap-20-9-9-2 | 0.9 | R4 → `expected-value` for a 2-D **area probability**; `geometric-dartboard` exists | THOROUGH (R4) | **S2** |
| ev-6 `genMeetWithin` err:0.15 | ev-meet-20-3-4 | 0.15 | R4 → `expected-value` (area probability); R1 cut before "*…its area is 1 − ((L−t)/L)²*" | THOROUGH | **S2** |
| ev-6 `genMaxDice` err:5.5 | ev-maxdice-10-3-0 | 5.5 | R4 → `expected-value`; `order-statistics` sim exists for E[max] | THOROUGH (R4) | **S2** |
| ev-6 `genUniformSpacing` err:0.7 | ev-unifspacing-3-2-1 | 0.7 | R4 → `expected-value`; should be `order-statistics` | THOROUGH (R4) | **S2** |
| ev-7 `genWalkReach` idx:0 | ev-walkreach-100-53-2 | 0.47 | R4 → `expected-value` for gambler's-ruin hitting prob; `gamblers-ruin` sim exists; ROUTE L1 | THOROUGH, ZPD | **S2** |
| ev-7 `genWalkDuration` idx:1 | ev-walkdur-20-6-1 | 120 | R4 → `expected-value`; should be `gamblers-ruin`; ROUTE L1 (walk error → L1) | THOROUGH, ZPD | **S2** |
| ev-3 `genNegBinomial` err:20 | ev-negbin-20-2-3 | 20 | R2 = **PLAN_BINOMIAL** "*…what single probability are you after?*" (target is an expected count) | THOROUGH (R2) | **S2** |
| ev-3 `genGeometricSum` err:6.5 | ev-geomsum-12-1_3-1 | 6.5 | R2 = **probability plan** "*…land on the chance*" for an EV-of-payout item | THOROUGH (R2) | **S2** |
| ev-1 `genTwoDiceMatchNumeric` specified_both_faces | ev-matchnum-10-1 | 0 | R4 → `expected-value` for P(match)=1/N (a probability); R5 dup "*probability 1/10 = 1/10 ≈ 0.1*" | THOROUGH | **S2**/S3 |
| ev-1 `genAllSameCoinsNumeric` single_all_same_run | ev-allsamenum-2-5 | 0.3 | R4 → `expected-value` for a coin **probability** (should be `coin-flips`/`sample-space`) | THOROUGH (R4) | **S2** |
| ev-4 `genEmptyBoxes` err:0 | ev-emptyboxes-20-34-2 | 0 | R5 reveal prints 44-digit/40-digit unreduced fraction before "≈ 3.496"; R1 cut before "*use P(empty)=…*" | THOROUGH (R5) | **S3** |
| ev-1 `genThreeDicePayoffNumeric` ignored_loss_branch | ev-3dicenum-20-13-6-0 | 5.97 | R1 truncated "*What happens 120/216 of the time.*" (dropped "*does it add to or subtract from the total?*") | THOROUGH | **S3** |
| ev-1 `genTwoDiceMatchNumeric` excluded_first_face | ev-matchnum-8-0 | 0.143 | R1 = "*You divided by 8−1.*" (terse; leading Q dropped; borderline hints method) | ACCURACY(mild), THOROUGH | **S3** |
| ev-7 `genWalkReach` idx:1 | ev-walkreach-100-53-2 | 0.50 | R1 "*A symmetry guess. The walk is fair per step.*" (dropped "*…skews to i/N*") | THOROUGH | **S3** |
| ev-7 (all quiz) `idx:N` | ev-7 * | — | every distractor `tag=idx:N` → no `misconceptions[]` authored → no MISCONCEPTION_EDGE possible | ZPD (data gap) | **S2** |
| ev-8 flashcards | — | — | `[distinct items sampled for ev-8: 0]` — divergent-EV / procedure cards get no ladder at all | coverage | **S3** |

(The remaining ~48 scored groups follow the same three patterns: correct R1
naming + `expected-value` R4 + L1 route. Full per-metric scores fed the §2
averages.)

## 5. Top ~10 worst offenders (ranked)

1. **R4 sim monoculture (D1)** — 502/506 rungs point at the generic
   `expected-value` running-average sim; ~10 families have a bespoke, better sim
   (`clt`, `coupon-collector`, `order-statistics`, `geometric-dartboard`,
   `gamblers-ruin`) that is never reached. *Single biggest Thoroughness hit.*
2. **Variance/CLT items route to L1 (D3)** — second-moment/variance errors
   (`genCltVarianceNumeric`, `genSecondMomentNumeric`, `genExpMomentNumeric`,
   `genHeadsTimesTailsNumeric`) remediate to "the meaning of probability" instead
   of Variance/CLT: wrong, too-easy prereq. *Worst ZPD miss.*
3. **Martingale EV=0 → generic fallback (D2)** — fair-game distractors whose
   rationale says "*sum to 0*" get their specific naming replaced by the generic
   "*doesn't line up with any usual mistakes*". The one topic where the answer (0)
   is intrinsic to the explanation.
4. **2-D area-probability items sent to an EV-averaging sim (D1)** —
   `genOverlap`/`genMeetWithin` are probabilities; the running-average sim
   illustrates nothing about a diagonal-band area. Doubly wrong (sim + concept).
5. **`genNegBinomial` gets the binomial "find the probability" plan (D4)** — R2
   asks for a probability when the answer is an expected count; keyword collision
   on "binomial".
6. **`genGeometricSum` gets a probability plan (D4)** — an EV-of-total-payout item
   coached as "compute the chance".
7. **Random-walk quiz has no misconception tags (D7)** — `ev-7` distractors are
   all `idx:N`, so the hardest EV topic can never route via a misconception edge.
8. **`genCoupon` err:11.417 drops the fix (D5)** — R1 keeps "*that's the expected
   number of BOXES*" but discards "*multiply by \$2*", the sole correction the
   learner needs.
9. **Giant unreduced-fraction R5 reveals (D6)** — `genEmptyBoxes` / `genDistinct`
   show 40+-digit fractions in the "reveal" a learner is meant to read.
10. **Dice/coin probability families on the EV sim (D1)** — `genTwoDiceMatchNumeric`,
    `genDifferNumeric`, `genAllSameCoinsNumeric` are P(event) questions pointed at
    the E[X] averaging sim (should be `dice-rolls`/`sample-space`/`coin-flips`),
    compounded by duplicated `1/N = 1/N` R5 tokens.

## 6. Verified-against-source spot checks
- Sim wiring & override: `SECTION_SIM_OVERRIDES["Expected Value"]="expected-value"`,
  and no EV generator family in `SIM_BY_FAMILY` / no EV tag in
  `SIM_BY_MISCONCEPTION` (`hintTopicHelp.ts`) → confirms D1.
- Target sims exist: `clt`, `coupon-collector`, `order-statistics`,
  `geometric-dartboard`, `gamblers-ruin`, `dice-rolls` all present in
  `catalog.ts` (lines 107/153/161/197/217/277) → confirms "better sim exists".
- Guard: `containsFinalAnswer(rung1Text, answer)` fallback in `hintLadder.ts`
  (rung-1 block) → confirms D2; martingale EV solver yields 0, so "sum to 0"
  rationales are the collision.
- Routing: `PREREQ_DAG[EXPECTED_VALUE].prereqs=[L1_MEANING, COUNTING]`,
  `prereqs[0]=L1`; `MISCONCEPTION_EDGE` lacks the EV tags used → confirms D3.
- R2 selection: `planForKeyword` matches "binomial" inside "negbinomial" and the
  probability resolver claims "geometric" → confirms D4.
