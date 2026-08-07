# QA Audit — Probability & Statistics: Stochastic Processes (hint-ladder)

**Scope (read-only):** the five stochastic-process modules and their `{levels,generators}.ts`
(plus the level-imported sibling generator files):

- `markovChains/` — `generators.ts`, `genGeneralWalks.ts`, `stationaryGenerators.ts` (levels `mc-1…mc-5`, `mc-walk`, `mc-stationary`; `mc-6` is flashcard-only → no ladder)
- `markovStructure/` — `generators.ts` (levels `ek-markov-pn`, `ek-markov-class`)
- `continuousTimeMarkov/` — `generators.ts` (level `ek-ctmc`)
- `branchingProcesses/` — `generators.ts` (level `ek-branching`)
- `brownianMotion/` — `generators.ts` (level `bm-1`)

**Method.** A temporary Vitest harness imported every playable generator + `buildHintLadder`
(`src/lib/tutor/hintLadder.ts`) and ran each family across **60 seeds**, stamping `family` exactly
as the level's `mix*` wrapper does. For **every authored wrong answer** (numeric `commonErrors →
chosenValue`; quiz `distractorRationale → chosenIndex`) it built the full ladder and captured all
5 rungs, the rung-4 sim link (`simLinkFor`), the rung-2 plan (`planOfAttack`), the rung-5
explanation, and the failure→prerequisite routing (`prereqDAG` + `policy.ts` deterministic
`descentTarget`, i.e. `MISCONCEPTION_EDGE[tag]` if it is a direct prereq of the node, else
`node.prereqs[0]`). Totals: **952 (item, wrong-answer) pairs across 451 distinct generated items.**
The harness was deleted after the run.

**Scoring** (/10, judged at the (family, wrong-answer-class) grain since items are parametric
clones): **ACCURACY** = rung-1 gives the specific correct diagnosis (not a generic fallback);
**THOROUGHNESS** = every rung a complete coherent sentence, rung-2 plan useful, rung-4 links the
RIGHT sim, rung-5 complete & correct; **NEXT-TOPIC ZPD** = failure routes to an appropriate ~85%
prerequisite.

> The **`nameOnlyCoaching` rung-1 truncation** class (333/952 records flagged `R1-TRUNCATED`) is
> **being fixed elsewhere** — it is flagged below for completeness but is NOT the focus. The
> findings below are the *other* defects.

---

## Headline defect counts

| Severity | Distinct defects | Records affected (of 952) |
|---|---|---|
| High | 2 | 49 |
| Medium | 4 | ~900 (systemic: sim + routing hit nearly every item) |
| Low | 2 | 333 (known truncation) + jargon |

- Mid-sentence cut-offs in rungs 2–5: **0** (positive — all plans/worked-sibling/sim/reveal end cleanly).
- All rung-5 reveals: **complete and mathematically correct** (positive).
- Exactly one fully-correct ladder tail in the whole area: **`mc-stationary`** (right rung-2 plan + right rung-4 sim).

---

## Defect table

| # | Module | Level / family | Example item id | Wrong-answer | Bad output | Metric failed | Sev |
|---|---|---|---|---|---|---|---|
| D1 | markovChains | mc-1 `genLineWalk` | `mc-line-3-1` | `value=2` (off-by-one distractor) | Rung-1 becomes the **generic** "…it doesn't line up with any of the usual mistakes for this question, so I won't guess…" — but it IS a catalogued error. Cause: the distractor's own feedback quotes the correct product ("…so it's 1·3, not 1·2"), and `containsFinalAnswer` sees the answer `3` → the whole specific coaching is discarded. | ACCURACY | High |
| D2 | markovChains | mc-2 `genRunHeads` | `mc-run-3` | off-by-one `2^{n+1}−1` | Same guard trip: feedback "…the closed form … is 2^{n+1}−2 = 14…" contains the answer → false-generic rung-1. | ACCURACY | High |
| D3 | markovChains | mc-2 `genResetChain` | `mc-reset-3` | off-by-one `2^{k+1}−1` | Same as D2 (reset chain). | ACCURACY | High |
| D4 | markovChains | mc-4 `genCubeWalk` | `mc-cube-3` | `value=9` (distance-1 hitting time) | Feedback "…From the start (distance 0) it is one more: **10**." contains answer `10` → false-generic rung-1. | ACCURACY | High |
| D5 | continuousTimeMarkov | ek-ctmc `genMM1` | `gen-ctmc-mm1-*` | `Lq` / wrong-numerator distractor | Same guard trip → false-generic rung-1 on a real M/M/1 error. | ACCURACY | High |
| D6 | markovChains | mc-5 `genRuinReachNumeric`, `genRuinNumeric`; mc-3 `genPatternRaceNumeric` | `mc-ruinnum-5-7-3-4` | `complement_confusion` (the "you went broke first" / reversed-race value) | Rung-4 sends the learner to **"Venn Diagram: Two Events"** ("drag P(A), P(B) and their overlap…add the two areas, then subtract the overlap once") — a set-overlap sim that has nothing to do with a `1−p` gambler's-ruin / pattern-race complement. Cause: `SIM_BY_MISCONCEPTION[complement_confusion] = "venn-two-events"`. | THOROUGHNESS (wrong sim, actively misleading) | High |
| D7 | markovChains | mc-1, mc-2, mc-3, mc-4, mc-walk, mc-5 (all non-complement wrong answers) | `mc-run-3`, `mc-cube-3`, `mc-ruinnum-*`, `mc-patwaitnum-*`, … | every wrong answer | Rung-4 always opens **"Markov Chain → Stationary Distribution"** ("set the transition probabilities and watch … settle into its stationary distribution") for hitting-time, coin-pattern-wait, pattern-race, graph-walk, recursion and **gambler's-ruin** items. The dedicated **"Gambler's Ruin / Random Walk"** sim (id `gamblers-ruin`, `topics:["Markov Chains"]`) and `stock-random-walk` are **never surfaced**. Cause: `SECTION_SIM_OVERRIDES["Markov Chains"]="markov-chain"` wins (family/misconception don't resolve). | THOROUGHNESS (wrong sim) | Med |
| D8 | continuousTimeMarkov | ek-ctmc all families | `gen-ctmc-hold-*`, `gen-ctmc-mm1-*` | every wrong answer | Rung-4 opens the **discrete-time** "Markov Chain → Stationary Distribution" sim for holding-time `1/(Σrates)` and M/M/1 `L=ρ/(1−ρ)` — no continuous time, no queue, no holding time. Cause: `markov-chain` sim claims `topics:[…,"Continuous-Time Markov Chains"]`. | THOROUGHNESS (wrong sim) | Med |
| D9 | markovStructure | ek-markov-pn `genPnEntry`; ek-markov-class `genClassify` | `gen-markov-pn-*`, `gen-markov-classify-3` | every wrong answer | Rung-4 opens the stationary sim for a Chapman–Kolmogorov 2-step entry and for **conceptual** state-classification ("what is the period of a self-loop?") — the sim illustrates neither. | THOROUGHNESS (wrong sim) | Med |
| D10 | brownianMotion | bm-1 all families | `gen-bm-std-2-25` | every wrong answer | Rung-4 opens **"Stock Trader: Buy, Sell, or Hold?"** and the text says "make a buy/sell/hold call" — irrelevant to computing `sd(X_t)=σ√t`, `E[X_t]=x₀+μt`, or `Φ(z)`; it never isolates the √t law or standardizing a Normal. Cause: `stock-random-walk` claims `topics:[…,"Brownian Motion"]`. | THOROUGHNESS (wrong sim) | Med |
| D11 | branchingProcesses | ek-branching `genBranchingMean` | `gen-branching-mean-1135-3` | any wrong answer | Rung-4 falls back to the generic elicitation "enumerate the full set of equally-likely outcomes … count how often the **event** actually happens and compare that empirical **frequency** …" — a category error for `E[Zₙ]=μⁿ` (an expectation of a size, not an event frequency). Branching is in `EXPLICIT_NO_LINK_SECTIONS` so it never gets a sim. | THOROUGHNESS (rung-4 text mismatched to expectation) | Med |
| D12 | markovChains (all mc-*) | every family | `mc-ruinnum-*`, `mc-cube-3`, `mc-run-3`, … | every wrong answer | Failure deterministically descends to **Conditional Probability & Bayes** (`MARKOV.prereqs[0]`). But first-step-analysis / hitting-time / ruin failures are *tower-rule* gaps — the DAG's own comment calls **Conditional Expectation** the "genuine prerequisite", yet it is `prereqs[2]` and never chosen by `descentTarget`. | NEXT-TOPIC ZPD | Med |
| D13 | brownianMotion | bm-1 (esp. `genBmStd`, `genBmProb`) | `gen-bm-prob-*` | variance-vs-sd, σt-denominator, standardization errors | Failure descends to **Markov Chains** (`BROWNIAN.prereqs[0]`). The real gap for "√t vs t" / "Φ(z)" errors is **Continuous Distributions** (the Normal, standardizing) = `prereqs[1]`, which is never chosen. | NEXT-TOPIC ZPD | Med |
| D14 | all stochastic modules | every family with a custom tag | `ruin_symmetric_fair`, `timid_not_bold`, `pattern_overlap_as_run`, `ruin_inverted_odds`, `race_by_speed_ratio`, `single_round_prob`, … | every tagged wrong answer | **None** of the domain's authored misconception tags exist in `MISCONCEPTION_EDGE`, so misconception-aware routing (KST "the misconception names the missing precedence") **never fires** for stochastic topics — every distinct misconception collapses to the same `prereqs[0]` descent. | NEXT-TOPIC ZPD | Med |
| D15 | markovStructure | ek-markov-class `genClassify` | `gen-markov-classify-3` | every wrong answer | For a purely **conceptual** classification quiz, rung-2 is the generic Markov plan ("What are the possible states … next step vs long-run") — irrelevant; rung-3 promises "the SAME kind of problem with **different numbers**, worked one step at a time" — there are no numbers; rung-4 is the stationary sim (D9). The entire ladder tail (rungs 2–4) is generic/mismatched. | THOROUGHNESS | Med |
| D16 | markovChains | mc-2 (`genRunHeads`, `genTwoInARow`, `genResetChain`), mc-3 pattern families | `mc-tworow-1-3`, `mc-patwaitnum-*` | every wrong answer | Rung-2 resolves to the generic `MARKOV_STEP` plan (states / next-step-vs-long-run) for coin-pattern & pattern-wait problems, which are *hitting-time / overlap* problems — the plan neither mentions streaks/overlap nor "how long until". Weak but not wrong. | THOROUGHNESS (rung-2 fit) | Low |
| D17 | markovChains, markovStructure | `genThreeStateStationary`, `genTwoStateStationary`, `genClassify` | `gen-stationary3-*` | e.g. `value=0.333` | Rung-1 leaves jargon unexplained at first use after truncation: "…only holds for a **doubly-stochastic** chain"; classify distractors reference "**escaping mass**". No gloss anywhere in the ladder. | THOROUGHNESS (jargon) | Low |
| D18 | all numeric families | most | many | 333/952 | `nameOnlyCoaching` truncates matched feedback at a corrective marker (`; `, ` — `, ` not `, ` divide`, …), e.g. spinner → "…The formula is 1 + Σ P(r)/(1−P(r))" (drops the naming clause / half-reveals the formula). **KNOWN CLASS — being fixed elsewhere.** | ACCURACY/THOROUGHNESS | Low (known) |

---

## Per-module metric averages (/10)

Averaged over each module's (family, wrong-answer-class) evaluations.

| Module | ACCURACY | THOROUGHNESS | NEXT-TOPIC ZPD | Notes |
|---|---|---|---|---|
| markovChains | **5.8** | **5.3** | **5.0** | Dragged down by D1–D4 (false-generic rung-1), D6 (Venn misroute), D7 (wrong sim everywhere but `mc-stationary`), D12 (ZPD → Conditional Prob not Conditional Exp). `mc-stationary` is the lone bright spot (THOR ≈ 8). |
| markovStructure | **6.5** | **4.5** | **7.5** | Routing is good (→ Markov Chains). THOR sinks on `ek-markov-class` (D15) + wrong sim (D9). |
| continuousTimeMarkov | **5.8** | **5.0** | **6.5** | D5 (false-generic on M/M/1), D8 (discrete stationary sim for a CTMC/queue). |
| branchingProcesses | **6.5** | **5.25** | **7.0** | Solid rung-1/rung-2; D11 rung-4 elicitation is a category error for `E[Zₙ]`. |
| brownianMotion | **6.5** | **4.8** | **4.3** | Worst ZPD (D13 → Markov not Continuous) and wrong sim (D10 buy/sell/hold). |

---

## Ranked worst offenders

1. **`mc-5` Gambler's Ruin (`genRuinReachNumeric`, `genRuinNumeric`, `genBoldPlayNumeric`)** — THOR ≈ 4.
   complement wrong answer → **Venn sim** (D6); all other wrong answers → **stationary sim** (D7) while a
   purpose-built Gambler's-Ruin sim sits unused; ZPD → Conditional Probability not Conditional Expectation (D12).
2. **`mc-3` Pattern Races (`genPatternRaceNumeric`)** — Venn misroute on the reversed-race complement (D6) + wrong sim (D7).
3. **False-generic rung-1 families (`genLineWalk`, `genRunHeads`, `genResetChain`, `genCubeWalk`, `genMM1`)** — ACC ≈ 4.5.
   The answer-withholding guard nukes a *correct, catalogued* diagnosis and replaces it with a message that
   literally denies the mistake exists (D1–D5); 18 records.
4. **`ek-markov-class` State Classification** — THOR ≈ 3.5. Rungs 2, 3, and 4 are all generic/mismatched for a
   conceptual, number-free quiz (D15 + D9).
5. **`bm-1` Brownian Motion** — worst combined ZPD+THOR: descends to Markov instead of Continuous Distributions
   (D13) and the rung-4 "buy/sell/hold" trader sim never isolates √t scaling or Normal standardization (D10).

---

## Systemic root causes (fix these once → many rows clear)

- **Answer-withholding guard is substring-blind** (`hintLadder.ts` rung-1 → `containsFinalAnswer`): distractor
  feedback that *contrasts* against the correct value (e.g. "so it's 1·3, not 1·2", "…is 2^{n+1}−2 = 14",
  "…one more: 10") trips the guard, discarding the specific coaching for a self-contradictory generic. (D1–D5)
- **`SIM_BY_MISCONCEPTION[complement_confusion] = "venn-two-events"`** is correct for set-complement items but
  wrong for the stochastic families that reuse `complementConfusion` for a `1−p` process complement. (D6)
- **Section→sim resolution has no stochastic-process-aware entries**: everything under "Markov Chains" is pinned
  to the stationary sim, CTMC/structure inherit it, Brownian inherits the trader sim, and Branching is in the
  no-link set — so rung-4 is wrong or absent for nearly every stochastic item except `mc-stationary`. (D7–D11)
- **Deterministic descent uses `prereqs[0]` and ignores this domain's misconception tags**: Markov→Conditional
  Probability (not Conditional Expectation), Brownian→Markov (not Continuous), and no `MISCONCEPTION_EDGE`
  coverage for stochastic tags. (D12–D14)

*No source files were modified. Temporary harness (`src/content/probabilityStats/__qa_audit_temp.test.ts`) was created for the run and deleted.*
