# Quant Question Bank — Probability & Statistics → Expected Value

> **Handoff note for [coworker] + the SLM training pipeline.** Fourth completed subcategory (**Expected Value**) of the **Probability and Statistics** category. 85 questions, company-tagged. Same format as the earlier handoffs; subcategory-specific notes below.

## How to read this document

**What this is.** 85 expected-value / probability questions in the *Expected Value* subcategory. This is by far the largest subcategory so far, spanning many distinct methods (it is NOT one repeating template like Betting and Sizing).

**Structure.** Grouped by **family** = the solution method (optimal stopping, first-step recursion, indicator + linearity, martingales, geometric/memorylessness, CLT/normal approx, conditional expectation, coupon collector, continuous distributions, invariants, divergent-EV, etc.). Each question carries **Company** tag(s), a **Difficulty**, a **Concept**, and two forms:
- **Condensed** — one-line question + compact worked answer (same numbers/logic).
- **Verbatim** — the exact question text + full worked solution from the source platform.

There is a **per-question index table** at the top listing family, difficulty, and answer for all 85.

**Company tags — lists, and SIG is the superset.** Most of these questions are shared across many firms, so the Company field is a comma-separated LIST. Key facts:
- **SIG uses all 85** questions.
- Several questions (e.g. Two Rolls Payoff, Costly Reroll, First Ace, Flowers in Bloom, Other Than Six, Repeating Dice, Specific Card #1, Tennis Tournament, Throw a 6 #1) appear across ~all 11 firms.
- Firms present in this set: Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW.
Do not collapse a multi-firm question to one firm.

**Answers — mostly exact scalars, with three special cases the pipeline MUST handle:**
1. **Divergent EV sentinels.** *Tripling Die* (EV74) and *Widening Wheel* (EV85) have genuinely infinite expected value; their answer is the sentinel **−1** (meaning "infinite"), per the source convention. Do NOT treat −1 as a normal numeric target — it is a flag. For RL, either exclude these or teach the sentinel explicitly.
2. **Procedure / formula answers.** The Biased Coin construction questions (EV11/EV12/EV14 = #2/#3/#5) answer with a *procedure* or a *formula* (e.g. 1/(p(1−p))), not a single number. Route as reasoning/SFT targets, not scalar-reward RL.
3. **Two reconstructed answers.** The source paste omitted the final answer line for *Other Than Six* (EV49 → 3) and *Two Consecutive Fives* (EV76 → 72); both are computed from the shown working and flagged inline with "(computed)". Worth a spot-check.

Everything else (~78 questions) has a single exact numeric answer suitable for verifier-checked RL. Condensed = short-CoT target; Verbatim = long-CoT / full-derivation target. Difficulty is Easy/Medium/Hard per question.

---

# Probability and Statistics — Expected Value

> **Status: complete (85 questions), company-tagged.** Grouped by solution method (family). Most have exact numeric answers (verifier-checkable); a few are procedure/formula answers (Biased Coin #2/#3/#5) or intentional sentinels — the two divergent-EV questions (Tripling Die, Widening Wheel) answer **−1** to mean "infinite." Two answers were reconstructed from the working because the source paste omitted the final line (Other Than Six = 3; Two Consecutive Fives = 72) — flagged inline. Each question lists the firm(s) that use it; **SIG uses all 85**, and many questions are shared across firms, so the Company field is a list.

## Expected Value — index of questions (first 25)

| Question | Family | Difficulty | Answer |
|---|---|---|---|
| 100-Sided Die | Optimal stopping / reroll | Hard | stop at 87+ (E≈87.4) |
| Bust on Ten | Optimal stopping | Easy | 6 |
| Cash or Reroll | Optimal stopping | Easy | 5.5 |
| Costly Reroll | Optimal stopping | Medium | 5.95 |
| Dice Game #1 | Optimal stopping | Hard | 6.15 |
| Dice Game #2 | Optimal stopping (two lives) | Hard | 10.42 |
| Company Acquired or Not | EV of a decision / option | Medium | 2.40 |
| Dice Sum Game | EV of a wager | Easy | don't play; pay < 3.50 |
| 5 Descending Cards | EV of a wager / fair game | Medium | EV = −99/120; fair prize 119 |
| Biased Coin #1 | Simulate prob with a coin | Medium | 1/(p(1−p)) flips |
| Biased Coin #2 | Simulate prob with a coin | Easy | procedure (2 flips) |
| Biased Coin #3 | Simulate prob with a coin | Easy | procedure (3 flips) |
| Biased Coin #4 | Simulate prob with a coin | Medium | 32 flips |
| Biased Coin #5 | Simulate prob with a coin | Medium | procedure (unbounded) |
| Bullseye Bet | Continuous EV optimization | Medium | r=6, E[W]=3 |
| Capsule Colors | Indicator / linearity | Easy | 3.439 |
| Diamond Variance | Indicator / covariance | Medium | 1.544 |
| Coefficient of Variation | Order statistics / variance | Hard | 0.614 |
| Card On Top | Elementary probability | Easy | 0.5 |
| Coins and Dice | Elementary probability | Easy | 0.222 |
| Croissant or Muffin | Binomial | Easy | 0.84 |
| Basketball Practice #1 | Recursion & symmetry | Medium | 50 |
| Basketball Practice #2 | Recursion & symmetry | Hard | 2/3 |
| Coin Toss #2 | Recursion & symmetry | Easy | 0.667 |
| Collecting Stickers | Coupon collector | Easy | 73.5 |
| Dice vs Coins | Normal approx / CLT | Medium | 0.9913 |
| Dice With Same Numbers | EV of a wager | Medium | 4.06 |
| Different Outcome | Elementary probability | Easy | 0.83 |
| Divisible Throws | Indicator / linearity | Easy | 0.9 |
| Double Down Coin Bet | Martingale betting / EV | Easy | 0 |
| Double Roll Pay | Wald's identity | Easy | 24.5 |
| Drunk Student #1 | Martingale / random walk | Easy | 0.27 |
| Drunk Student #2 | Martingale / optional stopping | Medium | 1971 |
| Empty Boxes | Indicator / linearity | Easy | 6.63 |
| Exponential Distribution #1 | Continuous distribution moments | Medium | 2/9 |
| Faster Sixes | Conditional expectation / geometric | Hard | 1.8 |
| First Ace | Symmetry / spacings | Easy | 10.6 |
| First Flip Wins | Elementary probability | Easy | 0.75 |
| First Prime | Indicator / relative order | Medium | 1.14 |
| Flip 100 Coins | Variance / E[X²] | Medium | 2475 |
| Flip 4 Coins | Optimal stopping + EV | Medium | 2, 19/8, 4 |
| Flowers in Bloom | Geometric probability (area) | Medium | 0.575 |
| Free Seat | Binomial | Easy | 0.821 |
| Free Ticket | Birthday / optimal position | Hard | position 20 |
| Game Show Stop or Go | Threshold EV | Easy | 0.2 |
| Kelly Betting #1 | Positional strategy | Easy | go first |
| Kelly Betting #2 | Kelly criterion | Medium | see entry (bet / f=3/25) |
| Largest Sunflower | Records / harmonic sum | Easy | 2.72 |
| Other Than Six | EV of a wager | Easy | 3 (computed) |
| Patient Roller | Geometric memorylessness | Easy | 10 |
| Remaining Coins | Normal approx / abs value | Medium | 5.64 |
| Repeating Dice | First-step recursion | Easy | 7 |
| Roll and Spin | First-step recursion | Easy | 6 |
| Rowing Reshuffle | Indicator / linearity | Medium | 0.52 |
| Same Flips | Elementary probability | Easy | 0.25 |
| Shooting Star | Complement / independence | Easy | 0.5 |
| Shuttle Wait | Continuous uniform | Easy | 6 |
| Specific Card #1 | Relative order / symmetry | Easy | 0.25 |
| Spin in Two Regions | First-step / geometric | Medium | 3.4 |
| Sum Remaining Odd Dice | Indicator / linearity | Easy | 300 |
| Sum Two Dice | Elementary probability | Easy | 0.167 |
| Sum Until Success | First-step recursion | Easy | 10.5 |
| Tennis Tournament | Recursion (2-game blocks) | Easy | 0.308 |
| The Highest Face | Conditional EV | Medium | 3.89 |
| Third Six | Geometric / negative binomial | Easy | 18 |
| Three Blue Orbs | Geometric sum | Medium | 4.5 |
| Throw a 6 #1 | Geometric | Easy | 6 |
| Throw a 6 #2 | First-step recursion (HH) | Medium | 42 |
| Throw a 6 #3 | First-step recursion (state) | Hard | 36 |
| Throw a 6 #4 | First-step recursion (parity) | Medium | 12 |
| Throw Until Matched | Birthday / backward recursion | Medium | 3.78 |
| Toy Collection #1 | Coupon collector | Easy | 11.4 |
| Toy Collection #2 | Indicator / linearity | Easy | 3.95 |
| Tripling Die | St. Petersburg / divergent EV | Medium | -1 (infinite) |
| Two at a Time | Invariant (parity) | Medium | 5.5 |
| Two Consecutive Fives | First-step recursion (state) | Medium | 72 (computed) |
| Two Dice Difference | EV over distribution | Easy | 1.944 |
| Two Hues Left | Indicator / relative order | Hard | 4.77 |
| Two Rolls Payoff | Conditional EV | Easy | 3.89 |
| Two Same Dice | Elementary probability | Easy | 0.167 |
| Uniform Distribution #1 | Continuous convolution | Hard | 1 |
| Up Days | Conditional indicator | Easy | 3.5 |
| Voucher Swap | Optimal stopping (continuous) | Easy | 125 |
| Warming Spells | Indicator / linearity | Medium | n=244 |
| Widening Wheel | Divergent EV / harmonic | Hard | -1 (infinite) |

---

## Family: Optimal stopping / reroll games

*Method: find the value V of the game by a fixed-point/threshold argument — keep a roll iff it beats the expected value of continuing. Where a bust or fee is involved, fold it into the continuation value. Solve by backward recursion or a self-consistent equation.*

### EV1 — 100-Sided Die
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Hard · **Concept:** Optimal stopping with a per-reroll cost; geometric distribution

#### Condensed
**Q:** Roll a 100-sided die; take face value in $, or pay $1 to reroll (unlimited). Strategy to maximize payoff?
**A:** Threshold rule: stop at X or higher. Profit if you stop at X+ = (X+100)/2. Expected rerolls (cost) = 100/(100−X+1) − 1 (geometric, minus the free first roll). Maximize E = (X+100)/2 − (100/(101−X) − 1); optimum near **X ≈ 86.9 → stop at 87 or higher** (E[game] ≈ 87.4).

#### Verbatim
You're in a casino. There is a 100-sided die on the table. The man asks you to pay to play. Rules: after you roll, you can take the face value in dollars; if you're not happy, pay $1 to roll again; you can re-roll (paying $1 each time) as often as you want. Strategy to maximise payoff?

The hard part is figuring out the approach. The answer isn't just 50.5 (the EV of one roll), because you can re-roll for $1. Realise you need a threshold X: if you throw X or higher you stop. There should be a balance between "likely enough that the die ends on X or higher" and "not worth re-rolling and paying another dollar."

- **Profit** if you stop after throwing X or higher: the outcome lands between X and 100, so P = (X + 100)/2.
- **Cost** uses the geometric distribution: E[N] = 1/p where p = probability of throwing X or higher = (100 − X + 1)/100. E.g. waiting for 80+, there are 21 winning faces, p = 0.21, so E[N] ≈ 5 throws. Expected throws is the cost, minus 1 (the first roll isn't a paid re-roll): C = 100/(100 − X + 1) − 1.

Maximise E[game] = (X + 100)/2 − (100/(100 − X + 1) − 1). Take the derivative and solve (or plot). The local maximum is at E[game] = 203/2 − 10√2 ≈ 87.4, where X = 101 − 10√2 ≈ 86.9. It makes sense that E[game] − X < 1, since a re-roll costs 1: the equation maximises at the point where re-rolling is no longer worth it.

So the strategy is to **stop rolling as soon as we roll 87 or higher**.

---

### EV2 — Bust on Ten
**Company:** SIG · **Difficulty:** Easy · **Concept:** Optimal stopping with a bust; self-consistent value

#### Condensed
**Q:** Roll a fair d10 repeatedly; a 10 ends the game with $0. After any other roll, stop for that value or roll again. Expected payout under optimal play?
**A:** Value V solves V = (1/10)(Σ max(k,V)). Threshold: keep k ≥ V. Guess keep {6,7,8,9}: V = (1/10)(5V + 30) → 5V = 30 → **V = 6**. Consistent (keep 6+). Answer **6**.

#### Verbatim
A player repeatedly rolls a fair ten-sided die (faces 1–10). If the player ever rolls a 10, the game ends immediately with nothing. After any other roll, the player may stop and collect that roll's value, or roll again. Playing to maximise expected winnings, what is the expected payout?

This is optimal stopping with a self-consistent (fixed-point) value. Because the rules never change, the situation before any roll is always the same, so the game has a single value V.

Let V be the expected payout of being about to roll, playing optimally. When you roll: with probability 1/10 you roll a 10 and bust (0); with probability 1/10 each you roll k ∈ {1,…,9} and take max(k, V). So:
V = (1/10)(0 + Σ_{k=1}^{9} max(k, V))

The optimal policy is a threshold: keep k when k ≥ V, re-roll when k < V. Suppose you keep {6,7,8,9} and re-roll {1,2,3,4,5}. Then the five low values contribute V each and the four high values contribute k:
V = (1/10)(5V + (6+7+8+9)) = (1/10)(5V + 30)
Multiply by 10: 10V = 5V + 30 ⟹ 5V = 30 ⟹ V = 6.

Check consistency: with V = 6, "keep k when k ≥ 6" keeps {6,7,8,9} and re-rolls {1,…,5}, as assumed (a roll of 6 is break-even). So V = 6.

**Correct Answer: 6**

---

### EV3 — Cash or Reroll
**Company:** Akuna Capital, Citadel Securities, Jane Street, SIG · **Difficulty:** Easy · **Concept:** Backward induction, one reroll

#### Condensed
**Q:** Fair d8, roll once; cash out at that value or discard and take a mandatory second roll. Fair value?
**A:** Reroll worth E = 4.5. Keep first roll iff v ≥ 4.5 → keep {5,6,7,8}, reroll {1,2,3,4}. E[game] = (1/8)(4·4.5 + (5+6+7+8)) = (18+26)/8 = **5.5**.

#### Verbatim
A casino offers a game with a fair eight-sided die (faces 1–8). You roll once. You may cash out and be paid the value showing, or discard it and roll a second time, in which case you must cash out at whatever the second roll shows. Playing to maximise expected payout, what is the fair value?

This is backward induction for an optimal stopping decision. If you discard the first roll, you're paid the second roll with no further choices; a fair d8 has expected value (1+2+…+8)/8 = 36/8 = 4.5. So re-rolling is worth 4.5 regardless of the first roll.

After seeing first roll v, keep it (worth v) iff v ≥ 4.5, i.e. v ∈ {5,6,7,8}; re-roll on {1,2,3,4}. Each value occurs w.p. 1/8:
E[game] = (1/8)(4.5+4.5+4.5+4.5 + 5+6+7+8) = (1/8)(18 + 26) = 44/8 = 5.5.

**Correct Answer: 5.5**

---

### EV4 — Costly Reroll
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Optimal stopping with a reroll fee

#### Condensed
**Q:** Fair d10, roll once; stop for that value, or pay $2 to take a mandatory second roll (net = second roll − 2). Expected net payout, optimal play?
**A:** Reroll worth 5.5 − 2 = 3.5. Keep first roll iff v ≥ 3.5 → keep {4,…,10}, reroll {1,2,3}. E = (3/10)·3.5 + (1/10)(4+…+10) = 1.05 + 4.9 = **5.95**.

#### Verbatim
Alice plays with a fair ten-sided die (faces 1–10). She rolls once. After seeing the result she may stop, or pay a fee of $2 to roll again and take the second roll's value instead (no further re-rolls). If she stops she's paid her current roll; if she re-rolls she's paid the second roll minus the $2 fee. Playing optimally, what is her expected net payout?

This is optimal stopping where you keep your current roll only if it beats the alternative; the twist is the fee lowers the alternative's value. A fresh d10 has E = (1+…+10)/10 = 5.5, so the net value of re-rolling is 5.5 − 2 = 3.5.

Keep first roll v iff v ≥ 3.5, i.e. stop on {4,…,10}, re-roll on {1,2,3}. Each value w.p. 1/10:
E[game] = (3/10)·3.5 + (1/10)(4+5+6+7+8+9+10) = 10.5/10 + 49/10 = 1.05 + 4.9 = 5.95.

**Correct Answer: 5.95**

---

### EV5 — Dice Game #1
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Hard · **Concept:** Optimal stopping with a bust; backward recursion

#### Condensed
**Q:** Balance starts at 0; roll a fair d6 repeatedly. 1–5 adds to balance; a 6 wipes balance to 0 and ends the game. Stop anytime to keep balance. Max fair entry fee (risk-neutral)?
**A:** Continue iff (5N/6 + 2.5) > N → stop at N ≥ 14. Backward recursion from E[f(15)]=15 down to N=0 gives **E[f(0)] = 6.15**.

#### Verbatim
You start with $0 and roll a fair d6 as many times as you like until a 6 appears. On each roll: 1–5 adds that many dollars; a 6 makes your entire balance 0 and ends the game. After each roll you may stop and keep your balance or continue. Max fee you'd pay if risk-neutral and playing optimally?

The decision depends on expected balance after a throw vs current balance. If you hold N dollars, expected future balance from one more roll is:
(1/6)(N+1)+(1/6)(N+2)+(1/6)(N+3)+(1/6)(N+4)+(1/6)(N+5)+(1/6)·0 = 5N/6 + 2.5
Roll again if 5N/6 + 2.5 > N. Equilibrium at N = 15, so the game isn't beneficial once N ≥ 15; the smallest raising face value is 1, so stop at N ≥ 14.

Backward recursion (E[f(N)] = optimal expected accumulation):
- E[f(15)] = 15 (won't play).
- E[f(14)] = (1/6)(15+16+17+18+19) = 14.17
- E[f(13)] = (1/6)(14.17+15+16+17+18) = 13.36
- … continuing to N=0: E[f(0)] = (1/6)(6.53+6.93+7.36+7.81+8.29) = 6.15

You are willing to pay 6.15 dollars to play.

**Correct Answer: 6.15**

---

### EV6 — Dice Game #2
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Hard · **Concept:** Optimal stopping with two "lives"; state decomposition

#### Condensed
**Q:** Same as Dice Game #1, but the FIRST 6 only resets balance to 0 (game continues); the SECOND 6 ends it. Max fair entry fee?
**A:** State B (one 6 already rolled) = Dice Game #1 = 6.15. State A: rolling a 6 sends you to State B worth 6.15, so continue iff 5N/6 + 2.5 + 6.15/6 > N → stop at N ≥ 22 (= 15 + 6.15). Backward recursion → **E[fA(0)] = 10.42**.

#### Verbatim
Same dice game, but: rolling a 6 for the first time resets your balance to 0 but the game continues; rolling a 6 for the second time makes your balance 0 and ends the game. Max fee, risk-neutral, optimal play?

Two states. State B = you've already rolled one 6 (next 6 ends it); State A = no 6 yet. Solve B first.

State B is identical to Dice Game #1: threshold N ≥ 15, backward recursion gives E[fB(0)] = 6.15.

State A: rolling a 6 doesn't end the game — it resets balance to 0 and sends you to State B worth 6.15. So holding N in State A, expected future from one roll:
(1/6)(N+1)+…+(1/6)(N+5)+(1/6)·6.15 = 5N/6 + 2.5 + 6.15/6
Roll again if this exceeds N → N < 21.15, so stop at N ≥ 22.

Backward recursion in State A (boundary E[fA(22..26)] = N):
- E[fA(21)] = (1/6)(22+23+24+25+26+6.15) = 21.03
- E[fA(20)] = (1/6)(21.03+22+23+24+25+6.15) = 20.20
- … down to N=0: E[fA(0)] = (1/6)(10.68+10.96+11.25+11.57+11.90+6.15) = 10.42

The extra life raises the game's value from 6.15 to 10.42. Max entry fee = 10.42.

**Correct Answer: 10.42**

---

## Family: EV of a wager / decision

*Method: enumerate outcomes, weight by probability, sum. For fair-game / option questions, set EV to zero or price the payoff at expiry.*

### EV7 — Company Acquired or Not
**Company:** SIG, DRW · **Difficulty:** Medium · **Concept:** EV back-out + option payoff

#### Condensed
**Q:** 50% acquisition: then 70%→$20, 30%→$X. 50% no acquisition: 80%→$5, 20%→$0. Analyst says stock EV = $15. Price a call struck at $24.
**A:** EV = 9 + 0.15X = 15 → X = 40. Only the 15% chance of $40 is above the $24 strike → call pays 40−24 = 16. Call value = 0.15·16 = **$2.40**.

#### Verbatim
A company faces a potential acquisition. 50% chance it goes through, 50% not.
If the acquisition happens: 70% the stock is worth $20; 30% it's worth X (unknown).
If it does not: 80% the stock is worth $5; 20% worth $0.
An analyst estimates the stock value at $15. What is the price of a call option to buy the stock at strike $24?

With X unknown, EV_stock = 0.5·0.7·20 + 0.5·0.3·X + 0.5·0.8·5 + 0.5·0.2·0 = 9 + 0.15X.
The analyst says EV = 15, so 9 + 0.15X = 15 ⟹ 0.15X = 6 ⟹ X = 40.

So: 15% chance the stock is worth $40 → the call is worth 40 − 24 = 16. Every other outcome is below the $24 strike → the call is worth 0. Therefore the call is worth 0.15·16 = 2.40 dollars.

**Correct Answer: 2.40**

---

### EV8 — Dice Sum Game
**Company:** Akuna Capital, Da Vinci, Flow Traders, IMC, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** EV of a repeated wager; geometric distribution

#### Condensed
**Q:** Roll two fair d6; if sum = 7 win €21, but pay €5 per roll. Play? How much would you pay?
**A:** P(sum 7) = 6/36 = 1/6 → expected 6 rolls to win. 6 rolls cost €30 to win €21 → expected loss €1.50/game → **don't play**. To profit, pay < €21/6 = **€3.50** per roll.

#### Verbatim
A game: roll two fair six-sided dice. If the sum equals seven, you win €21. You must pay €5 to play each roll. Do you play? How much would you pay?

There are 36 combinations; 6 give a sum of 7, so P(win) = 6/36 = 1/6. By the geometric distribution you need 1/p = 6 games on average to win once. Six games cost 6 × €5 = €30 to win €21, so per game your expected loss is (€30 − €21)/6 = €1.50. Not advantageous to play.

Follow-up: In 6 games you want to pay less than €21, so per game less than €3.50.

**Correct Answer: don't play; break-even fee is €3.50 (pay less to profit)**

---

### EV9 — 5 Descending Cards
**Company:** Citadel Securities, SIG, DRW · **Difficulty:** Medium · **Concept:** EV of a wager; fair-game prize

#### Condensed
**Q:** Deck of 97 cards (1–97). Draw 5 at random; if drawn in strictly descending order win $20, else pay $1. (1) EV? (2) Fair prize?
**A:** P(descending) = 1/5! = 1/120. (1) EV = (1/120)·20 − (119/120)·1 = **−99/120**. (2) Fair: (1/120)X − 119/120 = 0 → **X = 119**.

#### Verbatim
A special deck of 97 cards, numbered 1 to 97. Each round you draw five cards at random (no replacement within the round). If the five numbers came out in strictly descending order you win $20; otherwise you pay $1. (1) What's the EV? (2) What prize makes it a fair game?

Five cards can be ordered in 97·96·95·94·93 ways. The number of unique 5-card combinations is C(97,5). Each unique set has exactly one strictly-descending arrangement, so:
P(5 cards descending) = C(97,5) / (97·96·95·94·93) = 1/(5·4·3·2·1) = 1/120.

EV = (1/120)·20 − (119/120)·1 = −99/120.

For a fair game: (1/120)·X − (119/120)·1 = 0 ⟹ X = 119.

**Correct Answer: EV = −99/120 ≈ −0.825; fair prize = 119**

---

## Family: Simulating probabilities with a coin

*Method: map equally-likely coin sequences to target outcomes; use the Von Neumann extractor for unknown bias; count expected flips via the geometric distribution (rejection sampling) or binary expansion for irrational targets.*

### EV10 — Biased Coin #1
**Company:** Citadel Securities, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Von Neumann fair-coin extractor

#### Condensed
**Q:** A coin lands Heads w.p. p ∈ (0,1) (unknown bias). Produce a perfectly fair 50/50 outcome. Expected flips?
**A:** Von Neumann: flip twice; HT→"Heads", TH→"Tails", HH/TT→discard & repeat. Fair since P(HT)=P(TH)=p(1−p). Each round 2 flips, succeeds w.p. 2p(1−p) → **E[flips] = 2/(2p(1−p)) = 1/(p(1−p))** (= 4 for p=0.5).

#### Verbatim
You have a coin that lands Heads with probability p ∈ (0,1) (not necessarily fair). Describe an algorithm using repeated flips to generate a single perfectly fair outcome (Heads w.p. 1/2). Compute the expected number of flips.

Use the Von Neumann extractor: (1) flip twice; (2) HT → "Heads", TH → "Tails"; (3) HH or TT → discard and restart. Fair because P(HT) = p(1−p) = P(TH) = (1−p)p for any p.

A fair outcome occurs w.p. 2p(1−p). Each round uses exactly 2 flips; by the geometric distribution the expected number of rounds is 1/(2p(1−p)), so:
E[flips] = 2/(2p(1−p)) = 1/(p(1−p)).
For a fair coin (p=0.5) this is 4 flips on average.

**Correct Answer: 1/(p(1−p)) flips (4 when p=0.5)**

---

### EV11 — Biased Coin #2
**Company:** Citadel Securities, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Fair coin → dyadic probability

#### Condensed
**Q:** Using a fair coin, produce Heads w.p. 1/4 and Tails w.p. 3/4.
**A:** Flip twice: HH → "Heads"; HT/TH/TT → "Tails". Each 2-flip sequence has prob 1/4 → exactly 1/4 vs 3/4. (Procedure answer.)

#### Verbatim
Using a perfectly fair coin, devise a procedure producing "Heads" with probability 1/4 and "Tails" with probability 3/4.

Flip the fair coin twice: map HH to "Heads"; map HT, TH, TT to "Tails". Because each two-flip sequence occurs with probability 1/4, the output is exactly 1/4 vs 3/4.

**Correct Answer: procedure — 2 flips, HH→Heads else Tails**

---

### EV12 — Biased Coin #3
**Company:** Citadel Securities, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Fair coin → dyadic probability

#### Condensed
**Q:** Fair coin → Heads w.p. 3/8, Tails w.p. 5/8.
**A:** Flip 3 times (8 equally likely sequences). Map any 3 to "Heads" (e.g. HHH, HHT, HTH), the other 5 to "Tails". (Procedure answer.)

#### Verbatim
Describe how to use a fair coin to obtain "Heads" with probability 3/8 and "Tails" with probability 5/8.

Flip the coin three times — 2³ = 8 equally likely sequences. Choose any three distinct sequences (e.g. {HHH, HHT, HTH}) and map them to "Heads"; map the remaining five to "Tails".

**Correct Answer: procedure — 3 flips, any 3 of 8 sequences → Heads**

---

### EV13 — Biased Coin #4
**Company:** Citadel Securities, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Rejection sampling; expected flips

#### Condensed
**Q:** Fair coin → simulate Heads w.p. 2/9. Expected flips to throw Heads?
**A:** 2/9 isn't k/2ⁿ: flip 4 times (16 sequences), keep 9, discard 7; within the kept 9, label 2 "Heads", 7 "Tails". P(Heads per round) = 2/16, rounds = 1/(2/16)=8, flips/round=4 → **E[flips] = 4·8 = 32**.

#### Verbatim
Explain how to simulate "Heads" with probability 2/9 using a fair coin. Compute the expected number of flips to throw heads.

Because 2/9 is not of the form k/2ⁿ: (1) flip four times (16 equally likely sequences); (2) retain only 9 of the 16, discard the other 7; (3) within the kept block, designate 2 sequences "Heads" and 7 "Tails".

Each round is 4 flips. P(Heads in one round) = 2/16. By the geometric distribution, E[rounds] = 1/(2/16) = 8, so E[flips] = 4·8 = 32.

**Correct Answer: 32**

---

### EV14 — Biased Coin #5
**Company:** Citadel Securities, Jane Street, SIG, Virtu · **Difficulty:** Medium · **Concept:** Simulating an irrational probability; binary expansion

#### Condensed
**Q:** Fair coin → simulate Heads with an irrational probability (e.g. 1/π).
**A:** Write the target in binary: 1/π = 0.b₁b₂b₃…₂. Generate bits by flipping; stop once the path in the binary tree determines which side of the target the random point falls (Knuth–Yao). Halts almost surely, but no finite bound on flips. (Procedure answer.)

#### Verbatim
Explain how to simulate "Heads" with an irrational probability (for example, 1/π) using a fair coin.

The procedure uses an unbounded (potentially infinite) number of flips. Write the probability in its infinite binary expansion: 1/π = 0.b₁b₂b₃… (base 2). Generate bits one at a time by flipping, comparing partial binary fractions (Knuth–Yao / probability-tree method): flip until the path taken uniquely determines whether the target lies to the left or right of the random binary point generated. The algorithm stops almost surely, but there is no finite upper bound on the number of flips.

**Correct Answer: procedure — binary-expansion bit generation, unbounded expected flips**

---

## Family: Continuous / geometric EV optimization

*Method: use area-proportional probability for uniform points in 2-D; write EV as a function of the choice variable; maximize (complete the square or differentiate).*

### EV15 — Bullseye Bet
**Company:** SIG · **Difficulty:** Medium · **Concept:** Uniform-on-disk probability; quadratic EV maximization

#### Condensed
**Q:** Dartboard radius 12, dart lands uniformly by area. Pick r ∈ [0,12]. Within r you pay Nadia (12−r); beyond r she pays you r. Best r?
**A:** P(D≤r) = r²/144 (area ∝ r²). E[W] = r(1 − r²/144) − (12−r)(r²/144); cubics cancel → E[W] = r − r²/12. Maximize: vertex at **r = 6, E[W] = 3**.

#### Verbatim
A circular dartboard of radius 12 inches; a dart lands at a uniformly random point on the board. Before the throw you fix a distance r with 0 ≤ r ≤ 12. If the dart lands within distance r of the center you pay Nadia (12 − r) dollars; if farther than r, Nadia pays you r dollars. Which r maximizes your expected winnings?

A point is uniform over a 2-D region when probability is proportional to area. So distance D to the center is NOT uniform on [0,12]:
P(D ≤ r) = πr² / (π·12²) = r²/144.

Winnings W = −(12 − r) if D ≤ r, and +r if D > r. So:
E[W] = r·P(D>r) − (12 − r)·P(D≤r) = r(1 − r²/144) − (12 − r)·r²/144.
The two cubic terms cancel exactly, leaving E[W] = r − r²/12.

Maximize: r − r²/12 = 3 − (r−6)²/12, so max at r = 6, E[W] = 3.

**Correct Answer: 6** (E[W] = 3)

---

## Family: Indicator variables & linearity of expectation

*Method: write a count as a sum of 0/1 indicators; E[indicator] = P(event); sum by linearity (holds even under dependence). For variance of a sum, add covariances too.*

### EV16 — Capsule Colors
**Company:** Mako, SIG · **Difficulty:** Easy · **Concept:** Indicators + linearity of expectation

#### Condensed
**Q:** Gachapon has 10 colors, uniform each turn. Turn crank 4 times. Expected number of distinct colors?
**A:** Per color, P(appears ≥ once) = 1 − (9/10)⁴ = 0.3439. E[distinct] = 10 · 0.3439 = **3.439**.

#### Verbatim
A gachapon machine dispenses capsules in 10 colors, each turn uniform and independent. You turn the crank 4 times. Expected number of distinct colors among the 4 capsules? (3 d.p.)

Use indicator variables + linearity. For each color c let I_c = 1 if color c appears at least once. P(c never appears) = (9/10)⁴, so P(I_c = 1) = 1 − 6561/10000 = 0.3439.
E[D] = Σ_{c=1}^{10} P(I_c = 1) = 10 · 0.3439 = 3.439.

**Correct Answer: 3.439**

---

### EV17 — Diamond Variance
**Company:** SIG · **Difficulty:** Medium · **Concept:** Variance of a sum of indicators; covariance; hypergeometric

#### Condensed
**Q:** Deal 10 cards from a 52-card deck (13 diamonds). Variance of the number of diamonds?
**A:** Iᵢ = i-th card diamond, p=1/4, Var(Iᵢ)=3/16. Cov(Iᵢ,Iⱼ) = 13/52·12/51 − 1/16 = −1/272. Var = 10·3/16 + 90·(−1/272) = 105/68 ≈ **1.544**.

#### Verbatim
Ten cards are dealt from a standard 52-card deck (13 diamonds). Find the variance of the number of diamonds. (3 d.p.)

For a sum of indicators, Var(ΣXᵢ) = ΣVar(Xᵢ) + Σ_{i≠j} Cov(Xᵢ,Xⱼ). Let Iᵢ = 1 if the i-th dealt card is a diamond; p = 13/52 = 1/4, so Var(Iᵢ) = 3/16.
For i ≠ j: E[IᵢIⱼ] = (13/52)(12/51) = 1/17. Cov = 1/17 − 1/16 = −1/272. There are 90 ordered pairs.
Var(D) = 10·(3/16) + 90·(−1/272) = 105/68 ≈ 1.544.
Sanity via hypergeometric: 10·(13/52)·(39/52)·(42/51) = 105/68 ≈ 1.544.

**Correct Answer: 1.544**

---

## Family: Order statistics / variance comparison

*Method: for the median of i.i.d. rolls, compute the CDF P(M ≤ k) = P(at least 3 of 5 ≤ k) via Binomial, then difference to get the pmf; compute moments and compare coefficient of variation σ/μ.*

### EV18 — Coefficient of Variation
**Company:** Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Hard · **Concept:** Order statistics (median), variance, coefficient of variation

#### Condensed
**Q:** Three games on a fair d6: (1) payoff X²; (2) payoff X·Y (2 dice); (3) payoff M² where M = median of 5 dice. Which has lowest variance around its mean, and its CV = σ/μ (3 d.p.)?
**A:** Game 1: μ=15.17, σ=12.21, CV=0.805. Game 2: μ=12.25, σ=8.94, CV=0.730. Game 3 (median of 5): μ=13.62, σ=8.37, **CV=0.614** — the five-dice median-squared wins.

#### Verbatim
Three games; a fair d6 decides the payoff: (1) one die, payoff X²; (2) two dice, payoff X·Y; (3) five dice, payoff M² where M is the median (3rd order statistic) of five rolls. Which payoff has the lowest variance around its mean, and what is its coefficient of variation (σ/μ)? (3 d.p.)

**Game 1 (X²):** E[X²] = 91/6 ≈ 15.167. E[X⁴] ≈ 379.167. Var ≈ 149.14, σ ≈ 12.21, CV ≈ 0.805.
**Game 2 (X·Y):** E[XY] = 12.25, E[(XY)²] ≈ 230.03. Var ≈ 79.97, σ ≈ 8.94, CV ≈ 0.730.
**Game 3 (M², median of 5):** P(M ≤ k) = Σ_{j=3}^{5} C(5,j)(k/6)^j(1−k/6)^{5−j}. pmf (over 7776): k=1:276, 2:1356, 3:2256, 4:2256, 5:1356, 6:276. E[M²] ≈ 13.623; E[M⁴] ≈ 255.586; Var ≈ 69.99, σ ≈ 8.37, CV ≈ 0.614.

**Correct Answer: 0.614**

---

## Family: Elementary probability computations

*Method: symmetry, complement counting, and case-splitting on a first stage.*

### EV19 — Card On Top
**Company:** Flow Traders, IMC, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Symmetry

#### Condensed
**Q:** Shuffle 52 cards, discard the top 20, what's P(new top card is red)?
**A:** By symmetry every position is equally likely to be any card; 26 red of 52 → **0.5**. The discard count is irrelevant.

#### Verbatim
Take a shuffled deck of 52 playing cards and throw the top 20 cards in the bin. What is the probability that the new top card is red?

When you shuffle, every card is equally likely to be in any position. The new top card is equally likely to be any of the 52 cards. There are 26 red cards, so the probability is 26/52 = 1/2.

**Correct Answer: 0.5**

---

### EV20 — Coins and Dice
**Company:** Maven, SIG, DRW · **Difficulty:** Easy · **Concept:** Law of total probability; exactly-one count

#### Condensed
**Q:** Flip a fair coin: Heads → roll 1 die, Tails → roll 2 dice. P(exactly one 5 total)?
**A:** Heads: P(one 5) = 1/6. Tails: P(exactly one 5) = 2·(1/6)(5/6) = 10/36 = 5/18. Total = ½·1/6 + ½·5/18 = **2/9 ≈ 0.222**.

#### Verbatim
You flip a fair coin. Heads → roll one die; Tails → roll two dice. What is the probability of getting exactly one 5 in total?

Heads (prob 1/2): P(exactly one 5) = 1/6. Tails (prob 1/2): P(exactly one 5) = 2·(1/6)·(5/6) = 5/18.
Total: P = (1/2)(1/6) + (1/2)(5/18) = 2/9.

**Correct Answer: 0.222**

---

### EV21 — Croissant or Muffin
**Company:** Mako, SIG, DRW · **Difficulty:** Easy · **Concept:** Binomial, cumulative probability

#### Condensed
**Q:** Each customer buys a muffin w.p. 0.30 (else croissant). 2 muffins left, 5 customers. P(supply is enough)?
**A:** X ~ Binomial(5, 0.3); enough iff X ≤ 2. P(X≤2) = 0.70⁵ + 5·0.70⁴·0.30 + 10·0.70³·0.30² ≈ **0.84**.

#### Verbatim
In a bakery each customer buys one item: 70% a croissant, 30% a muffin. There are only 2 muffins left and 5 people waiting. Compute the probability the two muffins are sufficient, to 2 d.p.

Let X ~ Binomial(n=5, p=0.30). The two muffins suffice iff X ≤ 2:
P(X≤2) = 0.16807 + 0.36015 + 0.30870 ≈ 0.8369.

**Correct Answer: 0.84**

---

## Family: Recursion & symmetry

*Method: set up a recursion or exploit a symmetry/induction argument; solve for the fixed point or the uniform distribution it implies.*

### EV22 — Basketball Practice #1
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Pólya-urn-style induction; uniform distribution of hits

#### Condensed
**Q:** Tom hits shot 1, misses shot 2. For n≥3, P(make n-th) = proportion made in first n−1. Expected hits in 100 attempts?
**A:** By induction P(K_n = k) = 1/(n−1) uniform on {1,…,n−1}; so after 100 shots hits are uniform on {1,…,99}. E[K₁₀₀] = average of 1..99 = **50**.

#### Verbatim
Tom shoots free throws. His first is a hit and he misses his second. For n ≥ 3, the probability of making the n-th equals the proportion made during his first n−1 attempts. How many can Tom expect to hit in 100 attempts?

Prove by induction P(K_n = k) = 1/(n−1) for 1 ≤ k ≤ n−1. Base n=2: P(K₂=1)=1. Inductive step:
P(K_{n+1}=k) = (1/(n−1))·((k−1)/n) + (1/(n−1))·((n−k)/n) = 1/n. ∎
So after 100 shots hits range uniformly over 1 to 99: E[K₁₀₀] = 50.

**Correct Answer: 50**

---

### EV23 — Basketball Practice #2
**Company:** Citadel Securities, Jane Street, SIG · **Difficulty:** Hard · **Concept:** Conditional probability with the same induction

#### Condensed
**Q:** Same setup. As n grows, P(make (n+1)-th | made n-th)?
**A:** P(Hₙ)=1/2 by symmetry. P(H_{n+1}∩Hₙ) = 1/3 (using Σk(k+1) = n(n−1)(n−2)/3). So P(H_{n+1}|Hₙ) = (1/3)/(1/2) = **2/3**, independent of n.

#### Verbatim
Same setup as Basketball Practice #1. As n increases, what is the probability that Tom makes his (n+1)-th shot, given that he made the n-th?

P(H_{n+1} ∩ H_n) = 1/(n(n−1)(n−2)) · Σ_{k=1}^{n−2} k(k+1). Using Σk(k+1) = n(n−1)(n−2)/3, this is 1/3.
Therefore P(H_{n+1} | H_n) = (1/3)/(1/2) = 2/3, independent of n.

**Correct Answer: 2/3 ≈ 0.667**

---

### EV24 — Coin Toss #2
**Company:** Mako, SIG · **Difficulty:** Easy · **Concept:** Recursion on stopping parity

#### Condensed
**Q:** Flip a fair coin until two consecutive same faces (HH or TT). P(stop on an even-numbered flip)?
**A:** From flip 2 on, each flip stops w.p. 1/2 (matches previous). p = 1/2 + 1/2(1−p) → (3/2)p = 1 → p = **2/3**.

#### Verbatim
Alex flips a fair coin until he gets two consecutive heads (HH) or two consecutive tails (TT). What is the probability he stops on an even-numbered flip?

After flip 1, on every subsequent flip he stops w.p. 1/2. Let p = P(stop on an even flip):
p = 1/2 + 1/2(1 − p) → (3/2)p = 1 → p = 2/3.

**Correct Answer: 0.667**

---

## Family: Coupon collector

*Method: expected time to collect all coupons = sum of geometric waiting times for each new one.*

### EV25 — Collecting Stickers
**Company:** Mako, SIG · **Difficulty:** Easy · **Concept:** Coupon collector

#### Condensed
**Q:** 6 stickers, one uniform-random per £5 box. Expected total cost to complete the set?
**A:** E[boxes] = 6(1/6+1/5+1/4+1/3+1/2+1/1) = 14.7. Cost = 14.7 × £5 = **£73.50**.

#### Verbatim
A collector wants all 6 different stickers. Each cereal box (£5) contains one sticker, uniform at random. Expected total cost to complete the set?

With k distinct held, expected boxes for the next new one is 6/(6−k):
E[boxes] = 1 + 1.2 + 1.5 + 2 + 3 + 6 = 14.7 boxes. Cost = 14.7 × £5 = £73.50.

**Correct Answer: 73.5**

---

## Family: Normal approximation / CLT

### EV26 — Dice vs Coins
**Company:** Citadel Securities, Jane Street, SIG, Virtu · **Difficulty:** Medium · **Concept:** Central Limit Theorem; sum of independent variables

#### Condensed
**Q:** 600 coins (heads=1 pt each) vs 100 dice (face value each). P(dice points > coin points)?
**A:** H~Bin(600,0.5): μ=300, σ²=150. D: μ=350, σ²≈291.67. X=D−H: μ=50, σ²≈441.67, σ≈21. P(X>0)=Φ(2.38)= **0.9913**.

#### Verbatim
You have 600 coins (each heads worth 1 point) and 100 dice (each worth its face value). Probability that you have more points from your dice than your coins?

μ_H = 300; μ_D = 350. σ²_H = 150; σ²_D = 100·35/12 ≈ 291.67.
X = D − H: μ_X = 50, σ²_X = 441.67, σ_X ≈ 21. By CLT, P(D > H) = P(Z > −2.38) = Φ(2.38) = 0.9913.

**Correct Answer: 0.9913**

---

## Family: EV of a wager / decision (continued)

### EV27 — Dice With Same Numbers
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** EV over dice outcomes

#### Condensed
**Q:** Roll 3 dice: all same → +€16; exactly two same → +€14; all different → −€4. Expected return per roll?
**A:** P(all same)=1/36, P(pair)=15/36, P(all diff)=20/36. E = (16·1 + 14·15 − 4·20)/36 = 146/36 = **4.06**.

#### Verbatim
You roll 3 dice. All same number → €16; exactly two the same → €14; all different → lose €4. Expected return per roll (2 d.p.)?

- All 3 same: P = 1/36; contributes 16/36.
- Exactly 2 same: P = 15/36; contributes 210/36.
- All different: P = 20/36; contributes −80/36.
E = 146/36 = 73/18 ≈ 4.06.

**Correct Answer: 4.06**

---

### EV28 — Different Outcome
**Company:** SIG · **Difficulty:** Easy · **Concept:** Complement

#### Condensed
**Q:** Roll one die twice. P(2nd differs from 1st)?
**A:** P(match) = 1/6 → P(different) = 1 − 1/6 = 5/6 ≈ **0.83**.

#### Verbatim
You throw one die two times. What is the probability that the 2nd throw has a different face value than the first?

The probability the second matches the first is 1/6. So the probability it's different is 5/6.

**Correct Answer: 0.83**

---

### EV29 — Divisible Throws
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Indicator + linearity of expectation

#### Condensed
**Q:** Roll a fair d20 nine times. X = number of rolls divisible by 8. E[X]?
**A:** Multiples of 8 in 1–20: {8,16} → p = 2/20 = 1/10. E[X] = 9·(1/10) = **0.9**.

#### Verbatim
Consider a fair 20-sided die. Roll it 9 times. Let X be the number of rolls divisible by 8. Calculate E[X].

Numbers divisible by 8 in 1–20 are 8 and 16, so P = 2/20 = 1/10. E[X] = 9·(1/10) = 9/10.

**Correct Answer: 0.9**

---

### EV30 — Double Down Coin Bet
**Company:** SIG · **Difficulty:** Easy · **Concept:** Martingale (doubling) betting; EV of a fair game

#### Condensed
**Q:** Fair coin, heads doubles your bet (win = bet), tails loses bet. Double after each loss, stop at a profit or bankruptcy. Start $127, min bet $1. EV?
**A:** Survive 7 losses (1+2+…+64 = 127). Win before bankruptcy → +$1; 7 straight losses (prob 1/128) → −$127. EV = (1/128)(−127) + (127/128)(+1) = **0**.

#### Verbatim
A coin-toss game: heads → you receive double your bet (net +bet); tails → you lose your bet. Strategy: double your bet after each loss, stop as soon as you make a profit or go bankrupt. Start with $127, minimum bet $1. EV of the game?

P(bankruptcy) = (1/2)⁷ = 1/128; P(finish with profit) = 127/128. EV = (1/128)·(−127) + (127/128)·(1) = 0.

**Correct Answer: 0**

---

## Family: Wald's identity / stopping-time sums

### EV31 — Double Roll Pay
**Company:** Citadel Securities, Da Vinci, Jane Street, Maven, SIG, DRW · **Difficulty:** Easy · **Concept:** Wald's identity

#### Condensed
**Q:** Roll a die until the same number appears twice in a row; game ends and pays the sum of all rolls. EV?
**A:** Expected rolls: 1 + 6 = 7. E[value per roll] = 3.5. Wald: E[sum] = 7·3.5 = **24.5**.

#### Verbatim
You roll a die continuously until you roll the same number twice in a row; the game ends and you're paid the sum of all your rolls. Expected value?

Expected rolls: p = 1/6 to match previous, so 1 + 6 = 7 rolls. Expected value per roll = 3.5.
By Wald's identity, E[Σ Rₖ] = E[N]·E[R₁] = 7·3.5 = 24.5.

**Correct Answer: 24.5**

---

## Family: Martingales / random walks

### EV32 — Drunk Student #1
**Company:** Akuna Capital, Da Vinci, Flow Traders, IMC, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Martingale / gambler's ruin

#### Condensed
**Q:** Symmetric ±1 random walk starting at position 27 on a bridge [0,100] (73 ahead, 27 behind). P(reach end before start)?
**A:** Martingale: E[Y] = Pₑ·73 − (1−Pₑ)·27 = 0 → **Pₑ = 27/100 = 0.27**.

#### Verbatim
A drunk student on a 100-meter bridge is at the 27th meter (73 m ahead). Each step is +1 m or −1 m w.p. 1/2. Probability he reaches the end before returning to the start? (Use martingale theory.)

Set the current position (27) as 0: symmetric random walk reaching +73 (end) or −27 (start).
E[Y] = Pₑ·73 − (1−Pₑ)·27 = 0 → 100Pₑ = 27 → Pₑ = 0.27.

**Correct Answer: 0.27**

---

### EV33 — Drunk Student #2
**Company:** Akuna Capital, Citadel Securities, Jane Street, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** Optional stopping theorem; expected duration of a random walk

#### Condensed
**Q:** Same walk (start at 27, bounds 0 and 100). Expected number of steps to reach either end?
**A:** Use Y²−t is a martingale: E[S] = Pₑ·73² + (1−Pₑ)·27² = 0.27·5329 + 0.73·729 = **1971** (= 73·27).

#### Verbatim
Extension of Drunk Student #1. Expected number of steps to reach either the end or the beginning of the bridge?

By the optional stopping theorem applied to Y_t² − t:
E[S] = Pₑ·73² + (1−Pₑ)·27² = 0.27·5329 + 0.73·729 = 1971 = 73·27.

**Correct Answer: 1971**

---

## Family: Indicator variables & linearity (continued)

### EV34 — Empty Boxes
**Company:** Da Vinci, SIG · **Difficulty:** Easy · **Concept:** Indicator + linearity

#### Condensed
**Q:** 100 balls into 50 boxes uniformly at random. Expected number of empty boxes?
**A:** P(box empty) = (49/50)¹⁰⁰. E[empty] = 50·(49/50)¹⁰⁰ ≈ **6.63**.

#### Verbatim
You have 100 balls and 50 boxes. Every ball goes into a random box independently. Expected number of empty boxes?

P(box i empty) = (49/50)¹⁰⁰. E[X] = 50·(49/50)¹⁰⁰ ≈ 6.63.

**Correct Answer: 6.63**

---

## Family: Continuous distribution moments

### EV35 — Exponential Distribution #1
**Company:** SIG · **Difficulty:** Medium · **Concept:** Moments of the exponential distribution

#### Condensed
**Q:** X ~ Exp(3). Find E[X²].
**A:** For Exp(λ), E[X²] = 2/λ². With λ=3, E[X²] = **2/9**.

#### Verbatim
Let X be exponentially distributed by exp(3). Find E[X²].

E[X²] = ∫₀^∞ x²·λe^{−λx} dx = 2/λ². For λ = 3, E[X²] = 2/9.

**Correct Answer: 2/9 ≈ 0.222**

---

## Family: Conditional expectation / geometric (continued)

### EV36 — Faster Sixes
**Company:** Mako, SIG · **Difficulty:** Hard · **Concept:** Conditional expectation of a geometric, conditioned on a race

#### Condensed
**Q:** A and B each roll a die until their first multiple of 3 (3 or 6), p=1/3, independently. Given A needed strictly fewer rolls than B, expected rolls A made?
**A:** E[A|A<B] = 1/(1−q²) = 1/(5/9) = **9/5 = 1.8**.

#### Verbatim
Two players A and B each repeatedly roll a fair die until their first multiple of 3, independently. Given that A needed strictly fewer rolls than B, what is the expected number of rolls A made? (2 d.p.)

p = 1/3, q = 2/3. P(A<B) = pq/(1−q²) = 2/5. E[A·1(A<B)] = pq/(1−q²)² = 18/25.
E[A|A<B] = (18/25)/(2/5) = 9/5 = 1/(1−q²) = 1.8.

**Correct Answer: 1.8**

---

## Family: Symmetry / spacings

### EV37 — First Ace
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Symmetric spacings

#### Condensed
**Q:** Expected number of cards turned over to see the first ace in a standard deck?
**A:** 4 aces split 48 non-aces into 5 equal gaps → 48/5 = 9.6. Plus the ace → **10.6**.

#### Verbatim
What is the expected number of cards that need to be turned over in a regular deck to see the first ace?

The 4 aces split the deck into 5 regions; each has expected length 48/5 = 9.6. Reaching the first ace: 9.6 + 1 = 10.6.

**Correct Answer: 10.6**

---

## Family: Elementary probability (continued)

### EV38 — First Flip Wins
**Company:** Mako, SIG · **Difficulty:** Easy · **Concept:** Complement over sequences

#### Condensed
**Q:** Race of 3 coin flips (always flip all 3). P(the first side you flip "wins" the race)?
**A:** Lose only if the other two are both opposite (HTT or THH): P(lose) = 1/4. P(win) = **3/4**.

#### Verbatim
Consider a race with three coin flips. What is the probability that the first side you flip will win the race?

P(lose) = (1/2)³ + (1/2)³ = 1/4. So P(win) = 3/4.

**Correct Answer: 0.75**

---

## Family: Indicator variables / relative order (continued)

### EV39 — First Prime
**Company:** SIG, DRW · **Difficulty:** Medium · **Concept:** Indicator; relative order of a subset

#### Condensed
**Q:** Numbers 1–14 in random order. Expected count of non-primes before the first prime?
**A:** Primes = 6; non-primes (incl. 1) = 8. Each non-prime beats all 6 primes w.p. 1/7. E[N] = 8/7 ≈ **1.14** (general: n/(m+1)).

#### Verbatim
The numbers 1 to 14 are arranged in random order. How many non-prime numbers do we expect before the first prime? (2 d.p.)

Primes: 2,3,5,7,11,13 (6). Non-primes: 1,4,6,8,9,10,12,14 (8). P(I_k=1) = 1/7. E[N] = 8/7 ≈ 1.14.

**Correct Answer: 1.14**

---

## Family: Variance / E[X²]

### EV40 — Flip 100 Coins
**Company:** SIG · **Difficulty:** Medium · **Concept:** E[X²] via variance of a binomial

#### Condensed
**Q:** Flip 100 coins; multiply #heads by #tails. Expected value?
**A:** E[X(100−X)] = 100·50 − E[X²]; E[X²]=25+2500=2525 → **2475**.

#### Verbatim
If I flip 100 coins and multiply the number of heads by the number of tails, what is the expected value?

E[X(100−X)] = 100·E[X] − E[X²]. Var(X)=25, E[X²]=2525. E = 5000 − 2525 = 2475.

**Correct Answer: 2475**

---

## Family: Optimal stopping + EV (continued)

### EV41 — Flip 4 Coins
**Company:** Citadel Securities, Jane Street, SIG · **Difficulty:** Medium · **Concept:** EV of a sum; one-reroll and infinite-reroll optimal stopping

#### Condensed
**Q:** Flip 4 coins, $1 per head. (1) EV? (2) With one free re-flip of all 4 if unhappy? (3) Endless free re-flips?
**A:** (1) **2**. (2) E = (5/16)·2 + (6/16)·2 + (4/16)·3 + (1/16)·4 = **19/8**. (3) Endless → **4**.

#### Verbatim
Flipping 4 coins, $1 per Heads. (1) EV? (2) If unhappy you may re-flip all 4 once; EV? (3) If you could replay endlessly for free?

(1) E[X] = 2. (2) Re-flip if X<2 (worth 2). New EV = (5/16)·2 + (6/16)·2 + (4/16)·3 + (1/16)·4 = 19/8. (3) Endless → 4.

**Correct Answer: 2; 19/8; 4**

---

## Family: Geometric probability (area)

### EV42 — Flowers in Bloom
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Uniform over a square; overlap-interval geometry

#### Condensed
**Q:** Purple blooms uniformly in [0,30], lasts 9 days; red uniformly in [0,30], lasts 12 days, independent. P(both in bloom simultaneously at some point)?
**A:** Overlap area = 900 − 220.5 − 162 = 517.5 → P = 517.5/900 = **0.575**.

#### Verbatim
Purple flower blossoms uniformly within 30 days, blooms 9 days. Red uniformly within 30 days, blooms 12 days, independent. Probability both are in bloom simultaneously at some point?

Overlap iff x ≤ y+12 and y ≤ x+9. Area = 30² − ½·21² − ½·18² = 900 − 220.5 − 162 = 517.5. P = 517.5/900 = 0.575.

**Correct Answer: 0.575**

---

## Family: Binomial (continued)

### EV43 — Free Seat
**Company:** Maven, SIG, DRW · **Difficulty:** Easy · **Concept:** Binomial cumulative probability

#### Condensed
**Q:** 4 people ahead of Bob, 3 free seats. Each takes a seat (2/5), leaves (1/10), or stands (1/2). P(Bob gets a seat)?
**A:** Bob succeeds iff ≤ 2 of the 4 take seats. X~Bin(4, 2/5): P(X≤2) = 513/625 ≈ **0.821**.

#### Verbatim
There are 4 people in line before Bob and 3 free seats. Each independently takes a seat w.p. 2/5, leaves w.p. 1/10, or stands w.p. 1/2. Probability Bob gets a free seat?

X ~ Binomial(4, 2/5): P(X≤2) = 513/625 ≈ 0.821.

**Correct Answer: 0.821**

---

## Family: Birthday / optimal position

### EV44 — Free Ticket
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Hard · **Concept:** Birthday-collision optimization over line position

#### Condensed
**Q:** Free ticket goes to the first person whose birthday matches someone earlier in line. 365 days, uniform, you pick your position. Best position?
**A:** Maximize P(N); leads to N²−N−365>0 → N≈19.6 → best position is **20**.

#### Verbatim
A free ticket is given to the first person in line whose birthday matches someone already ahead. Birthdays uniform over 365 days; you pick any position. Which position gives the best chance?

P(N) = (product of distinctness) × (N−1)/365. Find smallest N with P(N) > P(N+1): N² − N − 365 > 0 → N ≈ 19.6 → position 20.

**Correct Answer: position 20**

---

## Family: Threshold EV / decision

### EV45 — Game Show Stop or Go
**Company:** SIG, DRW · **Difficulty:** Easy · **Concept:** Break-even probability

#### Condensed
**Q:** Have $1000. Play final question: correct → $4000, wrong → $250. Min probability of a correct answer to make playing worthwhile?
**A:** 4000x + 250(1−x) ≥ 1000 → 3750x ≥ 750 → x ≥ **0.2**.

#### Verbatim
You've accumulated $1000. Play the final question (correct → $4000, wrong → $250) or stop at $1000. Minimum probability of answering correctly to make the risk worthwhile?

4000x + 250(1−x) = 1000 → 3750x = 750 → x = 0.2.

**Correct Answer: 0.2**

---

## Family: Positional strategy / Kelly

### EV46 — Kelly Betting #1
**Company:** SIG, DRW · **Difficulty:** Easy · **Concept:** Positional advantage in a shared-pot game

#### Condensed
**Q:** 3 players, each antes $10. Each draws 2 cards, bets whether a 3rd card falls between them; win takes bet from pot, lose adds to pot. Play first, second, or third?
**A:** **Go first.** Win odds equal for everyone, but players only bet with favorable odds, which drains the pot. Acting first means no favorable-odds money has left the pot before your turn.

#### Verbatim
Three players each put $10 in the pot; take turns. Each gets two cards and bets whether the third card falls strictly between. Win → take X from pot; lose → put X in. Play first, second, or third?

Go first: favorable-odds bets tend to remove money from the pot, so you prefer to act before any pot has been drained.

**Correct Answer: go first**

---

### EV47 — Kelly Betting #2
**Company:** SIG, DRW · **Difficulty:** Medium · **Concept:** In-between-cards probability; Kelly criterion for repeated play

#### Condensed
**Q:** Same game. (1) Draw 3 & 10 — bet? (2) Draw 2 & 10 — bet? (3) Repeated play, draw 2 & 10 — size?
**A:** (1) p=24/50 < 0.5 → EV −0.04 → **don't bet**. (2) p=28/50 > 0.5 → EV +0.12 → single run **bet max (full pot $30)**. (3) Kelly f = p − (1−p)/b, b=1 → **3/25 of bankroll**.

#### Verbatim
Same 3-player in-between game.
(1) Draw 3 and 10. Bet? (2) Draw 2 and 10. Bet? (3) Repeated play, draw 2 and 10, size?

(1) Win on {4..9} = 24/50 = 12/25 < 0.5. EV = 2p−1 = −0.04 → don't play.
(2) Win on {3..9} = 28/50 = 14/25 > 0.5. EV = +0.12 → bet the full pot ($30).
(3) Kelly: f = 14/25 − 11/25 = 3/25 of bankroll.

**Correct Answer: (1) don't bet (EV −0.04); (2) bet max, full pot $30; (3) Kelly fraction f = 3/25 of bankroll**

---

## Family: Records / harmonic sum

### EV48 — Largest Sunflower
**Company:** Citadel Securities, SIG, DRW · **Difficulty:** Easy · **Concept:** Record values; harmonic number

#### Condensed
**Q:** 8 sunflowers of distinct random heights in a row; keep one iff it's taller than all seen so far. Expected number kept?
**A:** P(position k kept) = 1/k. E = H₈ ≈ **2.72**.

#### Verbatim
A gardener plants 8 sunflowers in a line, each a distinct random height. He keeps a flower iff it's taller than every flower seen so far. Expected number kept? (2 d.p.)

P(kept) = 1/k. E = Σ_{k=1}^{8} 1/k ≈ 2.72.

**Correct Answer: 2.72**

---

## Family: EV of a wager (continued)

### EV49 — Other Than Six
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** EV of a uniform outcome

#### Condensed
**Q:** Roll a fair die until a value other than 6 appears; paid the value of that last roll. Fair value?
**A:** The paying roll is uniform on {1,2,3,4,5} → E = (1+2+3+4+5)/5 = **3**. *(Answer computed — not printed in source.)*

#### Verbatim
You roll a fair die until a value other than 6 appears and are paid the amount on the die on that last roll. What is the fair value of this game?

Conditional on "not a 6" the paying roll is uniform over {1,2,3,4,5}: (1+2+3+4+5)/5 = 3.

**Correct Answer: 3** *(computed — the source paste did not include an answer line)*

---

## Family: Geometric memorylessness

### EV50 — Patient Roller
**Company:** Mako, SIG · **Difficulty:** Easy · **Concept:** Memorylessness of the geometric distribution

#### Condensed
**Q:** Roll a die until the first 6. Given no 6 in the first 4 rolls, expected total rolls to get the first 6?
**A:** Memoryless: expected extra = 1/p = 6. Total = 4 + 6 = **10** (general: m + 1/p).

#### Verbatim
You roll a fair die until it shows a 6. Given the first 6 still hasn't appeared after the first 4 rolls, expected total number of rolls?

Given X > 4, extra rolls behave like a fresh geometric wait, averaging 6. E[X | X>4] = 4 + 6 = 10.

**Correct Answer: 10**

---

## Family: Normal approximation / absolute value (continued)

### EV51 — Remaining Coins
**Company:** Citadel Securities, SIG · **Difficulty:** Medium · **Concept:** Binomial, E[|2H−n|], normal approx E[|X|]=σ√(2/π)

#### Condensed
**Q:** Flip 50 fair €1 coins; remove head–tail pairs until none remain; keep the rest. Expected payout?
**A:** Remaining = |2H − 50|, H~Bin(50,½). E ≈ √50·√(2/π) ≈ **5.64**.

#### Verbatim
Flip 50 fair €1 coins. Remove pairs consisting of one head and one tail until no such pairs remain. You keep the remaining coins. Find the expected payout.

Remaining = |H − T| = |2H − 50|. For X ~ N(0, 50), E[|X|] = σ·√(2/π) = √50·√(2/π) ≈ 5.64.

**Correct Answer: 5.64**

---

## Family: First-step recursion (memoryless games)

### EV52 — Repeating Dice
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** First-step expectation recursion

#### Condensed
**Q:** Roll a die, paid face value; a roll of 1/2/3 lets you roll again, a 4/5/6 stops. Expected payoff?
**A:** E = ½·(2 + E) + ½·5 → E = ½E + 3.5 → **E = 7**.

#### Verbatim
You roll a single die, paid the face value. If a roll gives 1, 2, or 3 you may roll again; once you get 4, 5, or 6 the game stops. Expected payoff?

E = ½·(2 + E) + ½·5 = ½E + 3.5 → E = 7.

**Correct Answer: 7**

---

### EV53 — Roll and Spin
**Company:** Mako, SIG, Virtu · **Difficulty:** Easy · **Concept:** First-step recursion; independent continuation

#### Condensed
**Q:** Each round: roll a d8, keep the face value; roll 1–5 ends the game, roll 6/7/8 → spin (2 green/1 red); green = another round, red = end. Expected total payout?
**A:** Payment/round = 4.5. P(continue) = (3/8)·(2/3) = 1/4. E = 4.5 + ¼E → **E = 6**.

#### Verbatim
A carnival game with a fair d8 and a spinner (two green, one red). Each round: roll the die, get paid the face value (kept). If 1–5 the game ends. If 6/7/8, spin: red ends, green → another round. Expected total payout?

P(continue) = (3/8)(2/3) = 1/4. E = 4.5 + ¼E → ¾E = 4.5 → E = 6.

**Correct Answer: 6**

---

## Family: Indicator variables & linearity (continued)

### EV54 — Rowing Reshuffle
**Company:** SIG · **Difficulty:** Medium · **Concept:** Indicator + linearity; random pairing

#### Condensed
**Q:** 13 boats (26 rowers, each with a regular partner) re-paired uniformly at random into 13 new pairs. Expected number of original pairs reunited?
**A:** Per crew, re-pair w.p. 1/25. E = 13·(1/25) = 13/25 = **0.52**.

#### Verbatim
A rowing club has 13 two-person boats (26 members). All 26 are drawn into 13 new pairs uniformly at random. Expected number of regular crews together again? (2 d.p.)

P(paired again) = 1/25. E[N] = 13·(1/25) = 0.52.

**Correct Answer: 0.52**

---

## Family: Elementary probability (continued)

### EV55 — Same Flips
**Company:** Flow Traders, IMC, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Elementary probability

#### Condensed
**Q:** Flip a fair coin 3 times. P(all same)?
**A:** P(HHH) + P(TTT) = 1/8 + 1/8 = **1/4**.

#### Verbatim
You flip a fair coin 3 times. What is the probability that the outcome is the same for all flips?

P(HHH) + P(TTT) = 1/8 + 1/8 = 1/4.

**Correct Answer: 0.25**

---

### EV56 — Shooting Star
**Company:** SIG · **Difficulty:** Easy · **Concept:** Complement over independent sub-intervals

#### Condensed
**Q:** P(see a shooting star in 1 hour) = 75%. P(see one in 30 min)?
**A:** 1 − (1−α)² = 0.75 → (1−α)² = 0.25 → α = **0.5**.

#### Verbatim
Given a one-hour period, there's a 75% chance you see a shooting star. What is the chance you see it in a 30-minute period?

1 − (1−α)² = 0.75 → (1−α)² = 0.25 → α = 0.5.

**Correct Answer: 0.5**

---

## Family: Continuous uniform

### EV57 — Shuttle Wait
**Company:** Jane Street, SIG · **Difficulty:** Easy · **Concept:** Continuous uniform expectation

#### Condensed
**Q:** A shuttle leaves every 12 minutes on a fixed schedule; you arrive uniformly at random. Expected wait?
**A:** E[wait] = 12 − 6 = **6** (half the gap).

#### Verbatim
A shuttle departs every 12 minutes. You arrive at a uniformly random moment. Expected minutes until the next departure?

Time since last departure ~ Uniform(0,12), E = 6. Wait = 12 − 6 = 6.

**Correct Answer: 6**

---

## Family: Relative order / symmetry (continued)

### EV58 — Specific Card #1
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Relative order of a relevant subset

#### Condensed
**Q:** Deal cards until a 7 appears. P(no K/Q/J appears before the 7)?
**A:** Only 4 sevens + 12 face cards (16 relevant) matter; condition holds iff first relevant card is a 7. P = 4/16 = **1/4**.

#### Verbatim
A shuffled deck is dealt one by one until a 7 appears. Find the probability that no kings, queens, or jacks appear before the 7.

Among the 16 relevant cards, P(first is a 7) = 4/16 = 1/4.

**Correct Answer: 0.25**

---

### EV59 — Spin in Two Regions
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** First-step + geometric waiting time

#### Condensed
**Q:** Spinner regions with probabilities 1/6, 1/6, 2/3. Expected spins to land in two distinct regions?
**A:** E[N|R₁] = 1 + 1/(1−P(R₁)). E = (1/6)(11/5) + (1/6)(11/5) + (2/3)(4) = 17/5 = **3.4**.

#### Verbatim
A spinner has three regions with probabilities 1/6, 1/6, 2/3. Expected number of spins to land in two distinct regions.

E[N|R₁] = 1 + 1/(1−P(R₁)). E = (1/6)(11/5) + (1/6)(11/5) + (2/3)(4) = 17/5 = 3.4.

**Correct Answer: 3.4**

---

## Family: Indicator / linearity (continued)

### EV60 — Sum Remaining Odd Dice
**Company:** Citadel Securities, Mako, Maven, SIG · **Difficulty:** Easy · **Concept:** Linearity; expected count × expected value

#### Condensed
**Q:** Roll 200 dice, remove all even faces. Expected sum of the dice left?
**A:** Keep odds {1,3,5}: expect 100 kept, each averaging 3. Total = 300.

#### Verbatim
You roll 200 dice, then remove all even numbers. Expected value of the sum of the dice left?

Expect 100 kept dice, each averaging 3. Expected total = 300.

**Correct Answer: 300**

---

### EV61 — Sum Two Dice
**Company:** Mako, SIG · **Difficulty:** Easy · **Concept:** Enumerate outcomes

#### Condensed
**Q:** Roll two dice. P(sum = 7)?
**A:** 6/36 = **1/6 ≈ 0.167**.

#### Verbatim
You roll two dice. What is the probability that they sum to exactly seven?

6 of 36 outcomes sum to 7. Probability = 1/6.

**Correct Answer: 0.167**

---

## Family: First-step recursion (continued)

### EV62 — Sum Until Success
**Company:** Citadel Securities, IMC, Jane Street, Maven, SIG, DRW · **Difficulty:** Easy · **Concept:** First-step recursion on a running sum

#### Condensed
**Q:** Roll a die until it shows > 4 (a 5 or 6); paid the sum of all rolls. Expected sum?
**A:** S = (2/3)(2.5+S) + (1/3)(5.5) → (1/3)S = 3.5 → **S = 10.5**.

#### Verbatim
You roll a die until it yields a number greater than 4. Expected sum of all the rolls?

S = q(2.5 + S) + p(5.5), p=1/3, q=2/3. (1/3)S = 3.5 → S = 10.5.

**Correct Answer: 10.5**

---

## Family: Recursion (2-outcome blocks)

### EV63 — Tennis Tournament
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Recursion on 2-game blocks; deuce structure

#### Condensed
**Q:** Play until one leads by 2 games; each game Elaine wins w.p. 0.6. P(Bob wins tournament)?
**A:** P(Bob) = 0.16 + 0.48·P(Bob) → P = 4/13 ≈ **0.308**.

#### Verbatim
Elaine and Bob play until one leads by exactly 2 games. Each game Elaine wins w.p. 0.6. P(Bob wins)? (3 d.p.)

Per 2-game block: Elaine both 0.36, Bob both 0.16, split 0.48 (reset). P(Bob) = 0.16/0.52 = 4/13 ≈ 0.308.

**Correct Answer: 0.308**

---

## Family: Conditional expectation (continued)

### EV64 — The Highest Face
**Company:** SIG, DRW · **Difficulty:** Medium · **Concept:** Conditional EV over first roll

#### Condensed
**Q:** Roll a die twice; paid the higher value IF the two rolls differ, else 0. Expected payoff?
**A:** E = (1/6)(140/6) = 140/36 = 35/9 ≈ **3.89**.

#### Verbatim
You roll a fair die twice and get paid the face value of the highest die if the two outcomes differ; if equal, you get 0. Expected payoff?

Condition on first roll; conditional EVs 20,20,21,23,26,30 over 6. E = 140/36 = 35/9 ≈ 3.89.

**Correct Answer: 3.89**

---

## Family: Geometric / negative binomial

### EV65 — Third Six
**Company:** SIG · **Difficulty:** Easy · **Concept:** Sum of geometrics (negative binomial mean)

#### Condensed
**Q:** Roll a die until the third six. Expected number of rolls?
**A:** N = T₁+T₂+T₃, each mean 6. E[N] = **18**.

#### Verbatim
A fair die is rolled repeatedly. Expected number of rolls to see a six for the third time?

Each Tᵢ geometric, mean 6. E[N] = 6+6+6 = 18.

**Correct Answer: 18**

---

## Family: Geometric sum

### EV66 — Three Blue Orbs
**Company:** Citadel Securities, SIG · **Difficulty:** Medium · **Concept:** Sum of geometrics with changing p

#### Condensed
**Q:** Urn: 2 red, 1 blue. Each draw pick an orb at random, replace it with blue. Expected draws until all blue?
**A:** 3/2 + 3 = **9/2 = 4.5**.

#### Verbatim
Urn with 2 red and 1 blue orb. Each draw: pick an orb at random, replace it with a blue orb. Expected draws until all orbs are blue?

Step 1: P(red) = 2/3, expected 3/2. Step 2: P = 1/3, expected 3. Total = 4.5.

**Correct Answer: 4.5**

---

## Family: Geometric / first-step recursion (Throw a 6 series)

### EV67 — Throw a 6 #1
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Geometric mean

#### Condensed
**Q:** Expected number of rolls to see the first six?
**A:** Geometric, p=1/6 → E = **6**.

#### Verbatim
Expected number of throws to see the first six?

Geometric with p=1/6, E = 1/p = 6.

**Correct Answer: 6**

---

### EV68 — Throw a 6 #2
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** First-step recursion for two-in-a-row

#### Condensed
**Q:** Expected rolls to get two sixes in a row?
**A:** E = 6 + (1/6)·1 + (5/6)(1+E) → (1/6)E = 7 → **E = 42**.

#### Verbatim
Expected number of die rolls to get two sixes in a row?

E = 7 + (5/6)E → (1/6)E = 7 → E = 42.

**Correct Answer: 42**

---

### EV69 — Throw a 6 #3
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Hard · **Concept:** Two-state first-step recursion (5 after a 6)

#### Condensed
**Q:** Expected rolls to get a five immediately after a six?
**A:** E[X₆] = 6/5 + (4/5)E[X]; substitute → **E[X] = 36**.

#### Verbatim
Expected number of die rolls to get a five immediately after a six?

E[X] = (5/6)(1+E[X]) + (1/6)(1+E[X₆]); E[X₆] = 6/5 + (4/5)E[X]. Solving → E[X] = 36.

**Correct Answer: 36**

---

### EV70 — Throw a 6 #4
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** First-step recursion with parity constraint

#### Condensed
**Q:** Roll a die; a six only counts if it lands on an even-numbered roll. Expected rolls to succeed?
**A:** E = (1/6)·2 + (5/6)(2 + E) → (1/6)E = 2 → **E = 12**.

#### Verbatim
Rolling a die aiming for a six, but the game only completes if the six appears on an even-numbered roll. Expected number of rolls?

E[X] = (1/6)·2 + (5/6)(2 + E[X]) → (1/6)E = 2 → E = 12.

**Correct Answer: 12**

---

## Family: Birthday / backward recursion

### EV71 — Throw Until Matched
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Backward recursion over distinct outcomes

#### Condensed
**Q:** Roll a die, recording outcomes; stop when any value repeats. Expected number of rolls?
**A:** Backward recursion Eₙ = (n/6)(1+E_{n+1}) + ((6−n)/6): E₀ ≈ **3.78**.

#### Verbatim
Roll a die, recording outcomes; keep rolling until you roll a value for the second time. Expected number of rolls?

E₆ = 1. Eₙ = (n/6)(1+E_{n+1}) + ((6−n)/6). E₀ = 1 + E₁ ≈ 3.775.

**Correct Answer: 3.78**

---

## Family: Coupon collector / linearity (Toy Collection)

### EV72 — Toy Collection #1
**Company:** SIG · **Difficulty:** Easy · **Concept:** Coupon collector

#### Condensed
**Q:** 5 distinct toys, one uniform per box. Expected boxes to collect all five?
**A:** E = 1 + 5/4 + 5/3 + 5/2 + 5 = 137/12 ≈ **11.4**.

#### Verbatim
Each cereal box contains one of five distinct toys, uniform and independent. Expected number of boxes to collect all five?

1 + 5/4 + 5/3 + 5/2 + 5/1 = 137/12 ≈ 11.4.

**Correct Answer: 11.4**

---

### EV73 — Toy Collection #2
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Easy · **Concept:** Indicator + linearity (distinct count)

#### Condensed
**Q:** 5 distinct toys, uniform per box. Buy 7 boxes — expected number of distinct toys?
**A:** E = 5·(1 − (4/5)⁷) ≈ **3.95**.

#### Verbatim
Each box has one of 5 distinct toys, uniform. How many distinct toys do you expect from 7 boxes?

E[X] = 5·(1 − (4/5)⁷) ≈ 3.95.

**Correct Answer: 3.95**

---

## Family: Divergent expectation (St. Petersburg type)

### EV74 — Tripling Die
**Company:** Akuna Capital, IMC, SIG, Virtu · **Difficulty:** Medium · **Concept:** Divergent expected value; geometric prize vs probability

#### Condensed
**Q:** Roll a die; 1/2 continues, first 3/4/5/6 stops on roll n and pays 3ⁿ. Fair value? (−1 if infinite.)
**A:** Each term of E = 2 for all n → E = 2+2+2+… = ∞ → answer **−1**. (A doubling prize would give a finite $4.)

#### Verbatim
Roll a die repeatedly; rolling a 1 or 2 continues, the first 3/4/5/6 stops. If it stops on roll n, you're paid 3ⁿ dollars. Fair value? (−1 if infinite.)

P(N=n) = (1/3)^{n−1}·(2/3). Payout 3ⁿ: each term 3·(2/3) = 2. E = 2+2+2+… diverges → −1.

**Correct Answer: -1 (infinite)**

---

## Family: Invariant (parity)

### EV75 — Two at a Time
**Company:** Jane Street, SIG · **Difficulty:** Medium · **Concept:** Parity invariant + optimal play

#### Condensed
**Q:** Toss 6 gold/plain chips; repeatedly flip exactly two at a time. Expected max gold faces under optimal play?
**A:** Parity of gold count invariant. G even → reach 6; G odd → best 5. P(even) = 1/2. E = 6·½ + 5·½ = **5.5**.

#### Verbatim
Six chips (gold/plain faces) tossed; you may turn over exactly two at a time, repeatedly. Expected gold faces at stop under optimal play?

A two-chip move changes gold count by even, so parity invariant. E = 6·½ + 5·½ = 5.5.

**Correct Answer: 5.5**

---

## Family: First-step recursion (state) (continued)

### EV76 — Two Consecutive Fives
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Two-state recursion for two-in-a-row, general p

#### Condensed
**Q:** Expected rolls of a d8 to see two 5's in a row?
**A:** E = (1+p)/p², p=1/8 → **72**. *(Answer computed — source paste had no explicit final number.)*

#### Verbatim
How many rolls of an eight-sided die are needed on average to observe two 5's in a row?

p = 1/8. E₀ = 1/p + 1/p² = (1+p)/p² = (9/8)/(1/64) = 72.

**Correct Answer: 72** *(computed — the working yields 72)*

---

## Family: EV over a distribution (continued)

### EV77 — Two Dice Difference
**Company:** Citadel Securities, Jane Street, Maven, SIG, DRW · **Difficulty:** Easy · **Concept:** EV of |difference|

#### Condensed
**Q:** Roll two dice. Expected absolute difference?
**A:** E = 70/36 = 35/18 ≈ **1.944**.

#### Verbatim
You roll 2 dice. Expected absolute difference between their values?

Counts by |d|: 0→6, 1→10, 2→8, 3→6, 4→4, 5→2. E[|d|] = 70/36 ≈ 1.944.

**Correct Answer: 1.944**

---

## Family: Indicator / relative order (continued)

### EV78 — Two Hues Left
**Company:** Citadel Securities, SIG · **Difficulty:** Hard · **Concept:** Indicator + inclusion-exclusion on relative order

#### Condensed
**Q:** Pouch: 6 crimson, 10 teal, 14 amber. Draw without replacement, stop when one colour is exhausted. Expected beads left?
**A:** E = 6·(97/825) + 10·(17/105) + 14·(229/1309) ≈ **4.77**.

#### Verbatim
A pouch has 6 crimson, 10 teal, 14 amber beads. Draw one at a time without replacement, stopping the instant one colour is gone. Expected number of beads still in the pouch? (2 d.p.)

A bead stays iff at least one other colour is entirely ahead of it (inclusion-exclusion). Crimson: 1/11+1/15−1/25 = 97/825; teal: 17/105; amber: 229/1309.
E[R] = 6·(97/825) + 10·(17/105) + 14·(229/1309) ≈ 4.774.

**Correct Answer: 4.77**

---

### EV79 — Two Rolls Payoff
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Conditional EV over max of two dice

#### Condensed
**Q:** Roll a die twice; paid the higher if they differ, else 0. Expected payoff?
**A:** E = 140/36 ≈ **3.89**. (Same as The Highest Face.)

#### Verbatim
Roll a fair d6 twice; paid the higher roll if they differ, else 0. Expected payoff?

E[P] = (2·2 + 3·4 + 4·6 + 5·8 + 6·10)/36 = 140/36 ≈ 3.89.

**Correct Answer: 3.89**

---

### EV80 — Two Same Dice
**Company:** SIG · **Difficulty:** Easy · **Concept:** Elementary probability (common trap)

#### Condensed
**Q:** Roll one die twice. P(second matches first)?
**A:** **1/6** (not 1/36 — a common wrong answer).

#### Verbatim
You roll one die twice. Probability the second roll has the same value as the first?

The first roll can be anything; the second matches w.p. 1/6. (Not 1/36.)

**Correct Answer: 0.167**

---

## Family: Continuous convolution

### EV81 — Uniform Distribution #1
**Company:** SIG · **Difficulty:** Hard · **Concept:** Sum of two uniforms (triangular density); E via pdf

#### Condensed
**Q:** X, Y ~ Uniform(0,1) independent, Z = X+Y. E[Z] (via pdfs)?
**A:** Triangular density; ∫₀² z·f_Z(z) dz = **1**.

#### Verbatim
X ~ Uniform(0,1), Y ~ Uniform(0,1), Z = X + Y. Find E[Z] using probability density functions.

f_Z(z) = z on [0,1], 2−z on [1,2]. E[Z] = ∫₀¹ z² dz + ∫₁² (2z − z²) dz = 1/3 + 2/3 = 1.

**Correct Answer: 1**

---

## Family: Conditional indicator (continued)

### EV82 — Up Days
**Company:** Da Vinci, SIG · **Difficulty:** Easy · **Concept:** Conditional linearity of expectation

#### Condensed
**Q:** 7 days, each up/down w.p. ½ independently. Given day 1 and day 7 moved oppositely, expected number of up days?
**A:** Endpoints contribute 1; middle 5 each ½. E = 1 + 5·½ = **3.5**.

#### Verbatim
A stock closes up or down each day, w.p. ½, over 7 days. Given that day 1 and day 7 moved in opposite directions, expected number of up days?

The condition fixes X₁+X₇ = 1. Days 2–6 independent, each ½. E[N|A] = 1 + 5·½ = 3.5.

**Correct Answer: 3.5**

---

## Family: Optimal stopping (continuous) (continued)

### EV83 — Voucher Swap
**Company:** SIG · **Difficulty:** Easy · **Concept:** Optimal stopping, uniform; conditional expectation

#### Condensed
**Q:** Voucher ~ Uniform($0,$200); cash it or shred and take one fresh mandatory draw. Expected payout, optimal play?
**A:** Keep iff v≥100. E = ½·100 + ½·150 = **125**.

#### Verbatim
A machine prints a voucher ~ Uniform($0,$200). After seeing it you may cash in, or shred and take one fresh mandatory voucher. Expected payout, optimal play?

Keep iff v ≥ 100. E = ½·100 + ½·E[V|V≥100] = ½·100 + ½·150 = 125.

**Correct Answer: 125**

---

## Family: Indicator / linearity (continued)

### EV84 — Warming Spells
**Company:** SIG, Virtu · **Difficulty:** Medium · **Concept:** Indicator over overlapping windows; find n

#### Condensed
**Q:** n IID continuous readings; a "warming spell" starts on day i if 5 consecutive strictly increase. Find n so E[spells] = 2.
**A:** E = (n−4)/120 = 2 → **n = 244**.

#### Verbatim
n IID continuous readings. A warming spell starts on day i if Tᵢ<T_{i+1}<T_{i+2}<T_{i+3}<T_{i+4}. Find n for which the expected number of spells is exactly 2.

n−4 windows, each strictly increasing w.p. 1/120. (n−4)/120 = 2 → n = 244.

**Correct Answer: n = 244**

---

## Family: Divergent expectation (continued)

### EV85 — Widening Wheel
**Company:** SIG · **Difficulty:** Hard · **Concept:** Tail-sum expectation; divergent harmonic series

#### Condensed
**Q:** Night n the wheel has n+4 sectors, one jackpot (P=1/(n+4)). Milo spins once/night; W = night of first jackpot. E[W]? (−1 if infinite.)
**A:** P(W>n) = 4/(n+4). E[W] = Σ 4/(n+4) diverges → **−1 (infinite)**.

#### Verbatim
On night n the jackpot wheel has n+4 equal sectors, one jackpot, so P(win) = 1/(n+4). Milo spins once each night; W = number of nights up to and including his first jackpot. E[W]? (−1 if infinite.)

P(W>n) = 4/(n+4). E[W] = Σ_{n≥0} 4/(n+4) = harmonic series, diverges → −1.
(P(W=n) sums to 1 — he wins w.p. 1 — but the mean is infinite.)

**Correct Answer: -1 (infinite)**

---

*Last updated: 2026-07-21.*
