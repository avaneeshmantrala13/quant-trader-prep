# Next-Level Quant-Prep Features — Ranked Proposal & Flagship Pick

**Status:** IDEATION + LIGHT RESEARCH ONLY. No app code changed, nothing committed.
This is a curated, opinionated shortlist for the **quant-interview-prep (Case B)**
side of the site, plus a single recommended **flagship challenge** and an explicit
recommendation to **replace the "Calibration Gym"**.

**Grounded in the current code** — `src/lib/simulations/**` (catalog + the
Basketball / Marble / ETF "Trading Desk" sims and their shared `liveMarket.ts`
scaffold), `src/lib/arena/**` (Speed Arena timing/scoring/leaderboard),
`src/lib/calibration/**` + `src/lib/mastery/reliability.ts` (Brier / reliability
diagrams), `src/lib/adaptivity/**` (ZPDES review), `src/content/fermi/**` — and in
the research docs `datasets/FIRM_TIMED_ASSESSMENTS*.md`,
`datasets/quant-interview-games-mechanics.md`, `datasets/CASE_MODE_BUILD_PLAN.md`,
plus a 2026 web scan of Jane Street / Optiver / SIG / IMC interview practice.

---

## 0. What actually impresses quant firms (the bar to clear)

From `FIRM_TIMED_ASSESSMENTS.md §3` (ranked timed skill categories across the
top-20 trader pipelines) and a 2026 web scan of firm interview write-ups:

1. **Fast mental arithmetic** — the universal gate. *Already done well* by the
   Speed Arena (Zetamac / Optiver 80-in-8, +1/−1, rushing detector, leaderboard).
2. **Probability / EV under time** — very high signal; mostly *content*, partly a gap.
3. **The market-making game** — explicitly *"the highest interview signal"*
   (`§3 #3`) and, per every 2026 write-up (Jane Street, Optiver, IMC), the single
   most distinctive round. It tests three things at once: **calibration** (is your
   spread sized to your uncertainty?), **Bayesian updating** (do you re-quote
   cleanly as info arrives?), and **adversarial reasoning / adverse selection**
   (do you notice the winner's curse when an informed counterparty keeps picking
   one side?).
4. **Arbitrage / de-vig**, **sequences**, **estimation/Fermi with CI elicitation**
   (Old Mission literally scores confidence intervals), then **logic / coding**.

The **through-line firms hire for is decision quality under uncertainty, priced in
P&L** — not trivia. Jane Street even grades mental-math answers *with a stated
confidence* rather than raw speed (`§1`). That is the lens every idea below is
optimized for, and it is exactly why the passive "Calibration Gym" (submit a
probability → reveal → Brier score) undershoots: firms don't ask you to *state* a
probability, they make you *trade* it against someone who knows more than you.

### What already exists (so we extend, not duplicate)

- **Speed Arena** — mature timed arithmetic engine: pure `session.ts` state
  machine, `scoring.ts`, pacing/rushing analytics, server-authoritative
  leaderboard, firm presets. **Reusable timer + leaderboard scaffold for anything.**
- **Trading Desk sims** (Basketball / Marble / ETF) on `liveMarket.ts` — real
  adverse-selection fill model (`resolveFill`), two-sided `makerQuote`, inventory
  skew, `maxDrawdown`, `gradeVsBenchmark`. **BUT they are *policy-tuning* toys:**
  you set spread/skew on sliders, the whole session is computed once in `useMemo`,
  and a slider just scrubs a pre-baked P&L curve. **There is no round-by-round
  human decision, no informed opponent you react to, no belief updating.** That is
  the single biggest opening.
- **Calibration** — `reliability.ts` (Brier decomposition, reliability diagram,
  over/under-confidence read) and `calibration/ranking.ts`. Solid math primitives,
  but currently only feed a dashboard read-out; the "Gym" itself is
  `comingSoon: true` with zero levels (`KNOWLEDGE_GRAPH_CASE_B.md`).
- **Simulations** — GBM/random-walk (`processes.ts`, `stockMarket.ts`), Markov
  regimes, Kelly, a **bivariate-normal joint density** already rendered, poker
  equity, Monty Hall/Bayes, 2×2 zero-sum solver. **A lot of the math backbone for
  options/stoch-vol/stat-arb already exists.**
- **Fermi** — `content/fermi/items.ts` + `lib/fermi/grader.ts`: a library of
  guesstimate quantities with graded decomposition. **A ready-made bank of
  "unknown quantities" to make markets on.**
- **Stack** — React 18 + TypeScript + Vite + Tailwind, deterministic seedable
  `Rng`, Vitest everywhere, DynamoDB/Cognito leaderboard. Pure-engine + tested is
  the house style; keep it.

---

## 1. Ranked shortlist

Ranked by **(interview/resume signal) × (achievable without a backend rewrite) ×
(fit with what's already built)**. #1 is the recommended flagship.

| # | Idea | Signal | Effort | Extends |
|---|------|--------|--------|---------|
| **1** | **The Trading Floor** — real-time *adversarial* make-a-market engine (belief-trading, Bayesian reveals, P&L = realized proper score) | ★★★★★ | 1–2 wk core | `liveMarket.ts`, `calibration/**`, Fermi bank, Arena timer → **replaces Calibration Gym** |
| **2** | **Options Desk** — Black-Scholes + Monte-Carlo pricer, live Greeks, and a **delta-hedging P&L game** | ★★★★★ | 2–3 wk | `processes.ts` (GBM), joint-density, Kelly/EV group |
| **3** | **Limit Order Book + matching engine** — price-time-priority book, queue position, market/limit orders, slippage vs a flow model | ★★★★☆ | 2–4 wk | Trading Desk group; new engine (Worker/WASM) |
| **4** | **Stat-Arb Lab** — cointegration → z-score pairs strategy → mini backtester with costs, Sharpe, drawdown, walk-forward | ★★★★☆ | 2–3 wk | `stockMarket.ts`, Markov regimes, real-world sims |
| **5** | **Rigorous adaptive engine** — 2PL **IRT** ability + **Glicko** item difficulty + **Thompson-sampling** item selection, with an offline eval | ★★★☆☆ | 1–2 wk | `lib/adaptivity/**`, `lib/mastery/**`, `calibration/**` |
| **6** | *(stretch bolt-on)* **RL market-maker opponent** — train a tabular/PG agent in-browser; race your manual quotes against it | ★★★★☆ | +1–2 wk on #1 | #1 + `liveMarket.ts` |

Below, each idea gets: **Concept & plug-in · Why it's resume-impressive · Technical
approach & stack · Scope · Risks / how to keep it rigorous.**

---

### 1. The Trading Floor — real-time adversarial "Make-Me-a-Market" *(FLAGSHIP)*

**Concept & plug-in.** A genuinely interactive market-making game. Each round the
app poses an unknown quantity (a Fermi guesstimate from `content/fermi/items.ts`,
a card-sum, a dice total, or a live path-dependent value). **You post a two-sided
quote.** An **informed counterparty bot** — which knows the true fair value with
noise — trades against you *only when it's bad for you* (lifts your ask when you're
cheap, hits your bid when you're rich), exactly the `resolveFill` adverse-selection
model already in `liveMarket.ts`. Then **new information is revealed** (a card
flips, a bound tightens, a hint drops), your Bayesian posterior over fair value
updates, and **you re-quote**. Repeat for N rounds; your **cumulative P&L, max
drawdown, inventory, and pick-off count** are your score, graded vs the benchmark
desk (`gradeVsBenchmark`). This is the *arena/interactive* sibling of the existing
batch Trading-Desk sims — it turns "tune a policy on a slider" into "make the call
every round against an adversary," which is what the interview actually is.

**Why it's resume-impressive.** This is *the* highest-signal quant-trader skill
(`FIRM_TIMED_ASSESSMENTS §3 #3`; confirmed by every 2026 Jane Street/Optiver/IMC
write-up: calibration + Bayesian updating + adverse-selection). A recruiter reads
"I built the Jane Street market-making game, with an informed adversary and a
Bayesian belief tracker, and my calibration is scored as realized P&L" as *"this
person understands adverse selection and winner's curse, not just textbook EV."*
The proper-scoring-rule framing (below) signals real probability maturity. It's the
rare portfolio piece that is simultaneously a *product feature*, a *trading
concept*, and a *stats concept*.

**Technical approach & stack.**
- **Engine (pure, seedable, tested — house style).** Reuse `makerQuote`,
  `resolveFill`, `drawNoise`, `cumulativeSum`, `maxDrawdown`, `gradeVsBenchmark`.
  Add: a **`Scenario`** interface (`{ drawFair(rng), reveal(state) → info,
  posterior(info) }`) so cards/dice/Fermi/live all share one loop; a **round state
  machine** mirroring `arena/session.ts` (`quote → fill → reveal → requote`), so
  it's deterministic and unit-testable; a **belief tracker** that maintains a
  running posterior (conjugate update for card-counting/Beta-Bernoulli; a discrete
  grid posterior for Fermi) and shows the user the "textbook" fair value each round
  for feedback.
- **Proper scoring / "trade your beliefs" (the calibration core).** For the pure
  probability variant, offering a two-sided market on a **0/1 contract** is
  mathematically equivalent to a proper scoring rule: buying/selling the contract
  at price *p* and settling at outcome *y* realizes a **log/quadratic-score-like
  payoff**, so **honest calibration is the P&L-maximizing strategy** and
  overconfidence gets punished by the informed bot. Feed each realized quote-vs-
  outcome pair straight into the existing `reliability.ts` Brier/reliability
  machinery → a **reliability diagram + Brier/log-loss** panel, and a **Brier/PnL
  leaderboard** on the existing DynamoDB scaffold.
- **UI.** Real-time round loop with a shot-clock (reuse Arena timer), a bid/ask
  entry, a live inventory/P&L/drawdown readout (reuse `TradingDeskGroup`'s
  `ScorePanel`/`PnlChart`), and a post-game **reliability + "you got picked off on
  the wrong side 6×"** debrief. React + TS + Tailwind; no new deps.

**Scope.** Core (cards/dice + Fermi scenarios, informed bot, belief tracker, P&L +
reliability debrief): **~1–2 weeks**. Leaderboard + polish: a few more days. Much
of the math already exists, which is why this is the flagship.

**Risks / keeping it rigorous.** (a) *Toy-bot risk* — make the counterparty
genuinely informed-with-noise and occasionally uninformed, so bluffing/adverse
selection is real, not scripted. (b) *"Is it really calibration?"* — state the
proper-scoring-rule equivalence explicitly in the debrief so it's provably not a
gimmick. (c) Keep every engine function pure + Vitest-covered (the repo's bar);
determinism-by-seed makes runs replayable, itself a talking point.

---

### 2. Options Desk — Black-Scholes, Monte Carlo & a delta-hedging game

**Concept & plug-in.** A new Simulations group where you price a European option
three ways side-by-side — **closed-form Black-Scholes**, **Monte-Carlo under GBM**
(reusing `processes.ts`), and a **binomial tree** — and watch them converge. Live
**Greeks** (Δ, Γ, ν, Θ, ρ) plotted across spot/vol/time. Then the flagship
sub-feature: a **delta-hedging game** — you're short an option and must
re-hedge each step; the app tracks your **replication error / gamma-P&L** as spot
random-walks, teaching *why* the BS price is what it is. Extends the existing
GBM/random-walk sims and the Kelly/EV group with the canonical derivatives layer
the course is currently missing.

**Why it's resume-impressive.** Options pricing + Greeks + hedging is the
"do you actually know quant finance" litmus test for **quant-dev / desk-quant /
QR** seats. A recruiter reads a *working* MC pricer with **variance reduction** and
a hedging-error simulation as genuine derivatives fluency, not a memorized formula.
The MC + convergence + antithetic/control-variates angle also shows numerical-
methods chops (relevant to XTX/Two Sigma/HRT research-flavored screens).

**Technical approach & stack.** Pure TS engine: BS closed form + `erf`
approximation; MC with **antithetic variates + a control variate** (report the
variance reduction — great detail); CRR binomial tree; analytic Greeks +
finite-difference cross-check. Hedging game = discretize a GBM path, user picks
hedge frequency, track P&L variance vs Black–Scholes–Merton continuous-hedge limit.
Heavy MC in a **Web Worker** with typed arrays (optionally WASM later). Charts reuse
`LineChart`; Vitest asserts MC→BS convergence and put-call parity.

**Scope.** BS + Greeks + MC pricer: **~1 week**. Delta-hedging game + convergence
visuals + tests: **another 1–2 weeks**. Total **2–3 weeks**.

**Risks / rigor.** Don't ship a bare formula calculator — the **hedging game and
MC-convergence/variance-reduction** are what separate this from a toy. Validate
numerically (put-call parity, MC standard error, tree→BS limit) and surface those
checks in-app.

---

### 3. Limit Order Book + matching engine

**Concept & plug-in.** A real **price-time-priority limit order book** with a
matching engine: a synthetic flow model streams orders, you submit **limit/market
orders**, and you see **queue position, partial fills, slippage, and effective
spread paid**. A step up in realism from the current mid-price `resolveFill`
abstraction — this is the actual microstructure object. Slots into the Trading Desk
group as the "how markets really clear" companion to the make-a-market game.

**Why it's resume-impressive.** A correct matching engine (price-time priority,
FIFO queues, partial fills) is a canonical **quant-dev / HFT-infra** artifact —
firms like HRT/Jump/Tower/Virtu screen for exactly this systems sense. A recruiter
reads "built a matching engine + order book with realistic queueing and slippage"
as low-level-systems + microstructure competence, which very few candidate portfolios
have.

**Technical approach & stack.** Data structures: per-price-level **FIFO queues**
indexed by a sorted price ladder (array-of-levels or a small tree); an
**event-driven matching loop**; a **Poisson/Hawkes-ish order-flow generator**
(add/cancel/market events). For the engineering flex, run it in a **Web Worker**
with typed arrays for a deterministic, replayable, high-throughput sim; consider a
**WASM (Rust / AssemblyScript)** matching core as a "low-latency" talking point.
Canvas/SVG depth-of-book ladder + time-and-sales tape.

**Scope.** Correct book + matching + basic flow + UI: **~2 weeks**; Hawkes flow,
WASM core, metrics (fill ratio, slippage, adverse selection per order): **+1–2 weeks**.

**Risks / rigor.** Correctness is the whole point — property-test the invariants
(no crossed book, price-time priority, conservation of shares) in Vitest. Keep the
flow model defensible (cite the Poisson/Hawkes basis) so it doesn't feel arbitrary.

---

### 4. Stat-Arb Lab — pairs trading & a mini backtester

**Concept & plug-in.** Generate two correlated/cointegrated price series (reusing
`stockMarket.ts` + Markov regimes), **test for cointegration** (Engle–Granger /
ADF on the spread), trade the **z-score of the spread** (enter at ±2σ, exit at 0),
and run it through a **mini backtesting engine** with transaction costs → equity
curve, **Sharpe, max drawdown, hit rate**, and **walk-forward** out-of-sample
splits. Extends the real-world random-walk/regime sims into a full research
mini-workflow.

**Why it's resume-impressive.** Cointegration + a costed, walk-forward backtest is
the **quant-researcher** signature. A recruiter reads it as "understands
stationarity, look-ahead bias, transaction costs, and Sharpe" — i.e., can do
research without fooling themselves, the exact worry QR interviews probe
(XTX/Two Sigma/DRW research tracks).

**Technical approach & stack.** Pure TS: OLS hedge ratio, ADF test statistic,
rolling z-score, a vectorized backtest loop with costs/slippage, standard metrics.
Optional cross-check against a small canned real dataset. Charts reuse `LineChart`
(price pair, spread, equity curve). Vitest on a known-cointegrated synthetic pair.

**Scope.** Cointegration + z-score + backtester + metrics: **~2 weeks**;
walk-forward + parameter-sensitivity heatmap: **+1 week**.

**Risks / rigor.** The credibility lives in **avoiding look-ahead bias** and
**including costs + out-of-sample** — say so loudly, or it reads as curve-fitting.
Don't overclaim on tiny synthetic data.

---

### 5. Rigorous adaptive engine — IRT + Glicko + Thompson sampling

**Concept & plug-in.** Replace ad-hoc difficulty heuristics with a
**psychometrically defensible** stack: a **2-parameter IRT** model for learner
ability, **Glicko/Elo** ratings for item difficulty (learner-vs-item as a "match"),
and a **Thompson-sampling / bandit** next-item selector that targets the learner's
zone of proximal development. Upgrades `lib/adaptivity/**` (currently ZPDES review)
and feeds the existing `mastery/reliability.ts` calibration read. Ship it with a
small **offline evaluation** (simulated learners, regret/learning-gain curves).

**Why it's resume-impressive.** This is the **"assessment science done
impressively"** track — and the honest, better-engineered cousin of the calibration
idea. A recruiter (esp. ML/QR-leaning) reads "IRT ability estimation + a
Thompson-sampling scheduler with an offline eval" as real applied-Bayesian/ML
rigor. It also demonstrates you can turn a fuzzy product goal into a measurable
model with an evaluation — a strong signal for research-adjacent roles.

**Technical approach & stack.** Pure TS: 2PL likelihood + MAP/EAP ability update;
Glicko update for items; Thompson sampling over expected information gain; an
offline sim harness (synthetic learners) reporting calibration + learning gain.
Vitest for the estimators (recover known parameters). No new deps.

**Scope.** IRT + Glicko + bandit selector: **~1–1.5 weeks**; offline-eval harness +
write-up: **+few days**.

**Risks / rigor.** Cold-start / identifiability — seed item priors and gate on
minimum-N (the repo already does this well via `MIN_PAIRS`). Keep it invisible-but-
principled; the **offline eval** is what makes it resume-grade rather than a black box.

---

### 6. *(stretch bolt-on)* RL market-maker opponent

**Concept & plug-in.** Train a lightweight RL agent (tabular Q-learning or a tiny
policy-gradient net) as a market maker in the browser, then let the user **race
their manual quotes against the learned policy** on the same stream — a natural
extension of the flagship's engine.

**Why it's resume-impressive.** "I trained an RL agent to make markets and beat my
own hand-tuned spreads" is a memorable ML + trading crossover. Reads as applied-RL
competence tied to a real trading objective.

**Technical approach & stack.** State = (inventory bucket, recent flow, vol regime);
actions = discrete (halfSpread, skew) pairs; reward = per-round P&L − inventory
penalty. Train in a Worker over the existing `liveMarket` simulator; ship a
pre-trained policy table so it loads instantly.

**Scope.** **+1–2 weeks on top of #1.** Best sequenced *after* the flagship ships.

**Risks / rigor.** In-browser RL can feel toy if under-trained — pre-train offline,
show a learning curve, and keep the action space small and well-motivated. Treat as
a follow-on, not a standalone MVP.

---

## 2. Flagship recommendation

**Build #1 — The Trading Floor (real-time adversarial Make-Me-a-Market).**

**Why this one, decisively:**
- **Highest interview signal, by the firms' own weighting.** The market-making
  game is named the *single highest-signal* interview component in the research
  (`FIRM_TIMED_ASSESSMENTS §3`) and in every 2026 firm write-up. Nothing else on
  the list is as directly "this is literally the round they'll put you in."
- **It closes the biggest gap in the current app.** The Trading Desk sims *look*
  like market making but are actually policy-slider toys with a pre-computed P&L
  curve. There is **no round-by-round human decision against an informed
  opponent** anywhere on the site. This adds exactly that.
- **Most leverage from existing code → most achievable.** The adverse-selection
  fill model, two-sided quoting, inventory skew, drawdown, benchmark grading, the
  Brier/reliability math, the Fermi quantity bank, and the Arena timer/leaderboard
  **already exist**. The flagship is mostly *wiring proven pieces into an
  interactive loop* — a 1–2 week core, not a multi-month build.
- **It's three impressive things in one artifact** — a product feature, a trading
  concept (adverse selection / winner's curse), and a probability concept (proper
  scoring / calibration) — which is what makes it read so well on a resume.

Sequence after it ships: **#2 Options Desk** (adds the derivatives pillar the
curriculum lacks), then **#3 LOB** or **#5 adaptive engine** depending on whether
you want to flex *systems* or *ML/stats* next.

---

## 3. Explicit recommendation: replace the Calibration Gym with THIS

**Replace the "Calibration Gym" (idea #1 above).**

The current Gym (per `LandingPage.tsx` and `KNOWLEDGE_GRAPH_CASE_B.md`) is a
`comingSoon` flagship: *submit a probability under a timer → grand reveal → get
scored on calibration vs an AI model.* It's **passive and non-adversarial** — you
state a number and a screen tells you if you were calibrated. That is *not* how any
firm tests calibration. Firms make you **trade your belief against a counterparty
who may know more than you**, and calibration falls out as P&L.

**The replacement, concretely:** keep the goal (train/measure decision quality
under uncertainty) but deliver it through **The Trading Floor**:

- Instead of "type a probability," you **quote a two-sided market** on the quantity
  and an **informed bot trades against you** — so overconfidence is *punished by
  getting picked off*, not by a passive score.
- **Calibration becomes realized P&L via a proper scoring rule.** For 0/1-contract
  rounds, quoting and settling is mathematically a proper scoring rule, so **honest
  probabilities maximize expected P&L** — a rigorous, provable "trading your
  beliefs" mechanic (state the equivalence in the debrief).
- **Reuse the existing calibration engine** (`reliability.ts` Brier/reliability
  diagram, over/under-confidence read) to produce the *same* calibration analytics
  the Gym promised — now backed by real adversarial decisions — plus a
  **Brier/log-loss + P&L leaderboard** on the existing DynamoDB scaffold.
- Optionally keep a lightweight **"90% CI in 60s" estimation drill** (Old Mission-
  style CI elicitation, `FIRM_TIMED_ASSESSMENTS §4 #5`) as an on-ramp that feeds
  the same reliability diagram — so the calibration *measurement* survives, but the
  *training* mechanic upgrades from "guess-and-reveal" to "trade-and-get-picked-off."

Net: same skill, same math backbone, far higher fidelity to what firms test, and it
becomes a genuine portfolio centerpiece instead of a coming-soon placeholder.
