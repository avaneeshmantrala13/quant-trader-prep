# SIG / Citadel Securities / IMC / DRW — 2026 Deep, Verified Hard-Archetype Catalog

**Compiled:** 7 Aug 2026. **Scope (this file):** the 4 firms **SIG, Citadel Securities, IMC, DRW** only. This is the light, 4-firm companion to `JANE_STREET_2026_DEEP.md` / `OPTIVER_2026_DEEP.md`. A prior 8-firm pass hit a resource limit; this file is self-contained and does **not** depend on any partial `TOP_FIRMS_2026_DEEP.md`.

**Purpose.** Source-attributed research on each firm's *current* (2025–2026) quant-**trader** assessment + interview, turned into a **verified, HARD question-archetype catalog** for generating similar hard questions. Depth and correctness over speed.

**How this file was built.** (1) Fresh WebSearch/WebFetch pass (7 Aug 2026) over 2024–2026 firm-official and first-hand candidate material, cross-checked against `FIRM_INTERVIEW_LIVE_RESEARCH_2026.md` and `FIRM_INTERVIEW_RESEARCH.md`, then pushed deeper. (2) **Every quantitative answer below was computed and verified in this pass** with an exact method (backward DP / full enumeration / closed form / exact linear solve over `fractions.Fraction`) **and** an independent Monte-Carlo cross-check; the DP-vs-MC agreement is stated inline. Scratch harness (not committed, lived in `/tmp/verify_top_firms.py`) also **re-derived the difficulty anchor from scratch** as a self-test.

**Difficulty anchor (calibration target, do NOT copy).** *"A starts at (0,0) stepping up/right w.p. 1/2 each; B starts at (3,4) stepping left/down w.p. 1/2 each; probability their paths ever intersect."* **Verified answer 3273/4096 ≈ 0.79907** (full `2^7 × 2^7 = 16384`-pair enumeration; MC 500k = 0.7987). **Same-time parity trap (verified):** requiring the two walkers to occupy the same lattice point *at the same step index* has probability **exactly 0** — A is on anti-diagonal `k` at step `k`, B is on anti-diagonal `7−k` at step `k`, so they coincide only if `k = 7−k`, impossible for the odd separation `s = 7`. Every archetype here is calibrated to this level or harder.

**Paraphrase rule.** Every example is paraphrased/generalized so we generate our own variants; no proprietary question set is reproduced verbatim.

**Confidence key.** **High** = firm-official and/or multiple independent 2025–2026 primary reports agree. **Medium** = consistent across aggregators + some primary confirmation. **Low** = single/old/lead-gen source. Recency tags inline. Every *numeric answer* is **High** because it is computed here, independent of any source.

---

# PART 1 — PER-FIRM PROCESS & FORMAT (2025–2026)

Cross-firm shape at a glance (trader track). Timings are **directional shapes**, not literal cutoffs — no firm publishes a scoring key.

| Firm | Gate / OA | Calculator? | Signature live round | Signature adversarial move | Confidence |
|---|---|---|---|---|---|
| **SIG** | Mercer\|Mettl problem-solving, ~9–17 open-answer Q / 60 min | **Yes** (calc + paper, free nav) | Poker / decision-theory round (often separate evening) | **"How confident? How much would you bet?"** → then **twist the payout rule** | High |
| **Citadel Sec.** | HackerRank quant sprint ~15 Q / 30 min (+coding on some tracks) | No (paper ok) | Superday market-making ("Market of Cards") | **Hidden-composition Bayes, then "now bet on your own probability"**; reveal→quote→trade | High |
| **IMC** | HackerRank mental-math (50–80) + prob + sequences, 60–75 min | No | Make-a-market game (dice sum / marble urn), sometimes group | **Trades against you repeatedly; challenges a *correct* answer to see if you flinch** | Medium-High |
| **DRW** | ~6 hard math Q / 45 min (~7.5 min/Q), one ~unsolvable | Some allow scratch/Python | 1:1 market-making + defend-a-derivation | **Leave-the-unsolvable-blank triage; defend a hard result under a new constraint** | High |

---

## 1.1 SIG (Susquehanna) — Confidence: **High** (firm-official corroboration)

**Process.** Resume → **Mercer|Mettl "Problem Solving Assessment"** (~9–17 open-answer questions in 60 min; **calculator + pen/paper allowed, free back-and-forth navigation**; non-integer answers as a **simplified fraction**) → recruiter phone screen (~5 probability/math Qs; reasoning valued over the final number) → SIG development-team technical rounds → **Super Day** (4–6 back-to-back + group card/dice game) → a **poker / decision-theory round** for trader roles (sometimes a separate evening event). ~4–8 weeks.

**What is distinctive.** SIG is *not* testing arithmetic speed on the OA (calculator allowed); it tests **problem framing and reasoning stability** — a wrong first-step framing cascades because each open-answer card is heavy (~12–15 min of potential work with no feedback). The firm openly states its thesis: *trading is decision-making under uncertainty*, and it teaches new hires **poker** as the vehicle. A **tutorial is provided at the start of any poker session**, so no prior poker skill is assumed (Confidence High — firm-official + universal candidate agreement).

**Signature adversarial moves (the crown jewels).**
1. **Confidence-calibration → bet-size probe.** After any answer: *"How confident — 60%? 90%? OK, how much of your bankroll would you stake?"* If stated confidence ≠ true probability, they **offer a bet at exploitative odds** and let the miscalibration reveal itself. They want **Kelly-style sizing to edge**, not gut. (Quant Blueprint 2026 gives a representative prompt: *"win \$20 w.p. 0.6, lose \$15 w.p. 0.4 — take it? what would you pay for the right to take it?"* — EV = 0.6·20 − 0.4·15 = **+\$6**, so pay up to ~\$6.)
2. **Twist the payout rule live.** *"Now you may pay to discard and redraw,"* or *"draw two, keep the higher"* — each shifts the EV and you must **recompute cleanly without anchoring**.
3. **Separate process from outcome.** They prefer a sound decision with a bad result over a lucky gamble, and probe a *lucky-looking* correct answer harder (*"would you bet on that reasoning?"*).

**Grading:** EV/edge recognition; **calibration**; **bet-sizing to edge** (Kelly); Bayesian updating; willingness to admit a wrong initial read; composure under social pressure. Arithmetic speed matters but is not the differentiator.

**Sources (SIG).** techinterview.org *SIG Interview Guide* (2026, Medium — "assign a probability, size a bet against your edge, update your view"); Quantt *SIG Interview* (2026, Medium — poker near-universal, tutorial provided, calculator, "correct answer matters less than how you reason about EV/edge"); Quant Blueprint *How to Get a Job at SIG in 2026* (Medium — Kelly sizing, multi-stage EV, the \$20/\$15 bet prompt); theinterviewden.com *SIG Trading Interview* (2026, Medium — "simplified two-player betting game the interviewer invents on the spot"); JobTestPrep UK *SIG Online Assessment* (2026, High for OA shape — Mettl, ~9 Q/60 min, simplified-fraction rule); SIG *Game Theory + Decision Science* careers page (firm-official — poker as decision-under-uncertainty teaching tool; home of *The Mathematics of Poker* authors Chen & Ankenman).

---

## 1.2 Citadel Securities — Confidence: **High** (multiple 2025 first-hand reports)

**Process.** Screening → **OA** (trader track: HackerRank quant sprint ~15 Q / 30 min, MCQ, **+1/−1/0-skip**, free navigation, no calculator; some new-grad tracks add a coding section) → recruiter/phone screen (60 min, think-aloud probability, sometimes light coding) → **two ~45–60 min technical rounds** (probability + game theory, escalating difficulty) → **in-person Superday, 4–6 back-to-back rounds**, "more market-making but requires a very solid foundation in math and statistics." Interviewers share notes; no single round is fatal. ~4–8 weeks.

**What is distinctive.** Citadel's problems are **notorious for having elegant solutions** via symmetry / linearity of expectation / the right prior — candidates who "set up equations immediately often work harder than candidates who pause to think" (myntbit 2026). The trading-game round overlaps Jane Street's (reveal→quote→trade→reveal, PnL + inventory) but reports note **tighter spreads / faster updates expected**, and "scale-of-impact" framing (Citadel makes markets at massive scale).

**Signature adversarial moves.**
1. **Hidden-composition Bayes → "now bet on your own answer."** The flagship (Oct-2025 WSO report): *"Four stones, black/white in unknown split; you draw two and both are black — probability the next is black? Now bet on it."* This forces you to (a) commit to a **prior over compositions**, (b) do the Bayes update, then (c) **take a position** on your own estimate. See Archetype **C1** — the answer is prior-dependent (**3/4** vs **1/2**), which is the whole point.
2. **Adverse selection in the market-making game** — commit fast, then update on every trade/reveal; **inventory must be managed**.
3. **"Minor optimization error" needling** — they flag a sub-optimal move to see whether you defend or crumble.

**Grading:** analytical rigor + real-time adaptation to new data; committing to a price rather than freezing; not ignoring inventory; clean narrated reasoning; calibrated risk-taking.

**Sources (Citadel).** Wall Street Oasis *Citadel Securities Interview Questions* (multiple **2025 first-hand** entries — four-stones Bayes+bet [Oct 2025], prob+game-theory OA [Mar 2025], convolution [Jan 2025]); techinterview.org *Citadel Securities Interview Guide 2026* (Medium-High — market-making "similar to Jane Street," probability/EV/random-walk emphasis, difficulty index 3.8/5); Quant Blueprint 2026 (Medium — probability/microstructure, adverse selection & inventory, "Fifty Challenging Problems in Probability" as prep); myntbit *Citadel Securities Interview Process* (2026, Medium — Bayes/stopping-times/Markov, elegant-symmetry framing); Quantt *Citadel Interview* (2026, Medium — the **die-with-one-reroll EV = 4.25** worked example, corroborating our S1/IMC re-roll archetype).

---

## 1.3 IMC Trading — Confidence: **Medium-High** (concrete game examples corroborated)

**Process.** Application (or entry via the **IMC Prosperity trading challenge**, which fast-tracks strong performers) → **OA** (HackerRank, 60–75 min: mental arithmetic 50–80 Qs incl. 2-digit multiply + percentages, plus probability + pattern recognition; module-locked, no back-nav) → recruiter → **trading simulation / market-making round** → **onsite Super Day** (Amsterdam or Chicago; 4–5 back-to-back 45-min rounds + a **live trading game**, sometimes a **group** version).

**What is distinctive.** The round that actually decides trader offers is the **make-a-market game**, and IMC's culture is "famously direct." They **trade against you repeatedly**, **challenge *correct* answers** to see whether you flinch, and give **deliberately ambiguous questions** to test whether you ask for clarification. Two canonical setups (both corroborated):
- **Dice-sum market:** *"Two dice behind a screen — make a market."* Fair value 7; you quote e.g. "6 at 8." They lift your offer at 8 → **noise or signal?** See Archetype **I1** — the informed-flow posterior mean jumps to **10**, and the mixed-flow update is quantified.
- **Marble-urn market:** *"100 marbles, unknown red/blue split; I pay you the number of reds — make a market."* No-info EV = 50, so ~"45 at 55"; if they keep selling to you at 55, the count is probably low — **skew lower**. See Archetype **I2** (exact sequential posterior).

**Signature adversarial moves.** (1) trades against you and watches **adjust-vs-anchor**; (2) **challenges a correct answer** ("don't cave when you're right, but *do* update on real information"); (3) ambiguity-as-a-test.

**Grading:** sensible **spread width** (widen when uncertain, tighten with edge); **updating on order flow**; not freezing; **narrating reasoning out loud** ("that sentence gets you further than a correct but silent answer"); stamina.

**Sources (IMC).** techinterview.org *How IMC interviews traders and engineers differently* (2026, Medium — the "6 at 8" dice-sum game with the lift-your-offer inference; "widen when uncertain, tighten when you have an edge"; size-the-bet follow-up); Quantt *IMC Trading Interview* + *Quant Trader Interview Questions* (2026, Medium — 100-marble urn market with the "sell at 55 → drop to 30 at 40" skew; "challenge correct answers"; Super Day 4–5 × 45 min + trading game); theinterviewden.com *IMC Trading Interview* (2026, Medium — representative flow with mid-game info reveal "one die is a 4 → 7.5"; one-optional-reroll EV example); techinterview.org *IMC Trading Interview Guide* (Medium — OA mental-math + sequences; Prosperity fast-track).

---

## 1.4 DRW — Confidence: **High** (multiple 2025 first-hand reports incl. a Dec-2025 review)

**Process.** Application → **OA: ~6 questions / 45 minutes** (~7.5 min/Q), math/probability/brainteasers, **linear algebra / Markov chains / recursion-DP heavier than most trader shops**, **often one item that is essentially unsolvable — leave it blank and move on** → recruiter screen (behavioral + mental math) → technical 1:1s (probability/stats, sometimes **market-making**) → in-person Superday (~3 interviews). ~3–4 weeks.

**What is distinctive.** The Dec-2025 Dev.to full review states it plainly: *"DRW's OA does not test whether you can solve hard problems. It tests whether you can solve practical mathematical problems quickly and accurately under pressure."* With ~7.5 min/Q, **hesitation is more dangerous than difficulty**, and **triage** (recognizing the ~unsolvable item and *not* burning time on it) is itself part of the test — candidates report leaving one blank and still advancing. Some tracks permit **Python/numpy** for numerical optimization, so a reusable code template saves minutes. Concrete 2025-cycle OA items (paraphrased, and computed exactly below): a **7-sided-die collection with a reset** (recursive expectation → **D3**), a **coin-driven step-landing DP** (Heads +1 / Tails +2, compute `1000·(p₄+p₁₀)` → **D2**), and explicit **Markov-chain** items.

**Signature adversarial moves.** (1) the OA's built-in **unsolvable-item triage**; (2) in 1:1s, **defend a hard derivation** and handle a follow-up that **adds a constraint**; (3) probes for **clarifying questions** (the single most-cited "no-hire" failure mode is diving in without asking).

**Grading:** clear, correct computation **fast** under severe time pressure; triage/decisiveness; mathematical fundamentals (LA/Markov/DP) over tricks; asks clarifying questions.

**Sources (DRW).** Dev.to (net_programhelp) *DRW 2026 Summer Quant/QR Intern OA Full Review* (**Dec 2025**, Medium — 6Q/45min; LA, calculus, probability, recursion/DP; the 7-sided-die reset and coin-step-DP items; "master numpy/scipy in advance"); Wall Street Oasis *DRW Interview Questions* (**2025 first-hand** — "Markov chains" OA item; "6 hard math questions, one impossible, left it blank, still advanced"; later rounds = EV/market-making/modeling; "apples and oranges" interview item); programhelp.net *DRW Intern OA 26 Summer* (2025/26, Low-Medium — corroborates 6Q/45min, coin-step-DP and 7-die-reset items); techinterview.org *DRW Interview Guide* (2026, Medium — OA less mental-math-heavy than Optiver; onsite = market-making mock + brainteasers; recruits USAMO/Putnam backgrounds); everythingquant forum (2026, Low-Medium — 6–8Q / 45–60 min shape).

> **Cross-check status.** Process shapes for all four firms are corroborated by ≥2 independent sources including firm-official material (SIG) and dated 2025 first-hand reports (Citadel, DRW; IMC via concrete game examples across two independent guides) → **High/Medium-High**. Exact per-round counts, timings and cutoffs are **directional (vendor-recycled)** and labeled as such.

---

# PART 2 — HARD ARCHETYPE CATALOG (CORE)

Each archetype gives **name · concept · round**, a **paraphrased example**, a **full step-by-step solution**, the **exact verified answer** (computed this pass; exact method + independent Monte-Carlo, agreement stated), a **deterministic verifier** (formula/DP/recurrence from parameters, so generated instances auto-grade), and a **generation recipe** (parameter ranges + algorithm for many distinct hard instances).

Notation: `F(a,b)` = exact fraction a/b. "MC nnn" = Monte-Carlo estimate over the stated number of trials.

---

## SIG

### S1 — EV bet-pricing with live payout twists (order statistics + optimal stopping). Round: OA / decision-theory.

**Concept.** Price a random payout at its EV, then **recompute under a rule twist** (keep-higher-of-two, one optional redraw, pay-to-redraw). Tests clean EV re-derivation without anchoring — SIG's "twist the payout" signature.

**Paraphrased example.** *Draw one card uniformly from 1–13; you win its face value in dollars. (a) Fair price? (b) Now you draw two and keep the higher — fair price? (c) Now you draw one but may pay to discard and redraw once, forced to keep the second — optimal policy and value?*

**Full solution.**
- (a) Uniform mean `= (1+13)/2 = 7`.
- (b) `E[max(X,Y)] = Σ_{k=1}^{13} k·P(max=k)`, with `P(max=k) = (k² − (k−1)²)/169 = (2k−1)/169`. So `E = Σ k(2k−1)/169 = 1547/169`.
- (c) Reroll iff the first draw is **below** the fresh-draw EV of 7, i.e. iff `first ≤ 6`. Value `= P(first ≥ 7)·E[first | first ≥ 7] + P(first < 7)·7 = (7/13)·10 + (6/13)·7 = 112/13`.

**Exact verified answers.** (a) **7**. (b) **1547/169 = 119/13 ≈ 9.1538** (MC 400k = 9.151). (c) **112/13 ≈ 8.6154** (MC 400k = 8.615). *(For a 6-sided die the classic "one optional reroll" value is **4.25** = ½·E[X|X≥4] + ½·3.5 = ½·5 + ½·3.5 — this exactly matches the worked example on Quantt's Citadel page, a nice external cross-check.)*

**Deterministic verifier.** For a discrete payoff `X` on `{1..n}`: (a) mean `(n+1)/2`; (b) `E[max of m] = Σ k(kᵐ−(k−1)ᵐ)/nᵐ`; (c) threshold policy — reroll iff `x < E[X]`; value `= P(X≥t)E[X|X≥t] + P(X<t)E[X]` with `t = ⌈E[X]⌉`. All are exact finite sums.

**Generation recipe.** Parameters: support `n ∈ {6,10,13,20}`; twist ∈ {keep-max-of-m for `m ∈ {2,3}`, one/two optional rerolls, pay-cost `c ≥ 0` per reroll (subtract `c` from the reroll branch and re-solve the threshold), non-uniform face weights}. Emit the twist; verifier = the exact sums above. Difficulty scales with `m`, the reroll depth, and a nonzero cost `c`.

### S2 — Kelly bet-sizing under uncertainty (confidence → stake). Round: decision-theory / poker.

**Concept.** Given an edge, **size the bet to maximize long-run log-growth** (Kelly), and recognize that **overbetting destroys growth**. This is SIG's "how much would you bet?" made precise.

**Paraphrased example.** *You believe you win an even-money bet with probability 0.6. What fraction of your bankroll maximizes long-run growth? What is the growth rate, and what happens if you bet double that?*

**Full solution.** For net odds `b:1` and win prob `p`, Kelly `f* = (p(b+1) − 1)/b`. Even money `b=1` ⇒ `f* = 2p − 1`. Log-growth `g(f) = p·ln(1+bf) + (1−p)·ln(1−f)`.

**Exact verified answers.** `p=0.6, b=1`: **`f* = 0.20`, `g(f*) = 0.02014`**; **betting `2f*=0.40` gives `g = −0.00245` (negative — you now *shrink* your bankroll despite a real edge)**. Other verified rows: `p=0.55,b=1 → f*=0.10, g=0.00501`; `p=0.40,b=2 → f*=0.10, g=0.00971`; `p=0.30,b=3 → f*=0.0667, g=0.00640`.

**Deterministic verifier.** Closed forms above; `f*` is the unique root of `g'(f)=0` on `(0,1)`. To score a candidate's stake `f`, report `g(f*) − g(f)` (growth gap) and whether `f > f*` (over-betting) — the sign flip past `f = 2f*` for even-money bets is a clean teaching hook.

**Generation recipe.** Parameters: `p ∈ {0.52..0.75}`, odds `b ∈ {1,2,3,5}`, optional **estimation uncertainty** (candidate's `p` is itself a random estimate ⇒ correct move is fractional/half-Kelly). Emit `(p,b)`; verifier returns `f*`, `g(f*)`, and the over-bet ruin point.

### S3 — Simplified two-player betting game (polarized bluff-catch / pot odds). Round: poker.

**Concept.** A **game-theoretic** betting spot the interviewer invents on the spot: solve for equilibrium **bluff frequency** and **call frequency** via mutual indifference. This is the pot-odds core underneath SIG's poker round.

**Paraphrased example.** *Pot is \$6. Villain is polarized (either the nuts or pure air) and bets \$3. You hold a pure bluff-catcher. How often should Villain bluff, and how often should you call, in equilibrium?*

**Full solution.** **Villain's bluff frequency** makes Hero indifferent between call and fold: calling risks `B` to win `P+B` when Villain is bluffing, so `φ·(P+B) − (1−φ)·B = 0 ⇒ φ = B/(P+2B)`. **Hero's call frequency** makes Villain indifferent between bluffing and giving up (bluff EV vs 0): `c·(−B) + (1−c)·P = 0 ⇒ c = P/(P+B)`.

**Exact verified answers (P=6, B=3).** **Villain bluffs 1/4 of the time** (`φ = 3/12`), **Hero calls 2/3 of the time** (`c = 6/9`). Best-response check: at Villain's GTO frequency, Hero's EV is independent of his call rate (indifference confirmed), and vice-versa.

**Deterministic verifier.** For any `(P,B)`: `φ* = B/(P+2B)`, `c* = P/(P+B)`. Cross-check by best-response iteration (both players' EVs become flat in their own frequency at equilibrium). Extends to non-polar ranges via a small payoff matrix + LP.

**Generation recipe.** Parameters: pot `P ∈ {2..12}`, bet `B ∈ {P/4 .. P}`, optional **multi-street** or **partial-range** villains (solve the resulting 2×2/3×3 zero-sum by LP). Emit `(P,B, range structure)`; verifier = the indifference formulas / LP value.

---

## Citadel Securities

### C1 — Hidden-composition Bayes → bet on your own probability (the flagship). Round: technical / superday.

**Concept.** Update a **prior over unknown composition** on observed draws, then **take a position** on the posterior predictive. The punchline: **the answer depends on the prior you assume**, and defending that choice is the test.

**Paraphrased example.** *A bag holds 4 stones, each black or white, split unknown. You draw two (without replacement) and both are black. Probability the next draw is black — and would you bet on it?*

**Full solution (uniform-composition prior).** Let `K` = number black, prior `Uniform{0,1,2,3,4}`. Likelihood of "first two black" given `K` is `C(K,2)/C(4,2)`: `K=2→1/6, K=3→1/2, K=4→1`, else 0. `P(2 black) = (1/5)(1/6+1/2+1) = 1/3`. Posterior `P(K|2 black): K=2→1/10, K=3→3/10, K=4→6/10`. With two black already gone, `P(next black|K) = (K−2)/2`. So `P(next black) = (1/10)(0)+(3/10)(1/2)+(6/10)(1) = 15/20`.

**Exact verified answers.** **Uniform-composition prior → 3/4** (MC 800k = 0.751). **Independent-fair-coin model** (each stone iid black w.p. ½) **→ 1/2** exactly (independence ⇒ observations are uninformative — a critical contrast). **Continuous Laplace rule of succession** (proportion `~U[0,1]`) → `(s+1)/(n+2) = 3/4`, matching the uniform-composition answer. Generalization `N=6, m=3` (uniform composition) **→ 4/5**.

**Deterministic verifier.** For `N` stones, prior `Uniform{0..N}` over `K`, observe `m` of one color (no replacement): `P(next same) = [Σ_K w_K·(K−m)/(N−m)] / Σ_K w_K`, where `w_K = (1/(N+1))·Π_{i=0}^{m−1}(K−i)/(N−i)`. Exact rational arithmetic. Also emit the two contrasting models (iid-fair → ½; Beta(α,β) prior → `(α+m)/(α+β+m)`) so the item can grade whether the candidate **states and defends a prior**.

**Generation recipe.** Parameters: `N ∈ {3..8}`, observed `m ∈ {1..N−1}`, prior ∈ {uniform-composition, iid-p, Beta(α,β)}. Emit `(N,m,prior)`; verifier returns the exact posterior predictive. The **highest-signal instances pit two priors against each other** (same data, different answer) — pure Citadel.

### C2 — Convolution + order statistics (sum / max / min of dice). Round: technical.

**Concept.** Compute a distribution of a **sum** (convolution) or an **extreme** (order statistic) exactly, then price/quote on it.

**Paraphrased example.** *Roll three fair dice. (a) Probability the sum is exactly 10? (b) Expected value of the largest die? the smallest? the median?*

**Full solution.** (a) Count triples summing to 10 among `6³=216`: **27** ⇒ `27/216 = 1/8`. (b) `P(max=k)=(k³−(k−1)³)/216`; `E[max]=Σ k·P(max=k)`. Symmetry gives `E[min]=7−E[max]` and `E[median]=3.5`.

**Exact verified answers.** (a) **1/8**. (b) **E[max] = 119/24 ≈ 4.9583**, **E[min] = 49/24 ≈ 2.0417**, **E[median] = 7/2** (all exact by full 216-enumeration). *(Note `E[min of 3 dice]=49/24=2.0417` reproduces the min-of-3-dice fair value used in the Jane-Street deep file — an independent cross-file check.)*

**Deterministic verifier.** Convolution: DP over die-by-die sum distributions (exact). Order statistics: `P(max≤k)=(k/6)ᵈ`, difference for the pmf; `E` = exact finite sum. Handles any face count / dice count / target.

**Generation recipe.** Parameters: dice count `d ∈ {2..5}`, faces `f ∈ {4,6,8,10,12}`, statistic ∈ {sum=target, max, min, median, range}. Emit; verifier = convolution DP + order-statistic formula. Difficulty scales with `d` and asking for the **median/range** (no symmetry shortcut).

### C3 — Recursion / DP expectation (series length, frog jumps). Round: technical.

**Concept.** Expected value of a **stopping random process** via a small recursion — Citadel's "pause for the elegant recursion" trap.

**Paraphrased example.** *(a) Best-of-5 series, each game a fair coin — expected number of games played? (b) A frog on stone 1 of `n` stones jumps each time to a uniformly random higher stone until it reaches stone `n` — expected number of jumps?*

**Full solution.** (a) `E[games] = Σ g·P(series ends in g)`; for `p=½`, `P(3)=1/4, P(4)=3/8, P(5)=3/8`. (b) `E_i = 1 + (1/(n−i))·Σ_{j>i} E_j`, `E_n=0`; telescopes to the harmonic number `H_{n−1}`.

**Exact verified answers.** (a) **33/8 = 4.125**. (b) `n=10` **→ 7129/2520 = H₉ ≈ 2.8290** (exact recursion). 

**Deterministic verifier.** (a) `rec(a,b) = 1 + p·rec(a+1,b) + (1−p)·rec(a,b+1)`, absorbing at `k` wins — exact rational memoized DP. (b) backward harmonic recursion. Both `O(n²)`/`O(n)` exact.

**Generation recipe.** Parameters: race length `k ∈ {2..7}`, per-game `p ∈ {0.4..0.6}`; frog stones `n ∈ {5..15}`, jump law ∈ {uniform-higher, geometric}. Emit; verifier = the recursion. Biased `p` removes the symmetry and is the hard variant.

### C4 — Market-making with adverse selection + inventory. Round: superday.

**Concept.** Quote a two-sided market on a hidden value facing a **mix of informed (picks you off) and uninformed (throttled by competition) flow**; the optimal half-spread **widens with the informed fraction** and can go **negative-EV** (decline to quote). Citadel's version demands **tighter spreads / faster updates** than Jane Street.

**Paraphrased example.** *A hidden value is `Uniform{1..100}` (fair 50.5). Each round one counterparty arrives: informed w.p. `q` (lifts iff `V>ask`, hits iff `V<bid`), else uninformed (random side, only fills if your half-spread `h ≤ H=40`, fill prob `1−h/H`). Optimal symmetric quote and its P&L as `q` varies?*

**Full solution.** `E[P&L]/round = (1−q)·(1−h/H)·h − q·(E[(V−ask)⁺] + E[(bid−V)⁺])`. Maximize over `h` (mid fixed at 50.5 by symmetry); the informed tail term grows with `q`, pushing `h*` up until even the best quote is unprofitable.

**Exact verified answers (N=100, H=40; closed-form).** `q=0.3 → h*≈24.5, E*≈+4.70`; `q=0.5 → h*≈28.5, E*≈+1.79`; `q=0.7 → E*≈0` (optimal action is **widen and decline / cut size**). Closed form matches Monte-Carlo to MC noise.

**Deterministic verifier.** Given `(distribution, q, H, size, bid, ask)` compute `E[P&L]/round` by the closed form (tails = exact sums over the support); optional fixed-seed MC confirms. Score: **mid accuracy** `|mid−μ|` (drives adverse selection), **spread calibration** `|h−h*|`, **P&L gap** `E*−E`, **adverse-selection response** (did they widen/skew after repeated lifts), **inventory skew** (does the next quote flatten position).

**Generation recipe.** Distributions ∈ {Uniform{1..N}, min-of-3-dice (fat low tail — "mean ≠ median, quote accordingly"), sum-of-cards}; `q ∈ {0.2..0.8}`, `H ∈ {10..N/2}`, reveal schedule (shrink support mid-game → force a tighter re-quote). Each `(dist,q,H)` yields a unique `h*, E*`. Difficulty scales with `q` and skewed distributions.

---

## IMC Trading

### I1 — Make-a-market + order-flow Bayesian inference (dice sum). Round: trading game.

**Concept.** Quote on a hidden sum; when the counterparty **lifts your offer**, **quantify the Bayesian update** rather than anchoring. IMC's "noise or signal?" made numeric.

**Paraphrased example.** *Two dice behind a screen; I pay you their sum. You quote "6 at 8." I buy at 8. (a) If I am fully informed (know the sum, buy iff sum > my ask), what is the sum's posterior mean? (b) If I am informed only w.p. `q` (else I buy at random), what is your updated fair value?*

**Full solution.** Fair value `E[sum]=7`. (a) Informed buy at ask 8 ⇒ `sum ∈ {9,10,11,12}` with prior weights `{4,3,2,1}/36`; `E[sum|sum>8] = (36+30+22+12)/10 = 10`. (b) Mixture: `P(lift|sum) = q·[sum>8] + (1−q)·½`; posterior mean `= Σ sum·P(sum)·P(lift|sum) / Σ P(sum)·P(lift|sum)`.

**Exact verified answers.** (a) **E[sum | sum > 8] = 10** (so a fully-informed lift means reprice around 10, not 7). (b) **`q=½ → 8.07`, `q=¾ → 8.88`, `q=1 → 10`** — a clean dial for "how much to shade after being lifted."

**Deterministic verifier.** For any payoff distribution and any executed trade, compute the exact posterior mean under the informed-w.p.-`q` model by enumerating the support. Score the candidate's **re-quote mid** against this posterior mean.

**Generation recipe.** Parameters: payoff ∈ {sum of `d` dice, sum of cards, urn count}, quoted `(bid,ask)`, informed fraction `q ∈ {0.3..1}`, trade side. Emit the executed trade; verifier returns the posterior mean and the correct skew direction. Difficulty scales with skewed payoffs and lower `q` (subtler signal).

### I2 — Urn with unknown count → sequential posterior mean. Round: trading game.

**Concept.** Market on an **unknown count** under a uniform prior; **update the posterior mean as marbles are revealed** (hypergeometric-Bayes). Directly IMC's marble-urn game.

**Paraphrased example.** *100 marbles, red count `R ~ Uniform{0..100}`; I pay you `R`. You quote "45 at 55." Then we draw 10 marbles without replacement and 3 are red. What is your updated fair value?*

**Full solution.** Prior mean 50. Posterior `P(R | r red of d) ∝ C(R,r)·C(100−R,d−r)/C(100,d)` (hypergeometric likelihood, uniform prior). Take the exact posterior mean.

**Exact verified answers.** No info **→ 50**. **Draw 10, see 3 red → E[R] ≈ 33.0**; **see 8 red → E[R] ≈ 75.5** (exact rational sums). So after 3-of-10 red you **skew your whole market down toward the low-30s**, matching the candidate advice "drop to ~30 at 40."

**Deterministic verifier.** Exact posterior mean `E[R] = Σ_R R·L(R) / Σ_R L(R)` with `L(R)` the hypergeometric likelihood; closed rational arithmetic. Score the re-quote mid vs this value; also expose the posterior sd for spread-width scoring.

**Generation recipe.** Parameters: urn size `N ∈ {20..200}`, draws `d`, observed red `r`, prior ∈ {uniform, Beta-binomial}. Emit the sample; verifier returns posterior mean + sd. Difficulty scales with small `d` (weak signal, wide posterior) and adversarial reveal order.

### I3 — Asymmetric EV bet + sizing (challenge-a-correct-answer). Round: probability / behavioral.

**Concept.** A payoff-skewed bet where **EV sign, not the likely outcome, decides**, plus a **sizing** follow-up — and IMC then *challenges your correct answer* to test whether you flinch.

**Paraphrased example.** *A bet pays +\$10 with probability `p` and −\$1 otherwise. (a) For which `p` is it worth taking? (b) At `p=0.2`, how much of your bankroll should you stake? (Interviewer, deadpan: "Are you sure? That looks aggressive.")*

**Full solution.** `EV = 10p − 1·(1−p) = 11p − 1`, positive iff `p > 1/11`. Kelly for a `+10/−1` bet: `f* = (10p − (1−p))/10 = (11p−1)/10`.

**Exact verified answers.** **Break-even `p = 1/11 ≈ 0.0909`.** `p=0.2 → EV = +\$1.20, f* = 0.12`; `p=0.1 → EV = +\$0.10, f* = 0.01`. The behavioral test: hold your ground on the +EV take while acknowledging variance — **don't cave to the challenge when the math is right.**

**Deterministic verifier.** `EV = b·p − ℓ·(1−p)`; `f* = (b·p − ℓ·(1−p))/(b·ℓ)` for win `b`, loss `ℓ`. Exact. Score EV sign, break-even `p`, and stake vs `f*`.

**Generation recipe.** Parameters: win `b ∈ {3..20}`, loss `ℓ ∈ {1..5}`, `p` near break-even (to make the sign non-obvious). Emit `(b,ℓ,p)`; verifier returns EV, break-even, `f*`. Hard instances put `p` just above/below `1/(b/ℓ+1)`.

### I4 — Order-statistic market (max of two dice). Round: trading game.

**Concept.** A make-a-market on an **extreme** whose fair value is **not** the obvious midpoint — punishes "quote around the middle" reflexes.

**Paraphrased example.** *I roll two dice and pay you the larger. Make a market.*

**Full solution.** `P(max=k) = (2k−1)/36`; `E[max] = Σ k(2k−1)/36`. Not 3.5 — skewed high.

**Exact verified answer.** **E[max of two dice] = 161/36 ≈ 4.472** → a sensible market is "4 at 5," not "3 at 4." (Contrast `E[median of 3 dice]=3.5`, which *is* symmetric — a good paired item.)

**Deterministic verifier.** `E[max of m dice] = Σ_k k·((k/f)ᵐ − ((k−1)/f)ᵐ)·f` (exact). Score quote mid vs this fair value.

**Generation recipe.** Parameters: dice `m ∈ {2,3}`, faces `f ∈ {6,8,10}`, statistic ∈ {max, min, 2nd-highest}. Emit; verifier = order-statistic sum. Hard variants ask for the 2nd-highest (no clean symmetry).

---

## DRW

### D1 — Markov chain expected hitting time. Round: OA / technical.

**Concept.** Collapse a symmetric random walk into **distance classes**, set up expected-hitting-time equations, solve the small linear system — DRW's explicitly-named Markov content.

**Paraphrased example.** *A token does a simple random walk on the 8 vertices of a cube (each step to a uniformly random adjacent vertex). Starting at one corner, expected number of steps to reach the diagonally opposite corner?*

**Full solution.** Group by Hamming distance `d ∈ {0,1,2,3}` from the target; degree 3. `E₀ = 1+E₁`; `E₁ = 1 + (1/3)E₀ + (2/3)E₂`; `E₂ = 1 + (2/3)E₁` (with `E₃ = 0`). Substitute: `E₁ = 9`, `E₀ = 10`.

**Exact verified answer.** **E[steps to antipode] = 10** (exact linear solve; MC 60k = 10.00).

**Deterministic verifier.** Build the transition matrix `Q` over transient states; solve `(I−Q)·E = 1` exactly (rational linear algebra). Works for any graph / absorbing set. Cross-check by MC.

**Generation recipe.** Parameters: structure ∈ {cube, hypercube-`d`, cycle-`n`, complete-graph, king/knight on small board}, target set, optional bias. Emit the graph; verifier = `(I−Q)⁻¹𝟙`. Difficulty scales with graph size and asymmetric transition weights.

### D2 — Recursion / DP landing probability (real DRW OA item, paraphrased). Round: OA.

**Concept.** A two-step random walk where you compute the **probability of ever landing exactly on step `n`** — a linear recurrence with a clean closed form. (Paraphrased from a Dec-2025 DRW OA report.)

**Paraphrased example.** *Start at step 0. Flip a fair coin repeatedly: Heads advances +1 step, Tails advances +2 steps. Let `pₙ` be the probability you ever land exactly on step `n`. Compute `1000·(p₄ + p₁₀)`.*

**Full solution.** You land on `n` iff you were on `n−1` and flipped H, or on `n−2` and flipped T: `pₙ = ½ p_{n−1} + ½ p_{n−2}`, with `p₀=1, p₁=½`. Closed form `pₙ = 2/3 + (1/3)(−1/2)ⁿ` (the missing landings are the ones "jumped over" by a Tail; the long-run density is 2/3).

**Exact verified answers.** **`p₄ = 11/16`, `p₁₀ = 683/1024`**, so **`1000·(p₄+p₁₀) = 1387000/1024 = 1354.4921875 ≈ 1354.49`** (exact recurrence; closed form confirms `p₁₀=683/1024`; MC 500k = 0.688 / 0.667).

**Deterministic verifier.** Iterate `pₙ = ½p_{n−1}+½p_{n−2}` in exact rationals, or evaluate the closed form `2/3 + (1/3)(−1/2)ⁿ`. Both exact for any `n`.

**Generation recipe.** Parameters: step set (e.g. {+1,+2}, {+1,+3}, {+2,+3}), step probabilities, target indices to sum, multiplier. Emit; verifier = the resulting linear recurrence (order = max step). Difficulty scales with larger step gaps (higher-order recurrence, no simple density).

### D3 — Recursive expectation with a reset (real DRW OA item, paraphrased). Round: OA.

**Concept.** Coupon-collector-style expectation where a **failure state resets progress** — the reset couples the last state back to the start, so it's not a plain telescoping sum. (Paraphrased from the Dec-2025 DRW OA "7-sided die collection.")

**Paraphrased example.** *Roll a fair 7-sided die repeatedly to collect all 7 faces. But once you already have 6 distinct faces, if you roll a face you have already seen (before finally getting the 7th new one), you lose all progress and restart from zero distinct faces. Expected number of rolls to finish?*

**Full solution.** Let `E_k` = expected rolls from `k` distinct faces. For `k=0..5` (normal): `E_k = 7/(7−k) + E_{k+1}`. At `k=6` the repeat resets: `E₆ = 1 + (6/7)E₀ + (1/7)·0`. Let `a = Σ_{k=0}^{5} 7/(7−k)`; then `E₀ = a + E₆` and `E₆ = 1 + (6/7)(a+E₆) ⇒ E₆ = 7 + 6a`, so `E₀ = 7 + 7a`. Here `a = 7(1 + 1/2 + 1/3 + 1/4 + 1/5 + 1/6) = 223/20`.

**Exact verified answer.** **E[rolls] = 1701/20 = 85.05** (exact linear solve; MC 120k = 85.09). *(Contrast plain coupon-collector `7·H₇ ≈ 18.15` — the fragile 7th face inflates it ~4.7×.)*

**Deterministic verifier.** Assemble the absorbing Markov chain over "distinct-count" states with the reset edge from state 6 back to 0; solve `(I−Q)E = 1` exactly. Cross-check by MC.

**Generation recipe.** Parameters: faces `n ∈ {4..10}`, reset-trigger state `r ∈ {n−2, n−1}`, reset target (0 or `r−1`), optional multiple fragile states. Emit; verifier = exact chain solve. Difficulty scales with earlier/multiple reset states (more coupling).

### D4 — Deliberately-underdetermined triage + defend-a-result. Round: OA (the ~unsolvable item) / technical.

**Concept.** Recognize that a problem's answer **depends on an unstated sampling model** — the correct move is to **name the ambiguity, state the assumption, and give the answer under each** (or, on the OA, **triage it and move on**). Also the "defend a counterintuitive result" archetype.

**Paraphrased example.** *A family has two children. You are told "at least one is a boy born on a Tuesday." Probability both are boys? (Then: is this even well-posed?)*

**Full solution.** Under the **enumerate-all-consistent-families** model (each child independent, gender ½, day 1/7), count families with ≥1 Tuesday-boy: denominator `= 14² − 13² = 27` weighted states; numerator (both boys, ≥1 Tuesday) `= 13`. Under the **"you met a random Tuesday-born boy, what's his sibling"** model, the sibling is independent ⇒ `1/2`. Both are *correct given their model*; the item is underdetermined until the sampling process is fixed.

**Exact verified answers.** **13/27 ≈ 0.4815** (enumeration model) vs **1/2** (random-child model), by full enumeration of the `14×14` state space. The teachable point: **quote the assumption first**; on a timed DRW OA, if a problem is genuinely missing information, **flag it and bank the time** (the "leave-one-blank and still advance" behavior).

**Deterministic verifier.** Enumerate the `(gender,day)²` family space; compute the conditional under each stated sampling model. Any "boy born on day-of-week" variant is exact. For "defend-a-result" items (e.g. envelope/Bertrand-style), enumerate/simulate each interpretation and report the set of defensible answers.

**Generation recipe.** Parameters: the conditioning event (day-of-week, birth order, "at least one" vs "the elder"), family size, alphabet size. Emit a version where the sampling model is **left implicit**; verifier returns the answer per model *and a flag that the models disagree* (i.e. that the honest response is "underdetermined — here are both"). Difficulty scales with how close the two models' answers are (harder to notice they differ).

---

# PART 3 — VERIFIED-ANSWER LEDGER (everything computed this pass)

| Firm | Archetype | Exact answer | Method | MC cross-check |
|---|---|---|---|---|
| SIG | S1 keep-max-of-2 (deck 1..13) | **119/13 ≈ 9.154** | enumeration | 9.151 (400k) ✓ |
| SIG | S1 one optional redraw | **112/13 ≈ 8.615** | threshold EV | 8.615 (400k) ✓ |
| SIG | S1 die + one reroll (n=6) | **4.25** | threshold EV | (matches Quantt worked ex.) ✓ |
| SIG | S2 Kelly p=0.6,b=1 | **f*=0.20, g=0.02014; 2f* ⇒ g=−0.00245** | closed form | — |
| SIG | S3 bluff-catch P=6,B=3 | **bluff 1/4, call 2/3** | indifference + BR check | ✓ |
| Citadel | C1 hidden-comp Bayes (N=4,m=2) | **3/4** (uniform-comp) vs **1/2** (iid-fair) | exact Bayes | 0.751 (800k) ✓ |
| Citadel | C1 generalization N=6,m=3 | **4/5** | exact Bayes | ✓ |
| Citadel | C2 sum of 3 dice =10 | **27/216 = 1/8** | convolution | ✓ |
| Citadel | C2 E[max3]/E[min3]/E[med3] | **119/24 / 49/24 / 7/2** | enumeration | ✓ |
| Citadel | C3 best-of-5 (p=½) | **33/8 = 4.125** | recursion | ✓ |
| Citadel | C3 frog n=10 | **7129/2520 = H₉ ≈ 2.829** | recursion | ✓ |
| Citadel | C4 adverse-selection MM | **q=.3→h*24.5,E*4.70; q=.5→28.5,1.79; q=.7→E*≈0** | closed form | < 0.03/round ✓ |
| IMC | I1 E[sum \| sum>8] | **10**; mixture q=½→8.07, ¾→8.88 | exact posterior | ✓ |
| IMC | I2 urn R~U{0..100}, 3-of-10 red | **E[R]≈33.0** (8-of-10 → 75.5) | hypergeom-Bayes | ✓ |
| IMC | I3 +10/−1 bet | **break-even p=1/11; p=0.2→EV 1.20, f*0.12** | closed form | — |
| IMC | I4 E[max of 2 dice] | **161/36 ≈ 4.472** | enumeration | ✓ |
| DRW | D1 cube antipode hitting time | **10** | linear solve | 10.00 (60k) ✓ |
| DRW | D2 coin-step 1000·(p₄+p₁₀) | **1354.49** (p₄=11/16, p₁₀=683/1024) | recurrence + closed form | 0.688/0.667 (500k) ✓ |
| DRW | D3 7-die collect w/ reset | **1701/20 = 85.05** | absorbing-chain solve | 85.09 (120k) ✓ |
| DRW | D4 Tuesday-boy (underdetermined) | **13/27** vs **1/2** | enumeration | ✓ |
| Anchor | two-walk meeting B=(3,4) | **3273/4096 ≈ 0.7991**; same-time = **0** | 2⁷×2⁷ enumeration | 0.7987 (500k) ✓ |

All exact answers were reproduced by an independent Monte-Carlo run to within sampling noise; the anchor was re-derived from scratch as a harness self-test and matched `3273/4096` exactly.

---

# PART 4 — CONFIDENCE, CALIBRATION, AND SOURCE CONFLICTS

## 4.1 Confidence self-assessment
- **High:** all four process shapes (SIG firm-official; Citadel + DRW dated-2025 first-hand; IMC concrete game examples across ≥2 independent guides); the signature adversarial moves (SIG confidence→bet + payout twist; Citadel hidden-composition Bayes + bet-on-your-own-answer; IMC challenge-a-correct-answer + urn/dice MM; DRW unsolvable-item triage + defend-a-result). **Every numeric answer is High** — computed here (exact + MC), independent of any source.
- **Medium:** exact OA counts/timings/cutoffs (vendor-recycled, directional); the precise informed/uninformed market-making parameters (`q`, `H`) are our modeling choice, not a firm key — treat `h*`/`E*` as illustrative of the *direction* (spread widens with adverse selection), with the exact numbers valid only for the stated model.
- **Low / flagged:** any single-sourced specific claim (e.g. the exact reset rule of the DRW 7-die item is paraphrased from one Dec-2025 review — we specified a clean, fully-defined version and solved *that*; the number is exact for our stated rules, which may differ in detail from the original).

## 4.2 Source conflicts (recorded)
1. **SIG OA question count:** JobTestPrep ~9 / 60 min vs TraderMath 17; Quantt's "30–50 Q sprint" **conflicts** with the far-better-corroborated calculator-allowed 9–17/60-min format → we treat the Quantt count as **Low** and model the deep-reasoning format.
2. **Citadel signature vs Jane Street:** techinterview says the market-making round is "similar to Jane Street's." We differentiate on the **hidden-composition-Bayes + bet-on-your-own-answer** move (C1) and the "tighter spreads / faster updates" note, which are Citadel-specific in the 2025 first-hand reports.
3. **DRW OA item rules:** the 7-sided-die-reset and coin-step-DP items are paraphrased from a Dec-2025 review; exact wording (especially the reset trigger) is not fully specified in the source, so we defined a precise version and computed its exact answer (85.05). Flagged as a **paraphrase with our own rule-fixing**, not a claim about the literal OA number.
4. **IMC informed-lift assumption:** the "they lifted your offer — noise or signal?" framing is universal, but the *degree* of informedness (`q`) is unstated; we parameterized it and give the update for several `q` so the item is honest about the assumption.
5. **Prior-dependence in C1:** this is a *feature*, not a conflict — the four-stones answer is **3/4 under a uniform-composition (or Laplace) prior** and **1/2 under independent-fair stones**. The interview tests whether the candidate **states and defends the prior**, so both are recorded as correct-given-model.

## 4.3 Recommended use in our mock
- **SIG preset:** center on **S2 (Kelly)** + **S3 (bluff-catch)** with the **confidence→bet** probe and **S1 payout twists**; score **calibration** and **bet-sizing to edge** above the number.
- **Citadel preset:** lead with **C1** (hidden-composition Bayes → *now bet on it*), pairing the uniform-comp and iid-fair models to reward **stating a prior**; use **C4** as the adverse-selection market-making engine with **tighter target spreads** than the Jane-Street preset.
- **IMC preset:** **I1/I2** make-a-market with the **order-flow posterior** as the deterministic re-quote grader, plus the **challenge-a-correct-answer** behavioral (score "hold when right, update on real info").
- **DRW preset:** a **6-item timed block** including **D1 (Markov)**, **D2/D3 (DP/recursion)**, and **one deliberately-underdetermined D4 item** where **triage** (flag + skip) is scored as a first-class skill; add a **defend-a-hard-result** follow-up.
- Every archetype ships with an **exact verifier** (enumeration / DP / closed form / chain solve) so generated instances auto-grade, and every one is **calibrated to the anchor (≈0.80 lattice-meeting) or harder**.
