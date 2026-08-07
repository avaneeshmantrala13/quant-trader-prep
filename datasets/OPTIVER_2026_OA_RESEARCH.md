# Optiver Online Assessment (OA) — Live Web Research, 2025–2026

**Compiled:** 6 Aug 2026 via live WebSearch/WebFetch.
**Scope:** What the *current* (2025–2026, with some 2027-cycle previews) Optiver online assessment actually contains, section by section, for the quant (trader / researcher) track. Focus is the **cognitive + behavioral game battery** — **Zap-N** (gamified mini-tests), **NumberLogic** (number-sequence patterns), **Beat the Odds** (rapid probability/EV), and **Zap-Q** (personality questionnaire) — plus the legacy **80-in-8** mental-arithmetic screen for contrast, and the 2026/27 add-on modules (Likelihood, Intervals, Order Books). This doc will inform building **practice games** that mimic each section, so each breakdown ends with a builder-facing design mapping.

Companion to `FIRM_INTERVIEW_LIVE_RESEARCH_2026.md`; same rigor and structure (methodology note, per-section breakdown, paraphrase rule, sources with URLs + dates + confidence).

---

## Methodology & recency note

- **What I prioritized:** (1) the **actual test vendor** — Optiver's OA is built and administered by the Dutch assessment firm **Zyvo** (formerly the brand behind these "Zap-*" products), whose own product page describes Zap-Q's psychometric design; (2) **2025–2026 first-hand candidate write-ups** (Wall Street Oasis entries dated Oct 2025 and a 2025/26 Amsterdam QR account; Dev.to candidate/mentor reviews of the 2026 and 2027 cycles); (3) detailed **prep-vendor breakdowns** (Aptitude-Test-Prep, JobTestPrep, QuantVault, Quant Career Hub, Canary Wharfian). Tier (3) is used for *shape and mechanics* (game rosters, timing, scoring), corroborated where possible against tier (1)/(2).
- **Paraphrase rule honored:** every example item below is **paraphrased and generalized** so a builder can generate original variants. **No proprietary question sets are copied verbatim.** Where I give a sequence or probability example, it is a generic illustration of the *pattern family*, not a reproduction of a real test item.
- **Skepticism / cross-checking:** claims are cross-checked across ≥2 independent sources before being treated as reliable. **Prep vendors recycle each other's numbers**, so vendor agreement is treated as weak evidence; I flag anything single-sourced or vendor-only inline. Exact question counts and per-second timings **drift by cycle and role** — treat them as directional.
- **Confidence key:** **High** = vendor-official (Zyvo) and/or multiple independent 2025–2026 first-hand reports agree. **Medium** = consistent across several aggregators + at least one primary confirmation. **Low** = single source, prep-vendor-only, or lead-gen aggregator.
- **Recency:** Everything reflects the 2025–2026 cycles, with a 2027-cycle preview for the newest quant modules. Where a claim is only attested for one cycle, I say so.
- **Universal caveat:** Optiver does not publish an official scoring key or an official section roster. All counts/timings/cutoffs are **directional shapes**, not contractual. Section rosters vary by **role** (Quant Trader vs Quant Researcher vs Software Engineer) and by **cycle**.

### Important honesty note on the "80-in-8 was phased out" premise

The prompt's framing — that Optiver *phased out* the classic **"80-in-8"** mental-arithmetic gate in favor of the game battery — is **partially supported but not cleanly confirmed**, and sources conflict:

- **Supports "de-emphasized/dropped for some tracks":** A **first-hand Oct-2025 WSO report** (Optiver Chicago, analyst/SWE) describes the first round as a **1-hour HackerRank containing NumberLogic + Beat the Odds + Zap-N** — with **no 80-in-8 mentioned**. A **2025/26 Amsterdam Quant-Research** first-hand account lists **four modules (Quantitative Research coding test, NumberLogic, Beat the Odds, Zap-N)** — again **no standalone 80-in-8**. QuantVault explicitly frames 80-in-8 as a **separate screen** from the main battery (i.e., not always bundled), and notes recent QT/PhD runs show **fewer Zap-N games (≈3, not 9)**.
- **Contradicts "phased out entirely":** Prep guides updated for 2026 (**Aptitude-Test-Prep**, mod. 5 Jul 2026; **JobTestPrep**) and a Dev.to 2026 review still list **80-in-8 as a live section**, and QuantVault still ships a "2026/27 replica" of it.
- **My reading (Medium confidence):** The **game battery (NumberLogic, Beat the Odds, Zap-N, Zap-Q) is the confirmed spine** of the current OA. The **standalone 80-in-8 appears role/cycle-dependent** — plausibly dropped or folded into other modules for some 2025–2026 quant cycles (matching the candidate's report), while still present in others. I would **not** state flatly that 80-in-8 is universally retired. Fast mental arithmetic itself is clearly *still* pervasive (no calculator; Number Box, Intervals, Beat the Odds all lean on it).

---

## OA at a glance (quant track, 2025–2026)

| Section | Format | Volume / timing (directional) | Scoring (where known) | Confidence |
|---|---|---|---|---|
| **80-in-8** (legacy mental math) | 4-option MC arithmetic, no calc, no skip/back, auto-advance | 80 Q / 8 min (~6 s/Q) | +1 correct / −1 wrong; **no skip** | High (format); **Medium** (still-present-per-role) |
| **NumberLogic** (sequences) | 5-option MC, find next/missing term; skip + back-nav allowed | ~26 Q / 25 min | +1 / −1 / **0 skip**; ~15 pts "safe" | High |
| **Beat the Odds** (probability/EV) | 5-option MC "pick the closest"; **no back-nav** | ~20–30 Q, **90 s/Q** (~30–45 min) | +1 / −1 / **0 skip** | High |
| **Zap-N** (cognitive games) | 9 gamified mini-tests (2–15 min each); some cycles show ~3 | ~45–120 min total | Per-game behavioral/cognitive metrics; **not a single pass/fail** | High (roster); Medium (per-game scoring) |
| **Zap-Q** (personality) | **Forced-choice** pairs; untimed (~25 min) | ~150 items; **24 traits** | Trait profile (Item Response Theory); **non-eliminating** | High (Zyvo-official) |
| **2026/27 quant add-ons** | Likelihood (rank), Intervals ([L,U]), Order Books (arbitrage) | 15 / 18 / 20 Q respectively | Judgment/estimation-rewarded (no official key) | Medium (newest; fewer sources) |
| **QR coding add-on** | HackerRank algo | 3 problems / 90 min (2 code + 1 approx) | Standard | Medium |

> **Platform/administration:** The battery runs on **CodeSignal/HackerRank**; the underlying game/personality engine is **Zyvo's** ("Zap-N", "Zap-Q"). Total ~2.5–3 hours, often spread across days. It is deliberately long and "anti-GPT," and candidates report **frequent auto-reject on submission** and **poor recruiter communication** (multiple 2025 first-hand reports; one candidate confirmed via a GDPR data request that he *passed* the tests yet was still rejected).

---

# Per-section findings

## 1) Zap-N — the gamified cognitive battery (Confidence: **High** on roster; **Medium** on per-game scoring)

**What it is / what it measures.** Zap-N is Optiver's **cognitive game battery** — a timed set of short reaction / memory / planning / risk / inhibition mini-tests, run alongside the math modules. Each game is a **repurposed classic cognitive-psychology paradigm** adapted to a trading frame. It measures **reaction speed, working memory, attention-switching, inhibitory control, planning, and risk calibration** rather than knowledge. **Format/volume:** classically **9 games**, each ~2–15 min, ~45–120 min total; **recent Quant-Trader / PhD cycles reportedly show only ~3 games** (roster varies by cycle/role). **Scoring:** each game yields its own behavioral metrics (speed, accuracy, planning time, risk profile); recent candidate reports suggest **one weak game no longer auto-rejects** — the math modules carry most weight. *(High on roster: corroborated by Aptitude-Test-Prep's game-by-game breakdown + QuantVault + multiple candidate reports. Medium on scoring: no official key; behavioral interpretation inferred from the underlying paradigms.)*

Below, each named mini-game with its underlying paradigm, format, and what it measures. **Single-sourcing flags noted inline.**

### 1a) Stockmaster / "Stock Master" (Confidence: **Medium**)
- **Format:** A trading-flavored **reaction-timing** game. Speedometer-style **indicators** appear and disappear all over the screen at varying speeds; you must **click each indicator while its needle is sweeping through the colored/green zone** ("buy the stock" at the right instant). Lasts ~**2 minutes**. *(Corroborated by Aptitude-Test-Prep + Quant Career Hub + QuantVault.)*
- **Measures:** Sustained **vigilance / selective attention** and **timed execution** — "don't jump too early, don't freeze too late." It's the classic **speed-accuracy tradeoff** under continuous, multi-target pressure. Quant Career Hub frames it as a repurposed reaction-time paradigm tuned to trading-execution timing.
- **Naming note:** Prompt calls it "Stockmaster"; sources render it "Stock Master" / "Stock Indicator." Same game.

### 1b) Shape Shift / "Shapeshift" (Confidence: **High**)
- **Format:** A **Simon-effect** inhibition task. A **circle or square** flashes briefly at a **random screen position**; you press a fixed key by **shape** — e.g., **circle → right arrow, square → left arrow** — **regardless of where it appeared**. ~**60 rounds**; no correctness feedback shown. *(Aptitude-Test-Prep, JobTestPrep, Quant Career Hub all agree on mechanics; arrow↔shape mapping direction differs slightly between sources — treat the *mapping* as illustrative.)*
- **Measures:** **Inhibitory control / selective attention under interference** — your brain wants to respond to the *location* (spatial bias); the game punishes that instinct. Classic Simon task (first described 1963).

### 1c) Number Box / "NumberBox" (Confidence: **High**)
- **Format:** A **"24 Game"–style modular arithmetic puzzle**. You're shown **four numbers** and a **target ("destination") number**, and must combine the four using the **four basic operations (+ − × ÷)** to reach the target. You **combine pairwise** (tap two numbers + an operator to make an intermediate value, then combine again) — so **implicit bracketing is allowed** (e.g., reach 24 via (5+7)×(10−8)). ~**10 rounds**; you may give up and move on after a time limit. *(Aptitude-Test-Prep + JobTestPrep + Quant Career Hub + QuantVault agree.)*
- **Measures:** **Mental flexibility and creative arithmetic under pressure** — not raw calculation, but finding *a* valid path fast (often multiple solutions exist). Trading analogy: constructing a workable answer from incomplete/imperfect inputs.

### 1d) Balloon (BART) (Confidence: **High**)
- **Format:** The **Balloon Analogue Risk Task**. Pump a balloon; **each pump adds money**; **cash out** anytime to bank it and advance; but each balloon **pops after a random number of pumps**, wiping that balloon's unbanked earnings. Reported as **two rounds** — R1: ~30 balloons, 10¢/pump, pop = lose the round's unbanked cash; R2: ~20 balloons, doubled reward (20¢/pump) but a **penalty on pop** (e.g., lose half of banked). *(Aptitude-Test-Prep detailed; QuantVault corroborates.)*
- **Measures:** **Risk-taking / risk calibration** (explicitly the BART psychometric). Optiver wants a **consistent, calibrated risk policy**, not recklessness or timidity.

### 1e) Skyscraper / "Tower" (Tower of London) (Confidence: **Medium**)
- **Format:** **Tower of London** planning puzzle. Rearrange **3 towers of stacked blocks** to match a target configuration, **moving only the top block** of a stack at a time, in the **fewest moves / least time**. ~**10 levels**, increasing difficulty. *(Aptitude-Test-Prep + QuantVault.)*
- **Measures:** **Forward planning / working memory**; notably, the game reportedly logs **pre-move planning time** — very short planning time reads as **impulsivity** (undesirable). Reward deliberate planning, then fast execution.

### 1f) Pincode / "Digit" (digit span) (Confidence: **Medium**)
- **Format:** **Digit-span** memory. Digits **flash one at a time**; you **type the sequence back**. It **grows by one digit** after two correct at a length; two wrong at a length ends the game. Later **rounds add transforms**: **reverse order**, then **sort digits low→high**. No pen/paper allowed. *(Aptitude-Test-Prep detailed 3-round structure; QuantVault corroborates "recall grows every round.")*
- **Measures:** **Working memory capacity** and **mental manipulation** of held items (reverse/sort = executive load on top of storage).

### 1g) The Switch / "Task Switch" (task-switching) (Confidence: **Medium**)
- **Format:** **Task-switching** dual-task. Two prompt blocks — a **simple arithmetic drill** and a **pair of arrow sets** — with a **rule that flips** which block is "active." When the math block is highlighted, answer e.g. "**is the result odd?**"; when the arrows block is highlighted, answer e.g. "**are the two arrow sets identical?**" Respond Yes/No fast as the active task alternates. ~**35 rounds**. *(Aptitude-Test-Prep + JobTestPrep + QuantVault.)*
- **Measures:** **Cognitive flexibility / switch cost** — how much speed/accuracy you lose each time the rule flips between arithmetic and visual matching.

### 1h) Code Compare (perceptual matching) (Confidence: **Medium**)
- **Format:** **String/data matching against the clock.** A reference **sequence of ~7–10 letters/digits** is shown, then **4–5 near-identical candidates**; pick the **exact match**. Time per item **shrinks from ~5 s down to ~3 s (some sources ~0.5 s)** as difficulty ramps; ~**30 rounds**; unanswered items auto-advance. *(Aptitude-Test-Prep + QuantVault; JobTestPrep sells "Code Compare" practice.)*
- **Measures:** **Perceptual speed / attention to detail** under a shrinking decision window — nerve, not strategy.

### 1i) Figure It Out / "Pattern Guess" (Mastermind-style deduction) (Confidence: **Medium; single-source-leaning**)
- **Format:** **Mastermind-style hidden-attribute deduction.** Guess the properties of a **hidden figure** (shape, color, pattern, …); after each guess you're told **how many properties are correct** (not which). Goal: **fewest guesses** using the feedback. ~**5 rounds**, each adding more attributes. **Time reportedly does not affect score — move count does.** *(Detailed mainly by Aptitude-Test-Prep; QuantVault lists a "Pattern Guess" game consistent with this. Treat the exact round structure as Low/Medium.)*
- **Measures:** **Hypothesis-driven reasoning / information use** — build and update a strategy from partial feedback rather than trial-and-error.

**Other/variant games seen across cycles (Low confidence):** a **"dial-timing" reaction** test, and a **24-points arithmetic** variant — some sources treat these as alternate names for Stock Master / Number Box. Canary Wharfian describes Zap-N as **"~10 mini-games… very similar to Pymetrics,"** and notes a separate **SHL "General Ability"** test (percentages, reading graphs) may also be sent — suggesting Optiver mixes Zyvo games with SHL cognitive tests depending on region/role. *(SHL-general-ability = single-source; Low.)*

**Builder mapping — Zap-N practice suite:** Build each as a standalone micro-game with a **calibration/warm-up screen** (candidates say the biggest edge is familiarity, so the real test isn't the first attempt):
- *Reaction/timing* → **Stock Master clone**: multiple needles sweeping at random speeds; click inside a moving green window; score = hits − early/late penalties; a moving accuracy-vs-speed meter.
- *Inhibition* → **Simon task**: shape-keyed responses at random positions; report **congruent vs incongruent RT gap** as the headline metric.
- *Creative arithmetic* → **24-Game / Number Box**: 4 tiles + target, pairwise-combine UI (implicit brackets), multiple valid solutions, "time-to-first-solution" score.
- *Risk* → **BART balloon**: log a **risk-policy curve** (avg pumps, variance, adjustment after a pop) and coach toward a *consistent* policy.
- *Planning* → **Tower of London**: track **planning latency** and **move-optimality**; reward "plan then execute."
- *Working memory* → **digit span** with reverse/sort variants; report span length.
- *Switching* → **task-switch** arithmetic↔arrow-match; report **switch cost (ms)**.
- *Perceptual speed* → **Code Compare** with a shrinking timer.
- *Deduction* → **Mastermind** with "N correct" feedback; score = guesses used.

---

## 2) NumberLogic — number-sequence pattern test (Confidence: **High**)

**What it is / what it measures.** A **number-series / pattern-recognition** test: you see a **sequence of ~5–7 numbers** (or a series with a missing term) and pick the **next/missing term** from **5 options**. Progressively harder — the **last few sequences are near-impossible**. **Format/volume:** ~**26 questions in 25 minutes** (~58 s/Q). **No calculator** per some accounts; Aptitude-Test-Prep says a **calculator is allowed and recommended** (fractions/large numbers) — this **conflicts** and is likely **cycle/role-dependent** *(flagged)*. **Navigation:** you **may skip and go back**; skipped items are listed at the bottom for quick return. **Scoring:** **+1 correct / −1 wrong / 0 skip** — so a **confident skip beats a blind guess**; a score of **~15** is reported as "safe." *(High: 26 Q / 25 min and +1/−1/0 corroborated across Aptitude-Test-Prep, QuantVault, dev.to 2026, programhelp 2026, and a first-hand 2025/26 WSO Amsterdam account calling it "a 25-minute numerical reasoning test.")*

**Pattern families (paraphrased, generic illustrations — not real items):**
- **Second-order linear recurrences:** e.g. `a(n) = 2·a(n−1) + a(n−2)` (a sequence like 2, 5, 12, 29, 70, … follows this shape).
- **Alternating / interleaved sub-sequences:** odd-position and even-position terms each follow their own rule.
- **Difference ladders:** first/second differences form their own pattern (arithmetic-of-arithmetic).
- **Ratio + offset / multiplicative-plus-constant** blends; occasional **fraction or large-number** sequences designed to burn clock.

**"Time pit" warning (candidate-reported):** the trap is **sinking minutes into one hard sequence**. Correct behavior is **triage** — bank the easy/medium ones, **skip the near-impossible tail** (skip is free), and use back-nav only if time remains.

**Builder mapping — Sequence Sprint:** Generate sequences from a **parameterized family bank** (linear recurrences, interleaved, difference-ladder, ratio+offset), 5 options with **plausible distractors** (off-by-one-rule traps). Implement **+1/−1/0 scoring**, **skip + revisit**, a **25:00 global clock**, and a **difficulty ramp** that makes the last ~3 brutal. Surface a **triage coach** ("you spent 4 min on Q19 — skip-and-bank pays more").

---

## 3) Beat the Odds — rapid probability / expected value (Confidence: **High**)

**What it is / what it measures.** The **most math-heavy** module: **rapid probability theory and expected value** under a hard per-question clock. Questions revolve around **dice, cards, coins, urns, random walks, and EV**. **Format/volume:** **~20 questions** per Aptitude-Test-Prep; **~30** per dev.to 2026 and programhelp 2026; **QuantVault ~30 Q / 45 min**. Consistent core: **90 seconds per question**, **5 options**. **The answer choices are deliberately coarse estimates — you "pick the closest"** (e.g., true answer 0.45, options are 0, 0.1, 0.2, 0.5, 1 → choose 0.5). **Navigation:** **no back-nav**; once you skip/advance you can't return. **Scoring:** **+1 correct / −1 wrong / 0 skip** — **skip beats a guess**. *(High: 90 s/Q, 5-option "closest," +1/−1/0, no-back all corroborated across Aptitude-Test-Prep, QuantVault, and a first-hand 2025/26 WSO Amsterdam account ["a 45-minute probability assessment … strict time limit per question"]. Only the exact count [20 vs 30] varies by cycle — flagged.)*

**Archetypes (paraphrased, generic illustrations):**
- **Discrete probability:** P(event) with dice/cards/coins; conditional probability / basic Bayes.
- **Expected value:** EV of a payoff scheme; "fair price to play" a simple game.
- **Combinatorics-lite:** counting favorable outcomes among equally likely ones (e.g., P(one die beats another) → 15/36 ≈ 42%).
- **Random-walk / Markov flavor:** e.g. "expected return time to the start on a small cycle graph" — recurring families that must become **reflexes** because 90 s is not enough to derive from scratch.

**Design intent (candidate/mentor-reported):** the module rewards **fast, approximately-right reasoning over exact computation** — pick the closest bucket and move on. This is the same philosophy the 2027 add-ons (below) double down on.

**Builder mapping — Odds Sprint:** A **90 s/Q**, 5-option **"pick the closest"** probability engine with **intentionally coarse choices**, **+1/−1/0 scoring**, **no back-nav**, and a **question-family generator** (dice/cards/coins/urns/EV/small-Markov). Track **recurring-family reflex speed** and coach "estimate to the nearest bucket, don't chase exactness."

---

## 4) Zap-Q — personality / behavioral questionnaire (Confidence: **High** — vendor-official)

**What it is / what it measures.** Zap-Q is **Zyvo's** personality survey (the actual product Optiver uses). It's a **forced-choice** questionnaire: **~150 items**, each presenting **two statements**; you pick which **better describes you** — you may agree/disagree with both, but must choose (this **ranks traits** and **resists gaming**). **Untimed** (a Dutch JobTestPrep page estimates **~25 minutes**). It maps **24 work-related traits**, is **derived from the Big Five**, uses **Item Response Theory**, is **adaptive** (follow-up items chosen from prior answers), and was developed with the **University of Twente**. **Stakes:** it is **not eliminating** on its own; Optiver uses the profile to **shape behavioral-interview questions** and assess team fit. *(High: mechanics and psychometrics come straight from Zyvo's official product page; the 24-trait list and forced-choice/150-item detail from Aptitude-Test-Prep; non-eliminating + ~25 min from JobTestPrep NL.)*

**The 24 traits measured (paraphrased from Aptitude-Test-Prep's list):** Action Orientation, Attention to Detail, Cause Analysis, Empathy, Focus, Imagination, Impulse Control, Influence Ability, Need for Attention, Need for Rules, Need for Tension (risk appetite), Optimism, Perseverance, Rationality, Self-control, Self-esteem, Self-interest, Self-reliance, Self-responsibility, Sociability, Stress Sensitivity, Trust in Others, Work Organization, Work Tempo.

**Guidance sources converge on:** answer **honestly but professionally** (work-self, not home-self), stay **internally consistent** (forced-choice + IRT catch contradiction), and recognize that traits like **impulse control, rationality, stress tolerance, perseverance, and calibrated risk appetite ("Need for Tension")** are the trading-relevant ones. *(Medium — this is interpretation, not an official rubric.)*

**Builder mapping — Trait Profiler:** A **forced-choice paired-statement** engine (~150 items) scoring toward a **multi-trait radar** (use a Big-Five-derived trait set), with an **internal-consistency check** (repeat/mirror items) and a **debrief** highlighting the trading-relevant dimensions (impulse control, risk calibration, composure, perseverance). Keep it **non-eliminating** and framed as **self-insight + interview prep**, not pass/fail.

---

## 5) Legacy & 2026/27 add-on modules (context + contrast)

### 5a) 80-in-8 (legacy mental-arithmetic gate) (Confidence: **High** on format; **Medium** on current inclusion)
**Format:** **80 basic arithmetic questions in 8 minutes** (~6 s/Q) — +, −, ×, ÷ of integers, fractions, decimals, percentages; **4-option MC**; **no calculator** (pen/paper OK); **cannot skip or go back** (auto-advance); **+1 correct / −1 wrong, no skip option** (so blind guessing is directly penalized). Reported targets: **~60+ attempted at ~70%+ accuracy**. Shared with other firms (Akuna, Maven). **Current status:** see the honesty note at the top — **format is well-established; whether it's a *standalone* section in a given 2025–2026 quant cycle is role/cycle-dependent** and omitted from at least two 2025/26 first-hand quant reports.

### 5b) New 2026/27 quant modules (Confidence: **Medium** — newest, fewer sources; one is a mentor write-up)
The 2027 cycle reportedly adds **three modules** emphasizing **decision-making under uncertainty over exact calculation**:
- **Likelihood / Likelihood-list** — **~15 Q, 90 s each.** Given historical observations, **rank/predict future outcomes by probability** (recognize a trend from a small sample rather than compute a model). Measures **statistical intuition / fast probabilistic reasoning**.
- **Intervals** — **~18 Q, 60 s each.** Submit a **[lower bound, upper bound]** for an unknown quantity/probability/EV. Rewards being **approximately right** (tighter correct intervals score better); e.g., estimate P(exactly one square and one circle) from a **large visual grid** by eyeballing counts, or P(friend's die > yours) ≈ 42% → submit [40, 43]. Measures **estimation / order-of-magnitude judgment**.
- **Order Books / Orderbooks** — **~20 Q, ~8 min total (~24 s/Q).** Read a **bid/ask order book** and instantly spot **crossed markets, arbitrage, safe inventory reductions, profitable execution**. Measures **market intuition + bid/ask mechanics**. *(The most trading-authentic module.)*

**Builder mapping — Uncertainty modules:** (i) **Likelihood ranking** from small samples; (ii) **Interval estimator** scoring [L,U] on containment + tightness with a hard 60 s clock; (iii) **Order-book arbitrage spotter** with crossed-market/inventory puzzles under ~24 s/board. These three are the highest-value additions for a *trading* practice product because they directly rehearse "decide well, fast, without perfect info."

---

## Cross-section summary (sourced findings + confidence)

- **Zap-N (High roster / Medium scoring):** 9-game cognitive battery (often ~3 in recent QT/PhD cycles). **Stock Master** = trading-timed reaction (click needle in the green, ~2 min, **Medium**); **Shapeshift** = Simon-effect inhibition (~60 rounds, **High**); **Number Box** = 24-Game modular arithmetic, implicit brackets (~10 rounds, **High**); plus **Balloon (BART risk, High)**, **Skyscraper (Tower of London planning, Medium)**, **Pincode (digit span + reverse/sort, Medium)**, **The Switch (task-switching, Medium)**, **Code Compare (perceptual speed, Medium)**, **Figure It Out (Mastermind deduction, Low-Medium)**. A weak single game reportedly no longer auto-rejects.
- **NumberLogic (High):** ~26 sequence Q / 25 min, 5 options, **+1/−1/0**, skip+back allowed, hard tail; calculator-allowed is **cycle-dependent (flagged)**; "safe" ≈ 15 pts; the trap is time-sink on hard items.
- **Beat the Odds (High):** ~20–30 probability/EV Q, **90 s/Q**, 5-option **"pick the closest"**, **no back-nav**, **+1/−1/0**; rewards approximate reasoning; recurring families must be reflexes.
- **Zap-Q (High, vendor-official):** ~150 **forced-choice** pairs, **untimed (~25 min)**, **24 Big-Five-derived traits**, **IRT + adaptive**, built with U. Twente; **non-eliminating**, used to steer behavioral interviews.
- **80-in-8 (High format / Medium inclusion):** 80 Q / 8 min, ~6 s/Q, no calc, no skip, **+1/−1 no-skip**; **possibly dropped/folded for some 2025–2026 quant cycles** — matches the candidate's "phased out" report but **not universally confirmed**.
- **2026/27 add-ons (Medium):** **Likelihood** (15 Q/90 s, rank probabilities), **Intervals** (18 Q/60 s, submit [L,U]), **Order Books** (20 Q/~24 s, spot arbitrage) — a clear shift toward **judgment/estimation under time pressure**.

---

## Sources (URLs, access date 2026-08-06, confidence)

**Tier 1 — vendor-official (the test maker):**
- Zyvo — *Zap-Q personality test (for selection)* — https://www.zyvo.nl/en/products/zap-q-personality-test/for-selection — evergreen, accessed 6 Aug 2026 — **High for Zap-Q mechanics** (24 traits, forced-choice/IRT, adaptive, Big-Five-derived, built with University of Twente; "complete personality image within half an hour").

**Tier 2 — 2025–2026 first-hand candidate accounts:**
- Wall Street Oasis — *Optiver (Chicago) 1st-Year Analyst / SWE interview* — https://www.wallstreetoasis.com/company/optiver/interview/software-engineer — **Oct 2025 first-hand** — **Medium** (1-hr HackerRank = NumberLogic + Beat the Odds + Zap-N; "speed/logic/problem-solving under pressure"; ghosted; **no 80-in-8 mentioned**).
- Wall Street Oasis — *Optiver (Amsterdam) Quant Research Intern interview* — https://www.wallstreetoasis.com/company/optiver/interview/quant-research-intern-3 — **2025/26 first-hand** — **Medium** (four modules: Quant Research coding test, NumberLogic 25-min, Beat the Odds 45-min, Zap-N 2–15 min games; GDPR request confirmed a *passing* score despite rejection; **no standalone 80-in-8**).
- Dev.to (interviewshow-cs) — *Optiver 2027 OA — Complete Breakdown of the New Quant Assessment* — https://dev.to/interviewshow-cs/optiver-2027-oa-questions-sharing-complete-breakdown-of-the-new-quant-assessment-429k — **2026/27 cycle, mentor write-up** — **Medium** (new **Likelihood 15Q/90s**, **Intervals 18Q/60s**, **Order Books 20Q/~24s**; "decisions under uncertainty over exact calc"). *Single-source-leaning for the new modules — flagged.*
- Dev.to (net_programhelp) — *Optiver 2026 OA Comprehensive Review | 26NG / Intern Full Guide* — https://dev.to/net_programhelp_e160eef28/optiver-2026-oa-comprehensive-review-26ng-intern-full-guide-eld — **2025/26** — **Medium** (five sections incl. 80-in-8 [80 Q/8 min], NumberLogic, Beat the Odds, Zap-N, HackerRank coding; "first four sections are the real filters"; 60+ attempted at 70%+).
- programhelp.net — *Optiver 2026 OA full process review (QR)* — https://programhelp.net/en/oa/optiver-2026-oa-quantitative-research-test/ — **2026, second-hand (accompanied a classmate)** — **Low-Medium** (Quant Research Test 3Q/90min [2 code + 1 approx]; **Beat the Odds 30 Q, 90 s each**; **NumberLogic 26 Q/25 min, no calculator**; **Zap-N 9 levels**, "Lumosity/Brain Wars-like"). *Note: this domain also sells interview-ghostwriting services — treat as promotional; used only for corroborating shape.*

**Tier 3 — prep-vendor / aggregator breakdowns (mechanics & rosters):**
- Aptitude-Test-Prep — *The Optiver Online Assessment – Overview + Inside Tips [2026]* — https://aptitude-test-prep.com/employers/trading-assessments/optiver-assessment/ — published 3 Dec 2024, **modified 5 Jul 2026** — **Medium** (most detailed **game-by-game Zap-N** breakdown; **Zyvo** attribution; full **24-trait Zap-Q** list; 80-in-8 / NumberLogic / Beat the Odds specs; affiliate-linked — flagged).
- QuantVault — *Optiver Online Assessment: Format, Mental Math & Free Practice* — https://quantvault.org/optiver-online-assessment.html — 2026/27 — **Low-Medium** (best "what's confirmed vs varies" notes: section types/scoring/no-calc stable; counts/timing drift; recent QT/PhD ≈3 Zap-N games; 80-in-8 is a **separate** screen).
- QuantVault — *Optiver — Interview Prep* — https://quantvault.org/optiver-interview-process.html — 2026/27 — **Low-Medium** (2026 modules Likelihood/Intervals/Order Books; QR HackerRank add-on; interval-quote onsite format).
- QuantVault — *Optiver Zap-N Games (free practice)* — https://quantvault.org/zap-n.html — 2026 — **Low-Medium** (8–9 game roster: Tower, Code Compare, Task Switch, Balloon, Pincode, Number Box, Stock Indicator, Shapeshift, Pattern Guess; "exact set varies; recent invites often show ~3").
- Quant Career Hub — *Optiver Zap-N Test Guide* — https://quantcareerhub.com/blog/optiver-zap-n-test-guide — 2026 — **Low** (maps games to cognitive paradigms: Stock Master reaction-time, Shapeshift Simon effect, Number Box 24-Game).
- JobTestPrep — *The Optiver Test* — https://www.jobtestprep.com/optiver-test — 2026 — **Low** (commercial; confirms Zap-N game names — Balloon, Code Compare, Figure It Out, Number Box, Shapeshift, The Switch — and section list; sells the only Zap-N practice).
- JobTestPrep (NL) — *Optiver assessment oefenen* — https://www.jobtestprep.nl/optiver-assessment-oefenen — 2026 — **Low** (Zap-Q ~25 min, **non-eliminating**, used to steer interview/team-fit).
- Canary Wharfian — *Optiver Interview Questions & Assessment Centre Tips (2026)* — https://www.canarywharfian.co.uk/companies/53/optiver/interviews — 2026 — **Low-Medium** (QT online round = 80-in-8 + sequences, HR reviews manually before round 2; Zap-N ≈ "**~10 mini-games**, similar to **Pymetrics**"; a separate **SHL "General Ability"** test may follow — *SHL detail single-sourced, Low*).
- TestHQ — *Optiver SHL Test: Preparation Guide (2025)* — https://www.testhq.com/blog/optiver-shl-test — 2025 — **Low** (frames OA as **4 cognitive sections + 1 personality**; corroborates Zap-Q-as-personality).

**Sourcing self-assessment:**
- **Best-sourced (High):** Zap-Q psychometrics (vendor-official Zyvo); NumberLogic and Beat the Odds format/scoring (vendor + 2 first-hand 2025/26 reports); the existence of the **NumberLogic + Beat the Odds + Zap-N + Zap-Q** battery as the current spine.
- **Solid but vendor-leaning (Medium):** the full 9-game Zap-N roster and each game's mechanics (one very detailed prep source + corroborating aggregators + candidate confirmations of "9 levels"); per-game *scoring* is inferred from the underlying paradigms, not an official rubric.
- **Thin / single-sourced (flagged):** the **2026/27 add-on modules** (Likelihood/Intervals/Order Books — mainly one mentor write-up + one aggregator); **Figure It Out** round structure (mainly one prep source); the **SHL General Ability** add-on (one source); exact **question counts/timings** (drift by cycle — treated as directional); and the strong claim that **80-in-8 is fully phased out** (contradicted by 2026 guides; supported only inferentially by 2025/26 candidate reports that omit it — labeled **Medium** and explicitly caveated).
