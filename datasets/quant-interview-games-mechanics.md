# Dataset 1 — Quant Interview Games (11 game mechanics)

> **Provenance note.** The parent handoff did not pass this dataset to the
> ingestion agent *verbatim*. The text below is a **faithful reconstruction**
> of the 11 games' mechanics, scoring/EV math, tested skills, and common
> mistakes, assembled from the structured content the parent described plus
> well-established public knowledge of the SIG / Jane Street / Optiver / IMC
> "trading game" interview genre. It is preserved here for the record and as the
> input spec for the parser/generation pipeline. Where a game reduces to a skill
> our exact-verifier engine already models, that mapping is recorded under
> **Engine representation**. Games that require a genuinely *live* simulator are
> flagged **[LIVE SIM — out of scope for exact-verifier drills]**.

---

## 1. Make-Me-a-Market (facts + guesstimates)

- **Mechanic.** The interviewer asks you to quote a **two-sided market** (a bid
  and an ask) on an unknown quantity — either a *fact* ("population of Canada")
  or a *guesstimate* ("piano tuners in Chicago"). The interviewer then **trades
  against you** by buying at your ask or selling at your bid, and may keep
  hitting you as they update. Your quote must bracket a defensible fair value
  with a spread that reflects your uncertainty.
- **Scoring / math.** If your true fair value is `V` and you quote bid `B`, ask
  `A`, an informed counterparty buys at `A` when `V > A` (you're short at too low
  a price → P&L `A − V < 0`) and sells at `B` when `V < B` (you're long too high
  → P&L `V − B < 0`). You only get **picked off** on the wrong side. A
  break-even spread must be at least `2·(adverse-selection cost)`. Tight quotes
  on high-uncertainty facts get you run over; too-wide quotes are marked as "no
  edge / not a trader."
- **Skill tested.** Two-sided quoting, spread ∝ uncertainty, adverse selection,
  staying consistent under pressure, updating without anchoring.
- **Common mistakes.** Quoting one-sided; symmetric spread that ignores skewed
  uncertainty; widening in the wrong direction after being hit; forgetting the
  counterparty is informed (only trades when it's bad for you).
- **Engine representation.** Numeric drill for **break-even width** and
  **pick-off P&L** (exact); quiz for the *decision* of how to adjust after a
  fill. Fermi/fact estimation → flashcard (reasoning) + Speed Arena.

## 2. Probability Betting

- **Mechanic.** You are offered a **bet at stated odds** on a random event and
  must decide whether it is +EV and, if so, how much to stake.
- **Math.** `EV = p·(win) − (1−p)·(stake)`; edge `= p·b − q` in net-odds terms;
  stake by Kelly `f* = (b·p − q)/b`.
- **Skill tested.** Turning a probability into a price and an edge; sizing.
- **Common mistakes.** Betting the win probability as if it were the stake;
  using implied (break-even) probability as the true probability; ignoring `q`.
- **Engine representation.** **Already covered** — Expected Value + Betting &
  Sizing (Kelly, exact rational). No new generator needed.

## 3. Cards Market Making — TAKER

- **Mechanic.** A market is shown (someone else's bid/ask) on the value of a
  hidden card (or sum of cards). You are the **taker**: hit the bid, lift the
  offer, or pass, given your own fair-value estimate and any information you hold.
- **Math.** Take the offer when `fair − ask > 0`; hit the bid when
  `bid − fair > 0`; the edge is the distance from fair to the price you trade.
  Value-of-information: seeing a card shifts fair value and can flip the decision.
- **Skill tested.** Acting on edge, value of information, discipline to pass.
- **Common mistakes.** Trading inside the spread with no edge; ignoring adverse
  selection (the maker may know more); over-trading.
- **Engine representation.** Quiz for the **take/pass decision** with
  misconception distractors; numeric for **edge = |fair − price|**.

## 4. Market of Cards — MAKER

- **Mechanic.** You **make** a two-sided market on the value/sum of hidden
  card(s); the interviewer (informed) trades against you. Classic version: quote
  the sum of the next `k` cards from a deck.
- **Math.** Fair value = `E[sum]`. For `k` cards drawn without replacement from a
  known deck, `E[sum] = k · (deck mean)`. Adverse-selection P&L identical to
  Make-Me-a-Market. Spread should scale with `SD(sum)`.
- **Skill tested.** Pricing an expectation, sizing the spread to variance,
  inventory/adverse selection.
- **Common mistakes.** Using max instead of mean; ignoring that draws without
  replacement change the conditional mean; too-tight spreads.
- **Engine representation.** Numeric **fair value of a card-sum**; numeric
  **pick-off P&L**; ties into Market Making level.

## 5. Fruit (basket pricing / guesstimate)

- **Mechanic.** You're given prices/values for individual fruits (or told a few
  and must infer others) and must **price a basket** (a combination) two-sided,
  fast. A market-making + mental-math hybrid.
- **Math.** Basket value = **weighted sum** `Σ wᵢ·vᵢ`. If a fruit's value is
  itself uncertain, basket variance `= Σ wᵢ²·Var(vᵢ)` (independent) drives the
  spread.
- **Skill tested.** Linear-combination pricing, fast weighted sums, spread from
  aggregate uncertainty.
- **Common mistakes.** Adding unweighted; arithmetic slips; forgetting variance
  adds in squares, not linearly.
- **Engine representation.** Numeric **basket / NAV pricing** (exact weighted
  sum); connects to ETF Challenge sub-skill and Variance-of-a-sum.

## 6. Dice & Cards (EV games)

- **Mechanic.** A grab-bag of dice/card **EV and optimal-play** puzzles (roll and
  keep, re-roll, pay-to-play, stop/continue).
- **Math.** `EV = Σ p·x`; optimal stopping: continue iff current < `E[future]`.
- **Skill tested.** EV, option value, optimal stopping.
- **Common mistakes.** Ignoring option value; mean-vs-max; not conditioning.
- **Engine representation.** **Largely covered** — Interview Games (re-roll,
  fair value), Expected Value, Combinatorial Analysis (dice sums). Extend only
  with genuinely new variants if they add value.

## 7. Basketball (live book management)  **[LIVE SIM — out of scope]**

- **Mechanic.** A streaming, multi-round trading simulation: a "basketball game"
  unfolds and you continuously **make markets and manage a book** (position,
  P&L, inventory) as the score/state evolves in real time.
- **Why out of scope.** No single exact answer per step; the skill is dynamic
  risk/inventory management against a live, path-dependent state — needs a
  stateful simulator, not an exact-verifier drill.
- **Salvageable sub-skills.** Inventory skew, EV of the next event — already
  covered by Market Making + EV.

## 8. ETF Challenge (full board)  **[LIVE SIM for the full game — out of scope]**

- **Mechanic.** A multi-instrument board: several underlyings **and** an ETF (a
  basket of them) trade simultaneously; you arbitrage the ETF against its
  components (creation/redemption), keeping NAV and the ETF price in line.
- **Full game.** Requires a live multi-book simulator (correlated quotes,
  arbitrage windows) — out of scope for exact drills. **FLAG.**
- **Salvageable sub-skill (in scope).** **NAV / basket pricing**: ETF fair value
  = `Σ wᵢ·pᵢ`; detect/So size the **ETF-vs-NAV arbitrage** (buy the cheaper,
  sell the richer). Exact — build it.

## 9. Next-Card Betting (sequential, updating)

- **Mechanic.** Cards are revealed one at a time from a known deck; before each
  reveal you may **bet on the next card's color/rank** at offered odds. As cards
  leave the deck, the fair probability **updates** (card counting).
- **Math.** With `r` red and `b` black remaining, `P(next red) = r/(r+b)` (exact
  rational). Fair price of a $1 bet paying $1 on red = `r/(r+b)`; edge vs a
  quoted price; Kelly stake on the exact edge.
- **Skill tested.** Conditional probability / updating, value of information,
  fair pricing of a sequential bet.
- **Common mistakes.** Using the *original* deck probability (1/2) instead of the
  conditional; inverting the ratio; ignoring cards already seen.
- **Engine representation.** Numeric **fair price of next-card bet** (exact
  rational) + quiz for the +EV **bet/pass** decision. NEW family.

## 10. Fermi (order-of-magnitude estimation)

- **Mechanic.** Estimate a large unknown by **decomposition** into factors you
  can bound ("How many golf balls fit in a 747?" → volume ratio × packing).
- **Math.** Product/sum of order-of-magnitude estimates; the *method*
  (decomposition, sanity bounds) is graded, not a unique number.
- **Skill tested.** Structured estimation, unit consistency, order-of-magnitude
  arithmetic.
- **Common mistakes.** No decomposition (wild guess); unit errors; compounding
  many optimistic factors; wrong power of ten.
- **Engine representation.** **Flashcard** (reasoning/procedure — no MC) for the
  decomposition, plus **quiz** for "which decomposition/order of magnitude is
  right" (misconception distractors). Pure powers-of-ten arithmetic → Speed Arena.

## 11. Marble Olympics (live multi-event market)  **[LIVE SIM — out of scope]**

- **Mechanic.** A multi-event competition (marble races) where you trade
  **winner markets** on each competitor as events unfold live; prices across
  mutually exclusive outcomes should sum to ~1 (plus vig).
- **Full game.** Live, correlated, path-dependent multi-market trading — needs a
  simulator. **FLAG.**
- **Salvageable sub-skill (in scope).** **Vig / overround removal**: given quoted
  implied probabilities on mutually exclusive outcomes that sum to `>1`, strip
  the overround to get **arbitrage-free** probabilities, and detect a **Dutch-book
  arbitrage** when they sum to `<1`. Exact rational — build it.

---

### Summary of engine mapping

| Game | New exact drill? | Where |
| --- | --- | --- |
| Make-Me-a-Market | **Yes** — break-even width, pick-off P&L | Interview Games |
| Probability Betting | No — covered (EV, Kelly) | — |
| Cards MM (taker) | **Yes** — take/pass decision + edge | Interview Games |
| Market of Cards (maker) | **Yes** — card-sum fair value + pick-off | Interview Games |
| Fruit | **Yes** — basket weighted-sum pricing | Interview Games |
| Dice & Cards | Mostly covered; extend if valuable | Interview Games / EV |
| Basketball | **No — LIVE SIM (flag)** | proposal only |
| ETF Challenge | Sub-skill **yes** (NAV + ETF/NAV arb); full game LIVE SIM (flag) | Interview Games |
| Next-Card Betting | **Yes** — conditional fair price + bet/pass | Interview Games |
| Fermi | **Yes** — flashcard + decomposition quiz | Interview Games / Speed Arena |
| Marble Olympics | Sub-skill **yes** (vig removal / arb); full game LIVE SIM (flag) | Interview Games |
