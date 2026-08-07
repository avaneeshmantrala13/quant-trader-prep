# QA Audit — Market-Making & Trading Games

**Scope:** `src/lib/games/**` (engines + tests), `src/content/games/**` (scenarios),
`src/content/interviewGames/{levels,generators}.ts`, `src/content/auctions/{levels,generators}.ts`,
plus the hint-ladder / ZPD engine (`remediation/policy.ts`, `content/remediation/prereqDAG.ts`, `roadmap/skillGraph.ts`).

**Type of audit:** READ-ONLY. Nothing under `src/**` was modified. Findings are backed by a
Monte-Carlo good-vs-bad-play simulation (temp harness, since deleted) that drives each engine's
own counterparty/settlement code over thousands of seeds.

**Method:**
- Read every engine + its tests, and the page components that render the feedback/coaching loop.
- Built a seeded Monte-Carlo (`vitest.qa.config.ts` + `datasets/qa-audit/temp/sim.test.ts`, both temp,
  now deleted) that plays each game with a *skilled* policy and several *bad* policies and reports the
  P&L distribution (mean / median / p5 / p95 / win-rate) straight out of each engine.
- All 224 existing game/arbitrage unit tests pass (`vitest run src/lib/games src/content/arbitrage src/content/games`).

**Scoring key:** each score is out of 10. *Coaching accuracy* = is the post-round feedback correct about
**why** you won/lost. *Thoroughness* = is the explanation complete/coherent (no cut-offs) and does it teach
the right lesson. *Next-step* = does the game point you at an appropriate next challenge/concept.

---

## TL;DR verdict table

| Game | Role | Winnable (good play) | Bad play punished? | Coaching acc. | Thorough. | Next-step |
|---|---|---|---|---|---|---|
| Make Me a Market | Maker | ✅ only w/ near-perfect valuation | ⚠️ offside yes, wide **no**, est-error **no** | 8 | 8 | 3 |
| Market of Cards | Maker | ✅ | ❌ mis-pricing **unpunished** | 4 | 5 | 3 |
| Cards Market Making | Taker | ✅ | ✅ | 9 | 7 | 3 |
| Dice & Cards | Taker | ✅ (very noisy) | ✅ | 8 | 7 | 3 |
| Fruit Market | Taker | ✅ | ✅ | 8 | 6 | 3 |
| Next Card Betting | Bettor | ✅ | ✅ | 8 | 7 | 3 |
| Probability Betting | Bettor | ✅ | ⚠️ blind bet-all ≈ break-even | 8 | 8 | 3 |
| Arbitrage & De-vig | Quiz drill | ✅ (by construction) | n/a (knowledge drill) | 9 | 6 | 3 |

**Games with real problems:** **Market of Cards** (mis-pricing unpunished — fails its own core skill) and
**Make Me a Market** (winnable only in a razor-thin valuation band; realistic estimate error is net-negative).
Everything else is fair and winnable; the shared weakness is **next-step** (every game ends on "Play again").

---

## Simulation results (raw)

Per-round or per-game P&L (currency units of each game), seeded Monte-Carlo through the engines' own code.

### Make Me a Market — full game (1 interval + 5 tight rounds), N=4000
| Strategy | mean | median | p5 | p95 | win-rate |
|---|---|---|---|---|---|
| **good** (mid = truth, spread ≈ 0.4·cap, size 3) | **+209.8** | +12 | 0 | +1500 | **74.4%** |
| goodErr (±10% valuation error, tight) | **−135.9** | −2.5 | −1510 | +800 | 40.1% |
| goodErrWide (±10% error, spread 0.8·cap) | **−183.5** | 0 | −422 | +39 | 12.9% |
| wide (spread 0.95·cap, centred) | +5.7 | 0 | 0 | 0 | 1.1% |
| offside (mid off by ≈ 1 whole cap) | **−1957.6** | −188 | −13400 | −22 | 0.9% |
| chase (offside + size 10) | −885.7 | −80 | −8000 | +19 | 7.1% |

### Market of Cards — 3 bots, 4 rounds, N=4000
| Strategy | mean | median | p5 | p95 | win-rate | avg \|net\| | two-sided |
|---|---|---|---|---|---|---|---|
| **good** (mid = playerEV, spread 8, both sides) | +25.9 | **+72** | −342 | +297 | **74.4%** | 0.66 | 100% |
| offside (+40 off centre, both sides) | +21.0 | **+72** | −371 | +289 | 73.8% | 0.68 | 100% |
| offsideBig (+150 off centre, both sides) | −34.8 | **+64** | −555 | +235 | **66.7%** | 0.73 | 100% |
| wide (spread 20, both sides) | +13.4 | +66 | −522 | +364 | 64.6% | 1.03 | 95% |
| onesided (only show an offer) | +84.8 | −12 | −2664 | +3140 | 49.6% | **8.97** | 0% |

### Taker / bettor games (per-round unless noted)
| Game / policy | mean | median | p5 | p95 | win-rate |
|---|---|---|---|---|---|
| Cards MM — edge | **+1.00** | 0 | −7 | +11 | 31.9% |
| Cards MM — always-buy | −1.61 | −2 | −13 | +10 | 38.1% |
| Cards MM — anti-edge | −2.59 | 0 | −14 | +4 | 11.9% |
| Dice&Cards — edge | **+1.46** | 0 | −160 | +166 | 26.8% |
| Dice&Cards — always-buy | −7.83 | −69 | −169 | +361 | 34.3% |
| Dice&Cards — anti-edge | −8.71 | 0 | −180 | +146 | 23.7% |
| Fruit — correct (score) | **+0.81** | 0 | 0 | +3 | 45.1% |
| Fruit — wrong-direction (score) | −0.81 | 0 | −3 | 0 | 0% |
| Fruit — always-buy (score) | −0.14 | 0 | −3 | +2 | 19.9% |
| NextCard — Kelly (% of bankroll/bet) | **+28.8%** | +40% | −56% | +88% | 68.8% |
| NextCard — flat on best side | +4.5% | +10% | −10% | +10% | 72.5% |
| NextCard — flat on worst (<50%) side | −5.7% | −10% | −10% | +10% | 21.3% |
| ProbBet — Kelly on +edge | **+14.8** | 0 | −171 | +238 | 49.1% |
| ProbBet — flat on −edge events | −13.4 | −48 | −200 | +262 | 35.0% |
| ProbBet — flat-bet everything | +2.6 | −48 | −300 | +430 | 41.7% |

---

## Per-game findings

### 1. Make Me a Market (`src/lib/games/makeMarket`) — Maker, Core
**Winnable?** Yes, but only in a narrow band. A quote centred on the truth earns **+$210 mean / +$12 median,
74% win**. Bad play is punished *hard* the right way: an off-centre market bleeds **−$1958 mean (0.9% win)**,
and chasing with size on an offside quote **−$886**.

**Fairness defects:**
- **(F1) Winnable band is razor-thin vs. the task difficulty.** The tight-round noise model earns on
  `NOISE_BASE · tightness²` (quadratic in tightness, `engine.ts:217-218`), so earning peaks around a
  *half-cap* spread, while `INFORMED_RATE = 0.7` (`engine.ts:143`) picks you off whenever the truth sits
  outside your market. With the scenario `suggestedMaxSpread ≈ 25%` of the answer
  (`makeMarketScenarios.ts:82-84`) and a ~0.4·cap spread, your half-spread is ≈ 5% of the value — so you must
  value the item to **within ~5%** or you get picked off. But the scenarios are **Fermi guesstimates**
  (piano tuners, water bottles, airport pax). Simulating a competent player with only **±10% valuation error**
  gives **−$136 mean quoting tight** and **−$183 mean quoting wide** — *net-negative either way* (tight → picked
  off; wide → earns ≈ 0 but still tail-picked). So the game is realistically winnable only for someone who
  already knows the answer to ~5%.
- **(F2) A stupid-wide spread is never punished, only sterilised.** Quoting 0.95·cap yields **+$5.7 mean, and
  it literally never loses money** (min 0). That's opportunity-cost, not a penalty — a beginner who "quotes
  huge to stay safe" is never taught that it's wrong by the P&L.
- **(F3) No winnability Monte-Carlo test.** Unlike the five taker/bettor games, `makeMarket/` has only
  `engine.test.ts`; the fragile EV surface above is unguarded by any regression test.

**Coaching accuracy: 8/10.** `coachAfterRound` (`engine.ts:468-525`) is genuinely good: it separates *noise
that paid your spread* ("You earned the spread", `:484-489`) from an *informed pick-off* ("your mid is too
low/high — skew the whole market", `:495-514`) and correctly says *recentre, don't add size into an offside
quote*. This matches the mechanics. Deduction: for a Fermi scenario the advice to "keep your spread tight but
centred" is not actually executable to a win (see F1), and the coach never tells an *uncertain* player the one
honest move — widen — because the engine would then pay them ≈ 0. So the correct-in-mechanics advice is subtly
un-actionable given the content.

**Thoroughness: 8/10.** Coach strings are complete (no cut-offs); the summary screen
(`MakeMarketPage.tsx:864-880`) shows the full scenario decomposition + anchor (real valuation teaching), and
the quiz drills signed position → max-guaranteed-loss → exact break-even. Missing: any coaching on *sizing your
spread to your own uncertainty* (the actual lesson F1 exposes).

**Next-step: 3/10.** Summary offers only "Play again" (`MakeMarketPage.tsx:882-886`). No pointer to a follow-on
game/skill; the only progression signal is the static difficulty tag in the Games hub.

### 2. Market of Cards (`src/lib/games/marketOfCards`) — Maker, Advanced
**Winnable?** Yes — good centred two-sided play earns **+$26 mean / +$72 median, 74% win**, and the book stays
flat (avg |net| 0.66).

**Fairness defects (the headline problem of this audit):**
- **(F4) Mis-pricing is essentially unpunished — the game does not test its own advertised skill.** The noise
  model fills *both* sides in matched size each arrival (`engine.ts:334-364`), so a symmetric quote stays flat
  and every matched pair banks exactly `ask − bid` **regardless of where you centred it**
  (mark-to-true of a matched pair = `(true−bid)+(ask−true) = spread`). Simulation confirms: quoting **+40
  off-centre is statistically identical to perfect** (+$21 vs +$26 mean, both +$72 median, ~74% win), and even
  a wild **+150 off-centre still wins the median round (+$64, 67% win)**. The catalog sells this game as
  "Price the signed table total from just your two cards" (`catalog.ts:112`), but pricing accuracy earns you
  almost nothing. Informed pick-offs that *should* punish bad pricing are throttled to `INFORMED_RATE = 0.15`
  and `INFORMED_MAX_LOTS = 1` (`engine.ts:271-273`) — far too weak to matter.
- **(F5) One-way risk is only a variance penalty, not an EV penalty.** Showing a single side earns the
  *highest mean* of all strategies (**+$85**) because you still collect the half-spread on every fill — but with
  huge variance (p5 −$2664, p95 +$3140, avg |net| ≈ 9). The "risk-manager" lesson therefore only lands via the
  occasional blow-up, not via expected P&L, and a lucky one-sided player is *rewarded*.
- **(F6) No winnability Monte-Carlo test** (same gap as F3).

**Coaching accuracy: 4/10.** The *entire* post-game feedback about "why" is a binary chip:
`✓ Two-sided trading: risk-manager pass` / `✕ One-way risk` (`MarketOfCardsPage.tsx:727-731`). It is correct
that two-sided beats one-sided on *risk*, but it is **misleading**: a player who quoted 150 off-centre and won
is told they "passed", and the game never once tells you whether your **mid/price** was right (it can't — see
F4). There is no per-round coaching and no mention of adverse selection or EV updating on reveals.

**Thoroughness: 5/10.** Settlement is transparent (position, max-guaranteed-loss, break-even, full hand reveal —
`MarketOfCardsPage.tsx:735-764`) and complete/no cut-offs, but there is zero narrative teaching of the pricing
skill the game claims to train, and no between-round feedback while the reveals are happening.

**Next-step: 3/10.** "Play again" only (`:766-768`).

### 3. Cards Market Making (`src/lib/games/cardsMarketMaking`) — Taker, Core
**Winnable?** Yes and fair. Trading only the EV-correct side: **+$1.0/lot mean**; always-buy **−$1.6**;
anti-edge **−$2.6**. Good > 0 > bad, monotonically. Matches the game's own `winnability.test.ts`.

**Coaching accuracy: 9/10.** The per-round `Verdict` (`CardsMarketMakingPage.tsx:756-776`) states the exact
EV-correct action and per-lot edge ("Edge was to buy (3/lot). You passed.") and explains the asymmetric score
("Missed a loss → penalty doubled"). Directly derived from correct engine math (`analyzeEdge`, `scoreRound`).

**Thoroughness: 7/10.** Verdict + round-review table, complete but terse — states the edge number without much
"here's the intuition."

**Next-step: 3/10.** Review + play again.

**Defects:** none material. The single-lot per-round edge is small relative to card-sum variance, so one session
is a weak skill signal — but EV is correct and the asymmetric-loss scoring is a nice, correct twist.

### 4. Dice & Cards (`src/lib/games/diceAndCards`) — Taker, Advanced
**Winnable?** Yes: edge-only **+$1.46 mean**, always-buy **−$7.8**, anti-edge **−$8.7**. Fair sign structure.
**Caveat:** the product's variance is enormous (p5 −$160 / p95 +$166 around a +$1.5 edge), so a *skilled* player
can still book a losing session on variance alone — this is inherent to a product-of-factors game, not a bug, and
the graded standard-deviation pre-question (`productSD`, verified to the doc's reference σ values) explicitly
teaches that.

**Coaching accuracy: 8/10.** Verdict includes the doubled-loss rule ("You missed a loss: it's scored DOUBLE",
`DiceAndCardsPage.tsx:706`) and a game-review; the SD question is graded correctly.

**Thoroughness: 7/10.** Game review + SD teaching; complete.

**Next-step: 3/10.** Review + play again.

### 5. Fruit Market (`src/lib/games/fruitMarket`) — Taker, Warm-up (speed)
**Winnable?** Yes and fair: correct action scores **+0.81 mean**, a wrong-direction trade **−0.81** (forfeits
exactly the correct action's edge, `engine.ts:216-218`), and mindless always-buy **−0.14**. Symmetric and
correct; skip is never a loss.

**Coaching accuracy: 8/10.** After each market it shows the correct action and the full edge
(`FruitMarketPage.tsx:470-489`). Accurate.

**Thoroughness: 6/10.** Intentionally light (it's a 15-second speed drill); teaching is a one-line decomposition
hint. Appropriate for its role but shallow.

**Next-step: 3/10.** Play again.

**Defects:** none. (Note: `roundTo10` rounds ties up and `orange-deflation` uses `ceil` — both are documented
and consistent with the decision math.)

### 6. Next Card Betting (`src/lib/games/nextCardBetting`) — Bettor, Core
**Winnable?** Yes and fair: Kelly on the >50% side returns **+28.8%/bet**; flat on the best side +4.5%; flat on
the sub-50% side **−5.7%**. Punishes betting the wrong side correctly. Kelly `f* = max(0, 2p−1)` and the exact
remaining-card probabilities are correct.

**Coaching accuracy: 8/10.** Shows the best side, its true probability, and the Kelly stake
("Best: Higher at 62% → stake Kelly 24%", `NextCardBettingPage.tsx:797-799`), plus a Sizing(0–7)/Decision(0–3)
skill split that matches the engine. Accurate; slightly light on *how* to count each cycle.

**Thoroughness: 7/10.** Per-cycle review + skill bars; complete.

**Next-step: 3/10.** Play again.

**Defects:** none material.

### 7. Probability Betting (`src/lib/games/probabilityBetting`) — Bettor, Core
**Winnable?** Yes: Kelly on +edge events **+$14.8 mean**; flat on −edge events **−$13.4**. Fair core.
**Minor defect (F7):** blindly flat-betting *every* event is **≈ break-even (+$2.6)**, not clearly negative,
because the house mis-prices symmetrically around fair. So reckless over-betting isn't punished in EV — only via
the sizing/efficiency skill score. The game's own `winnability.test.ts` only asserts `skilled > betAll`, never
`betAll < 0`, so this is consistent-but-unguarded. The Insurance/Boost arbitrage detector (`findInsuranceArb`) is
correct.

**Coaching accuracy: 8/10.** The round-review table (Odds / Fair / Edge / Kelly / Efficiency, per-event
`goodDecision`) is the most detailed of any game (`ProbabilityBettingPage.tsx:699-729`) and matches the engine's
correct edge/Kelly math, split into Decision(0–7)/Sizing(0–3).

**Thoroughness: 8/10.** Richest review; complete, no cut-offs.

**Next-step: 3/10.** Play again.

### 8. Arbitrage & De-vig (`src/lib/games/arbitrage` + `src/content/arbitrage`) — quiz drill, Core
This is a **knowledge drill**, not a P&L market game, so "winnable" is trivial (correct answers → 100%). Every
ground-truth answer is re-derived by an exact rational solver (`solvers.ts`), never hard-coded, and every
distractor encodes a *named misconception* (`generators.ts:31-44`). All 32 arbitrage tests + 5 engine tests pass.

**Coaching accuracy: 9/10** (solver-backed correctness + misconception tagging). **Thoroughness: 6/10**
(feedback is correct/incorrect + misconception label, not deep worked solutions in the drill surface).
**Next-step: 3/10** (drill loop). *Item-by-item answer keys were not hand-verified beyond the passing test
suite, since it sits at the edge of the market-making scope.*

---

## Cross-cutting findings

- **Next-step is uniformly weak (3/10 everywhere).** Every game ends on "Play again." The Games hub
  (`catalog.ts`) only exposes a static `difficulty` tag and `skill` chip; there is **no contextual
  "you struggled with pricing → try Cards Market Making next" routing**. The app *has* ZPD machinery
  (`remediation/policy.ts`, `content/remediation/prereqDAG.ts`, `roadmap/skillGraph.ts`) for hint-ladder
  items, but it is **not wired to the interactive games** at all.
- **The two Maker games — the ones with fairness defects — are exactly the two without winnability tests.**
  Adding Monte-Carlo winnability tests (like the five other games have) would have caught F1 and F4.
- **Maker fairness is dominated by the noise/informed knobs.** `makeMarket` uses `tightness²` noise + 0.7
  informed rate → too punishing to imprecise pricing; `marketOfCards` uses matched two-sided noise + 0.15/1-lot
  informed → too forgiving of imprecise pricing. They err in opposite directions.

---

# Hint-ladder items — Interview Games & Auctions

These content tracks are **hint-ladder items**, not interactive P&L games, so they are scored on the three
standard metrics (accuracy / thoroughness / next-topic ZPD). The generated math is exact — every family is
re-derived by a `fraction.js` solver (`tradingSolvers.ts`, `auctions/solvers.ts`) and cross-checked by the
test suites; a hand-traced sample all matched. The weakness is entirely in the **middle ladder rungs and the
next-topic routing**, not in the answers.

**How the ladder is built:** `buildHintLadder()` (`src/lib/tutor/hintLadder.ts:277`) returns a fixed 5 rungs:
(1) name-trap (from `commonErrors[].feedback` / `distractorRationale`, answer-withheld), (2) representation
(`planOfAttack({section,family,tag})`), (3) worked-sibling, (4) elicit-confront (`simLinkFor()` deep-link),
(5) reveal (`question.explanation`). Rungs 2 & 4 are only as good as the **family/section/tag → plan/sim**
coverage — which is where these tracks are thin.

## Interview Games (hint-ladder)

Track is section-less ⇒ one bucket `interview-games::_core`, one DAG node (`INTERVIEW_GAMES`, prereq
`Expected Value`). So **every** interview-games failure routes to Expected Value regardless of sub-skill —
a sensible floor but coarse.

| Level / family | Accuracy | Thorough. | Next-topic | Notes |
|---|---|---|---|---|
| ig-1 Pricing Fair Value (coinbet/dice-sum/max-dice) | 10 | 7 | 8 | EV=2, mode=7, E[max 2 dice]=4.47 all ✓; static items lack family/section → generic rungs 2/4 |
| ig-basket Basket & ETF NAV (`genBasketNAV`) | 10 | 7 | 7 | NAV=Σqty·price ✓; rung-2 NAV plan hits, but no sim link (`etf-creation-redemption` unwired) |
| ig-fermi Fermi Estimation (flashcards) | 9 | 8 | N/A | Order-of-magnitude sound; flashcards are intentionally un-remediable |
| ig-2 Optimal Stopping (MCQ) | 10 | **5** | 7 | St. Petersburg ∞, secretary 1/e ✓; terse rationales, generic rungs 2/4 |
| ig-3 Optimal Stopping Drills (`genReRollDieNumeric`,`genFairValueNumeric`) | 10 | 9 | 8 | Re-roll EV 4.25, (N+1)/2 ✓; **best-covered** — real plans + `expected-value` sim at both middle rungs |
| ig-books Fair Odds / De-Vig (`genNextCardFairProb`,`genDeVig`) | 10 | 6 | **6** | r/(r+b) & de-vig ✓; routes to EV but real gap is Conditional Probability; `genNextCardFairProb` → generic rung 2, no sim |
| ig-4 Market Making (MCQ) | 10 | **5** | 7 | adverse-sel −$1.20, spread/skew ✓; generic rungs 2/4 (`trading-floor-live` sim unwired) |
| ig-trading-decisions (5 families) | 10 | 6 | 7 | basket-arb/vig-arb/next-card/mm-pnl/fermi all ✓; 4/5 families get `GENERIC_PLAN` + no rung-4 sim. Dead 4th distractor at `tradingGames.ts:308` (`buildChoices` caps at correct+3) |

## Auctions (hint-ladder)

**Headline defect — applies to every auction family:** the auctions content has **no node in the remediation
DAG or the skill graph**, and none of its misconception tags are in `MISCONCEPTION_EDGE`
(`auctions/levels.ts:20-22` — "exported but NOT registered into any track"; wired only into timed OA pools).
Consequently a failure on any auction item calls `remediationStep()` with an unrecognized topicKey and returns
`{kind:"exit", reason:"no-gap"}` (`policy.ts:221-222`) — **no prerequisite is ever taught**, even though the
natural targets (Conditional Probability, Expected Value, Order Statistics = E[max of n]) all exist as nodes.
Rungs 2 & 4 are also fully generic (zero auction coverage anywhere). The **math is correct** — a common-value /
order-statistic "wallet" model (correctly NOT the first-price IPV `(n−1)/n·v` rule, which doesn't apply here).

| Level / family | Accuracy | Thorough. | Next-topic | Notes |
|---|---|---|---|---|
| auc-1 Acquiring a Company (`genAcquireEvGivenWin`) | 10 | 7 | **2** | E[V\|V≤b] = b/2 ✓; no DAG node → no routing |
| auc-2 How Much to Shade (`genWinnersCurseShade`) | 10 | 7 | **2** | shade = E[max of n noises]; m=1,n=2 → 4/9 ✓ (brute-force cross-checked); no routing |
| auc-3 Value Conditional on Winning (`genEvGivenWin`) | 10 | 7 | **2** | E[V\|win] = signal − E[max n] ✓; no routing |
| auc-4 Bidding Decisions (`genBidEvDecision`) | 10 | 7 | **2** | +EV iff bid < signal − E[max n] ✓; `genShadingWithN`/`genAcquireDecision` exist but no `auc-*` level uses them (OA-only) |

## ZPD / remediation engine (policy + prereqDAG + skillGraph)

**The engine itself is well-designed and internally consistent.** `remediationStep()` (`policy.ts:219-278`) is a
clean pure cascade (slip-exit → Kapur first-stumble grace → bottom-out gate → KST misconception-edge descent →
Vygotsky floor-teach → depth cap) with tier selection targeting the Wilson ~85% band. **The DAG is structurally
clean:** acyclic (all edges point down to the two foundation floors), no dangling ids, every leaf is a floor,
edges are sensible — all verified by `prereqDAG.test.ts`. No logic defects found.

**Routing gaps (not engine bugs — coverage holes):**
1. **Auctions entirely uncovered** (most serious) — no node, tags unmapped → `no-gap` exit, teaches nothing.
2. **Interview-games routing is coarse** — single `interview-games::_core` bucket, lone prereq Expected Value,
   so de-vig/next-card (conditional prob) and basket-NAV (arithmetic) all route to EV regardless of the real gap.
3. **Content-specific tags don't drive descent** — `MISCONCEPTION_EDGE` (`prereqDAG.ts:347-364`) only maps the
   prob/stats tag family; interview-games and auction tags fall back to `node.prereqs[0]`.
4. **skillGraph parity** — mirrors the DAG (so it also omits the auction skill from roadmap/readiness).

---

## Top 5 issues (ranked, whole audited area)

1. **Market of Cards mis-pricing is unpunished — the game fails its own core skill (F4).** A quote 40 (even
   150) off the true mid earns the same as a perfect quote (median +$72 vs +$64; ~67–74% win), because matched
   two-sided noise banks the spread independent of centring and informed pick-offs are throttled to 15%/1-lot.
   The catalog sells it as "price the signed table total," but pricing accuracy earns almost nothing.
   *(`marketOfCards/engine.ts:271-273, 334-364`)*
2. **Auctions have zero next-topic remediation routing.** No `auctions` node in the prereq-DAG or skill-graph
   and the four auction tags are unmapped, so any winner's-curse failure hits `remediationStep` → `exit/no-gap`
   and teaches nothing — even though Conditional Probability / Expected Value / Order-Statistics prereqs all
   exist. All four auction levels score **2/10 next-topic** despite 10/10 accuracy.
   *(`auctions/levels.ts:20-22`; `policy.ts:221-222`; `prereqDAG.ts:347-364`)*
3. **Make Me a Market is winnable only inside a ~±5% valuation band (F1).** A competent player with ±10%
   estimation error is net-negative whether they quote tight (−$136, picked off) or wide (−$183, earns ≈ 0 but
   still tail-picked). The `tightness²` earn curve + 0.7 informed rate demand near-perfect valuation that the
   Fermi-guesstimate scenarios (25%-of-value spread cap) can't realistically support.
   *(`makeMarket/engine.ts:143,217-218`; `makeMarketScenarios.ts:82-84`)*
4. **Market of Cards coaching is misleading (F4/F5).** The only "why" feedback is a binary two-sided ✓/✕ chip;
   it praises a "risk-manager pass" even when the player quoted 150 off, and never reports whether the *price*
   was right. One-way risk is also only a variance penalty, not an EV penalty (one-sided has the *highest* mean,
   +$85). *(`MarketOfCardsPage.tsx:727-731`)*
5. **Next-step is absent across all 8 games, and hint-ladder routing is coarse.** Every game dead-ends on
   "Play again" (uniform 3/10) despite an existing ZPD engine that isn't wired to them; and the section-less
   interview-games track routes every miss to Expected Value regardless of the real gap (de-vig/next-card should
   go to Conditional Probability). *(`catalog.ts`; `prereqDAG.ts:250-255, 347-364`)*

**Honorable mentions:** (a) no winnability Monte-Carlo tests guard the two Maker games — exactly the two with
fairness defects (F3/F6); (b) in Probability Betting, blindly flat-betting *everything* is ≈ break-even (+$2.6),
not negative-EV, so reckless over-betting isn't punished in EV, only via the sizing score (F7); (c) a stupid-wide
spread in Make Me a Market earns ≈ $0 but never loses, so it's sterilised rather than punished (F2).
