# Curriculum Analysis & Readiness Roadmap — Provenance

This document is the source-of-truth *rationale* behind the app's skill graph
(`src/lib/roadmap/skillGraph.ts`), the readiness computation
(`src/lib/roadmap/readiness.ts`), and the diagnostic coverage
(`src/content/diagnostic/blueprint.ts`). It exists so the ordering can be
audited against real academic curricula and the quant-interview canon.

---

## 1. Why a roadmap at all

The app now contains a large, sprawling question base spread across five
playable tracks and ~17 distinct mastery *topics* (a "topic" = `${trackId}::${section}`,
the granularity at which the mastery layer keeps an Elo θ + Beta(α,β) posterior).
Learners reported the breadth as *overwhelming* — there was no single answer to
"what do I do next, and how close am I to being interview-ready?"

The roadmap turns the flat catalog into an **ordered, prerequisite-respecting
pathway** with an explicit readiness indicator.

---

## 2. Complete topic inventory (every track / tab)

Mastery topics are enumerated exactly as the app buckets them
(`topicKeyOf(trackId, section)`), in the app's own data (difficulty) order.

### Track `probability` — "Probability & Statistics"
The core route (`Core Probability`, from `src/content/probability/levels.ts`) is
prepended, then the `probabilityStats` subcategories are concatenated
easiest→hardest (`src/content/probabilityStats/index.ts`):

| # | topicKey | levels | mode(s) |
|---|----------|--------|---------|
| 1 | `probability::Core Probability` | pr-1…pr-5 | quiz |
| 2 | `probability::Combinatorial Analysis` | ca-* | numeric/quiz |
| 3 | `probability::Geometric Probability` | geo-* | quiz/numeric |
| 4 | `probability::Conditional Probability` | cp-* | quiz/numeric |
| 5 | `probability::Expected Value` | ev-* | quiz/numeric |
| 6 | `probability::Betting & Sizing` | bs-* | numeric |
| 7 | `probability::Order Statistics` | os-* | numeric |
| 8 | `probability::Variance, Covariance & the CLT` | vc-* | quiz/numeric/flashcard |
| 9 | `probability::Markov Chains` | mc-* | numeric |
| 10 | `probability::Game Theory & Puzzles` | gt-*, gp-* | quiz/numeric/flashcard |

### Track `math-questions` — "Applied Math & Number Puzzles"
| # | topicKey | levels | mode(s) |
|---|----------|--------|---------|
| 11 | `math-questions::Rates, Algebra & Word Problems` | mq-1, mq-3 | numeric |
| 12 | `math-questions::Number Theory & Counting` | mq-4, mq-2 | quiz |
| 13 | `math-questions::Geometry & Derivations` | mq-5, mq-6 | numeric/flashcard |

### Track `mental-math` — "Mental Math"
| # | topicKey | levels | mode |
|---|----------|--------|------|
| 14 | `mental-math::_core` | mm-1…mm-4 | quiz |

### Track `brainteasers` — "Brainteasers"
| # | topicKey | levels | mode |
|---|----------|--------|------|
| 15 | `brainteasers::Core Puzzles` | bt-1…bt-3 | flashcard |
| 16 | `brainteasers::Techniques Toolkit` | bt-4…bt-6 | flashcard |

### Track `interview-games` — "Interview Games"
| # | topicKey | levels | mode(s) |
|---|----------|--------|---------|
| 17 | `interview-games::_core` | ig-1…ig-trading-decisions | quiz/numeric/flashcard |

`calibration-gym` is a teaser (coming soon) with no levels — excluded.

---

## 3. Academic sources used for the ordering

### UT Austin **M362K — Introduction to Probability and Statistics**
Textbook: Sheldon Ross, *A First Course in Probability* (chs. 1–8). The standard
topic sequence (confirmed against multiple UT syllabi, e.g.
`web.ma.utexas.edu/users/mks/362K03/M362K03syl.html` and the departmental course
description) is:

1. Combinatorial analysis / counting (ch. 1)
2. Axioms of probability — sample spaces, events, unions, inclusion–exclusion (ch. 2)
3. Conditional probability, independence, Bayes' theorem (ch. 3)
4. Discrete random variables + special distributions — Bernoulli, Binomial,
   Poisson, Geometric, Hypergeometric (ch. 4)
5. Continuous random variables — Uniform, Normal, Exponential (ch. 5)
6. Expectation & variance (chs. 4.4–4.5, 7)
7. Jointly distributed random variables, covariance (ch. 6)
8. Limit theorems — Markov/Chebyshev inequalities, LLN, **Central Limit Theorem**
   (ch. 8). "Additional topics may include Markov chains."

**Key takeaway:** counting and the *meaning* of probability come first;
conditioning/Bayes builds on both; expectation → variance/covariance → CLT is a
strict late-course chain; Markov chains sit at/after the end of M362K.

### UT Austin **M362M — Introduction to Stochastic Processes**
Prerequisite: **M362K**. Textbooks vary (Kulkarni; Grimmett & Stirzaker;
Ross, *Introduction to Probability Models*). The recurring sequence is:

1. Probability review (conditional probability + **conditional expectation**)
2. Random walks (incl. gambler's ruin, hitting times)
3. Branching processes
4. Discrete-time **Markov chains** — transition matrices, state classification,
   limiting/stationary distributions, first-step analysis
5. Poisson processes
6. Brownian motion / martingales

**Key takeaway:** everything M362M teaches is *downstream* of M362K's
conditional probability + expectation. This anchors Markov Chains,
random-walk / gambler's-ruin problems, and pattern-waiting-time recursions
**after** Conditional Probability and Expected Value in our graph.

### Quant-interview canon
Xinfeng Zhou, *A Practical Guide to Quantitative Finance Interviews* ("Green
Book"); *Heard on the Street*; firm screens (Optiver "80-in-8", Jane Street
"60-in-8", Zetamac). These establish two things the pure academic order omits:

- **Mental arithmetic speed is the *gate*** — most firms run a timed arithmetic
  screen first, so it is a Tier-0 prerequisite for *everything*, not an
  afterthought.
- **EV decision games, optimal stopping, market making, and Kelly sizing** are
  first-class interview genres that apply (not precede) the probability core.

---

## 4. Final ordering (the pathway) and reconciliation

The pathway is 5 tiers. Each skill lists its academic/canon justification in
`skillGraph.ts` (`source` field). Prerequisite edges are a **superset** of the
existing remediation DAG (`src/content/remediation/prereqDAG.ts`), which already
encodes `L0 arithmetic → L1 meaning → counting → {conditional, expectation}`.
Our graph keeps every one of those edges and extends them to the full 17 topics.

**Tier 0 — Foundations: Speed & Algebra** (interview gate + M408 prereq to M362K)
- Mental Arithmetic (`mental-math::_core`) — *prereq of everything*
- Rates, Algebra & Word Problems (`math-questions::Rates, Algebra & Word Problems`)

**Tier 1 — Probability Foundations** (M362K chs. 1–3)
- Counting & Combinatorics (`probability::Combinatorial Analysis`) — M362K ch. 1
- Number Theory & Counting (`math-questions::Number Theory & Counting`)
- Meaning of Probability & Sample Space (`probability::Core Probability`) — M362K ch. 2
- Conditional Probability & Bayes (`probability::Conditional Probability`) — M362K ch. 3

**Tier 2 — Expectation, Distributions & Variability** (M362K chs. 4–8)
- Expected Value (`probability::Expected Value`) — M362K chs. 4.4–4.5, 7
- Geometric Probability (`probability::Geometric Probability`) — continuous
  measure / M362K ch. 5 uniform
- Geometry & Derivations (`math-questions::Geometry & Derivations`)
- Order Statistics (`probability::Order Statistics`) — M362K ch. 6 (max/min of joint RVs)
- Variance, Covariance & the CLT (`probability::Variance, Covariance & the CLT`) — M362K chs. 7–8

**Tier 3 — Stochastic Processes & Trading Applications** (M362M + Green Book)
- Betting & Sizing / Kelly (`probability::Betting & Sizing`) — applies EV + odds
- Markov Chains (`probability::Markov Chains`) — M362M core (random walks,
  gambler's ruin, first-step analysis)
- EV Decision Games & Market Making (`interview-games::_core`) — SIG/Citadel/JS genres
- Game Theory & Puzzles (`probability::Game Theory & Puzzles`) — equilibria, market-making spread

**Tier 4 — Synthesis: Puzzles & Problem-Solving** (cross-cutting enrichment)
- Brainteasers — Core Puzzles (`brainteasers::Core Puzzles`)
- Brainteasers — Techniques Toolkit (`brainteasers::Techniques Toolkit`)

### Ordering changes vs. the app's existing implicit order
- The app's `probabilityStats/index.ts` orders **Combinatorial → Geometric →
  Conditional → Expected Value** (easiest→hardest, "low concept load first").
  We keep this within-track order but note the pathway groups them across two
  tiers: Combinatorial + Conditional in Tier 1 (M362K chs. 1 & 3), Geometric +
  EV in Tier 2. Geometric is *content-easy* but *conceptually* a continuous-RV
  idea (M362K ch. 5), so it sits in Tier 2 rather than before Conditional. This
  is a presentation grouping only — it does not reorder any levels or fight the
  content data order (which the topic selector still reads directly).
- **Mental Arithmetic is promoted to Tier 0** (the interview gate), matching the
  remediation DAG's `L0_ARITHMETIC` floor and the firm-screen reality, rather
  than sitting mid-list as just another track.

---

## 5. How readiness & per-skill % are computed

Pure logic in `src/lib/roadmap/readiness.ts` (unit-tested); the React layer only
gathers inputs.

Per skill we combine two signals already in `progress`:
- **Graded confidence** = the Beta 95%-credible-interval lower bound `ciLow`
  (the same "confidently mastered" signal the dashboard uses; `MASTERY_BAR = 0.8`
  means mastered ⇔ `ciLow ≥ 0.8`). `ciLow` rewards *both* accuracy and evidence
  volume — a couple of lucky right answers leave a wide interval and a low
  `ciLow`, so it cannot be gamed.
- **Level completion** = fraction of the topic's levels marked `mastered`. This
  covers flashcard/integrity topics (Brainteasers) that never emit graded Elo/Beta
  items, so they still show progress.

`masteryPct = round( 100 · clamp01( max(ciLow, completionFraction) / MASTERY_BAR ) )`
— i.e. "how far to the mastery bar," hitting **100% exactly when a skill is
mastered** (either `ciLow ≥ 0.8` or all its levels mastered). Raw Beta mean and
graded-item count are surfaced in the expanded detail for transparency.

A skill is `mastered` when `ciLow ≥ 0.8` **or** all its levels are mastered;
`in-progress` when it has any evidence/progress; `available` when its
prerequisites are all mastered; else `locked`.

**Overall readiness** = weighted average of each skill's
`clamp01(max(ciLow,completion)/MASTERY_BAR)`, weighted by an interview-importance
`weight` (1–3; Mental Math / Core Probability / Conditional / EV / Interview
Games = 3; enrichment = 1). It reaches **100% only when every skill is
mastered**, but the number is dominated by the topics that actually decide OA /
interview outcomes.

"Where you are" = the first skill in pathway order that is not yet mastered and
whose prerequisites are met. "How much is left" = count + weight of the
not-yet-mastered skills.

---

## 6. Diagnostic coverage vs. the skill graph

The onboarding diagnostic (`src/content/diagnostic/blueprint.ts`) probes **15 of
the 17 topics** — every MCQ-able family (the two Brainteasers topics are
flashcard/integrity-only and cannot be surfaced as MCQ). It is **multistage** to
stay comprehensive under 31 items:

- **Base breadth pass** (always-on): 8 slots covering the Tier-0/Tier-1 core plus
  EV and Interview Games (14 items). Core Probability is the router whose first
  items set the global starting difficulty.
- **Gated depth pass**: 7 advanced/derived topics are shown **only when their
  prerequisite passed** — exactly the prerequisite edges from the skill graph
  (Geometric←CoreProb; OrderStats/Variance/Betting←EV; Markov←Conditional;
  GameTheory←InterviewGames; Geometry←Rates/Algebra). This spends items on
  advanced topics only when the learner has shown the foundation, and a
  failed-prereq topic is honestly left `not-started` in the roadmap.
- **Adaptive tiebreak**: a 3rd item on any 2-item base slot whose two items split.

**Worst-case item count = 29** (14 base + 9 gated-all-open + 6 tiebreaks) — under
the 31 cap. Nominal (base + all gated) = 23. Fresh questions are drawn every
attempt (unchanged).

Because the diagnostic seeds the same per-topic mastery priors the roadmap reads,
the roadmap starts from an accurate, graph-aligned picture on day one.
