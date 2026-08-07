# QA Audit — ZPD / Next-Topic / Remediation Engine

**Repo:** `quant-trader-prep` · **Mode:** READ-ONLY (no app source modified) ·
**Date:** 2026-08-05

Cross-cutting audit of the "recommend the right next topic / prerequisite after
failure, grounded in ZPD (~85% success)" engine. Findings were produced by
enumerating the live content and exercising the *actual* engine functions
(`remediationStep`, `planFinishRemediation`, `probeTierFor`, `simLinkFor`,
`computeRoadmap`) via throwaway vitest harnesses (now deleted), so every number
below is machine-verified against the shipped code, not read off comments.

## Scope audited
`remediation/{policy,probe,finish,config}.ts`, `content/remediation/prereqDAG.ts`,
`roadmap/{skillGraph,readiness}.ts`, `adaptivity/{review,config,zpdes}.ts`,
`mastery/{topicKey,elo,config,misconception-tags}`, `tutor/hintTopicHelp.ts`,
`simulations/catalog.ts`, plus the two call sites
(`pages/lesson/{QuizLevel,NumericLevel,remediation}.tsx`).

---

## Scorecard

| Dimension | Score | One-line justification |
|---|---|---|
| **Accuracy** (right prereq / next topic) | **9.0 / 10** | Prereq DAG is exhaustively correct: all 26 scored topics present, prereqs match the skill graph 1:1, all `levelRef`s valid, misconception edges honored when descent fires. The prior Conditional-Expectation bug class is fixed in the data. |
| **Thoroughness** (coverage — no topic un-routed, no missing sim) | **6.0 / 10** | Data coverage is complete, but a **behavioral** gate defect means prerequisite descent is *never exercised* for 16 of 26 topics; plus 6 good sims are unreachable and one doc comment is inaccurate. |
| **ZPD-appropriateness** (difficulty targeting) | **6.5 / 10** | When a probe fires, tiers target ≈0.82–0.86 ≈ the 0.85 band. But medium-only topics can neither ease to intro/easy (no such level exists) nor descend, so a struggling learner gets stuck; and two different targets (0.85 vs 0.80) coexist. |
| **OVERALL ENGINE** | **7.0 / 10** | Excellent, well-researched routing *data & logic*; undermined by a single high-impact gate heuristic that silently disables remediation for the majority of advanced topics. |

---

## 1. PREREQ COVERAGE — coverage matrix (topic → prereq correct? · levelRef valid? · sim)

Enumerated **all 28 topics** across all 5 tracks (`probability`, `math-questions`,
`mental-math`, `brainteasers`, `interview-games`). **26 are scored** (have a
quiz/numeric level); the 2 Brainteasers topics are flashcard-only and correctly
out of scope. **All 26 scored topics are present in BOTH `prereqDAG` and
`skillGraph`**, `orphan_dag = []`, `orphan_skill = []`, every DAG edge is a
subset of the skill-graph edges, every prereq is itself a DAG node, and every
`levelRef` resolves to a real, non-flashcard level in the correct topic bucket.

Legend: `prereq✓` = DAG prereqs == skillGraph prereqs. `levelRef` = resolves to a
real scored level in-topic. `sim` = `simLinkFor({section})` result.

| Topic (topicKey) | scored diffs | inDAG | inSkill | prereq✓ | levelRef | DAG prereqs | sim (section) |
|---|---|---|---|---|---|---|---|
| mental-math::_core | easy/med/hard | ✓ | ✓ | ✓ (floor) | ok easy | — | (no-link) |
| math-questions::Rates, Algebra & Word Problems | easy/med | ✓ | ✓ | ✓ (floor) | ok easy | — | (no-link) |
| math-questions::Number Theory & Counting | medium | ✓ | ✓ | ✓ | ok med | mental-math | ⚠ sample-space (weak) |
| math-questions::Geometry & Derivations | hard | ✓ | ✓ | ✓ | ok hard | Rates | (no-link) |
| probability::Core Probability | easy…expert | ✓ | ✓ | ✓ (floor) | ok easy | mental-math | coin-flips |
| probability::Combinatorial Analysis | easy/med/hard | ✓ | ✓ | ✓ | ok easy | mental-math | sample-space |
| probability::Conditional Probability | easy/med | ✓ | ✓ | ✓ | ok easy | Core, Combinatorics | bayes-natural-frequency |
| probability::Expected Value | easy/med/hard | ✓ | ✓ | ✓ | ok easy | Core, Combinatorics | expected-value |
| probability::Conditional Expectation | med/hard | ✓ | ✓ | ✓ | ok med | Cond. Prob, EV | ⚠ expected-value (weak proxy) |
| probability::Geometric Probability | easy/med | ✓ | ✓ | ✓ | ok easy | Core | geometric-dartboard |
| probability::Continuous Distributions | med/hard | ✓ | ✓ | ✓ | ok med | EV | NULL (intentional) |
| probability::Poisson Distribution & Process | med/hard | ✓ | ✓ | ✓ | ok med | EV, Continuous | NULL (intentional) |
| probability::Order Statistics | medium | ✓ | ✓ | ✓ | ok med | EV | order-statistics |
| probability::Variance, Covariance & the CLT | med/hard | ✓ | ✓ | ✓ | ok med | EV | clt |
| probability::Betting & Sizing | easy…expert | ✓ | ✓ | ✓ | ok easy | EV | kelly |
| probability::Markov Chains | easy/med/hard | ✓ | ✓ | ✓ | ok easy | Cond. Prob, EV, Cond. Exp | markov-chain |
| probability::Brownian Motion | expert | ✓ | ✓ | ✓ | ok expert | Markov, Continuous | stock-random-walk |
| interview-games::_core | med/hard/expert | ✓ | ✓ | ✓ | ok med | EV | NULL (intentional) |
| probability::Game Theory & Puzzles | easy/med/hard | ✓ | ✓ | ✓ | ok easy | Interview-Games, EV | game-theory-matrix |
| probability::Moment Generating Functions | medium | ✓ | ✓ | ✓ | ok med | EV, Var/CLT | NULL (intentional) |
| probability::Gamma Distribution | medium | ✓ | ✓ | ✓ | ok med | Continuous | NULL (intentional) |
| probability::Joint Distributions | med/hard | ✓ | ✓ | ✓ | ok hard | Continuous, Cond. Prob | joint-density-integral |
| probability::Limit Theorems | hard | ✓ | ✓ | ✓ | ok hard | Var/CLT | clt |
| probability::Branching Processes | hard | ✓ | ✓ | ✓ | ok hard | EV, Cond. Exp | NULL (intentional) |
| probability::Continuous-Time Markov Chains | hard | ✓ | ✓ | ✓ | ok hard | Markov, Poisson | markov-chain |
| probability::Markov Chain Structure | hard | ✓ | ✓ | ✓ | ok hard | Markov | markov-chain |
| brainteasers::Core Puzzles | (flashcard) | — | ✓ | n/a | n/a | — | (out of scope) |
| brainteasers::Techniques Toolkit | (flashcard) | — | ✓ | n/a | n/a | — | (out of scope) |

**PREREQ result: 0 topics with missing prereqs, 0 topics with wrong prereqs.**
The Conditional Expectation node exists with correct prereqs `{Conditional
Probability, Expected Value}`, and its downstream consumers (Markov Chains,
Branching) correctly list Conditional Expectation as a prereq — the exact class
of the historical bug is closed at the data layer.

---

## 2. ROUTING CORRECTNESS — failure-simulation samples

Each sample drives the *real* `planFinishRemediation` / `remediationStep` with a
bombed round (`scoreFraction 0.1`, `missedCount 4`). "Descends to" = the prereq
returned; "probe tier" from `probeTierFor` at fresh θ≈0 (numeric no-guess p shown).

| # | Topic failed | misconception tag | Expected prereq | Engine routed to | Probe tier / p | Right prereq? | ZPD tier? | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | Conditional Expectation | (none) | Conditional Prob **or** EV | **Conditional Probability** | intro / 0.82 | ✓ | ✓ | 9/10 |
| 2 | Conditional Expectation | reversed_conditional | Cond. Prob (Core not an edge) | Conditional Probability (falls through) | intro / 0.82 | ✓ | ✓ | 9/10 |
| 3 | Expected Value | ordered_vs_unordered | Combinatorial Analysis | **Combinatorial Analysis** (misc-honored) | intro / 0.82 | ✓ | ✓ | 10/10 |
| 4 | Conditional Probability | base_rate_neglect | Core Probability | **Core Probability** (misc-honored) | intro / 0.82 | ✓ | ✓ | 10/10 |
| 5 | Markov Chains | (none) | Cond. Prob / EV / Cond. Exp | **Conditional Probability** (first-listed) | intro / 0.82 | ◑ first, not weakest | ✓ | 7/10 |
| 6 | Core Probability (floor) | any | teach in place | **floor-teach** (no descent) | n/a | ✓ | ✓ | 10/10 |
| 7 | Geometric Probability | n_vs_n_minus_one | Core (implicated not an edge) | Core Probability (first prereq) | intro / 0.82 | ✓ | ✓ | 9/10 |
| 8 | **Conditional Expectation** (real med finish) | (none) | Conditional Probability | **NONE — "none/retry"** ✗ | — | ✗ **never fires** | ✗ | 2/10 |
| 9 | Poisson / MGF / Gamma / Joint / etc. (med+ only) | any | correct prereq | **NONE — "none/retry"** ✗ | — | ✗ **never fires** | ✗ | 2/10 |
| 10 | Expected Value (fresh bomb, θ 0→−1) | any | Core Probability | NONE until θ<−1.5 (Kapur/bottom-out) | — | ✓ by design | ✓ | 8/10 |

**Key routing facts verified:**
- When a descent *does* fire, the target is **always correct**: misconception
  edges are honored whenever the implicated node is a real prereq (verified for
  **all** (topic, tag) pairs), else it falls to the first-listed prereq. No probe
  ever routed to an unrelated topic.
- Probe tier is chosen by `probeTierFor` at the 0.85 band. At θ=0 it picks
  `intro` (p≈0.818 no-guess; ≈0.86 for a 4-option MCQ) — correctly inside the ZPD.
- Floors (`mental-math`, `Rates`, `Core Probability`) correctly `floor-teach`
  instead of descending below the meaning-of-probability / arithmetic floor.
- **The descent almost never fires** — see Defect #1 (this is the dominant
  finding). Samples 8 & 9 are the same root cause.

---

## 3. SIM MAPPING — `simLinkFor(section, misconception, family)` vs catalog

**Misconception → sim (15 canonical tags):** all resolve to a sensible sim except
`memoryless_uniform` → NULL (intentional; no exponential-memoryless sim exists).
The historical "everything leaks to coin-flips" bug is fixed — `and_means_add`
now → `two-independent-events`, etc. **0 misconception mismatches.**

**Section → sim (24 scored sections):**
- **Good, unambiguous:** Core Probability→coin-flips, Combinatorics→sample-space,
  Conditional Prob→bayes-natural-frequency, EV→expected-value, Geometric→
  geometric-dartboard, Var/CLT & Limit Theorems→clt, Markov* →markov-chain,
  Brownian→stock-random-walk, Joint→joint-density-integral, Order Stats→
  order-statistics, Betting→kelly, Game Theory→game-theory-matrix. (17 sections)
- **Intentional NULL (documented no-link):** Poisson, Continuous Distributions,
  MGF, Gamma, Branching, Rates, Geometry, + the 2 Brainteasers. Of these, 5
  advanced probability sections (Poisson/Continuous/MGF/Gamma/Branching) are
  *genuine coverage gaps* — a learner failing them gets no visualization because
  no fitting sim has been authored. Not a mismatch, but a thoroughness gap.
- **⚠ Weak / questionable mappings (2):**
  - `Number Theory & Counting` → **sample-space** (two-dice grid). Partial fit —
    the "counting" half is illustrated, the series/multiples/growth half is not.
  - `Conditional Expectation` → **expected-value** (running-average sim). A proxy
    only; it shows E[X], not E[X|Y]/the tower rule. Better than NULL, but weak.

**Unreachable catalog sims (6):** `monty-hall`, `poker-pot-odds`,
`poker-hand-equity`, `gamblers-ruin`, `stock-regime-markov`, `coupon-collector`
can **never** be emitted by `simLinkFor` because every section they claim is
overridden to a single default and no misconception/family maps to them.
- Material impact: **Conditional Probability** items can never surface
  `monty-hall`, and **Markov Chains** items can never surface `gamblers-ruin`,
  even though both are arguably the *best* illustrations for those topics.
- **Doc-comment inaccuracy:** `hintTopicHelp.ts` claims "monty-hall /
  venn-two-events / poker-pot-odds remain reachable" through the misconception/
  family maps. `venn-two-events` is (via `or_means_add`/`complement_confusion`),
  but `monty-hall` and `poker-pot-odds` have **no** such mapping and are in fact
  unreachable. The comment is misleading.

**SIM result: 0 hard mismatches (nothing routes to a *wrong/misleading* sim),
but 2 weak section mappings + 5 genuine no-sim gaps + 6 unreachable good sims +
1 inaccurate doc comment.**

---

## 4. READINESS / REVIEW resurfacing

- `readiness.ts` (`computeRoadmap`) is sound: mastery = `max(ciLow, level-
  completion) ≥ MASTERY_BAR` (0.8), status ladder mastered→in-progress→
  available→locked with prereq gating from the skill graph, weighted overall
  readiness. Low-confidence unlock (`mean ≥ UNLOCK_MEAN_BAR`) is an additive
  signal that never gates prereqs and re-locks on a swing — correct.
- `adaptivity/review.ts` + `zpdes.ts` resurface concepts sensibly: due SM-2
  reviews (ladder `[1,3,7,16,35]` days) override the mastered-exclusion and get
  the highest ZPDES weight (2.0), an ε=0.15 floor prevents topic starvation, and
  the unlock/prereq graph is never overridden. Resurfacing = **fine, no defect.**
- ⚠ Minor: `pickTier`/`zpdesPriority` target **P_TARGET = 0.80** (with guessing
  correction), while remediation probes target **PROBE_P = 0.85** (no guessing
  correction via `probability2PL`). The everyday next-question difficulty is thus
  centered at 0.80, not the "~85%" the brief specifies. Internally consistent
  (band `[0.75, 0.85]`), but worth noting as a targeting choice.

---

## Ranked defect list

### D1 — HIGH · Prerequisite descent never fires for 16 of 26 scored topics (`atFloorTier` heuristic)
Both the mid-lesson trigger (`QuizLevel/NumericLevel.tsx`) and the finish-time
planner (`finish.ts`) compute
`atFloorTier = DIFFICULTY_META[level.difficulty].order <= 1` (intro/easy only).
`remediationStep`'s bottom-out gate requires `atFloorTier` to be true before it
will descend. **16 scored topics have no intro/easy level at all** (their easiest
authored level is medium or harder): Number Theory, Geometry, Conditional
Expectation, Continuous Distributions, Poisson, Order Statistics, Variance/CLT,
Brownian, Interview Games, MGF, Gamma, Joint, Limit Theorems, Branching, CTMC,
Markov Chain Structure. For every one of these, `atFloorTier` is **always false**,
so `remediationStep` returns `retry-in-place` and **no prerequisite descent ever
happens** — verified: Conditional Expectation at a medium finish returns
`none/retry` even at θ=−5. The heuristic should compare against the *topic's own
minimum available tier*, not a global intro/easy threshold. Impact: the core goal
("route to the correct prerequisite after failure") is unreachable for 62% of
topics, including the exact topic (Conditional Expectation) whose prereq bug this
system was built to fix. The only escape is the diagnostic-relock `forceDescend`
path, which requires the learner to have taken the diagnostic and been seeded a
low-confidence unlock.

### D2 — MEDIUM · Struggling learners on medium-only topics get no ZPD relief at all
Consequence of D1 compounded: for a medium-only topic, `retry-in-place` asks for
tier `probeTierFor(...)` = `intro` when θ is low, but the topic **has no intro/
easy level to serve**, and descent is blocked. So a learner who keeps missing is
served the same medium items indefinitely — neither eased down within-topic nor
routed to a prerequisite. This is the precise "too hard, no path back" failure
the ZPD engine is meant to prevent.

### D3 — LOW/MEDIUM · Default descent uses first-listed prereq, not the weakest
`remediationStep`/`descentTarget` pick `node.prereqs[0]` when there is no
implicating misconception, even though a mastery-aware `chooseDescentEdge`
(lowest-posterior-mean prereq) exists and is *not* wired into the policy path.
E.g. failing Markov Chains always descends to Conditional Probability regardless
of whether Expected Value or Conditional Expectation is the learner's weaker gap.
ZPD-suboptimal (routes to a correct-but-maybe-not-weakest prereq).

### D4 — LOW · Probe tier for a prerequisite is computed from the *origin* topic's θ
`descendAction` calls `probeTierFor(inp.theta, target, {})` using the origin
node's θ against the *target* prereq. A learner strong overall but with a
specific gap can get a harder-than-ZPD prereq probe. Also, `probeTierFor` is
always called with an empty `TierDifficultyMap` (`{}`) and no adaptive opts, so
it uses seed difficulties only — the learned per-tier Elo/Glicko/IRT difficulties
are never fed into remediation probe-tier selection (the richer engine exists but
is unused here).

### D5 — LOW · Six high-value sims are unreachable + one inaccurate doc comment
`monty-hall`, `poker-pot-odds`, `poker-hand-equity`, `gamblers-ruin`,
`stock-regime-markov`, `coupon-collector` can never be returned by `simLinkFor`;
notably Conditional Probability can never surface Monty Hall and Markov Chains
can never surface Gambler's Ruin. The `hintTopicHelp.ts` comment claiming
monty-hall/poker-pot-odds "remain reachable" is factually wrong.

### D6 — LOW · Weak section→sim mappings & advanced-topic sim gaps
`Number Theory & Counting → sample-space` and `Conditional Expectation →
expected-value` are only partial fits; Poisson/Continuous/MGF/Gamma/Branching
have no sim at all (documented no-link, but a genuine visualization gap).

### D7 — INFO · Two success targets coexist (0.85 remediation vs 0.80 adaptivity)
Not a bug, but the "~85% ZPD" brief is met by remediation probes and only
approximated (0.80, top of the [0.75,0.85] band) by the everyday next-question
policy.

---

## Appendix — method
- Content enumeration + DAG/skill/levelRef/sim diff, routing simulation, gate
  sweep, and sim-reachability were run through temporary vitest harnesses under
  `src/` that imported the real modules via the `@/` alias, then deleted. No app
  source under `src/**` was modified.
- All quantitative claims (26 scored topics, 0 missing/wrong prereqs, 16
  medium-only topics, `none/retry` for CE, unreachable-sim set, misconception
  honoring) are direct outputs of the shipped functions, not inferred from
  comments.
