# Mock Interview — Hard Content Rebuild

This document records the difficulty rebuild of the AI mock-interview content
(`src/lib/mock/**`, `src/components/mock/**`). Every hard archetype below has a
**deterministic verifier** (exact answer computed from first principles) plus a
**Monte-Carlo sanity test**. Correctness is owned entirely by the verifiers; the
LLM only narrates.

- Verifier module: `src/lib/mock/archetypes/verifiers.ts`
- Verifier tests (exact + Monte-Carlo): `src/lib/mock/archetypes/verifiers.test.ts`
- Question generators: `src/lib/mock/questionPools.ts`
- Presets: `src/lib/mock/presets.ts`
- Grading QA corpora: `grading-accuracy.test.ts`, `jailbreak-grading.test.ts`,
  `firm-patterns.test.ts`, `followups-typed.test.ts`, `qa-fixes.test.ts`

Difficulty is calibrated to the **anchor**: two lattice walkers heading at each
other from `(0,0)` and `(3,4)`; P(their paths intersect) = **3273/4096 ≈ 0.7991**,
while P(same point at the same time) = **0** (the parity trap).

---

## Verified archetype catalog

Every constant below is asserted exactly in `verifiers.test.ts` and cross-checked
by an independent seeded simulation where probabilistic.

| Archetype | Verifier fn | Exact answer(s) | Used in |
|---|---|---|---|
| **Lattice meeting + parity trap** (Optiver anchor) | `latticeSameTimeMeetProb`, `latticePathsIntersectProb` | same-time meet = **0** for odd gap; paths intersect `(3,4)` = **3273/4096**; even-gap meet = `C(s,bx)/2^s` (e.g. `(3,3)`=**5/16**) | `genLatticePaths` → archetype `lattice-paths`, pinned in **Optiver**; also in `PROB_EV_STRETCH` |
| **Bank-or-roll finite keep-last** | `bankOrRollFiniteEV` | d6 3-roll = **14/3**; d6 2-roll = **17/4**; thresholds `[4,5]` | `genBankOrRoll` → archetype `bank-or-roll`, pinned in **Jane Street** |
| **Bank-or-roll cascade (base)** | `bankOrRollBase` | 20-die/100-round value ≈ **1773.34**, terminal threshold **18** | documented; verifier + follow-up narrative |
| **Bank-or-roll — one die removed** | `bankOrRollDieRemoved` | value ≈ **555.05**, threshold **6** | documented mutation |
| **Bank-or-roll — casino adversary** | `bankOrRollCasino` | value ≈ **863.93**, bank-threshold **9** | documented mutation |
| **Order statistics (dice)** | `expectedMaxDice`, `expectedMinDice`, `sumDiceProb` | E[max 2d6]=**161/36**, E[min 2d6]=**91/36**, E[max 3d6]=**119/24**, E[min 3d6]=**49/24**, P(3d6=10)=**1/8** | `genThreeDiceMax`, `genExpectedMaxTwoDice` in `PROB_EV_HARD` |
| **Hidden-composition Bayes** | `hiddenCompositionNextBlack` | N=6,m=3 → **4/5**; N=4,m=1 → **2/3**; N=3,m=2 → **3/4** | `genCitadelStones` → archetype `citadel-bet` (**Citadel**) |
| **Kelly bet-sizing** | `kellyFraction`, `kellyGrowth` | f\*(0.6,1)=**0.2**, f\*(0.75,1)=**0.5**; 2× Kelly overbet → **negative** growth | `genSigConfidenceBet` → archetype `sig-confidence-bet` (**SIG**) |
| **Gambler's ruin** | `gamblersRuinReachTop`, `gamblersRuinExpectedSteps` | fair reach-top = **a/N** (3/10); E[steps] = **a(N−a)** (21); bias → toward 1 | `genGamblersRuin` in `PROB_EV_HARD`/`STRETCH` |
| **Expected wait for a coin pattern** | `expectedFlipsForPattern` | HH=**6**, HT=**4**, HHH=**14**, HTH=**10** (overlap ⇒ longer) | `genPatternFlips` in `PROB_EV_STRETCH` |
| **Cube / hypercube antipode hitting time** | `hypercubeAntipodeHittingTime` | cube (d=3) = **10** | verifier + MC (available to generators) |
| **DRW coin-step landing** | `coinStepLandProb` | p₄=**11/16**, p₁₀=**683/1024**, limit **2/3** | verifier |
| **DRW die-reset** | `dieResetExpectedRolls` | n=7 → **1701/20 = 85.05** | verifier |
| **Secretary optimal cutoff** | `secretaryOptimalCutoff` | n=10 → **r=3** (P≈0.3987), n=5 → r=2 | verifier |
| **Reds before first black (symmetry)** | `redsBeforeFirstBlack` | R/(B+1) (7,3 → **7/4**) | verifier |
| **Bluff-catching frequencies (poker)** | `bluffCatchFrequencies` | bluff **B/(P+2B)**, call **P/(P+B)** (6,3 → 1/4, 2/3) | verifier |
| **IMC conditional dice lift** | `conditionalTwoDiceMeanAbove` | E[sum \| sum>8] = **10** | verifier |
| **IMC urn posterior mean** | `urnPosteriorMeanRed` | N=100,d=10,r=3 → **33**; r=8 → **75.5** | verifier |
| **Monty Hall (hold-firm)** | (closed form in generator) | switch = **2/3**; 10-door = **9/10** | archetype `monty-hold-firm` (**IMC**) |
| **DRW triage (underdetermined)** | (closed form in generator) | well-posed main + underdetermined adversarial | archetype `drw-triage` (**DRW**) |

---

## Follow-up cascades (probe + adversarial)

Every scored question carries a **numeric probe** (deepen the same principle) and
a **reasoning adversarial** (mutation-cascade: change a parameter / generalize /
spring a trap), graded by the non-jailbreakable committed-conclusion grader with
one CLARIFY round.

- **Lattice** — probe: even-gap same-time meeting `C(s,bx)/2^s`; adversarial:
  paths-intersect probability greater/less than ½ (verified ≈ 0.80).
- **Gambler's ruin** — probe: expected duration `a(N−a)`; adversarial: how a
  favorable bias moves the ruin probability (up, toward 1).
- **Three-dice order stat** — probe: E[min 3d6]; adversarial: limit of E[max] as
  dice → ∞ (up, toward 6).
- **Pattern wait** — probe: paired pattern's expected wait; adversarial:
  self-overlapping patterns take **longer**.
- **Bank-or-roll** — probe: reroll-cost rule change (4.0); adversarial: n→∞ limit
  (→ 6). **Monty** — probe: 10-door scaling (0.9); adversarial: hold firm at 2/3.
  **Citadel** — probe: Bayes denominator; adversarial: bet on your own posterior
  (pass the −0.5 EV bet). **SIG** — probe: complement; adversarial: Kelly stake
  size ($50) and why a bigger edge ⇒ bigger stake. **DRW** — probe: the invariant
  total; adversarial: recognize the underdetermined median.

---

## Presets (rebuilt)

- **Optiver** — leads with escalating NumberLogic sequences, then Beat-the-Odds
  probability/EV, now featuring the **lattice random-walk anchor + parity trap**
  as the flagship stretch item, then two market-making rounds. 12 items.
- **Jane Street** — one fast numeric warm-up (arithmetic screened separately),
  then reasoning-graded EV / gambler's ruin / pattern-wait, the **bank-or-roll
  mutation cascade**, brainteasers, and an escalating make-a-market finale.
  11 items.
- **SIG** — one warm-up, then calculator-allowed calibrated decisions: confidence
  → **Kelly bet-sizing**, multi-step Bayes, geometric waiting time, combinatorics,
  path-counting brainteasers, and pot-odds market-making. 12 items.

Six-firm expansion (Citadel / IMC / DRW as standalone presets) was intentionally
**not** added: the three firms' signatures (bet-on-your-own-probability, hold-firm,
triage) are already delivered as pinned archetypes, and per the quality-over-
breadth directive the three presets were kept at the top bar rather than diluting.

---

## Difficulty-floor purge (freshman-leak fix)

The prior rebuild ADDED hard archetypes but did not REMOVE the pre-existing
freshman pool items or the `medium` preset slots, so a firm mock still drew a
MIX of hard and freshman-level questions. This pass purges every reachable
freshman item and raises the floor everywhere.

### Removed / replaced generators (`questionPools.ts`)

| Generator | Old item | Why removed | Replacement |
|---|---|---|---|
| `genTwoDiceSum` | "EV of the sum of two dice" = **7** | A quant does it in their sleep; the exact freshman freebie | deleted |
| `genDieEv` | "EV of one roll of a k-sided die" = (k+1)/2 (**3.5** for d6) | same | deleted |
| `genCoinExactK` | basic binomial P(exactly k heads in ≤5 flips) | strong freshman does C(n,k)/2ⁿ in <15s, no insight | deleted |
| `genEvBet` | one-line "EV of +$a w.p. p, −$b else" | one-line weighted-average, no insight | deleted |
| `genEstStadium` | "seats × per-person spend" | the exact item the user mocked **twice** | replaced by `genEstOptionsQuotes` |
| `genEstCars` / `genEstSearches` / `genEstHeartbeats` | one-line unit-chaining Fermis | trivial multiplication chains | replaced by `genEstOptionsQuotes` |

`PROB_EV_MEDIUM` was **rebuilt** so even its easiest item is interview-hard:
`{ exactly-two-of-three, conditional-urn (no replacement), geometric wait 1/p,
E[max of two dice] }`. No firm preset draws this tier anymore (all prob/EV slots
are `hard`/`stretch`); it is kept only as a defensively-hardened floor and for
the grading corpora (the non-jailbreakable `pev-twoof3` case still lives here).

### Estimation decision — chose (b), drop from presets, and hardened the pool

Estimation slots were **removed from all three firm presets** and the freed
seconds **reallocated to hard/stretch probability-EV and market-making**. The
estimation POOL keeps a single genuinely-hard generator, `genEstOptionsQuotes`
(an options market-maker's quote-throughput Fermi): a multi-constraint
decomposition whose non-obvious traps are the ×2 for **call + put at each
strike** and converting a 6.5-hour session to **23,400 seconds** — a
market-making anchor, not "30,000 seats × $8". Its ADV grading corpus was added
to `grading-accuracy.test.ts` (`est-mmquotes`).

### Numeric warm-up (`mathGate.ts`)

Bare 2-digit × 2-digit (`gateMultiply2x2`, e.g. 29×14) was **removed from
`GATE_HARD`** — the pool the firm presets' single `mental-math: "hard"` slot
draws. The warm-up is now genuinely demanding: **3-digit × 2-digit** under a
clock, real **3-digit ÷ 2-digit**, an un-memorisable **fraction→decimal**, or
**odds → implied-probability (de-vig)**. (`gateMultiply2x2` is retained only for
the legacy count-based path's easy/medium tiers and its unit test — never
reachable from a firm mock.)

### Presets (`presets.ts`) — every slot now `hard` or `stretch`

Optiver had TWO `probability-ev` slots at `medium` plus two `estimation` slots;
Jane Street had a `medium` brainteaser + two `estimation` slots; SIG had two
`medium` probability-ev slots + an `estimation` slot. Every slot across all
three presets is now `hard` or `stretch` (no `medium`/`easy` reachable). Each
firm's structure/flavor and its pinned archetypes are preserved: Optiver
(sequences → prob/EV → **lattice anchor** → market-making), Jane Street (one
hard warm-up → **bank-or-roll** cascade + hard reasoning → market-making), SIG
(one warm-up → **sig-confidence-bet** → hard reasoning/brainteasers → pot-odds
market-making).

### Regression guard — `difficulty-floor.test.ts`

A new test (a) enumerates every numeric generator reachable from every preset
slot — via `presets.ts`, the `questionPools.ts` pools, the pinned archetypes,
and the `mathGate.ts` warm-up pools — draws 250 seeds each (plus full
preset-interview builds), and asserts **none** is a known-trivial item (two-dice
EV = 7, single-die mean EV, a bare ≤2-digit × ≤2-digit warm-up, or a seats×price
Fermi); and (b) asserts every preset slot's declared difficulty is `hard` or
`stretch`. It **fails against the pre-fix code** (which reached all four
signatures and had `medium` slots) and **passes after** the purge.

---

## Verification status

- `npx tsc --noEmit` → **0 errors**
- `npx vitest run` → **263 files / 3895 tests passing**
- `npm run build` (`tsc -b && vite build`) → **succeeds**
- Grading corpora: reasoning adversarial **recall 100.0% (4840/4840)**,
  **flaw-rejection 100.0% (4440/4440)**, canonical false-negatives **0**; numeric
  probe **recall 100.0%**, **flaw-rejection 100.0%**.
