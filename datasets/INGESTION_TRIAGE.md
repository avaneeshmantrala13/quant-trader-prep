# Ingestion Triage — Datasets 1 & 2 (early note, before generation)

Verified against the live codebase under `src/content/` on this branch.

## Dataset 2 — subcategory-by-subcategory (already-covered vs new)

| Subcategory (source family) | Status | Evidence (files / level count) |
| --- | --- | --- |
| Core Probability | **covered — skip** | `probability/levels.ts` (pr-1..pr-5) |
| Combinatorial Analysis | **covered — skip** | `probabilityStats/combinatorialAnalysis/` (14 levels, exact solvers + genPoker/genGrid/genHyper/genTraps) |
| Geometric Probability | **covered — skip** | `probabilityStats/geometricProbability/` (2) |
| Conditional Probability | **covered — skip** | `probabilityStats/conditionalProbability/` (6) |
| Expected Value | **covered — skip** | `probabilityStats/expectedValue/` (8) |
| Betting & Sizing (Kelly, 90-item source) | **covered — skip** | `probabilityStats/bettingSizing/` (4 levels, 3×3 schema, 90-answer fixture) |
| Order Statistics | **covered — skip** | `probabilityStats/orderStatistics/` (1) |
| Variance, Covariance & CLT | **covered — skip** | `probabilityStats/varianceCovarianceClt/` (3) |
| Markov Chains | **covered — skip** | `probabilityStats/markovChains/` (7) |
| Game Theory + Game Puzzle → "Game Theory & Puzzles" | **covered — skip** | `gameTheory/` (8) + `gamePuzzle/` (3), merged & interleaved in `probabilityStats/index.ts` |
| Dissolved "General" | **covered — re-homed** | split across Combinatorial/Geometric/OrderStats/VarCovCLT/Markov/GameTheory |
| Applied Math & Number Puzzles (Math Questions) | **covered — skip** | `mathQuestions/` (6 levels: rates/algebra, number theory, geometry) |
| Brainteasers (Modular/Simplification/Summation/Pigeonhole/Logical/Symmetry/OOTB) | **covered — skip** | `brainteasers/` technique-grouped (bt-4/5/6) + many classics |

### Dataset 2 NEW sources → new mechanics only

- **GetCracked Probability (~54):** almost all sort into covered subcategories.
  **NEW:** sequential draw-without-replacement *betting* (P(next card), colour
  counting) → **Next-Card conditional fair price** (no exact generator today).
- **Green Book / Zhou (~35):** brainteasers/EV/waiting-times covered.
  **NEW:** make-a-market **break-even width** + **pick-off P&L** as exact drills.
  Stochastic-calculus/options items → **out of scope, skip**.
- **Heard on the Street / Crack (~44):** logic/prob covered.
  **NEW:** no-arbitrage → **vig / overround removal & Dutch-book detection**; and
  **basket / ETF-NAV pricing**. Options/derivative pricing → **out of scope, skip**.

## Dataset 1 — the 11 games (NEW content area → Interview Games tab)

Interview Games track today = **4 levels** (ig-1 Pricing Fair Value, ig-2 Optimal
Stopping, ig-3 Optimal Stopping Drills, ig-4 Market Making). Generators today:
`genReRollDie`, `genFairValue` only.

| Game | Decision |
| --- | --- |
| Make-Me-a-Market (facts+guesstimates) | **NEW** — break-even width + pick-off P&L (numeric/quiz); Fermi → flashcard |
| Probability Betting | **skip** — covered by EV + Kelly |
| Cards Market Making (taker) | **NEW** — take/pass decision + edge |
| Market of Cards (maker) | **NEW** — card-sum fair value + pick-off (folds into MM) |
| Fruit | **NEW** — basket weighted-sum pricing |
| Dice & Cards | **skip / minor** — covered by IG + EV + Combinatorial |
| Basketball | **FLAG — live sim**, out of scope |
| ETF Challenge | sub-skill **NEW** (NAV + ETF/NAV arb); full board **FLAG — live sim** |
| Next-Card Betting | **NEW** — conditional fair price + bet/pass |
| Fermi | **NEW** — decomposition flashcard + order-of-magnitude quiz |
| Marble Olympics | sub-skill **NEW** (vig removal / Dutch book); full game **FLAG — live sim** |

## Net new families to GENERATE (exact-verifier, disjoint files)

1. **Next-Card** — conditional fair price of a next-card bet (exact rational) + bet/pass quiz.
2. **Vig/Overround** — strip overround → fair probs; Dutch-book arbitrage detection (exact rational).
3. **Basket/NAV** — ETF/fruit basket pricing (weighted sum) + ETF-vs-NAV arbitrage decision.
4. **Make-a-Market** — break-even width + pick-off P&L (exact) + adjust-after-fill quiz.
5. **Fermi** — decomposition flashcards + order-of-magnitude MC quiz.

All land under **Interview Games**. No new track. Minimize new levels; reuse
numeric/quiz/flashcard modes already in the engine.
