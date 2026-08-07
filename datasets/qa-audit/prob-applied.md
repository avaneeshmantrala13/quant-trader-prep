# QA Audit — Probability & Statistics: Applied Families (hint-ladder)

**Scope (read-only):** five applied prob/stats modules and their `{levels,generators}.ts`
(plus level-imported sibling generator files):

- `poisson/` — `generators.ts` (levels `po-1 … po-3`; flashcard-only levels skipped)
- `orderStatistics/` — `generators.ts` (levels `os-1 … os-2`)
- `geometricProbability/` — `generators.ts` (levels `geo-1 … geo-2`)
- `gameTheory/` — `generators.ts` (levels `gt-1 … gt-5`, `gt-spread`, `gt-agents`)
- `bettingSizing/` — `generators.ts` (levels `bet-1 … bet-3`, Kelly families)

**Method.** A temporary `vite-node` harness imported every playable generator + `buildHintLadder`
(`src/lib/tutor/hintLadder.ts`) and ran each family across **500 seeds**, stamping `family` exactly
as the level's `mix*` wrapper does, then deduplicating to distinct materialized items. For **every
authored wrong answer** (numeric `commonErrors → chosenValue`; quiz `distractorRationale →
chosenIndex`) it built the full ladder and captured all 5 rungs, the rung-4 sim link
(`simLinkFor` → `title`/`href`), the rung-2 plan (`planOfAttack`), the rung-5 explanation, and the
failure→prerequisite routing (`prereqDAG` + `policy.ts` deterministic descent: `MISCONCEPTION_EDGE[tag]`
if it is a direct prereq of the node, else `node.prereqs[0]`). **Totals: 16,312 (item, wrong-answer)
pairs across 3,349 distinct generated items** (poisson 679/250 · orderStatistics 391/136 ·
geometricProbability 243/84 · gameTheory 4,610/1,105 · bettingSizing 10,389/1,774). The harness and
its JSON dumps were deleted after the run.

**Scoring** (/10, judged at the (family, wrong-answer-class) grain since items are parametric clones):
**ACCURACY** = rung-1 gives the specific correct diagnosis (not a generic fallback); **THOROUGHNESS**
= every rung a complete coherent sentence, rung-2 plan useful, rung-4 links the RIGHT sim, rung-5
complete & correct, jargon glossed; **NEXT-TOPIC ZPD** = failure routes to an appropriate ~85%
prerequisite.

> The **`nameOnlyCoaching` rung-1 truncation** class is **being fixed elsewhere** — flagged for
> completeness only. In these five modules `nameOnlyCoaching` produced **clean, sentence-terminated**
> name-only trims (0 mid-sentence cut-offs observed in rungs 2–5, all rung-5 reveals complete &
> mathematically correct). The findings below are the *other* defects.

---

## Headline defect counts

| Severity | Distinct defects | Records affected (of 16,312) |
|---|---|---|
| High | 1 | ~2,975 (gameTheory rung-4 wrong sim, ~65% of the module) |
| Medium | 5 | ~5,400 (systemic ZPD + sim + guard-trip across gameTheory/geo/poisson) |
| Low | 4 | ~85 + jargon/grammar polish |

- **bettingSizing is the bright spot:** specific Kelly-taxonomy rung-1 on every wrong answer, correct
  Kelly sim at rung-4, EV descent at ZPD, complete rung-5 — no material defects.
- **orderStatistics** is close behind (only exp-median sim/ZPD fit is soft).

---

## Defect table

| # | Module | Level / family | Example item id | Wrong-answer | Bad output | Metric failed | Sev |
|---|---|---|---|---|---|---|---|
| D1 | gameTheory | gt-1 `genPd`, gt-2 `genEntry`, gt-3 `genHotelling`·`genBeauty`, gt-5 `genVolunteer`, `gt-spread` `genOptimalSpread`, `gt-agents` `genOptimizeAgentsNumeric` | `gt-pd-*`, `gt-entry-*`, `gt-hotelling-*`, `gt-beauty-*`, `gen-optspread-*`, `gen-agents-*` | **every wrong answer** | Rung-4 always opens **"Mixed Strategies (2×2 Zero-Sum)"** ("find the mixing probabilities that make your opponent indifferent…") for dominant-strategy (Prisoner's Dilemma), sequential/backward-induction (entry-deterrence), spatial (Hotelling), threshold (beauty contest / p-beauty), volunteer's-dilemma, spread-optimization and best-response-agent items. The 2×2 zero-sum mixing sim matches **only `gt-4`** (explicit mixed-strategy games). Cause: `gameTheory` section pins to the mixed-strategy sim; family/misconception never resolve a better link. **2,975 / 4,610 cases (~65%).** | THOROUGHNESS (wrong sim, actively misleading) | **High** |
| D2 | gameTheory | ALL families | every item | every wrong answer | Failure **always** descends to **Interview Games** (`interview-games::_core`, `GAME_THEORY.prereqs[0]`) regardless of the tripped misconception. For the numeric indifference / mixed-value / expected-payoff families (`gt-4`, `gt-spread`, `gt-agents`) the real gap is **Expected Value** (`prereqs[1]`), which `descentTarget` never selects. No gameTheory misconception tag exists in `MISCONCEPTION_EDGE`, so misconception-aware KST routing never fires. **4,610 cases.** | NEXT-TOPIC ZPD | Med |
| D3 | gameTheory | gt-3 `genBeauty`, `genBeauty#2` | `gt-beauty-*` (correct answer **0**) | e.g. `45` (level-0 midpoint), `53` (⅔ of max), `40` | Rung-1 collapses to the **generic** "…it doesn't line up with any of the usual mistakes… so I won't guess…" instead of the authored "that's the **level-0** midpoint / ⅔-of-max" diagnosis. Cause: the answer is `0`; `containsFinalAnswer` sees the digit `0` inside "level-**0**", "shrinking to **0**" and treats the specific coaching as an answer leak. **~50% of beauty wrong answers (36 of 72 distinct rows).** | ACCURACY | Med |
| D4 | geometricProbability | geo-1 `genGeoAreaNumeric` (disk-in-disk / dartboard) | `gen-geoarea-num-*` | `complement_confusion` value (e.g. `0.766`) | Rung-4 sends the learner to **"Venn Diagram: Two Events"** ("drag P(A), P(B) and their overlap…add the two areas, then subtract the overlap once") for a **disk-area** complement (`1 − r²/R²`) — a set-overlap sim unrelated to geometric area. Every other geo error correctly uses **"Geometric Probability (Dartboard)"**, so this is inconsistent *and* wrong. Cause: `SIM_BY_MISCONCEPTION[complement_confusion] = "venn-two-events"`. **46 / 243 cases (~19%).** | THOROUGHNESS (wrong sim) | Med |
| D5 | geometricProbability | geo-1 `genGeoAreaNumeric` | `gen-geoarea-num-*` | dimensional-slip value `r²/R` (e.g. `6.125`, > 1) | Rung-1 shows the **generic out-of-domain** pointer ("that's outside the valid range [0,1]…") instead of the authored specific coaching ("you squared the numerator but left the denominator linear — probabilities need `r²/R²`"). The out-of-`[0,1]` branch fires **before** the specific matcher, so any distractor that overshoots 1 loses its diagnosis. **34 / 243 cases (~14%).** | ACCURACY | Med |
| D6 | poisson | po-2/po-3 `genPoissonSplit`, `genPoissonCondUniform`, `genPoissonKthArrival` | `gen-poisson-split-10-1_10-2`, `gen-poisson-conduniform-12-5-1`, `gen-poisson-kth-3-3` | small-integer distractors `20`, `6`, `0.33` | Rung-1 becomes **generic** because the authored feedback incidentally contains a token equal to the (small-integer) answer: `λt = 10·2` (t=2 = answer `λpt`), `T/2` (the "2" = answer), `1/λ` (the "1" = answer `k/λ`). `containsFinalAnswer` trips on the coincidental token and discards a real, catalogued diagnosis (thinning / rank-mean / kth-gap). **16 / 679 cases (~2.4%).** | ACCURACY | Low |
| D7 | poisson | po-1…po-3 ALL families | every item | every wrong answer | Rung-4 is **always** the generic frequency-elicitation ("enumerate the full set of equally-likely outcomes … count how often the **event** happens and compare that empirical **frequency**"). This is a category error for Poisson: `E[N]=λt`, thinning `λpt`, interarrival `1/λ`, kth-arrival `k/λ`, `P(N=0)=e^{-λt}` are **rates / waiting-times**, not equally-likely-outcome frequencies. Poisson has no sim in the catalog, so rung-4 never illustrates the process. **679 / 679 cases (100%).** | THOROUGHNESS (rung-4 mismatched) | Med |
| D8 | poisson | po-3 process-depth (`genPoissonInterarrival`, `genPoissonNoEvent`, `genPoissonKthArrival`, `genPoissonCondUniform`, `genPoissonCompound`) | `gen-poisson-kth-*`, `gen-poisson-inter-*` | every wrong answer | Failure descends to **Expected Value** (`POISSON.prereqs[0]`). For interarrival / kth-arrival / no-event items the concept is **exponential / continuous** — the DAG lists **Continuous Distributions** as a co-prereq but `descentTarget` always takes `prereqs[0]`, so the continuous-timing gap is never targeted. No poisson tag in `MISCONCEPTION_EDGE`. | NEXT-TOPIC ZPD | Med |
| D9 | gameTheory | gt-2 `genEntry` (backward induction) | `gt-entry-*` | payoff distractors ("Hold", "stay-out") | Rung-1 false-generic because the distractor rationale legitimately cites the correct payoff to contrast ("Expand (**6**) beats Hold (3)") and `containsFinalAnswer` sees the answer value `6`. Here the guard *is* protecting a real leak, but the cost is the loss of the specific backward-induction diagnosis (self-defeating: the generic message denies the mistake exists). **45 cases.** | ACCURACY | Low |
| D10 | orderStatistics | os-1 `genExpMedian` | `gen-expmedian-*` | any wrong answer | Rung-4 uses the **order-statistics (min/max/median of n uniforms)** sim for an **exponential-median** item (`ln2/λ`), and ZPD descends to **Expected Value** although the concept is a **continuous-distribution median** (right-skew, mean ≠ median). Both are same-section-adjacent, so soft, but not the tightest fit. **18 cases.** | THOROUGHNESS / ZPD (fit) | Low |
| D11 | geometricProbability | geo-1 `genGeoAreaNumeric` `complement_confusion` | `gen-geoarea-num-*` | complement value | Rung-1 grammatical slip at first use: "…does the point **lands** FARTHER than…" (should be "land"). Cosmetic. | THOROUGHNESS (polish) | Low |

---

## Per-module metric averages (/10)

Averaged over each module's (family, wrong-answer-class) evaluations.

| Module | ACCURACY | THOROUGHNESS | NEXT-TOPIC ZPD | Notes |
|---|---|---|---|---|
| poisson | **8.5** | **6.5** | **6.5** | Rung-1 specific & rung-5 correct for 97.6%; D6 guard-trips (2.4%). D7 rung-4 is always the frequency category-error (no Poisson sim). D8 ZPD → Expected Value not Continuous for timing items. |
| orderStatistics | **9.0** | **8.0** | **7.0** | Cleanest of the non-betting modules: specific rung-1 everywhere, correct rung-5. D10 exp-median sim/ZPD fit is the only soft spot. |
| geometricProbability | **7.5** | **7.0** | **8.5** | ZPD (→ Core Probability) is solid. D5 dimensional-slip loses the specific rung-1 (14%); D4 complement→Venn misroute (19%); D11 grammar. |
| gameTheory | **7.0** | **5.0** | **6.0** | D1 rung-4 wrong sim for ~65% of the module drags THOR; D2 every failure → Interview Games; D3/D9 rung-1 false-generic (beauty ~50%, backward-induction). Rung-5 reveals correct. |
| bettingSizing | **9.5** | **9.0** | **8.5** | Best in area. Specific Kelly-taxonomy rung-1 (edge/odds/fraction/money-line errors all named), correct Kelly sim at rung-4, EV descent, complete step-by-step rung-5. No material defect found. |

---

## Ranked worst offenders

1. **gameTheory rung-4 sim misdirection (D1)** — THOR ≈ 3.5. ~2,975 wrong-answer cases (Prisoner's
   Dilemma, entry deterrence, Hotelling, beauty contest, volunteer's dilemma, spread/agents) all land on
   the **2×2 zero-sum mixed-strategy** sim, which fits only `gt-4`. Highest-impact single defect in the area.
2. **gameTheory beauty contest rung-1 (D3)** — ACC ≈ 4.5. Because the answer is `0`, ~half of the specific
   "level-0 / ⅔-of-max" diagnoses are replaced by a message that denies the mistake exists.
3. **geometricProbability disk-area errors (D4 + D5)** — the dimensional slip loses its rung-1 diagnosis (14%)
   *and* the complement slip is misrouted to the Venn sim (19%) — a third of geo wrong answers hit one of these.
4. **poisson process-depth tail (D7 + D8)** — every Poisson item gets the frequency-elicitation category-error at
   rung-4 and (for timing families) descends to Expected Value instead of Continuous Distributions.
5. **gameTheory ZPD (D2)** — all 4,610 failures descend to Interview Games; numeric indifference/mixed-value
   families should reach Expected Value, and no GT misconception tag participates in misconception-aware routing.

---

## Systemic root causes (fix once → many rows clear)

- **Answer-withholding guard is substring/token-blind** (`hintLadder.ts` rung-1 → `containsFinalAnswer`):
  it genericizes any feedback whose text contains a number equal to the answer, whether incidental
  (`λt = 10·2`, `T/2`, `1/λ`, `level-0` when answer = 0/1/2) or a legitimate contrast (`Expand (6) beats Hold (3)`).
  Hits beauty (~50%), poisson (2.4%), backward-induction (45). (D3, D6, D9) — *same class the stochastic audit found in D1–D5.*
- **`gameTheory` section→sim pins to the 2×2 mixed-strategy sim** for every family, so dominant-strategy,
  sequential, spatial, threshold, volunteer and optimization games all get an indifference-mixing sim. (D1)
- **`SIM_BY_MISCONCEPTION[complement_confusion] = "venn-two-events"`** is right for set complements but wrong for
  the geometric-area families that reuse `complement_confusion` for a `1 − r²/R²` complement. (D4) — *identical to
  stochastic D6.*
- **Rung-1 out-of-domain pointer fires before the specific matcher** for geometric-area distractors that overshoot
  `[0,1]`, discarding the authored dimensional-slip coaching. (D5)
- **Deterministic descent uses `prereqs[0]` and ignores these modules' misconception tags**: poisson timing →
  Expected Value (not Continuous Distributions), gameTheory → Interview Games (not Expected Value), and no
  `MISCONCEPTION_EDGE` coverage for poisson/gameTheory/orderStatistics tags. (D2, D8, D10)
- **No sim for the Poisson process** → rung-4 always falls back to a frequency-elicitation that is a category
  error for rate/waiting-time reasoning. (D7) — *same shape as branchingProcesses D11.*

*No source files were modified. The temporary `vite-node` harness and its JSON dumps were created for the run and deleted.*
