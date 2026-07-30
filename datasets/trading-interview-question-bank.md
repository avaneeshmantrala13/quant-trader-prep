# Dataset 2 — Master Trading-Interview Question Bank

> **Provenance note.** The parent handoff did not pass the full master bank to
> the ingestion agent *verbatim*. This file records the **structure** of the bank
> and, in detail, the **three new sources** that were the focus of this
> ingestion. The bulk of Dataset 2 (Expected Value, Conditional Probability,
> Markov Chains, Combinatorial Analysis, Game Theory/Puzzle, Betting & Sizing,
> Applied Math, Brainteasers) was already ingested in prior sessions and is
> preserved verbatim in the sibling files in this `datasets/` folder
> (`expected-value.md`, `conditional-probability.md`, `markov-chain.md`,
> `combinatorial-analysis.md`, `game-theory.md`, `game-puzzle.md`, `general.md`,
> `math-questions-batch.md`, `brainteasers-*.md`). The material below is a
> faithful reconstruction of the *new-source* structure from the parent's
> description plus public knowledge of these well-known collections.

## Already-integrated families (DO NOT duplicate)

Verified present under `src/content/` (see the triage note for file-level detail):

- **Betting & Sizing (Kelly)** — `probabilityStats/bettingSizing/` (90-item 3×3
  schema fixture, exact rational solver).
- **Game Theory + Game Puzzle** → merged **"Game Theory & Puzzles"**
  (`gameTheory/`, `gamePuzzle/`).
- **Expected Value** — `probabilityStats/expectedValue/` (8 levels).
- **Conditional Probability** — `probabilityStats/conditionalProbability/` (6).
- **Markov Chains** — `probabilityStats/markovChains/` (7).
- **Combinatorial Analysis** — `probabilityStats/combinatorialAnalysis/` (14).
- **Dissolved "General"** → re-homed into Combinatorial Analysis, Geometric
  Probability, Order Statistics, Variance/Covariance & the CLT, Markov Chains,
  Game Theory.
- **Math Questions** (Applied Math & Number Puzzles: Rates/Algebra/Word
  Problems, Number Theory & Counting, Geometry & Derivations) — `mathQuestions/`.
- **Brainteasers** (Modular, Simplification, Summation, Pigeonhole, Logical,
  Symmetry, Out-of-the-Box) → technique-grouped `brainteasers/` (bt-4/5/6).

## New sources (the focus of this ingestion)

### (a) GetCracked.io — Probability (~54 items)

Item families and where they sort in our taxonomy:

- Basic probability, complement, inclusion–exclusion → **Core Probability**
  (covered).
- Conditional / Bayes (medical-test base rates, two-child, Monty-Hall variants)
  → **Conditional Probability** (covered).
- Expected value, waiting times, coupon-collector → **Expected Value / Markov**
  (covered).
- Combinatorics (poker hands, arrangements, committees) → **Combinatorial
  Analysis** (covered).
- **Sequential card / drawing-without-replacement betting** (P(next card …),
  colour-count updating) → **NEW mechanic**: conditional fair pricing of a
  sequential bet. *Not* covered by an exact generator → build **Next-Card**.

Distractor/misconception patterns observed: base-rate neglect, P(A|B) vs P(B|A)
inversion, using the unconditioned deck probability after cards are removed,
forgetting order-doesn't-matter (C vs P).

### (b) Green Book — *A Practical Guide to Quantitative Finance Interviews* (Xinfeng Zhou) (~35 items)

- Brainteasers (weighing, crossing, light-switch) → **Brainteasers** (covered).
- Probability / expected value, gambler's ruin, HH-vs-HT waiting times →
  **Core Probability / Markov** (covered).
- **Market-making & pricing games** (make-a-market, adverse selection,
  bid/ask width, information) → maps to **Interview Games**; the *break-even
  width* and *pick-off P&L* mechanics are **NEW** as exact drills.
- Stochastic/finance-math (Brownian, options) → out of the current app's
  probability-first scope; **flag/skip**.

Distractor/misconception patterns: quoting spread independent of uncertainty,
trading with no edge, mean-vs-max, symmetric treatment of an informed
counterparty.

### (c) Heard on the Street / *Crack* — *Heard on the Street* (Timothy Falcon Crack) (~44 items)

- Quantitative/logic brainteasers → **Brainteasers / Applied Math** (covered).
- Probability & statistics (dice, cards, coins) → **covered**.
- **Financial-economics pricing** (arbitrage, put-call parity, forward pricing,
  no-free-lunch) → the **arbitrage / no-arbitrage** idea maps to a **NEW** exact
  drill: **vig / overround removal & Dutch-book detection** on mutually
  exclusive outcomes (also the Marble-Olympics sub-skill). Options/derivatives
  pricing proper is out of scope → **flag/skip**.
- **Basket / index (ETF NAV) pricing** → **NEW** exact drill (also the ETF
  Challenge sub-skill).

Distractor/misconception patterns: ignoring the overround (treating quoted
implied probs as fair), wrong arbitrage direction (buy the rich leg), adding
basket weights unweighted, confusing NAV with price.

## Triage outcome (new families to generate)

| New family/mechanic | Source(s) | Answer format | Track/section |
| --- | --- | --- | --- |
| Next-Card conditional fair price + bet/pass | GetCracked | numeric + quiz | Interview Games |
| Vig / overround removal & Dutch-book detection | Crack, Marble Olympics | numeric + quiz | Interview Games |
| Basket / ETF NAV pricing + ETF-vs-NAV arb | Crack, ETF, Fruit | numeric + quiz | Interview Games |
| Make-a-market break-even width + pick-off P&L | Green Book, MMaM, Market-of-Cards | numeric + quiz | Interview Games |
| Fermi decomposition (reasoning) | Fermi game | flashcard + quiz | Interview Games |

Everything else from the three new sources sorts into already-covered
subcategories and is **skipped to avoid duplication** (noted per-source above).
