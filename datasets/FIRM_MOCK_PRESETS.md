# Firm Mock-Interview Presets — Implementation-Ready Specs

**Compiled:** 6 Aug 2026 · Companion to `FIRM_INTERVIEW_RESEARCH.md`.
**Selected firms (top 3 by accuracy + recency + corroboration):** **Optiver**, **Jane Street**, **Susquehanna (SIG)**.

**Design rules (apply to all presets):**
- **No finance/options domain knowledge required.** Every item tests reasoning, mental math, probability/EV, estimation, or market-making *intuition* — never Greeks, pricing models, or product knowledge.
- **Question-type vocabulary:** `mental-math`, `probability-ev`, `market-making`, `brainteaser`, `sequences`, `estimation`.
- **Difficulty tiers:** `easy` / `medium` / `hard` (a 4th `stretch` = hardest, used sparingly).
- **Per-question time target** is in seconds. Presets model two regimes: **arithmetic sprint** (~6–12s) vs **reasoning** (~90–240s).
- **Scoring** mirrors the real firm where documented (Optiver penalizes wrong; JS/SIG do not).
- **Adversarial behavior** is defined per-firm below and drives the app's `probe` (mid-answer nudges) and `adversarial-follow-up` (post-answer pressure) systems.

**Preset headline comparison:**

| Preset | Total Q | Pace regime | Scoring | Signature adversary |
|---|---|---|---|---|
| Optiver Style — *Speed & Odds* | **14** | Sprint + 90s probability | +1 / −1 / −1-skip (sprint); +1 / −1 / 0 (probability) | Pickoff bot + relentless clock |
| Jane Street Style — *Make a Market* | **13** | 8s gate + 100–150s reasoning | Raw-correct (no penalty) | Adverse selection + "defend & extend" |
| SIG Style — *Think in Bets* | **11** | Slow deep (120–240s), calculator-allowed | No penalty (reasoning-graded) | "How much would you bet?" + poker EV |

---

## PRESET 1 — "Optiver Style — Speed & Odds"

**What this firm is really testing:** raw calculation throughput, probability *reflexes* under a punishing clock, and the discipline to **skip rather than guess** when a penalty applies. Optiver's OA is a gauntlet of independent gates; the app should feel *fast and unforgiving*, rewarding automaticity and calibrated skipping over slow perfection.

- **Total question count:** **14** (≥10 ✓)
- **Global scoring:** two schemes by block — **sprint block: +1 correct / −1 wrong / −1 skip** (mirrors 80-in-8); **probability block: +1 / −1 / 0 skip, no back-navigation** (mirrors Beat the Odds). Sequences use +1 / −1 / 0.
- **Overall clock feel:** short per-question timers, hard cutoffs, auto-advance on timeout.

**Ordered question mix (14):**

| # | Type | Difficulty | Time target (s) | Notes |
|---|---|---|---|---|
| 1 | mental-math | easy | 10 | 80-in-8 warm-up: 2-digit × 1-digit, % of round numbers |
| 2 | mental-math | easy | 10 | fraction↔decimal, addition chains |
| 3 | mental-math | medium | 10 | 2-digit × 2-digit, "18% of 350" |
| 4 | mental-math | medium | 8 | negatives / multi-step; escalating pressure |
| 5 | mental-math | hard | 8 | 3-digit × 2-digit under 8s (deliberately hard) |
| 6 | sequences | medium | 45 | NumberLogic: next-in-sequence (int/decimal) |
| 7 | sequences | hard | 45 | pattern with a twist (ratio + offset) |
| 8 | probability-ev | medium | 90 | Beat-the-Odds: dice/coin EV, "pick closest value" 5-option |
| 9 | probability-ev | medium | 90 | conditional probability / simple Bayes |
| 10 | probability-ev | hard | 90 | geometric "expected flips = 1/p"; random walk return time |
| 11 | probability-ev | hard | 90 | linearity-of-expectation counting (e.g., pair-removal expectation) |
| 12 | estimation | medium | 60 | order-of-magnitude Fermi; answer as a bucket |
| 13 | market-making | medium | 120 | quote a two-way market on a hidden value; bot trades |
| 14 | market-making | hard | 120 | multi-round: bot picks off, one info reveal, re-quote |

**Market-making questions — how they appear & bot behavior:**
- Appear as the **final 2 items** (items 13–14). The candidate quotes `bid / ask` on a hidden quantity with a known-ish range.
- **Adversarial bot logic:**
  - If `ask < trueEV` → bot **lifts your ask** (buys from you) → you're short at a bad price → negative P&L.
  - If `bid > trueEV` → bot **hits your bid** (sells to you) → you're long at a bad price → negative P&L.
  - If `spread` is **too wide** (e.g., > X% of range) → bot **refuses to trade** and flags "too wide — tighten."
  - Item 14 adds **one information reveal** after the first trade; candidate must **re-quote tighter** (uncertainty fell). Bot re-evaluates pickoff on the new quote.
  - P&L is scored; there is **no verbal defense prompt** — the pickoff *is* the feedback.

**Signature follow-up / adversarial style (drives `probe` + `adversarial-follow-up`):**
- **The adversary is the clock and the penalty, not a debater.** Probes are terse and time-pressuring: *"5 seconds left."*, *"skip costs you a point — commit or move on."*
- On probability items, if the candidate stalls, the probe nudges toward **estimation/bucketing** rather than exact computation: *"you don't have time to compute it exactly — which bucket?"*
- Market-making adversarial follow-up = **the pickoff itself** plus a one-line needle: *"I lifted your ask — your quote was cheap. Re-quote."*

---

## PRESET 2 — "Jane Street Style — Make a Market"

**What this firm is really testing:** fair-value reasoning, Bayesian updating on new information, clear *spoken* logic, and calibrated risk-taking. The mental-math test is a gate; the real signal is **how you make and revise a market** and **how you defend and extend a correct answer** when pressed. The app should feel *conversational but relentless* — every right answer earns a harder follow-up.

- **Total question count:** **13** (≥10 ✓)
- **Global scoring:** **raw-correct, no wrong-answer penalty** on the mental-math gate (mirrors JS). Probability/brainteaser items are **reasoning-graded** (partial credit for correct framing + narration). Market-making items scored on P&L + update quality.
- **Overall clock feel:** brutal 8s gate up front, then generous reasoning time with heavy verbal probing.

**Ordered question mix (13):**

| # | Type | Difficulty | Time target (s) | Notes |
|---|---|---|---|---|
| 1 | mental-math | easy | 8 | Zetamac gate: 47 × 8, percentages |
| 2 | mental-math | easy | 8 | division, fraction comparison |
| 3 | mental-math | medium | 8 | 2-digit × 2-digit, decimal arithmetic |
| 4 | mental-math | medium | 8 | odds↔implied-probability conversion (3-to-2 → %) |
| 5 | probability-ev | medium | 100 | EV of a simple bet (+$12 @60% / −$6); narrate |
| 6 | probability-ev | medium | 120 | conditional probability with a **twist follow-up** |
| 7 | probability-ev | hard | 120 | multi-stage EV / optimal stopping (die reroll) |
| 8 | brainteaser | medium | 120 | classic logic (Wason-style / hat puzzle) |
| 9 | brainteaser | hard | 150 | generalize-to-n variant; expects extension |
| 10 | estimation | medium | 90 | Fermi anchor ("gas stations in the US") → feeds MM |
| 11 | market-making | medium | 150 | quote two-way on the Fermi quantity; interviewer trades |
| 12 | market-making | hard | 150 | info reveal → re-quote, tighten spread, manage inventory |
| 13 | market-making | stretch | 180 | face-down cards: quote on running sum, reveal one at a time |

**Market-making questions — how they appear & bot behavior:**
- Appear as an **escalating 3-round finale** (items 11–13), seeded by the estimation anchor at item 10.
- **Adversarial (adverse-selection) bot logic:**
  - Bot **hits your bid / lifts your ask** based on the true fair value — it **trades against you whenever your quote is off**, leaving you with directional inventory.
  - **Spread discipline:** too wide → bot **refuses and demands a tighter quote**; too narrow → bot trades **aggressively** and you eat adverse selection / inventory risk.
  - Between rounds the bot **reveals information** (a range hint, one card); candidate must **Bayesian-update fair value and re-quote**, and **tighten the spread as uncertainty falls**.
  - **Inventory tracked:** if the candidate is already long, a good quote should skew (lower bid/ask) — the bot punishes candidates who ignore their position.
  - Item 13 (cards) reveals one card at a time; candidate re-quotes after each reveal.

**Signature follow-up / adversarial style (drives `probe` + `adversarial-follow-up`):**
- **"Defend & extend."** After a *correct* answer, the adversary does **not** move on — it probes: *"Why?"* → *"What if I change this parameter?"* → *"Now generalize it to n."* Correctness is necessary but not sufficient; the score rewards surviving the extension.
- **Adverse-selection needling** in market-making: *"I keep lifting your ask — what does that tell you? Adjust."* / *"Your spread's too wide, I won't trade. Tighten it."*
- Values **clear narration**: the probe penalizes silent solving — *"talk me through your update."*

---

## PRESET 3 — "SIG (Susquehanna) Style — Think in Bets"

**What this firm is really testing:** *thinking stability* and **calibrated decision-making under uncertainty** — not arithmetic speed. SIG allows a calculator; the difficulty is in **framing the problem correctly** (a wrong first step cascades) and in **betting appropriately on your own confidence**. The app should feel *slow, deep, and psychologically pointed* — fewer questions, each heavier, with a poker-style "how sure are you, and how much would you bet?" pressure.

- **Total question count:** **11** (≥10 ✓)
- **Global scoring:** **no wrong-answer penalty**; **reasoning-graded** with partial credit for correct framing even if the final number slips (mirrors SIG's "reasoning over final answer"). Non-integer answers accepted as **simplified fractions**. **Calculator + scratch pad enabled** (key differentiator — NO pure mental-math sprint block).
- **Overall clock feel:** generous per-question budgets; free navigation within the set; the pressure is *social/confidence*, not the clock.

**Ordered question mix (11):**

| # | Type | Difficulty | Time target (s) | Notes |
|---|---|---|---|---|
| 1 | probability-ev | medium | 180 | binomial + linearity of expectation (E(X) of divisible rolls) |
| 2 | probability-ev | medium | 180 | independent events, "exactly two of three occur" |
| 3 | probability-ev | hard | 210 | conditional probability / Bayes, multi-step |
| 4 | probability-ev | hard | 210 | geometric / Markov expected-waiting-time |
| 5 | probability-ev | stretch | 240 | combinatorics with a constraint (arrangements, ≥1 condition) |
| 6 | brainteaser | hard | 240 | **logic + path-counting** (SIG's most characteristic item) |
| 7 | brainteaser | hard | 210 | constraint/deduction puzzle (ages, truth-tellers) |
| 8 | brainteaser | stretch | 240 | single-variable optimization (min-time / Snell-style) |
| 9 | estimation | medium | 120 | structured estimate; justify assumptions |
| 10 | market-making | medium | 150 | "make a market" framed as a **bet-sizing** decision |
| 11 | market-making | hard | 180 | poker-style pot-odds / EV decision under social pressure |

**Market-making questions — how they appear & bot behavior:**
- SIG's flavor is **"think in bets," not tight-spread HFT market making.** Items 10–11 are framed as **bet-sizing / pot-odds decisions**:
  - Item 10: candidate quotes a market **and states how much of a notional bankroll they'd stake** at their quote. The bot **offers to bet at odds derived from the candidate's own stated confidence** — if the candidate is **miscalibrated** (over-confident), the bot takes the +EV side against them and shows the loss.
  - Item 11: a poker/decision-theory scenario (pot odds, fold equity, EV of calling) with **partial information revealed sequentially**; candidate must **Bayesian-update and size the bet vs edge**. No poker skill assumed — a tutorial framing is provided.
- Scored on **EV of the decision + calibration**, not spread tightness.

**Signature follow-up / adversarial style (drives `probe` + `adversarial-follow-up`):**
- **The confidence-calibration probe.** After *any* answer: *"How confident are you — 60%? 90%?"* then *"OK, **how much of your bankroll would you bet on that**?"* If the candidate's stated confidence doesn't match the true probability, the adversary **offers a bet at exploitative odds** and reveals the miscalibration.
- **Framing-first probing.** On heavy logic/path items the probe checks the *approach before the arithmetic*: *"Before you compute — is it even feasible? What's the pattern?"* (models SIG's "wrong first step cascades" failure mode).
- **Reasoning over answer:** partial credit and follow-ups reward correct framing even when the final number is slightly off; a right number reached by luck gets probed harder: *"walk me through why — would you bet on that reasoning?"*

---

## Implementation notes (cross-preset)

- **Regime flags per item:** tag each question `regime: sprint | reasoning` so the timer UI can switch between hard auto-advance (Optiver sprint) and soft/generous (SIG deep).
- **Scoring modes to support:** `penalty` (+1/−1/−1-skip), `penalty-no-skip` (+1/−1/0), `raw-correct`, `reasoning-graded` (partial credit).
- **Adversary hooks:** each preset exposes (1) a **mid-answer `probe`** style and (2) a **post-answer `adversarial-follow-up`** style — Optiver = clock/pickoff, Jane Street = defend-and-extend + adverse selection, SIG = confidence-bet calibration.
- **Market-making engine** is shared but parameterized: `pickoffAggressiveness`, `spreadTolerance`, `infoRevealSchedule`, `trackInventory`, `betSizingMode` (Optiver: aggressive pickoff, penalize wide; Jane Street: adverse selection + inventory + multi-reveal; SIG: bet-sizing/calibration over spread).
- **Difficulty sourcing:** seed probability items from the existing `datasets/` banks (`expected-value.md`, `conditional-probability.md`, `combinatorial-analysis.md`, `markov-chain.md`, `game-theory.md`, `brainteasers-*.md`) — all no-finance-prereq.
- **Calibration provenance:** timings/scoring trace to sources cited in `FIRM_INTERVIEW_RESEARCH.md`; treat as directional, not a firm's literal key.
