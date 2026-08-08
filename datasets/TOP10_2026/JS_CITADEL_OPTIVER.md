# Jane Street · Citadel Securities · Optiver — 2026 Trader Assessment & Interview Profiles

**Compiled:** 7 Aug 2026 via fresh WebSearch/WebFetch, cross-checked against and building on the prior deep files (do **not** duplicate them):
- `datasets/JANE_STREET_2026_DEEP.md` (process spine + verified hard-archetype catalog + the "mutation cascade")
- `datasets/OPTIVER_2026_DEEP.md` (battery shape + Zap-N game roster + verified lattice-walk anchor)
- `datasets/TOP_FIRMS_2026_DEEP_A.md` (Citadel archetypes C1–C4, verified)
- `datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md` (cross-firm funnel + adversarial-follow-up doctrine)

**Purpose of THIS file:** a tight, current (2026) per-firm profile for exactly three firms — **Jane Street, Citadel Securities, Optiver** — focused on (a) the *current assessment format + platform by name*, with an explicit currency check per firm; (b) the full interview funnel; (c) a concrete per-firm topic checklist; (d) publicly-reported example archetypes with difficulty calibration and the traps; (e) the hardest tier vs. the warm-ups. The verified math/answers live in the deep files above and are pointed to, not re-derived here.

**Confidence key.** **High** = firm-official and/or ≥2 independent 2025–2026 primary reports agree. **Medium** = consistent across aggregators + some primary confirmation. **Low** = single/old/vendor-only. Prep vendors recycle each other's numbers, so cross-vendor agreement is weak evidence; primary/first-hand reports are weighted far higher. No firm publishes a scoring key — **treat all counts/timings/cutoffs as directional shapes, not literal keys.**

**Paraphrase rule.** Every example below is a paraphrased archetype of a public *family*; no proprietary item is reproduced.

---

# 1) JANE STREET

## 1.1 Current assessment format + platform (currency check) — Confidence: **High**

- **The gate is a timed mental-math test, ~60 questions / ~8 minutes** (some report ~7 min and 60–90 questions; format varies by cycle). No calculator, no scratch paper. Content: 2-digit × 2-digit multiplication, division, percentages of round numbers, decimal arithmetic, fraction↔decimal comparison. It is **Zetamac-style** and candidates commonly call it "the Zetamac test," but it is **Jane Street's own timed test, not a named third-party vendor product** — practice is done on the public `arithmetic.zetamac.com` tool. Pass bar ≈ **70–85% correct**, role/cycle dependent. [techinterview 2026](https://www.techinterview.org/companies/jane-street/); [theinterviewden 2026](https://theinterviewden.com/companies/jane-street-quant-trader-interview)
- **Currency note:** the ~60Q/8min mental-math gate is **still current in 2026** and remains a hard, standalone gate for the trader track (it was de-emphasized for SWE, not for traders). [techinterview 2026](https://www.techinterview.org/companies/jane-street/)
- **A HackerRank OA (~60–90 min) appears on some tracks/cycles** (esp. quant-research / new-grad): probability & logic + mental math + 2–3 Python coding problems. This is *in addition to* or *in place of* the pure math sprint depending on role. [myntbit 2026](https://myntbit.com/blog/jane-street-quant-interview-guide-2026); [InterviewChamp QR-newgrad 2026](https://interviewchamp.ai/interview-questions/jane-street/quant-research-new-grad)
- **Gating reality:** failing the math test ends the process regardless of résumé — "no make-it-up-later mechanism." Zetamac ≥60 in 2 min correlates with passing; <40 generally does not. [techinterview 2026](https://www.techinterview.org/companies/jane-street/)

## 1.2 Interview funnel — Confidence: **High**

1. **Fit / recruiter screen (30–45 min)** — "why trading, why Jane Street," intellectual-style probing (yes, even traders get a fit screen). [theinterviewden 2026](https://theinterviewden.com/companies/jane-street-quant-trader-interview)
2. **Mental-math test (~7–8 min)** — the steep gate above.
3. **Probability / brainteaser phone/video rounds (1–3 × 45–60 min, trader-led)** — 3–5 problems solved *out loud*; "conversation, not a quiz"; interviewers **vary the problem if they smell a memorized answer**. [janestreet.com/trading-interviews](https://www.janestreet.com/trading-interviews/) (firm-official); [techinterview 2026](https://www.techinterview.org/companies/jane-street/)
4. **Market-making / trading-game round (45–60 min)** — quote two-sided markets on a hidden value; interviewer hits/lifts; you update and manage inventory. Appears "in some form for every trader, researcher, and senior SWE candidate." [techscreen 2026](https://techscreen.app/articles/jane-street-technical-interview-process-2026)
5. **Super Day / final committee (4–6 back-to-back 45–60 min rounds + evaluated lunch)** — probability deep-dive, more market-making games (cards/dice/fictional commodities), ≥1 "beyond your comfort zone" technical dive, senior partner. Timeline ≈ 4–10 weeks. [myntbit 2026](https://myntbit.com/blog/jane-street-quant-interview-guide-2026)

**Signature adversarial move (the crown jewel; firm-official).** After you solve a part, they **don't move on** — they (1) **change a rule**, (2) **add an adversary** (single-agent EV → game-theoretic equilibrium), (3) **push you to generalize-to-n**, (4) **offer an elegant reframe as a hint** ("you make ~$X/turn — so should you spend a turn to bank a small value?"), and in market-making (5) run **adverse selection** ("I keep lifting your ask — what does that tell you? Tighten."). The full verified cascade (bank-or-roll die game, E=1773.34 → die-removed E=555 → casino-adversary equilibrium threshold 9) is in `JANE_STREET_2026_DEEP.md` Part 3. [Jane Street mock video](https://www.youtube.com/watch?v=NT_I1MjckaU) (firm-official)

## 1.3 Topic checklist (Jane Street)

- [ ] Fast mental arithmetic (2-digit ×, %, fraction↔decimal) — the gate
- [ ] Expected value under uncertainty; **optimal stopping / threshold policies** (bank-or-roll, "accept this roll or reroll?")
- [ ] Conditional probability & **Bayesian updating** (reflexive; chained evidence → posterior)
- [ ] Coin/dice/card families ("flip until HH," "roll until 6," expected max of 3 dice)
- [ ] **Linearity of expectation** on non-obvious counting problems
- [ ] Variance / standard deviation on simple discrete distributions
- [ ] **Markov chains on small state spaces** — absorption probabilities & expected hitting times
- [ ] Coupon collector, gambler's ruin, balls-in-urns (each with twist follow-ups)
- [ ] **Random walks / stopping times / lattice-path** reasoning (the hard tier)
- [ ] Game theory (light): two-player zero-sum, mixed strategies
- [ ] **Market-making**: spread ∝ uncertainty, Bayesian update on order flow, inventory/adverse-selection management
- [ ] Fermi → make-a-market (population/counts, then trade against it)
- [ ] (Some tracks) Python coding — simulate a process / empirical distribution

## 1.4 Representative example archetypes, difficulty & traps (cited)

| Archetype (paraphrased) | Difficulty | The trap | Source |
|---|---|---|---|
| "Flip until two heads in a row (HH) — expected flips?" (E=6; HT=4) | Warm-up→mid | Assuming HH and HT are symmetric; HH "wastes" a built-up H on a tail. | [techinterview 2026](https://www.techinterview.org/companies/jane-street/) |
| "P(sum = 7 \| at least one die shows 3)?" → **2/11** | Warm-up | Computing P(sum=7)=6/36 and forgetting to condition; must restrict to the 11/36 "≥ one 3" space. | [InterviewChamp 2026](https://interviewchamp.ai/interview-questions/jane-street/quant-research-new-grad) |
| "Roll 3 dice — E[max]?" (161/36 ≈ 4.47 for 2 dice; 3-dice via order stats) | Mid | Guessing 3.5/the mean; max is skewed high — use `P(max≤k)=(k/6)^m`. | [myntbit 2026](https://myntbit.com/blog/jane-street-quant-interview-guide-2026) |
| "Draw from a shuffled deck w/o replacement — expected position of the first ace / count of aces in first half?" | Mid | Trying to sum a messy series instead of the symmetry/linearity shortcut (`(N+1)/(m+1)`). | [techinterview 2026](https://www.techinterview.org/companies/jane-street/) |
| Multi-stage optional-stopping: "roll a die, accept it or reroll — optimal acceptance threshold?" | Mid→hard | Static threshold; the optimum is **time-varying** (picky early, loosen near the end). | [techinterview 2026](https://www.techinterview.org/companies/jane-street/) |
| "I'm thinking of a number 1–100 — make me a market," then hit/lift + reveals | Hard (round) | Quoting **too tight on pure uncertainty** (picked off) or failing to update your mid after a hit/lift; ignoring your resulting inventory. | [theinterviewden 2026](https://theinterviewden.com/companies/jane-street-quant-trader-interview) |
| **Bank-or-roll die game** + mutation cascade (rule change → casino adversary → generalize-to-n) | **Hardest tier** | Solving only the base EV; the whole test is whether your *framework survives* each mutation. Verified answers in the deep file. | [Jane Street mock](https://www.youtube.com/watch?v=NT_I1MjckaU) (firm-official) |

## 1.5 Hardest tier vs. warm-ups (Jane Street)

- **Warm-ups:** single-step EV (E[die roll]=3.5), one clean conditional-probability enumeration, "expected flips to HH."
- **Hardest tier:** the **multi-mutation optimal-stopping / market-making cascade** (adversary added → solve for equilibrium threshold → generalize-to-n), and **random-walk / lattice-path meeting** problems calibrated to the anchor (`3273/4096 ≈ 0.7991`, verified in `JANE_STREET_2026_DEEP.md`). The signal is *reasoning under mutation*, not the first number.

---

# 2) CITADEL SECURITIES

## 2.1 Current assessment format + platform (currency check) — Confidence: **High**

- **Platform: HackerRank** (proctored, closed-book). **Format is role-split and current for 2026:** [tradinginterview 2026](https://www.tradinginterview.com/courses/company-preparations-course/lessons/citadel-securities/topic/citadel-securities-online-assessment/); [linkjob 2026](https://www.linkjob.ai/interview-questions/citadel-hackerrank-questions/); [techinterview coding-OA 2026](https://www.techinterview.org/post/3233474726/coding-oa-patterns-citadel-hrt-jane-street/)
  - **Quant Trader:** ~**15 short-form questions / 30 minutes** — probability, expected value, combinatorics, Bayesian updating; "far from hard" individually, the pressure is speed + clean setup. Answers are numeric/fill-in, not long derivations.
  - **Quant Research:** ~**80 minutes**, deeper probability/stats + math modeling.
  - **SWE / quant-dev:** **2 problems / ~70–90 min** on HackerRank (1 medium + 1 hard), plus for some quant roles a **separate probability/stats OA**. Citadel Securities' coding bar is *higher* than the Citadel hedge fund's (real-time market-making engineering).
- **Currency note:** the **15Q/30min quant-trader HackerRank sprint** is the current 2026 shape across multiple 2026 sources; no "retired format" issue here. The main variability is *which* track (trader vs research vs SWE) you're routed to.

## 2.2 Interview funnel — Confidence: **High** (multiple dated-2025 first-hand reports)

1. **Screening → OA** (HackerRank, per §2.1; trader track adds no coding, some new-grad tracks do).
2. **Recruiter / phone screen (~60 min)** — think-aloud probability, sometimes light coding.
3. **Two ~45–60 min technical rounds** — probability + game theory, **escalating** difficulty.
4. **In-person Super Day, 4–6 back-to-back rounds** — "more market-making, but requires a very solid foundation in math and statistics." Interviewers **share notes**; no single round is fatal. ~4–8 weeks. [myntbit 2026](https://myntbit.com/blog/citadel-securities-interview-process); WSO 2025 first-hand (see `TOP_FIRMS_2026_DEEP_A.md` sources)

**Signature adversarial moves.** (1) **Hidden-composition Bayes → "now bet on your own answer"** — flagship Oct-2025 WSO item: *"Four stones, black/white unknown split; you draw two, both black — P(next black)? Now bet on it."* Answer is **prior-dependent** (3/4 under uniform-composition/Laplace vs 1/2 under iid-fair) — defending the prior is the test (see `TOP_FIRMS_2026_DEEP_A.md` C1, verified). (2) **Adverse selection** in the market-making game with **tighter spreads / faster updates** expected than Jane Street. (3) **"Minor optimization error" needling** — do you defend or crumble? Citadel's problems are **notorious for elegant symmetry/linearity solutions** — candidates who "set up equations immediately often work harder than those who pause to think." [myntbit 2026](https://myntbit.com/blog/citadel-securities-interview-process)

## 2.3 Topic checklist (Citadel Securities)

- [ ] Expected value via **state-space recursion / first-step analysis** (frog jumps, best-of-N series)
- [ ] **Conditional probability & Bayes** (including hidden-composition / unknown-prior)
- [ ] **Linearity of expectation** on adjacency/indicator counting
- [ ] Combinatorics & drawing-without-replacement (socks/pairs, hypergeometric)
- [ ] **Convolution / distribution of a sum**; order statistics (max/min/median of dice)
- [ ] Markov chains, stopping times, random walks
- [ ] Variance / standard-error reasoning (e.g. SD of a sample mean)
- [ ] **Game theory** (dollar-auction / backward-induction traps; two-player zero-sum)
- [ ] **Market-making with adverse selection + inventory** (tighter/faster than JS)
- [ ] Calibrated risk-taking — commit to a price/bet, don't freeze
- [ ] (SWE/quant-dev track) DS&A: 1 medium + 1 hard; order-book / market-data flavored variants

## 2.4 Representative example archetypes, difficulty & traps (cited)

Reported-style HackerRank quant-trader prompts (paraphrased), [linkjob 2026](https://www.linkjob.ai/interview-questions/citadel-hackerrank-questions/) / [ExtraBrain 2026](https://extrabrain.app/interview-questions/citadel-hackerrank-questions-extrabrain/):

| Archetype (paraphrased) | Difficulty | The trap | 
|---|---|---|
| Frog escapes: Ground→Rock success 1/3, Rock→Grass success 1/4 — E[jumps to escape]? | Warm-up→mid | Treating the two stages independently; set up **E[geometric] per stage** (=3 then 4) and add, minding the state structure. |
| Best-of-5 series, fair games — E[games played]? → **33/8 = 4.125** | Warm-up | Averaging 3,4,5 naively; weight by `P(3)=1/4, P(4)=3/8, P(5)=3/8`. |
| 10 socks (5 red/5 white), draw 4 — P(exactly two pairs)? | Mid | Miscounting via ordered vs unordered; use hypergeometric `C(5,2)C(5,2)/C(10,4)`. |
| 4 red-haired + 8 black-haired in a random line — E[adjacent same-color pairs]? | Mid | Trying to enumerate; use **linearity over the 11 adjacent slots**, each `P(match)`. |
| Red bus late 3/4, blue late 1/3; rider is late and P(rode red)=1/2 — red:blue bus ratio? | Mid | Confusing prior with posterior; invert Bayes to solve for the **base rate** given the posterior. |
| 3 tourists → 3 islands independently — **E[median** of the three island counts]? | Mid→hard | No symmetry shortcut for the median; enumerate the `3^3` distribution. |
| 25 people, walk mean 80 / SD 10 — SD of the **neighborhood average**? → 10/√25 = 2 | Warm-up | Reporting 10 (the individual SD); it's the **standard error** `σ/√n`. |
| Dollar auction: two players alternate $1 bids for a $20 bill, loser also pays | Hard (game) | Reading it as a clean EV problem; it's a **backward-induction / escalation trap** with no clean equilibrium — recognize the paradox. [Quantt 2026](https://www.quantt.co.uk/resources/quant-probability-interview-questions) |
| **Four stones hidden-composition Bayes → now bet on it** (3/4 vs 1/2) | **Hardest tier** | Answering a single number without **stating a prior**; the whole point is defending the composition prior, then sizing a bet on your own estimate. [WSO Oct-2025](https://www.wallstreetoasis.com/company/citadel-securities/interview) |

## 2.5 Hardest tier vs. warm-ups (Citadel)

- **Warm-ups:** standard-error `σ/√n`, best-of-5 EV, a single Bayes inversion.
- **Hardest tier:** **hidden-composition Bayes + bet-on-your-own-answer** (prior-dependence), **adverse-selection market-making with tighter spreads/faster updates**, and game-theoretic escalation traps (dollar auction). Under the clock (15Q/30min), the meta-trap is **starting to calculate before naming the random variable** — most misses come from that. [ExtraBrain 2026](https://extrabrain.app/interview-questions/citadel-hackerrank-questions-extrabrain/)

---

# 3) OPTIVER

## 3.1 Current assessment format + platform (currency check) — Confidence: **High** on battery; **Medium** on module-per-cycle

**Platform:** the Optiver quant battery is a **Zyvo-designed psychometric/skills suite delivered on CodeSignal**, ~**3 hours total, often spread across days**, no calculator, frequently auto-rejecting on submit. [Aptitude-Test-Prep 2026](https://aptitude-test-prep.com/employers/trading-assessments/optiver-assessment/) (names vendor **Zyvo**); [QuantVault 2026](https://quantvault.org/optiver-online-assessment.html) & [Dev.to 26NG 2026](https://dev.to/net_programhelp_e160eef28/optiver-2026-oa-comprehensive-review-26ng-intern-full-guide-eld) (CodeSignal delivery)

**CURRENCY CHECK on "80 in 8" — the premise needs correcting, honestly:** the task framed "80 in 8" as *outdated / replaced*. The **2026 evidence does not support that**. Multiple independent 2026 sources still list **80-in-8 as a live module** (80 mental-arithmetic questions in 8 minutes, +1/−1, no skip): [QuantVault 2026](https://quantvault.org/optiver-online-assessment.html), [Dev.to 26NG 2026](https://dev.to/net_programhelp_e160eef28/optiver-2026-oa-comprehensive-review-26ng-intern-full-guide-eld), [programhelp 2026](https://programhelp.net/en/oa/optiver-2026-oa-quantitative-research-test/), [Aptitude-Test-Prep 2026](https://aptitude-test-prep.com/employers/trading-assessments/optiver-assessment/). What is actually true in 2026 is:
1. **80-in-8 is now often a *separate* screen from the main CodeSignal battery** (the two together form the front gate), and its inclusion is **role/cycle-dependent** — some 2025/26 first-hand quant accounts omit a standalone 80-in-8. So the accurate statement is **"80-in-8 persists but is no longer the *whole* story and may be role/cycle-gated,"** not "80-in-8 is retired."
2. **The battery has EXPANDED** with new modules — the real 2026 change. **Mark as Medium** (still stabilizing across cycles).

**Current 2026 battery (quant trader/researcher track):**

| Module | Format | Tests | Confidence |
|---|---|---|---|
| **80-in-8** (mental arithmetic) | 80 MC Q / 8 min, +1/−1, no skip/back | Raw speed + accuracy | High (format); Medium (universal inclusion) |
| **NumberLogic** (sequences) | ~26 Q / 25 min, 5-option, skip+back nav | Inductive pattern recognition | High |
| **Beat the Odds** (probability/EV) | ~30 Q, **~90 s/Q**, 5-option "pick the closest," +1/−1/0, **no back-nav** (some sittings 10–20 Q) | Fast probabilistic reasoning, family recognition | High |
| **Zap-N** (cognitive games) | 9-mini-game battery, 45–60 min (recent QT/PhD invites sometimes ~3) | Reaction, inhibition, planning, memory, risk | High roster; Medium per-game scoring |
| **Zap-Q** (personality) | ~150 forced-choice items, untimed | Trait profile (non-eliminating) | High (Zyvo-official) |
| **NEW 2026 — Likelihood List** | rank 3 outcomes by probability, ~15 Q × 90 s | Probability ranking under uncertainty | Medium |
| **NEW 2026 — Intervals** | submit a closed interval [lower, upper], ~18 Q × 60 s | Calibrated estimation (scored on tightness + containment) | Medium |
| **NEW 2026 — Order Books** | spot the arbitrage on ~20 boards / 8 min | Fast microstructure/arbitrage spotting | Medium |
| **QR add-on** | 3-problem HackerRank algo round, ~75–90 min (DP/heap/simulation + 1 approximate) | Coding/modeling | Medium-High |

Sources for the battery + new modules: [QuantVault OA 2026](https://quantvault.org/optiver-online-assessment.html), [QuantVault interview 2026](https://quantvault.org/optiver-interview-process.html), [programhelp 2026](https://programhelp.net/en/oa/optiver-2026-oa-quantitative-research-test/), [Aptitude-Test-Prep 2026](https://aptitude-test-prep.com/employers/trading-assessments/optiver-assessment/). The **Zap-N per-game roster** (Shape Shift, Number Box, Balloon/BART, Skyscraper/Tower, Pincode/digit-span, The Switch, Code Compare, Figure It Out) is catalogued in `OPTIVER_2026_DEEP.md` §1.2 — not repeated here.

## 3.2 Interview funnel — Confidence: **High** on structure; **Medium** on exact composition

1. **OA battery** (§3.1) — each section is effectively an **independent gate** (fail one = out). ~6 s/Q sprint regime on 80-in-8; ~90 s/Q reasoning regime on Beat the Odds. [theinterviewden 2026](https://theinterviewden.com/companies/optiver-trading-interview)
2. **Recruiter / phone screen (30–45 min)** — motivational + light probability + a rapid mental-math drill; SpaceComplexity documents a phone "Beat the Odds" block (~10 Q / 15 min). [see `OPTIVER_2026_DEEP.md` §1.3]
3. **Numerical & probability round (30–45 min, trader-led)** — EV problems + probability brainteasers where **reasoning is graded over the final number**. [theinterviewden 2026](https://theinterviewden.com/companies/optiver-trading-interview)
4. **Market-making game (45–60 min — the signature round)** — price a hidden quantity (**often the sum of face-down cards**, or "sum of two dice," "windows on the building"), interviewer *or a competing group* trades against your two-way quote, **cards/info revealed progressively**, you re-quote while tracking position/PnL. Some loops run a fictional-product ("color spinner") **group** version. [techinterview trading-game 2026](https://www.techinterview.org/post/3233476019/optiver-trading-game-rounds/); [techinterview Optiver guide 2026](https://www.techinterview.org/companies/optiver-interview-guide/)
5. **Onsite / Super Day** — harder written math test, probability deep-dive, in-person/group trading sim, **fit round on tilt/handling a loss** ("anyone who claims they rarely make mistakes has failed the question"). [techinterview trading-game 2026](https://www.techinterview.org/post/3233476019/optiver-trading-game-rounds/)

**Signature adversarial move.** In the OA, **the clock + the +1/−1 penalty are the adversary** (skip-vs-guess discipline is itself tested). In the game, **the pickoff is the feedback**: quote too cheap → they lift your ask and you're short at a bad price; too wide → they refuse and tell you to tighten; each reveal forces a re-quote. In fit, they press your loss story for **tilt vs. correction**.

## 3.3 Topic checklist (Optiver)

- [ ] **Raw mental arithmetic** under a ~6 s/Q clock (×, ÷, %, fractions, decimals, negatives) — 80-in-8
- [ ] **Sequence / pattern recognition** (alternating sub-sequences, `a(n)=2a(n-1)+a(n-2)`, difference ladders) — NumberLogic
- [ ] Fast probability/EV with **"pick the closest" estimation** (exact arithmetic often unnecessary) — Beat the Odds
- [ ] Dice/coin/card probability & expected value
- [ ] **Symmetric random walks on polygons** — return time (= n) and hitting times via first-step analysis
- [ ] **Gambler's ruin** (fair and biased)
- [ ] Combinatorics; central-limit-style estimation ("61 coins in 15 boxes")
- [ ] **Optimal stopping** ("see numbers one at a time, pick one"; die-with-one-reroll → 4.25)
- [ ] Conditional probability / **Bayes** (disease false-positive, urn draws, coin-bias)
- [ ] **Calibrated interval estimation** (NEW: Intervals module — quote [L,U], scored on tightness + containment)
- [ ] **Probability ranking** (NEW: Likelihood List)
- [ ] **Arbitrage spotting on order books** (NEW: Order Books module)
- [ ] **Market-making**: spread ∝ uncertainty, update on each reveal/fill, inventory, composure after a bad fill
- [ ] Fermi/estimation → make-a-market
- [ ] (QR) DP / heap / simulation coding

## 3.4 Representative example archetypes, difficulty & traps (cited)

Beat the Odds public examples, [1Point3Acres Optiver 2026](https://www.1point3acres.com/interview/problems/company/optiver/beat-the-odds-probability):

| Archetype (paraphrased) | Difficulty | The trap |
|---|---|---|
| Throw one die twice — P(2nd face ≠ 1st)? (P = 5/6 ≈ 0.83; "pick the closest" of 5 options) | Warm-up | Reading it as "P(same)" (1/6) or fumbling the complement; answer is the complement 1 − 1/6. (Source labels the closest option ~0.75 — treat as a "nearest bucket," not the exact value.) |
| Two dice — P(sum is 11 or 12)? (~0.1) | Warm-up | Off-by-one on outcome counts (3/36). |
| Flip a coin 3× — P(all same)? (0.25) | Warm-up | Forgetting both all-H and all-T (2/8). |
| 61 coins into 15 boxes — P(some box > 4)? (≈1) | Mid | Not seeing the **pigeonhole certainty** (61 > 15×4). |
| Expected **return time to start on a 6-node cycle** ("pick the closest") | Mid | Grinding a chain instead of the closed form **E[return] = n = 6**. |
| Gambler's ruin: start $10, ±$1 on a fair (or 60/40) coin, stop at $20/$0 — P(reach $20)? | Mid→hard | Using the fair formula `k/N` when the coin is biased (needs `(1−r^k)/(1−r^N)`, `r=q/p`). |
| Die paid at face value, **one optional reroll** — value & reroll rule? → **4.25**, reroll 1/2/3 | Mid | Rerolling on the wrong set; keep iff face **beats the fresh-draw EV 3.5**. [techinterview 2026](https://www.techinterview.org/post/3233476019/optiver-trading-game-rounds/) |
| "Sum of two dice — make a market" → they lift your 9, then "one die is a 4" | Hard (round) | Quoting too tight (picked off); **not re-centering** after the reveal (E now 4+3.5=7.5); ignoring the short inventory. [theinterviewden 2026](https://theinterviewden.com/companies/optiver-trading-interview) |
| **Two coupled lattice random walks — P(paths ever intersect)?** | **Hardest tier** | The **parity trap**: "same point at the same *time*" is 0 for odd separation; the intended "paths ever share a vertex" needs a two-particle DP. Anchor verified at **3273/4096 ≈ 0.7991** in `OPTIVER_2026_DEEP.md` Part 3. |

## 3.5 Hardest tier vs. warm-ups (Optiver)

- **Warm-ups:** single-die EV (3.5), "P(all 3 coins same)," pigeonhole certainty, sequence next-term.
- **Hardest tier:** the **lattice-path / random-walk / meeting-probability** family (parity + two-particle DP) and biased gambler's-ruin under the 90-s "pick the closest" clock — plus the **market-making game** where pickoff + progressive reveals punish tight quotes and slow updates. Reports say the Beat-the-Odds pool got **harder in 2025/26** and now includes anchor-style random-walk/meeting problems. [1Point3Acres 2026](https://www.1point3acres.com/interview/problems/company/optiver/beat-the-odds-probability)

---

# 4) CONSOLIDATED TOPIC CHECKLIST (all three firms)

Legend: ● = central/heavily tested · ◐ = tested/secondary · ○ = rare/track-dependent.

| Topic area | Jane Street | Citadel Sec. | Optiver |
|---|---|---|---|
| **Mental arithmetic speed gate** | ● (60Q/8min Zetamac-style) | ◐ (15Q/30min HackerRank sprint) | ● (80-in-8, ~6 s/Q) |
| Sequence / pattern recognition | ○ | ○ | ● (NumberLogic) |
| Expected value (single-step) | ● | ● | ● |
| **Optimal stopping / threshold policies** | ● (bank-or-roll flagship) | ◐ | ● (reroll → 4.25) |
| Conditional probability & **Bayes** | ● | ● (hidden-composition) | ● |
| **Hidden-prior / unknown-composition Bayes** | ◐ | ● (flagship "bet on it") | ◐ |
| Linearity of expectation (indicator counting) | ● | ● | ◐ |
| Combinatorics / draws w/o replacement | ● | ● | ● |
| Convolution / distribution of a sum | ◐ | ● | ◐ |
| Order statistics (max/min/median) | ● | ● | ◐ |
| **Markov chains / hitting & return times** | ● | ● | ● (polygon return = n) |
| **Gambler's ruin** (fair & biased) | ● | ◐ | ● |
| **Random walk / lattice-path / meeting prob** (hardest tier) | ● | ◐ | ● (the anchor) |
| Coupon collector | ◐ | ◐ | ◐ |
| Variance / standard error | ◐ | ● (σ/√n) | ◐ |
| Martingales / optional stopping | ◐ | ◐ | ◐ |
| **Game theory** (zero-sum, equilibrium, escalation traps) | ● (adversary mutation) | ● (dollar auction) | ◐ |
| **Estimation / Fermi** | ● (→ market) | ◐ | ● (Intervals, Fermi→market) |
| **Calibrated interval quoting** | ◐ | ◐ | ● (NEW Intervals module) |
| Probability ranking | ○ | ○ | ● (NEW Likelihood List) |
| **Arbitrage / order-book spotting** | ○ | ◐ | ● (NEW Order Books module) |
| **Market-making game** (spread/update/inventory/adverse selection) | ● | ● (tighter/faster) | ● (pickoff + reveals) |
| Tilt / composure-after-loss (fit) | ◐ | ◐ | ● (explicit) |
| Coding (Python / DS&A) | ◐ (some tracks) | ● (SWE) / ◐ (QR) | ◐ (QR algo round) |

## 4.1 Platform / format one-liners (currency-checked, 2026)

- **Jane Street** — own **~60Q/8-min mental-math gate** (Zetamac-style; *not* a named vendor), + a **HackerRank** OA on some QR/new-grad tracks. Gate is current, not retired.
- **Citadel Securities** — **HackerRank**: **trader ~15Q/30min** short-form probability; **research ~80min**; **SWE 2 problems/70–90min**. Current.
- **Optiver** — **Zyvo-designed battery on CodeSignal (~3 hr)**: 80-in-8 + NumberLogic + Beat the Odds + Zap-N/Zap-Q, **plus NEW 2026 modules (Likelihood List, Intervals, Order Books)**. **"80-in-8" is NOT retired** — it persists (often as a separate screen, role/cycle-gated); the real 2026 change is the *expanded* battery.

## 4.2 Explicit uncertainty / flags

- **Optiver "80-in-8" status:** the strongest correction in this file — 2026 evidence shows it **still exists**, contrary to the "outdated/replaced" framing. Confidence **High** that it persists in some tracks; **Medium** on whether every 2026 quant invite includes it. The *new* Likelihood/Intervals/Order-Books modules are **Medium** (still stabilizing; sourced mainly to QuantVault + candidate write-ups).
- **Jane Street HackerRank OA:** appears for some tracks/cycles (myntbit, InterviewChamp) but the pure math-sprint gate is the more universally reported path — treat the coding OA as **track-dependent (Medium)**.
- **Citadel routing:** which OA you get (15/30 vs 80-min vs 2-coding) depends on trader/research/SWE routing; **Medium** on the exact split per cycle.
- **All timings/cutoffs are directional.** No firm publishes a scoring key. Pass-bar figures (JS 70–85%, etc.) are vendor-recycled and role/cycle-dependent.

---

## Sources (accessed 7 Aug 2026)

**Jane Street:** [janestreet.com/trading-interviews](https://www.janestreet.com/trading-interviews/) (firm-official); [Jane Street mock video](https://www.youtube.com/watch?v=NT_I1MjckaU) (firm-official); [techinterview 2026](https://www.techinterview.org/companies/jane-street/); [theinterviewden 2026](https://theinterviewden.com/companies/jane-street-quant-trader-interview); [myntbit 2026](https://myntbit.com/blog/jane-street-quant-interview-guide-2026); [InterviewChamp QR 2026](https://interviewchamp.ai/interview-questions/jane-street/quant-research-new-grad); [techscreen 2026](https://techscreen.app/articles/jane-street-technical-interview-process-2026).

**Citadel Securities:** [tradinginterview 2026](https://www.tradinginterview.com/courses/company-preparations-course/lessons/citadel-securities/topic/citadel-securities-online-assessment/); [linkjob HackerRank 2026](https://www.linkjob.ai/interview-questions/citadel-hackerrank-questions/); [ExtraBrain 2026](https://extrabrain.app/interview-questions/citadel-hackerrank-questions-extrabrain/); [techinterview coding-OA 2026](https://www.techinterview.org/post/3233474726/coding-oa-patterns-citadel-hrt-jane-street/); [myntbit 2026](https://myntbit.com/blog/citadel-securities-interview-process); [Quantt probability 2026](https://www.quantt.co.uk/resources/quant-probability-interview-questions); WSO Citadel Securities interview (2025 first-hand).

**Optiver:** [Aptitude-Test-Prep 2026](https://aptitude-test-prep.com/employers/trading-assessments/optiver-assessment/) (Zyvo vendor); [QuantVault OA 2026](https://quantvault.org/optiver-online-assessment.html); [QuantVault interview 2026](https://quantvault.org/optiver-interview-process.html); [Dev.to 26NG OA 2026](https://dev.to/net_programhelp_e160eef28/optiver-2026-oa-comprehensive-review-26ng-intern-full-guide-eld); [programhelp 2026](https://programhelp.net/en/oa/optiver-2026-oa-quantitative-research-test/); [theinterviewden 2026](https://theinterviewden.com/companies/optiver-trading-interview); [techinterview trading-game 2026](https://www.techinterview.org/post/3233476019/optiver-trading-game-rounds/); [techinterview Optiver guide 2026](https://www.techinterview.org/companies/optiver-interview-guide/); [1Point3Acres Beat-the-Odds 2026](https://www.1point3acres.com/interview/problems/company/optiver/beat-the-odds-probability).

**Cross-firm:** [techinterview mental-math 2026](https://www.techinterview.org/post/3233474557/mental-math-trading-interviews/); [techinterview difficulty index 2026](https://www.techinterview.org/quant-firm-interview-difficulty-index/). Verified math/answers referenced throughout live in `JANE_STREET_2026_DEEP.md`, `OPTIVER_2026_DEEP.md`, and `TOP_FIRMS_2026_DEEP_A.md`.
