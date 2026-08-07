# QA Audit — Probability & Statistics: Distributions & Spread

**Scope (READ-ONLY):** the hint-ladder output for the "distributions & spread" cluster:

- `jointDistributions` (`ek-joint`, `ek-joint-2`, `ek-joint-3`)
- `conditionalExpectation` (`ce-1`, `ce-2`)
- `varianceCovarianceClt` (`vc-1`, `vc-2`; `vc-3` is flashcard-only → out of scope for the ladder)
- `continuousDistributions` (`cd-1`, `cd-2`, `cd-3`)
- `gammaDistribution` (`ek-gamma`)
- `mgf` (`ek-mgf`)
- `limitTheorems` (`ek-limit`)

**Method.** A temporary vitest harness imported each level's generator families and, for **200 seeds each**, materialized every item and — for **every authored wrong answer** (numeric `commonErrors → chosenValue`; quiz `distractorRationale → chosenIndex`) — resolved the misconception tag exactly as the app does (`resolveNumericTag` / `resolveQuizTag`) and built the full ladder via `buildHintLadder(...)` (threading each level's real `section`). This yielded **3,339 unique `(item, wrong-answer)` pairs across 42 families**. Every ladder was scored on all 5 rungs + the rung-5 reveal + next-topic routing (`policy.ts` / `probe.ts` / `prereqDAG.ts`). The harness + JSON dumps were deleted after analysis.

**Scoring** (/10 per axis): (1) ACCURACY — rung-1 names the specific trap (not a generic fallback), diagnosis matches the misconception; (2) THOROUGHNESS — every rung a complete coherent sentence, rung-2 plan useful, **rung-4 sim is the RIGHT sim**, rung-5 complete + correct; (3) NEXT-TOPIC ZPD — failing routes to an appropriate prerequisite (~85% target).

---

## Headline findings

1. **rung-4 sim mismatch is the dominant defect** in this cluster. Section/family sim-resolution sends whole families to the wrong Simulations-tab sim (or, for no-link sections, to a generic *"enumerate the equally-likely outcomes / run trials / count how often the event happens"* text that is nonsensical for analytic density / MGF work). ~**60% of families** (25/42) carry a mismatched or unfit rung-4.
2. **The answer-withholding guard silently downgrades correct authored coaching to the generic fallback** whenever a `commonError.feedback` (or a quiz rationale) embeds the correct answer value/string. This is catastrophic for `genMarkovBound` (**33/36 = 92%** generic) and `genMgfSum` (**3/4**), and sporadic elsewhere.
3. **rung-2 plan keyword collisions** send `genMarkovBound` to the **Markov-*chain*** plan (it's Markov's *inequality*) and the covariance/correlation/variance-combination families to the **CLT** plan.
4. **rung-5 reveals are complete and correct in 100% of the 3,339 cases** (0 truncations, solver-grounded) — the strongest part of the ladder here.
5. The `nameOnlyCoaching` truncation class (flagged as fixed elsewhere) produces **0 broken/mid-word sentences** in this cluster; its only residual harm is mild semantic clipping (e.g. dropping "…instead of its derivative"). Not a focus.

---

## Defect table

Severity: **H** = rung is actively wrong/misleading or suppresses coaching for most of a family; **M** = mismatch that materially reduces pedagogical value; **L** = sporadic / minor / cosmetic.

| # | Module | Level / family | Example item id | Wrong answer | Bad output | Metric failed | Sev |
|---|--------|----------------|-----------------|--------------|------------|---------------|-----|
| 1 | varianceCovarianceClt | vc-2 / `genMarkovBound` | `gen-markov-bound-5-1_1-10` | value=2 | **Every** `commonError.feedback` states the answer (e.g. "…= E[T]/a = 5/10 = **1/2**…") → the withholding guard nukes rung-1 to the generic "doesn't line up with any usual mistakes" fallback in **33/36** cases | ACCURACY (generic-when-specific) | **H** |
| 2 | varianceCovarianceClt | vc-2 / `genMarkovBound` | `gen-markov-bound-4-3_2-9` | value=1.5 | rung-2 = the **Markov-CHAIN** plan ("What are the possible states… where you land next…") — this is Markov's *inequality*, not a chain | THOROUGHNESS (rung-2 mismatch) | M |
| 3 | varianceCovarianceClt | vc-2 / `genMarkovBound` | `gen-markov-bound-4-3_2-9` | value=1.5 | rung-4 → "Central Limit Theorem" sim ("average many draws… bell curve") for a mean-only concentration bound | THOROUGHNESS (rung-4 sim) | M |
| 4 | mgf | ek-mgf / `genMgfSum` | `gen-mgf-sum` | choice "M(t)" | Rationale ends "…multiplies the MGFs: **M(t)²**" = the answer string → substring guard trips → generic fallback (3/4 distractors) | ACCURACY (generic-when-specific) | M |
| 5 | varianceCovarianceClt | vc-1 / `genMaxCovNumeric` | `gen-maxcovnum-18-2` | value=48 | "used the means (6·8)" feedback embeds a mean digit equal to the answer (6) → guard trips → generic (**16/115**) | ACCURACY (generic-when-specific) | M |
| 6 | jointDistributions | ek-joint / `genTransform` | `gen-joint-transform-2_5` | value=0.04 | rung-4 → "Double Integral of a Joint Density" ("drag a rectangle… the chance BOTH variables land in the box") — item is a **single-variable** Y=X² CDF transform; no joint density exists | THOROUGHNESS (rung-4 sim) | M |
| 7 | jointDistributions | ek-joint-2 / `genJointMarginal` | `gen-joint-marg-*` | any | Discrete pmf-table marginal → continuous bivariate-normal double-integral heatmap sim | THOROUGHNESS (rung-4 sim) | M |
| 8 | jointDistributions | ek-joint-2 / `genJointConditional` | `gen-joint-cond-*` | value=0.2 | Discrete conditional pmf → continuous joint-density heatmap sim | THOROUGHNESS (rung-4 sim) | M |
| 9 | jointDistributions | ek-joint-3 / `genJointCovariance` | `gen-joint-cov-*` | any | Discrete covariance-from-pmf → joint-density heatmap sim (shows correlation, never computes Cov from counts) | THOROUGHNESS (rung-4 sim) | M |
| 10 | jointDistributions | ek-joint / `genJointMean` | `gen-joint-mean-3-3` | value=1.5 | rung-4 = "Expected Value (running average)" sim for a continuous marginal mean; **plus** sporadic generic rung-1 (3/15: "…pulled up to **2**A/3" ⇒ literal "2" == answer 2) | THOROUGHNESS + ACCURACY | M |
| 11 | conditionalExpectation | ce-2 / `genRandomSumVar` | `gen-condexp-rsumvar-8-4-2-5` | value=40 | rung-4 = "Expected Value (running average)" sim — the item is a **variance** decomposition (Var(S)), not a mean (n=339) | THOROUGHNESS (rung-4 sim) | M |
| 12 | conditionalExpectation | ce-1 / `genCondMean`, `genTowerTable` | `gen-condexp-cmean-*` | any | rung-4 = EV running-average sim; it never illustrates conditioning / renormalising a column / the tower rule | THOROUGHNESS (rung-4 sim) | L |
| 13 | varianceCovarianceClt | vc-1 / `genMaxCovNumeric` | `gen-maxcovnum-*` | value=36 | rung-4 → CLT sim; rung-2 → CLT plan ("single observation or the behavior of an average…") — item is the Cauchy–Schwarz covariance ceiling | THOROUGHNESS (rung-2 + rung-4) | M |
| 14 | varianceCovarianceClt | vc-1 / `genAffineCorrNumeric` | `gen-affinecorrnum-*` | any | rung-4 → CLT sim; rung-2 → CLT plan — item is affine-correlation **sign** (n=501, the largest family) | THOROUGHNESS (rung-2 + rung-4) | M |
| 15 | varianceCovarianceClt | vc-2 / `genVarCombo` | `gen-varcombo-*` | value=22 | rung-4 → CLT sim; rung-2 → CLT plan — item is Var(aX+bY) (n=497) | THOROUGHNESS (rung-2 + rung-4) | M |
| 16 | varianceCovarianceClt | vc-1 / `genSumSDNumeric` | `gen-sumsdnum-*` | any | rung-4 → CLT sample-mean bell-curve sim for an independent-**sum SD** item (variances add) | THOROUGHNESS (rung-4 sim) | L |
| 17 | continuousDistributions | cd-1 / `genDensityNorm`, `genDensityMean`; cd-2 / `genUniformVar`, `genExpMin` | `gen-density-norm-2-3` | value=0.037 | No-link section ⇒ rung-4 = generic "enumerate the equally-likely outcomes / run trials / count how often the event happens" — meaningless for a normalising constant / E[X]=∫x·f / variance | THOROUGHNESS (rung-4 unfit) | M |
| 18 | gammaDistribution | ek-gamma / all three | `gen-gamma-var-*` | any | Same generic-enumeration rung-4 for closed-form Gamma mean k/λ and variance k/λ² (no event to enumerate) | THOROUGHNESS (rung-4 unfit) | M |
| 19 | mgf | ek-mgf / `genMgfMean`, `genMgfVar`, `genMgfIdentify` | `gen-mgf-mean-4` | choice "1" | Generic-enumeration rung-4 ("run many quick trials, count how often the event happens") for a pure MGF-derivative / identify-the-distribution question — there is no event/trial | THOROUGHNESS (rung-4 unfit) | M |
| 20 | jointDistributions | JOINT node routing | (all families) | any | Failing **any** Joint item routes to **Continuous Distributions** (first prereq). Discrete pmf marginal/conditional/independence items — and the `and_means_add` "added the marginals" error — should implicate **Core / Conditional Probability**; the `and_means_add` misconception edge (→ L1) is ignored because L1 isn't a JOINT prereq | NEXT-TOPIC ZPD | M |
| 21 | continuousDistributions | cd-2 / `genUniformProb` | `gen-uniform-prob-5-10-5-10` | value=0 | Generator can draw a=L & b=U ⇒ **degenerate P over the full support = 1** (trivial item); also drives 7/432 generic rung-1 (feedbacks contain "1") | ACCURACY + content quality | L |
| 22 | continuous / gamma | sporadic | `gen-gamma-sumexp-2-2` | value=0.5 | Feedbacks that restate a formula containing the (small-integer) answer trip the guard → generic rung-1 (`genGammaSumExp` 6/32, `genGammaMean` 3/33, `genDensityMean` 2/20, `genUniformVar` 5/75) | ACCURACY (generic-when-specific) | L |
| 23 | all numeric | rung-1 (many families) | `gen-density-norm-2-3` | value=0.037 | `nameOnlyCoaching` under-cuts (no corrective marker present) ⇒ rung-1 leaks the full **method/formula** (e.g. "…⇒ c = (n+1)/L^{n+1}", "P(X²≤c)=P(X≤√c)=√c", "so its mean is k/λ") — violates the name-only contract while still correctly naming the trap | THOROUGHNESS (answer-withholding) | L |
| 24 | mgf / limitTheorems | quiz families | `gen-mgf-mean-4` | choice "1" | `nameOnlyCoaching` semantic clipping drops the contrast clause (e.g. "you evaluated the MGF" loses "…instead of its derivative") — sentence stays grammatical (0 broken sentences) but diagnosis weakened | THOROUGHNESS (known truncation class) | L |

---

## Per-module metric averages (/10)

| Module | ACCURACY | THOROUGHNESS | NEXT-TOPIC ZPD | Notes |
|--------|:---:|:---:|:---:|-------|
| jointDistributions | 8.5 | 5.5 | 6.0 | rung-5 perfect; rung-4 sim mismatched for transform + all discrete-pmf families; ZPD routes everything to Continuous |
| conditionalExpectation | 9.5 | 6.0 | 8.0 | rung-1 always specific; every family points at the EV sim (weak for conditioning; wrong for `genRandomSumVar` variance) |
| varianceCovarianceClt | 7.0 | 4.5 | 8.0 | dragged down by `genMarkovBound` (92% generic + Markov-chain plan) and cov/corr/var-combo → CLT sim+plan; `genCltTail`/`genCltDiffZ` are the only clean rung-4s |
| continuousDistributions | 9.0 | 5.5 | 8.0 | strong naming; no-link section ⇒ generic-enumeration rung-4 unfit for the analytic families; degenerate uniform-prob items |
| gammaDistribution | 8.5 | 4.5 | 9.0 | good ZPD (→ Continuous); every rung-4 is the unfit generic-enumeration text; ~10% sporadic generic rung-1 |
| mgf | 8.0 | 5.0 | 8.0 | `genMgfSum` 75% generic (answer-string leak); generic-enumeration rung-4 nonsensical for MGF derivations |
| limitTheorems | 9.5 | 7.0 | 9.0 | best in cluster: specific naming, CLT sim fits the section, complete reveals, clean ZPD (→ Variance/CLT) |
| **Cluster mean** | **8.6** | **5.4** | **8.0** | THOROUGHNESS is the systemic weak axis (rung-4 sim resolution) |

---

## Ranked worst offenders

1. **`genMarkovBound` (varianceCovarianceClt / vc-2)** — triple failure: rung-1 generic in 92% of cases (all commonError feedbacks state the answer), rung-2 = wrong-domain **Markov-chain** plan, rung-4 = **CLT** sim. Nearly every rung is degraded.
2. **`genTransform` (jointDistributions / ek-joint)** — rung-4 points a single-variable Y=X² CDF-transform at the **bivariate joint-density double-integral** sim ("the chance BOTH variables land in the box"). Clearest sim/content mismatch.
3. **`genMgfSum` (mgf / ek-mgf)** — 3 of 4 distractor rationales embed the answer string "M(t)²" → guard downgrades rung-1 to the generic fallback; rung-4 also unfit (generic-enumeration for a conceptual MGF-of-a-sum question).
4. **varianceCovarianceClt covariance/correlation/variance-combo families** (`genMaxCovNumeric` n=115, `genAffineCorrNumeric` n=501, `genVarCombo` n=497) — the two largest families in the cluster both get the **CLT plan (rung-2) + CLT sim (rung-4)**, neither of which is about the CLT; `genMaxCovNumeric` additionally goes generic 14% of the time.
5. **`genRandomSumVar` (conditionalExpectation / ce-2, n=339)** — a law-of-total-**variance** item routed to the "running average converges to E[X]" (mean) sim; largest condExp family, uniformly mismatched rung-4.

---

## What is working well (for contrast)

- **Rung-5 reveals: 0/3,339 truncated, all solver-grounded and correct** across every family.
- **`limitTheorems`** and the two genuine CLT families (`genCltTail`, `genCltDiffZNumeric`) have well-matched rung-4 (CLT sim) and correct specific rung-1 naming.
- **`genJointIndependence`** is the one joint family with a correct rung-4 (`Two Independent Events`) and, on its `and_means_add` distractor, the correct rung-2 (`PLAN_INDEP_AND`).
- **ZPD mechanics** (`probeTierFor` ~0.85 target + tier-nearest probe level) work as designed; the only ZPD *content* issue is the Joint→Continuous prerequisite choice.
- No `nameOnlyCoaching` mid-word/broken-sentence truncations were observed in this cluster.
