# SIG · IMC · DRW — Current (2026) Quant-Trader Assessment & Interview Profiles

**Compiled:** 7 Aug 2026. **Scope:** three firms — **SIG (Susquehanna)**, **IMC Trading**, **DRW** — quant-**trader** (and closely-adjacent QR/QT) track only. Fresh live WebSearch/WebFetch pass (Aug 2026), built on and cross-checked against the repo's `TOP_FIRMS_2026_DEEP_A.md` (deep archetype catalog + exact verified answers) and `FIRM_INTERVIEW_LIVE_RESEARCH_2026.md`.

**Confidence key.** **High** = firm-official and/or ≥2 independent dated 2025–2026 primary reports agree. **Medium** = consistent across aggregators + some primary confirmation. **Low** = single/old/lead-gen source. **Counts/timings are directional shapes** — no firm publishes a scoring key.

**No-fabrication rule.** Only public/reported archetypes are cited. Where a source conflicts or a claim is thin it is flagged inline. Exact numeric answers to example archetypes are computed/verified in `TOP_FIRMS_2026_DEEP_A.md` and cross-referenced by ID (S1–S3, I1–I4, D1–D4) rather than re-derived here.

---

## At-a-glance (2026)

| Firm | Current OA + PLATFORM | OA shape | Calc? | Signature live round | Adversarial move | Conf. |
|---|---|---|---|---|---|---|
| **SIG** | **Mercer\|Mettl "Problem Solving Assessment"** (aka SIG Online Assessment) | ~9–15 (some report 17) open-answer Q / **60 min**; non-integer → **simplified fraction**; 7-day window | **Yes** (calc + pen/paper) | **Poker / decision-theory round** | "How confident? How much would you bet?" → **twist the payout rule** | High |
| **IMC** | **Unified HackerRank "Hiring Assessment"** (2026 restructure: was multi-platform) | Trader: timed **mental-math** batch (50–80 Q) + prob + sequences/patterns; **Trading Game now mandatory for quant** | **No** | **Make-a-market game** (dice sum / marble urn) + **group** version on superday | **Trades against you repeatedly; challenges a *correct* answer** | Med-High |
| **DRW** | HackerRank-style OA (multiple-choice, free-nav) | **6 Q / 45 min** (~7.5 min/Q), often **1 ~unsolvable**; **+1 correct / 0 wrong / 0 skip** (no negative marking) | Pen/paper; some tracks allow **Python/numpy** | 1:1 **market-making mock** + defend-a-derivation | **Leave-the-unsolvable-blank triage**; defend a result under a new constraint | High |

> **Two timing regimes to keep separate** (universal across these firms): **(A) arithmetic sprint** ~5–8 s/Q (IMC mental-math gate) — pure speed+accuracy; **(B) reasoning** ~90 s–7.5 min/Q (SIG OA, DRW OA, all market-making rounds) — where framing and updating decide.

---

# 1) SIG / Susquehanna — Confidence: **High** (firm-official corroboration)

## 1.1 Current OA format + PLATFORM (flag outdated vs current)

- **Current platform: Mercer\|Mettl** (a.k.a. "Mettl"), test titled **"SIG Problem Solving Assessment"** (also marketed as the **SIG Online Assessment**). **~9–15 open-answer questions in 60 minutes** (one prep vendor's simulator uses 17). **Calculator + pen/paper allowed**; non-integer answers must be submitted as a **most-simplified fraction**; **7-day** window to complete; navigating out of the test window / opening a new tab **auto-submits**. [jobtestprep.com/sig-online-assessment; jobtestprep.co.uk/sig-online-tests; aptitude-test-prep.com SIG Problem Solving Assessment — all 2026] — **High**.
- **⚠️ Outdated-format flags (important — two tests still circulate):**
  - The **"SIG Quantitative Evaluation"** (older: **14 Q / 20 min**, logic/brainteaser, linear systems, grid path-finding) is described by JobTestPrep as **"no longer in use / supplanted"** by the 60-min Problem Solving Assessment [jobtestprep.com 2026] — but **Tradermath (2026)** reports it **is still issued to some full-time applicants** while **interns get the 60-min Problem Solving Assessment**. **Net:** treat the **60-min calculator-allowed Problem Solving Assessment as the current default**, but do **not** assume the 20-min brainteaser Evaluation is dead — role/region dependent. **Confidence Med-High** on the split.
  - **⚠️ Conflicting shape:** Quantt (2026) describes a **"30–50 question / 60–75 min, no-calculator, speed-decides"** SIG quant test. This **conflicts** with the far-better-corroborated **9–17 Q / 60 min, calculator-allowed** format from JobTestPrep + Aptitude-Test-Prep + SIG's own low-question-count design. Treat the Quantt count as **Low / likely conflated** with a different vendor test.
- **Content of the OA:** heavily **probability, especially expected value**; plus **combinatorics**, **deductive/logic** (≥1 pure-logic item), and **single-variable calculus** (≥1 item). Design intent: test **problem framing** ("understand a problem and sketch optimal routes"), not arithmetic speed (hence the calculator). [jobtestprep.com; aptitude-test-prep.com 2026] — **High**.

## 1.2 Full interview funnel/stages

1. **Resume screen** → 2. **OA** (Mercer\|Mettl Problem Solving Assessment, above). *(Some new-grad/QR tracks report a ~90-min HackerRank technical screen instead of/alongside — [InterviewChamp.AI SIG QR New-Grad 2026, Low-Med].)*
3. **Recruiter / phone screen** (~5 probability/EV questions, ~45 min; **reasoning valued over the final number**). [jobtestprep.com; quantblueprint.com 2026]
4. **First-round technical** (45–60 min: probability, game theory, strategic reasoning; may include a worked poker hand). [quantblueprint.com 2026]
5. **Super Day** — full day at a SIG office (**Bala Cynwyd PA** HQ, or London/Dublin/Hong Kong/Sydney), **4–6 back-to-back 30–45 min rounds**: a probability/EV round, one or more **poker/game-theory** rounds, a **market-making** round, and a behavioral conversation; deliberately fatiguing; lunch with traders. [theinterviewden.com; quantt.co.uk 2026]
6. **Poker / decision-theory round** (trader roles) — near-universal; sometimes on the super day, sometimes a **separate evening event**. **A tutorial is provided at the start**, so **no prior poker skill is assumed**. [quantt.co.uk; theinterviewden.com; sig.com Game-Theory page — firm-official]

**Timeline:** ~4–8 weeks (5–8 per some new-grad reports); compresses during Sept–Nov campus season.

## 1.3 EXACT topics tested (checklist)

- ☑ **Expected value** (the OA's dominant topic; card/dice bet-pricing) — **High**
- ☑ **Probability & conditional probability / Bayesian updating** — **High**
- ☑ **Combinatorics** (≥1 OA item) — **High**
- ☑ **Single-variable calculus** (≥1 OA item — optimization/integration) — **High**
- ☑ **Deductive logic / puzzle** (≥1 OA item) — **High**
- ☑ **Optimal stopping** (bank-or-roll, one-optional-reroll EV) — **Med-High**
- ☑ **Betting / Kelly / bet-sizing to edge** (poker round core) — **High**
- ☑ **Pot odds / fold equity / bluff frequency as GTO equilibrium** — **High**
- ☑ **Confidence calibration** ("70% because…") — **High** (culturally central)
- ☑ **Mental math** (2-digit ×, %s in ~5 s — peppered through the day *despite* the OA calculator) — **High**
- ☑ **Market-making intuition** (two-sided quote, adverse selection) — **Med-High**
- ☑ **Markov-chain-structured probability** (state equations) — **Med** [InterviewChamp.AI 2026]
- ◻ Sequences — **Low** for SIG specifically (belongs to IMC/Optiver; only in the Low-confidence Quantt description)

## 1.4 Representative PUBLIC archetypes (difficulty + traps)

- **Warm-up (easy).** *"Flip a coin until two heads in a row — expected number of flips?"* Answer **6** (E = 2 + 4 via states). Trap: forgetting the partial-progress state. [techinterview.org SIG 2026]
- **Easy–medium.** *"Make a market on the number of dominoes in a standard set"* / Fermi→market prompts. Trap: quoting a mid without a spread; not updating when traded against. [techinterview.org SIG 2026]
- **Medium (EV bet-pricing, the SIG staple).** *"Win \$20 w.p. 0.6, lose \$15 w.p. 0.4 — take it? What would you pay for the right to take it?"* EV = 0.6·20 − 0.4·15 = **+\$6** → pay up to ~\$6. [quantblueprint.com 2026] → maps to **archetype S1**.
- **Medium (pot odds).** *"You have 30% to win; pot \$100, opponent bets \$50 — call?"* Call if 30% > 50/(100+50+50) = 25% → **call**. Trap: comparing to 50/100 instead of the correct pot-odds denominator. [techinterview.org; quantblueprint.com 2026] → **S3**.
- **Hardest-end (the crown-jewel adversarial cascade):**
  1. **Confidence→bet-size probe.** After any answer: *"How confident — 60%? 90%? OK, how much of your bankroll?"* If stated confidence ≠ true probability, they **offer a bet at exploitative odds** and let miscalibration surface. Want **Kelly-style sizing to edge**, not gut. → **S2** (verified: p=0.6, b=1 → f\*=0.20; betting 2f\*=0.40 gives *negative* growth). [techinterview.org; quantblueprint.com; quantt.co.uk 2026]
  2. **Twist the payout rule live.** *"Now you may pay to discard and redraw"* / *"draw two, keep the higher."* Must **recompute EV cleanly without anchoring**. → **S1** (deck 1–13: keep-max-of-2 = 119/13 ≈ 9.15; one optional redraw = 112/13 ≈ 8.62).
  3. **Bluff-frequency equilibrium.** Solve villain's GTO bluff rate + hero's call rate via mutual indifference. → **S3** (pot 6, bet 3 → bluff **1/4**, call **2/3**).
  4. **Luck probe.** A lucky-looking correct answer gets probed *harder*: *"would you bet on that reasoning?"*
- **Common traps:** (a) reaching for a formula before **framing** (a wrong first step cascades on heavy open-answer cards with no feedback); (b) stated confidence not matching realized probability; (c) over-betting past Kelly; (d) failing to submit a **simplified fraction** on the OA.

**SIG grading:** framing > calibration > bet-sizing-to-edge > Bayesian updating > willingness to admit a wrong read > composure > raw arithmetic. "A candidate who says 'I'm 70% confident it's ~4.2, here's why' beats one who says '4.2' flat." [quantt.co.uk 2026]

**Sources (SIG):** SIG *Game Theory + Decision Science* careers page (firm-official — poker as a decision-under-uncertainty teaching tool; tutorial provided); jobtestprep.com/.co.uk *SIG Online Assessment* (2026, High for OA — Mettl, 9 Q/60 min, calculator, simplified-fraction rule, Quantitative-Evaluation-retired note); aptitude-test-prep.com *SIG Problem Solving Assessment* (2026, 9–15 Q/60 min, 7-day window, auto-submit); tradermath.org *SIG Interview Guide* (2026 — two-test split: 20-min Evaluation for some FT vs 60-min/17-Q Problem Solving for interns); techinterview.org *SIG Interview Guide* (2026 — two-heads EV, 30%/pot-odds, dominoes market); quantt.co.uk *SIG Interview* (2026 — poker round, calibration culture; **⚠️ 30–50 Q OA count flagged Low**); theinterviewden.com *SIG Trading Interview* (2026 — super-day 4–6×30–45 min, poker round, Bala Cynwyd); quantblueprint.com *How to Get a Job at SIG 2026* (\$20/\$15 bet, Kelly); interviewchamp.ai *SIG QR New-Grad 2026* (Low-Med — HackerRank screen, "SIG game").

---

# 2) IMC Trading — Confidence: **Medium-High** (concrete game examples corroborated; 2026 platform restructure)

## 2.1 Current OA format + PLATFORM (flag the 2026 change)

- **Current platform: HackerRank**, and the **big 2026 change** is a **consolidation into a single "Hiring Assessment"** — what used to live across multiple platforms is now one HackerRank-led entry. Reported structure for quant/trader: **Coding + Math + a Trading Game**, and **the Trading Game has moved from *optional* to *mandatory* for quant roles** (Optiver-style simplified matching UI, scored on avg bid-ask spread profit, max drawdown, time-weighted net position). The **Math stage (~30 min)** skews **probability + game theory + geometry/combinatorics** (not just arithmetic). [oavoservice.com *IMC Hiring Assessment Debrief 2026* — Medium, 15 recent candidate reports]. — **Medium** (single aggregator for the exact restructure; corroborated in spirit by others below).
- **Trader-track gate is still the timed mental-math test** (the decisive filter): a **large batch of arithmetic (≈50–80 Q)** — two-digit multiplication (37×48, 84×26), percentages (17% of 1,240), fractions (7/13 as a decimal), division — on a **short, hard clock (~a few sec/Q), no calculator**, **plus probability + pattern/sequence** items. **Graded on accuracy-under-speed** (no partial credit; fast-but-sloppy loses to slightly-slower-clean). **Pass ~20–25%.** [theinterviewden.com; quantt.co.uk; techinterview.org 2026] — **High**.
- **Region/edition variation (flag):** Tradermath's **Mumbai "Launchpad" 2026** OA reports **4 sections**: Coding (~20 min, one hard-LeetCode string problem), **Quant puzzles (~45 min, ~20 prob/brainteaser Q)**, **Matrix pattern (~10 min, ~10 visual Q)**, **Sequences (~10 min, ~20 number-sequence Q)**. Chicago/Amsterdam/Sydney "lean more toward simulations & networking." **So IMC's OA is not one fixed form — it varies by role/region/edition.** [tradermath.org *IMC Launchpad Guide* 2026] — **Medium**.
- **Entry via IMC Prosperity trading challenge** fast-tracks strong performers past parts of the funnel. [techinterview.org 2026] — **Medium**.

## 2.2 Full interview funnel/stages

1. **Application** (or **Prosperity** fast-track) → 2. **Hiring Assessment** (HackerRank: coding + math + trading game; trader gate = mental-math batch).
3. **Recruiter / behavioral call** (~30 min: why market-making, why IMC, how you handle being wrong). [oavoservice.com 2026]
4. **First technical** — **market-making game**: quote a two-sided market, update on order flow. [techinterview.org 2026]
5. **Second technical** — deeper market-making + brainteasers + **options-related** questions (Greeks / put-call parity intuition) for traders; for quants, harder trading-PnL review / probability. [techinterview.org; oavoservice.com 2026]
6. **Onsite Super Day** — Amsterdam / Chicago / Sydney; **4–5 back-to-back 45-min rounds** + a **live trading game**, frequently a **GROUP** version (candidates trade *with and against each other* in a simulated market; interviewers score both individual PnL and **teamwork/communication**). Final-round hiring-manager weight reportedly ~30%. [quantblueprint.com; everythingquant.com; oavoservice.com 2026]

**Timeline:** ~4–6 weeks. **Meritocratic note:** OA is widely regarded as school-agnostic — a very high OA score advances candidates regardless of pedigree (policy varies, not guaranteed). [quantt.co.uk 2026]

## 2.3 EXACT topics tested (checklist)

- ☑ **Mental math** — 2-digit ×, %s, fractions, division, at a few sec/Q (**the gate**) — **High**
- ☑ **Number sequences / pattern recognition** (incl. matrix/visual patterns) — **High**
- ☑ **Probability & conditional probability / Bayesian updating** (dice/cards) — **High**
- ☑ **Expected value** (fair-value-of-a-bet; one-optional-reroll die EV = 4.25) — **High**
- ☑ **Market-making intuition** (spread width, inventory, adverse selection, order-flow inference) — **High**
- ☑ **Game theory** (simple you-vs-optimal-opponent; first-mover-no-edge / Nash) — **Med** [oavoservice.com 2026]
- ☑ **Geometry / combinatorics** (Math stage) — **Med**
- ☑ **Order statistics** (max/median of dice for make-a-market) — **Med-High**
- ☑ **Betting / sizing** ("pays 10 to lose 1 at prob p — take it? size it?") — **High**
- ☑ **Options basics** (Greeks, put-call parity — later trader rounds) — **Medium**
- ☑ **Coding** (one hard-LeetCode-style problem in the unified assessment) — **Med** (weight varies by track/region)
- ◻ Markov chains / martingales — **Low** for IMC specifically (appears as generic "probability brainteasers," not a named focus)

## 2.4 Representative PUBLIC archetypes (difficulty + traps)

- **Gate (sprint, ~few sec/Q).** *17×23* → (20−3)·23 = 460−69 = **391**; *17% of 1,240*; *7/13 as a decimal*. Trap: sloppiness — 88% right loses to the person who got 95% faster. [theinterviewden.com; techinterview.org 2026]
- **Easy–medium (EV).** *"Roll a die with one optional re-roll — expected value?"* → **4.25** (reroll iff first < 3.5). Trap: forgetting the threshold policy. [techinterview.org IMC guide 2026] → **archetype S1/I3**.
- **Medium (make-a-market on a dice sum — the signature).** *"Two dice behind a screen; I pay you the sum. Quote a market."* Fair value **7** → quote e.g. **"6 at 8."** They **lift your offer at 8** → *noise or signal?* If fully-informed flow, `E[sum | sum>8] = **10**` — reprice around 10, not 7; if informed w.p. q, the update is smaller (q=½→~8.07, ¾→~8.88). Then a reveal: *"one die is a 4"* → true `E = 4 + 3.5 = **7.5**`, requote **accounting for your position**. Trap: anchoring to 7 after being lifted; quoting so wide it's useless. [techinterview.org; theinterviewden.com 2026] → **archetype I1**.
- **Medium–hard (make-a-market on an urn).** *"100 marbles, unknown red/blue split; I pay you the number of reds. Make a market."* No-info EV **50** → ~"45 at 55"; if they **keep selling to you at 55**, count is probably low → **skew down** (hypergeometric-Bayes posterior after seeing draws). Trap: not updating the *whole* market after repeated one-sided flow. [quantt.co.uk 2026] → **archetype I2**.
- **Hardest-end / behavioral adversarial:**
  1. **Trades against you repeatedly** and watches **adjust-vs-anchor**.
  2. **Challenges a *correct* answer** ("Are you sure? That looks aggressive.") — you must **hold when the math is right** but **update on real information**. (Deadpan pressure on a correct +EV take.) → **archetype I3** (+10/−1 bet: break-even p = 1/11; hold your ground).
  3. **Deliberately ambiguous questions** to test whether you **ask for clarification**.
  4. **Group trading game** — do you share information while competing? Composure? Leadership?
- **Common traps:** freezing; quoting a mid with no spread (or a spread so wide there's no market); anchoring after being picked off; caving on a correct answer; not managing accumulated inventory; silent solving (narration is explicitly rewarded — "that sentence gets you further than a correct but silent answer").

**IMC grading:** sensible **spread width** (widen when uncertain, tighten with edge) > **updating on order flow** > **not freezing** > **narrating out loud** > **inventory awareness** > stamina. Speed+accuracy gate first, or you never reach the game.

**Sources (IMC):** oavoservice.com *IMC Hiring Assessment Debrief 2026* (Medium — unified HackerRank Hiring Assessment; **Trading Game now mandatory for quant**; Math = prob+game-theory+geometry); techinterview.org *How IMC interviews traders vs engineers* + *IMC Trading Interview Guide* (2026 — mental-math gate, "6 at 8" dice game with lift-your-offer inference, superday trading game, options in later rounds); theinterviewden.com *IMC Trading Interview* (2026 — mental-math the decisive filter, dice-sum flow with "one die is a 4 → 7.5" reveal); quantt.co.uk *IMC Trading Interview* (2026 — 50–80 mental-math Q/60–75 min, ~20–25% pass, 100-marble urn, challenge-correct-answers); quantblueprint.com *How to Get a Job at IMC 2026* (Medium — **group** trading exercise as signature superday component); everythingquant.com *Quant Trader at IMC* (2026, Low-Med — group in-house trading simulation on final day); tradermath.org *IMC Launchpad Guide* (2026 — Mumbai 4-section OA breakdown).

---

# 3) DRW — Confidence: **High** (multiple 2025–2026 first-hand reports incl. a Dec-2025 full review)

## 3.1 Current OA format + PLATFORM

- **HackerRank-style OA**, **~6 questions / 45 minutes** (~7.5 min/Q; some tracks 6–8 Q / 45–60 min). **Multiple-choice, free navigation (answer in any order), skipping allowed.** **Scoring: +1 correct / 0 wrong / 0 skip — no negative marking**, so **guessing a hard/unsolvable item costs nothing** (contrast Optiver's penalty). **No calculator; pen/paper OK; some tracks allow Python/numpy/scipy** for numerical optimization → a **reusable code template saves minutes**. Content is **tightly aligned to DRW's businesses** (liquidity providing, risk-taking, latency-sensitive trading): **math reasoning, probability & statistics, linear algebra, calculus basics, recursion/DP & state modeling, brainteasers.** [tradinginterview.com *DRW Online Assessment* (format: MC, free-nav, +1/0/0); dev.to *DRW 2026 Summer Quant/QR Intern OA Full Review* (Dec 2025); everythingquant.com forum 2026] — **High**.
- **⚠️ Flag:** DRW's OA is **not** the arithmetic-sprint style — it is the **reasoning regime** (7.5 min/Q, genuinely hard, LA/DP-heavy). "The OA does **not** test whether you can solve hard problems — it tests whether you can solve **practical** math problems **quickly and accurately** under pressure." **Hesitation is more dangerous than difficulty**, and **triage** (recognizing the ~unsolvable item and *not* burning time) is itself scored — candidates report **leaving one blank and still advancing**. [dev.to Dec-2025 review; WSO 2025] — **High**.

## 3.2 Full interview funnel/stages

1. **Application** → 2. **OA** (6 Q / 45 min, above). *(Some new-grad/QR reports: 60-min HackerRank coding/math test.)*
3. **Recruiter screen** (behavioral + mental math). [FIRM_INTERVIEW_LIVE_RESEARCH_2026.md; WSO 2025]
4. **First-round phone** (probability + mental math). [interviewchamp.ai DRW QR 2026]
5. **Technical 1:1s** — deeper probability/stats; for **traders a market-making mock** + several brainteasers; for QR, regression/time-series/ML + project deep-dive; sometimes a **puzzle round with no time limit**. [techinterview.org; quantt.co.uk; interviewchamp.ai 2026]
6. **Onsite Super Day** — **Chicago HQ** (or NY/London; virtual equivalent), **4–6 back-to-back 45-min interviews** with traders/quants/seniors; for traders a **trading game / market-making simulation**; **desk-specific content** (Treasuries → yield curves/Fed; equity options → Greeks/vol surface; crypto/**Cumberland** → blockchain mechanics/microstructure); **culture-fit is weighted heavily** (strong tech + weak fit can still be rejected). [techinterview.org; quantt.co.uk; interviewchamp.ai 2026]

**Timeline:** ~3–6 weeks; compressed Chicago onsites can yield same-week decisions.

## 3.3 EXACT topics tested (checklist)

- ☑ **Probability & conditional probability** — **High**
- ☑ **Expected value** (incl. recursive/absorbing-state EV) — **High**
- ☑ **Recursion / dynamic programming & state modeling** — **High**
- ☑ **Markov chains** — steady state (solve πP = π) **and** expected hitting time — **High** (explicitly named across reports)
- ☑ **Linear algebra** (null space, projection, L2 norm, matrix ops — **heavier than most trader shops**) — **High**
- ☑ **Statistics / distributions** (Normal reasoning; **quantization** — minimize E[(X−Q(X))²]) — **High**
- ☑ **Calculus basics** (single-variable) — **Med-High**
- ☑ **Order statistics / convolution** (sum-of-distributions) — **Med**
- ☑ **Deliberately-underdetermined "unsolvable" item → triage** — **High**
- ☑ **Market-making intuition** (later rounds: spread ∝ uncertainty, inventory, adverse selection) — **High**
- ☑ **Mental math** (recruiter screen + sprint round) — **High**
- ☑ **Game theory** (2×2 zero-sum mixed Nash — reported as an OA/technical item) — **Med** [prachub.com 2026]
- ☑ **Desk-specific market knowledge** (yield curves, Greeks, crypto microstructure) at onsite — **Med-High**
- ◻ Martingales / optional stopping — **Low** (implied by DP/stopping items, not named)

## 3.4 Representative PUBLIC archetypes (difficulty + traps) — several are real 2026 OA items (paraphrased)

- **Warm-up (easy).** *"A biased coin lands heads w.p. 0.8; each head pays \$80. Expected payout over 100 flips?"* → 100·0.8·\$80 = **\$6,400** (linearity of expectation). Trap: overcomplicating a pure-linearity item under time pressure. [dev.to Dec-2025; programhelp.net 2025/26]
- **Medium (linear algebra).** *"Given matrix A and vector y, find the null space of A, project y onto it, and report the L2 norm of the projection."* Trap: this is where **Python/numpy** (if allowed) beats hand computation. [dev.to; programhelp.net 2026]
- **Medium–hard (statistics / quantization).** *"X ~ N(0, 3). Define Q(x)=c if x≥0, −c if x<0. Choose c to minimize E[(X−Q(X))²]."* → c = E[X | X≥0] = σ·√(2/π). Trap: minimizing the wrong objective; forgetting the half-normal mean. [dev.to; programhelp.net 2026]
- **Hard (recursion / DP landing probability — real OA item).** *"Start at step 0; Heads → +1, Tails → +2. pₙ = prob you ever land exactly on step n. Compute 1000·(p₄ + p₁₀)."* → pₙ = ½p_{n−1} + ½p_{n−2}; closed form pₙ = 2/3 + (1/3)(−1/2)ⁿ; **p₄ = 11/16, p₁₀ = 683/1024 → 1000·(p₄+p₁₀) ≈ 1354.49**. Trap: not seeing the order-2 recurrence / the 2/3 long-run density. [dev.to; programhelp.net 2026] → **archetype D2**.
- **Hard (recursive expectation with a RESET — real OA item).** *"Roll a fair 7-sided die to collect all 7 faces; after you have 6, rolling a seen face resets you to 0 (rolls still count). Expected rolls?"* → E₀ = 7 + 7·a with a = 7(1+½+…+⅙) = 223/20 → **E = 1701/20 = 85.05** (vs plain coupon-collector 7·H₇ ≈ 18.15 — the fragile 7th face inflates it ~4.7×). Trap: treating it as ordinary coupon-collector; missing the reset edge coupling state 6 back to 0. [dev.to; programhelp.net 2026] → **archetype D3**.
- **Hard (Markov).** *"Given transition matrix P, compute the stationary distribution π (solve πP = π, Σπᵢ = 1) and state why it's unique"* / expected hitting time (e.g. cube-antipode = **10 steps**). Trap: forgetting the normalization constraint; not checking irreducibility/aperiodicity for uniqueness. [prachub.com 2026] → **archetype D1**.
- **Hardest-end (the ~unsolvable item).** One OA item is **essentially unsolvable / underdetermined in the time given** — **the correct move is to flag it, leave it blank (0 cost under the no-penalty scoring), and bank the time.** Candidates report doing exactly this and still advancing. → **archetype D4** (defend-the-assumption / triage). [WSO 2025; dev.to Dec-2025]
- **Common traps:** poor **time allocation** (getting stuck on one brainteaser blows the 7.5-min budget); brute-force algebra where a **symmetry/invariant** collapses the problem (DRW interviewers "love a clean structure — pause before grinding"); **not asking clarifying questions** in 1:1s (a top-cited no-hire); weak **culture-fit / "why DRW (this desk/asset class)"** signal.

**DRW grading:** correct computation **fast** under severe time pressure > **triage/decisiveness** > mathematical fundamentals (LA/Markov/DP over tricks) > asks clarifying questions > (onsite) market-making risk intuition ("start wide, tighten as you learn") > **culture fit**.

**Sources (DRW):** dev.to (net_programhelp) *DRW 2026 Summer Quant/QR Intern OA Full Review* (**Dec 2025**, Medium — 6 Q/45 min; LA null-space/projection, N(0,3) quantization, coin-step DP, 7-die reset; "solve practical problems quickly"); programhelp.net *DRW Intern OA 26 Summer* (2025/26, Low-Med — same 5 items incl. coin-expectation warm-up, LA projection, quantization, reset, coin-step DP); tradinginterview.com *DRW Online Assessment* (2026 — **MC format, free-nav, +1/0/0 scoring, no-calculator**); everythingquant.com forum *DRW OA Difficulty & Timelines* (2026 — 6–8 Q/45–60 min, 3–4 wk process); WSO *DRW Interview Questions* (2025 first-hand — Markov OA item; "one impossible, left it blank, still advanced"); techinterview.org *DRW Interview Guide* (2026 — trader onsite = market-making mock + brainteasers; Cumberland crypto desk; recruits USAMO/Putnam); quantt.co.uk *DRW Interview 2026* (Medium — 60–75 min trader OA, super-day 4–6×45 min, desk-specific content, yield-curve example); interviewchamp.ai *DRW QR New-Grad 2026* (Low-Med — funnel, no-time-limit puzzle round, culture-fit weight); prachub.com *DRW Markov steady-state* (2026 — πP=π + 2×2 zero-sum mixed Nash).

---

# 4) CONSOLIDATED TOPIC CHECKLIST (all three firms)

Legend: ● = core/heavily-tested · ○ = appears/secondary · — = not a named focus. Confidence in the per-firm sections above.

| Topic | SIG | IMC | DRW | Notes |
|---|:--:|:--:|:--:|---|
| **Mental math** (2-dig ×, %, fractions, ~5 s/Q) | ○ (day-of, despite OA calc) | ● (**the gate**) | ○ (screen + sprint) | IMC = pure speed filter; SIG/DRW use it but it's not the differentiator |
| **Expected value** | ● | ● | ● | Universal core; SIG frames *everything* as a bet |
| **Probability & conditional / Bayes updating** | ● | ● | ● | Order-flow inference (IMC), hidden-info updates (SIG) |
| **Combinatorics** | ● | ○ | ○ | Named OA topic at SIG |
| **Markov chains** (steady-state & hitting time) | ○ | — | ● | DRW explicitly names it; SIG "state-equation" flavored |
| **Recursion / DP & state modeling** | ○ | ○ | ● | DRW OA staple (coin-step DP, reset EV) |
| **Linear algebra** (null space, projection, matrices) | — | ○ | ● | DRW **heavier than most trader shops** |
| **Single-variable calculus** | ● (≥1 OA item) | ○ | ○ | SIG OA guarantees a calculus item |
| **Statistics / distributions** (Normal, quantization) | ○ | ○ | ● | DRW quantization item; Normal reasoning |
| **Order statistics** (max/min/median) | ○ | ● (make-a-market) | ○ | IMC max-of-2-dice market (161/36 ≈ 4.47) |
| **Optimal stopping** (bank-or-roll, one reroll) | ● | ● (die reroll 4.25) | ○ | |
| **Estimation / Fermi → market** | ● | ● | ● | Universal make-a-market prompt |
| **Game theory** (2-player, Nash, bluff freq) | ● (poker/GTO) | ○ (you-vs-optimal) | ○ (2×2 zero-sum) | SIG deepest (poker culture) |
| **Betting / Kelly / confidence-to-bet** | ● (**signature**) | ● (size-the-bet) | ○ | SIG's crown jewel: calibration + Kelly sizing |
| **Market-making intuition** (spread, inventory, adverse selection) | ● | ● (**signature**) | ● (onsite mock) | The single highest-signal live round at all three |
| **Brainteasers / puzzles / deductive logic** | ● (≥1 OA logic item) | ● | ● | DRW includes a deliberate ~unsolvable one |
| **Sequences / pattern recognition** | — (Low-conf only) | ● | ○ | IMC OA has a dedicated sequences/matrix section |
| **Martingales / optional stopping** | ○ | — | ○ | Implicit in stopping/DP items; rarely named |
| **Options basics** (Greeks, put-call parity) | ○ (SIG is a big options MM) | ○ (later trader rounds) | ○ (equity-options desk) | Firm/desk-dependent; not a no-prereq core |
| **Coding** (Python/LeetCode) | ○ (some QR HackerRank) | ● (unified HA) | ○ (Python allowed on some OA tracks; SWE/QR heavier) | |

## Cross-firm signature differentiators (what to drill per firm)

- **SIG →** *Think in bets.* **Confidence calibration + Kelly bet-sizing + poker/pot-odds equilibria + EV bet-pricing with live payout twists.** Score **calibration and sizing-to-edge above the number.** OA reasoning-regime with a calculator (framing, not speed). Archetypes **S1–S3**.
- **IMC →** *Make a market, fast.* **Mental-math gate (pass it or you're out) → order-flow-Bayesian make-a-market (dice sum / marble urn) + the "hold-when-right-but-update-on-real-info" behavioral + a GROUP trading game.** Archetypes **I1–I4**.
- **DRW →** *Practical math, fast, with triage.* **6 Q / 45 min reasoning sprint: probability, DP/recursion, Markov, and unusually heavy linear algebra — plus one ~unsolvable item where leaving it blank (0 penalty) and banking time is the correct, scored move.** Python/numpy on some tracks. Archetypes **D1–D4**.

---

## Confidence & conflict ledger (self-assessment)

- **High:** all three funnels (SIG firm-official + 2026 guides; IMC concrete game examples across ≥3 guides + 2026 restructure report; DRW dated Dec-2025 full review + 2025 WSO first-hand); the signature adversarial moves; DRW's exact OA scoring (+1/0/0) and specific 2026 OA items.
- **Medium:** exact OA question counts/timings/cutoffs (vendor-recycled, directional); IMC's precise unified-Hiring-Assessment structure (single strong aggregator, oavoservice); IMC's region/edition variation.
- **Flagged conflicts:** **(1) SIG OA count** — 9–15 (JobTestPrep/Aptitude-Test-Prep, well-corroborated) vs 17 (Tradermath simulator) vs **30–50/no-calc (Quantt — treated Low/likely conflated)**. **(2) SIG two tests** — 60-min calculator-allowed Problem Solving Assessment (current default) vs the older 20-min Quantitative Evaluation (JobTestPrep says retired; Tradermath says still issued to some FT applicants). **(3) DRW OA reset-rule wording** — the 7-die-reset item is paraphrased from a Dec-2025 review; the clean, fully-specified version solved here (85.05) may differ in detail from the literal OA.
- **No fabrication:** every archetype traces to a cited public/reported source; exact numeric answers are the ones computed and Monte-Carlo-cross-checked in `TOP_FIRMS_2026_DEEP_A.md`.
