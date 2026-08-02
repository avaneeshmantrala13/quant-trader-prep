# The Trading Floor — Implementation Plan

**Status:** BUILD SPEC. Grounded in the current codebase (see "Reused code" below).
No app code written yet; nothing committed. This is the buildable plan for the
flagship feature from `datasets/QUANT_NEXT_LEVEL_IDEAS.md` §1/§2/§3 — a real-time
**adversarial make-a-market game** that **replaces the passive "Calibration Gym."**

The design principle: *calibration is not measured next to P&L — it IS the P&L.*
You quote a two-sided market on an unknown quantity; an **informed bot** picks you
off only when your quote is on the wrong side of fair; the truth is revealed each
round; you re-quote. For a 0/1 contract this is a **proper scoring rule**, so honest
calibration is provably the P&L-maximizing strategy (§4).

---

## 0. Reused code (what already exists, so we wire — not rewrite)

Everything below is present and unit-tested today. The Trading Floor is mostly an
*interactive loop wrapped around proven pure engines.*

| Concern | Reused module | What we take |
|---|---|---|
| Adverse-selection fill | `src/lib/simulations/liveMarket.ts` | `resolveFill`, `makerQuote`, `drawNoise`, `Quote`, `MakerPolicy`, `Fill`, `Noise`, `FillSide` |
| P&L / scoring primitives | `src/lib/simulations/liveMarket.ts` | `cumulativeSum`, `maxDrawdown`, `gradeVsBenchmark`, `BenchmarkGrade`, `LiveRunResult` |
| Streaming maker reference | `src/lib/simulations/basketball.ts` | the `runPolicy(user)` + `runPolicy(bench)` on **one shared stream** pattern; exact `fair` via `fraction.js` |
| Calibration math | `src/lib/mastery/reliability.ts` | `CalibrationPair`, `reliabilityBins`, `brierGap` (Brier + ECE gap) |
| Calibration shaping | `src/lib/calibration/reliability.ts` | `reliabilityDiagram` → `ReliabilityDiagramData`, `calibrationLabel`, `brierScore`, `MIN_PAIRS`/`MIN_BIN` gates |
| Calibration diagram UI | `src/components/dashboard/ReliabilityDiagram.tsx` | drop-in SVG reliability diagram (consumes `ReliabilityDiagramData`) |
| Persisted calibration log | `src/lib/calibration/persistedLog.ts` + `UserProgress.calibrationLog` | `appendPersistedPair`, `toCalibrationPairs` (accrues across sessions, cap 500) |
| Quantity bank | `src/content/fermi/items.ts` + `src/lib/fermi/grader.ts` | `FERMI_ITEMS`, `computeFermiReference`, `formatFermiNumber`, `parseFermiInput` |
| Timed session pattern | `src/lib/arena/session.ts` | the **pure `(state, …) => state`** machine + `tick(state, deltaMs)` convention |
| Wall-clock runner | `src/components/arena/ArenaRunner.tsx` | the `setInterval(TICK_MS)` → drive-pure-state React timer pattern |
| Local PB store | `src/lib/arena/localPb.ts` | `readLocalPb`, `recordLocalRun`, `trailing7DayMedian` (always-on, no backend) |
| Leaderboard scaffold | `src/lib/leaderboard/{client,seed,config,rescore}.ts` | `requestRankedSeed`, `submitRankedRun`, `fetchBoard`, `StreamItem`, mulberry32, DynamoDB/Cognito |
| Deterministic RNG | `src/lib/rng.ts` | `Rng` (`next`, `int`, `pick`, `shuffle`, `chance`) |
| Sim registration | `src/lib/simulations/catalog.ts` + `src/pages/SimulationsPage.tsx` | `SIM_GROUPS`, `SIMULATIONS`, `GROUP_COMPONENTS` |
| Sim card + chart | `src/components/simulations/SimCard.tsx`, `charts/LineChart.tsx`, `TradingDeskGroup.tsx` | `SimCard`, `LineChart`, and the `PnlChart`/`ScorePanel`/`Slider`/`Stat` idioms |
| Mode visibility | `src/lib/mode/{goalMode,visibility}.ts` | `GoalMode` (`interview` = Case B default), `navFor`, `isFeatureVisible`, `featureEmphasis` |

**Key gap this closes (from the ideas doc §0):** the existing Trading-Desk sims
(`TradingDeskGroup.tsx`) *look* like market making but are **policy-slider toys** —
the entire session is computed once in `useMemo(() => runBasketball(...))` and a
slider just scrubs a pre-baked P&L curve. There is **no round-by-round human
decision, no informed opponent you react to, no belief updating.** The Trading
Floor adds exactly that, reusing the same fill/scoring engine underneath.

---

## 1. Overview & goals

**What it is.** A dedicated `/floor` experience (its own page + engine), also
surfaced as a live sim in the Simulations "Trading Desk" group. Each *session* is
N rounds on one **scenario** (a Fermi quantity, a card/dice total, or a
path-dependent live value). Per round:

1. The app states the current information and the **textbook fair value + a
   coaching hint** (optional, toggle).
2. **You post a two-sided quote** (bid/ask via mid + half-spread, plus inventory
   skew and size).
3. An **informed-with-noise counterparty** may trade against you — it picks you
   off when your quote is on the wrong side of fair (`resolveFill`), while
   uninformed noise pays you the spread when you're competitive.
4. **New info is revealed** (a card flips, a bound tightens, a possession scores);
   your posterior over fair value moves.
5. **You re-quote.** Repeat for N rounds.

Your **cumulative P&L, max drawdown, pick-off count, inventory path, and a
Sharpe-like consistency** are the score, graded vs a benchmark desk on the *same*
stream (`gradeVsBenchmark`). For binary rounds, every (mid, outcome) pair also
feeds the existing reliability machinery → a **reliability diagram + Brier/log-loss**
debrief.

**Goals.**
- **G1 — Highest-signal skill, made interactive.** Deliver the market-making round
  (calibration + Bayesian updating + adverse selection) as an actual game, not a
  slider.
- **G2 — Rigor, provable.** State and enforce the proper-scoring-rule equivalence
  (§4) so it is demonstrably calibration training, not a gimmick.
- **G3 — Maximum reuse.** Every math primitive is an existing, tested pure
  function; the new code is a scenario abstraction, a round state machine, a React
  runner, and content.
- **G4 — House style.** Pure seedable engine + Vitest coverage; a thin React layer
  that owns only the wall clock and input (mirrors `arena/`).
- **G5 — Replace the Gym.** Retire the passive "guess-a-probability" Calibration
  Gym; keep its calibration analytics, now backed by adversarial decisions.

---

## 2. Replacing the Calibration Gym

**Today.** The "Calibration Gym" is a `Coming soon` flagship on `LandingPage.tsx`
(Feature No.02, *"Price uncertainty. Beat the model."*) and a footer link. It has
**zero levels** and is passive: submit a probability under a timer → reveal → Brier
score vs an AI model. That is not how any firm tests calibration — firms make you
*trade* your belief against a counterparty who may know more.

**What happens to the Gym.**
- **Retire the passive concept.** Repoint the landing "Calibration Gym" feature +
  footer link to **The Trading Floor** (rename kicker to *"The Trading Floor"*,
  drop the `Coming soon` flag once MVP ships). Keep the same *promise* — "price
  uncertainty, beat the model" — now delivered adversarially.
- **Preserve the measurement.** The reliability diagram / Brier / over-under-
  confidence read the Gym promised is **kept verbatim** — it is just fed by real
  quotes now. `reliabilityDiagram()` and `ReliabilityDiagram.tsx` are reused
  unchanged; the dashboard calibration panel keeps working (it already reads
  `UserProgress.calibrationLog`, which the Floor now writes to).
- **Preserve the on-ramp.** Keep a lightweight **"90% CI in 60s"** estimation drill
  (Old Mission-style CI elicitation) as an optional warm-up that feeds the *same*
  reliability diagram (§7.5). So the calibration *measurement* survives; only the
  *training mechanic* upgrades from "guess-and-reveal" to "trade-and-get-picked-off."

Net: same skill, same math backbone, higher fidelity, and a real portfolio
centerpiece instead of a placeholder.

---

## 3. Game design in detail

### 3.1 The scenario abstraction (one loop for all content)

A single interface lets cards / dice / Fermi / live-path scenarios share the round
loop, the bot, and the scorer. This is the one genuinely new *design* primitive.

```ts
/** A hidden ground truth plus the machinery to reveal info and price fair value. */
export interface Scenario<Truth = unknown> {
  id: string;
  /** "binary" ⇒ 0/1 contract (calibration core); "quantity" ⇒ real-valued total. */
  kind: "binary" | "quantity";
  title: string;
  /** One-line prompt shown above the quote pad. */
  prompt: string;
  unit?: string;               // e.g. "points", "$", "" for a probability
  rounds: number;              // reveals per session
  /** Draw the hidden truth deterministically from the seed. */
  drawTruth(rng: Rng): Truth;
  /** Reveal the info available ENTERING round r (0-indexed). Pure given rng. */
  reveal(truth: Truth, r: number, rng: Rng): RevealInfo;
  /** Textbook fair value entering round r given everything revealed so far. */
  fair(truth: Truth, revealed: RevealInfo[]): number;
  /** Settlement value used to mark inventory (== fair at the last round). */
  settle(truth: Truth): number;    // binary ⇒ 0|1; quantity ⇒ realized total
  /** OPTIONAL posterior (mean + sd) for the coach panel + benchmark spread. */
  posterior?(revealed: RevealInfo[]): { mean: number; sd: number };
}
```

- **Binary scenarios** (`kind: "binary"`): the contract pays 1 if an event happens.
  `fair` returns `v = P(event | info) ∈ [0,1]`; `settle` returns the realized
  `y ∈ {0,1}`. Your **mid IS your stated probability** (§4). Examples: "will this
  hand of cards sum > 21?", "will the marble race go to a favorite?", "P(coin from
  an unknown-bias urn is heads)".
- **Quantity scenarios** (`kind: "quantity"`): `fair` returns `E[value | info]`;
  `settle` returns the realized total. Examples: a basketball final total (reuse
  `fairEnteringRound` from `basketball.ts`), a running dice/card sum, a Fermi
  quantity revealed factor-by-factor.

This mirrors how `basketball.ts` already computes a martingale `fair(r)` that drifts
only with new information — we just generalize it and put a human in the loop.

### 3.2 The round loop (pure state machine)

Mirrors `arena/session.ts`: immutable state, pure transitions, time advanced only
by explicit ticks; the React runner owns the wall clock.

```ts
export type FloorPhase = "quoting" | "resolved" | "revealed" | "finished";

export interface UserQuote {
  mid: number;        // your fair-value estimate (for binary ⇒ your probability)
  half: number;       // half-spread (your uncertainty premium)
  skew: number;       // inventory skew: quote centers at mid − skew·inventory
  size: number;       // contracts you're willing to trade this round (1..maxSize)
}

export interface FloorState {
  phase: FloorPhase;
  round: number;              // current (not-yet-resolved) round
  totalRounds: number;
  cash: number;
  inventory: number;          // net contracts held
  pnlPath: number[];          // marked cumulative P&L after each resolved round
  fills: RoundFill[];         // realized fills (side, price, adverse, size)
  pickedOff: number;          // rounds informed flow picked you off
  quotes: UserQuote[];        // your quote history (for the reliability feed)
  calibration: CalibrationPair[]; // binary rounds only: { pred: mid, outcome: y }
  revealed: RevealInfo[];     // info revealed so far
  remainingMs: number;        // shot-clock for the current quote
}
```

Transitions (all pure, all `Vitest`-covered):

- `startFloor(scenario, seed, config) → FloorState` — draws truth, reveals round 0,
  sets the shot clock.
- `postQuote(state, scenario, quote, rng) → FloorState` — builds your `Quote` via
  `makerQuote(mid, inventory, {halfSpread: half, skew})`; draws the round's
  counterparty (informed-or-noise, §3.3); resolves the fill with `resolveFill`;
  updates cash/inventory/fills/pickedOff; marks P&L at the **updated** fair;
  appends the `CalibrationPair` for binary rounds; advances to `revealed`.
- `advanceReveal(state, scenario, rng) → FloorState` — reveals round r+1's info,
  recomputes fair, re-marks inventory, returns to `quoting` (or `finished`).
- `tick(state, deltaMs) → FloorState` — decrements the shot clock; on timeout,
  auto-submits the **last** quote (or a "no quote / stand aside" default) so a
  stalled user isn't rewarded.
- `finishFloor(state) → FloorResult` — settles the book at `settle(truth)`,
  computes final metrics + benchmark comparison (§3.4).

Determinism: the whole run is a function of `(scenario.id, seed, config)`. Same
inputs ⇒ same truth, same reveals, same counterparty stream ⇒ replayable (a talking
point, and the basis for the ranked leaderboard).

### 3.3 The informed bot / adverse-selection model

This is the heart. It **reuses `resolveFill` directly** — the bot's "information
edge" is simply the `fairForFill` value we pass in, plus how often it is informed.

Per round the engine draws the counterparty:

```ts
export interface BotConfig {
  informedProb: number;   // chance the round's counterparty is informed (else pure noise)
  edgeNoiseSd: number;    // the bot's fair estimate = trueFair + N(0, edgeNoiseSd)
  noiseProb: number;      // chance uninformed flow trades (→ drawNoise)
  noiseMaxHalf: number;   // widest half-spread that still wins noise flow
  lookahead: 0 | 1;       // 0: bot knows current fair; 1: bot peeks at NEXT reveal
}
```

Resolution (per round, size-1 shown; scaled by `quote.size`):

```
trueFair   = scenario.fair(truth, revealedUpToNextIfLookahead)
botFair     = trueFair + rng.normal(0, edgeNoiseSd)         // informed-with-NOISE
if rng.chance(informedProb):
    fill = resolveFill(userQuote, botFair, {trades:false,...}, noiseMaxHalf)
    // resolveFill: lifts your ask if ask < botFair; hits your bid if bid > botFair
else:
    fill = resolveFill(userQuote, trueFair, drawNoise(rng, noiseProb), noiseMaxHalf)
    // straddling quote + competitive ⇒ you earn the spread on uninformed flow
```

Design choices that keep it **not a toy** (ideas doc §1 risk (a)):
- **Informed-with-noise, not omniscient.** The bot sees `trueFair + N(0, edgeNoiseSd)`
  — it is usually right but not always, so blindly widening to dodge it is *also*
  costly (you forgo noise spread). This is genuine adverse selection, not scripted.
- **A mix of informed and uninformed rounds** (`informedProb < 1`) means a
  competitive-but-honest quote gets *paid* by noise most rounds and only picked off
  when genuinely mispriced — reproducing the winner's-curse asymmetry.
- **Optional lookahead** (`lookahead: 1`): on hard difficulty the bot peeks at the
  *next* reveal (it "knows more than you"), so stale mids are punished exactly like
  the ETF-latency sim already punishes stale NAV quotes.
- **Benchmark desk** runs the *honest* policy (`mid = textbook fair`, `half =
  posterior sd`) on the identical counterparty stream, so "beat the desk" means
  "quoted at least as calibrated as the reference maker."

Note: `Rng` currently exposes `next/int/pick/shuffle/chance` — we add a small
`normal(mean, sd)` helper (Box–Muller) in the Floor engine (or extend `rng.ts`),
unit-tested for mean/variance. This is the only RNG addition.

### 3.4 Scoring

All from existing primitives plus one consistency stat:

| Metric | Source |
|---|---|
| Cumulative P&L path | mark-to-fair each round (basketball pattern) → `pnlPath` |
| Final P&L | `pnlPath[last]` |
| Max drawdown | `maxDrawdown(pnlPath)` (existing) |
| Pick-off count | count of `fills[i].adverse` (existing `Fill.adverse`) |
| vs benchmark desk | `gradeVsBenchmark(userFinal, benchFinal)` (existing) |
| Sharpe-like consistency | `mean(roundPnl) / sd(roundPnl)` over per-round P&L deltas (NEW, ~10 lines, tested) |
| Brier / log-loss | `brierGap(calibrationPairs)` (existing) for binary rounds |
| Reliability diagram | `reliabilityDiagram(calibrationPairs)` (existing) |

`FloorResult` extends `LiveRunResult` (so it slots into the existing `ScorePanel`/
`PnlChart`) and adds `finalTruth`, `fairPath`, `inventoryPath`, `calibrationPairs`,
and `consistency`.

### 3.5 Difficulty & adaptivity

`FloorConfig` presets, tuned like `arena/config.ts` presets:

- **Warm-up** — `informedProb 0.25`, `edgeNoiseSd` high, `lookahead 0`, generous
  `noiseMaxHalf`, short sessions (8 rounds). Honest quoting easily beats the desk.
- **Interview** — `informedProb 0.5`, moderate `edgeNoiseSd`, 12–15 rounds. The
  default Case-B experience.
- **Superday** — `informedProb 0.75`, low `edgeNoiseSd`, `lookahead 1`, tight
  `noiseMaxHalf`, 20 rounds. Mis-centering is immediately punished.

*Adaptivity (stretch, optional):* nudge `informedProb`/`edgeNoiseSd` between
sessions from the learner's realized pick-off rate and reliability gap — a light
ZPDES-style step reusing the philosophy of `lib/adaptivity/**` (not required for
MVP).

### 3.6 Session & leaderboard structure

- A **session** = `(scenarioPackId, difficulty, rounds, seed)`. Casual runs use a
  client seed; ranked runs use a server-issued seed (§9.2).
- **Boards:** `board = "trading-floor"`, bucketed by a `configHash` over
  `(scenarioPackId, difficulty, rounds)` — mirroring `arena/config.ts#configHash`
  so only comparable runs are ranked together.
- **Two ranked metrics** (dual board, per the ideas doc): **final P&L** and
  **Brier/log-loss** — you can top the P&L board *or* the calibration board.
- **Always-on local PB** via `localPb.ts` (`recordLocalRun`, `trailing7DayMedian`)
  so the Floor is fully functional with the backend off.

---

## 4. The proper-scoring-rule justification (why honesty is P&L-optimal)

This is the rigor that makes the feature "provably calibration, not a gimmick"
(ideas doc §1 risk (b)). We state it for the **binary (0/1-contract) rounds**, then
tie it to the existing `reliability.ts`.

### 4.1 Setup

A binary contract settles at `y ∈ {0,1}`. Let `v = P(y = 1 | info)` be the true
posterior probability. **Your mid `m` is, by definition, your stated probability
that `y = 1`.** You post `bid = m − s`, `ask = m + s` (half-spread `s ≥ 0`). The
informed bot (`resolveFill` with `fairForFill = v`) trades one unit against you when
your quote is on the wrong side of `v`:

- if `ask < v` (you priced the contract too cheap) → **it lifts your ask**: you go
  short 1, settle at `y`, P&L `= ask − y`;
- if `bid > v` (too rich) → **it hits your bid**: you go long 1, P&L `= y − bid`;
- if `bid ≤ v ≤ ask` → only uninformed noise trades, and only when competitive,
  paying you ≈ the spread `s`.

### 4.2 Honest mid is optimal (properness of the mid)

Fix `s`. Consider the expected P&L contribution from the informed side as a
function of your mid `m`:

- If you **overprice** (`m − s > v`), your bid is picked off; the informed buys from
  you at `bid = m − s` and, in expectation over `y ~ Bernoulli(v)`, you lose
  `E[bid − y] = (m − s) − v > 0` per pick-off — a loss that **grows linearly in the
  mis-centering `(m − v)`**.
- If you **underprice** (`m + s < v`), your ask is lifted; you lose
  `E[y − ask] = v − (m + s) > 0`, again growing in `(v − m)`.
- If you **center honestly** (`|m − v| ≤ s`), the informed side cannot profit — the
  quote straddles `v` — so you take **zero** adverse loss and are free to collect
  noise spread.

Hence, for any fixed spread, expected P&L is **maximized on the whole interval
`m ∈ [v − s, v + s]`, uniquely centered at `m = v` in the tight-spread limit.** Any
dishonest mid is strictly dominated: overconfidence in a direction is mechanically
punished by getting picked off on that side. This is the market-making analogue of a
**proper scoring rule** — truthful reporting is the payoff-maximizing report.

### 4.3 The spread encodes uncertainty; the quadratic-score form

Now optimize `s`. Widening `s` shrinks adverse-selection loss (harder to be caught
off-side) but forgoes noise revenue (a too-wide quote wins no flow, `resolveFill`
returns `"none"`). The P&L-optimal spread therefore **equals your genuine
posterior uncertainty**: quote tight when you're sure, wide when you're not. So the
game rewards *both* an honest mid *and* a correctly-sized spread — exactly the two
things a calibration test probes.

In the natural regime where informed **fill size scales with the counterparty's edge
`|v − m|`** (a bigger mispricing invites a bigger informed hit), the expected
per-round loss to informed flow is proportional to `(m − v)²`. Marking to
settlement over a session, realized loss becomes an affine, decreasing function of
the **Brier score** `mean((mᵢ − yᵢ)²)`. Therefore:

> **Minimizing your realized Brier score is the same objective as maximizing P&L.**
> Calibration is not scored alongside P&L — it *is* the P&L.

*(Log-scoring variant, stretch: a bot whose fill size grows exponentially in edge
yields log-loss instead of Brier — the LMSR limit. `reliability.ts` reports Brier;
we can add log-loss as a one-liner over the same pairs.)*

### 4.4 Feeding the existing calibration engine

Every binary round produces exactly the pair the calibration stack already eats:

```ts
// after postQuote resolves round i on a binary scenario:
calibrationPairs.push({ pred: quote.mid, outcome: settledY });  // CalibrationPair
```

- **In-session debrief:** `reliabilityDiagram(calibrationPairs)` →
  `ReliabilityDiagramData` → the existing `ReliabilityDiagram.tsx` (reliability
  diagram vs the 45° line, over/under-confidence chip, Brier + ECE gap behind the
  "Advanced details" accordion). No new calibration code.
- **Cross-session accrual:** append each pair to `UserProgress.calibrationLog` via
  `appendPersistedPair` (cap 500), tagged with a `trading-floor` topic key, so the
  **dashboard** calibration panel — which already reads that log — now reflects real
  adversarial decisions and can clear the `MIN_PAIRS = 25` sufficiency gate quickly.
- **Debrief line** ("you got picked off on the wrong side 6×") pairs the P&L story
  with the calibration story, and we print the §4.2–4.3 equivalence in a
  "why this is calibration" panel.

---

## 5. Data model & TypeScript types

New types live in `src/lib/floor/types.ts`; math primitives are imported, never
re-declared.

```ts
// ---- reused, imported ----
import type { Quote, MakerPolicy, Fill, LiveRunResult, BenchmarkGrade } from "@/lib/simulations/liveMarket";
import type { CalibrationPair } from "@/lib/mastery/reliability";
import { Rng } from "@/lib/rng";

// ---- new ----
export interface RevealInfo { round: number; label: string; detail?: string }

export interface Scenario<Truth = unknown> { /* §3.1 */ }

export interface UserQuote { mid: number; half: number; skew: number; size: number }

export interface BotConfig { /* §3.3 */ }

export interface FloorConfig {
  rounds: number;
  bot: BotConfig;
  maxSize: number;
  shotClockMs: number;         // per-round quote clock (reuse arena timer idiom)
  benchPolicy?: MakerPolicy;   // defaults to honest desk (mid=fair, half=posterior sd)
}

export type FloorPhase = "quoting" | "resolved" | "revealed" | "finished";
export interface RoundFill extends Fill { size: number; round: number }
export interface FloorState { /* §3.2 */ }

export interface FloorResult extends LiveRunResult {
  finalTruth: number;
  fairPath: number[];
  inventoryPath: number[];
  calibrationPairs: CalibrationPair[];  // binary only
  consistency: number;                  // Sharpe-like
  grade: BenchmarkGrade;
}

export interface ScenarioPack {          // the leaderboard/config unit
  id: string;
  title: string;
  build(rng: Rng): Scenario;             // picks/derives a scenario from the seed
}
```

**Pure vs React separation (house style):** `src/lib/floor/**` is pure and
framework-free (no React/DOM), fully Vitest-covered, deterministic given seed —
exactly like `arena/session.ts` and `simulations/basketball.ts`. React lives in
`src/components/floor/**` and owns *only* the wall clock + input, delegating every
computation to the pure engine (exactly like `ArenaRunner.tsx`).

---

## 6. Module / file structure

**New — pure engine (`src/lib/floor/`):**

| File | Responsibility |
|---|---|
| `types.ts` | interfaces above |
| `engine.ts` | `startFloor`, `postQuote`, `advanceReveal`, `tick`, `finishFloor`; reuses `makerQuote`/`resolveFill`/`drawNoise`/`maxDrawdown`/`cumulativeSum`/`gradeVsBenchmark` |
| `bot.ts` | `drawCounterparty(rng, config)`, informed-with-noise `botFair`, `Rng.normal` helper |
| `scoring.ts` | `consistency(roundPnl)`, `floorMetrics(state)`, calibration pair extraction |
| `benchmark.ts` | the honest reference desk policy on the shared stream |
| `config.ts` | `WARMUP`/`INTERVIEW`/`SUPERDAY` presets + `floorConfigHash` (mirrors `arena/config.ts`) |
| `scenarios/binary.ts` | card-sum, urn-bias, race-favorite binary scenarios |
| `scenarios/quantity.ts` | dice/card running total, basketball total (reuse `fairEnteringRound`) |
| `scenarios/fermi.ts` | wrap `FERMI_ITEMS`: reveal factors one-by-one, `fair = running product`, settle = `computeFermiReference` |
| `packs.ts` | `SCENARIO_PACKS: ScenarioPack[]` (the rankable units) |
| `*.test.ts` | Vitest per module (§10) |

**New — React (`src/components/floor/`):**

| File | Responsibility |
|---|---|
| `FloorRunner.tsx` | wall-clock shot-clock (reuse `ArenaRunner` timer pattern), drives the pure engine |
| `QuotePad.tsx` | mid / half-spread / skew / size controls + the live bid–ask readout |
| `RoundBoard.tsx` | current info, revealed history, textbook-fair coach toggle |
| `LivePnl.tsx` | reuse `PnlChart` (you vs desk) + inventory strip |
| `Debrief.tsx` | `ScorePanel` + `ReliabilityDiagram` + "why this is calibration" + pick-off recap |
| `FloorGroup.tsx` | the Simulations "Trading Desk" card wrapper (a *live* sibling to the batch sims) |

**New — page & routing:** `src/pages/FloorPage.tsx` (route `/floor`, under
`ProtectedRoute` in `App.tsx`, exactly like `/arena`).

**Modified (small, additive):**
- `src/lib/simulations/catalog.ts` — add a `trading-floor-live` sim entry (id, title,
  group `trading-desk`, topics `["Market Making","Adverse Selection","Calibration"]`).
- `src/pages/SimulationsPage.tsx` — add `FloorGroup` to `GROUP_COMPONENTS["trading-desk"]`.
- `src/lib/mode/visibility.ts` — add a `"trading-floor"` `FeatureKey`; nav link in
  `interviewNav()` (Case B prominent); include under Case-A "beyond the course".
- `src/pages/LandingPage.tsx` — repoint the "Calibration Gym" feature + footer link
  to The Trading Floor.
- `UserProgress.calibrationLog` writer in `ProgressContext` — accept Floor pairs
  (topic key `trading-floor`); no schema change (log already exists).
- (Stretch) `infra/lambda/leaderboard/` — port the Floor engine for server re-score.

---

## 7. UI / UX

### 7.1 Screens
1. **Setup** — pick scenario pack + difficulty (Warm-up / Interview / Superday),
   toggle the coach and the 90%-CI on-ramp, Start.
2. **Round** — top: shot clock + running P&L/inventory/pick-offs; middle:
   `RoundBoard` (prompt, revealed info, optional textbook fair); bottom: `QuotePad`.
3. **Debrief** — final P&L vs desk, drawdown, pick-off recap, reliability diagram +
   Brier/log-loss, the proper-scoring-rule explainer, local PB / rank, "New session".

### 7.2 QuotePad controls
- **Mid** (your fair estimate; for binary, a 0–100% probability affordance).
- **Half-spread** (your uncertainty premium) — live bid/ask preview `[bid ⟷ ask]`.
- **Skew** — visualizes how inventory tilts your quote (`mid − skew·inventory`).
- **Size** (1..`maxSize`). Enter/Space submits (arena keyboard-first feel).
- The pad shows the **implied edge**: "if fair is X you make/lose Y."

### 7.3 Live P&L chart
Reuse `PnlChart` (`LineChart`): your cumulative P&L (accent) vs the desk (dashed
muted), break-even ref line, with an inventory sparkline beneath — all themed via
the existing semantic tokens, so it works across all six themes light+dark.

### 7.4 Calibration diagram
Drop in `ReliabilityDiagram.tsx` on the debrief for binary packs, fed by
`reliabilityDiagram(state.calibrationPairs)`. It already renders the sufficiency
gate, the over/under-confidence chip, and the Brier/ECE details — zero new UI.

### 7.5 "90% CI in 60s" estimation on-ramp (optional, calibration-preserving)
A short pre-session drill (Old Mission-style): the app asks for a **90% confidence
interval** on a Fermi quantity from `FERMI_ITEMS`; we score coverage (did the truth
land inside?) and interval width, and feed a `CalibrationPair` (`pred = 0.9`,
`outcome = inside?`) into the SAME reliability diagram. This keeps the Gym's
calibration *measurement* alive as a low-friction warm-up and doubles as fresh
scenario seeding for the main game.

---

## 8. Content: where scenarios come from & staying fresh

- **Fermi bank (primary):** `FERMI_ITEMS` (13 numerically-verifiable items) becomes
  quantity scenarios — reveal the canonical factors one at a time
  (`computeRunningSteps`), `fair` = the running product, `settle` =
  `computeFermiReference`. Each item already ships a defensible decomposition and a
  test-asserted reference, so scenarios are rigorous by construction.
- **Cards / dice (procedural, infinite):** binary ("sum > threshold?") and quantity
  ("final total") scenarios generated from `Rng` — effectively unlimited fresh runs,
  deterministic per seed.
- **Live path-dependent:** reuse `basketball.ts#fairEnteringRound` (exact martingale
  fair) as a quantity scenario; the marble winner-markets logic as a binary
  favorite scenario.
- **Freshness:**
  - Procedural card/dice/live packs are seed-driven → never repeat.
  - Fermi packs rotate by seed-shuffling `FERMI_ITEMS`; new items are pure content
    additions (the test suite enforces numeric self-consistency, so a typo fails CI).
  - The "90% CI" on-ramp continuously mints new elicitation targets from the bank.

---

## 9. Integration

### 9.1 Arena timer / leaderboard reuse
- **Timer:** `FloorRunner` copies the `ArenaRunner` `setInterval(TICK_MS)` →
  `tick(state, deltaMs)` idiom; the pure engine owns the clock semantics, React owns
  the wall clock. On timeout, auto-submit the standing quote.
- **Local PB:** `localPb.ts` keyed by `board="trading-floor"` + `floorConfigHash`.
- **Ranked (opt-in, graceful no-op when off):** `requestRankedSeed("trading-floor",
  hash)` → play the seed → `submitRankedRun({...})`. **MVP ranks locally**; §9.2.

### 9.2 Server-authoritative ranking (stretch)
The Arena's ranked flow re-scores server-side by regenerating the *same* stream from
`(seed, preset)` (`leaderboard/seed.ts` is a line-for-line twin of the Lambda's
`scoring.mjs`). The Floor's equivalent is to **port the pure Floor engine to the
Lambda** so the server can replay `(seed, config, quotes)` and recompute P&L/Brier
authoritatively. Because the engine is already pure + deterministic + framework-free,
this is a mechanical port (same pattern as `arenaQuestionStream`). Until then, boards
are local/casual — the client stays fully functional (the client is designed to no-op
gracefully when the layer is off).

### 9.3 Mode visibility (Case B)
The Trading Floor is a **Case B / interview** feature. Add `"trading-floor"` to
`FeatureKey`; `isFeatureVisible` → true in both modes but `featureEmphasis` →
`"prominent"` in interview, `"beyond"` in course (it joins the `QUANT_ONLY` set).
Add the `/floor` nav link to `interviewNav()` (prominent) and to Case-A's "Beyond
the course" group — mirroring how Speed Arena / Fermi are handled today.

### 9.4 Navigation / registration checklist
- `App.tsx`: `<Route path="/floor" … ProtectedRoute>`.
- `catalog.ts`: add the sim entry; `SimulationsPage` `GROUP_COMPONENTS`.
- `visibility.ts`: `FeatureKey` + nav.
- `LandingPage.tsx`: repoint the Calibration Gym feature/footer.
- Dashboard: the calibration panel needs **no change** — it already reads
  `UserProgress.calibrationLog`, which the Floor now writes.

---

## 10. Phased milestones, testing & effort

Effort assumes the house pattern (pure engine first, tests alongside, thin React).

### Phase 0 — Spec & scaffolding *(~0.5–1 day)*
Types (`floor/types.ts`), `Scenario` interface, `FloorConfig` presets, `Rng.normal`
helper + test. **Deliverable:** compiling skeleton.

### Phase 1 — MVP engine *(~3–4 days)*
`engine.ts` (state machine), `bot.ts` (informed-with-noise via `resolveFill`),
`scoring.ts`, `benchmark.ts`; one binary + one quantity scenario; wire the
calibration pairs. **Tests:**
- `resolveFill` integration: assert informed lifts ask when `ask < botFair`, hits
  bid when `bid > botFair`, straddle earns noise spread.
- Fill/settlement P&L: hand-computed rounds match `postQuote` cash/inventory/pnl.
- **Proper-scoring math:** over many seeds, the honest mid (`m = v`) beats a fixed
  biased mid in expected P&L; and quoting `m ≈ v` yields a lower Brier than a biased
  quoter — the §4 claim, encoded as a property test.
- Determinism: same `(scenario, seed, config)` ⇒ identical `FloorResult`.
- `consistency`, `maxDrawdown`, `gradeVsBenchmark` on known inputs.

### Phase 2 — React runner & UI *(~3–4 days)*
`FloorRunner`, `QuotePad`, `RoundBoard`, `LivePnl`, `Debrief`, `FloorPage`, route.
Reuse `PnlChart`/`ScorePanel`/`ReliabilityDiagram`. **Tests:** a runtime render test
(RTL) that mounts `FloorRunner`, plays a scripted 3-round session via ticks/quotes,
and asserts the debrief shows a P&L number and a reliability diagram (mirrors the
existing sim/render tests).

### Phase 3 — Content & calibration on-ramp *(~2–3 days)*
Fermi/card/dice/live scenarios + `SCENARIO_PACKS`; the "90% CI in 60s" drill feeding
the reliability diagram. **Tests:** each scenario's `fair` is a martingale (E of next
fair ≈ current), `settle` matches the truth, Fermi `settle == computeFermiReference`.

### Phase 4 — Integration, leaderboard & Gym replacement *(~2–3 days)*
`localPb` wiring, `floorConfigHash`, dual local boards, catalog/nav/mode
registration, `calibrationLog` writer, LandingPage repoint. **Tests:** `floorConfigHash`
stability (order-independent), catalog test (id resolves), visibility test (Case A/B
emphasis).

**Core total: ~1.5–2 weeks**, matching the ideas doc's estimate.

### Phase 5 — Stretch *(+1–2 weeks, sequence after core)*
- **Server-authoritative ranking** — port the Floor engine to the leaderboard
  Lambda (twin of `arenaQuestionStream`), with a shared JSON fixture pinning the
  replay (~3–4 days).
- **RL market-maker opponent** (ideas doc §6) — tabular Q-learning / tiny PG agent
  trained in a Web Worker over the Floor simulator; state = (inventory bucket,
  recent flow, vol regime), actions = discrete (halfSpread, skew), reward =
  per-round P&L − inventory penalty; ship a pre-trained policy table so it loads
  instantly. Race your manual quotes vs the learned policy (+1–2 weeks).
- **Between-session adaptivity** — auto-tune `informedProb`/`edgeNoiseSd` from the
  learner's pick-off rate + reliability gap (light ZPDES; ~2 days).

---

## 11. Risks & keeping it rigorous

| Risk | Mitigation |
|---|---|
| **Toy bot** (scripted, dodgeable) | Informed-*with-noise* (`edgeNoiseSd`) + a mix of informed/uninformed rounds so widening is also costly; optional lookahead on hard mode. The bot is `resolveFill` with a genuinely informed `fairForFill`, not a rule of thumb. |
| **"Is it really calibration?"** | State + enforce the §4 proper-scoring-rule equivalence; back it with a property test (honest mid ⇒ higher P&L *and* lower Brier); show the explainer in the debrief. |
| **P&L noise drowns skill signal** | Compare to the honest desk on the *same* stream (`gradeVsBenchmark`) and rank on Brier *as well as* P&L, so a well-calibrated but unlucky run still reads as good. |
| **Server re-score complexity** | MVP ranks locally (client no-ops gracefully); server ranking is a clean stretch port of a pure engine, exactly like the Arena's twin-stream design. |
| **Content staleness** | Procedural card/dice/live packs are seed-infinite; Fermi packs rotate; new Fermi items are CI-verified content-only additions. |
| **Determinism drift** | Whole run is a pure function of `(scenario, seed, config)`; a fixture test pins a canonical run so the engine can't silently change (mirrors `scoring.fixture.json`). |
| **Scope creep vs the batch sims** | Keep the Floor engine independent; the batch `TradingDeskGroup` sims stay as-is — the Floor is the *interactive* sibling, reusing `liveMarket.ts` underneath, not a rewrite. |

---

## Appendix — Architecture at a glance

```
                        ┌────────────────────── pure, seedable, Vitest-tested ──────────────────────┐
  Scenario (Fermi /      │  drawTruth ─▶ reveal(r) ─▶ fair(info) ─▶ settle(truth)                    │
  cards / dice / live) ──┤                                                                           │
                         │  FloorState ──postQuote()──▶ makerQuote() ─▶ resolveFill(botFair) ─▶ Fill │
  BotConfig ─────────────┤        ▲                         (REUSED liveMarket.ts)                   │
  (informed+noise)       │        └── tick() shot-clock     P&L: cumulativeSum / maxDrawdown         │
                         │  finishFloor() ─▶ FloorResult (gradeVsBenchmark, consistency)             │
                         │                       │                                                    │
                         │   binary rounds ─▶ CalibrationPair{pred:mid, outcome:y}                    │
                         └───────────────────────┼────────────────────────────────────────────────┘
                                                 ▼  (REUSED reliability.ts / persistedLog.ts)
   React (owns wall clock + input only):   reliabilityDiagram() ─▶ ReliabilityDiagram.tsx
   FloorRunner ─ QuotePad ─ RoundBoard ─ LivePnl(PnlChart) ─ Debrief(ScorePanel + diagram)
   registration: /floor route · catalog(trading-desk) · visibility(Case B) · localPb/leaderboard
```

**Round loop:** state info + textbook fair → **you quote (mid, spread, skew, size)** →
informed-with-noise bot picks you off iff off-side (`resolveFill`) / noise pays the
spread → **truth revealed, posterior moves** → **re-quote** → … → settle → debrief
(P&L vs desk, drawdown, pick-offs, reliability + Brier).

**Reused vs new:** *reused* — the entire fill/scoring engine (`liveMarket.ts`), the
calibration math + diagram (`reliability.ts`, `ReliabilityDiagram.tsx`,
`persistedLog.ts`), the Fermi bank + grader, the Arena timer/PB/leaderboard scaffold,
`Rng`, `SimCard`/`LineChart`/`PnlChart`. *New* — the `Scenario` abstraction, the
round state machine, the informed-bot draw, the React runner/quote-pad, scenario
content, and thin registration.
