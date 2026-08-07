# Quant TRADER Interview & OA Research — Landscape + Ranking (2024–2026)

**Compiled:** 6 Aug 2026
**Scope:** Latest (2024–2026) interview and online-assessment (OA) processes for the top ~10 quant **trader** firms. Goal: identify the 3 firms with the most **accurate, up-to-date, corroborated** information and turn them into implementation-ready mock-interview presets (see `FIRM_MOCK_PRESETS.md`).
**Product constraint honored throughout:** quant *trader* roles almost never require prior finance/options knowledge. These processes test **reasoning, math aptitude, probability/EV, and speed under pressure** — not derivatives domain knowledge. Presets are designed around those skills, NOT options pricing.

---

## ⚠️ How to read this (source-quality caveat)

No target firm publishes an exact OA scoring key. Evidence tiers used below:

- **Firm-official** — the company's own careers/hiring pages (highest trust for *process shape*, silent on exact scoring). e.g. `janestreet.com/probability-markets`, SIG careers copy naming Mercer|Mettl + poker.
- **Candidate reports** — 2024–2026 write-ups on Reddit r/quant, Wall Street Oasis (WSO), 1point3acres, Dev.to, Medium. Best *primary* signal but noisy and role/cycle-specific.
- **Prep vendors** — TradingInterview, TraderMath, JobTestPrep, Aptitude-Test-Prep, Quantt, techinterview.org, Quant Blueprint, QuantVault. Keep *structure* reasonably fresh; **recycle question archetypes and each other's numbers** across years (agreement between vendors is weaker evidence than it looks).

**Confidence key:** **High** = corroborated across multiple *independent* 2025–2026 sources incl. candidate reports and/or firm-official; **Medium** = consistent across vendor guides, thin primary confirmation; **Low** = single/old/lead-gen source.

Treat every number as **directional, not exact** — we want realistic *shapes* of difficulty and time pressure, not a firm's literal cutoff.

---

## Quick-reference calibration table (trader track)

| Firm | OA platform | OA shape (2025–26) | Q count / time | ≈ sec/Q | Wrong-answer penalty | Signature adversarial mechanic |
|---|---|---|---|---|---|---|
| **Optiver** | Optiver/CodeSignal + HackerRank | Multi-section battery, each an independent gate | 80-in-8 = **80/8min**; Beat the Odds ≈ **~30/45min** (≈90s/Q) | 80-in-8 **~6s**; Beat the Odds **~90s** | 80-in-8 **+1/−1/−1 skip**; Beat the Odds **+1/−1/0 skip**, no back-nav | Market-making bot **picks off mispriced quotes**; relentless clock |
| **Jane Street** | Recruiter-run mental-math + HackerRank (role-dep.) | Mental-math gate → probability → market-making game | Mental math **~60/8min**; prob 4–6 Q | Mental math **~8s**; prob 5–10 min/Q | None reported (raw correct on mental math) | **Adverse-selection market making** + "defend & extend" probes |
| **Susquehanna (SIG)** | Mercer\|Mettl | Problem Solving Assessment (calculator allowed, free nav) | **~9–17 open-answer Q / 60min** | **~210–400s** (3.5–6.5 min) | None reported (open-answer) | **"Want to bet on that?" confidence-calibration** + poker round |
| Citadel Securities | HackerRank | Quant-trader quant sprint (MCQ) | **~15 Q / 30min** | **~120s** | **+1/−1/0 skip**, free nav | Market-of-Cards market-making; escalating multi-stage problems |
| Five Rings | HackerRank (proctored) | Typed-numeric quant screen | **~15–20 Q / <20min** | **~60–75s** | None reported; typed numeric | Interview pace ~30s/Q; estimation under 10–15s |
| DRW | Proprietary (TradingInterview-modeled) | Deep math OA | **6 Q / 45min** | **~450s** | **+1/0 wrong/0 skip**, free nav | One "essentially unsolvable" item; leave-it-blank & advance |
| Akuna Capital | HackerRank | Math + Sequences (both must pass) | Math **80/8min**; Seq **~24–30/12–16min** | Math **6s**; Seq **~32s** | Type-in, no calculator | Later: VidCruiter betting game + trading P&L coding |
| IMC Trading | HackerRank + Trading Game | Cognitive games + reasoning + math/prob + trading game | Math **~15–20 Q / 30–60min** | **~90–180s** | Module-locked (no back-nav) | Mandatory market-making **trading game** in loop |
| Jump Trading | HackerRank / proprietary | Prob/stats + rapid mental arithmetic (trader) | **60–120min** mixed | varies | Coding partial-credit | Rapid-fire arithmetic unusually heavy for a research shop |
| Hudson River Trading (HRT) | CodeSignal GCA | **Engineering-led**; coding-first, math is a *later* role-gated stage | GCA **4/70min**; math 60–90min | ramped | Score/600 (≥500 bar) | Weakest trader-math signal in this set; coding-dominant |
| *(opt.)* Old Mission | Proprietary | Math (~35 Q) + 1 LC-medium coding | ~35 Q + 1 coding | not firm | not reported | Downstream market-making sims (P&L, drawdown, inventory) |
| *(opt.)* Wolverine | HackerRank/CodeSignal | Coding + light quant/stats | timed, varies | not reported | platform-configurable | Reports occasionally include options/Greeks (finance knowledge — atypical) |

> **Two timing regimes to model separately:** (1) **Arithmetic sprint** ~6–8s/Q (Optiver 80-in-8, Jane St mental math, Akuna) — pure speed+accuracy, often penalized. (2) **Probability/EV reasoning** ~90s/Q (Optiver Beat the Odds, Citadel) up to ~3.5–6.5 min/Q (SIG, DRW) — where deep reasoning lives. SIG is the extreme "slow & deep, calculator allowed" end; Optiver/Akuna the extreme "fast sprint" end.

---

# Per-firm findings

## 1) Optiver ⭐ (selected top-3)

**Trader OA structure (2025–2026).** Resume → multi-section online battery (~2.5–3 hr, often across a 3-day window; each section an **independent gate** — fail one = out) → recruiter phone screen (~30 min, behavioral) → onsite/"Super Day" (~half day). The OA sections for the trader/quant track:
1. **80-in-8** — 80 mental-arithmetic questions in 8 minutes (**~6s/Q**), no calculator, MCQ. Scoring **+1 correct / −1 wrong / −1 skip**; pass line **~55/80**, competitive **~70+**. Reported to filter ~80% of applicants.
2. **NumberLogic / Sequences** — number/pattern next-in-sequence, **~15 Q / ~25 min**.
3. **Beat the Odds** — rapid probability & EV, **~30 Q / ~45 min ≈ 90s/Q** (older reports: ~10 Q / 15 min). 5-option "pick the closest value" MCQ. Scoring **+1 / −1 / 0 skip**, **no back-navigation**.
4. **Zap-N / Zap-Q** — gamified reaction-time / working-memory / risk-taking mini-games (~45–60 min).
5. *(SWE track only)* HackerRank coding — not part of the trader filter.

**Question types & rough proportions (trader OA):** mental-arithmetic speed ~35%, probability/EV ~30%, sequences/pattern ~15%, cognitive/reaction games ~20%. Behavioral is downstream (phone screen), not in the OA.

**Format/timing/platform:** Optiver-proprietary + CodeSignal battery plus the separate 80-in-8; "anti-GPT," auto-rejects on submit, no calculator. Some vendors call parts "adaptive" (difficulty adjusts with performance) — **Medium/Low confidence** on adaptivity specifics.

**Signature adversarial style:** the *clock and the penalty* are the adversary in the OA. Downstream trading games use a **market-making bot that picks off mispriced quotes** and refuses too-wide spreads. Probability is deliberately time-starved so you must **bucket/estimate** rather than compute exactly.

**Current vs outdated:** "80-in-8 is dead" is **FALSE** — it is confirmed current for 2026 traders. What's stale is treating 80-in-8 as the *whole* OA; the differentiating section is now **Beat the Odds** + cognitive games.

**Confidence:** 80-in-8 existence/pace/cutoffs **High**; Beat-the-Odds ~90s/Q & +1/−1/0 **High**; skip = −1 vs 0 on 80-in-8 **Medium (conflicting)**; adaptivity **Low**.

**Sources:**
- QuantVault — *Optiver Online Assessment: Format, Mental Math & Free Practice* — https://quantvault.org/optiver-online-assessment.html — 2026 — Medium (Beat the Odds ~30 Q/45 min @ 90s; +1/−1/0 no back-nav; CodeSignal battery)
- SpaceComplexity — *Optiver Phone Screen* — https://spacecomplexity.ai/blog/optiver-phone-screen-interview — 2025/26 — Medium (3 timed sections ~2.5 hr; ~80% filter; 55 cutoff / 70 competitive; −1 wrong)
- Dev.to (net_programhelp) — *Optiver 2026 OA Comprehensive Review* — https://dev.to/net_programhelp_e160eef28/optiver-2026-oa-comprehensive-review-26ng-intern-full-guide-eld — May 2026 — Medium (candidate; 5-section pipeline; negative marking)
- Quantt — *Optiver Interview: Process, Questions* — https://www.quantt.co.uk/resources/optiver-interview — 2026 — Medium (80/8 = 6s/Q; ~80% eliminated; "adaptive at some stages")
- JobTestPrep — *The Optiver Test* — https://www.jobtestprep.com/optiver-test — 2026 — Medium/Low (five assessments incl. NumberLogic, Beat the Odds, Zap-N/Zap-Q; +1/−1 incl. skip on 80-in-8)

---

## 2) Jane Street ⭐ (selected top-3)

**Trader interview structure (2025–2026).** Application → recruiter screen + **mental-math test** (~30 min slot) → 1–2 technical phone/video screens (60–90 min) → Super Day / final committee. The market-making game appears "in some form for every trader" candidate.

**OA / gating:** a **~60-question, 8-minute** timed **mental-math test** (Zetamac-style: 2-digit multiplication, division, percentages, fractions, decimals), **no calculator, no scratch paper**, pass bar **~70–80% correct**. Below the bar the process ends regardless of resume. (Count drifts by cycle: "~60", "~60–90", "~7 min" all reported.) Mental math has been **de-emphasized for SWE in 2026 but is still a dedicated trader round.**

**Rounds after the gate:**
- **Probability / brainteaser round (~60 min):** EV, conditional probability, classic brainteasers **with twist follow-ups**.
- **Market-making game (45–60 min):** interviewer specifies a partially-known random variable (e.g., "number of gas stations in the US," a dice-roll sequence, face-down cards); you quote a **two-sided market (bid/ask)**; the interviewer **trades against you at your prices**; reveals info; you re-quote, tighten spreads as uncertainty falls, and manage inventory/P&L.

**Question types & rough proportions:** mental-math ~25% (gate), probability/EV ~35%, brainteasers/logic ~15%, market-making/estimation ~25%.

**Signature adversarial style (two-pronged):**
1. **Adverse-selection market making** — if your spread is too wide the interviewer refuses and tells you to tighten; too narrow and they aggressively hit/lift, leaving you with inventory risk; every trade leaks information you must Bayesian-update on.
2. **"Defend & extend" probing** — after a correct answer they ask *"why?"*, *"what if I change this parameter?"*, or *"generalize to n"*. Reasoning and clear narration are graded above the final number.

**Current vs outdated:** Structure **High** and firm-corroborated (Jane Street publishes a *Probability & Markets* guide describing exactly probability, EV, and making markets). Exact mental-math count/cutoff **Medium** (drifts by cycle).

**Sources:**
- techinterview.org — *Jane Street Interview Guide 2026* — https://www.techinterview.org/companies/jane-street/ — 2026 — Medium-High (60 Q/8 min; 70–80% bar; market-making mechanics)
- TheInterviewDen — *Jane Street Quant Trader Interview* — https://theinterviewden.com/companies/jane-street-quant-trader-interview — 2025/26 — Medium (mental math ~7 min; prob round with twist follow-ups; market-making hit/lift + inventory)
- TechScreen — *Jane Street Technical Interview Process 2026* — https://techscreen.app/articles/jane-street-technical-interview-process-2026 — 2026 — Medium (market-making refuse-if-too-wide / pick-off-if-too-narrow; SWE mental-math de-emphasis)
- Wall St Math — *Jane Street Interview Math Practice* — https://wallstmath.com/guides/jane-street-interview-math-practice — 2026 — Medium (EV/odds/market-update arithmetic archetypes)
- **Firm-official** — Jane Street *Probability & Markets Guide* — https://www.janestreet.com/probability-markets/ — Firm-official (confirms probability, EV, making markets are what they test; no finance prereq)

---

## 3) Susquehanna — SIG ⭐ (selected top-3)

**Trader interview structure (2025–2026).** Resume → **Mercer|Mettl online assessment** → recruiter phone screen (resume + ~5 probability/math questions; reasoning valued over final answer) → SIG development-team technical → **Super Day** (4–6 back-to-back + group card/dice/trading game) → **poker round** for trader roles. ~4–8 weeks.

**OA (Mettl "Problem Solving Assessment"):** **~9–17 open-answer questions in 60 minutes** (TraderMath says **17**; JobTestPrep says as few as **9**; count genuinely disputed). **Calculator + pen/paper allowed, free back-and-forth navigation** — SIG is explicitly *not* testing arithmetic speed; it tests **problem framing and reasoning**. Non-integer answers submitted as a **simplified fraction**. A parallel older **Quantitative Evaluation** (~20 min / ~12–16 puzzle Q) still appears for some trader applicants.
- Content: **majority probability/EV** (binomial + linearity of expectation, independent events, conditional probability/Bayes, geometric/Markov), **combinatorics** second, **1–2 single-variable calculus/optimization**, **1–2 pure-logic/constraint or path-counting** puzzles. Normal distribution rarely appears.
- Failure mode candidates report: a **wrong first-step framing cascades** — each question card is heavy (~12–15 min of potential work), no feedback. "You can do the math but still fail" = the test rewards *thinking stability*, not calculation.

**Question types & rough proportions:** probability/EV ~45%, combinatorics ~20%, brainteaser/logic (incl. path-counting) ~20%, calculus/optimization ~10%, estimation ~5%. **No pure mental-math sprint** (calculator allowed) — a key differentiator from Optiver/Jane Street.

**Signature adversarial style:** SIG runs on **game theory and "thinking in bets."** The distinctive probe is *confidence calibration under social pressure* — "how confident are you? **how much would you bet on that?**" — plus the **poker round** (pot odds, fold equity, EV, Bayesian updating, bet-sizing vs edge). Not testing poker skill; testing whether you reason about probability, information asymmetry, and risk naturally. A tutorial is given, so **no prior poker/finance knowledge assumed**.

**Current vs outdated:** Process **High** (firm-official careers copy names Mercer|Mettl and lists Poker/Game Theory in the trainee curriculum; poker round universally reported). OA exact **count Medium (9 vs 17 disputed)**. Quantt's "30–50 Q sprint" framing **conflicts** with the far-better-corroborated 9–17/60-min calculator-allowed format → treat Quantt count as **Low**.

**Sources:**
- **Firm-official** — SIG careers (Quant Trader – Graduate 2026) — https://www.quantblueprint.com/jobs/sig-quantitative-trader-graduate-2026 (reproduces SIG's own copy) — 2026 — Firm-official (names *Mercer|Mettl / Induslynk* as OA administrator; lists Poker + Game Theory in QT curriculum)
- TraderMath — *SIG Interview Guide* — https://www.tradermath.org/articles/sig-interview-guide — 2026 — Medium (two-test split: 20-min Quant Eval vs 60-min/**17-Q** Problem Solving)
- JobTestPrep UK — *SIG Online Assessment* — https://www.jobtestprep.co.uk/sig-online-tests — 2026 — High (Mettl; formerly "Quantitative Evaluation"; ~9 numerical Q / 60 min; MCQ or open; simplified-fraction rule; 5 technical Q in phone screen)
- programhelp.net — *SIG OA Real Review* — https://programhelp.net/en/oa/how-to-pass-sig-online-assessment/ — 2024–26 — Medium (candidate-ish: 9 Q, calculator allowed, EV / independent events / logic-path; 12–15 min/card; "tests what you *think*")
- Quantt — *SIG Interview: Process* — https://www.quantt.co.uk/resources/sig-interview — 2026 — Medium (process + poker round; **Low** for its 30–50 Q OA count — conflicts with Mettl format)

---

## 4) Citadel Securities (closest runner-up — #4)

**Trader OA (2025–2026):** HackerRank quant sprint — **~15 questions / 30 minutes (~120s/Q)**, MCQ, **+1 correct / −1 wrong / 0 skip, free navigation**, no calculator (pen/paper OK). Probability, EV, conditional probability/Bayes, brainteasers, quick mental math — **no coding on the trader track** (coding is the SWE/QR variant at 75/80 min). Downstream: phone rounds (think-aloud probability), Super Day incl. **"Market of Cards" / "Make Me a Market" market-making games** (P&L, edge). Real 2026 candidate question examples corroborate the type mix (frog-jump EV, best-of-5 expected games, hat/color adjacency EV, red/blue-bus Bayes).

**Signature adversarial style:** escalating **multi-stage decision problems** and market-making at scale; overlaps heavily with Jane Street's setup (techinterview explicitly says "similar to Jane Street's").

**Confidence:** 15/30 + **+1/−1/0** format **Medium-High** (TradingInterview model + 2026 candidate write-ups + ExtraBrain table agree); role-split durations **Medium-High**.

**Why #4 not top-3:** Format corroboration is excellent, but (a) the exact 15/30 spec traces largely to one prep-vendor model echoed by lead-gen sites, and (b) its adversarial signature is a **near-duplicate of Jane Street's** market-making — so a Citadel preset would be redundant with the Jane Street preset. SIG's calculator-allowed deep-reasoning + "want to bet?"/poker signature is more *distinct* and just as well-corroborated at the *process* level (with firm-official confirmation), making it the more valuable third preset.

**Sources:**
- TradingInterview — *Round 1: Citadel Securities Online Assessment* + quiz — https://www.tradinginterview.com/courses/company-preparations-course/lessons/citadel-securities/ — 2025/26 — Medium (15 Q/30 min; +1/−1/0 skip; free nav; MCQ; downstream Market-of-Cards)
- linkjob.ai — *2026 Citadel HackerRank Questions* — https://www.linkjob.ai/interview-questions/citadel-hackerrank-questions/ — 2026 — Medium (candidate; Quant Trader 30 min; real EV/Bayes examples)
- ExtraBrain — *Citadel HackerRank Questions 2026* — https://extrabrain.app/interview-questions/citadel-hackerrank-questions-extrabrain/ — 2026 — Medium (role→timing table: QT ~30 min, QR ~80, SWE ~75)
- techinterview.org — *Citadel Securities Interview Guide 2026* — https://www.techinterview.org/companies/citadel-securities/ — 2026 — Medium-High (market-making "similar to Jane Street"; probability/EV/random-walk emphasis)

---

## 5) Five Rings Capital

**OA:** HackerRank, **proctored, one question at a time, typed-numeric (2 dp / nearest int), no calculator, no answer choices.** **~15–20 quantitative Q in <20 min (~60–75s/Q).** Two pillars: (1) probability & combinatorics (coins/dice creatively combined); (2) estimation & mental-math (find a simplified model fast) incl. integrals/arc-length, logs, geometry, Fermi. Interview pace even more brutal (**~30s/Q**; estimation rounds 10–15s/answer). **Confidence High** (2025 WSO candidate reports + 2026 vendor). Excellent data but narrow (no distinctive market-making OA; extreme-speed niche). Sources: aptitude-test-prep.com Five Rings OA [2026]; quantblueprint.com; WSO 2025 ("10 Q, 30s each"; arc-length of x²).

## 6) DRW

**OA:** **6 questions / 45 minutes (~7.5 min/Q)**, MCQ, **+1 correct / 0 wrong / 0 skip, free navigation** (guessing is free). Probability, brainteasers, statistics, **linear algebra / Markov chains**, calculus, EV; often one "essentially unsolvable" item you can skip and still advance. **Confidence High** on 6/45 (2025 WSO + 1point3acres candidate reports + TradingInterview model). Distinctive but heavier on linear algebra/Markov depth than the "no-prereq reasoning" target; slow deep format overlaps conceptually with SIG. Sources: tradinginterview.com DRW OA; 1point3acres thread 1076221 (2025); techinterview.org/companies/drw-interview-guide; wallstreetoasis.com/company/drw/interview (2025).

## 7) Akuna Capital

**OA Round 1 (both must pass):** Math **80 Q / 8 min (6s/Q)** type-in, no calculator; Sequences **~24–30 Q / 12–16 min (~32s/Q)** incl. letters & logical patterns. Round 2: VidCruiter betting game + video. Round 3: HackerRank coding (2–3 Q / 90 min, e.g., a P&L function). **Confidence High** on 80-in-8 math, **Medium** on sequences count (24/12 vs 30/16 disputed). Very close to Optiver's arithmetic-sprint archetype (partly redundant). Sources: tradinginterview.com/akuna-capital-online-assessment; aptitude-test-prep.com Akuna [2026]; tradermath.org.

## 8) IMC Trading

**OA (HackerRank, module-locked, no back-nav):** cognitive-ability games (~45 min) → logical/numerical reasoning (~40 min) → **math/probability ~15–20 Q / 30–60 min** (conditional EV, game theory, geometry/combinatorics) → **mandatory market-making Trading Game** for quant roles (spread profit, max drawdown, time-weighted net position). **Confidence Medium-High** on 3-module + trading-game structure (2026 candidate report + TraderMath). Rich, but the front-loaded cognitive-games battery is hard to replicate as pure Q&A. Sources: quantt.co.uk/resources/imc-trading-interview; linkjob.ai IMC 2026; tradermath.org IMC guide.

## 9) Jump Trading

**OA:** HackerRank/proprietary. Trader/research track = probability-and-statistics test (~60–120 min) **plus Jump's signature rapid-fire mental arithmetic** (candidate reports of 30–60 arithmetic problems — unusually arithmetic-heavy for a research shop). SWE = 2–3 hard algo problems / 90–120 min. **Confidence Medium** (structure Medium-High, exact counts Medium; quantt cites 35% prob / 30% market / 20% mental math / 15% behavioral). Thinner primary corroboration than the top 4. Sources: myntbit.com; quantblueprint.com/guides/how-to-get-a-job-at-jump-trading (2026); quantt.co.uk/resources/jump-trading-interview (2026).

## 10) Hudson River Trading (HRT)

**Engineering-led:** Stage 1 = **CodeSignal GCA, 4 problems / 70 min, score/600 (≥500 bar)**; a math/probability stage is a *second, role-gated* step (Algo/QR/Trader lines only; SWE often skips it). HRT's OA is the **least probability-heavy / least trader-math-shaped** in this set — for a trader-reasoning preset it's the weakest reference. **Confidence High** on coding-first identity; math-stage details **Low-Medium**. Sources: quantt.co.uk/resources/hudson-river-trading-interview; tradermath.org HRT; oavoservice.com (lead-gen, Low).

## (Optional) Old Mission / Wolverine

- **Old Mission:** proprietary OA = math (~35 Q) + 1 LC-medium coding; strong downstream **market-making sims** (bid/ask, P&L, max drawdown, inventory, weighted-avg price). Thin primary data (single WSO report). **Medium/Low.**
- **Wolverine:** HackerRank/CodeSignal coding + light stats/probability; some reports include **options/Greeks and Minitab output** — i.e. leans on finance knowledge, which *violates our no-options-prereq constraint*. Not a good preset base. **Medium/Low.**

---

# Ranking — accuracy + recency + corroboration

Scored on: (a) **recency** of sources (2025–2026 weighted), (b) **corroboration across independent source types** (firm-official + candidate + vendor beats vendor-only), (c) **trader-track specificity**, and (d) whether a **distinctive, well-documented signature mechanic** exists to drive a non-redundant preset.

| Rank | Firm | Recency | Corroboration | Trader-specific | Distinct signature | Verdict |
|---|---|---|---|---|---|---|
| **1** | **Optiver** | ★★★ | ★★★ (candidate + vendor + firm practice test) | ★★★ | ★★★ speed/penalty + pickoff bot | **SELECT** |
| **2** | **Jane Street** | ★★★ | ★★★ (candidate + vendor + **firm-official** guide) | ★★★ | ★★★ adverse-selection MM + defend/extend | **SELECT** |
| **3** | **Susquehanna (SIG)** | ★★★ | ★★☆ (**firm-official** process + vendor + candidate; OA count disputed) | ★★★ | ★★★ "want to bet?" + poker | **SELECT** |
| 4 | Citadel Securities | ★★★ | ★★☆ (tight format, but vendor-anchored) | ★★★ | ★★☆ (duplicates Jane St MM) | Runner-up |
| 5 | Five Rings | ★★★ | ★★★ (2025 WSO primary) | ★★★ | ★★☆ extreme-speed niche | Strong data, narrow |
| 6 | DRW | ★★★ | ★★★ (2025 primary) | ★★☆ | ★★☆ (LA/Markov depth) | Strong data |
| 7 | Akuna | ★★☆ | ★★★ (math) | ★★★ | ★☆ (dupes Optiver) | Redundant |
| 8 | IMC | ★★★ | ★★☆ | ★★★ | ★★☆ (games hard to mock) | — |
| 9 | Jump | ★★☆ | ★★☆ | ★★☆ | ★☆ | Thinner |
| 10 | HRT | ★★☆ | ★★☆ | ★☆ (coding-led) | ☆ | Off-target |

## Selected TOP 3: **Optiver, Jane Street, Susquehanna (SIG)**

**Why these three:**
1. **Optiver** — the single best-documented trader OA. Multiple 2026 *candidate* reports plus vendors agree on exact section names, timings, and scoring, and Optiver even hosts a public practice version of the probability test. Signature = **raw speed + −1 penalty + a market-making bot that picks off bad quotes**. Non-negotiable #1.
2. **Jane Street** — the most iconic trader loop, with **firm-official** confirmation of what's tested (their *Probability & Markets* guide) plus dense 2026 candidate/vendor corroboration of the mental-math gate and market-making game. Signature = **adverse-selection market making + "defend & extend" probing**.
3. **Susquehanna (SIG)** — chosen over Citadel because (a) its *process* has **firm-official** corroboration (careers copy naming Mercer|Mettl and listing Poker/Game Theory) and universal candidate agreement on the poker round, and (b) its signature — **calculator-allowed deep reasoning + "how much would you bet on that?" confidence calibration + poker** — is genuinely **distinct** from the two market-making presets, so the three presets cover three different adversarial behaviors instead of two overlapping ones.

**Deliberately not selected:**
- **Citadel Securities (#4)** — data is excellent and it was a coin-flip with SIG, but its market-making signature nearly duplicates Jane Street's, and its precise 15/30 spec is vendor-anchored rather than firm-official. It is the **drop-in substitute** if a fourth preset is ever wanted (spec: 15 Q / 30 min, +1/−1/0 skip, free nav, probability-MCQ sprint + Market-of-Cards).
- **Five Rings / DRW** — superb primary data but narrower/overlapping signatures (extreme-speed typed-numeric; linear-algebra/Markov depth).
- **Akuna** — redundant with Optiver's arithmetic sprint.
- **HRT / Wolverine** — off-target for a *trader-reasoning* preset (coding-led; Wolverine leans on options knowledge, violating the no-prereq constraint).

**Cross-cutting design principles carried into the presets (`FIRM_MOCK_PRESETS.md`):**
- Model **two timing regimes** separately: arithmetic sprint (~6–10s/Q) vs probability reasoning (~90–240s/Q).
- **No finance/options knowledge** in any question — reasoning, math, probability/EV, speed only.
- Replicate real **penalty/skip incentives** where documented (Optiver +1/−1; SIG/JS no penalty).
- Each preset carries a **distinct adversarial "probe"**: Optiver = pickoff-bot + clock; Jane Street = defend/extend + adverse selection; SIG = confidence-calibration "want to bet?" + poker EV.
