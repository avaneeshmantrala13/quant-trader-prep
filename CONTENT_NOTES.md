# Content Notes — Quant Trader Prep

How the question bank is built, the distractor rationale per concept, and — most importantly — the **hard/edge-case questions flagged for your expert verification**.

Two content strategies:

- **Generators (exact verifiers):** the answer is computed deterministically from parameters, so items are correct *by construction* and regenerate fresh each attempt. Proven by unit tests in `src/content/generators.test.ts` (400 seeds × every generator, plus independent re-derivation from the prompt for arithmetic, union, at-least-one, combinations, and binomial).
- **Hand-authored:** famous, well-established problems re-worded fresh (no verbatim bank content). The genuinely hard ones carry `needsVerification: true` and appear in the checklist at the bottom.

Design rule for **every** item: distractors are the values a student computes when they make a *specific* mistake, and all options share the same length/format so nothing leaks the answer.

---

## Generators (exact, contamination-proof)

### Probability — `src/content/probability/generators.ts`

| Generator | Concept | Correct method | Distractors = these specific errors |
|---|---|---|---|
| `genUnion` | P(A∪B) | P(A)+P(B)−P(A∩B) | `P(A)+P(B)` (forgot to subtract overlap); `P(A)·P(B)` (treated “or” as independent “and”); `P(A∩B)` (reported only the overlap) |
| `genIntersectionIndep` | P(A∩B), independent | P(A)·P(B) | `P(A)+P(B)` (added); `P(A)+P(B)−P(A)P(B)` (computed the union instead); `min(P(A),P(B))` |
| `genAtLeastOne` | complement | 1−(1−p)ⁿ | `n·p` (summed per-trial probs); `pⁿ` (computed P(all)); `1−pⁿ` (subtracted P(all) not P(none)) |
| `genConditional` | P(A\|B) | P(A∩B)/P(B) | `P(A∩B)/P(A)` (=P(B\|A), inverted condition); `P(A∩B)` (forgot to divide); `P(B)/P(A∩B)` (ratio inverted) |
| `genBayes` | posterior | P(+\|D)P(D)/P(+) | `P(+\|D)` (inverse fallacy — reported the sensitivity); `P(+\|D)P(D)` (numerator only, unnormalized); `P(+\|D)/(P(+\|D)+P(+\|¬D))` (ignored the base rate) |
| `genExpectedValue` | EV | Σ p·x | unweighted mean of payoffs (forgot to weight); sum of payoffs (no weighting/division); weighted-but-not-divided |
| `genCombinations` | C(n,r) | n!/(r!(n−r)!) | `P(n,r)` (order matters); `nʳ` (ordered w/ replacement); `n·r` (naive product) |
| `genBinomial` | P(exactly k) | C(n,k)(½)ⁿ | `(½)ⁿ` (one sequence, forgot the count); `k/n` (naive ratio); `(½)ᵏ` (ignored the other flips) |
| `genGeometric` | E[trials to 1st success] | 1/p | `p` (reported p); `1/(1−p)` (used the failure prob); `1/p − 1` (counted failures only) |

### Mental Math — `src/content/mentalMath/generators.ts`

Zetamac / Optiver "80-in-8" / Jane Street "60-in-8" style. Distractors model real arithmetic slips.

| Generator | Distractors = these slips |
|---|---|
| `genAddition` / `genSubtraction` | dropped/extra carry (±10), place-value slip (±100), ones-column off-by-one |
| `genMultiply2x1` | multiplied by b±1 (extra/short group); extra ones-digit product |
| `genMultiply2x2` | forgot one of the four cross-terms; ±one factor group; place-value carry |
| `genDivision` | quotient ±1; place-value slip (×10); divided by the wrong divisor |
| `genPercent` | decimal misplaced (×10, ÷10); forgot ÷100; divided instead of multiplied |
| `genFractionToDecimal` | inverted the fraction; decimal slip; wrong denominator |
| `genOddsToProb` | odds direction flipped; reported the odds ratio, not a probability; miscounted total outcomes |

### Interview Games (EV) — `src/content/interviewGames/generators.ts`

| Generator | Concept | Correct | Distractors |
|---|---|---|---|
| `genReRollDie` | optimal stopping | (1/N)·Σ max(x, (N+1)/2) | single-roll EV (ignored option value); avg of kept outcomes only (over-optimistic); suboptimal threshold |
| `genFairValue` | uniform mean | (N+1)/2 | N/2 (forgot +1); N (took the max); (N−1)/2 (off-by-one) |

> **Retired:** the old `genKelly` (approximate `(p(b+1)−1)/b` on rounded floats, formerly the Interview Games `ig-4` "Kelly Sizing Drills") has been removed and superseded by the exact-rational **Betting & Sizing** subcategory below. Interview Games is now `ig-1 … ig-4` (Market Making renumbered from `ig-5` to `ig-4`); map stations resolve by `levelIndex`, so no station art changed.

---

## Category → Subcategory → Schema taxonomy (Probability & Statistics)

The question bank is organized as **Category → Subcategory → Schema**, so new content is "one file each":

- **Category** — a course track (e.g. *Probability & Statistics*, which rides the `probability` / "Probability / Math" track).
- **Subcategory** — one module folder under `src/content/probabilityStats/` (e.g. `bettingSizing/`), exporting a `Level[]`. Add a sibling folder and append it in `src/content/probabilityStats/index.ts` — no other wiring.
- **Schema** — a parametric question factory inside a subcategory (the `(source × odds-format)` cells below).

### Betting & Sizing (Kelly) — `src/content/probabilityStats/bettingSizing/`

The first subcategory, and the first **`"numeric"`** (free-entry, exact-match) content. `kelly.ts` is an **exact-rational** solver (all probability/odds/Kelly math via `fraction.js` — never floats): event catalogs (Cards `k/52`; Coins binomial over `2ⁿ`; Dice by exact enumeration of `6ⁿ`), `oddsToB`, `impliedProb`, `kellyFraction`, `stakeExact`. `generators.ts` holds the **nine generators** (a 3×3 grid: `{cards, coins, dice} × {american, decimal, fractional}`), each drawing a positive-edge event + odds and choosing a bankroll that makes the exact Kelly stake a clean positive integer (~$25–$1000 stake, ~$500–$4000 bankroll).

Kelly: `f* = (b·p − q)/b`, `q = 1 − p`, `stake = f* × bankroll`. Odds→`b`: American `+M→M/100`, `−M→100/M`; Decimal `o→o−1`; Fractional `m:n→m/n`.

**Numeric error taxonomy** (targeted feedback on wrong entries, per instance — every distractor is *re-solved through the same exact-rational solver*, so each is the exact value you'd get by making that one specific mistake, not an arbitrary offset). All are guaranteed positive, integer, distinct from each other, and `≠` the answer:

| Wrong entry | The Kelly misconception it encodes |
|---|---|
| `bankroll × p` | bet the raw win probability (forgot to subtract q / scale by odds) |
| `implied × bankroll` | used the break-even/implied probability as the bet fraction |
| `(b·p − q) × bankroll` | staked the un-normalized edge — forgot to divide by `b` |
| `bankroll` | bet the **whole bankroll** (no sizing — the risk-of-ruin mistake) |
| `round(f*·100)` | treated the Kelly **percentage as dollars** (ignored the bankroll) |
| American `−M`: `kelly(p, M/100)·bankroll` | mis-converted a negative money line (`M/100` instead of `100/M`) |
| American `+M`: `kelly(p, 100/M)·bankroll` | **inverted** the positive-line conversion (applied the negative-line rule) |
| Decimal: `kelly(p, o)·bankroll` | used **gross** odds `o` as net odds (skipped the `−1`) |
| Fractional: `kelly(p, n/m)·bankroll` | **inverted** the fraction (`n/m` instead of `m/n`) |

The nine format-specific rows collapse to one conversion-error distractor per item (whichever format the item uses), so each generated question surfaces ~5–6 distinct distractors. *Before* this pass the taxonomy had only the first three rows plus the negative-line case (4 max, and only on negative American lines); it now covers over-betting, percentage-as-dollars, and an odds-conversion trap for **every** format. Each is verified in `kelly.test.ts` (§2b) by independently re-deriving the misconception value set and asserting every emitted distractor is traceable to a named error.

Each generated explanation is a **5-step worked derivation** quoting the exact computed values: (1) true `p`, (2) net odds `b`, (3) *confirm the edge* — the implied/break-even prob vs. `p`, (4) the Kelly fraction `f*`, (5) the dollar stake.

**Verification** (`kelly.test.ts`): exact solver unit checks; **re-derivation of all nine generators over 250 seeds each** (stake recomputed a second way as `f* = p − q/b`, asserting exact equality, integer stake, `0<f*<1`, `0<p<1`, `b>0`, and that the explanation quotes the computed stake/bankroll); a **distractor-traceability gate** (§2b) that independently recomputes the named-misconception value set for every instance and asserts each emitted distractor is one of them, is positive, is distinct, and `≠` the answer, with the canonical "bet p" trap always present; a **seed-dataset gate** asserting all **90 delivered answers** (9 cells × 10) are exactly reproducible by the solver as clean positive-edge integer stakes. Numeric grading is unit-tested in `src/lib/numeric.test.ts`; the numeric level contract is enforced in `src/content/levels.test.ts`.

> **Where the 90 delivered answers live (and why they are test-only).** The dataset's 90 final answers are embedded **only** as the `SEED_ANSWERS` fixture inside `kelly.test.ts` — a hidden verification gate. They are **never** imported by any generator, level, or page: the four playable levels (`bs-1…bs-4`) draw *exclusively* from `makeKellyGenerator(...)` (parametric factories), and the handoff supplied only the dollar answers (not the item prompts/inputs), so there is no original question text anywhere to leak. Users only ever see freshly generated instances.

---

## Repeatable process for every incoming dataset (the content-factory SOP)

Apply this **six-step loop to every dataset the user delivers** (it is the operational form of the PRD §6A generation→verification pipeline; §6A is the canonical spec, this is the app-local checklist):

1. **Locate the home.** Identify which website **Category → Subcategory → Schema** the dataset falls under — i.e. *where in the app new questions get added*. If no subcategory fits, create a sibling folder under the right track's content dir and append it (e.g. `src/content/probabilityStats/index.ts`). Build a quick **topic × difficulty coverage matrix** to see which cells the dataset implies.
2. **Understand the logic.** For every item, work out the **reasoning behind the problem, the correct answer, and each distractor** — the exact method, and the specific misconception each wrong value encodes. Cluster these into reusable **schemas** and a **named error taxonomy** (see the reusable taxonomy below and the Kelly table above).
3. **Generate new, complex questions.** Write a **parametric generator + exact solver** per schema (exact-rational arithmetic via `fraction.js`, never floats). Sample parameters → emit a *new* instance → compute exact truth. Make difficulty tiers meaningful and explanations step-by-step, **quoting the computed values**. Distractors must each be a **re-solved** result of a named misconception (plausible, distinct, positive, not trivially eliminable).
4. **Never reuse original questions.** The delivered items are **test-only ground truth**, embedded solely as a verification fixture (like `SEED_ANSWERS` in `kelly.test.ts`). They must **never** appear as playable content — only generated instances reach users. Grep to prove no seed prompt/answer is surfaced by any generator, level, or page.
5. **Verify with the verifier.** Everything ships only after the **exact solver + automated tests** pass: (a) independent **re-derivation** of each answer a second way; (b) a **distractor gate** asserting every distractor is exactly `≠` the answer, positive, and traceable to a named misconception; (c) a **seed-dataset gate** asserting all delivered answers are exactly reproducible by the solver. Run `npm test` and `npm run build`; optionally a headless smoke test.
6. **Add to the website.** Wire the generators into levels (mastery thresholds, question counts, lesson copy), confirm the level contract (`src/content/levels.test.ts`), and update these notes.

---

## Hand-authored questions

- **Brainteasers** (`src/content/brainteasers/levels.ts`): burning ropes, bridge & torch, 100 lockers, 3-switches-1-bulb, 8-ball weighing, poisoned wine (binary), Monty Hall, 25 horses, two-egg drop, 12-ball (heavy-or-light), blue-eyed islanders, pirate game, 100 prisoners & a light switch.
- **Probability hard tier** (`src/content/probability/levels.ts`): HT vs HH expected waiting times, ant on a cube, gambler's ruin, broken-stick triangle, birthday paradox; lattice path counting, ballot problem, Catalan/Dyck paths, coupon collector, and a **two simultaneous monotone lattice walks collision** problem (the user-requested "grid collision" genre).
- **Interview games hard tier** (`src/content/interviewGames/levels.ts`): coin-bet EV, dice-sum mode, expected max of two dice, St. Petersburg paradox, secretary problem, adverse-selection market-making P&L, spread-vs-uncertainty and inventory-skew reasoning.

---

## ⚠️ Hard questions flagged for your expert verification

These are hand-authored, genuinely hard items. The answer shown is my worked computation; please confirm before publishing. Each is marked `needsVerification: true` in code (and surfaced in-app with a small "flagged for verification" note).

### Probability
1. **`pr-hh-ht` — E[flips to first HT] = 4.** (First H takes 2; then P(T)=½ each flip ⇒ +2.)
2. **`pr-hh` — E[flips to first HH] = 6.** (State recursion E = ½(1+E) + ¼·2 + ¼(2+E).)
3. **`pr-ant-cube` — expected steps corner→opposite on a cube = 10.** (Symmetry-reduced hitting-time system.)
4. **`pr-gamblers-ruin` — start $3, target $10, fair bets ⇒ P(reach 10) = 0.3.** (i/N.)
5. **`pr-broken-stick` — P(three pieces form a triangle) = 1/4.** (Geometric probability on the unit square; every piece < ½.)
6. **`pr-birthday` — smallest group with >50% shared-birthday = 23.**
7. **`pr-ballot` — A(5) vs B(3), P(A strictly ahead throughout) = 1/4.** (Ballot theorem (a−b)/(a+b).)
8. **`pr-catalan` — monotone paths (0,0)→(3,3) staying y≤x = 5.** (Catalan C₃.)
9. **`pr-coupon` — expected rolls to see all 6 die faces = 14.7.** (6·H₆.)
10. **`pr-grid-collision` — 2×2 grid, A:(0,0)→(2,2) up/right, B:(2,2)→(0,0) down/left, one step/sec, P(same point same time) = 1/2.**
    - *Worked solution:* coordinate-sum of A after t steps is t; of B is 4−t. Equal only at t=2, on the anti-diagonal {(2,0),(1,1),(0,2)}. Each walker's position there is distributed (1/6, 4/6, 1/6). P(meet) = (1/6)²+(4/6)²+(1/6)² = 18/36 = **1/2**. (Please sanity-check the 1:4:1 landing distribution and the "meet only at t=2" argument.)

### Brainteasers
11. **`bt-12balls` — 12 balls, one heavier-or-lighter, guaranteed in 3 weighings.** (24 cases ≤ 3³ = 27.)
12. **`bt-blueeyes` — 100 blue-eyed islanders leave on the 100th night.** (Induction on count.)
13. **`bt-pirates` — top of 5 pirates keeps 98** with the split {98,0,1,0,1} (backward induction, majority rule).
14. **`bt-100prisoners-switch` — the single-designated-counter protocol** is the guaranteed strategy.

### Interview Games
15. **`ig-max-dice` — E[max of two d6] = 161/36 ≈ 4.47.** (P(max=k)=(2k−1)/36.)
16. **`ig-stpetersburg` — EV is infinite** (Σ ½ᵏ·2ᵏ diverges).
17. **`ig-secretary` — optimal success probability → 1/e ≈ 37%** (reject first n/e, then take next-best).
18. **`ig-adverse-ev` — value uniform 1..10, bid 4 / ask 7, informed counterparty ⇒ expected P&L = −$1.20.**
    - *Worked solution:* losses only when the informed trader trades. Sells to you (V<4): P&L = V−4 for V∈{1,2,3} = −3−2−1. Buys from you (V>7): P&L = 7−V for V∈{8,9,10} = −1−2−3. Total −12 over 10 outcomes ⇒ **−1.20**. (Please confirm the trade-direction convention matches your intended framing.)

---

## Reusable distractor error-taxonomy (apply when authoring new items)

Nearly every good probability/EV distractor is one of these named errors — use this as an authoring checklist:

1. **And/Or swap** — multiplied when should add, or vice versa.
2. **Independence assumed** where events are dependent (or vice versa).
3. **Mutually exclusive ≡ independent** confusion (they're opposites for positive-probability events).
4. **Conditional inversion** — P(A|B) reported as P(B|A) (prosecutor's fallacy).
5. **Base-rate neglect** — dropped the prior in Bayes.
6. **Complement mishandling** — summed instead of 1 − P(none); "at least one" vs "exactly one".
7. **Order matters / doesn't** — nCr vs nPr (off by k!); with vs without replacement (nᵏ vs nPr).
8. **Waiting-time vs count** — 1/p vs np (geometric vs binomial); p vs 1/p inversion.
9. **Variance errors** — forgot −(E[X])²; a·Var vs a²·Var; forgot 2·Cov; SD/Var mixup; n vs n−1.
10. **EV errors** — unweighted sum; ignored option/branch value; max/"best case" instead of mean; off-by-one in support.
11. **Odds↔probability** — used the ratio directly instead of b/(a+b).
12. **Overlap/self-overlap ignored** — assuming pattern waiting-times are symmetric (HH ≡ HT).

The generators in this app already implement items 1–11; the taxonomy is here to guide future hand-authored content and any runtime AI generation.

## Research corroboration

An internal research pass (Green Book, *Heard on the Street*, Mosteller's *Fifty Challenging Problems*, Blitzstein & Hwang, plus Zetamac/Optiver/Jane Street mental-math specs and firm guides) independently confirmed the exact answers of **all** the flagged hard items above — HT=4 / HH=6, ant-on-cube=10, gambler's ruin i/N=0.3, broken-stick=1/4, birthday=23, ballot=(a−b)/(a+b)=1/4, Catalan C₃=5, coupon collector 6·H₆=14.7, E[max of two dice]=161/36, St. Petersburg=∞, secretary=1/e, adverse-selection P&L, 12-ball=3, blue-eyes=100th night, pirates=98. The grid-collision (1/2) and adverse-selection (−$1.20) items remain flagged for your review since they use custom parameterizations rather than a textbook instance.

Mental-math pass thresholds cited in-app (e.g. Optiver ~70+ competitive, Jane Street ~70–85%) are **community-reported, directional** figures, not official.

## Sources & sourcing discipline

Content uses publicly reported interview *styles and schemas* (Green Book / *Heard on the Street* genres, Zetamac / Optiver / Jane Street mental-math formats, SIG/Citadel decision-game genres, classic brainteaser canon). No proprietary bank content is reproduced verbatim; every item is a fresh instance or generator seeded by the understanding of the schema. Firm-specific citations for curriculum emphasis are in the PRD appendix (`../seminar-engine+calibration/PRD.md` §18).

---

<!-- ========================================================================= -->
<!-- APPENDED SECTION — Game Theory & Game Puzzle subcategories (SOP §1–6).     -->
<!-- Added by the Game Theory / Game Puzzle content pass. Self-contained;       -->
<!-- does not modify any Kelly / bettingSizing notes above.                     -->
<!-- ========================================================================= -->

> **Section consolidation (map/ToC label pass).** The two small "game"-flavoured families — **Game Theory** (strategic equilibria) and **Game Puzzle** (betting/odds puzzles) — were the two shortest standalone sections (6 + 3 levels) sitting adjacent on the Probability/Math track. They are now merged into a **single labeled segment `section: "Game Theory & Puzzles"`** (all 9 levels retagged in their own `levels.ts`). No questions, generators, solvers, tests, or level ids changed — this is purely a re-label + a re-order. Because a section divider renders wherever `Level.section` changes, the 9 levels are kept **contiguous** and **interleaved by difficulty** in `probabilityStats/index.ts` (each source array ramps Easy→Hard on its own, so a plain concat would reset difficulty mid-section). Final Easy→Hard order: `gt-1, gp-1` (easy) → `gt-2, gt-3` (medium) → `gt-4, gt-5, gp-2` (hard) → `gt-6, gp-3` (hard flashcard "Desk" capstones). Every other Probability & Statistics section (Betting & Sizing, Expected Value, Conditional Probability, Markov Chains, General) is a **distinct technique family and was deliberately kept separate.**

## Game Theory — `src/content/probabilityStats/gameTheory/`

A Probability & Statistics subcategory (now part of the merged **Game Theory & Puzzles** section — see the consolidation note above). Unlike Kelly (one formula reused), Game Theory is a set of **distinct concepts**, so content is grouped by **family** (its solution method). `games.ts` is an **exact-rational** solver (all mixed-strategy / probability math via `fraction.js`): `pdEquilibriumPayoff`, `solveEntryGame` (backward induction), `hotellingShare`, `solveMixed2x2` / `solveDominance3x2` (indifference value `V = (ad−bc)/(a−b−c+d)`, dominated-row elimination), `solveVolunteer` (`(1−p)^(N−1)=c/b`, `P(nobody)=(1−p)^N`), and the beauty-contest equilibrium/level-k ladder. `generators.ts` holds the parametric generators + per-family error taxonomy; `levels.ts` wires 6 Candy-Crush levels.

**Six playable levels** (`gt-1 … gt-6`) across three modes:

| Level | Family | Mode | Why this mode |
|---|---|---|---|
| `gt-1` Dominant Strategies | Prisoner's Dilemma | `quiz` | Teaching point is *naming* the wrong payoff (cooperative/temptation/sucker) |
| `gt-2` Sequential Games | Backward induction | `quiz` | Distractors encode believed-threat & naive-Hold misconceptions |
| `gt-3` Position & Prediction | Hotelling + beauty contest | `quiz` | Whole-market vs split; level-k depth are the pedagogy |
| `gt-4` Zero-Sum Mixed | 2×2 & 3×2 minimax value | `numeric` | Clean exact scalar (value of game, 2-dp per dataset) |
| `gt-5` Volunteer's Dilemma | symmetric mixed eq. | `numeric` | Exact probability `P(nobody)` |
| `gt-6` Reasoning Desk | stag hunt / non-credible threat / folk theorem | `flashcard` | No single scalar — reason-then-reveal |

**Per-family misconception taxonomy** (every distractor re-derived through the solver, distinct, `≠` answer):

| Family | Correct | Distractors = these specific misconceptions |
|---|---|---|
| Prisoner's Dilemma | punishment payoff `P` | `R` (cooperative — Pareto-better but unstable); `T` (temptation — defect vs a cooperator, unsustained); `S` (sucker — cooperate vs a defector) |
| Backward induction | `cExpand` (SPE path) | `cHold` (assumed opponent's naive last move); `cOut` (believed the non-credible fight threat → stayed out); `cFight` (believed threat but entered) |
| Hotelling | `N/2` (median split) | `N` (assumed you take the whole market); `3N/4` (grabbed the big side vs a stuck rival); `N/4` (the efficient-but-unstable 25/75 spread) |
| Beauty contest | `0` (iterated dominance) | `L0 = max/2` (level-0 midpoint); `L1` (one best-response); `L2` or `target·max` (deeper level-k / fraction-of-max) |
| Zero-sum 2×2 value | `V` (indifference) | pure `maximin` (safe row floor); pure `minimax` (ceiling); flat matrix average; naive 50/50 mix (opponent leans on weak column) |
| Zero-sum 3×2 value | reduced-2×2 `V` | dominated-row payoff vs optimal mix; value of the *wrong* deletion; flat 6-cell average |
| Volunteer's Dilemma | `(1−p)^N` | `(1−p)^(N−1)=c/b` (exponent off-by-one, forgot self); `p^N` (opposite tail — everyone volunteers); `1−p` (per-person, not joint) |

**Where the 11 original questions live (test-only).** Embedded ONLY as fixtures inside `gameTheory.test.ts` ("seed dataset" block) — the exact solver reproduces every documented Correct Answer (PD 2/7; backward-induction 6; Hotelling 50; beauty 0; 2×2 value 2.8; 3×2 value 2.5; Volunteer 0.0625; and the reasoning-only scalars stag-hunt m=2/3 and folk-theorem δ*=3/7). They are **never** imported by any generator/level/page; all user-facing items are freshly generated with different names/numbers.

## Game Puzzle — `src/content/probabilityStats/gamePuzzle/`

A small betting/odds-puzzle subcategory (now interleaved into the merged **Game Theory & Puzzles** section — see the consolidation note above). `puzzles.ts`: `rigBagsClosedForm` + `rigBagsOptimum` (independent brute-force optimum over all two-bag splits), `impliedProbabilitySum` / `hasArbitrage` (implied prob `1/o`; arb ⇔ sum < 1). Three playable levels (`gp-1 … gp-3`):

| Level | Family | Mode | Notes |
|---|---|---|---|
| `gp-1` Rig the Bags | probability optimization | `numeric` | `P(win)=½·f₁+½·f₂`; lone-gold trick; 2-dp |
| `gp-2` Spotting Arbitrage | implied-probability sum | `numeric` | The one verifiable scalar in the arbitrage family |
| `gp-3` Betting Strategy Desk | arbitrage build / value / parimutuel | `flashcard` | Open-ended; **source firms preserved as metadata** (multi-tag) |

**Distractor taxonomy:** Rig the Bags → `0.5` (mirror/full-separation coin flip), overall gold fraction `G/26`, bag-2 fraction only `(G−1)/25` (forgot the ½·1 term), `G/50` (isolated a *losing* token). Arbitrage → added the odds `o₁+o₂`, net-odds slip `1/(oᵢ−1)`, favourite-only `1/o₁`. The 4 original questions live ONLY in `gamePuzzle.test.ts` (test-only); the arbitrage/parimutuel flashcards are newly-written scenarios that keep the dataset's company tags (Citadel Securities / Jane Street / Akuna Capital / Flow Traders) in `source` metadata only — no companies synthesized where the dataset lists none.

## Numeric-mode extension (non-integer answers) — additive

To reuse the `"numeric"` mode for game values (2.8) and probabilities (0.0625), `NumericQuestion` gained an optional `decimals?: number`. When set, the answer may be a clean non-integer and grading rounds both sides to that precision (`numericMatches` / `formatNumericAnswer` in `src/lib/numeric.ts`) — no float flakiness, and the Kelly integer path is unchanged (`decimals` omitted ⇒ exact `===`). `LessonPage` shows a neutral "Your answer" label + decimal formatting when `unit !== "$"`. `levels.test.ts` allows non-integer answers only when `decimals` is set. **`bettingSizing/` files were not touched.**

**Verification:** `gameTheory.test.ts` (20 tests) + `gamePuzzle.test.ts` (9 tests) — seed-dataset fixtures, generator re-derivation over 150 seeds (answer recomputed independently by the solver), and a distractor-traceability gate (each distractor recomputed from the named misconception set, distinct, `≠` answer). Full suite: **173 tests pass**; `npm run build` passes; headless smoke test (system Chrome via `playwright-core --no-save`, since removed) confirmed `/contents` lists all new levels and a non-integer numeric level + a flashcard level render/grade/reveal with no JS console errors.

<!-- ========================================================================= -->
<!-- APPENDED SECTION — Expected Value subcategory (SOP §1–6).                  -->
<!-- Added by the Expected Value content pass. Self-contained; does not modify  -->
<!-- any Kelly / Game Theory / Game Puzzle notes above.                         -->
<!-- ========================================================================= -->

## Expected Value — `src/content/probabilityStats/expectedValue/`

Fourth (and by far the largest) Probability & Statistics subcategory. Expected
Value is NOT one repeating template — the 85-question dataset spans **~25
distinct solution-method families** (optimal stopping, coupon collector, Wald's
identity, indicators + linearity, geometric/memorylessness, first-step
recursion, random-walk durations, geometric probability by area, conditional
expectation, CLT/variance, divergent-EV sentinels, coin-simulation procedures,
…). Content is therefore grouped by **family**. `ev.ts` is an **exact-rational**
solver (all ground truth via `fraction.js`, never floats) with one function per
family (`rerollDieEV`, `dieBustGameValue`, `oneRerollFeeEV`, `oneRerollUniformEV`,
`couponCollectorAll`/`Partial`, `expectedDistinctAfterDraws`, `expectedRecords`,
`harmonic`, `geometricEV`/`negBinomialEV`/`geometricMemorylessTotal`/`geometricSumEV`,
`expectedTrialsPairSame`/`OrderedPair`/`SuccessOnEven`, `waldEV`,
`symmetricWalkDuration`/`ReachProb`, `overlapProbTwoWindows`/`meetWithinProb`,
`maxOfDiceEV`/`uniformOrderStatEV`, `higherWhenDifferEV`, `dieSecondMoment`/`dieVariance`,
`convertAllEV`, `firstMarkerSpacingEV`, `stPetersburgSeries`/`convergentGeometricEV`).
`generators.ts` holds the parametric generators + per-family error taxonomy;
`levels.ts` wires **8 Candy-Crush levels** (all `section: "Expected Value"`).

**Eight playable levels** (`ev-1 … ev-8`), Easy → Hard, across all three modes:

| Level | Families clustered | Mode | Why this mode |
|---|---|---|---|
| `ev-1` Dice & Coin Foundations | elementary prob, EV over dice distribution, conditional max | `quiz` | The 1/N-vs-1/N² trap & probability weighting are *naming-the-mistake* lessons |
| `ev-2` Stop or Roll Again | optimal stopping (discrete + continuous reroll) | `numeric` | Clean exact game values (5.5, 5.95, 5M/8) |
| `ev-3` Waiting Games | geometric, negative binomial, first-step recursion, Wald running-sum, memorylessness, geometric-sum, convert-all | `numeric` | Exact scalar waits (1/p, r/p, (1+p)/p², m+1/p) |
| `ev-4` Indicators & Linearity | coupon collector, distinct counts, records/harmonic, empty boxes, spacings, solve-for-n | `numeric` | Exact counts via `Σ P(event)` |
| `ev-5` Distributions, Variance & CLT | E[X²], head×tail product, exponential moments, uniform sums, variance addition | `quiz` | *Naming* the E[X²]≠(E[X])² and variance-addition mistakes |
| `ev-6` Conditional & Geometric Prob. | conditional geometric race, overlap/meeting areas, order statistics, max of dice | `numeric` | Exact areas & order-stat scalars |
| `ev-7` Random Walks & Martingales | gambler's ruin prob i/N, duration i(N−i), Wald, martingale doubling | `quiz` | *Naming* i·N-vs-i(N−i), reach-vs-duration, "no system beats a fair game" |
| `ev-8` Infinity & Simulation Desk | divergent-EV sentinels + coin-simulation procedures | `flashcard` | Answer is "infinite/diverges" or a PROCEDURE — never a graded scalar |

**Per-family misconception taxonomy** (every distractor re-derived through the
solver, distinct, `≠` answer):

| Family | Correct | Distractors = these specific misconceptions |
|---|---|---|
| Two-dice match | `1/N` | `1/N²` (fixed BOTH dice — the classic 1/36 trap); `2/N`; `1/(N−1)` |
| All-same coins | `1/2^(n−1)` | `1/2^n` (forgot all-H AND all-T); `1/2`; `1/2^(n+1)` |
| Three-dice payoff | prob-weighted EV | unweighted mean; positive-only (ignored the loss); best-case payoff |
| Higher-if-differ | conditional EV | full `E[max]` (forgot "else 0"); single-die mean; top face |
| Optimal stopping (reroll) | keep iff ≥ V | plain mean (ignored the option); reroll value V; the max face |
| Continuous reroll | `5M/8` | `M/2` (plain mean); `M`; `3M/4` (upper-half only, forgot the reroll branch) |
| Geometric / neg-binom | `r/p` | `1/p` (first only); `p`; `r(1/p − 1)` (counted failures only) |
| Two-in-a-row (general p) | `(1+p)/p² = N²+N` | `1/p² = N²` (fixed ordered pair, no self-overlap); `2N`; `N` |
| Memorylessness | `m + 1/p` | `1/p` (forgot elapsed m); `m`; `1/p − m` (subtracted, "getting closer") |
| Coupon collector | `n·H_n·cost` | `n·cost` (one box each); drop the last `1/1` term; boxes not cost |
| Distinct count | `n(1−((n−1)/n)^m)` | `min(m,n)` (all new); `n` (all types); `m` (ignored collisions) |
| Records | `H_n` | `n` (all kept); `1` (first only); `n/2` |
| Empty boxes | `B((B−1)/B)^K` | `B−K` (one ball each); `B(1/B)^K` (miss ⇄ hit swap) |
| Spacings (first marker) | `(D+1)/(c+1)` | `(D−c)/(c+1)` (forgot to turn the marker); `D/c` |
| Solve-for-n (windows) | `T·w! + (w−1)` | `T·w!` (dropped boundary); `T·w! + w` (window off-by-one) |
| Conditional geometric | `1/(1−q²)` | `1/p` (ignored conditioning); `1/(1−q)` |
| Overlap / meeting | area formula | `(a+b)/D` or `t/L` (1-D guess); independent-product; `(t/L)²` |
| Max of dice / order stat | tail-sum / `k/(n+1)` | single-die mean; top face; `k/n` (÷ points, not points+1) |
| E[X²] / variance | `Var + mean²` | `(E[X])²` (forgot Var); `Var` alone; `E[X]` |
| Exponential moment | `2/λ²` | `1/λ²` (forgot the ×2); `1/λ`; `2/λ` |
| Sum of uniforms | `kL/2` | `L/2` (forgot ×k); `kL` (uniform mean = L?); `L` |
| CLT variance | `Var(D)+Var(H)` | `|Var(D)−Var(H)|` (subtracted — "difference"); one term only |
| Walk reach prob | `i/N` | `(N−i)/N` (other wall); `1/2`; `i/(N−i)` (odds, not prob) |
| Walk duration | `i(N−i)` | `i·N` (dropped −i); `(N−i)²`; `N` (just the width) |
| Wald (roll-until-repeat) | `(1+N)·(N+1)/2` | `N·(N+1)/2` (used 1/p not 1+1/p); mean only; count×N (wrong term value) |
| Martingale doubling | `0` | `+1` (win path only); `−(2^k−1)` (ruin only); whole bankroll |

**Special cases the pipeline handles (per PRD §6A / SOP §4):**
- **Divergent-EV sentinels** (dataset `−1`): *Tripling Die* (EV74) & *Widening
  Wheel* (EV85). We NEVER surface `−1` as a numeric target — they are `ev-8`
  **flashcards** whose revealed answer is "infinite / diverges," with the
  tempting FINITE analog (a convergent doubling-prize / geometric sum) called
  out as the trap. The solver represents them via `stPetersburgSeries`
  (verdict `diverges = perTerm ≥ 1`) and `convergentGeometricEV` (the finite
  trap); the test asserts `perTerm ≥ 1` for the divergent games and that the
  doubling analog converges.
- **Procedure/formula answers** (Biased Coin #2/#3/#5 = EV11/EV12/EV14, plus #1
  Von Neumann and #4 rejection): routed as `ev-8` **flashcards** that reveal the
  PROCEDURE (Von Neumann extractor with `E[flips]=1/(p(1−p))`, dyadic `k/2ⁿ`
  mapping, 4-flip rejection → 32 flips, irrational binary expansion) — never
  scalar-graded.
- **Two reconstructed answers** spot-checked in the fixture: *Other Than Six*
  (EV49 → 3 = mean of {1..5}) and *Two Consecutive Fives* (EV76 → 72 =
  `expectedTrialsPairSame(1/8)`). Both are asserted in `expectedValue.test.ts`,
  and both families ship as generators (`genOtherThan`, `genPairSame`).

**Where the 85 original questions live (test-only).** Embedded ONLY as the
`SEED_ANSWERS` fixture inside `expectedValue.test.ts` (all 85 answers, including
the two `−1` sentinels and the two `(computed)` reconstructions). The exact
solver reproduces every documented answer (family by family), with explicit
spot-checks of the two reconstructions and the two divergent sentinels. They are
**never** imported by any generator/level/page — every user-facing item is a
freshly generated instance with different names/numbers. (`ev.ts` / `generators.ts`
carry no dataset prompt text; grepping the source for original question wording
returns nothing outside the test fixture.)

**Verification** (`expectedValue.test.ts`, 63 tests): (1) a **seed-dataset
gate** — all 85 answers captured, the two sentinels flagged, and the exact
solver reproduces the documented answers family by family; (2) **independent
re-derivation** of every generator over 60 seeds — each generator id encodes its
parameters, and the test recomputes the answer a SECOND way (raw closed form)
and asserts equality; (3) a **distractor-traceability gate** — every numeric
`commonError` is finite, mutually distinct, `≠` the answer at grading precision,
and its targeted feedback fires; every quiz option set is distinct (no leak),
the correct choice re-derives, and each distractor `≠` the key; (4)
**numeric-grading** round-trips via `gradeNumeric`. The level contract is
enforced generically in `src/content/levels.test.ts`, plus an
Expected-Value-specific block (8 levels, all `section: "Expected Value"`, all
three modes present, Easy→Hard ramp, wired into the aggregator exactly once).

<!-- ========================================================================= -->
<!-- APPENDED SECTION — Conditional Probability subcategory (SOP §1–6).         -->
<!-- Added by the Conditional Probability content pass. Self-contained; does    -->
<!-- not modify any note above.                                                 -->
<!-- ========================================================================= -->

## Conditional Probability — `src/content/probabilityStats/conditionalProbability/`

Fifth Probability & Statistics subcategory. Conditional probability is NOT one
repeating template — the 45-question dataset spans a cluster of solution-method
**families**: reduced sample space / equally-likely counting, Bayes' theorem,
law of total probability, continuous conditioning, competing-events / race
conditioning, first-step recursion, the Russian-Roulette series, two-child
framing paradoxes, and counterintuitive classics (Monty Hall, Bertrand's box).
Content is grouped by **family**. `cp.ts` is an **exact-rational** solver (all
ground truth via `fraction.js`, never floats) with one function per family
(`reducedProb`, `tableAboveThresholdProb`, `exactlyKGivenAtLeastOne`,
`allOnGivenAtLeastOne`, `diceSumFaceProb`, `bothGivenAtLeastOne`,
`bertrandGreenProb`, `orderingConditionalProb`, `chipChainProb`,
`bayesPosterior`/`bayesInversion`/`bayesUnionCause`/`posteriorWeightedNextSuccess`,
`lawTotalProb`, `uniformConditional`, `raceProb`/`secondMoverFirstTossGivenWin`/
`tieBreakerProb`/`absorbingFirstStep`/`htTailWinnerFirstPlayer`,
`rrFixedFirstSurvives`/`rrRespunSecondSurvives`/`rrTwoRandomDecision`/
`rrTwoConsecutiveDecision`, `atLeastOneBoyBothBoys`/`specificChildBothProb`,
`vacantRoomProb`, `montyHallSwitchProb`). `generators.ts` holds the parametric
generators + per-family error taxonomy; `levels.ts` wires **6 Candy-Crush
levels** (all `section: "Conditional Probability"`), appended after Expected
Value in the flat path.

**Six playable levels** (`cp-1 … cp-6`), Easy → Hard, across all three modes:

| Level | Families clustered | Mode | Why this mode |
|---|---|---|---|
| `cp-1` Reduced Sample Space | reduced sample space, conditional counting, Bertrand box, at-least-one, ordered pairs | `quiz` | The reversed-conditional (Pine) & ordered-vs-unordered & faces-not-objects traps are *naming-the-mistake* lessons |
| `cp-2` Bayes' Theorem | test/base-rate, which-die, cheer-for-a-loser, inversion | `quiz` | *Naming* base-rate neglect & likelihood-as-posterior |
| `cp-3` Total Probability & Continuous | transfer LOTP, mixture LOTP, uniform conditioning | `numeric` | A clean probability is the point (0.64, 0.25, …) |
| `cp-4` Races & Recursion | sum race, geometric-race conditioning, tie rules, first-step recursion | `numeric` | Exact scalars a/(a+b), 1−q², 2/(N+1), 1/(2−w) |
| `cp-5` Russian Roulette | fixed cylinder, re-spun, two-random spin decision, two-consecutive spin decision | `quiz` | Survival probs **and** the spin/no-spin **decisions** (RR#3/#4) — never scalar-graded |
| `cp-6` Paradoxes & Classics | two-child (two-part), Monty Hall (decision+prob), Bertrand, Vacant Room | `flashcard` | Answer is a contrast (1/3 vs 1/2) or a decision — reveal + self-assess |

**Per-family misconception taxonomy** (every distractor re-derived through the
solver, distinct, `≠` answer). The dataset-flagged hard-negatives are used as
canonical distractors:

| Family | Correct | Distractors = these specific misconceptions |
|---|---|---|
| Reduced-sample table | `#(A∩B)/#B` | **`fav/4` — the REVERSED conditional (Pine Property trap, P(above\|Pine)=4/4=1)**; `fav/16` (no conditioning); `total/16` (P(above)) |
| At-least-one (Rolling Six) | `1/(2N−1)` | **`1/N` (naive independence, 1/6)**; `1/N²` (unconditional); `2/(2N−1)` (double-counted the diagonal) |
| Given-sum (ordered) | `fav/#ordered` | **unordered halving (Six-Before-Eleven ordered-vs-unordered)**; `1/#ordered`; `fav/N²` (no conditioning) |
| Bertrand's box (faces) | `2g/(2g+m)` | **naive `g/(g+m)` by OBJECTS**; `1/2`; complement `m/(2g+m)` |
| All-on / bulbs | `1/(2ⁿ−1)` | `1/2ⁿ` (unconditional); `1/n`; `1/(2ⁿ+1)` (sign of correction) |
| Bayes test | posterior | **base-rate neglect = sensitivity**; specificity; joint (forgot to normalize) |
| Which-die Bayes | `N₂/(N₁+N₂)` | **likelihood `1/N₁` as posterior**; prior ½; reversed `N₁/(N₁+N₂)` |
| Cheer-for-a-loser | loss-weighted posterior | **prior 1/3 (ignored evidence)**; win-weighted; un-normalized likelihood |
| Bayes inversion | `P(B\|A)P(A)/P(B)` | **reversed `P(B\|A)` (prosecutor's fallacy)**; joint; prior alone |
| Transfer LOTP | `Σ P(move)P(dark\|move)` | ignored the transfer; assumed dark moved; P(moved dark) |
| Mixture LOTP | share-weighted | **equal 50/50 average**; one line only |
| Continuous uniform | `w/(b−g)` | **memoryless `w/(b−a)`**; `w/b`; elapsed `g/b` |
| Sum race | `a/(a+b)` ordered | **unordered counts**; single-roll `a/36`; ½ |
| Geometric-race first toss | `1−q²` | unconditional `qp`; `p`; denominator `P(win)` |
| Tie-breaker | `2/(N+1)` | single-round `ties/N²`; ½; wrong total |
| First-step recursion | `1/(2−w)` | `w` (one turn only); ½; `w/(1+w)` (wrong recursion) |
| RR fixed | `⌊c/2⌋/c` | ½ (ignores odd-chamber asymmetry); `⌈c/2⌉/c` (shot prob); `1/c` |
| RR re-spun | `1/(2−p)=c/(2c−1)` | first-player survival `(c−1)/(2c−1)`; ½; single-pull `1/c` |
| RR#3 (2 random) | **DECISION: spin** (1/3<2/5) | keep (2/5); "no difference" |
| RR#4 (2 consecutive) | **DECISION: don't spin** (3/4>2/3) | spin (2/3); "no difference" |

**Special cases the pipeline handles (per PRD §6A / SOP §4):**
- **Russian Roulette #3/#4 are DECISIONS**, not scalars. Solvers
  `rrTwoRandomDecision` / `rrTwoConsecutiveDecision` return both compared
  probabilities plus a `shouldSpin` boolean; they surface as `cp-5` **quiz**
  items whose options are "Spin / Don't spin / No difference" (the compared
  probabilities live in the reveal/explanation). Never scalar-graded.
- **Child's Gender is a TWO-PART answer** (1/3 vs 1/2) — the whole point is that
  "at least one boy" and "saw one specific boy" condition differently. Solvers
  `atLeastOneBoyBothBoys` (1/3) and `specificChildBothProb` (1/2); it ships as a
  `cp-6` **flashcard** that contrasts both framings. The fixture stores it as a
  tuple `[1/3, 1/2]`, never collapsed to one number.
- **Monty Hall is a decision + probability** ("2/3 (switch)"): `cp-6`
  **flashcard** with `montyHallSwitchProb(3)=2/3` correct and **½ called out as
  the canonical trap** (ignoring the host's constrained action).

**Where the 45 original questions live (test-only).** Embedded ONLY as the
`SEED_ANSWERS` fixture inside `conditionalProbability.test.ts` (all 45 answers,
including the two RR decisions as strings, Child's Gender as a `[1/3,1/2]` tuple,
and Monty Hall as `"2/3 (switch)"`). The exact solver reproduces every
documented answer family by family (the two flagged tables — Airport & Pine —
are transcribed verbatim and their reversed-conditional / ordered-vs-unordered
traps are asserted explicitly). They are **never** imported by any
generator/level/page — every user-facing item is a freshly generated instance
with different names/numbers/framing, and a source-fingerprint guard asserts no
verbatim dataset wording leaks into generated prompts.

**Verification** (`conditionalProbability.test.ts`, 46 tests): (1) a
**seed-dataset gate** — all 45 answers captured, the three non-scalar specials
represented as decision/tuple, and the exact solver reproduces the documented
answers family by family; (2) **independent re-derivation** of every generator
(7 numeric, 13 quiz) over 60 seeds — each id encodes its parameters and the test
recomputes the answer a SECOND way (raw closed form) and asserts equality;
(3) a **distractor-traceability gate** — every numeric `commonError` is finite,
mutually distinct, `≠` the answer at grading precision with its feedback firing;
every quiz option set is distinct (no leak), the correct choice re-derives, and
each distractor `≠` the key; (4) **numeric-grading** round-trips via
`gradeNumeric`; (5) a **source-fingerprint guard**. The level contract is
enforced generically in `src/content/levels.test.ts`, plus a Conditional-
Probability-specific block (6 levels, all `section: "Conditional Probability"`,
all three modes present, Easy→Hard ramp, wired into the aggregator exactly once
after Expected Value). Full suite: **304 tests pass** (was 248); `npm run build`
passes.

<!-- ========================================================================= -->
<!-- APPENDED SECTION — Markov Chain Probability subcategory (SOP §1–6).        -->
<!-- Added by the Markov Chains content pass. Self-contained; does not modify   -->
<!-- any note above.                                                            -->
<!-- ========================================================================= -->

## Markov Chain Probability — `src/content/probabilityStats/markovChains/`

Sixth Probability & Statistics subcategory. Every item in the 16-question
dataset is an absorbing-Markov-chain setup solved by **first-step analysis**
(E[s] = 1 + Σ P(s→s')·E[s'], E = 0 at absorbing states) or the **gambler's-ruin
recurrence**. The dataset spans three **families**: expected hitting time
(coin-pattern waits, small walks on a line / cube / octagon / 2-D grid, spinners,
two-state return, birthday-repeat), gambler's ruin / reaching a target, and
pattern races. `markov.ts` is an **exact-rational** solver (`fraction.js`, never
floats) built around a general exact linear solver (`solveLinearFraction`) and
matching float solver (`solveLinearFloat`), with `expectedAbsorptionTime` /
`absorptionProbability` doing first-step analysis on any small chain, plus
family closed forms (`runWaitExpected` = (1−pⁿ)/(pⁿ(1−p)) = 2^{n+1}−2 for a fair
coin, `twoInARowExpected` = (1+p)/p², `twoStateReturnExpected`,
`spinnerTwoDistinctExpected` = 1 + Σ P/(1−P), `lineWalkExpected` = i·(N−i),
`cubeWalkExpected`, `polygonOppositeExpected`, `grid2DCenterExpected` /
`…Float`, `expectedDrawsUntilRepeat`, `gamblerRuinReach` = (1−rᵏ)/(1−rᴺ),
`boldPlayReachProb`, `drunkardFallProb` (piecewise), and Conway's
`patternWaitExpected` / `patternRaceProb`). `generators.ts` holds the parametric
generators + per-family error taxonomy; `levels.ts` wires **6 Candy-Crush
levels** (all `section: "Markov Chains"`), appended after Conditional
Probability in the flat path.

**Six playable levels** (`mc-1 … mc-6`), Easy → Hard, across all three modes:

| Level | Families clustered | Mode | Why this mode |
|---|---|---|---|
| `mc-1` First-Step Analysis | two-state return, spinner (two distinct regions), symmetric line walk | `numeric` | A clean expected value is the point (1.25, 2.55, small integers) |
| `mc-2` Coin Pattern Waits | run of n (2^{n+1}−2), two-in-a-row ((1+p)/p²), reset chain | `numeric` | Exact waits (14, 30, 9.78) |
| `mc-3` Pattern Races & Overlap | Conway pattern wait, Conway pattern race | `quiz` | *Naming* the "THH behaves like HHH" overlap trap & the naive-½ race trap |
| `mc-4` Random Walks on Graphs | cube (10), polygon-with-stay, 2-D grid center→boundary | `numeric` | Exact hitting times via symmetry + linear solve |
| `mc-5` Gambler's Ruin | biased reach-target, bold play | `quiz` | *Naming* the symmetric-k/N trap & bold-vs-timid |
| `mc-6` Markov Reasoning Desk | Drunkard's Walk (piecewise), birthday-repeat bet, overlap/edge intuition | `flashcard` | Answer is piecewise or a judgment + number — reveal + self-assess |

**Per-family misconception taxonomy** (every distractor re-derived through the
solver, distinct, `≠` answer):

| Family | Correct | Distractors = these specific misconceptions |
|---|---|---|
| Two-state return | `1 + (1−pS)/(1−pO)` | **forgot the +1**; other-state run-length `1/(1−pO)`; naive geometric `1/(1−pS)` |
| Spinner (two distinct) | `1 + Σ P/(1−P)` | **dropped the leading +1**; the minimum `2`; unweighted `Σ 1/(1−P)` |
| Line walk | `i·(N−i)` | distance to nearer edge (min steps); off-by-one boundary `i·(N−1−i)`; the width |
| Run of n (fair) | `2^{n+1}−2` | **`2ⁿ` (1/pⁿ naive)**; **`2n` (n/p — a failure "costs one step")**; `2^{n+1}−1` (off-by-one) |
| Two-in-a-row (p) | `(1+p)/p²` | **`1/p²` (forgot the +1 term / pure geometric)**; `2/p`; `1/p` (one success) |
| Reset chain | `2^{k+1}−2` | **`2k` (n/p — reset "costs one")**; `2ᵏ`; off-by-one |
| Pattern wait (Conway) | `2·corr(A,A)` | **`2^{L+1}−2` (treat every length-L pattern like HHH)**; `2ᴸ` (1/pᴸ); `2L` |
| Pattern race (Conway) | overlap odds | **naive `½`**; reversed `1−P` (other pattern); speed-weighted `E_B/(E_A+E_B)` |
| Cube walk | `10` | distance `3`; vertex count `8`; distance-1 time `9` |
| Polygon walk | distance-chain solve | distance `sides/2` (min moves); **ignored the "stay" (÷(1−P(stay)))**; `(sides/2)²` |
| 2-D grid | interior linear solve | distance `m`; **`m²` (the 1-D exit time — 2-D has more escape routes)**; width `2m` |
| Gambler's ruin (biased) | `(1−rᵏ)/(1−rᴺ)` | **symmetric `k/N` (fair-game formula used when p≠½)**; inverted `r=p/q`; reversed player `1−P` |
| Bold play | solved chain | **timid unit-stake ruin value** (bold beats it when p<½); symmetric `start/target`; `p` itself |

**Special cases the pipeline handles (per PRD §6A / SOP §4):**
- **Escape the Square** (11×11 2-D grid, 29.24): solved by the general
  first-step linear system. `grid2DCenterExpectedFloat(5)` reproduces
  534525/18281 ≈ **29.24** fast; the exact rational `grid2DCenterExpected` backs
  the small gameplay grids (m ∈ {2,3}). The generator ships modest grids
  (`numeric`, decimals) rather than the full 81-unknown system.
- **Top 2000 Songs** (birthday back-recursion, 56.72): `expectedDrawsUntilRepeat`
  iterates E[k] = 1 + ((N−k)/N)·E[k+1] from E[N]=0; for N=2000 → **56.72**. Ships
  as an `mc-6` **flashcard** (a bet-safety judgment + the number), never
  scalar-graded.
- **The Drunkard's Walk** (semi-infinite gambler's ruin) is **PIECEWISE**:
  `drunkardFallProb` returns 1 for p ≤ ½ (certain fall) and (1−p)/p for p > ½
  (→ 1/2 at p=2/3). Ships as an `mc-6` **flashcard** that states BOTH cases and
  calls out the "a 2:1 push away means escape is likely" trap.

**Where the 16 original questions live (test-only).** Embedded ONLY as the
`SEED_ANSWERS` fixture inside `markovChains.test.ts` (all 16 answers, with the
Drunkard's-Walk 0.5 documented as the p=2/3 piecewise value and Top 2000 Songs
as ≈56.72). The exact solver reproduces every documented answer family by family
(incl. Escape the Square 29.24, Bold Betting 29/77, Dominant Game ≈0.999,
Drunkard's Walk 0.5 + certain-fall for p≤½, Top 2000 56.72). They are **never**
imported by any generator/level/page — every user-facing item is a freshly
generated instance with different names/numbers/framing, and a
source-fingerprint guard asserts no verbatim dataset wording (e.g. "Random Ant",
"Escape the Square", "Drunkard", "regular octagon") leaks into generated prompts.

**Verification** (`markovChains.test.ts`, 31 tests): (1) a **seed-dataset gate**
— all 16 answers captured and reproduced family by family; (2) **independent
re-derivation** of every generator (9 numeric, 4 quiz) over 60 seeds — each id
encodes its parameters and the test recomputes the answer a SECOND way (raw
closed form for the run/reset/two-in-a-row/two-state/line/spinner families,
Conway for patterns) and asserts equality; (3) a **distractor-traceability gate**
— every numeric `commonError` is finite, mutually distinct, `≠` the answer at
grading precision with its feedback firing; every quiz option set is distinct
(no leak), the correct choice re-derives, and each distractor `≠` the key; (4)
**numeric-grading** round-trips via `gradeNumeric`; (5) a **source-fingerprint
guard**; (6) a **flashcard well-formedness** check for the reasoning specials.
The level contract is enforced generically in `src/content/levels.test.ts`, plus
a Markov-Chains-specific block (6 levels, all `section: "Markov Chains"`, all
three modes present, Easy→Hard ramp, wired into the aggregator exactly once
after Conditional Probability). Full suite: **345 tests pass** (was 304);
`npm run build` passes.

<!-- ========================================================================= -->
<!-- APPENDED SECTION — General subcategory (SOP §1–6).                         -->
<!-- Added by the General content pass. Self-contained; does not modify any     -->
<!-- note above.                                                                -->
<!-- ========================================================================= -->

## General — `src/content/probabilityStats/general/`

> **⚠️ SUPERSEDED (Probability/Math track restructure).** The `general/` folder
> has been **dissolved** and every family re-homed into a coherent topic; the
> section `"General"` no longer exists. The solver library moved to
> `probabilityStats/coreSolvers.ts` and the generator scaffolding to
> `probabilityStats/coreScaffold.ts`. See the appended **"Probability/Math track
> restructure"** section at the bottom of this file for the full
> General→topic mapping, the new focused topics, and the difficulty ordering.
> The notes below are retained as the historical record of the original design.

**Seventh** (and largest / most heterogeneous) Probability & Statistics
subcategory: **67** core quant-interview probability questions spanning ~14
families (CLT & concentration, binomial counting, complement/at-least-one,
birthday/collision, geometric probability, digit counting, dice sums & symmetry,
gambler's ruin, random walk/recursion, game-theory/optimizing agents,
covariance/variance, uniform order statistics, tournaments & arrangements, and
counting/expectation misc). Unlike Kelly (one formula) or Markov (one method),
General is a **grab-bag of distinct techniques**, so content is clustered by
cohesive SKILL, not a single schema.

**Placement.** `general.ts` is the exact/precise solver — **rational via
`fraction.js`** for everything rational (binomial tails `binomTailLE/GE`,
complements `bothColorsProb`/`containsDigitProb`/`productEvenProb`, birthday
`birthdayThreshold`/`birthdayCollisionProb`, geometric `diskOuterProb`/
`tileFitProb`/`meetingProb`/`glanceCatchProb`, digit counting, dice
`diceSumLEProb`/`evenHeadsProb`/`secondLessProb`/`biggerDieProb`, ruin
`gamblerRuinReach`, walks `allForwardProb`/`deuceWinProb`/`restartGameProbs`,
variance `maxCovariance`/`affineCorrelation`/`varLinearCombo`/`twoDrumSumSD`,
order stats `minInIntervalProb`/`orderingProb`, brackets
`topTwoSeedsMeetFinalProb`/`round1MeetProb`/`commonSemicircleProb`/
`polygonNoCollisionProb`, counting `couponCollectorExpected`/
`expectedWordsAfterMerges`/`consecutiveRunProb`/`higherCardProb`/
`twoInARowScheduleProb`/`absDiffInRangeProb`/`notAorNotBProb`/`diagonalDuelProb`/
`ascendingGame`, plus the two agent optima `optimizeTwoAgent` /
`optimalSpreadGeneral`) — and **plain floats ONLY** for the genuinely
transcendental targets (`normalCdf`/`cltUpperTail`/`cltDifferenceZ` for CLT Φ
values, `exponentialMedian` = ln2/λ, and `jumpingRobotsRoot`, a Newton solve of
`(x³−3x+2)eˣ=3x`). The parametric generators + per-family distractor taxonomy
are split across **five files** (`genComplement.ts`, `genDiceGeo.ts`,
`genRuinVar.ts`, `genCounting.ts`, `genCltAgents.ts`) sharing `_shared.ts`
(`assembleChoices`, `numericErrors`, `numDp`, `mix*`); reasoning specials live in
`flashcards.ts`. Wired into `src/content/probabilityStats/index.ts` with **one
import + one spread** (`generalLevels`), appended after `markovChainsLevels`.

**Twelve playable levels** (`gen-1 … gen-12`), all `section: "General"`,
Easy→Hard (3 easy, 6 medium, 3 hard), across all three modes:

| Level | Families clustered | Mode | Why this mode |
|---|---|---|---|
| `gen-1` Complement & At-Least-One | both-colour draws, digit occurrence, sub-interval scaling, even product, smallest-n | `numeric` | clean scalar (0.765, 0.4686, 0.6, 0.875, 19) |
| `gen-2` Binomial & Digit Counting | binomial tails, all-different-digits, ones>tens | `numeric` | tails (0.584, 0.980) + counted fractions |
| `gen-3` Symmetry & Geometry Traps | dice-sum counting, ½-by-symmetry, die-tie, **area-vs-linear** | `quiz` | *naming* the ½ and r-vs-r² traps |
| `gen-4` Geometric Probability | tile-fit, meeting-window, cyclic glance | `numeric` | area/length ratios (0.36, 0.16, 0.15) |
| `gen-5` Uniform Order Statistics | min-in-interval, ordering 1/n! | `numeric` | (0.297, 0.296, 1/6) |
| `gen-6` Random Walks & Recursion | all-forward walk, deuce recursion, restart game | `numeric` | (0.125, 0.307, 0.583) |
| `gen-7` Tournaments & Arrangements | bracket final, round-1 pairing, semicircle, ring no-collision | `numeric` | (8/31, 1/15, 5/16, 1/16) |
| `gen-8` Counting, Expectation & Variance | coupon collector, linearity, incl–excl runs, higher-card, De Morgan, Exp median, Var(aX+bY) | `numeric` | (14.7, 15, 0.171, 0.47, 0.9, 0.173, 30) |
| `gen-9` Ruin, Covariance & Variance Traps | **biased-vs-fair ruin**, **Cauchy–Schwarz**, affine ρ, **SD-addition**, **variance-doubling z** | `quiz` | *naming* the four classic misfires + the difference-doubles-variance z (=−2) |
| `gen-10` CLT, Concentration & Spreads | CLT tail 1−Φ(z), Markov bound, optimal spread | `numeric` | hard scalars (0.00135, 0.8, 2/3) |
| `gen-11` Optimizing Agents & Market Making | maximize s₂p²+2s₁p(1−p) → p*=s₁/(2s₁−s₂) | `quiz` | *naming* the corner/½ optimization trap |
| `gen-12` General Reasoning Desk | the 8 SFT / non-scalar specials | `flashcard` | answers are ∞ / a market / a procedure / a decision / a fairness call / a Newton root |

**Per-family misconception taxonomy** (every distractor re-derived, distinct,
`≠` answer at grading precision) — the flagged hard-negatives are in **bold**:

| Family | Correct | Distractors = these specific misconceptions |
|---|---|---|
| Complement/at-least-one | 1 − P(none) | subtracted one colour (1−mono); **reported the OPPOSITE event** (2·mono); forgot the complement (9^L/10^L); linear per-position (L/10) |
| Binomial tail | 1 − P(X≤k−1) | **the opposite tail (forgot complement)**; single term P(X=k); off-by-one boundary |
| Geometric probability | area ratio r²/R² | **linear-vs-quadratic (r/R instead of r²/R²)**; complement; dimensional slip r²/R |
| Dice parity | ½ by symmetry | **messy near-½ binomial-sum values (over-complication trap)** |
| Die compare | (1−1/f)/2 | **ignored ties (½)**; P(tie)=1/f; P(not tie) |
| Gambler's ruin (biased) | (1−rᵏ)/(1−rᴺ) | **fair k/N used when p≠½**; inverted r=p/q; reversed player 1−P |
| Deuce | p²/(p²+(1−p)²) | p² (win-two-outright); p (one point); 2p(1−p) (the split → deuce) |
| Covariance ceiling | √(VarA·VarB) | **used the MEANS (red herrings)**; **VarA·VarB w/o sqrt**; averaged variances |
| Affine correlation | sign(b)sign(d)ρ | kept ρ (ignored sign flip); scaled by \|bd\| (magnitudes don't cancel) |
| Variance of a sum | √(σ_X²+σ_Y²) | **added SDs (σ_X+σ_Y)**; reported the variance; single-draw SD |
| Var of a combo | a²VarX+b²VarY | **forgot to SQUARE coefficients (a·VarX)**; added a spurious 2·Cov cross term |
| CLT difference z | −t/√(2nσ²) = −2 | **forgot the difference DOUBLES the variance (−t/√(nσ²))**; sign flip; divided by variance not its sd |
| CLT tail | 1 − Φ(z) | **Φ(z) (wrong tail)**; σ²=np (dropped 1−p); two-tailed 2(1−Φ) |
| Semicircle | n·½^{n−1} | ½^{n−1} (one anchor, forgot the n mutually-exclusive anchors); off-by-one exponent |
| Optimizing agent | s₁/(2s₁−s₂) | corner p=1 (over-participate); naive ½; wrong algebra |
| Optimal spread | (U+I)/(2U+I) | **½ (ignored adverse selection)**; the bid quote (1−X)/2; algebra slip |

**Special cases the pipeline handles (per PRD §6A / SOP §4).** All eight
SFT-not-RL / non-scalar specials ship as `gen-12` **flashcards** (reveal +
self-assess, never scalar-graded), with the numeric values pulled live from the
solvers:
- **GN32 How Many Children → Infinity.** `gen-fc-firstreturn` teaches why the
  first-return time returns a.s. yet has a **divergent** mean (heavy k^{−3/2}
  tail); no finite number is shipped.
- **GN37 Optimal Spread → a MARKET.** `gen-fc-market` gives the two-sided quote
  (bid 1/6, ask 5/6, spread 2/3); the scalar spread 2/3 ALSO ships as a numeric
  sub-question (`genOptimalSpread`, parametric in U:I via `optimalSpreadGeneral`).
- **GN38 Jumping Robots → Newton root.** `gen-fc-threshold-root` reveals
  `jumpingRobotsRoot().pZero` = **0.114845886** (9 dp), the solver's Newton solve
  of (x³−3x+2)eˣ=3x (x≈0.416195355).
- **GN43 Perfect Correlation → procedure** (`gen-fc-perfectcorr`: two distinct
  (X,Y) pairs solve X=aY+b).
- **GN44 Rainy Day → conditional** (`gen-fc-dependence`: 0.3 iff independent —
  ALSO the numeric `genInclExcl`/independent case — else demand the variances +
  correlation).
- **GN65 All-Boys City → stays 50%** (`gen-fc-stoppingrule`: a stopping rule
  can't bias a memoryless coin).
- **GN66 Tennis 2-or-3 Sets → decision** (`gen-fc-bestof3`: bet on 2 sets unless
  p=½, via (2p−1)²≥0).
- **GN67 Five Ascending → fairness + payout** (`gen-fc-fairpayout`: EV<0, fair
  payout **$119** from `ascendingGame(5,25,1)`).
- **GN2 Beta Gap → the Φ-argument a=−2** ships as the `genCltDiffZ` **quiz** (a
  signed answer, so routed to MC like the −0.6 affine correlation, with the
  variance-doubling −2.83 as the key distractor) — NOT numeric free-entry, which
  the app contract restricts to non-negative answers.
- **GN63 Exponential median → ln2/λ** ships as the parametric numeric
  `genExpMedian`.

**Where the 67 original questions live (test-only).** Embedded ONLY as the
`SEED_ANSWERS` fixture inside `general.test.ts` (67 documented answers; non-scalar
specials carry sentinels — `"Infinity"` for GN32, `NaN` for the pure-reasoning
GN43/65/66, and the spread/payout scalars for GN37/67). The exact/precise solver
reproduces every documented answer at its stated precision (incl. 230 Heads
0.00135 @5dp, Beta-Gap a=−2, Four-Digit-Difference 0.188 @3dp, Jumping Robots
0.114845886 @9dp, exponential median ln2/4). They are **never** imported by any
generator/level/page — every user-facing item is a freshly generated instance
(new themes/numbers/framing), and a **source-fingerprint guard** asserts no
verbatim dataset title/wording (e.g. "Clean Statue", "Twin Drums", "Jumping
Robots", "Optimal Spread", "All-Boys City", + all 60-odd titles) leaks into any
generated prompt.

**Verification** (`general.test.ts`, 118 tests): (1) a **seed-dataset gate** —
all 67 answers captured and reproduced family by family at the stated precision;
(2) a **second-independent-method** block (upper tail via direct summation,
outer-disk via (R²−r²)/R², meeting via 1−miss, semicircle via n·2^{1−n},
even-heads via 2^{n−1}/2^n, biased ruin via normalized geometric partial sums);
(3) **generator gates** over 40 seeds — numeric answers grade via `gradeNumeric`,
are finite/non-negative (integer & >0 when `decimals` omitted) and DETERMINISTIC
per seed, with every `commonError` finite, mutually distinct, `≠` the answer at
grading precision and its feedback firing; quiz option sets are distinct with an
aligned correct index + rationale; (4) a **source-fingerprint guard** over all
30 numeric + 10 quiz generators and the flashcard prompts; (5) **flashcard
well-formedness** for the 8 reasoning specials (unique ids, the Infinity /
two-sided-market / Newton-root / $119 reveals asserted). The level contract is
enforced generically in `src/content/levels.test.ts`, plus a General-specific
block (12 levels, all `section: "General"`, all three modes, Easy→Hard ramp,
wired into the aggregator exactly once after Markov Chains). Full suite: **479
tests pass** (was 345); `npm run build` passes.

<!-- ========================================================================= -->
<!-- APPENDED SECTION — Combinatorial Analysis subcategory (SOP §1–6).          -->
<!-- Added by the Combinatorial Analysis content pass. Self-contained; does not -->
<!-- modify any note above.                                                     -->
<!-- ========================================================================= -->

## Combinatorial Analysis — `src/content/probabilityStats/combinatorialAnalysis/`

**Eighth** Probability & Statistics subcategory: the **counting-heavy** set —
**51** questions across ~10 counting families (choose-k ratios, hypergeometric
draws, poker hands, binomial coin/dice counting, dice sums via stars-&-bars +
inclusion–exclusion, without-replacement/chain-rule, balance-scale symmetry,
grid/lattice-path & line counting, circular/arrangement counting, and the
multiplication principle, plus a coin-grab value-threshold count). Almost every
answer is EXACT, so the whole subcategory is built on an **exact combinatorics
core**.

**Placement.** `combinatorics.ts` is the exact core — **bigint** integer
combinatorics (`chooseBig`/`choose`, `factorialBig`, `multinomialBig`,
`fallingBig`, `powBig`) so C(52,10), C(260,3), C(310,k) numerators and
multinomials never overflow, plus **`fraction.js` v5 (BigInt-backed) rationals**
via `fracBig(num,den)` for exact probabilities, and a **log-space** binomial tail
(`binomTailLEFloat` + Lanczos `logGamma`) used ONLY for the big-n overbooked-
flight tail. `solvers.ts` holds one exact solver per family (e.g.
`oneOfEachColorProb`, `allSameColorProb`, `exactlyTwoColorsProb`,
`hyperExactlyProb`/`hyperNoneProb`/`hyperAtLeastProb`, `pokerHandCount`/
`pokerHandProb`/`pokerHandPercent`, `binomTailLE/GE`, `returnToOriginProb`,
`stepSequencesCount`, `latticeMeetingProb`, `raceConditionalWinProb`/
`coinRaceHeadsWinProb`, `diceSumEqualsProb`, `strictlyIncreasingProb`,
`topTwoMaxProb`, `atLeastKOfAKindProb`, `subsetSumsToProb`, `divisibleByModProb`,
`orderedDrawProb`, `pairsAgreeColorProb`, `dealUntilOneEachProb`,
`multiDeckStraightProb`, `heavierPanProb`, `lightsLineProb`,
`multinomialPathsCount`, `alternatingStepPathsCount`, `circularAscendingProb`,
`keepBothNeighborsProb`, `threeValuesGapProb`, `independentChoicesCount`,
`unionFixedBitsCount`, `deadlockSequencesCount`, `secretSharing`,
`coinGrabAtLeastProb`, `expectedPairsDealt`, `overbookedDeniedProb`,
`firstAllThreeOnDrawFourProb`, `nonDecreasingThreeDrawProb`). Parametric
generators + per-family distractor taxonomy split across **eight files**
(`genChooseK.ts`, `genHyper.ts`, `genPoker.ts`, `genBinomial.ts`, `genTraps.ts`,
`genGrid.ts`, `genArrangements.ts`, `genDiceSums.ts`) sharing `_shared.ts`
(`assembleChoices`, `numericErrors`, `mixNumeric`/`mixQuiz`); the non-scalar
specials in `flashcards.ts`. Wired into
`src/content/probabilityStats/index.ts` with **one import + one spread**
(`combinatorialAnalysisLevels`), appended after `generalLevels`.

**Nine playable levels** (`ca-1 … ca-9`), all `section: "Combinatorial
Analysis"`, Easy→Hard (3 easy, 4 medium, 2 hard), across all three modes:

| Level | Families clustered | Mode | Why this mode |
|---|---|---|---|
| `ca-1` Ratios of Combinations | one-of-each, all-same-color, exactly-two-colors, avoid-special parity, pair-sum threshold, single-assignment, deal-a-special-to-each | `numeric` | clean exact ratio |
| `ca-2` Hypergeometric Draws | exactly-j / none / at-least-j without replacement | `numeric` | exact hypergeometric scalar |
| `ca-3` Poker Hands | four-of-a-kind, full house, two pair, trips, one pair, flush | `quiz` | *naming* the suit-combo / ordered-rank miscounts (percent options) |
| `ca-4` Binomial Coin & Dice Counting | binomial tails, return-to-origin, step-sequence COUNTS, lattice meeting, race conditioning | `numeric` | counts & tails (incl. integer-count 792) |
| `ca-5` Counting Traps | perm-vs-comb, with/without replacement, non-decreasing ties, stars-&-bars cap | `quiz` | *naming* the four canonical miscounts |
| `ca-6` Grid & Lattice Path Counting | line-of-lit-cells, 3-D multinomial paths (13860), alternating-stride paths (25), divisibility-by-2ᵗ | `numeric` | exact counts + modular shortcut |
| `ca-7` Arrangements & Multiplication Principle | chain-rule ordered draw, deal-until, circular ascending, gap method, independent choices (243), incl–excl bit strings (448), balance-scale | `numeric` | chain-rule / kⁿ / incl–excl counts |
| `ca-8` Dice Sums: Stars & Bars + Incl–Excl | capped dice-sum, top-two-max, at-least-k-of-a-kind, subset-sum, strictly increasing, expected pairs | `numeric` | the hard multi-technique capstone |
| `ca-9` Combinatorial Reasoning Desk | secret-sharing (two-part), coin-grab (computed), overbooked tail (big-n), multi-deck straight, expected pairs | `flashcard` | answer is two-part / multi-technique — reveal + self-assess |

**Per-family misconception taxonomy** (every distractor re-derived through the
solver, distinct, `≠` answer at grading precision):

| Family | Correct | Distractors = these specific misconceptions |
|---|---|---|
| Choose-k ratio | favorable C(n,k)/C(N,k) | **permutations instead of combinations (P(n,k))**; **wrong denominator nᵏ (ordered w/ replacement)**; forgetting a color/count factor |
| Hypergeometric | C(m,j)C(N−m,k−j)/C(N,k) | **binomial-with-replacement approx C(k,j)(m/N)ʲ(1−m/N)ᵏ⁻ʲ**; wrong j (off by one); dropped the non-special multiplier |
| Poker hands | (ranks)×(suit combos)/C(52,5) | **forgot the C(4,2)/C(4,3) suit combos**; **ordered full-house ranks as C(13,2) (halving)**; forgot the two-pair kicker (44) |
| Binomial tail | Σ C(n,·)/2ⁿ | opposite tail (forgot complement); **included/excluded the tie boundary**; single term P(X=k) |
| Return-to-origin / step count | C(2n,n)/4ⁿ, C(steps,r) | naive ratio; off-by-one on r; wrong 2^(steps−1) denominator |
| Stars & bars (capped) | C(t−1,d−1) − incl–excl | **UNCAPPED stars & bars (forgot the ≤faces cap → overcount)**; ±1 shift; ordered slip |
| At-least-k-of-a-kind | 1 − (each value ≤ k−1) | **kept the complement (reported 1−answer)**; exactly-k only; birthday-style approx |
| Increasing / ties | C(faces,d)/faces^d | **1/d! (assumed distinct)**; **non-decreasing overcount (ties trap)**; wrong denom |
| Chain rule / ordered | ∏ shrinking fractions | with-replacement product; unordered C-ratio; forgot to decrement |
| Circular arrangement | 2/(n−1)! | one direction only 1/(n−1)!; linear 1/n!; 2/n |
| Gap method | C(anchors−2,f)/C(anchors,f) | only-one-gap-empty; complement; linear (anchors−2)/anchors |
| Multiplication principle | kⁿ | **nᵏ (swapped base/exp)**; k·n (added); off-by-one exponent |
| Inclusion–exclusion (bits) | 2^{L−p}+2^{L−s}−2^{L−p−s} | **forgot the −2^{L−p−s} intersection term**; one condition only; mis-added |
| Balance-scale symmetry | pair-count over C(5,2) | **½ (naive symmetry)**; ignored the boundary pair; complement |
| Linearity of expectation | ranks·P(indicator) | per-rank prob only (forgot ×ranks); naive deal/2; probability slip |

**Special cases the pipeline handles (per PRD §6A / SOP §4):**
- **Integer COUNTS, not probabilities** (CA4 = 504, CA6 = 448, CA33 = 13860,
  CA35 = 25, CA38 = 243, CA50 = 792): shipped as `numeric` with `decimals`
  OMITTED so grading is exact integer `===` (the app's [0,1]-probability rounding
  never touches them); the solvers return exact bigints and each is verified in
  the fixture. Generators `genStepCount`, `genMultinomialPaths`,
  `genAlternatingSteps`, `genIndependentChoices`, `genUnionFixedBits` emit
  integer-count instances (`answer = Number(bigint)`, positive integer).
- **Two-part answer** (CA11 Democratic Safe → 462 locks AND 252 keys/person):
  represented as the `ca-9` **flashcard** `ca-fc-secretsharing` (a fresh 7-of-4
  instance) whose reveal states BOTH the lock count C(n,t−1) and the per-person
  key count; the fixture stores it as the string `"462 locks / 252 keys"` and
  `secretSharing(11,6)` reproduces `{locks:462, keysPerPerson:252}`. Never a
  single scalar.
- **Percent-form** (CA29 0.024%, CA30 0.144%, CA31 4.754% ≈ decimal 0.048):
  NORMALIZED to a consistent **percent** representation — `pokerHandPercent`
  returns the probability ×100 and `ca-3`/its options display "X.XXX%"; the
  fixture verifies the percents to 3 dp AND CA31's decimal 0.048 via
  `pokerHandProb`.
- **Computed / unverified** (CA2 90 Cents = 9/14 ≈ 0.643, dataset-flagged
  `(computed)` with no source solution): independently re-derived by
  `coinGrabAtLeastProb` (exact enumeration of all C(8,3)=56 three-coin subsets;
  36 clear 90¢). **Our derivation AGREES with 9/14** (asserted `.equals(F(9,14))`
  in the fixture). Shipped as the `ca-fc-coingrab` flashcard.
- **Big binomials** (C(52,10) for CA45, C(260,3) for CA13, and the CA25
  overbooked-flight tail over Bin(310, 0.05)): handled with exact bigint
  `chooseBig` (no overflow) for CA45/CA13, and a **log-space** tail
  (`overbookedDeniedProb` → `binomTailLEFloat`) for CA25, verified ≈ **0.051** at
  3 dp.

**Where the 51 original questions live (test-only).** Embedded ONLY as the
`SEED_ANSWERS` fixture inside `combinatorialAnalysis.test.ts` (all 51 answers,
the six integer counts flagged, CA11 as a two-part string, the percents, and the
computed CA2). The exact solvers reproduce every documented answer at its stated
precision. They are **never** imported by any generator/level/page — every
user-facing item is a freshly generated instance with different
names/numbers/framing, and a **source-fingerprint guard** asserts no verbatim
dataset title/wording (e.g. "Air Hockey Deadlock", "Democratic Safe", "Rooftop
Drone", "Running Rabbit", "Binary Bookends", "Wheel of Eights", "Button Tin",
"Picking Balls", "Lights On", "Sum Seventeen", …) leaks into any generated
prompt.

**Verification** (`combinatorialAnalysis.test.ts`): (1) a **seed-dataset gate** —
all 51 answers captured (with the integer-count routing check) and reproduced
family by family at the stated precision, incl. CA45/CA13 big binomials, CA25 log-
space tail ≈0.051, the poker percents, CA11 two-part, and the computed CA2 = 9/14;
(2) **generator gates** over many seeds — numeric answers grade via
`gradeNumeric`, are finite/non-negative (integer & >0 when `decimals` omitted) and
DETERMINISTIC per seed, with every `commonError` finite, mutually distinct, `≠`
answer at grading precision and its feedback firing; quiz option sets distinct
with an aligned correct index + rationale; (3) a **source-fingerprint guard**
over all numeric + quiz generators and the flashcard prompts; (4) **flashcard
well-formedness** for the reasoning specials. The level contract is enforced
generically in `src/content/levels.test.ts`, plus a Combinatorial-Analysis
block (9 levels, all `section: "Combinatorial Analysis"`, all three modes,
Easy→Hard ramp, wired into the aggregator exactly once after General).

<!-- ========================================================================= -->
<!-- APPENDED SECTION — Probability/Math track restructure (General dissolved   -->
<!-- + difficulty reorder). Supersedes the "General" section above.             -->
<!-- ========================================================================= -->

## Probability/Math track restructure — General dissolved + difficulty reorder

Two coupled changes to the Probability/Math track:

**PART 1 — the heterogeneous `General` subcategory was DISSOLVED.** Its 12 levels
/ 40 generators / 8 flashcards / 67 seed fixtures were re-homed family-by-family
into coherent topics (nothing dropped). The shared, well-tested solver library
(the old `general/general.ts`) moved verbatim to
`src/content/probabilityStats/coreSolvers.ts`, and the generator scaffolding (the
old `general/_shared.ts`: `assembleChoices`, `numericErrors`, `numDp`, `mix*`,
`cap`) to `src/content/probabilityStats/coreScaffold.ts`. Keeping these as ONE
shared library (rather than duplicating ~50 tiny helpers/solvers across six
folders, or hand-splitting an 825-line interdependent solver by family) is the
low-risk, DRY choice; each re-homed generator file imports the handful of solvers
it needs. The `general/` folder is deleted.

**General family → destination topic (with rationale):**

| General family (generators / flashcards) | Destination | Rationale |
|---|---|---|
| complement / at-least-one (`genBothColors`, `genContainsDigit`, `genSubInterval`, `genProductEven`, `genSmallestN`) | **Combinatorial Analysis** (`ca-comp`) | complement counting is counting |
| binomial tails + digit counting (`genBinomTail`, `genDigitOrder`) | **Combinatorial Analysis** (`ca-bino`) | tails/case-counting are counting |
| dice sums + parity-by-symmetry + die-compare (`genDiceSumQuiz`, `genParitySymmetry`, `genDieCompare`) | **Combinatorial Analysis** (`ca-symm`) | ordered-sample-space counting |
| tournaments & spatial arrangements (`genBracketFinal`, `genRound1`, `genSemicircle`, `genPolygonAnts`) | **Combinatorial Analysis** (`ca-tourn`) | bracket/anchor counting |
| counting/expectation misc (`genCoupon`, `genLinearityWords`, `genTwoInRowSchedule`, `genConsecutiveRun`, `genHigherCard`, `genInclExcl`) | **Combinatorial Analysis** (`ca-count`) | linearity + inclusion–exclusion counting |
| birthday/collision fixtures (GN12/13/22) | **Combinatorial Analysis** (test fixtures) | pigeonhole/collision counting |
| geometric probability, area/length (`genGeoArea`, `genTileFit`, `genMeeting`, `genGlance`) | **NEW: Geometric Probability** (`geo-1/2`) | measure-ratio family, no existing home |
| uniform order statistics + exponential median (`genMinInterval`, `genOrdering`, `genExpMedian`) | **NEW: Order Statistics** (`os-1`) | min/ordering/median = order statistics (median is the central order statistic) |
| covariance/variance + CLT/concentration (`genMaxCov`, `genAffineCorr`, `genSumSD`, `genVarCombo`, `genCltDiffZ`, `genCltTail`, `genMarkovBound`) | **NEW: Variance, Covariance & the CLT** (`vc-1/2/3`) | second-moment / limit-law family (the two stats candidates consolidated to avoid two tiny topics) |
| random walk / recursion + gambler's ruin (`genAllForward`, `genDeuce`, `genRestart`, `genRuin`) | **Markov Chains** (`mc-walk`; `genRuin` folded into `mc-5`) | first-step / absorbing-chain material |
| optimizing agents + market-making spread (`genOptimizeAgents`, `genOptimalSpread`) | **Game Theory & Puzzles** (`gt-agents`, `gt-spread`) | strategic optimization |
| GN32 divergent first-return; GN66 best-of-3 decision (`gen-fc-firstreturn`, `gen-fc-bestof3`) | **Markov Chains** desk (`mc-6`) | random-walk reasoning |
| GN38 jumping-robots Newton root (`gen-fc-threshold-root`) | **Game Theory & Puzzles** desk (`gt-6`) | optimal-stopping equilibrium |
| GN37 two-sided market (`gen-fc-market`) | **Game Theory & Puzzles** desk (`gp-3`) | market-making quote |
| GN43 perfect-correlation procedure; GN44 dependence conditional (`gen-fc-perfectcorr`, `gen-fc-dependence`) | **Variance, Covariance & the CLT** desk (`vc-3`) | covariance reasoning |
| GN65 stopping-rule invariant (`gen-fc-stoppingrule`) | **Conditional Probability** desk (`cp-6`) | a classic conditioning paradox |
| GN67 fairness + payout (`gen-fc-fairpayout`) | **Combinatorial Analysis** desk (`ca-9`) | core is P(ordering)=1/k! (counting) |

Nothing was lost: all 40 generators, all 8 flashcards, all 67 `SEED_ANSWERS`
fixtures, the second-independent-derivation cross-checks, the fingerprint guards,
and every blurb/lesson/distractor were preserved (re-pathed into per-destination
test files: `combinatorialAnalysis/generalRehomed.test.ts`,
`geometricProbability/geometricProbability.test.ts`,
`orderStatistics/orderStatistics.test.ts`,
`varianceCovarianceClt/varianceCovarianceClt.test.ts`,
`markovChains/generalRehomed.test.ts`, `gameTheory/generalRehomed.test.ts`,
`conditionalProbability/generalRehomed.test.ts`). Sections were retagged on every
moved level. (Minor faithful improvement: the GN15 "Poker Chip Drop" fixture now
asserts the true 0.36 via `diskInnerProb(3,5)` instead of the original's stray
0.16 copy.)

**New focused topics created** (judgment call — where a substantial General
family had no genuine existing home): **Geometric Probability** (area/length
ratios, 2 levels), **Order Statistics** (min/ordering/median of continuous
distributions, 1 level), and **Variance, Covariance & the CLT** (3 levels). The
last consolidates the user's two suggested stats topics ("Covariance & Variance"
+ "CLT & Concentration") into one coherent second-moment/limit-law topic to avoid
two tiny sections. The lone exponential-median generator was folded into Order
Statistics (a median is the central order statistic); the lone diagonal-duel
fixture (GN64, a continuous exponential comparison) is asserted there too.

**PART 2 — the track's sections are now ordered EASIEST → HARDEST** (Core
Probability, defined in `probability/levels.ts`, is always prepended as the
foundation; the remaining order lives in `probabilityStats/index.ts` and is the
source of truth for a downstream "Level 1 … Level N" topic-selector):

| # | Topic (section) | Levels | Overall-difficulty justification |
|---|---|---|---|
| 1 | Core Probability | 5 | The foundation (sample spaces → Bayes → EV → hard interview problems → lattice paths). Prerequisite for everything; entry `pr-1` is the easiest possible. |
| 2 | Combinatorial Analysis | 14 | Elementary, concrete counting; low concept load. Entry `ca-1` (ratios of combinations) is an easy on-ramp. (Was LAST in the old order — the user's suspicion was right: it is NOT harder than Markov.) |
| 3 | Geometric Probability | 2 | A single idea — favourable measure ÷ total. Visually intuitive, minimal prerequisites; entry `geo-1` names the r²-vs-r trap. |
| 4 | Conditional Probability | 6 | Conditioning / Bayes / LOTP; computationally light but conceptually subtle (paradoxes). Builds on basic probability. |
| 5 | Expected Value | 8 | The broad EV toolkit (~25 families); builds on counting + conditioning, ranging into variance/martingales. |
| 6 | Betting & Sizing | 4 | Kelly `f*=(bp−q)/b`: a focused APPLICATION of EV + odds conversion (depends on EV). |
| 7 | Order Statistics | 1 | Continuous order stats (min via nth-power tails, 1/n!, median ln2/λ); needs comfort with continuous distributions (builds on Geometric). |
| 8 | Variance, Covariance & the CLT | 3 | Second moments, Cauchy–Schwarz, correlation, CLT tails, concentration; depends on EV (variance). |
| 9 | Markov Chains | 7 | State recursions / first-step analysis / hitting times / biased ruin; high setup complexity. Harder than the statistics block. |
| 10 | Game Theory & Puzzles | 11 | Nash & mixed-strategy equilibria, backward induction, market-making optimization; the most abstract, strategic reasoning — the capstone. |

**Prerequisite check (no inversions):** Core precedes all; EV (5) precedes
Betting (6), Variance/CLT (8), Markov (9), Game Theory (10); Geometric (3)
precedes Order Statistics (7); no topic sits before one it depends on. Every
topic's first level is a reasonable dropdown entry point (each is easy or, for
Order Statistics / Variance-CLT, a medium single-concept opener).

Within-topic Easy→Hard ramps were preserved and re-sorted after the merges
(Combinatorial: 6 easy, 6 medium, 2 hard; Markov: 2 easy, 3 medium, 2 hard). The
Game Theory & Puzzles interleave in `index.ts` now slots `gt-spread` (numeric)
and `gt-agents` (quiz) into the hard run ahead of the three flashcard desks.

**Verification.** `npm run build` passes; `npm test` = **621 passing** (was 602:
the re-homed generator/fixture tests were preserved and re-pathed, plus new
per-topic contract blocks for the three new topics; the old "General" contract
block was removed and the Combinatorial/Markov counts + cross-topic ordering
assertions in `levels.test.ts` updated to the new order). One pre-existing latent
type error in `combinatorialAnalysis.test.ts` (a `string` passed as the Fraction
denominator on the lattice-meeting cross-check), surfaced by the full rebuild,
was fixed in place.
