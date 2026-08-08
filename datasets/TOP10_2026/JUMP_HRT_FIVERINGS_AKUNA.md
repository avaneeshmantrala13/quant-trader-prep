# Jump · HRT · Five Rings · Akuna — 2026 Quant-Trader Assessment & Interview Profiles

**Compiled:** 7 Aug 2026 via fresh WebSearch/WebFetch, built on and filling the gaps flagged in
`datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md` (firms 7–10) and `datasets/TOP_FIRMS_2026_DEEP_A.md`.
Prior deep passes on these four hit resource limits and left them at **Medium** confidence; this file pushes them
to concrete 2026 detail with named platforms, current formats, per-firm example archetypes, and inline citations.

**Confidence key.** **High** = firm-official and/or multiple independent 2025–2026 primary reports agree.
**Medium** = consistent across aggregators + some primary confirmation. **Low** = single/old/lead-gen source.
Recency tags inline.

**No-fabrication rule.** Every example is a **public/reported archetype**, paraphrased/generalized so it is not a
proprietary question verbatim. Numeric answers below were computed here and are marked; where a source is thin,
single, or old, it is flagged. No firm publishes a scoring key — treat all counts/timings as **directional shapes**.

**Outdated-format flags up front (read first).**
- **Jump** — the "mass 80-in-8-style math gate" belongs to *European MM shops (Optiver/IMC/Akuna)*, **not Jump**. Jump's
  first technical filter is a **role-specific OA (prob-stats for traders / coding for devs) or a direct trader-led screen**,
  not a giant arithmetic sprint. Two sources disagree on whether an OA exists at all (see §1). **Flag.**
- **HRT** — do **not** picture a market-making trading game as the core: HRT is **coding-first (CodeSignal)**; the
  trader role is closer to a **researcher-with-operational-duties**, and a **separate math stage ships only to
  algo/quant/trader/research lines**, not SWE. **Flag.**
- **Five Rings** — the "4-round, offer-without-superday, ~2022" shape is **outdated**; the current (2026) funnel is a
  **HackerRank ~17–19 Q / <20 min typed-numeric OA → live probability interviews → 2–3-round onsite** with
  market-making sims. **Flag.**
- **Akuna** — the single "80-in-8" description is **incomplete**: 2026 Akuna is **two OA rounds** —
  (1) **math 80/8 + sequences 24/12** *(both must pass)*, then (2) **HackerRank coding + a VidCruiter letter-betting
  video game** — before any human contact. **Flag.**

---

# 1) JUMP TRADING — Confidence: **Medium-High** (process); **Medium** (exact OA shape, sources conflict)

**One-liner.** Chicago HFT/futures house (ex-CME floor DNA); trader loop prizes **raw exact mental-arithmetic speed +
probability depth + genuine futures/market-microstructure intuition**, with an **unusually heavy linear-algebra** streak
for a trading shop.

### Current OA / platform (2026)
- **Two conflicting pictures — flag:**
  - *"There is an OA"* (myntbit, Quantt, Lodely 2026): **60–120 min**, **rapid-fire mental arithmetic (30–60 problems)
    + probability brainteasers**, plus a **coding section for dev/quant-dev tracks**; hosted on **HackerRank or a
    proprietary platform**. Reported clearance **~10–30%** (Quantt: "~10–15% advance"; myntbit: "~20–30%"). [1][2][3]
  - *"Jump generally does NOT use a mass online math test as its first elimination"* (Tradermath 2026) — instead leans on
    **direct trader/quant/engineer-led technical interviews**. [4]
  - **Reconciliation (our read):** an OA exists but is **role-specific and not a giant arithmetic gate** — trader/quant get a
    **prob-stats test (~90–120 min)**, devs get a **hard algorithmic coding set (2–3 problems)**. Do **not** model Jump as an
    Optiver-style 80-in-8. **Confidence Medium.**

### Full interview funnel (2026)
Recruiter screen → **OA (role-specific, above)** → **1–2 technical phone/video screens** (45–60 min, run by working
traders/quants/engineers — *"prepare to defend your reasoning"*) → **Superday: 4–7 back-to-back 45–60 min rounds**,
usually Chicago (also NY/London), **deliberately escalating** (easy rounds first, hardest research/architecture last).
Trader-track standard mix ≈ **2 quant/math rounds** (pen-paper probability, EV games, statistics, **linear algebra**),
**1 coding** (Python/pandas-NumPy for trader/quant; C++ for eng), **1 behavioral/fit**, plus a **trader market-intuition
round**. Some report a post-offer **"team match"** stage. [1][2][3][4]

**Trader-track weighting (Quantt 2026):** ~**35% probability / 30% market intuition / 20% mental math / 15% behavioral**. [1]

### Exact topic checklist (tested)
- [x] **Mental arithmetic** — exact 2-digit×2-digit, division, %, "faster than most can type" (Jump's clearest differentiator). [3][4]
- [x] **Probability / EV** — conditional probability & Bayes, random walks, **Coupon Collector, Gambler's Ruin, Ballot problem**. [3]
- [x] **Combinatorics / counting.**
- [x] **Linear algebra** — explicitly called out as *unusual vs peers* (correlation matrices, OLS for QR). [4] (WSO 2025 first-hand: "LA emphasis other companies don't test.")
- [x] **Statistics** (QR track: OLS, distributions).
- [x] **Market-making intuition** — spread economics + **Bayesian price updating**, **adverse selection** on one-sided flow.
- [x] **Futures/market microstructure** — CME mechanics (ES futures vs S&P ETF, front- vs back-month spreads, settlement/clearing), **options basics/Greeks, hedging, variance-swap construction**. [2][4]
- [x] **Market-event reasoning** — Aug-2007 quant crisis, May-2010 flash crash, 2020 oil-futures collapse: what they reveal about structure. [1][2]
- [x] **Coding** — Python (trader/quant) / C++ (eng): streaming DS, heaps, DP, numerical methods.
- [ ] Sequences/pattern tests — **not** a Jump signature (that's Optiver/Akuna).

### Representative public archetypes (difficulty + traps)
- **[warm-up, Bayes]** *100 coins: 99 fair, 1 double-headed. Pick one at random, flip 10× → all heads. P(you hold the
  double-headed one)?* → `0.01 / (0.01 + 0.99·(1/1024)) ≈ **0.912**` (computed). **Trap:** answering 1/100 (ignoring the
  strong likelihood update) or 1 (ignoring the fair-coin path). [1]
- **[core, EV/number-theory]** *Given a fair 6-sided die, generate an event of probability exactly 1/7.* Roll twice → 36
  outcomes; keep 35 (discard one), map to 7 groups of 5; **reject-and-repeat**. **Trap:** trying to do it in finitely-bounded
  rolls (you can't — it's a geometric/rejection scheme). [5]
- **[core, market-making]** *Show a bid/ask for a security you believe is worth **\$48–\$52 with 80% confidence**; then
  update your market after each trade in a sequential-information game.* Width should track the CI; skew on flow. [3]
- **[core, adverse selection]** *You quote a tight spread; a flurry of one-sided buys lifts your offer — what do you do and
  why?* → **raise your ask / widen / skew up**; the flow is *information* (you're being picked off), not noise. [1]
- **[trader-specific, microstructure]** *How does the CME **ES** future differ from an S&P 500 **ETF** in trading dynamics?*
  / *Make a market on front-month **crude**.* / *Hedge a **CME 10-yr Treasury futures** position with cash bonds.* [2]
- **Hardest end:** the *escalating* Superday research/EV rounds + **linear-algebra** items under time (the LA is the
  surprise filter); genuine futures-microstructure depth is a de-facto "why Jump" gate.
- **Warm-ups:** the mental-arithmetic check and a first conditional-probability brainteaser.

**Sources (Jump).**
[1] Quantt *Jump Trading Interview* (2026, Medium) — funnel, 35/30/20/15 split, 100-coin Bayes, adverse-selection Q, "team match."
[2] techinterview.org *Jump Trading Interview Guide 2026* (Medium) — CME ES-vs-ETF, make-a-market on crude, 10-yr hedge, escalating Superday.
[3] myntbit *Jump Trading Quant Interview* (2026, Low-Medium) — OA 30–60 mental-arithmetic + prob, ~20–30% clearance, \$48–\$52 market, sequential-info updating.
[4] Tradermath *Jump Trading Interview Guide* (2026, Medium) — "**no mass online math gate**," LA emphasis, 4× 45–60 min onsite, Python/C++ split, variance-swap.
[5] dataloopr *Jump Trading Quant Interview* (Dec 2025, Low) — 1/7-from-a-die construction, waiting-time patterns. WSO *Jump* entries (2025, Low-Med) — LA-heavy, superday = 2 math + 1 coding + 1 behavioral.

---

# 2) HUDSON RIVER TRADING (HRT) — Confidence: **Medium-High** (coding-first shape); **Medium** (trader-math specifics)

**One-liner.** **Coding-first** NY HFT/market-maker; the "trader" is effectively a **researcher with operational
responsibilities** (trading is automated), so **market-making games are less central** and the signature is
**clean fast code + elegant probability (symmetry / linearity of expectation) + derive-then-simulate**.

### Current OA / platform (2026)
- **Stage 1 — CodeSignal General Coding Assessment: ~70 min, 4 questions** (increasing difficulty), Python/C++/Java
  (Python recommended). Bias toward **simulation & time-series / step-functions / interval-merge / heaps / sliding
  windows / hashmaps**, **not** LeetCode-trick puzzles and **not** probability. **Pass bar ≈ 500/600** (some algo-dev/SWE
  teams want **560+**; QR expects near-perfect + bonus). Some roles get a **3-problem / 150-min** variant. [1][2][5]
- **Stage 2 — Math/probability stage: ships ONLY to Algo / Quant Trader / Research lines** (SWE skips it):
  **8–12 multiple-choice in ~60 min** (Quant Trader: reported up to **90 min**); **no derivations — pick the answer**. [1][2]
- **Rule of thumb:** if the JD/recruiter email says *quant / algo / trader / research* → expect the math stage. [1]

### Full interview funnel (2026)
CodeSignal OA (filters before any human contact) → recruiter screen (30 min) → **1–2 technical phone screens** (45–60
min; CoderPad live coding + systems; **algo-dev/trader adds probability**) → **virtual/onsite: 4–6 back-to-back rounds**
(coding + systems/low-latency for eng; **probability + research/EV games + data analysis** for quant/trader) →
recruiter/fit interleaved. [2][3]

### Exact topic checklist (tested)
- [x] **Algorithmic coding** (the gate) — simulation, order-book/order-matching, time-series rolling metrics
  (rolling median/mean, VWAP, z-score via single-pass/Welford), step-functions, precision/overflow, `O(n)`–`O(n log n)`. [1][5]
- [x] **Expected value & linearity of expectation** (HRT rewards the elegant LoE/symmetry setup over brute force). [3][4]
- [x] **Conditional probability & Bayes.**
- [x] **Order statistics** — e.g. *E[max of three iid U[0,1]] = 3/4* (computed). [1]
- [x] **Geometric probability** — the canonical **Romeo-&-Juliet** meeting problem. [3]
- [x] **Combinatorics** — N distinct balls into K boxes, **derangements**, **lattice-path counting**. [1]
- [x] **Markov processes / random walks** (incl. Gambler's-Ruin variants with barriers). [3][4]
- [x] **Waiting times** — expected flips until N consecutive heads. [1]
- [x] **Number theory / bit-tricks** (algo-dev flavor) — modular inverse / Fermat's little theorem, sorting networks. [1]
- [x] **Derive-then-simulate** — solve the EV problem, then **write code to validate it** (HRT's signature loop). [3]
- [ ] Live "trade-against-your-quote" market-making — **present but not central** (some pricing games get picked off). [4]

### Representative public archetypes (difficulty + traps)
- **[core, geometric prob]** *Romeo and Juliet each arrive uniformly in [0,1] hr; first waits 15 min then leaves.
  P(they meet)?* → area of `|x−y| ≤ 1/4` on the unit square `= 1 − (3/4)² = **7/16**` (computed). **Trap:** treating it as
  1-D or forgetting to square the complement. [3]
- **[core, order stats]** *Three iid U[0,1] draws — E[max]?* → `n/(n+1) = **3/4**` (computed). **Trap:** guessing 1/2 or 2/3.
- **[core, waiting time]** *Expected flips to see N heads in a row?* (fair coin: `2^{N+1}−2`; e.g. N=2 → **6**, computed). [1]
- **[warm-up→trap, conditional]** **Monty-Hall variants** (multi-door / multi-reveal) — tests whether you re-derive rather
  than pattern-match "switch." [1]
- **[coding gate, Q3 pitfall]** step-function / interval-merge / difference-array item where **the naïve `O(n²)` TLEs on
  `n ≤ 10⁵`** — the whole point is the `O(n log n)` (or difference-array `O(n)`) insight. [5]
- **Hardest end:** CodeSignal **Q4** (time-series + heap/binary-search/segment-tree under the clock) and the QR-line
  **math + derivation** stage; the *derive-and-code-to-check* combined rounds.
- **Warm-ups:** CodeSignal Q1 (basic simulation/strings) and a single green-book EV/Bayes MCQ.

**Sources (HRT).**
[1] OA VO Service *HRT OA Comprehensive Three-Stage Guide* (2025/26, Low-Med) — CodeSignal + **math 8–12 MCQ/60min (Trader 90min), MCQ-only no derivations**, topic list (max-of-3-uniform, Monty-Hall, balls-in-boxes, derangements, lattice paths, Fermat), role→stage table.
[2] SpaceComplexity *HRT Phone Screen* (2026, Low-Med) — CodeSignal 4Q/70min (some 3Q/150min), algo-dev adds EV/Bayes/order-stats, onsite 4–6 rounds.
[3] Tradermath *HRT Interview Guide* (2026, Medium) — **Romeo-&-Juliet 7/16**, green-book emphasis, derive-then-simulate, Markov/EV under pressure.
[4] myntbit *HRT Interview Guide 2026* (Low-Med) — "deepest section is probability/combinatorics; rewards symmetry & linearity of expectation," novel puzzles, less mechanical.
[5] OA VO Service *HRT OA 2026 CodeSignal Guide* (Low-Med) — 70min/4Q, pass ≥500/600, time-series/heap/step-function focus, **no probability on the coding OA**, Q3 `O(n²)` TLE trap.

---

# 3) FIVE RINGS — Confidence: **Medium-High** (OA format well-corroborated); **Medium** (exact question set)

**One-liner.** Small NY prop firm with (reputationally) the **hardest, shortest math screen in trading** — a
**~17–19-question, sub-20-minute typed-numeric HackerRank sprint**; downstream is **Jane-Street-like** deep probability
under time pressure with **olympiad-flavored** creativity.

### Current OA / platform (2026)
- **HackerRank, proctored: ~15–20 (commonly 17–19) open-ended questions in a little under 20 minutes** (~**60–75 s/Q**),
  **no calculator**, **one question at a time**, **visible countdown**, **no multiple choice** — **typed numeric answers**
  (accuracy to **2nd decimal** or **nearest integer**). Results in a few days → live probability interviews. [1][2]
- *(Outdated to avoid: the ~2022 "4 rounds, offer without superday" WSO shape.)* **Flag.**

### Full interview funnel (2026)
OA (single, highly selective — most candidates filtered here) → **live probability interview(s)** (a recruiter/HR-run
first round with **~10–15 rapid-fire stats/probability questions, 20–90 s each**; reasoning-out-loud valued over exactness
when time is short) → **1–2 technical phone screens** (probability, combinatorics, mathematical reasoning; process &
communication graded, not just the number) → **onsite, 2–3 rounds**: deep math, coding, **market-making simulations**,
behavioral. **~4–5 rounds over 4–8 weeks.** [1][3]

### Exact topic checklist (tested)
- [x] **Probability & combinatorics** — coin/dice/urn models, binomial, inclusion-exclusion, surjective counting. [1]
- [x] **Expected value** — multi-step EV, careful conditioning; **sanity-check with simple/limiting cases**. [3]
- [x] **Continuous probability / geometry** — dart-on-a-disk expected distance, **arc-length integrals**, area/geometry. [2][4]
- [x] **Estimation / Fermi** — items **designed so they can't be solved exactly**; build a fast simplified model, spot shortcuts. [1]
- [x] **Mental math** under a brutal per-question clock (typed, no calculator). [1]
- [x] **Markov chains** (tricky **absorbing states**) and random walks. [3]
- [x] **Game theory / optimal strategy** — bidding games, "find the optimal strategy" scenarios. [3][4]
- [x] **Bayes / conditional probability.** [3]
- [x] **Logs / integrals / light calculus.** [2]
- [x] **Brainteasers.** [2]

### Representative public archetypes (difficulty + traps)
- **[warm-up, binomial]** *Roll six 6-sided dice — P(exactly 4 are odd)?* → `C(6,4)·(1/2)^6 = 15/64 ≈ **0.234**` (computed).
  **Trap:** using 4/6 as the per-die odd prob (it's 1/2), or forgetting the binomial coefficient. [1]
- **[core, surjective counting]** *Arrange 5 distinct books on 3 shelves (order on a shelf irrelevant) with **no shelf empty**?*
  → surjections `3^5 − 3·2^5 + 3·1^5 = 243 − 96 + 3 = **150**` (computed). **Trap:** answering **243** (`3^5`, forgetting the
  no-empty constraint) — a classic inclusion-exclusion miss. [1]
- **[core, continuous]** *Dart lands uniformly on a unit disk — E[distance from center]?* → `∫₀¹ r·2r dr = **2/3**` (computed).
  **Trap:** answering 1/2 (radius is *not* uniform; density `∝ r`). [4]
- **[core, hypergeometric]** *Raffle of 80 tickets, 3 win; you buy 5 — P(exactly one win)?* →
  `C(3,1)·C(77,4)/C(80,5) ≈ **0.167**` (computed). **Trap:** treating draws as independent (binomial) instead of hypergeometric. [1][5]
- **[core, game-theoretic bidding]** *A price is uniform on \$0–\$1000; you bid, win it (paying your bid) iff bid ≥ price; a
  friend then buys it from you at **1.5×** price. Optimal bid?* — the **winner's-curse / conditional-expectation** trap:
  conditioning on winning lowers the expected value, so the naïve "bid = 1.5× expected price" **loses money**. [5]
- **[estimation]** *Arc length of a given curve* / Fermi items *"designed to be unsolvable exactly"* — model fast, avoid
  arithmetic rabbit holes. [1][2]
- **Hardest end:** the **olympiad-flavored** combinatorics/game-theory items and **Markov chains with awkward absorbing
  states**, all under the ~60–75 s/Q clock; the interview's 20–90 s rapid-fire stats round.
- **Warm-ups:** a clean binomial (six-dice) or a single conditional-probability item.

**Sources (Five Rings).**
[1] Aptitude-Test-Prep *Five Rings Trader OA — Guide + Samples* (2026, Medium) — HackerRank 15–20 (17–19) Q / <20 min, typed numeric, no calc, one-at-a-time; six-dice-exactly-4-odd, books-on-shelves, arc-length, "designed unsolvable exactly."
[2] everythingquant forum thread (2025, Low-Med) — first-hand topic list: "estimation, integrals (arc length), expected value, logs, geometry, brainteasers."
[3] Quant Blueprint *Get a Job at Five Rings 2026* (Medium) — 4–5 rounds/4–8 wks, olympiad-style combinatorics/game-theory/number-theory, Markov with absorbing states, "sanity-check with limiting cases," generating functions/inclusion-exclusion/recursion.
[4] dataloopr *Top Five Rings Quant Questions* (Jul 2026, Low) — dart-expected-distance-from-center (2/3) worked example.
[5] mfshi03 quant-resources compilation (Low, older but representative) — raffle "80 tickets, 3 win, buy 5, P(exactly one)"; treasure-chest bidding (winner's-curse, friend buys at 1.5×); matching-socks expected draws. WSO *Five Rings* (~2022, Low) — flagged as **outdated** process shape.

---

# 4) AKUNA CAPITAL — Confidence: **Medium-High** (OA/game formats corroborated across sources)

**One-liner.** Chicago **options** market-maker with a **12-week trader training program** → it screens for **raw aptitude**,
not existing knowledge. Distinctive **two-round OA front-loaded with speed gates** (math + **sequences/pattern**), a
signature **VidCruiter letter-betting video game**, and a **PnL-ranked group trading game** as the decisive Superday round.

### Current OA / platform (2026)
- **Stage 1 (first OA) — must pass BOTH: [1][2]**
  - **Mental math: 80 questions / 8 minutes** (~**6 s/Q**), **not multiple choice**, **click-submit to advance** (navigation is
    on the clock); large-number multiply/divide. *(Distinct from Optiver's 80/8 in question style.)*
  - **Sequences: 24 questions / 12 minutes** (~**30 s/Q**) — **"not just numerical"**: numbers, **letters**, and other logical
    patterns. *(One Dec-2025 first-hand report saw a **30 Q / 16 min** sequences variant — treat count/timing as directional. Flag.)*
- **Stage 2 (secondary OA): [1][2]**
  - **HackerRank coding test** — **~70 min, 4–5 items** mixing **LC-easy/medium coding (order-book / simulation)** + **2
    probability/math MCQs** + a scenario. [6]
  - **VidCruiter video "betting game"** (the unusual filter) — see below.
- **Stage 3:** short **recorded behavioral video** (randomly sampled questions).

### The VidCruiter letter-betting game (signature)
A **26-letter grid split into two columns with fixed pairings** (row 1: **A–N**, row 2: **B–O**, … row 13: **M–Z**), **~18–20
individually-timed questions**. A **winning row is drawn at random**; you **price/compare single and paired letter bets** and
pick the **highest-EV wager**. Bet notation like **"+a −o"**: **"+a"** wins if the final outcome is **above** the value
associated with `a`, **"−o"** wins if **below** the value associated with `o`. Core skill = **read the rule fast, compute
expected payout from grid positions, pick the +EV bet** — and *"don't get fooled by a grid that sometimes lies."* [2][4][5]

### Full interview funnel (2026)
Stage 1 OA (math+sequences) → Stage 2 OA (coding + VidCruiter) → recorded behavioral video → **technical phone interview**
(trader): brainteasers, **market-making**, probability, **basic derivatives** → **Final / Super Day** (Chicago or virtual):
multiple back-to-back rounds + the **group trading game** (5–6 candidates, ~30 min, market-make on a hidden asset,
**PnL-ranked**) + lunch/behavioral. **Strong OA + weak trading game ≈ ~70% rejection.** [1][2][3][6]

### Exact topic checklist (tested)
- [x] **Mental math** (80/8 speed gate). [1][2]
- [x] **Sequences / pattern recognition** — numeric **and** letter/logical (Akuna-signature, alongside Optiver). [1][2]
- [x] **Expected value & bet pricing** — dice/cards/coins; "what would you pay to play?" [5][6]
- [x] **Make-a-market / market-making intuition** — spread around EV, inventory control, Bayesian update on flow. [3][6]
- [x] **Order statistics** — *median of three dice* market (EV **3.5** by symmetry). [FIRM_INTERVIEW_LIVE_RESEARCH_2026 §8]
- [x] **Conditional probability / Bayes.** [5]
- [x] **Combinatorics.** [5]
- [x] **Confidence → stake sizing** — "how much would you pay/bet given your confidence?" (bet size should track edge). [5]
- [x] **Basic derivatives / options** (phone round; light — training teaches the rest). [3]
- [x] **Coding** — order-book/simulation, LC easy-med + probability MCQ (Stage-2 OA). [6]
- [x] **Rule-adaptation under pressure** (VidCruiter: parse a novel payoff rule and act in seconds). [2][4]

### Representative public archetypes (difficulty + traps)
- **[warm-up, order stat MM]** *I roll three dice and pay you the **median** — make a market.* → E[median of 3 dice] = **3.5**
  by symmetry → quote ~"3 at 4." **Trap:** quoting around the **mean of the max/min** or over-widening; median is symmetric,
  unlike max/min. [FIRM_INTERVIEW_LIVE_RESEARCH_2026 §8]
- **[core, group market-making]** *Hidden asset = sum of dice / value of cards; quote two-sided; others hit/lift; PnL-ranked.*
  Compute EV, quote a **narrow spread** (too wide → no fills; too tight → arbitraged), **push your bid down when hit
  repeatedly** (inventory), **update Bayesian on aggressive flow**. **Trap:** stubbornly holding inventory / chasing price. [1][3]
- **[core, confidence→stake]** *"Assume the fair value settles inside your market; I'll pay you \$x — how much would you pay
  to play?"* — the number must **track your confidence/edge**, not gut. **Trap:** flat over/under-betting regardless of edge. [5]
- **[signature, VidCruiter]** *Given the A–N…M–Z grid and a randomly-drawn winning row, choose the highest-EV bet (e.g.
  "+a −o").* **Trap:** misreading the direction of "+"/"−" or ignoring that paired bets change the payoff geometry;
  "the grid sometimes lies." [2][4]
- **[EV bet]** *A bet pays big-to-lose-small at probability p — take it? size it?* (green-book style, options-flavored:
  "expected payoff of this position / P(expiring ITM)"). [5]
- **Hardest end:** the **PnL-ranked group trading game** (social + inventory + Bayesian updating simultaneously) and the
  **VidCruiter** novel-rule game under per-question clocks.
- **Warm-ups:** the 80/8 arithmetic and a simple make-a-market (median-of-dice).

**Sources (Akuna).**
[1] tradinginterview.com *Akuna Capital Online Assessment* (2026, Medium) — Stage-1 math 80/8 + sequences 24/12 (**both must pass**), Stage-2 coding + VidCruiter, "not just numerical" sequences.
[2] Tradermath *Akuna Capital Interview Guide* + *Akuna VidCruiter Practice* (2026, Medium) — 5-stage loop; **6 s/Q math, 30 s/Q sequences**; **A–N…M–Z 13-row grid, ~18 timed Qs, "+/−" bet rules, "grid that sometimes lies."**
[3] OA VO Service *Akuna Super Day Trading Game Full Loop* (2025/26, Low-Med) — 5–6/group, 30 min, PnL-ranked, narrow-spread + inventory + Bayesian-update coaching; **strong OA + weak game ≈ 70% reject.**
[4] Tradermath *Akuna VidCruiter Practice* (2026, Low-Med) — 13-row letter grid, 18 timed questions, single & paired bets vs a winning row.
[5] Quant Blueprint *Get a Job at Akuna 2026* (Medium) + programhelp *Akuna 2026 walk-through* (Low) — dice/cards/coins EV, Bayes, "what would you pay to play?" confidence→stake, options-payoff/ITM framing.
[6] OA VO Service *Akuna Intern OA 2026 HackerRank Guide* (2025/26, Low-Med) — Stage-2 coding **70 min / 4–5 items (coding + prob MCQ + scenario)**, order-book/simulation, Super Day trading game as the real filter. dev.to (net_programhelp) *Akuna Trading Intern OA* (Dec 2025, Low) — first-hand: 80/8 math, **30 sequences/16 min** variant, letter-grid "+a −o" strategy-selection game.

---

# CONSOLIDATED TOPIC CHECKLIST (all four firms)

Legend per cell: **●** = core/tested-hard · **○** = present/secondary · **–** = not a signature.

| Topic | Jump | HRT | Five Rings | Akuna |
|---|:--:|:--:|:--:|:--:|
| Mental math (fast exact arithmetic) | ● | ○ | ● (typed) | ● (80/8) |
| Sequences / pattern recognition | – | – | ○ | ● (24/12, "not just numeric") |
| Probability & EV (conditional, Bayes) | ● | ● | ● | ● |
| Combinatorics / counting | ○ | ● | ● | ○ |
| Order statistics (max/min/median) | ○ | ● | ○ | ● (median-of-dice MM) |
| Markov chains / random walks | ○ | ● | ● (absorbing states) | ○ |
| Waiting times (coupon collector, N-in-a-row, gambler's ruin) | ● | ● | ○ | ○ |
| Geometric / continuous probability | ○ | ● (Romeo & Juliet) | ● (dart, arc length) | – |
| Estimation / Fermi | ○ | ○ | ● ("unsolvable exactly") | ○ |
| Game theory / optimal strategy | ○ | ○ | ● | ○ (VidCruiter) |
| Betting / Kelly / confidence→stake | ○ | – | ● (bidding, winner's curse) | ● (pay-to-play) |
| Market-making intuition (spread, inventory, adverse selection) | ● | ○ | ● (onsite sim) | ● (group game) |
| Bayesian updating on order flow | ● | ○ | ○ | ● |
| Linear algebra / statistics | ● (LA-heavy) | ○ (QR) | ○ | – |
| Options / derivatives / Greeks | ○ (futures/vol) | – | – | ○ (basic; trained) |
| Futures / market microstructure | ● (CME) | ○ | – | – |
| Market-event reasoning (2008/2010/2020) | ● | – | – | – |
| Coding / algorithms | ● (Py/C++) | ● (CodeSignal gate) | ○ (onsite) | ○ (Stage-2 OA) |
| Derive-then-simulate | ○ | ● (signature) | ○ | – |
| Brainteasers | ● | ● | ● | ● |

**Platform / format one-liners (name the current, flag the outdated):**
- **Jump** — role-specific OA (prob-stats ~90–120 min for traders / hard coding for devs) on **HackerRank or proprietary**;
  **not** an Optiver-style mass arithmetic gate. Superday 4–7 escalating rounds. *(Sources conflict on whether an OA exists — flag.)*
- **HRT** — **CodeSignal** GCA (70 min / 4 Q, pass ≈500/600) as the universal gate; **separate 8–12-MCQ / 60–90-min math stage
  only for algo/quant/trader/research**. Trader ≈ researcher-with-ops; MM game secondary.
- **Five Rings** — **HackerRank** ~17–19 typed-numeric Q / <20 min, no calculator, one-at-a-time — the shortest, hardest math
  screen; then JS-like live probability + 2–3-round onsite with MM sims. *(2022 "no-superday" shape is outdated — flag.)*
- **Akuna** — **two OA rounds**: (1) **80/8 math + 24/12 sequences** *(pass both)*; (2) **HackerRank coding + VidCruiter
  letter-betting game**; then behavioral video → trader phone → **PnL-ranked group trading game** Superday.

**Difficulty calibration vs the house anchor** (from `TOP_FIRMS_2026_DEEP_A.md`: two-walk lattice-meeting ≈ 0.799): Five
Rings' olympiad-combinatorics/absorbing-Markov items and Jump's escalating EV+LA rounds sit **at or above** the anchor;
HRT's elegant LoE/geometric-probability and Akuna's group-game Bayesian updating sit **at** it; the speed gates (Akuna 80/8,
Five Rings typed sprint, Jump arithmetic) are **orthogonal** — calibrated on *throughput/accuracy under a clock*, not depth.

**Cross-check status.** All four *process shapes* are corroborated by ≥2 independent 2025–2026 sources (Jump: 4 guides + WSO
2025; HRT: CodeSignal specifics across 3 sources + green-book examples; Five Rings: OA format across 2 primary + samples;
Akuna: two-OA + VidCruiter + group-game across 4 sources incl. a Dec-2025 first-hand). **Exact counts/timings/cutoffs are
directional (vendor-recycled) and labeled.** Every numeric answer above (0.912, 1/7 scheme, 7/16, 3/4, 15/64, 150, 2/3,
0.167, median 3.5) was **computed in this pass**, independent of any source.
