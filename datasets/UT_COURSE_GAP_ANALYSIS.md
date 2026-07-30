# UT Austin M 362K / M 362M vs. Our Quant Course — Topic Gap Analysis

**Deliverable type:** research + gap analysis (docs only; no source changes).
**Question answered:** *Which topics taught in UT Austin's M 362K ("Introduction to
Probability and Statistics") and M 362M ("Introduction to Stochastic Processes")
are **MISSING** or only **PARTIALLY** covered by our app — and what do we fully
cover?*

**Method:** Step 1 researches the two UT courses from official/instructor
syllabi (cited, with dates). Step 2 inventories our content directly from
`src/content/**`, the mastery topic keys (`src/lib/mastery/topicKey.ts`), and the
skill graph (`src/lib/roadmap/skillGraph.ts`) — **verified against the actual
level/generator files**, not trusted from the prior `CURRICULUM_ROADMAP.md`.
Step 3 is the coverage matrix and the itemized MISSING / PARTIAL lists.

---

## TL;DR — the headline answer

**We fully cover the *combinatorics + discrete-probability + expectation + applied
random-walk* spine of both courses.** The gaps are almost entirely on the
**continuous / distribution-theory** side of M 362K and the **process-theory** side
of M 362M.

**MISSING from our course (taught at UT, absent for us):**
1. **Poisson distribution** (as a named discrete distribution) — M 362K.
2. **Continuous distributions as a taught topic** — uniform/exponential/**normal**/**gamma** with their **PDFs & CDFs**, computing probabilities/moments by **integration** — M 362K ch. 5. (We use these ideas *applied*, but never teach density integration.)
3. **Moment generating functions (MGFs)** and the MGF method for sums/transforms — M 362K.
4. **Jointly *continuous* random variables** — joint/marginal/conditional **densities**, and the **distribution of transformed RVs** (Jacobian/CDF method) — M 362K chs. 6–8.
5. **Chebyshev's inequality** and **formal LLN** (statements/convergence) — M 362K ch. 8.
6. **Branching processes** — M 362M.
7. **Poisson processes** (splitting, superposition, order-statistics property, non-homogeneous/compound) — M 362M.
8. **Continuous-time Markov chains** — M 362M.
9. **Brownian motion** — M 362M.
10. **Markov-chain structural theory** — transition-matrix / n-step (Pⁿ) formalism, **state classification** (recurrence/transience/periodicity/communicating classes) — M 362M.

**PARTIAL / weak (present but applied/shallow, not taught systematically):**
- **Continuous uniform, exponential, normal** (used in problems; no density-based teaching).
- **Stationary / limiting distributions** (exists in exactly one brainteaser).
- **Formal CLT** (we teach applied variance-addition + normal-approx tails, not the theorem).
- **Conditional *expectation*** E[X|Y] and the double-expectation/tower rule (implicit, not a taught unit).
- **Martingales** (applied to gambler's ruin / betting EV; no formal martingale/optional-stopping theory).
- **Correlation & covariance of joint distributions** (traps taught; joint-table construction not).

**IMPORTANT scope note (so you don't over-correct):** despite the *"and
Statistics"* in its title, **UT's M 362K is a pure *probability-theory* course**
(Ross / Asimow–Maxwell chs. 1–8). It does **not** teach point estimation,
confidence intervals, hypothesis testing, or regression — so our lack of an
inferential-statistics module is **NOT a gap relative to M 362K.** (The
statistics-inference material lives at UT in **SDS 321**, which the M 362K catalog
entry explicitly says cannot be double-counted.) Details in §1.3.

**Quant relevance (prioritization):** of the gaps, the interview-relevant ones are
**Poisson distribution/process, normal & exponential density facts, Markov-chain
stationary distributions, and Brownian-motion intuition**. **MGFs, gamma
distribution, branching processes, continuous-time Markov chains, and formal
LLN/CLT proofs are largely academic** for OA/interview purposes. See §4.

---

## 1. Step 1 — What the two UT courses actually teach (with sources)

### 1.1 M 362K — "Introduction to Probability and Statistics"

**Textbook:** Sheldon Ross, *A First Course in Probability* (chs. 1–8) in most
sections; some instructors use Asimow & Maxwell, *Probability and Statistics with
Applications* (an actuarial-flavored text), or Pitman. **Prereq:** integral
calculus (M 408D/L/S) — students are expected to integrate by parts and evaluate
double integrals. This calculus prereq is itself a signal that **continuous
distributions and density integration are core to the course.**

**Sources (accessed 2026-07-28):**
- UT Math dept instructor syllabus (M. Kirby-Smith), `web.ma.utexas.edu/users/mks/362K03/M362K03syl.html` — lists the exact section sequence chs. 1–8 ending in limit theorems (8.1–8.3).
- UT Math "First Day Handout" (L. Sadun, Fall 2010), `web.ma.utexas.edu/users/sadun/F10/362K/firstday.html` — "cover almost all of chapters 1–5, most of 6 and 7, and half of 8"; textbook Ross 8e.
- UT official course-docs syllabus, **Spring 2021 (M. Maxwell)**, `utdirect.utexas.edu/apps/student/coursedocs/nlogon/download/11145090/` — full day-by-day calendar (quoted below) + the **University Catalog course description**.
- UT official course-docs syllabus, **Fall 2017**, `.../download/7760520/` and **9th-ed Ross section**, `.../download/6641445` — same catalog topic list.

**University Catalog description (verbatim, from the 2021 syllabus):**
> "An introduction to the mathematical theory of probability … includes basic
> probability properties, conditional probability and independence, various
> discrete and continuous random variables, expectation and variance, central
> limit theorem, and joint probability distributions. Mathematics 362K and
> Statistics and Scientific Computation [SDS] 321 may not both be counted."

**Detailed topic list (official, common core across instructors):**

| # | M 362K topic | Ross ch. |
|---|--------------|----------|
| K1 | Combinatorial analysis / counting (permutations, combinations, multinomial, binomial theorem) | 1 |
| K2 | Axioms of probability; sample spaces, events, unions, **inclusion–exclusion** | 2 |
| K3 | **Conditional probability**, independence, **Bayes' theorem** | 3 |
| K4 | Discrete RVs & special distributions: **Bernoulli, Binomial, Poisson, Geometric, Negative-Binomial, Hypergeometric** | 4 |
| K5 | Continuous RVs: **Uniform, Exponential, Normal, Gamma**; **PDFs, CDFs, density functions**, mixed distributions | 5 |
| K6 | **Expectation & variance** (discrete and continuous); measures of central tendency/dispersion | 4.4–4.5, 5.2–5.3, 7 |
| K7 | **Moment generating functions** | 5.6 / 7 (8.2 MGF method) |
| K8 | **Jointly distributed RVs** (joint/marginal/conditional distributions, **joint densities**), **independence, covariance, correlation**, **distribution of transformed RVs**, **order statistics** | 6, 7 |
| K9 | Limit theorems: **Markov & Chebyshev inequalities, Law of Large Numbers, Central Limit Theorem** | 8 |

Corroboration that continuous-distribution/MGF/joint content is genuinely taught
(not optional) — from the Maxwell Spring-2021 day-by-day calendar:
`5.1 Cumulative Distribution Functions`, `5.2 Density Functions`,
`5.6 Moment Generating Functions`, `6.2 Exponential`, `6.3 Normal`,
`6.4 Central Limit Theorem`, `7.4 Covariance and Correlation`,
`7.5 Joint Continuous Distributions`, `8.1 Transformations`,
`8.2 Moment Generating Function Method`, `8.4 Double Expectation Theorem`.
The catalog description independently lists "moment generating functions,"
"density functions," "mixed distributions," "correlation," "distribution of
transformed random variables," and "order statistics."

### 1.2 M 362M — "Introduction to Stochastic Processes"

**Prereq:** M 362K. **Texts vary** by instructor: Kulkarni (*Modeling & Analysis
of Stochastic Systems*), Grimmett & Stirzaker (*Probability and Random
Processes*), or Ross (*Introduction to Probability Models*). Content therefore has
a **common core** plus **instructor-dependent** topics.

**Sources (accessed 2026-07-28), all `utdirect.utexas.edu/apps/student/coursedocs/nlogon/download/…`:**
- `/5555590/` — "discrete Markov chains, Poisson processes, continuous Markov chains, branching processes"; calendar shows Markov Chains → Poisson Processes.
- `/1050240/` — **Kulkarni-based**, most detailed: "discrete-time Markov chains, Poisson processes, continuous-time Markov chains, renewal processes, and martingales," with explicit sub-topics: transient behavior, **matrix powers Pⁿ**, **limiting behavior / classification of states, transience & recurrence**, costs/rewards, **reversibility**; Poisson **order-statistics property, splitting, superposition, non-homogeneous, compound**; **continuous-time Markov chains**.
- `/6653317/` — **Grimmett & Stirzaker-based**: events/probability review, discrete & continuous RVs, **conditional distributions and expectation**, functions of RVs, **simple random walk, branching process, Markov chains, martingales, convergence of RVs, stationarity, Gaussian processes, queues**.
- `/9472104/` and `/10512683/` — "random walks, branching processes, discrete Markov chains, the Poisson process, **Brownian motion**"; one is simulation/Monte-Carlo flavored.

**M 362M topic list:**

| # | M 362M topic | Core vs. optional |
|---|--------------|-------------------|
| M1 | Probability review incl. **conditional distributions & conditional expectation** | Core |
| M2 | **Random walks** (simple random walk, **gambler's ruin**, hitting times) | Core |
| M3 | **Branching processes** | Core (most instructors) |
| M4 | **Discrete-time Markov chains**: transition matrices, **Pⁿ / n-step**, **state classification** (recurrence, transience, periodicity, communicating classes), **first-step analysis / absorption**, **limiting & stationary distributions**, reversibility | Core |
| M5 | **Poisson processes**: definition, splitting, superposition, order-statistics property, non-homogeneous, compound | Core |
| M6 | **Continuous-time Markov chains** (+ renewal, queues) | Common (Kulkarni/Ross); optional in G&S sections |
| M7 | **Martingales** (+ optional stopping, convergence of RVs, stationarity) | Instructor-dependent (G&S/Kulkarni) |
| M8 | **Brownian motion / Gaussian processes** | Instructor-dependent |

### 1.3 Does M 362K include the "statistics half"? — No.

Every syllabus reviewed (Kirby-Smith, Sadun, Maxwell, Fall-2017) covers **Ross/
Asimow chs. 1–8 = probability theory only.** None list point estimation,
confidence intervals, hypothesis testing, ANOVA, or regression. The catalog
description confirms this and explicitly separates M 362K from **SDS 321**
("…may not both be counted"), which is UT's inference course. The Maxwell section
is even oriented toward **SOA Exam P** (a pure-probability actuarial exam).

**Consequence for us:** our app not teaching confidence intervals / hypothesis
testing / regression is **not a gap against M 362K.** We flag it only as
*context*: if you ever want to match a "Probability *and* Statistics" sequence
that includes inference (some universities' single-course version does), that
material would be net-new. It is also **low interview priority** for
trading/market-making OAs.

*(Confidence: HIGH for the M 362K core and the "no-inference" finding — corroborated across 4 official syllabi + catalog. HIGH for M 362M core (Markov/Poisson/random-walk/branching); MEDIUM for which of CTMC / martingales / Brownian a given semester includes — these are explicitly instructor-dependent.)*

---

## 2. Step 2 — What OUR course actually covers (grounded in files)

Our 17 mastery topics (`topicKeyOf(trackId, section)`), with the **concrete
sub-skills** verified from each `levels.ts` / generator family.

### Track `probability` — "Probability & Statistics"
- **Core Probability** (`src/content/probability/levels.ts`, `pr-1…pr-5`): sample spaces, union / inclusion–exclusion, independence, combinations vs permutations; conditional & Bayes; EV + **binomial** + **geometric** waiting; then hard interview sets — pattern waiting times, **random walks**, **gambler's ruin (i/N)**, geometric probability (broken stick), birthday, **lattice paths / Catalan / ballot / colliding walks**.
- **Combinatorial Analysis** (`probabilityStats/combinatorialAnalysis/levels.ts`, `ca-1…ca-9`, ~14 levels): favorable/total C(n,k) ratios; **hypergeometric** (ca-2); poker-hand counting; complement / at-least-one; **binomial tails**; dice sums / parity / symmetry; permutations-vs-combinations & stars-&-bars traps; grid/lattice & multinomial paths; arrangements (chain rule, circular, gap method, kⁿ); tournaments/semicircle/ring; **coupon collector, linearity, inclusion–exclusion**; capped stars-&-bars capstone.
- **Geometric Probability** (`geometricProbability/levels.ts`, `geo-1…geo-2`): area/length ratio reasoning (r² not r), meeting-in-a-square, tile-fit — **continuous *uniform* applied via geometry**.
- **Conditional Probability** (`conditionalProbability/levels.ts`, `cp-1…cp-6`): reduced sample space; **Bayes** / base-rate; **law of total probability**; **continuous conditioning of a uniform** (memoryless contrast); races a/(a+b) & first-step recursion; Russian-roulette dependence; Monty Hall / two-child / Bertrand paradoxes.
- **Expected Value** (`expectedValue/levels.ts`, `ev-1…ev-8`, ~25 families): dice/coin EV; **optimal stopping / reroll**; waiting games (geometric 1/p, **negative binomial r/p**, two-in-a-row, memorylessness); **linearity of expectation** (coupon, records, empty boxes); **second moments E[X²]=Var+mean², exponential 2/λ², sums of uniforms, CLT variance-addition**; conditional & geometric-probability areas, **max of dice, uniform order statistics k/(n+1)**; **random walks & martingales** (i/N, i(N−i), Wald, doubling EV=0); **divergent-EV (St. Petersburg)** + coin-simulation (Von Neumann).
- **Betting & Sizing / Kelly** (`bettingSizing/levels.ts`, `bs-1…bs-4`): Kelly f*=(bp−q)/b across cards/coins/dice × American/decimal/fractional odds; complements, negative money lines.
- **Order Statistics** (`orderStatistics/levels.ts`, `os-1`): min of n uniforms (nth-power tail), P(specific ordering)=1/n!, **exponential median ln2/λ**.
- **Variance, Covariance & the CLT** (`varianceCovarianceClt/levels.ts`, `vc-1…vc-3`): **Cauchy–Schwarz covariance ceiling**, affine-correlation signs, SD-addition trap, variance-doubling of a difference; **Var(aX+bY)=a²VarX+b²VarY**; **CLT normal-approx tails P(X≥k)≈1−Φ(z), σ²=np(1−p)**; **Markov's inequality E[T]/a**; perfect-correlation ⇒ linear relation; dependence-aware conditional.
- **Markov Chains** (`markovChains/levels.ts`, `mc-1…mc-6`): **first-step analysis** E[s]=1+ΣP·E[s']; coin-pattern waits (2ⁿ⁺¹−2, (1+p)/p²), reset chains; **Conway pattern races/overlap**; random walks on cube/polygon/grid (hitting times); deuce/restart recursions; **gambler's ruin biased (1−rᵏ)/(1−rᴺ) & bold play**; piecewise Drunkard's-walk desk.
- **Game Theory & Puzzles** (`gameTheory/levels.ts` + `gamePuzzle`): dominant strategies / Nash, backward induction, Hotelling/beauty contest, **zero-sum mixed-strategy value**, Volunteer's Dilemma, **optimal market-making spread**, arbitrage puzzles.

### Track `math-questions` — "Applied Math & Number Puzzles"
- Rates/work/motion; algebra & systems; number theory & growth; counting & arrangements; geometry; Diophantine/derivation flashcards. (Supports the M408 algebra/calculus fluency M 362K assumes — foundations, not 362K/M content.)

### Track `mental-math`, `brainteasers`, `interview-games`
- **Mental Math** (`mm-1…mm-4`): timed arithmetic screen (Tier-0 gate).
- **Brainteasers** (`brainteasers/levels.ts`, `bt-1…bt-6`): logic/weighings/encodings; **invariants & parity**; combinatorial games (Nim/Wythoff), backward induction; **one Markov-chain stationary-distribution card** (`bt-inventory-cap`: solves πP=π, long-run 1/3 rejection).
- **Interview Games** (`interviewGames/levels.ts`, `ig-1…ig-trading-decisions`): EV fair value, basket/ETF NAV, **Fermi**, **optimal stopping (secretary 1/e, St. Petersburg)**, card-counting/de-vig, **market making (adverse selection, spread, inventory skew)**.

**Verification note vs. `CURRICULUM_ROADMAP.md`:** the prior doc's 17-topic map and
M362K/M362M tie-ins are **accurate**. One nuance to correct: the roadmap tags
Variance/CLT as "M362K chs. 7–8 (…Markov/Chebyshev bounds…the CLT)" — in the
actual files we ship **Markov's inequality only** (`genMarkovBound`); **Chebyshev
is named in a comment but not taught/generated**, and the CLT is **applied**
(normal-approx tails) rather than stated as a theorem. Geometric Probability is
tagged "M362K ch. 5 continuous/uniform" — fair, but it teaches the *geometric
ratio*, **not** density functions, so ch. 5's PDF/CDF machinery is still absent.

---

## 3. Step 3 — Coverage matrix & the gap lists

Legend: **✅ Full** = taught systematically as its own material · **🟡 Partial** =
present but applied/shallow or only via a single item/brainteaser · **❌ Missing**
= not present.

### 3.1 M 362K coverage matrix

| M 362K topic | Status | Where we cover it (or where it would live) |
|---|---|---|
| K1 Combinatorics / counting | ✅ Full | `probability::Combinatorial Analysis` (ca-1…ca-9); `Core Probability` pr-1 |
| K2 Axioms, sample space, inclusion–exclusion | ✅ Full | `Core Probability` pr-1; ca-comp / ca-7 (incl–excl) |
| K3 Conditional prob., independence, Bayes | ✅ Full | `Conditional Probability` cp-1…cp-6; `Core Probability` pr-2 |
| K4 Bernoulli/Binomial | ✅ Full | pr-3; `Combinatorial Analysis` ca-4/ca-bino; `Betting & Sizing` |
| K4 Geometric | ✅ Full | pr-3; `Expected Value` ev-3 |
| K4 Negative-Binomial | ✅ Full | `Expected Value` ev-3 (`genNegBinomial`) |
| K4 Hypergeometric | ✅ Full | `Combinatorial Analysis` ca-2 |
| K4 **Poisson distribution** | ❌ Missing | Only a "Poisson-approximation" trick in one dice-sum generator; no Poisson pmf/mean/variance taught. **Would live in** `Core Probability` or a new "Discrete Distributions" level. |
| K5 Continuous **Uniform** | 🟡 Partial | Applied in `Geometric Probability`, `Order Statistics`, ev-2 reroll — never as a taught pdf/cdf. |
| K5 **Exponential** | 🟡 Partial | Applied: memorylessness (cp-3), median ln2/λ (os-1), E[X²]=2/λ² (ev-5). No density/param teaching. |
| K5 **Normal / Gaussian** | 🟡 Partial | Only as CLT normal-approx tail Φ(z) (vc-2). Not taught as a distribution (pdf, standardization, tables). |
| K5 **Gamma distribution** | ❌ Missing | Absent ("gamma" in code = log-gamma function only). **Would live in** a "Continuous Distributions" level. |
| K5 **PDFs / CDFs / density integration** (incl. mixed distributions) | ❌ Missing | No level teaches "given density f(x), find P/E/Var by integration." Core M 362K skill absent. **New "Continuous Random Variables" level.** |
| K6 Expectation & variance | ✅ Full | `Expected Value` (ev-1…ev-8); `Variance, Covariance & the CLT` |
| K7 **Moment generating functions** | ❌ Missing | No MGF anywhere. **Would live in** a "Distributions / MGF" level under `Expected Value` or Variance/CLT. |
| K8 Covariance & correlation | ✅ Full | `Variance, Covariance & the CLT` vc-1 (Cauchy–Schwarz, affine ρ) |
| K8 **Jointly *continuous* RVs / joint densities / marginal & conditional distributions** | ❌ Missing | We do independence & discrete linearity, but no joint pmf/pdf tables, marginals, or conditional distributions. **New "Joint Distributions" level.** |
| K8 **Distribution of transformed RVs** (CDF/Jacobian method) | ❌ Missing | Not taught. **New level or extend Order Statistics.** |
| K8 Order statistics | ✅ Full | `Order Statistics` os-1; ev-6 (uniform spacings, max of dice) |
| K9 Markov inequality | ✅ Full | `Variance, Covariance & the CLT` vc-2 (`genMarkovBound`) |
| K9 **Chebyshev inequality** | ❌ Missing | Named in a comment only; no generator. **Add to** vc-2. |
| K9 **Law of Large Numbers (formal)** | ❌ Missing | Implicit in Kelly/EV; never stated. **Would live in** Variance/CLT. |
| K9 Central Limit Theorem | 🟡 Partial | Applied (variance adds; normal-approx tails; ev-5, vc-2). The **theorem** (convergence in distribution, conditions) is not taught. |

### 3.2 M 362M coverage matrix

| M 362M topic | Status | Where we cover it (or where it would live) |
|---|---|---|
| M1 Conditional prob. review | ✅ Full | `Conditional Probability` cp-1…cp-6 |
| M1 **Conditional expectation** E[X\|Y] / tower rule | 🟡 Partial | Used implicitly (first-step, cp-4, ev-6); never taught as E[X\|Y] / double-expectation. **Extend `Expected Value`.** |
| M2 Random walks (simple, gambler's ruin, hitting times) | ✅ Full | `Markov Chains` mc-1…mc-5; `Core Probability` pr-4; `Expected Value` ev-7 |
| M3 **Branching processes** | ❌ Missing | Absent (no Galton–Watson, extinction probability, PGF). **New level, `Markov Chains` track.** |
| M4 First-step analysis / absorption / hitting times | ✅ Full | `Markov Chains` mc-1, mc-4 |
| M4 **Transition-matrix / Pⁿ / n-step** formalism | 🟡 Partial→❌ | We do first-step recursion, **not** matrix powers / Chapman–Kolmogorov. **Extend `Markov Chains`.** |
| M4 **State classification** (recurrence, transience, periodicity, communicating classes) | ❌ Missing | Not taught. **New `Markov Chains` level.** |
| M4 **Stationary / limiting distributions** (πP=π) | 🟡 Partial | Exactly one brainteaser (`bt-inventory-cap`) solves πP=π; not a taught unit. **New `Markov Chains` level.** |
| M5 **Poisson processes** (splitting, superposition, order-stat property, NHPP, compound) | ❌ Missing | Absent. **New level (needs the Poisson distribution first).** |
| M6 **Continuous-time Markov chains** (+ renewal/queues) | ❌ Missing | Absent. Academic for interviews. |
| M7 **Martingales** (formal, optional stopping, convergence) | 🟡 Partial | Applied only: martingale betting EV=0, gambler's-ruin via optional stopping (ev-7). No formal martingale definition/theory. |
| M8 **Brownian motion / Gaussian processes** | ❌ Missing | Absent. Interview-relevant *intuition* (esp. quant) but not taught. **New advanced level.** |

---

## 4. Interview / OA relevance of each gap (prioritization)

Ranked by usefulness for quant OA / trading interviews (Green Book, firm screens),
so you can decide what's worth adding.

**High interview value — worth adding:**
- **Poisson distribution & Poisson process (basic):** arrival/rare-event modeling shows up in OAs and market-microstructure questions. Poisson process splitting/superposition and the "expected # of events" framing are genuinely asked.
- **Normal-distribution facts & standardization; exponential memorylessness/min-of-exponentials:** common in probability rounds and Black–Scholes-adjacent reasoning. We have the *pieces* (Φ(z), memorylessness) but not a consolidated "know your continuous distributions" unit.
- **Markov-chain stationary/limiting distributions:** "long-run fraction of time" and steady-state questions are a real interview genre (we currently have only one puzzle).
- **Brownian-motion intuition:** frequently probed at quant-research/derivatives desks (drift/variance scaling, √t), even if the formal theory isn't.

**Medium value:**
- **Density integration (PDF/CDF) as a skill** — underpins many continuous problems; more a *foundational* fix than a directly-asked topic.
- **Conditional expectation / tower rule** — powers many EV problems; worth teaching explicitly.
- **Chebyshev / formal CLT statement** — occasionally asked ("what does CLT actually say?").

**Low value (largely academic for OA/interviews):**
- **Moment generating functions** — a proof tool; rarely asked to compute in trading interviews.
- **Gamma distribution**, **branching processes**, **continuous-time Markov chains**, **renewal theory**, **formal LLN**, **transformation-of-RV Jacobians** — standard coursework, seldom on trading OAs.
- **Inferential statistics (CIs / hypothesis tests / regression)** — not in M 362K at all, and low priority for market-making/trading screens (more relevant to data-science/quant-dev tracks).

---

## 5. One-paragraph summary for the user

Against **M 362K**, we fully own **counting, axioms/sample space,
conditional/Bayes, all the discrete distributions except Poisson, expectation &
variance, covariance/correlation, order statistics, and Markov's inequality.**
We are **missing the Poisson distribution, the entire continuous-distribution /
density-function unit (uniform/exponential/normal/gamma taught via PDFs/CDFs and
integration), moment generating functions, jointly-continuous RVs / joint
densities / transformations, Chebyshev's inequality, and the formal LLN**, and we
only cover the **CLT and continuous uniform/exponential/normal in an applied,
non-density way.** Against **M 362M**, we fully own **random walks, gambler's ruin,
hitting times, and first-step analysis**, but are **missing branching processes,
Poisson processes, continuous-time Markov chains, Brownian motion, the
transition-matrix/Pⁿ formalism, and state classification**, with **stationary
distributions and martingales present only in applied/one-off form.** Crucially,
**UT's M 362K is pure probability theory** — it does **not** teach confidence
intervals, hypothesis testing, or regression — so our lack of an inferential-stats
module is **not** a gap relative to that course.
