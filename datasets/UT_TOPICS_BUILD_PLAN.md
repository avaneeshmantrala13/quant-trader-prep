# UT M362K / M362M Coverage Build — Internal Plan & Provenance

**Goal.** Close every uncovered UT-Austin M362K/M362M topic identified in
`UT_COURSE_GAP_ANALYSIS.md`, split into two buckets:

- **Bucket 1** — uncovered but firms DO test → incorporated into the main
  Probability & Statistics track (natural existing/new sections, easiest→hardest).
- **Bucket 2** — untested at any firm → one clearly-labeled section at the END,
  **`Extra Relevant Knowledge`** (for course-completeness without cluttering the
  trader-prep spine).

**Conventions followed (from prior integrations).** Exact rational solvers
(`fraction.js`) where the math is rational; `number` + stated precision + `Φ(z)`
(`normalCdf` in `coreSolvers.ts`) for genuinely transcendental targets (normal,
BM, exponential tails). Every distractor is a re-derived, NAMED misconception,
guaranteed `≠` answer and distinct at grading precision. Numeric-answer topics →
`numeric` mode (`commonErrors`); conceptual/derivation → `quiz` with
misconception `distractorRationale`. Solvers + generators are pure/tested; React
is untouched (levels inherit theming automatically → all 6 themes, light+dark).
Original scraped items are NEVER shown to users — they live only as hidden test
fixtures / independent re-derivations in `*.test.ts`.

**Coordinator note / documented deviation.** The task suggested fanning generation
out to internal subagents. Because every topic shares ONE exact-solver library
(`coreSolvers.ts` / `coreScaffold.ts`) and green gates are a hard requirement, the
content was authored serially by the coordinator for solver consistency and to
avoid shared-file write conflicts — a permitted, documented refinement. Each topic
still owns its OWN new directory under `src/content/probabilityStats/**`; shared
files (aggregator, skill graph, shared tests) are edited once, serially, at the end.

---

## Bucket 1 — incorporate into the main course

| Topic | New folder / placement | Section label | Mode(s) | Generator families | Sources |
|---|---|---|---|---|---|
| **Poisson distribution + process** | `poisson/` — after Expected Value | `Poisson Distribution & Process` | numeric | pmf `P(X=k)=e^{-λ}λ^k/k!`, `P(X≥1)`, mean/variance=λ; process `E[N]=λt`, thinning `λtp`, superposition `(λ₁+λ₂)t`, `P(k arrivals)` | Ross AFCP ch. 4.7; PSU STAT 414; MIT OCW 6.041; SOA Exam P |
| **Continuous distributions (density integration, Uniform, Exponential, Normal)** | `continuousDistributions/` — after Order Statistics, before Variance/CLT | `Continuous Distributions` | numeric | density normalization `∫f=1`, `P` by integration, `E[X]=∫xf`; Uniform prob/mean; Exponential `P(X>t)=e^{-λt}`, memorylessness, min-of-exponentials rate=Σλ; Normal standardization `Φ(z)`, intervals | Ross AFCP ch. 5; PSU STAT 414; MIT OCW 6.041 |
| **Markov stationary / limiting distributions** | extend `markovChains/` (new file `stationary.ts`) | `Markov Chains` (existing) | numeric | solve `πP=π,Σπ=1` (2- and 3-state) → long-run fraction of time | Ross IPM ch. 4; PSU STAT 416; Grinstead & Snell |
| **Brownian-motion intuition (advanced)** | `brownianMotion/` — after Markov Chains | `Brownian Motion` | numeric | `sd=σ√t` (√t scaling), `Var=σ²t`, drift `E=x₀+μt`, `P(X_t≤x)=Φ((x-μt)/(σ√t))`, independent increments | Ross IPM ch. 10; MIT OCW 6.041; Shreve SCF-II (intuition) |

## Bucket 2 — `Extra Relevant Knowledge` section (appended at the very end)

All levels share `section: "Extra Relevant Knowledge"` (one mastery topic / one
skill-graph node), each in its own folder, ordered easiest→hardest.

| Topic | Folder | Mode | Generator families | Sources |
|---|---|---|---|---|
| **Moment generating functions + MGF method** | `mgf/` | numeric | `E[X]=M'(0)`, `Var=M''(0)−M'(0)²` for Bernoulli/Poisson/Exponential/Normal MGFs; sum-of-independent ⇒ product of MGFs | Ross AFCP 5.6/7; MIT OCW 6.041 |
| **Gamma distribution** | `gammaDistribution/` | numeric | mean `k/λ`, variance `k/λ²`; `Gamma(k,λ)` = sum of k iid `Exp(λ)` = time to kth Poisson arrival | Ross AFCP 5.6; PSU STAT 414 |
| **Jointly continuous RVs + transforms** | `jointDistributions/` | numeric | joint-density normalization, `P((X,Y)∈region)`, marginal expectation; transform via CDF/Jacobian (`Y=X²→P(Y<c)=√c`) | Ross AFCP chs. 6–7; PSU STAT 414 |
| **Branching processes** | `branchingProcesses/` | numeric | `E[Zₙ]=μⁿ`; extinction prob = smallest root of `s=G(s)` = `min(1, p₀/p₂)` for quadratic offspring | Ross IPM ch. 4; Grimmett & Stirzaker |
| **Continuous-time Markov chains (+queues)** | `continuousTimeMarkov/` | numeric | holding time `1/(Σ out-rates)`; 2-state CTMC stationary `μ/(λ+μ)`; M/M/1 `ρ=λ/μ`, `L=ρ/(1−ρ)`, `P₀=1−ρ` | Ross IPM chs. 6–8; PSU STAT 416 |
| **Formal LLN, CLT, Chebyshev** | `limitTheorems/` | quiz | Chebyshev bound `σ²/a²` / `1/k²`; CLT statement (convergence in distribution, finite variance); LLN statement (sample mean → μ) with misconception distractors | Ross AFCP ch. 8; MIT OCW 6.041 |
| **Markov structural theory (Pⁿ / Chapman–Kolmogorov + state classification)** | `markovStructure/` | numeric + quiz | `(P²)_{ij}=Σ_k P_{ik}P_{kj}` exact; classify recurrence/transience/periodicity/communicating classes | Ross IPM ch. 4; PSU STAT 416; Grinstead & Snell |

---

## Placement & ordering (Probability & Statistics track, easiest→hardest)

Core Probability → Combinatorial Analysis → Geometric Probability → Conditional
Probability → Expected Value → **Poisson Distribution & Process** → Betting &
Sizing → Order Statistics → **Continuous Distributions** → Variance, Covariance &
the CLT → Markov Chains (**+ Stationary/Limiting level**) → **Brownian Motion** →
Game Theory & Puzzles → **Extra Relevant Knowledge** (Bucket 2, last).

Rationale for deviations from the raw gap doc: Poisson sits right after Expected
Value (it uses `E[X]=λ`); Continuous Distributions sits before Variance/CLT so the
Normal density is taught before the CLT normal-approximation reuses `Φ(z)`;
Brownian Motion caps the process spine after Markov Chains; the stationary level is
appended inside the existing Markov Chains section (it is a Markov topic, not a new
one).

## Shared-file edits (serial, flagged in the report)

1. `src/content/probabilityStats/index.ts` — import + insert new sections in order.
2. `src/content/probabilityStats/markovChains/levels.ts` — add the stationary level.
3. `src/content/levels.test.ts` — update Markov count 7→8; add well-formedness suites for new sections.
4. `src/lib/roadmap/skillGraph.ts` — add 4 nodes (Poisson, Continuous Distributions, Brownian Motion, Extra Relevant Knowledge) with prereqs/tiers.

**Diagnostic:** left UNCHANGED. Worst-case is already 29 (cap 30) and its counts are
hardcoded across `blueprint.ts`/`blueprint.test.ts`/`run.test.ts` (a sensitive,
just-redesigned multistage flow the task says NOT to disturb). New topics are
represented in the skill graph / roadmap / map / Table of Contents instead. This is
the documented, back-compatible choice (adding probes would risk the ≤30 guarantee
and the green WIP).

## Answer-mode routing summary
- **numeric** (scalar answer, exact or decimals+tol): Poisson, Continuous
  Distributions, Markov stationary, Brownian Motion, MGF, Gamma, Joint, Branching,
  CTMC, Markov-Pⁿ.
- **quiz** (misconception distractors, conceptual): Limit Theorems (LLN/CLT/
  Chebyshev), Markov state-classification.
