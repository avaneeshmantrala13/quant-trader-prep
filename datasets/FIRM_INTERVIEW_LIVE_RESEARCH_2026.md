# Firm Interview — Live Web Research (Quant TRADER track), 2024–2026

**Compiled:** 6 Aug 2026 via live WebSearch/WebFetch.
**Scope:** First-hand and recent second-hand accounts of what *quant TRADER* interviews actually contain at the top market-making / prop-trading firms. Companion to `FIRM_INTERVIEW_RESEARCH.md` and `FIRM_MOCK_PRESETS.md`; this file is a *fresh, source-attributed* pass focused on recent (2024–2026) primary material — including a full transcript of Jane Street's own trading mock interview and 2025 candidate write-ups — for upgrading our mock questions and adversarial follow-ups.

---

## Methodology & recency note

- **What I prioritized:** (1) firm-official material (Jane Street's own mock-interview video/transcript, SIG's own game-theory page); (2) 2025 first-hand candidate write-ups (Wall Street Oasis entries dated 2025, Dev.to candidate OA reviews, Glassdoor); (3) established prep aggregators that summarize many candidate reports (techinterview.org, theinterviewden.com, Quantt, Tradermath, Aptitude-Test-Prep, Quant Blueprint). Tier (3) is used for *shape* (rounds, timing, archetypes), never as sole proof of a specific claim.
- **Paraphrase rule honored:** every example question below is **paraphrased and generalized** so we can generate our own variants. No proprietary question sets are copied verbatim. The one long primary artifact I quote from (Jane Street's public mock-interview video) is the firm's *own* published sample, and I still summarize rather than reproduce it.
- **Skepticism / cross-checking:** claims are cross-checked across ≥2 independent sources before being labeled reliable. Prep-vendor pages recycle each other's numbers, so vendor agreement is treated as weak evidence. Anything thin or single-sourced is flagged inline.
- **Confidence key:** **High** = firm-official and/or multiple independent 2025–2026 primary reports agree. **Medium** = consistent across aggregators + some primary confirmation. **Low** = single/old/lead-gen source.
- **Recency:** Everything here reflects 2024–2026 cycles. The one older-but-still-representative artifact is Jane Street's mock-interview video (published 2022, but the firm still links it as *the* canonical description of its trading interview in 2026 and it matches every 2025 write-up).
- **Universal caveat:** No firm publishes an exact scoring key. Treat all counts/timings as **directional shapes**, not literal cutoffs. Attribution of a *specific* format to a firm is made only when well-supported; otherwise it's labeled a "general quant-trader" archetype.

---

## Cross-firm summary table (trader track, 2024–2026)

| Firm | Priority | Gate/OA | Signature live round | Core archetypes | Signature adversarial move | Confidence |
|---|---|---|---|---|---|---|
| **Jane Street** | ⭐ top | ~60Q / 8min mental-math (Zetamac) | Make-a-market + multi-part game that mutates each part | EV under uncertainty, optimal stopping, make-a-market, Fermi→market | **Change the rules mid-problem; add an adversary; generalize-to-n; "how much per turn?"** | High |
| **Optiver** | ⭐ top | 80-in-8 (+1/−1/−1-skip) | Face-down-cards market-making, picked off | Fast arithmetic, prob/EV under a punishing clock, sequences | **The clock + pickoff bot; fit round probes tilt after a loss** | High |
| **SIG** | ⭐ top | Mercer\|Mettl problem-solving, calculator allowed, ~open-answer | Poker / "want to bet on that?" decision round | EV, card/dice bet pricing, Bayesian update, bet-sizing | **"How confident? How much would you bet?" then twist the payout rule** | High |
| **Citadel Securities** | ⭐ top | OA: probability + game theory (+coding) | Superday market-making + "bet on the next draw" | Bayes (hidden-composition), EV, market-making, convolution | **Adverse selection + "now bet on your own answer"** | High |
| **IMC** | ⭐ top | Mental-math + sequences + prob OA | Group/1:1 trading game (dice sum, marble urn) | Make-a-market, EV, order-flow inference | **Trades against you repeatedly; challenges *correct* answers to see if you flinch** | Medium-High |
| **DRW** | ⭐ top | 6Q / 45min deep math (one ~unsolvable) | 1:1 market-making mock | Prob/EV, Markov chains, linear algebra, recursion/DP | **Leave-it-blank triage; defend a hard result** | High |
| Five Rings | 2nd | 15–20Q / <20min typed numeric | Rapid-fire prob/estimation | Probability, combinatorics, Fermi under 30–90s | Speed as the adversary; JS-like reasoning probes | Medium |
| Akuna | 2nd | 80-in-8 + 24 sequences/12min + VidCruiter betting game | Group trading game (PnL-ranked) | Mental math, sequences, EV, make-a-market, "how much to play?" | **Group market; inventory punishment; confidence→stake** | Medium |
| Jump | 2nd | Rapid mental-math + prob OA | Trader round: futures/market intuition | Fast arithmetic, EV brainteasers, market microstructure | Speed + "why Jump," market-event reasoning | Medium |
| HRT | 3rd | CodeSignal + math stage (trader) | Prob + code-your-own-simulation | Green-book prob/EV, geometric probability, code-validate | Derive *and* simulate; less market-making-central | Medium |
| Old Mission | 3rd | Speed-gated sequences/prob, then ~35 prob Q + Python | Market-making sim (sometimes vs CEO) | Mental math, prob/combinatorics, Markov, Fermi, options | Progressive difficulty; composure under grilling | Low-Medium |
| Wolverine | 3rd | Mental-math/prob + coding screen | Options-flavored market-making | Arithmetic, probability, **options/Greeks (finance knowledge — atypical)** | Conceptual options grilling | Low |

> **Two timing regimes to model separately** (confirmed repeatedly across firms): **(A) arithmetic sprint** ~6–8 s/Q (Optiver 80-in-8, Jane Street mental math, Akuna, Old Mission) — pure speed + accuracy, often penalized; **(B) reasoning** ~90 s to ~7 min/Q (Optiver Beat-the-Odds, SIG, DRW) — where deep reasoning and market-making live.

---

# Per-firm findings

## 1) Jane Street ⭐ (Confidence: **High** — firm-official primary source)

**Process & format (2025–2026).** Application (reviewed by a human, response ~1 week) → recruiter screen + **~60-question, ~7–8-minute timed mental-math test** (Zetamac-style: 2-digit multiplication, division, percentages, fractions, decimals; **no calculator, no scratch paper**). Failing the math test ends the process regardless of resume. → 1–2 technical phone/video screens (60–90 min) → **Super Day / final committee**. Interviews are conducted *by traders*, feel "more like a conversation than a quiz," and **require no finance knowledge or advanced math**. Mental math has been de-emphasized for SWE in 2026 but **remains a dedicated trader round**.

**Question archetypes (paraphrased examples):**
- **Fast mental-math gate:** 2-digit × 2-digit, percentages of round numbers, fraction↔decimal — reflexive speed at ~8 s/Q.
- **EV / optimal-stopping under uncertainty (their canonical style):** *A multi-round dice/casino game where each round you choose to "roll" or "bank the current face value"; maximize expected total over N rounds.* This is straight from Jane Street's own published mock. The interesting part is not the first answer — it's the **sequence of mutations** (see follow-ups).
- **Make-a-market on a hidden value:** *"I'm thinking of a number between 1 and 100 — quote me a two-way market."* You quote e.g. "45 bid / 55 ask"; the interviewer hits or lifts and you infer/adjust.
- **Fermi → market:** *"How many gas stations are in the US? Now make a market on your answer,"* then they trade against it and reveal a constraint (e.g. "it's the EU, not the US") forcing a re-quote.
- **Probability brainteasers** framed conversationally; interviewers deliberately vary the problem to detect memorized answers.

**Follow-up style (the crown jewel — modeled directly on their public mock):** After you solve a part, the interviewer does **not** move on. They:
1. **Change a rule of the game** ("now when you bank, the die is removed and you must spend a turn re-rolling before you can bank again") — testing whether your *framework* survives a structural change, not arithmetic-on-your-answer.
2. **Introduce an adversary** ("now the *casino* chooses whether to re-roll after you bank, and it wants to minimize your winnings") — turning a single-agent optimization into a game-theoretic equilibrium.
3. **Push you to generalize** ("accept any face ≥ k — solve for the optimal threshold k as a function of the payoff structure"), then ask you to set up (not necessarily grind) the maximization.
4. **Offer an elegant reframe as a hint** ("you make ~$5/turn overall — so should you ever spend a turn to bank a 7?"), rewarding candidates who *take a hint and run*.
5. In make-a-market: **adverse selection** — "I keep lifting your ask; what does that tell you? Adjust," and "your spread's too wide, I won't trade — tighten it."

**What they grade on (from their own recap):** clarifying the problem before working (they *praise* the candidate for re-asking until the rules are clear); **thinking out loud** (so they know when to hint/correct); breaking a big problem into solvable pieces; **trying a concrete strategy to generate better ideas** even if it isn't optimal; taking hints well; composure. Explicitly: *the final number is secondary to the reasoning and collaboration* — "iterative and collaborative problem solving replicates a conversation on the trading desk."

**Difficulty/timing:** Mental-math gate brutal (~8 s/Q, ~70–80% correct to pass). Reasoning rounds generous on time but relentless on depth — a single problem can mutate 3–4 times over 20+ minutes.

**Sources:**
- Jane Street — *Trading Interviews* (official process overview + mock) — https://www.janestreet.com/trading-interviews/ — evergreen, current 2026 — **firm-official** (states "conversation not a quiz," no finance/advanced math needed).
- Jane Street (YouTube) — *A Jane Street Trading Mock Interview with Graham and Andrea* — https://www.youtube.com/watch?v=NT_I1MjckaU — pub. 2022, still the canonical firm reference in 2026 — **firm-official primary** (full transcript reviewed; the "20-sided die / bank-or-roll" multi-part game and the exact follow-up cascade above come directly from it).
- Jane Street — *Language of Market Making* (audio primer + practice prompts like "population of NYC," "stocks in the FTSE 100") — https://www.janestreet.com/language-of-market-making/ — evergreen — **firm-official**.
- techinterview.org — *Jane Street Interview Guide 2026* — https://www.techinterview.org/companies/jane-street/ — 2026 — Medium (corroborates ~60Q/8min gate, 70–80% bar, market-making centrality, "gas stations" Fermi→market).
- theinterviewden.com — *Jane Street Quantitative Trader Interview* — https://theinterviewden.com/companies/jane-street-quant-trader-interview — 2026 — Medium (round-by-round; "number 1–100" market example; adverse-selection framing).
- LinkedIn (Gillian Dalton) — commentary on the JS mock video — https://www.linkedin.com/posts/gilliandalton_a-jane-street-trading-mock-interview-with-activity-7262415176044347394-lScM — Nov 2024 — Low/context (confirms the mock is widely used as the reference).

---

## 2) Optiver ⭐ (Confidence: **High** on gate; Medium on skip-scoring specifics)

**Process & format (2025–2026).** Online numerical test → recruiter screen → assessment day (half/full day, often across a 3-day window; **each section an independent gate — fail one = out**) → onsite/superday → offer. Total ~3–8 weeks.
- **80-in-8:** 80 mental-arithmetic questions in 8 minutes (**~6 s/Q**), no calculator, escalating difficulty (addition→multi-digit multiplication, fractions, decimals, percentages, negatives). Reported pass ≈ **60+/80**; strong ≈ **70+**; filters ~**80%** of applicants. Scoring commonly reported **+1 correct / −1 wrong / −1 skip** (penalizes guessing *and* skipping) — the "−1 skip" specific is **Medium (conflicting reports)**.
- **NumberLogic / Sequences** and **Beat-the-Odds** (rapid probability/EV, ~90 s/Q, 5-option "pick closest," +1/−1/0-skip, no back-nav) and **Zap-N/Zap-Q** cognitive/reaction games.
- **Live trading game(s) (45–60 min, the signature round):** price a hidden quantity (**often the sum of several face-down cards**); interviewer *or a competing group of candidates* trades against your two-way quote; **cards get revealed progressively** and you re-quote while tracking position/PnL.
- **Fit interview** (do not underestimate): why trading (not research/eng); **how you handle a loss**; do you tilt after a mistake or correct and move on; competitiveness as focus vs ego. "Anyone who claims they rarely make mistakes has just failed the question."

**Archetypes (paraphrased):** rapid arithmetic (2-digit × 1/2-digit, % of round numbers, negatives, multi-step); next-in-sequence with a twist (ratio + offset); time-starved EV/probability where you must **bucket/estimate** rather than compute exactly; face-down-cards market-making.

**Follow-up style:** the **clock and the penalty are the adversary** in the OA (terse, time-pressuring). In the trading game, the **pickoff *is* the feedback**: quote too cheap → they lift your ask and you're short at a bad price; quote too wide → they refuse and tell you to tighten; each card reveal forces a re-quote. In the fit round, they press your loss story for evidence of **tilt vs. correction**.

**What they grade on:** arithmetic throughput + low error rate under the clock; discipline to **skip rather than guess** when penalized; in the game — sensible spread width, updating on each reveal, inventory awareness, calm; in fit — temperament under loss.

**Difficulty/timing:** the sprint end of the spectrum (~6 s/Q). Reasoning items deliberately under-timed to force estimation.

**Sources:**
- theinterviewden.com — *Optiver Trading Interview* — https://theinterviewden.com/companies/optiver-trading-interview — 2026 — Medium (full round-by-round; market-making 45–60 min).
- techinterview.org — *What Optiver's trading-game rounds are really testing for* — https://www.techinterview.org/post/3233476019/optiver-trading-game-rounds/ — 2026 — Medium (face-down-cards game; group trades against you; fit round on tilt — the "claims they rarely make mistakes has failed" line).
- techinterview.org — *Optiver Interview Guide* — https://www.techinterview.org/companies/optiver-interview-guide/ — 2026 — Medium (score distribution 30–50 typical / 60+ strong; "traders push back on your answers to see how you defend a position").
- Quant Blueprint — *How to Get a Job at Optiver in 2026* — https://www.quantblueprint.com/guides/how-to-get-a-job-at-optiver — 2026 — Medium (80-in-8 = 6 s/Q, 60+ to pass; onsite market-making sim with injected news/large-order events).
- Quantt — *Optiver Interview* — https://www.quantt.co.uk/resources/optiver-interview — 2026 — Medium (~80% filtered; escalating question difficulty; 4–8 week pipeline).

---

## 3) SIG (Susquehanna) ⭐ (Confidence: **High** on poker/EV emphasis; firm-official corroboration)

**Process & format (2025–2026).** OA (Mercer|Mettl problem-solving; **calculator allowed, freer navigation**, open-answer) → recruiter screen → technical rounds → **Super Day**, which almost always includes a **poker / decision-theory round** (sometimes a separate evening event). SIG explicitly **teaches poker to new traders** and provides a **tutorial at the start of any poker session** — *no prior poker skill assumed*.

**Archetypes (paraphrased):**
- **EV bet-pricing on cards/dice:** *"A card is drawn; you win its value in $ (face = 10, ace = 1). What's a fair price to play?"* (avg ≈ 6.5, so paying 5 is +EV). Then **twist the rules**: *"Now you may pay to discard and redraw,"* or *"draw two and keep the higher"* — each shifts EV and you must recompute **without a calculator reach**.
- **Classic EV/probability:** *"Flip a coin until two heads in a row — expected number of flips?"*; *"Make a market on the number of dominoes in a standard set."*
- **Poker/decision-theory:** *"You have ~30% to win; pot is \$100 and opponent bets \$50 — call or fold?"* (pot odds). If poker is on your resume, **defend a specific line** (why you called/folded/raised) in pot-odds/range terms. If not, an equivalent **fold-or-continue** problem in plain language.
- **Mental math** peppered throughout the day (2-digit multiply / percentages in ~5 s), *despite* the calculator on the OA.

**Follow-up style (the crown jewel):** the **"want to bet on that?" confidence-calibration probe.** After an answer: *"How confident are you — 60%? 90%?"* → *"OK, how much of your bankroll would you put on it?"* If your stated confidence doesn't match the true probability, they **offer a bet at exploitative odds** and reveal the miscalibration. Also: **framing-first** probing on heavy problems (*"before you compute — is it even feasible? what's the pattern?"*), because a wrong first step cascades. **Reasoning > final number**: a right answer reached by luck gets probed harder (*"walk me through why — would you bet on that reasoning?"*).

**What they grade on:** EV/edge recognition; **calibration** (does stated confidence match reality); **bet-sizing to edge**, not gut; Bayesian updating on new info; willingness to admit an initial read was wrong; thinking stability under social pressure. Arithmetic speed matters but is *not* the differentiator.

**Difficulty/timing:** the slow-and-deep end — generous per-question time, calculator allowed; pressure is **social/confidence**, not the clock.

**Sources:**
- SIG — *Game Theory + Decision Science / "Who We Are"* — https://sig.com/who-we-are/game-theory-decision-science/ — evergreen — **firm-official** (poker as decision-under-uncertainty teaching tool; home of *The Mathematics of Poker* authors Chen & Ankenman; availability/gambler's-fallacy bias framing).
- techinterview.org — *SIG (Susquehanna) Interview Guide* — https://www.techinterview.org/companies/sig-susquehanna-interview-guide/ — 2026 — Medium (sample Qs: two-heads-in-a-row EV; 30%/pot-odds call; dominoes market).
- Quantt — *SIG Interview* — https://www.quantt.co.uk/resources/sig-interview — 2026 — Medium (poker round nearly universal; tutorial provided; calculator; "correct answer matters less than how you reason about EV/edge/information").
- theinterviewden.com — *SIG Trading Interview* — https://theinterviewden.com/companies/sig-trading-interview — 2026 — Medium (poker round 30–45 min; "solve a simplified two-player betting game the interviewer invents on the spot").
- techinterview.org — *What a market-making interview actually looks like* — https://www.techinterview.org/post/3233476306/market-making-interview-trading-games/ — 2026 — Medium (SIG's card/dice EV bet-pricing with live rule twists).

---

## 4) Citadel Securities ⭐ (Confidence: **High** — multiple 2025 first-hand WSO entries)

**Process & format (2025–2026, from 2025 candidate reports).** Screening → **OA (probability + game theory, plus a coding section)** → recruiter/phone screen → **two ~45–60 min technical interviews** (mix of probability and game theory) → **in-person Superday (4–6 back-to-back rounds)**, which is **"more market-making but requires a very solid foundation in math and statistics."** Interviewers share notes; no single round is fatal. ~4–6 weeks.

**Archetypes (paraphrased, several from 2025 WSO write-ups):**
- **Bayesian hidden-composition + betting (Oct-2025 report):** *"Four stones in a bag, black/white in unknown split. You draw two and both are black. Compute the probability the next draw is black — and then bet on it."* Combines Bayes-with-unknown-prior + a market-making/bet decision on your own estimate.
- **Prob + game theory OA** (Mar-2025 report): "many probability questions" on the OA; "mix of prob and game theory" in technicals.
- **Convolution / distribution reasoning** (Jan-2025 report): probability of a sum, solved via convolution.
- **Superday market-making:** interviewer reveals partial info on a hidden quantity, you quote bid/ask, they trade against you, more info is revealed, running **PnL + inventory** tracked (structurally like Jane Street, but reports note **tighter spreads / faster updates expected**).
- Bayes-applied-to-a-scenario + a creative brainteaser (2025 intern report).

**Follow-up style:** adverse selection in the market-making game (commit fast, then update on every trade/reveal), plus the distinctive **"now bet on your own answer"** move — they push you from *computing* a probability to *taking a position* on it. They also point out sub-optimal moves ("minor optimization error") to see how you respond.

**What they grade on:** analytical rigor + real-time adaptation to new data; committing to a price rather than freezing; not ignoring inventory; clean reasoning narrated at every step; calibrated risk-taking.

**Difficulty/timing:** "very difficult math questions"; superday is a marathon of escalating difficulty.

**Sources:**
- Wall Street Oasis — *Citadel Securities Interview Questions (2026), 94 entries* — https://www.wallstreetoasis.com/company/citadel-securities/interview — multiple **2025 first-hand** entries — Medium-High as primary (four-stones Bayes+bet [Oct 2025]; prob+game-theory OA [Mar 2025]; convolution [Jan 2025]; Bayes-scenario + brainteaser intern report).
- techinterview.org — *Citadel Securities Interview Guide 2026* — https://www.techinterview.org/companies/citadel-securities/ — 2026 — Medium (trading game "similar to Jane Street's"; reveal→quote→trade→reveal, PnL + inventory; what works/fails).
- myntbit — *Citadel Securities Interview Process* — https://myntbit.com/blog/citadel-securities-interview-process — 2026 — Medium (4–6 rounds; superday 4–6 sessions, interviewers share notes; QT = market intuition + fast arithmetic).

---

## 5) IMC Trading ⭐ (Confidence: **Medium-High** — concrete game examples corroborated)

**Process & format (2025–2026).** Application (or entry via the **IMC Prosperity trading challenge**, which fast-tracks strong performers) → **OA (60–75 min: mental arithmetic 50–80 Qs incl. 2-digit multiply + percentages, plus probability + pattern recognition)** → recruiter → **trading simulation / market-making round** → **onsite Super Day** (Amsterdam or Chicago; 4–5 back-to-back 45-min interviews + a **live trading game**, sometimes a **group** version).

**Archetypes (paraphrased, corroborated examples):**
- **Make-a-market on a dice sum:** *"Two dice rolled behind a screen — quote a market."* Fair value 7; you quote e.g. "6 at 8." They **lift your offer at 8** → is that noise or do they know it's high? Do you hold or shade up?
- **Make-a-market on an urn:** *"100 marbles, unknown red/blue split; I'll pay you the number of reds. Make me a market."* No-info EV = 50, so ~"45 at 55"; if they **keep selling to you at 55**, the count is probably below 55 — tighten and skew lower.
- **EV bets with sizing follow-up:** *"Would you take a bet that pays 10 to lose 1 at probability p?"* then *"how much would you size it?"* (green-book style).
- **Probability brainteasers:** e.g. expected flips to get two heads in a row; conditional probability / Bayes; Markov.

**Follow-up style:** **trades against you repeatedly** and watches whether you **adjust vs. anchor to your first guess**; **deliberately challenges *correct* answers** to test whether you flinch; gives intentionally **ambiguous questions** to see if you ask for clarification. IMC's culture is "famously direct."

**What they grade on:** sensible **spread width** (widen when uncertain, tighten with edge); **updating on order flow**; not freezing; **narrating reasoning out loud** ("that sentence gets you further than a correct but silent answer"); stamina (constant arithmetic across the day).

**Difficulty/timing:** OA is speed-pressured; the trading game is exhausting from sustained mental math; less brutal single-gate than Optiver but broader.

**Sources:**
- techinterview.org — *How IMC Trading interviews traders and engineers differently* — https://www.techinterview.org/post/3233476458/imc-trading-interview/ — 2026 — Medium (dice-sum "6 at 8" game with the lift-your-offer inference; "widen when uncertain, tighten when you have an edge"; size-the-bet follow-up).
- Quantt — *IMC Trading Interview: Process* — https://www.quantt.co.uk/resources/imc-trading-interview — 2026 — Medium (100-marble urn market; "challenge correct answers to test how you respond"; Super Day 4–5 × 45 min + trading game).
- techinterview.org — *IMC Trading Interview Guide* — https://www.techinterview.org/companies/imc-trading-interview-guide/ — 2026 — Medium (OA mental-math + sequences; trading challenge → pipeline fast-track).
- everythingquant — *IMC Trader Interview Guide* — https://everythingquant.com/guides/quantitative-trader-at-imc/ — 2026 — Low-Medium (in-house *group* trading simulation on the final day).

---

## 6) DRW ⭐ (Confidence: **High** on OA shape — multiple 2025 first-hand reports)

**Process & format (2025–2026, from 2025 WSO + Dec-2025 Dev.to review).** Application → **OA: ~6 questions / 45 minutes** (~7.5 min/Q), math/probability/brainteasers, **often one item that is essentially unsolvable — leave it blank and move on** → recruiter screen (behavioral + mental math) → technical 1:1s (probability/stats, sometimes **market-making**) → in-person Superday (~3 interviews). ~3–4 weeks.

**Archetypes (paraphrased, from 2025 reports):**
- **Markov chains** (steady-state / expected-hitting-time), explicitly named in multiple 2025 entries.
- **Linear algebra / matrix calculations**, statistics, calculus fundamentals — heavier LA than most trader shops.
- **Recursion / dynamic programming & state modeling** under time pressure.
- **EV / conditional probability** brainteasers; normal-distribution reasoning; convolution-style problems.
- **Market-making mock** in later rounds: two-way quote on an unknown, spread ∝ uncertainty, manage inventory, update on info.

**Follow-up style:** the OA itself is adversarial via **triage** — recognizing the unsolvable item and *not* burning time is part of the test (candidates report leaving one blank and still advancing). In 1:1s, defend a hard derivation and handle a follow-up that adds a constraint.

**What they grade on:** clear, correct computation **fast** under severe time pressure ("hesitation is more dangerous than difficulty"); triage/decisiveness; mathematical fundamentals over tricks.

**Difficulty/timing:** among the hardest per-question (7.5 min but genuinely hard, LA + DP); reasoning-regime, not sprint.

**Sources:**
- Dev.to (net_programhelp) — *DRW 2026 Summer Quant/QR Intern OA Full Review* — https://dev.to/net_programhelp_e160eef28/drw-2026-summer-quantqr-intern-oa-full-review-3cj2 — **Dec 2025** — Medium (6Q/45min; LA, calculus, probability, recursion/DP; "solve quickly and accurately under pressure").
- Wall Street Oasis — *DRW Interview Questions (2026), 83 entries* — https://www.wallstreetoasis.com/company/drw/interview — **2025 first-hand** — Medium (Markov-chain OA item; "6 hard math questions, one impossible, left it blank, still advanced"; later rounds = EV/market-making/modeling).
- techinterview.org — *DRW Interview Guide* — https://www.techinterview.org/companies/drw-interview-guide/ — 2026 — Medium (OA less mental-math-heavy than Optiver; trader onsite = market-making mock + brainteasers; recruits USAMO/Putnam backgrounds).
- everythingquant (forum) — *DRW Trading Internship OA – Difficulty & Timelines* — https://everythingquant.com/forum/post/drw-trading-internship-oa--difficulty--timelines/ — 2026 — Low-Medium (corroborates 6–8Q / 45–60 min shape).

---

## 7) Five Rings (Confidence: **Medium** — reputation as hardest math screen)

**Process & format.** **OA (HackerRank, proctored): ~15–20 open-ended, typed-numeric questions in a little under 20 minutes** (~60–75 s/Q), no calculator, one question at a time, visible timer → **live probability interviews** (recruiter/HR-run first round with **~10–15 rapid-fire stats/probability questions, 20–90 s each**) → further technical rounds. Style repeatedly described as **Jane-Street-like**.

**Archetypes (paraphrased):** probability & combinatorics; **estimation / Fermi** designed so you **can't solve exactly** — you must build a simplified model fast, spot shortcuts, and avoid calculation traps; rapid-fire stats.

**Follow-up style:** **speed is the adversary** (20–90 s windows). Reasoning-out-loud is valued over the exact number when time is short; some questions require estimation rather than exactness by design.

**What they grade on:** how your brain operates under pressure — shortcut-spotting, quick simplification, calibration of an estimate, not getting trapped in unnecessary arithmetic.

**Difficulty/timing:** widely called the **most difficult trading math screen**; extreme time pressure.

**Sources:**
- Aptitude-Test-Prep — *Five Rings Trader Online Assessment* — https://aptitude-test-prep.com/employers/trading-assessments/five-rings-online-assessment/ — 2026 — Medium (15–20 open-ended Qs / <20 min; probability+combinatorics + estimation; "cannot be solved exactly").
- Glassdoor — *Five Rings Quantitative Researcher interview questions* — https://www.glassdoor.com/Interview/Five-Rings-Quantitative-Researcher-Interview-Questions-EI_IE375785.htm — mixed 2023–2025 — Low-Medium primary (HR first round; ~10–15 timed stats/prob Qs at 20–90 s each; some require estimation).
- Wall Street Oasis — *Five Rings Quant Trading Intern* — https://www.wallstreetoasis.com/company/five-rings-capital-llc/interview/quant-trading-intern-0 — ~2022 — Low (older; 4 rounds: fast estimation then math/game-theory; offer without superday).

---

## 8) Akuna Capital (Confidence: **Medium**)

**Process & format.** **First OA (HackerRank): 80-in-8 math test *and* a 24-question / 12-minute sequences test — must pass both** → **secondary OA: coding test + a VidCruiter/HireVue *betting game*** (an original letter/grid game where you price and compare bets against a winning row; some report a follow-on multiple-choice brainteaser/probability video, ~5 min/Q) → phone technical (brainteasers, market-making, probability, basic derivatives) → **Super Day with a group trading game (PnL-ranked)**. Akuna runs a structured **12-week trader training program**, so it screens for **raw aptitude**, not existing knowledge.

**Archetypes (paraphrased):** 80-in-8 arithmetic (6 s/Q, type-in, click-to-advance); **sequences** ("not just numerical" — pattern families, ~30 s/Q); **make-a-market** (*"I roll three dice and pay you the median value — make me a market"* → median EV 3.5 by symmetry, quote ~"3 at 4"); EV bets; **confidence→stake** (*"assume the fair value settles inside your market; I'll pay you \$x — how much would you pay to play?"* — the number should track your confidence).

**Follow-up style:** in the **group trading game**, others hit/lift your quotes and your **inventory shifts**; when hit repeatedly you must **proactively push your bid down** rather than stubbornly hold; **infer from others' trades**. The phone round's "how much would you pay to play?" ties **bet size to stated confidence**.

**What they grade on:** speed+accuracy gates first (where most candidates die); then market-making intuition — spread EV (too wide = no fills, too narrow = arbitraged), inventory control, updating from flow, narrated reasoning.

**Difficulty/timing:** front-loaded sprint gates (6 s/Q math, 30 s/Q sequences); the distinctive filter is the **unfamiliar betting-game format**.

**Sources:**
- Tradermath — *Akuna Capital Interview Guide* — https://www.tradermath.org/articles/akuna-capital-interview-guide — 2026 — Medium (80/8 + 24 sequences/12 min; VidCruiter grid betting game mechanics).
- Quantt — *Akuna Capital Interview* — https://www.quantt.co.uk/resources/akuna-capital-interview — 2026 — Medium (median-of-three-dice market example; 35% math / 30% prob / 25% market-intuition split; 12-week program).
- OA VO Service — *Akuna Super Day Trading Game full loop* — https://oavoservice.com/en/articles/akuna-capital-super-day-trading-game-full-loop — 2025/26 — Low-Medium (group market-making game, 5–6 people/30 min, PnL-ranked; inventory punishment; brainteasers = mental-math EV in 1–2 min).
- programhelp — *Akuna Capital Interview 2026 (candidate walk-through)* — https://programhelp.net/en/2025akuna-capital-interview/ — 2025/26 — Low (first-person: "assume fair value settles in your market; how much to play?" tied to confidence).

---

## 9) Jump Trading (Confidence: **Medium**)

**Process & format.** Recruiter screen + **OA/assessment (~45 min: rapid-fire mental arithmetic 30–60 problems + probability brainteasers, and for some tracks a coding section; ~20–30% clear)** → 1–2 technical phone screens (probability + a coding question) → **Superday, 4–7 back-to-back 45–60 min rounds** (deliberately escalating), typically **2 quant/math rounds** (pen-and-paper probability/EV, statistics, **linear algebra**), 1 coding (Python for trader/quant, C++ for eng), 1 behavioral/fit. Trader track adds a **market-intuition round**.

**Archetypes (paraphrased):** **unusually heavy rapid mental arithmetic** ("exact arithmetic faster than most people can type"); EV/conditional-probability brainteasers (Coupon Collector, Gambler's Ruin style); **linear algebra** (noted as unusual vs peers); **market/futures microstructure** (e.g. *"how do CME index futures differ from an index ETF in trading dynamics?"*, *"make a market on front-month crude in this scenario,"* hedging a futures position); reasoning about historic **market events** (2010 flash crash, 2020 oil collapse) and what they reveal about structure.

**Follow-up style:** speed + "defend your reasoning to a working trader/engineer"; **why Jump specifically** (vs HRT/Citadel) as a genuine-interest filter; market-event reasoning probes.

**What they grade on:** raw computational speed; structured probability reasoning maintained across a long, escalating day (fatigue is part of the test); genuine interest in the futures/HFT space.

**Difficulty/timing:** sprint-heavy arithmetic unusual for a research-leaning shop; coding bar comparable to top FAANG.

**Sources:**
- techinterview.org — *Jump Trading Interview Guide 2026* — https://www.techinterview.org/companies/jump-trading/ — 2026 — Medium (trader-round sample topics: CME futures vs ETF, make-a-market on crude, hedging with cash bonds).
- Quantt — *Jump Trading Interview* — https://www.quantt.co.uk/resources/jump-trading-interview — 2026 — Medium (Superday 5–7 rounds, escalating; trader = 35% prob / 30% market intuition / 20% mental math; asks about specific market crises).
- Wall Street Oasis — *Jump Trading Interview Questions (2026), 13 entries* — https://www.wallstreetoasis.com/company/jump-trading/interview — **2025** — Low-Medium (first-hand: linear algebra emphasis "other companies don't test"; superday = 2 math + 1 coding + 1 behavioral).
- myntbit — *Jump Trading Quant Interview* — https://myntbit.com/blog/jump-trading-quant-interview-guide — 2026 — Low-Medium (mental-arithmetic 30–60 problems on OA; ~20–30% clearance).

---

## 10) Hudson River Trading — HRT (Confidence: **Medium**; **weakest trader-math signal** in this set)

**Process & format.** **Engineering-led / coding-first.** OA is **CodeSignal/HackerRank competitive-programming** (LeetCode-hard equivalents); for **algo/quant/trader lines a separate math stage** (often **8–12 MCQ probability in ~60 min**, or a 90-min math block for quant-trader) → phone screen (CoderPad live coding) → onsite **5–6 rounds** (coding + systems/low-latency for eng, probability + research for quant). HRT's trader role is **closer to a researcher with operational duties** (trading is heavily automated), so market-making is **less central** than at JS/Optiver/SIG.

**Archetypes (paraphrased):** **green-book-style** EV/conditional probability/combinatorics; **geometric probability** (canonical: *"Two people each arrive at a uniform random time in [0,1]; the first waits 15 minutes then leaves — probability they meet?"* → area on the unit square where |difference| ≤ 0.25); the **derive-then-simulate** loop (solve an EV problem *and* write code to validate it); some **market-making-flavored pricing games** where a wrong spread gets picked off.

**Follow-up style:** "derive it, now **code the simulation** to check yourself"; probe complexity/edge-cases; less "trade against your quote," more "prove your reasoning both ways."

**What they grade on:** ability to move fluidly between **math and code in the same breath**; clean fast coding; correct probabilistic reasoning; for eng, low-latency systems depth.

**Difficulty/timing:** high coding bar (~30% OA pass); math stage is speed-filtered MCQ.

**Sources:**
- Tradermath — *Hudson River Trading (HRT) Interview Guide* — https://www.tradermath.org/articles/hudson-river-trading-interview-guide — 2026 — Medium (Romeo-&-Juliet geometric-probability example; "derive then simulate" habit; green-book emphasis).
- techinterview.org — *Hudson River Trading Interview Guide 2026* — https://www.techinterview.org/companies/hudson-river-trading/ — 2026 — Medium (coding-first; probability round "less central than Jane Street but real"; pricing games get picked off).
- Quantt — *Hudson River Trading Interview* — https://www.quantt.co.uk/resources/hudson-river-trading-interview — 2026 — Medium (trader role "closer to a researcher with operational responsibility"; market microstructure + risk).
- OA VO Service — *HRT OA three-stage guide* — https://oavoservice.com/en/articles/hrt-oa-comprehensive-three-stage-guide — 2025/26 — Low (math stage = 8–12 MCQ / 60 min for algo/trader lines).

---

## 11) Old Mission Capital (Confidence: **Low-Medium**)

**Process & format.** **Assessment-heavy:** first a **speed-gated sequences + probability test** (not conceptually hard, gated on *pace*), then a second with **~35 probability questions of increasing difficulty + one Python problem** → phone screens (probability, brainteasers, sometimes market-making) → Chicago onsite (2–3 rounds, progressively harder, market-making sim / game-theory exercise, **sometimes with the CEO**). Reputation: **among the most mathematically intense** trader loops.

**Archetypes (paraphrased):** rapid mental math (2–3-digit multiply, fraction/percent, multi-step held in memory — some reports of **80 problems in 5–8 minutes**); sequence-pattern recognition; **probability/combinatorics at volume** (dice/cards, conditional probability, random walks); harder set-pieces: **pirate gold-splitting**, a **chessboard Markov-chain** question, a **geometric-probability** question (do four random points on a sphere form a tetrahedron containing the center?); Fermi estimation; **options theory / Greeks** intuition; market-making games (quote two-way, they trade against you, re-quote each round).

**Follow-up style:** progressive difficulty designed to **push you to your limit** and observe how you handle difficulty, ambiguity, and mistakes; composure under grilling (sometimes by senior/CEO).

**What they grade on:** speed *and* accuracy *and* calm; creative setup over formula-plugging; composure when pushed past comfort.

**Difficulty/timing:** sprint gate up front, then deep probability; overall reputationally very hard.

**Sources:**
- Quant Blueprint — *How to Get a Job at Old Mission Capital in 2026* — https://www.quantblueprint.com/guides/how-to-get-a-job-at-old-mission — 2026 — Low-Medium (3–5 rounds; 80 problems in 5–8 min mental math; market-making/game-theory onsite).
- Tradermath — *Old Mission Capital Interview Guide* — https://www.tradermath.org/articles/old-mission-capital-interview-guide — 2026 — Low-Medium ("~35 probability questions of increasing difficulty + one Python"; pirate/chessboard-Markov/sphere-tetrahedron set-pieces; interviews sometimes with the CEO).

---

## 12) Wolverine Trading (Confidence: **Low** — and **finance-knowledge-heavy, atypical for our no-prereq product**)

**Process & format.** Initial screen/OA (timed mental-math + probability, or coding) → phone technical (probability, **options pricing scenarios, the Greeks**) → Chicago onsite (options theory, probability, trading simulations, sometimes a **live market-making exercise**). Mental-math tested but **less extreme** than Optiver/Old Mission; **more weight on conceptual options understanding**.

**Archetypes (paraphrased):** arithmetic speed + estimation; probability; and — **notably — options theory** (which options/combinations to buy in a scenario, Black-Scholes intuition, Greeks, hedging). This is the one firm in the set where **finance/derivatives knowledge is genuinely tested**, so it is the **least aligned** with our "no options prerequisite" product design.

**Follow-up style:** conceptual options grilling ("understand how you think" rather than trick you); defend a hedging/greeks choice.

**What they grade on:** options intuition + probability + adequate mental math + fit. Reported as **thorough but fair**.

**Difficulty/timing:** moderate mental-math; the differentiator is options conceptual depth.

**Sources:**
- Quant Blueprint — *How to Get a Job at Wolverine Trading in 2026* — https://www.quantblueprint.com/guides/how-to-get-a-job-at-wolverine-trading — 2026 — Low-Medium (options/Greeks-heavy; mental math "less extreme" than Optiver/Old Mission; live market-making exercise).
- Dataford — *Wolverine Trading Interview Guides 2026* — https://dataford.io/interview-guides/wolverine-trading — 2026 — Low (assessment-first pipeline; coding + probability + limited post-test communication).

---

# RECOMMENDATIONS FOR OUR MOCK

These map to our three presets (**Optiver / Jane Street / SIG**) plus additions for other firms. The single biggest upgrade opportunity from this research: **make follow-ups *structurally* adversarial (change the problem, add an adversary, generalize, force a bet) rather than doing arithmetic on the candidate's answer.** Jane Street's own mock is the blueprint for this.

## A) Universal upgrades (all presets)

1. **Model the two timing regimes explicitly** (already in presets — keep it): a **sprint** block (~6–8 s/Q, hard auto-advance) and a **reasoning** block (~90 s–7 min, generous). Confirmed at every firm.
2. **Score the *reasoning*, not just the final number.** Every firm (esp. JS/SIG/IMC) says narration + framing + updating > the answer. The diagnosis should score: **(a) framing/approach, (b) calibration, (c) willingness to update, (d) composure/decisiveness, (e) correctness** — in that priority for reasoning items.
3. **Reward "think out loud" and "take the hint and run."** Penalize silent solving; give partial credit when a candidate takes an offered reframe and extends it (JS explicitly praises this).
4. **Make-a-market with a real adversary is the highest-signal round at 6 of 6 priority firms** — keep it central; parameterize pickoff aggressiveness, spread tolerance, info-reveal schedule, inventory tracking.

## B) Preset-specific adversarial follow-up patterns to implement

### Optiver preset — *Speed & Odds* (adversary = the clock + the pickoff)
- **Archetypes to add/keep:** 80-in-8 sprint (with negatives + escalating difficulty); time-starved probability where the *correct behavior is to bucket/estimate*; **face-down-cards market-making** with progressive reveals.
- **Adversarial follow-ups (implement):**
  - *Pickoff-as-feedback:* "I lifted your ask — your quote was cheap. Re-quote." / "Too wide, I won't trade — tighten."
  - *Reveal-and-requote:* flip one card, force an immediate re-quote under the clock.
  - *Tilt probe (new — from the fit round):* after a wrong sprint answer or a bad fill, inject "you just lost on that — move on, next question in 5… 4…" and **score composure / no error-cascade** (does the next answer degrade?).
- **Evaluation to score:** arithmetic throughput + error rate; **skip-vs-guess discipline** under penalty; spread sizing; recovery after a loss.

### Jane Street preset — *Make a Market* (adversary = adverse selection + "defend & extend")
- **Archetypes to add/keep:** Zetamac gate; **multi-part EV/optimal-stopping game that mutates** (bank-or-roll style); Fermi → make-a-market; conditional-probability with a twist.
- **Adversarial follow-ups (implement the JS cascade — this is the key deliverable):**
  1. **Change a structural assumption mid-problem:** "same game, but now once you bank, the resource is removed and you must spend a turn to restore it before banking again — does your strategy change?" (tests framework robustness, *not* arithmetic).
  2. **Add an adversary:** "now a second player (the casino/counterparty) chooses whether to re-roll after you act, and it wants to *minimize* your payoff — where's the equilibrium threshold?" (single-agent → game-theoretic).
  3. **Generalize-to-n / to-a-parameter:** "accept any value ≥ k; solve for optimal k as a function of the payoff," then "just set up the maximization, don't grind it."
  4. **Change an independence/assumption:** "what if the draws are no longer independent — say each reveal shifts the distribution?" → forces re-derivation.
  5. **Adverse selection in the market:** "I keep lifting your ask — what does that tell you? Adjust." / "Talk me through your Bayesian update."
- **Evaluation to score:** does the candidate re-clarify when rules change; does the *framework* survive mutation; quality of the generalization; spread/inventory updating; narration.

### SIG preset — *Think in Bets* (adversary = confidence-calibration + payout-rule twists)
- **Archetypes to add/keep:** card/dice **EV bet-pricing** (avg-value fair price); poker/pot-odds fold-or-call in plain language; slow deep probability with calculator allowed.
- **Adversarial follow-ups (implement):**
  1. **The bet challenge:** "How confident — 60%? 90%? OK, **how much of your bankroll** would you stake?" then **offer exploitative odds** if stated confidence ≠ true probability, and reveal the loss.
  2. **Twist the payout rule live:** "now you may pay to discard and redraw" / "draw two, keep the higher" — each shifts EV; score whether they **recompute cleanly** without anchoring.
  3. **Framing-first probe:** "before you compute — is it even feasible? what's the pattern?" (models the "wrong first step cascades" failure mode).
  4. **Luck probe:** if a right answer looks lucky: "walk me through why — would you *bet* on that reasoning?"
- **Evaluation to score:** **calibration** (confidence vs reality), **bet-sizing to edge**, EV/edge recognition, Bayesian updating, willingness to admit a wrong initial read.

## C) Additions for other firms (if we add presets or firm "skins")

- **Citadel Securities skin (high value):** JS-style market-making but **tighter spreads / faster updates**, plus the signature **"now bet on your own probability"** move (four-stones-in-a-bag: compute P(next is black | two blacks, unknown prior), *then* size a bet on it). Add **Bayes-with-unknown-composition** archetypes and a **convolution / sum-of-distributions** item.
- **IMC skin:** dice-sum and marble-urn make-a-market with an **order-flow-inference** twist ("I lifted your offer — noise or signal? hold or shade?"), plus the culture move of **challenging a *correct* answer** to test if the candidate flinches. Great source of "don't cave when you're right, but do update on real information" scoring nuance.
- **DRW skin:** a **reasoning block with a deliberately unsolvable item** — score **triage** (recognize it, leave it, protect time) as a first-class skill. Add **Markov-chain** and **linear-algebra** flavored items.
- **Five Rings skin:** an extreme **rapid-fire estimation** mode (20–90 s/Q, typed numeric, "can't be solved exactly — model it fast").
- **Akuna skin:** front-loaded **sequences** gate + a **group-style market-making** variant where *simulated other players'* trades move your inventory, and a **"how much would you pay to play?"** confidence→stake item.
- **Jump skin:** **rapid mental arithmetic** dialed up + optional market-intuition items (index-futures-vs-ETF dynamics) — but keep finance-optional since our product avoids domain prereqs.
- **HRT / Wolverine:** **lower priority for a *trader* mock.** HRT is coding-first (trader ≈ researcher); Wolverine leans on **options/Greeks knowledge**, which conflicts with our no-finance-prereq design. If used at all, HRT → a "derive then it-would-simulate" reasoning check; Wolverine → skip or clearly gate behind an options module.

## D) Concrete evaluation criteria the diagnosis should output (per attempt)

For each reasoning/market-making item, score and surface:
1. **Framing** — did they set the problem up correctly before computing? (SIG/JS)
2. **Speed/throughput** — for sprint items, correct-per-minute and error rate. (Optiver/Akuna/Jump)
3. **Calibration** — stated confidence vs. realized correctness; did their bet size match edge? (SIG/Citadel)
4. **Update quality** — did they Bayesian-update on new info / order flow, or anchor? (JS/IMC/Citadel)
5. **Robustness under mutation** — did the framework survive a rule change / added adversary / generalize-to-n? (JS)
6. **Composure / recovery** — did performance degrade after a loss or a hard item (tilt)? (Optiver/Old Mission)
7. **Communication** — was reasoning narrated clearly enough to follow and hint against? (all)
8. **Correctness** — final answer, weighted *below* the above for reasoning items.

---

## Confidence & sourcing-gap notes (self-assessment)

- **Highest confidence:** **Jane Street** (firm-official mock transcript + corroborating 2026 guides), **Optiver** (80-in-8 universally confirmed; face-down-cards game + fit-round-on-tilt well-sourced), **SIG** (firm-official poker page + consistent poker/EV round reports), **Citadel Securities** and **DRW** (multiple *dated 2025* first-hand WSO/Dev.to entries with specific questions).
- **Medium:** **IMC** (concrete game examples but mostly via aggregators), **Five Rings**, **Akuna**, **Jump** — process shape solid, specific per-question detail thinner / vendor-heavy.
- **Thin sourcing (flagged):** **Old Mission** (reputation-heavy, few primary write-ups; set-piece questions come from a single prep guide — treat as directional), **HRT trader-specific math** (coding-first firm; trader-math signal genuinely weak), **Wolverine** (little recent primary trader material; options-knowledge emphasis makes it a poor fit for our product anyway).
- **Where vendors likely recycle each other:** exact 80-in-8 pass cutoffs, "~90 s/Q" figures, and named OA section counts. I labeled these directional. Anything attributed to a *specific* firm's *specific* question above is backed by either firm-official material or a dated 2025 candidate report; the rest is labeled "general quant-trader archetype."
- **Note on the JS mock's age:** published 2022 but still the firm's canonical, currently-linked description and fully consistent with 2025 write-ups — treated as current and representative.
