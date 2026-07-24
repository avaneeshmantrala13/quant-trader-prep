# Quant Question Bank — Probability & Statistics → Game Puzzle

> **Handoff note for [coworker] + the SLM training pipeline.** Third completed subcategory (**Game Puzzle**) of the **Probability and Statistics** category. Same format as the earlier handoffs, with the subcategory-specific notes below.

## How to read this document

**What this is.** 4 betting/odds puzzles in the *Game Puzzle* subcategory under the *Probability and Statistics* category.

**Structure.** Not a single repeating formula. Grouped by **family** (the solving method): arbitrage & value betting, parimutuel / betting against opponents, and probability optimization. Each question carries **Company** tag(s), a **Difficulty**, a **Concept**, and two forms:
- **Condensed** — one-line question + compact worked answer (same numbers/logic).
- **Verbatim** — exact question text + full worked solution as it appeared on the source platform.

**Company tags — note MULTIPLE tags per question.** Unlike earlier subcategories, several of these puzzles are used by more than one firm, so the Company field can list more than one:
- Beat the Odds → Citadel Securities
- Tennis Odds → Citadel Securities, Jane Street
- Parimutuel Betting → Citadel Securities
- Rig the Bags → Akuna Capital, Citadel Securities, Flow Traders

Do not collapse a multi-tag question to one firm, and do not synthesize a company where none is listed.

**Answer types — mostly open-ended, ONE exact.** Three of the four are **open-ended** (many valid allocations; the skill is spotting the arbitrage / value edge and constructing a profitable book):
- Beat the Odds, Tennis Odds → arbitrage; the "answer" is the *strategy* + a representative winning allocation, not a unique vector.
- Parimutuel Betting → bet against known opponents; many valid spreads.

Only **Rig the Bags** has a single exact scalar answer (**0.74**), suitable for verifier-checked RL. **For the three open-ended ones, route as long-form reasoning / SFT targets, NOT verifiable-reward RL** — there is no unique scalar to grade (they have "many wrong answers but no single right one").

**Concepts covered:** implied probability from odds, sub-100% overround → arbitrage, cross-bookmaker arbitrage, expected-payout vs true-probability value betting, parimutuel pot-splitting against known bets, and the law of total probability for staged experiments.

---

# Probability and Statistics — Game Puzzle

> **Note on this subcategory.** These are betting/odds puzzles. Three are **arbitrage or value-betting** problems (spot mispriced odds and construct a profitable book); two of those have **open-ended answers** (many valid allocations, the skill is the reasoning), and the discipline is comparing implied probability / expected payout against the true probability. One is a **parimutuel** problem (bet against known opponents), also open-ended. One is a clean **probability-optimization** problem with a single exact answer (Rig the Bags = 0.74). Several questions carry **multiple company tags** (the same puzzle is used by more than one firm).

## Game Puzzle — index of questions

| Question | Family | Company | Difficulty | Answer |
|---|---|---|---|---|
| Beat the Odds | Arbitrage / value betting | Citadel Securities | Hard | no single answer (arb: full budget on Match 1) |
| Tennis Odds | Arbitrage (cross-book) | Citadel Securities, Jane Street | Hard | no single answer (arb: ~€78 Nadal@A, ~€22 Federer@B) |
| Parimutuel Betting | Bet against opponents | Citadel Securities | Medium | no single answer (spread to empty/thin teams) |
| Rig the Bags | Probability optimization | Akuna Capital, Citadel Securities, Flow Traders | Easy | 0.74 |

---

## Family: Arbitrage & value betting

*Method: convert each quoted odds to an implied probability (or expected payout); if a set of mutually-exclusive outcomes has implied probabilities summing below 100%, an arbitrage exists — stake inversely to the odds so every outcome pays more than the total staked. If no pure arb, bet where expected payout (true prob × payout) exceeds 1.*

### GP1 — Beat the Odds
**Company:** Citadel Securities · **Difficulty:** Hard · **Concept:** Arbitrage / value betting; expected payout vs implied odds

#### Condensed
**Q:** Split €100 across Team A (7:4), B (2:3), C (1:4), D (3:1) + unbet. P(A win)=40%, P(C win)=70%. Whole-number bets summing to 100.
**A:** Match 1 is a locked arb: A payout 2.75, B payout 1.67. Need ≥100/2.75=36.36 on A and ≥100/1.67=60 on B; e.g. **€38 on A (pays €104.50), €62 on B (pays €103.33)** — full budget on Match 1, guaranteed win regardless of outcome. (Alt value-bet view: A and D overpay vs true odds, C underpays; e.g. €73 D / €27 A. No single correct answer.)

#### Verbatim
You're given the opportunity to make money by betting a total of €100 on the outcome of two, simultaneous matches.
- Match 1 is between team A and team B
- Match 2 is between team C and team D

Furthermore,
- Team A's probability of winning is 40%
- Team C's probability of winning is 70%

The bookmaker gives you the following betting odds:
- Team A - 7:4
- Team B - 2:3
- Team C - 1:4
- Team D - 3:1

How much money do you bet on each team? You do not have to bet all €100, but your bets must be whole numbers and the total of all five blanks (bets on the four teams and the unbet amount) must sum to €100. There is no single "correct" answer, but there are many "wrong" answers.

Note: a hypothetical team having 2:7 odds means that if you bet €7 on that team and they win, you get your €7 bet back and win an additional €2. If that team loses, you lose your €7.

Team A bet: ______ / Team B bet: ______ / Team C bet: ______ / Team D bet: ______ / Unbet amount: ______

**Answer with guaranteed profit.** The following approach results in finding an arbitrage opportunity.

Match 1:
- Team A has a payout at success of (7+4)/4 = 2.75. The probability of winning is 40%, so the expected value of the payout is 0.4*2.75 = 1.1 (110%, so you're expected to win money).
- Team B has a payout at success of (2+3)/3 = 1.67. The probability of winning is 60% (= 100% − 40%), so the expected value is 0.6*1.67 = 1 (100%, break-even).

Match 2:
- Team C has a payout at success of (1+4)/4 = 1.25. Probability 70%, so expected value 0.7*1.25 = 0.875 (87.5%, expected to lose).
- Team D has a payout at success of (3+1)/1 = 4.00. Probability 30% (= 100% − 70%), so expected value 0.3*4.00 = 1.2 (120%, expected to win).

In match 1, the expected payout for both options is 100% or higher, which gives us the suspicion that there is an arbitrage opportunity. To get a payout of at least €100 in this game, we need to bet at least:
- 100/2.75 = 36.36 on Team A
- 100/1.67 = 60.00 on Team B

These numbers don't sum up to 100, so we're able to bet more on them, for example:
- If we bet €38 on Team A, our payout is €104.50.
- If we bet €62 on Team B, our payout is €103.33.

In other words, we can use our full budget of €100 on Match 1 only, and always win.

**Alternative Approach.** You can also compare the odds with the probability of winning.

Match 1:
- Team A — Probability 40% — ratio of probabilities 60/40 = 1.5 (150%)
- Team B — Probability 60% — ratio 40/60 = 0.67 (67%)

Deduct the payout ratio from the probability ratio:
- Team A payout ratio 7/4 = 175%. 175 − 150 = 25%, positive → A's payout is high proportionally to its true odds.
- Team B payout ratio 2/3 = 67%. 67 − 67 = 0% → fairly priced.

Match 2:
- Team C — Probability 70% — ratio 30/70 = 0.43 (43%)
- Team D — Probability 30% — ratio 70/30 = 2.33 (233%)

Deduct:
- Team C payout ratio 1/4 = 25%. 25 − 43 = −18%, negative → underpays.
- Team D payout ratio 3/1 = 300%. 300 − 233 = 67%, positive → overpays.

From this approach it seems attractive to bet on Team A or D, since those odds overpay compared to their actual odds of winning. Betting on Team C is a bad idea. You can split over A and D by the ratio of overpaying: 0.67/0.25 = 2.67, roughly 73/27. So bet €73 on Team D and €27 on Team A.

**Correct Answer: no single answer** — the clean arbitrage is to put the full €100 on Match 1 (e.g. €38 A / €62 B) for a guaranteed win.

---

### GP2 — Tennis Odds
**Company:** Citadel Securities, Jane Street · **Difficulty:** Hard · **Concept:** Cross-bookmaker arbitrage via implied probability

#### Condensed
**Q:** €100 on Nadal vs Federer. Company A: Nadal 1.29, Federer 4. Company B: Nadal 1.2, Federer 4.7. Strategy?
**A:** Implied probs sum >100% within each book (A: 1.03, B: 1.05 → no arb). But cross-book **Nadal@A (1.29) + Federer@B (4.7)**: 1/1.29 + 1/4.7 = 0.99 < 100% → arbitrage. Stake ~ratio 78:22 → **€78 Nadal@A (pays €100.62), €22 Federer@B (pays €103.40)** — guaranteed win either outcome.

#### Verbatim
The Wimbledon final between Nadal and Federer is about to begin! You want to spend your full budget of €100 on bets for this game. There are two different companies with their own payout ratios per player.

Company A payout: Nadal 1.29, Federer 4.
Company B payout: Nadal 1.2, Federer 4.7.

What will your betting strategy be, and why?

First, calculate the implied probability for both players per company. If their sum is below 100%, there is an arbitrage opportunity.
- Company A: 1/1.29 + 1/4 = 1.03 (103%). No arbitrage.
- Company B: 1/1.2 + 1/4.7 = 1.05 (105%). No arbitrage.

However, what if we combine the odds from both firms?
- Federer (Company A) & Nadal (Company B): 1/4 + 1/1.2 = 1.08 (108%). No arbitrage.
- Nadal (Company A) & Federer (Company B): 1/1.29 + 1/4.7 = 0.99 (99%). Arbitrage opportunity!

So, focus on Nadal (Company A) & Federer (Company B). The odds (Nadal 1.29 and Federer 4.7) have a ratio approximately equal to 21 vs 78. To let these values sum to 100, make it 22 vs 78. Check:
- Nadal: 78 × 1.29 = €100.62
- Federer: 22 × 4.7 = €103.40

Yes — we found an opportunity to always win, regardless of the outcome of the game!

**Correct Answer: no single answer** — cross-book arb: ~€78 on Nadal @ Company A, ~€22 on Federer @ Company B, guaranteed profit.

---

## Family: Parimutuel / betting against opponents

*Method: no bookmaker odds — the payout depends only on how the pot is split against known opponent bets. Bet into empty or thin teams (where you'd own most of the pot if they win) and cover the popular teams lightly to cap downside.*

### GP3 — Parimutuel Betting
**Company:** Citadel Securities · **Difficulty:** Medium · **Concept:** Parimutuel pot-splitting against known opponents

#### Condensed
**Q:** You + John + Jane each bet €100 (pot €300), winner-backers split pro-rata. John/Jane bets — Wisconsin: J55/Jn45; Utah: J45/Jn50; Ohio State: 0/0; Washington St: 0/Jn5. Allocate your €100.
**A:** Exploit empty/thin teams: **€1 Ohio State** (nobody else → win all €300), **€3 Washington St** (3/8 × 300 = €112.50), split remaining €96 across the crowded Wisconsin/Utah (~€47/€49) for ~€100 back if either wins. Caps downside, big upside. No single answer.

#### Verbatim
You, John, and Jane each have €100 to use to bet on the different teams. The payout will be based on "parimutuel betting". You all put your money in the pot, and whoever bet on the winning team wins the pot. If multiple people bet on the winner, the pot pays out pro-rata. (So if John and Jane bet €50 on the winner and you did not, John and Jane each receive €150 and you receive nothing — they receive 50/50 of the €300 pot.)

John and Jane have allocated their €100 as follows:

| Team | John | Jane |
|---|---|---|
| Wisconsin | €55 | €45 |
| Utah | €45 | €50 |
| Ohio State | €0 | €0 |
| Washington State | €0 | €5 |

Given this information, how much do you bet on each team? Bets must be whole numbers and add up to €100.
Wisconsin: ______ / Utah: ______ / Ohio State: ______ / Washington: ______

The bets from the other two players are the only information we have. Fill in the numbers with a strategic approach; our goal is to make more than €100.
- Nobody has bet on Ohio State, so allocate €1 here to potentially win all €300 if Ohio State wins.
- There is barely any bet on Washington State, just €5 from Jane. If you bet €3 yourself, you get 3/(3+5) × 300 = €112.50 if Washington State wins.
- You have now spent €4 on two teams, so you have €96 left. Divide the remaining amount equally between Wisconsin and Utah (or 47/49), giving a payout very close to €100 if either wins.

This way you minimise the odds of losing money — downside limited, upside substantial.

**Correct Answer: no single answer** — e.g. Ohio State €1, Washington €3, Wisconsin ~€47, Utah ~€49.

---

## Family: Probability optimization

*Method: law of total probability over the stages; choose the free structural parameter (here, the token split) to maximize the win probability.*

### GP4 — Rig the Bags
**Company:** Akuna Capital, Citadel Securities, Flow Traders · **Difficulty:** Easy · **Concept:** Law of total probability, optimization

#### Condensed
**Q:** 13 gold + 13 black tokens into 2 bags (each ≥1 token). Pick a bag at random, draw a token at random; gold wins. Max win probability?
**A:** P(win) = ½·f₁ + ½·f₂ (average of gold-fractions). Put **1 gold alone in bag 1** (f₁=1), the other 25 tokens in bag 2 (f₂=12/25). P(win) = ½·1 + ½·(12/25) = 37/50 = **0.74**.

#### Verbatim
You are the final contestant on a TV game show. The host puts 13 gold tokens, 13 black tokens, and two identical velvet bags in front of you. You may distribute all 26 tokens between the two bags in any way you like, as long as each bag ends up holding at least one token. The bags are then shuffled while you are blindfolded, you grab one of the two bags at random, and you draw a single token from it at random. If you draw a gold token, you win the grand prize; if you draw a black token, you leave with nothing.

If you distribute the tokens optimally, what is your probability of winning the grand prize?

The tool this needs is the law of total probability. When a random experiment happens in stages, you compute P(A) by conditioning on the first stage. If the first stage has outcomes B₁…Bₙ, exactly one of which occurs, then P(A) = Σ P(A | Bᵢ) P(Bᵢ) — the overall probability is the weighted average of conditional probabilities. (Example: a fair coin sending you to a game you win w.p. 0.8 or one you win w.p. 0.4 gives ½·0.8 + ½·0.4 = 0.6.)

Translate the game. The first stage is which bag you grab — each with probability ½. Write f₁ for the fraction of tokens in bag 1 that are gold, f₂ the same for bag 2 (both well defined since each bag holds ≥1 token). Once you grab a bag, every token is equally likely, so your winning probability from that bag is its gold fraction. The law of total probability gives:
P(win) = ½·f₁ + ½·f₂

So your chance is the average of the two bags' gold fractions; maximize it.

Obvious splits first:
- **Mirror split** (6G6B and 7G7B): f₁ = f₂ = ½ → P(win) = ½, no better than a coin flip.
- **Full separation** (13 gold in bag 1, 13 black in bag 2): f₁ = 1, f₂ = 0 → P(win) = ½ again.

The second attempt has the seed of the answer: f₁ = 1 does not require 13 gold tokens — a bag with a single gold token has gold fraction 1/1 = 1.

So put exactly one gold token alone in bag 1, and everything else — 12 gold + 13 black = 25 tokens — in bag 2. Then f₁ = 1 and f₂ = 12/25 (barely below ½). The winning probability:
P(win) = ½·1 + ½·(12/25) = 25/50 + 12/50 = 37/50 = 0.74

Half the time you grab the lone-token bag and win for sure; the other half you still win almost half the time.

**Correct Answer: 0.74**

---

*Last updated: 2026-07-21.*
