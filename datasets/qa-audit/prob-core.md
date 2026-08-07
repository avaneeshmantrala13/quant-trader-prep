# QA Audit — Probability Core (hint ladders, remediation ZPD)

**Repo:** `quant-trader-prep` · **Scope (READ-ONLY):** the probability-core content
modules and their generated hint ladders. No app source was modified.

**Modules audited**

| key | source | levels sampled |
|---|---|---|
| combinatorial | `src/content/probabilityStats/combinatorialAnalysis/{levels,generators…}.ts` | ca-1…ca-N |
| conditional | `src/content/probabilityStats/conditionalProbability/{levels,generators}.ts` | cp-1…cp-N |
| ev | `src/content/probabilityStats/expectedValue/{levels,generators}.ts` | ev-1…ev-8 |
| game | `src/content/probabilityStats/gamePuzzle/{levels,generators}.ts` | gt/game levels |
| prob (core) | `src/content/probability/{levels,generators}.ts` (`section: "Core Probability"`) | pr-1…pr-5 |

## Method

A temporary harness (`qa_harness.ts`, since deleted) imported each module's real
`Level[]`, materialized every level across **8–20 seeds**, and for **each authored
wrong answer** (quiz `distractorRationale[i]` → `chosenIndex=i`; numeric
`commonErrors[j]` → `chosenValue=value`) called the exact production
`buildHintLadder({question, chosenIndex|chosenValue, misconceptionTag, section})`
— resolving `misconceptionTag` with `resolveQuizTag`/`resolveNumericTag` just like
`src/pages/lesson/cards.tsx` does. For every (item, wrong-answer) it dumped all 5
rungs, the rung-4 `simLink`, the confront payload, and the remediation descent
target computed from `prereqDAG.ts` + `policy.ts`. Distinct
(item, wrong-answer) pairs sampled: **combinatorial 1228, conditional 451, ev 506,
game 80, prob 227** (deduped by family+tag+choice for scoring). Five parallel
sub-auditors scored their module; this file consolidates them.

**Scoring** (each metric /10): **ACCURACY** = rung-1 names the *specific* trap for
that exact wrong answer; **THOROUGHNESS** = every rung a complete coherent sentence,
rung-2 plan useful, rung-4 sim the *right* sim, rung-5 explanation complete+correct;
**NEXT-TOPIC ZPD** = a failure routes to an appropriate prerequisite (~85% target,
correct prereq, not unrelated/too-easy/too-hard).

**Severity:** **S1** critical (wrong/incorrect diagnosis, incorrect explanation,
broken/missing routing) · **S2** major (specific coaching silently replaced by a
generic nudge, mismatched sim, incomplete explanation, missing rationale) · **S3**
minor (formatting, slightly-generic plan, the known truncation class).

> **Note on the truncation class:** the `nameOnlyCoaching` mid-sentence
> truncation bug ("…so should you keep or") is being fixed by another worker.
> A scan of **all** sampled probability-core rungs found **zero** mid-sentence
> dangling-word endings, so this class does not currently manifest in these
> families — the audit focuses on the other defect classes below.

---

## Cross-cutting defects (span multiple modules) — highest leverage

### X1 (S2, systemic). Authored numeric feedback that mentions a fraction/factorial is silently nuked to a generic nudge by the answer-leak guard.
`buildHintLadder` rung-1 runs matched `commonErrors[j].feedback` through
`nameOnlyCoaching`, then applies `containsFinalAnswer(text, answer)`; if it trips,
the whole rung is replaced by `genericFallbackCoaching` ("*That's not the right
answer yet — and it doesn't line up with any of the usual mistakes… I won't guess
at what went wrong.*"). Because many authored diagnoses contain fraction/answer-like
substrings (`1/8!`, `C(8,7)`, `2/λ²`), the guard **false-positives** and discards a
correct, specific diagnosis.

- Example — `combinatorial · genOneAssignment · ca-oneassign-8-7-0`, wrong value `0`:
  authored *"1/8! = 1/40320 divides by every ordering of all 8 people, but only WHICH
  7 are chosen matters (unordered), that is C(8,7), not 8!."* → rung-1 shown to the
  learner is the generic "I won't guess at what went wrong" nudge.
- Frequency in sample: **combinatorial 15, conditional 7, ev 7, game 2** generic-fallback
  rung-1s that each had a specific authored diagnosis available. Fails ACCURACY +
  THOROUGHNESS.

### X2 (S2/S3, systemic). Rung-4 sim link over-generalizes per `section`, so the named sim frequently mismatches the item.
`simLinkFor` falls back to a single per-section sim when the misconception tag isn't
canonical. Two large veins:

- **Combinatorial → "Two-Dice Sample Space" for *everything*.** All **1228/1228**
  combinatorial items resolve to the `sample-space` sim, whose catalog **title is
  literally "Two-Dice Sample Space"** and whose blurb is "lay every equally-likely
  outcome out as a grid". For poker-hand counts, word arrangements, grid-path counts,
  hypergeometric scoops, etc., telling the learner to open a *two-dice* grid is a
  mismatch (you cannot lay out `C(52,5)` on a dice grid). S3 when the sample-space
  idea is loosely relevant, but the concrete named sim is wrong for non-dice families.
- **EV variance/second-moment families → "Expected Value (Long-Run Average)" sim.**
  **502/506** EV items point at the `expected-value` running-average sim, including
  `genCltVarianceNumeric` (tags `subtracted_variances`, `one_variance_only`,
  `other_variance_only`) and `genSecondMomentNumeric` (`variance_not_second_moment`,
  `mean_squared_not_second_moment`). A running-average-of-E[X] sim does **not**
  illustrate variance addition / `E[X²]=Var+mean²`; the `Central Limit Theorem` sim
  would. Mismatch → fails THOROUGHNESS (rung-4).

### X3 (S3, systemic). Duplicated-fraction rendering in rung-5 explanations.
When an already-reduced fraction is printed as "unreduced = reduced", the two sides
are identical and the string reads "`= x/y = x/y`".
- `conditional · memoryless/uniform`: *"…giving P = 1/5 = 1/5 ≈ 0.20"*, *"4/5 = 4/5"*,
  *"1/2 = 1/2"*, *"1/6 = 1/6"* (many seeds).
- `conditional · genBertrandNumeric`: *"P(underside also red) = 4/7 = 4/7 ≈ 0.5714"*.
- `ev · genSecondMomentNumeric`: *"2/λ² = 2/25 = 2/25 ≈ 0.08"*, *"2/9 = 2/9 ≈ 0.222"*.
Correct siblings (e.g. `2/4 = 1/2`) show the intent; the bug is the no-op reduction
branch. Cosmetic but pervasive and repeated on every affected seed.

### X4 (S2, ZPD). The "Counting & Combinatorics" node can only descend to Mental Arithmetic, so conceptual counting errors remediate to the wrong prerequisite.
`PREREQ_DAG` gives `Counting & Combinatorics` a single prereq `[L0 Mental Arithmetic]`.
Every combinatorial failure (1228/1228) — including conceptual `ordered_vs_unordered`
/ "unordered vs ordered / with-repetition" errors — routes to **Mental Arithmetic
(L0)**. Worse, **21** sampled items carry a misconception whose `MISCONCEPTION_EDGE`
target (e.g. `orderedVsUnordered → COUNTING`) *is the node itself*, so it isn't a
prereq and silently falls through to `prereqs[0] = L0`. Teaching arithmetic does not
address an ordered-vs-unordered *concept* gap → ZPD too-easy / prerequisite mismatch.

### X5 (S2/S3, ZPD). Game-puzzle numeric items carry no misconception tags, so every failure descends to "EV Decision Games & Market Making" regardless of the actual error.
All **80/80** sampled `gamePuzzle` numeric wrong-answers resolve to the deterministic
`err:<value>` tag (no authored `commonErrors[].misconception`). Consequently
`MISCONCEPTION_EDGE` never matches and remediation always takes
`prereqs[0]` of the `Game Theory & Puzzles` node = **EV Decision Games & Market
Making** (market-making), even for pure probability brain-teasers (bag-rigging,
arbitrage). The 2nd prereq (Expected Value) is often the more apt ZPD target. Missing
tags also strip rung-2/rung-4 of any misconception signal. (Detail in the game section.)

---

## Per-metric average scores per module

Scored on deduped (item, wrong-answer) classes by the five sub-auditors.

| Module | sample | ACCURACY | THOROUGHNESS | NEXT-TOPIC ZPD | composite |
|---|---:|---:|---:|---:|---:|
| combinatorial | 58 classes | **7.3** | **7.6** | **8.6** | 7.8 |
| conditional | 60 classes | **8.4** | **5.4** | **6.9** | 6.9 |
| expectedValue | 72 classes | **7.9** | **4.8** | **4.9** | 5.9 |
| gamePuzzle | 7 classes / 84 rows | **8.7** | **3.0** | **2.4** | 4.7 |
| prob (core) | 48 classes | **6.8** | **5.4** | **7.6** | 6.6 |
| **module mean** | — | **7.8** | **5.2** | **6.1** | **6.4** |

**Reading:** rung-1 *authoring* (ACCURACY) is consistently strong (7.8 avg) — authors
name the right trap. The failures are almost entirely in the *plumbing* that turns a
resolved misconception into rung-2 plan / rung-4 sim / next-topic route (THOROUGHNESS
5.2, ZPD 6.1), plus the answer-leak guard that discards good rung-1s.

---

## Per-module findings

### combinatorial — A 7.3 / T 7.6 / ZPD 8.6 (no S1)
The strongest module: rung-5 math correct 100%, rung-2 always a domain plan (zero
`GENERIC_PLAN`), routing never broke. Two S2 root-causes:
- **Answer-leak guard false-positive (S2, ~15 blocks / ~12 classes).** `containsFinalAnswer`
  fires when a rationale references a number equal to the answer (`1/8!`→"1/8"=0.125,
  `(1/2)^{n−1}`→0.5, coordinate `(14,3)`→14), nuking specific coaching to generic.
  Worst item `gen-semicircle-4-4` (answer exactly 1/2): all 3 distractors go generic.
- **`nameOnlyCoaching` keeps the concession, drops the diagnosis (S2, ~24 blocks / 3 classes).**
  For "You did X right, **but** [real error]", the `" but "` cut keeps only praise:
  `genOrderedDraw` → R1 "Shrinking the pool size." (the *correct* action — actively
  misleading); `genReplacementTrapNumeric` → "You have order right." / "You allowed
  repeats, good."
- S3: every family's rung-4 is the single **"Two-Dice Sample Space"** sim (weak for
  poker/paths/arrangements; `poker-hand-equity` exists, unreachable); conceptual-counting
  misconceptions route to Mental Arithmetic (only prereq of the Counting node — too-easy).

### conditional — A 8.4 / T 5.4 / ZPD 6.9 (no S1)
Every revealed R5 correct; every route lands on a real prereq. cp-2 (Bayes) is the
bright spot (~8.6). Systematic S2/S3:
- **Mismatched rung-4 sim (S2).** All of cp-3 (LOTP/continuous), cp-4 (races/recursion),
  cp-5 (Russian Roulette) + Bertrand `must_be_half` point at "Bayes via Natural
  Frequencies … why a positive test is a false alarm" — because those families are
  absent from `SIM_BY_FAMILY` and fall to the section default.
- **Generic-fallback despite good coaching (S2, 7 pairs):** `genRRFixed` ½-symmetry
  distractor, `genRRRespun` first-player distractor, `cp-transfer-4-4-2-2-3 @0.6` — their
  authored text states the answer → guard nukes it.
- **Mismatched rung-2 plan (S2):** the "conditional" keyword hands the "A given B vs
  B given A" plan to LOTP / continuous / race / recursion items; `genBothNumeric` gets an
  *independence* plan for a conditional.
- **Duplicated-fraction R5 (S3):** `= 4/7 = 4/7` recurs on **118 lines** across
  `genBertrand/genAllOn/genBoth/genGivenSum/genTable/genUniform/genRRFixed` (see X3);
  plus `"1 red faces"` grammar when m=1.

### expectedValue — A 7.9 / T 4.8 / ZPD 4.9 (D3 borderline S1)
R1 authoring strong; the context-routing layer is the weak point. `ev-8` flashcards get
no ladder (expected).
- **D1 (S2, systemic): rung-4 sim monoculture — 502/506 → "Expected Value (Long-Run
  Average)".** EV's ~25 families are absent from `SIM_BY_FAMILY` with non-canonical tags,
  so bespoke sims go unused: `clt` (variance/2nd-moment/CLT), `coupon-collector`
  (`genCoupon`), `order-statistics` (`genMaxDice`/`genUniformSpacing`),
  `geometric-dartboard` (`genOverlap`/`genMeetWithin` — which are *probabilities, not EVs*),
  `gamblers-ruin` (`genWalkReach`/`genWalkDuration`/`genMartingaleDoubling`).
- **D3 (S1/S2, systemic ZPD): universal L1 mis-route.** Every EV item descends to
  "Meaning of Probability & Sample Space", including variance/CLT errors (should implicate
  Variance/CLT) and random-walk errors (should implicate Markov / Conditional Expectation)
  → wrong *and* too-easy prereq. `ev-7` random-walk quiz has **no `misconceptions[]`**
  (all `idx:N`), so it can never edge-route (D7).
- **D2 (S2, 7×): guard nukes valid R1** — every fair-game martingale ("…they sum to **0**"),
  `genSumUniformsNumeric` (answer 1 in "[0,1]"), `genOneReroll` (answer 7/2 in "(7/2−3)").
- **D4 (S2, ~32×): rung-2 plan mis-selection** from keyword collisions: `genNegBinomial`
  → binomial "what single probability?" (it's an expected *count*); `genGeometricSum` →
  probability plan for an EV; `genConditionalGeo` → conditional-*probability* plan.
- **D5/D6 (S3):** over-truncation drops the leading question ("You SUBTRACTED the
  variances…"; `genCoupon` err drops "…multiply by $2"); duplicated `1/N = 1/N` tokens
  and 40+-digit unreduced fractions (`genEmptyBoxes`, `genDistinct`).

### gamePuzzle — A 8.7 / T 3.0 / ZPD 2.4 (no S1)
Lowest composite. Root cause: two *probability-numeric* families were tagged
`section: "Game Theory & Puzzles"`, and that one string is the join key that breaks
three subsystems at once (all rows):
- **Rung-2 plan** → a Nash-equilibrium plan ("Who are the players here… which choice
  profile could hold steady with no one wanting to switch") for a single-agent bag puzzle
  / arbitrage sum (S2).
- **Rung-4 sim** → "Mixed Strategies (2×2 Zero-Sum) … adjust the 2×2 payoffs" — wrong sim
  for law-of-total-probability (`genRigBags`) and de-vig (`genArbitrage`) (S2).
- **Routing** → the node's `prereqs=[INTERVIEW_GAMES, EXPECTED_VALUE]`, so a failed
  law-of-total-probability item remediates to *EV Decision Games & Market Making* and can
  never reach the missing concept (S2; see X5).
- `commonErrors` carry **no `misconception`** field → tags degrade to `err:<value>`,
  disabling misconception-aware plan/sim/route. Plus the guard nukes R1 on the fair
  `2.00/2.00` book (S2), and one R5 tail ("…you still win almost half the time") is false
  when f₂≈0.8/0.2 (S3).

### prob (Core Probability) — A 6.8 / T 5.4 / ZPD 7.6 (no S1)
R5 explanations correct throughout; ZPD sound (Core-Probability fails **floor-teach at the
L1 meaning floor** — the harness `target=L0` line is a display simplification that ignores
the `floor:true` short-circuit in `policy.ts`). Defects concentrate in the static hard
pools (pr-4/pr-5), which have **no `family`** and non-canonical per-item tags:
- **Static pool → `coin-flips` sim (S2, ~30 instances):** lattice/Catalan/ballot counting,
  ant-cube & grid-collision walks, birthday, coupon-collector, broken-stick, gambler's
  ruin all get "flip a coin" — while `sample-space`, `gamblers-ruin`, `coupon-collector`,
  `geometric-dartboard` sims exist but are unreachable (no family map; section override =
  coin-flips).
- **Domain-pointer masks canonical misconceptions (S2, 16 instances):** any authored
  `commonError` value outside [0,1] is overridden by "probabilities are always in [0,1]",
  suppressing `reversed_conditional` (pB/pBoth inversion >1 for all 5 conditional sets),
  `at_least_one_naive` (n·p>1), `and_means_add` (pA+pB>1), binomial `count_not_probability`
  — exactly when the mistake is most diagnosable (the domain branch sits *above* the
  matched-misconception branch in `hintLadder.ts`).
- **Rung-2 `PLAN_COUNTING` wrong frame (S2):** the "core probability" keyword catch-all
  shadows the EV/combinatorics resolvers, so expected-payout & expected-wait (1/p) items
  get an "enumerate equally-likely outcomes" plan.
- **Phantom rung-3 sibling (S2):** all 11 static items promise a "same kind of problem
  with different numbers, worked" sibling that has no generator to produce it.

---

## Defect counts by severity

Counted as **distinct defect classes** (with dominant instance counts in the sample).

| Severity | classes | notes |
|---|---:|---|
| **S1 critical** | **1** | EV universal-L1 mis-route for variance/CLT & random-walk EV families (wrong *and* too-easy prereq, not merely suboptimal). |
| **S2 major** | **~16** | answer-leak-guard nuke (systemic, ~31 instances incl. combinatorial 15 / conditional 7 / ev 7 / game 2); combinatorial "but"-cut praise-only (~24); EV sim monoculture (502/506); combinatorial "Two-Dice" sim everywhere; conditional cp-3/4/5 Bayes-sim mismatch; prob static→coin-flips (~30); prob domain-pointer masking (16); prob PLAN_COUNTING frame; prob phantom rung-3; conditional/EV rung-2 plan mis-pick; game section-mislabel × (plan+sim+route); X4 Counting→Arithmetic ZPD; ev-7 missing `misconceptions[]`. |
| **S3 minor** | **~9** | duplicated-fraction R5 (systemic, 118+ lines conditional + EV); giant unreduced fractions; over-truncation dropping the leading question; combinatorial poker sim; game R5 "almost half" tail; game rung-1 method-leak; grammar ("1 red faces", "1 seconds"); residual unbalanced-paren clip (known-truncation-adjacent). |

Instance-weighted, the sample surfaced **hundreds** of affected rungs (the duplicated-fraction
bug alone is 118+ lines in conditional; the EV sim monoculture is 502/506 rungs).

## Top-5 worst issues (ranked, cross-module)

1. **[S1/S2] Expected-Value remediation always drops to L1 "meaning of probability."**
   Every EV failure — including variance/CLT (`genCltVarianceNumeric`, `genSecondMomentNumeric`)
   and random-walk (`genWalkReach`/`genMartingaleDoubling`) errors — routes to the easiest
   node instead of Variance/CLT or Markov/Cond-Expectation. Worst ZPD failure in the audit
   (EV ZPD 4.9); `ev-7` also ships with no `misconceptions[]`, so it can never edge-route.
2. **[S2, systemic] Answer-leak guard silently replaces correct, specific rung-1 coaching
   with a content-free generic nudge.** Any authored diagnosis that mentions a fraction/
   factorial/coordinate equal to the answer (`1/8!`, `(1/2)^{n−1}`, martingale "sum to 0",
   `7/2−3`) trips `containsFinalAnswer` → "I won't guess at what went wrong." ~31 sampled
   instances across four modules; fully degrades e.g. `gen-semicircle-4-4` (all distractors).
3. **[S2, systemic] Rung-4 sim monoculture / mismatch.** EV = 502/506 on the generic
   expected-value sim; ALL combinatorial = "Two-Dice Sample Space"; prob static pool → coin
   flips; conditional cp-3/4/5 → Bayes. Purpose-built sims (`clt`, `coupon-collector`,
   `order-statistics`, `geometric-dartboard`, `gamblers-ruin`, `poker-hand-equity`,
   `sample-space`) exist but are unreachable because families/tags aren't wired into
   `SIM_BY_FAMILY`/`SIM_BY_MISCONCEPTION`.
4. **[S2] gamePuzzle's `"Game Theory & Puzzles"` section mislabel corrupts plan + sim +
   route together.** Two probability-numeric families (law-of-total-probability, de-vig)
   get a Nash "who are the players" plan, a 2×2 payoff-matrix sim, and remediation to
   market-making — none appropriate. Drives the module to T 3.0 / ZPD 2.4.
5. **[S2] Core-Probability domain-pointer overrides the matched misconception.** When a
   wrong value lands outside [0,1] (which is *exactly* what `reversed_conditional`,
   `at_least_one_naive`, `and_means_add` produce), rung-1 shows the generic "probabilities
   are in [0,1]" pointer instead of the specifically-authored, tagged diagnosis (16 instances).

*(Runner-up, systemic S3: the duplicated-fraction rung-5 render bug — `= 4/7 = 4/7` — on
118+ conditional lines plus EV second-moment reveals, wherever an already-reduced fraction
is printed as "unreduced = reduced".)*

## Notes / caveats
- The **mid-sentence truncation class** ("…so should you keep or") produced **zero**
  hits across all sampled probability-core rungs — the `nameOnlyCoaching` back-off works
  for these families; the related residual is only a rare unbalanced-paren clip
  (`gen-diecmp-pair-*` → "Counts TIES as wins (P(≥)."), flagged S3.
- Per-module full defect tables (with verbatim quotes and scope counts) live alongside
  this file: `datasets/qa-audit/raw/findings-{combinatorial,conditional,ev,game,prob}.md`.
- ZPD scoring for **floor** nodes (Core Probability = L1 floor) treats floor-teach-in-place
  as correct; the harness ROUTE line naively prints the descent target and does not model
  the floor short-circuit.

