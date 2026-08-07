# QA Sub-Audit — Core Probability module (`src/content/probability/{levels,generators}.ts`)

Scope: the Core-Probability section of the probability track — parametric numeric
families in **pr-1..pr-3** (`genUnionNumeric`, `genIntersectionIndepNumeric`,
`genCombinationsNumeric`, `genConditionalNumeric`, `genBayesNumeric`,
`genAtLeastOneNumeric`, `genExpectedValueNumeric`, `genBinomialNumeric`,
`genGeometricNumeric`) and the STATIC hand-authored pools in **pr-4** (`hardProblemsNumeric`)
and **pr-5** (`latticeProblemsNumeric`). Read-only; no `src/**` file was modified.
Evidence: `datasets/qa-audit/raw/prob.txt` (5 levels × 8 seeds), verified against
`generators.ts`, `levels.ts`, `hintLadder.ts`, `errorModes.ts`, `hintTopicHelp.ts`,
`planOfAttack.ts`/`plans/probabilityPlans.ts`, `prereqDAG.ts`, `policy.ts`.

Sample: **48 distinct (item, wrong-answer)** pairs, deduped, covering all 9 parametric
families (pr-1..3) AND all 11 static items (pr-4: 6 items, pr-5: 5 items).

---

## 1. Defect table

Severity key: **S1** critical (wrong explanation/diagnosis/routing) · **S2** major
(generic-when-should-be-specific / mismatched sim / masking-slip / incomplete R5 / missing
commonError) · **S3** minor (formatting / slightly-generic / known truncation class).

| # | level / family | item id | wrong ans | actual bad output (quoted) | metric(s) failed | sev |
|---|---|---|---|---|---|---|
| D1 | pr-2 / genConditionalNumeric | pr-condnum-0.5-0.4-0.2 | 2 | R1: `Keep in mind, probabilities are always in the range [0, 1]! Check your arithmetic so your probability lands in that range too.` — AUTHORED was `You inverted the ratio. P(A|B) puts the joint on top and P(B) on the bottom…` (tag `reversed_conditional`) | Accuracy (domain-pointer MASKS canonical misconception) | **S2** |
| D2 | pr-2 / genConditionalNumeric | pr-condnum-0.3-0.6-0.18 | 3.33 | R1: `Keep in mind, probabilities are always in the range [0, 1]!…` — masks `You inverted the ratio…` (`reversed_conditional`) | Accuracy (masking) | **S2** |
| D3 | pr-2 / genConditionalNumeric | pr-condnum-0.6-0.5-0.3 | 1.67 | same domain-pointer, masks `You inverted the ratio…` | Accuracy (masking) | **S2** |
| D4 | pr-2 / genConditionalNumeric | pr-condnum-0.7-0.4-0.28 | 1.43 | same domain-pointer, masks `You inverted the ratio…` | Accuracy (masking) | **S2** |
| D5 | pr-2 / genAtLeastOneNumeric | pr-atleastnum-25-4 | 1.6 | R1: `Keep in mind, probabilities are always in the range [0, 1]!…` — masks `Close, you added the per-trial probabilities (n·p)…` (`at_least_one_naive`) | Accuracy (masking canonical tag) | **S2** |
| D6 | pr-2 / genAtLeastOneNumeric | pr-atleastnum-25-3 | 1.2 | same domain-pointer, masks the `n·p` naming | Accuracy (masking) | **S2** |
| D7 | pr-2 / genAtLeastOneNumeric | pr-atleastnum-13-4 | 1.3333 | same domain-pointer, masks the `n·p` naming | Accuracy (masking) | **S2** |
| D8 | pr-1 / genIntersectionIndepNumeric | pr-andnum-23-35 | 1.27 | R1: `Keep in mind, probabilities are always in the range [0, 1]!…` — masks `Close, you added the two probabilities…` (`and_means_add`) | Accuracy (masking canonical tag) | **S2** |
| D9 | pr-3 / genBinomialNumeric | pr-binomnum-6-3-1 (also 4-3, 4-1, 5-4, 5-2, 5-3, 6-2, 6-1) | 20 (resp. 4,4,5,10,10,15,6) | R1: `Keep in mind, probabilities are always in the range [0, 1]!…` — masks `That's C(6,3), the COUNT of arrangements, not yet a probability…` (`count_not_probability`). 8 distinct instances. | Accuracy (masking; generic-when-specific-exists) | **S2** |
| D10 | pr-4 STATIC (no family) | pr-gamblers-ruin | 0.5 | R4: `Open the Simulations tab → "Coin Flips (Any Bias)" and flip with any bias and watch the running proportion settle — streaks don't change the next flip.` A dedicated `gamblers-ruin` sim exists (`set the bias, starting stake, and target… watch the empirical ruin frequency match the closed-form probability`) but is unreachable. | Thoroughness (mismatched sim) | **S2** |
| D11 | pr-4 STATIC | pr-gamblers-ruin | 0.03 | R4 → Coin Flips (same mismatch; `gamblers-ruin` sim exists) | Thoroughness (mismatched sim) | **S2** |
| D12 | pr-4 STATIC | pr-coupon | 6 / 21 / 36 | R4 → `Coin Flips (Any Bias)`; a dedicated `coupon-collector` sim exists (`draw coupons… watch how many draws it takes… track the theoretical mean`). 3 instances. | Thoroughness (mismatched sim) | **S2** |
| D13 | pr-4 STATIC | pr-broken-stick | 0.5 / 0.3333 / 0.125 | R4 → Coin Flips; a dedicated `geometric-dartboard` sim exists (`throw uniformly-random darts… fraction landing inside the shape estimates its area ratio`) — exactly the broken-stick area argument. 3 instances. | Thoroughness (mismatched sim) | **S2** |
| D14 | pr-5 STATIC | pr-lattice-count | 12 / 7 / 343 | R4 → Coin Flips; item is pure path-counting (`sample-space` sim fits). Blurb `streaks don't change the next flip` is irrelevant to counting. 3 instances. | Thoroughness (mismatched sim) | **S2** |
| D15 | pr-5 STATIC | pr-catalan | 20 / 6 / 10 | R4 → Coin Flips; constrained path counting → should be `sample-space`. 3 instances. | Thoroughness (mismatched sim) | **S2** |
| D16 | pr-5 STATIC | pr-ballot | 0.625 / 0.4 / 0.5 | R4 → Coin Flips; ballot/reflection counting problem. 3 instances. | Thoroughness (mismatched sim) | **S2** |
| D17 | pr-5 STATIC | pr-grid-collision | 0.3333 / 0.4444 / 0.0278 | R4 → Coin Flips; two-walker collision problem, coin sim irrelevant. 3 instances. | Thoroughness (mismatched sim) | **S2** |
| D18 | pr-4 STATIC | pr-ant-cube | 6 / 8 / 12 | R4 → Coin Flips; random walk on a graph, coin sim irrelevant. 3 instances. | Thoroughness (mismatched sim) | **S2** |
| D19 | pr-4 STATIC | pr-birthday | 183 / 30 / 20 | R4 → Coin Flips; birthday/collision problem. 3 instances. | Thoroughness (mismatched sim) | **S2** |
| D20 | pr-4 STATIC | pr-hh / pr-hh-ht | 4,3,8 / 6,3,2 | R4 → Coin Flips, blurb `…watch the running proportion settle — streaks don't change the next flip.` This is *thematically* coin-related but the blurb teaches LLN/independence and even asserts "streaks don't change the next flip", the OPPOSITE of the lesson (pattern structure HH vs HT is exactly what drives the answer). 6 instances. | Thoroughness (misleading sim blurb) | **S2** |
| D21 | pr-3 / genExpectedValueNumeric | pr-evnum-* | all | R2: `Let's make a plan. (1) What is the full set of equally-likely outcomes you're choosing from?… (3) How does the count that qualifies relate to the whole set to give the probability?` — this is `PLAN_COUNTING`; the item is a probability-WEIGHTED-AVERAGE dollar EV, not an equally-likely count "probability". | Thoroughness (R2 wrong frame) | **S2** |
| D22 | pr-3 / genGeometricNumeric | pr-geonum-* | all | R2 = same `PLAN_COUNTING` "…to give the probability" plan; item asks for **expected number of trials** (1/p), not a probability at all. | Thoroughness (R2 wrong frame) | **S2** |
| D23 | pr-4/pr-5 STATIC (all) | pr-hh, pr-ant-cube, pr-gamblers-ruin, pr-birthday, pr-lattice-count, pr-catalan, pr-ballot, pr-grid-collision, pr-coupon, pr-broken-stick | all | R2 = `PLAN_COUNTING` for every static item (falls through family→misconception→"core probability" keyword). "Enumerate equally-likely outcomes → give the probability" is the wrong plan for waiting-times (E[HH]=6), hitting times (i/N), harmonic sums, geometric area, etc. | Thoroughness (R2 wrong frame) | **S2** |
| D24 | pr-4 STATIC | pr-birthday | 20 | R1: `Close, but a touch low.` (nameOnlyCoaching cut the authored feedback at " but " then fell back to the first sentence, which itself names no misconception). | Accuracy (generic, no trap named) | **S2** |
| D25 | pr-1 / genCombinationsNumeric | pr-combnum-10-3 (etc.) | 720 / 1000 / 30 | R2: `PLAN_COUNTING` ends "…to give the probability", but the item answer is a **count** (C(10,3)=120), never a probability. Right family of plan, wrong noun. | Thoroughness (R2 mildly off) | **S3** |
| D26 | pr-2 / genAtLeastOneNumeric | pr-atleastnum-15-3-3 | 0.6 / 0.008 / 0.992 | R4 → `Two Independent Events` with blurb `…simulate to see how often BOTH happen (it's P(A)·P(B)…)`. Family map is defensible, but the blurb frames P(A∩B), not the `1−(1−p)^n` complement the item is about. | Thoroughness (sim blurb off-frame) | **S3** |
| D27 | pr-4 / pr-5 STATIC (all 11 items) | — | all | R3 always renders `Here's the SAME kind of problem with different numbers, worked one step at a time…` with a `siblingPrompt` payload, but static items have **no generator** → no real sibling can be produced. The rung promises a fresh worked instance that the app cannot deliver. | Thoroughness (misleading rung 3) | **S2** |

Note on the "known" mid-sentence truncation class (S3): **none observed in this module.**
The `nameOnlyCoaching` back-off is working here — e.g. combinations authored `…so should you keep or divide out the 3! orderings…` is correctly reduced to the coherent `Close, that's the number of ORDERED arrangements P(10,3). A committee doesn't care about order.` No rung ends on a dangling connective in `prob.txt`.

Note on arithmetic-slip masking: **not observable in this harness.** The harness only
feeds authored `commonErrors` values, which always hit the `matched` branch of rung-1
(priority above `isArithmeticSlip`). The arithmetic-slip nudge only fires for OFF-catalog
near-misses, so it cannot mask an authored misconception in Core Probability. The masking
that IS present is the **domain-pointer** override (D1–D9), which sits ABOVE `matched` in
`hintLadder.ts` and therefore *does* suppress authored feedback whenever a legitimate
commonError value lands outside [0,1].

---

## 2. Per-metric averages (N = 48 distinct item×wrong-answer)

Scored 0–10. Metric definitions per the audit brief.

| Metric | Avg | Notes |
|---|---|---|
| **Accuracy** (R1 names the SPECIFIC trap for that exact wrong answer) | **6.8 / 10** | ~30/48 name the specific trap well (≈9). Dragged down by the **16 domain-pointer maskings** (D1–D9, ≈3–4) and 1 thin static naming (D24). |
| **Thoroughness** (rungs complete+coherent, R2 useful, R4 RIGHT sim, R5 complete+correct) | **5.4 / 10** | R5 explanations are correct & complete throughout (verified against generators/levels). Killed by **R4 sim mismatch on ~30 static instances → coin-flips** (D10–D20), **R2 wrong-frame** for EV/geometric/static (D21–D23), and the **phantom rung-3 sibling** for all static items (D27). |
| **Next-topic ZPD** (appropriate prereq/floor) | **7.6 / 10** | All Core-Probability fails resolve to the **L1 "Meaning of Probability & Sample Space" floor** (`floor:true` in `prereqDAG.ts` → `policy.ts` returns `floor-teach`, NOT a drop to L0). That is the right ZPD for a meaning floor. Minor: combinations' `ordered_vs_unordered` truly implicates Counting, but Counting is not a prereq of the L1 node, so the misconception-edge is inert and it floor-teaches meaning instead (defensible). The harness `target=Mental Arithmetic (L0)` line is a display simplification — it ignores the floor short-circuit. |

R5 correctness spot-checks (all pass): union `6/20+5/20−1/20=0.5`; conditional `0.18/0.6=0.3`;
at-least-one `1−(0.8)^3=0.488`; gambler's ruin `3/10=0.3`; coupon `6·2.45=14.7`;
ballot `(5−3)/(5+3)=1/4`; grid-collision `(1/6)²+(4/6)²+(1/6)²=1/2`.

---

## 3. Ranked top offenders (worst first)

1. **Static pool → `coin-flips` sim (whole pr-5 + most of pr-4), D10–D20.** ~30 rung-4
   instances misdirect to Coin Flips because static items have **no `family` and non-canonical
   per-item tags**, so `simLinkFor` falls all the way through to the `"Core Probability" →
   "coin-flips"` section override. Path-counting (lattice/catalan/ballot), random walks
   (ant-cube/grid-collision), birthday, coupon-collector, broken-stick and gambler's ruin
   all get "flip a coin and watch the proportion settle" — and dedicated `sample-space`,
   `gamblers-ruin`, `coupon-collector`, `geometric-dartboard` sims **exist but are unreachable**.

2. **Domain-pointer masks canonical misconceptions on out-of-[0,1] distractors (D1–D9).**
   16 instances. `reversed_conditional` (the `pB/pBoth` inversion is `>1` for **all 5** conditional
   param sets), `at_least_one_naive` (`n·p>1`), `and_means_add` (`pA+pB>1`), and binomial
   `count_not_probability` all get the generic "probabilities are always in [0,1]" line instead
   of their authored, tagged diagnosis. The specific naming that the whole error-mode framework
   exists to deliver is suppressed exactly when the mistake is most diagnosable.

3. **Rung-2 `PLAN_COUNTING` wrong-frame for EV, Geometric, and every static item (D21–D23).**
   `resolveProbabilityPlan` returns non-null for anything whose section contains "core probability"
   (keyword fallback), so the EV/Combinatorics/Stochastic resolvers never run for this section.
   Result: expected-payout, expected-wait (1/p), pattern waiting-times and hitting-times all get
   an "enumerate equally-likely outcomes → give the probability" plan that does not match the task.

4. **Phantom worked-sibling (rung 3) for all 11 static items (D27).** The rung promises "the SAME
   kind of problem with different numbers, worked one step at a time," but static pool items have
   no generator, so no sibling can be materialized — the support the rung advertises can't exist.

5. **`pr-gamblers-ruin` value 0.7 → `venn-two-events` sim (D10 sibling).** The `complement_confusion`
   tag IS canonical, so it escapes coin-flips — only to hit a Venn-diagram sim (for a 1-D gambler's-ruin
   complement). The one static item whose tag resolves still misses its ideal `gamblers-ruin` sim.

6. **Coin-sim blurb contradicts the lesson for pr-hh / pr-hh-ht (D20).** Even where "coins" is
   on-theme, the blurb "streaks don't change the next flip" is the opposite of the pattern-waiting-time
   insight (HH=6 vs HT=4 precisely because a reset after a head is costly).

7. **Thin/empty rung-1 naming on pr-birthday value 20 (D24).** `Close, but a touch low.` names no
   misconception — the authored feedback's only specific content is a corrective directive (rightly
   withheld), leaving nothing to name. An authoring gap: the birthday distractors front-load
   "over/under-guess" rather than a nameable trap.

8. **Binomial `count_not_probability` masked despite being the most teachable trap (D9, 8×).** The
   authored `That's C(n,k), the COUNT of arrangements, not yet a probability… what do you multiply by?`
   is stronger and answer-withholding; the generic `[0,1]` pointer is technically true (the count is
   out of range) but throws away the specific, tagged coaching on the single most common binomial error.

---

### Summary of systematic root causes (for triage)
- **Static-pool items carry no `family` and non-canonical per-item `misconception` tags** → they miss
  `SIM_BY_FAMILY`/`SIM_BY_MISCONCEPTION`, `PLAN_BY_FAMILY`/`PLAN_BY_MISCONCEPTION`, and `MISCONCEPTION_EDGE`,
  and fall through to the section defaults (coin-flips sim, PLAN_COUNTING, floor-teach) and the phantom rung-3. (D10–D23, D27)
- **Rung-1 domain-pointer priority sits ABOVE the matched-misconception branch** → any authored
  commonError value outside [0,1] is overridden by the generic range reminder. (D1–D9)
- **`resolveProbabilityPlan`'s "core probability" keyword catch-all** shadows the EV/combinatorics/stochastic
  plan resolvers for the entire section. (D21–D23, D25)
