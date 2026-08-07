# QA Audit — Brainteasers content families (hint-ladder quality)

**Scope (read-only):** `src/content/brainteasers/{levels,generators,techniqueGenerators}.ts` — all brainteaser families, fed through `buildHintLadder(...)` (`src/lib/tutor/hintLadder.ts`) and its rung helpers (`errorModes.ts`, `planOfAttack.ts` + `plans/*`, `misconception.ts`, `hintTopicHelp.ts`), plus next-topic routing (`src/lib/remediation/{policy,probe}.ts`, `src/content/remediation/prereqDAG.ts`, `src/lib/roadmap/skillGraph.ts`).

**Method:** A temporary vitest harness (written, run, deleted) adapted every static flashcard (38 cards across levels `bt-1`…`bt-6`) and every parametric family (6 core in `generators.ts` + 8 technique in `techniqueGenerators.ts`) — the latter across seeds 1–4 — into a `NumericQuestion`, then called `buildHintLadder` with synthesized wrong values in three bands (close/arithmetic-slip, far, negative) and inspected **all 5 rungs, the rung-5 explanation, the rung-4 confront/sim, and next-topic routing**. Reproduced deterministically; no app source was modified.

> Scoring is /10 on **ACCURACY** (does rung-1 name the SPECIFIC trap, not a generic fallback), **THOROUGHNESS** (all rungs complete/coherent, no cut-offs, the key insight surfaced, the RIGHT rung-4 confront, rung-5 complete+correct+reveals the insight), and **NEXT-TOPIC ZPD** (does a failure route sensibly per the remediation policy/DAG).

---

## TL;DR

The brainteaser families carry **excellent rung-5 reveals** (the authored `explanation`s are complete, correct, and explicitly surface each puzzle's "aha") but the entire **coaching front of the ladder (rungs 1–4) collapses to generic, and frequently *wrong-domain*, boilerplate for every brainteaser** because the content declares no wrong-answer knowledge and both brainteaser sections are excluded from the sim + prereq layers. Concretely and uniformly across all 52 items/families:

- **Rung 1 never names the specific trap** — always a generic fallback (or a *misleading* "your logic is spot on, check arithmetic" for logic puzzles). Every authored `explanation` literally states the trap ("the common mistake is…", "the classic error…", "the frequent slip…"), yet none reaches rung 1.
- **Rung 2 for every "Core Puzzles" item is the GAME-THEORY plan** ("Who are the players… no one wanting to switch"), because the section string `"Core Puzzles"` matches the substring `"puzzle"` in `gamesMiscPlans`. Wrong for rate/EV/counting/optimal-stopping/information/construction puzzles.
- **Rung 4 is the probabilistic "enumerate the equally-likely outcomes / run many trials, compare the empirical frequency"** for *every* brainteaser (both sections are in `EXPLICIT_NO_LINK_SECTIONS` ⇒ `simLinkFor` = `null`, and no misconception tag ⇒ `confront = "none"`). Nonsensical for deterministic logic / invariant / game-theory / number-theory puzzles.
- **Rung 3 promises a worked sibling that never materializes** for the static classics (no `family`/generator).
- **Next-topic routing is entirely absent** — both `brainteasers::Core Puzzles` and `brainteasers::Techniques Toolkit` are intentionally omitted from `PREREQ_DAG`, and `buildProbeItem` returns `null` for flashcard levels.

Context: in the shipping app the brainteaser track is a self-assess **flashcard** player (`FlashcardLevel.tsx`) that does **not** call `buildHintLadder` at all, and the Verified Bank uses a separate `VerifiedItem` schema. So these defects bite only when a brainteaser is surfaced through a numeric/quiz-style ladder path (e.g. a mock-interview adaptation). They are real content-integration defects, but their blast radius is gated by that.

The `nameOnlyCoaching` truncation class (being fixed elsewhere) **does not affect brainteasers at all** — they have no matched `commonErrors`/`distractorRationale`, so `nameOnlyCoaching` never runs; rung 1 always takes the generic-fallback branch. No rung-5 mid-sentence cut-offs were observed (explanations terminate cleanly).

---

## Defect table

| ID | Sev | Rung / area | Defect | Root cause | Affected |
|----|-----|-------------|--------|-----------|----------|
| **BT-1** | **Critical** | Rung 1 (Accuracy) | Rung-1 can **never name the specific trap** for any brainteaser; always the generic fallback / arithmetic-slip nudge. The trap is authored in every `explanation` but is not machine-available to rung 1. | Brainteaser `Flashcard`s declare **no** `commonErrors` / `distractorRationale` / `misconceptions`; `buildHintLadder`'s numeric path finds `matched = undefined` and `inferAnswerDomain` returns `"real"`, so it falls to `arithmeticSlipCoaching()` or `genericFallbackCoaching()`. | ALL 38 static + 14 families |
| **BT-2** | **High** | Rung 2 (Thoroughness) | Every **Core Puzzles** item gets the **game-theory** plan ("Who are the players… which choice profile could hold steady with no one wanting to switch") — a Nash-equilibrium framing applied to burning-rope timing, EV, linearity-of-expectation, binary-encoding, tournament, minimax, optimal-stopping, Markov, and Monty-Hall puzzles. | `planFromSection` in `plans/gamesMiscPlans.ts` matches `"core puzzles".includes("puzzle")` → `PLANS.gameTheory`. `family` is `undefined` (brainteasers never set it), so nothing more specific fires. | 19 Core static + 6 core families |
| **BT-3** | **High** | Rung 4 (Thoroughness) | Rung-4 confront is the **probabilistic** "enumerate the full set of equally-likely outcomes (or run many quick trials)… compare the empirical frequency" for **every** brainteaser — wrong for deterministic construction/logic/invariant/game/number-theory puzzles (mutilated chessboard, Wythoff, coffee-cream conservation, pirates, blue-eyes, digit-product, trailing-zeros, etc.). No sim link, no coin/dice payload. | Both sections are in `EXPLICIT_NO_LINK_SECTIONS` (`hintTopicHelp.ts`) ⇒ `simLinkFor` = `null`; no misconception tag ⇒ `confrontForTag` = `"none"` ⇒ generic elicitation branch. | ALL 38 static + 14 families |
| **BT-4** | **Med** | Rung 1 (Accuracy) | Arithmetic-slip misfire: a close wrong value on a gradable **logic/construction** puzzle yields *"Your logic looks spot on — just double-check your arithmetic"*, which is actively misleading (the error is conceptual, not arithmetic). Observed for ropes (46 vs 45), bridge (18 vs 17), lockers (11 vs 10), poison (11 vs 10), 2-eggs (15 vs 14), round-trip (26 vs 25), inventory-cap (0.3 vs 0.2), cucumbers (101 vs 100), horse-race (10 vs 9), explorers (30 vs 29). | `isArithmeticSlip` (≤12% rel. error) fires for these off-by-one/near misses; brainteasers have no error-mode to override it with the real (conceptual) trap. | ~10 gradable static |
| **BT-5** | **Med** | Rung 3 (Thoroughness) | Rung 3 says *"Here's the SAME kind of problem with different numbers, worked below"* but for the static classics there is **no generator/`family`** to draw a sibling from, so the promised worked sibling cannot be produced. | Static flashcards carry no `family`; the sibling generator (`generateFreshNumericQuestion`) keys off `question.family`. | 38 static (esp. famous classics: monty, poison, 12-balls, blue-eyes, pirates, 100-prisoners, 8-balls, 25-horses) |
| **BT-6** | **Med** | Next-topic ZPD | A failed brainteaser routes **nowhere** — no prerequisite probe, no descent, no floor-teach. `remediationStep` never engages. | `brainteasers::Core Puzzles` and `brainteasers::Techniques Toolkit` are deliberately omitted from `PREREQ_DAG`; `buildProbeItem` returns `null` for flashcard levels. Brainteasers also genuinely lack a clean prereq chain (logic/lateral puzzles aren't a skill DAG). | ALL |
| **BT-7** | **Low/context** | Integration | The 5-rung ladder is **never built** for the brainteaser track in-app (`FlashcardLevel.tsx` is commit-then-reveal + self-assess; the three `buildHintLadder` call sites in `cards.tsx` are quiz / numeric only). So BT-1…BT-5 only surface if brainteasers are re-served through a numeric/quiz path. | Track is `mode: "flashcard"`; hint ladder is wired for quiz/numeric cards. | ALL (scope note) |

---

## Per-family metric averages (/10)

### Group A — Core Puzzles, static flashcards (`levels.ts`, `bt-1/2/3`) — 19 items
Rung-5 reveals are strong and correct; rung-2 is the wrong (game-theory) plan; rung-4 is the wrong (probabilistic) confront for the logic/construction/information puzzles; rung-1 generic (and sometimes the BT-4 "logic spot on" misfire).

| Metric | Avg | Notes |
|---|---|---|
| Accuracy | **1.5** | rung-1 never names the trap; BT-4 misfire adds active harm on ~10 gradable logic items |
| Thoroughness | **3.5** | rung-5 excellent (≈8–9), dragged down by wrong rung-2 (BT-2), wrong rung-4 (BT-3), hollow rung-3 (BT-5) |
| Next-topic ZPD | **0** | routing absent (BT-6) |

### Group B — Core Puzzles, parametric families (`generators.ts`) — 6 families
`genBackupDealer, genAdjacentCross, genWalkOfferDown, genFadingBuyer, genRoundTrip, genInventoryCap`. These ARE genuinely stochastic (EV / order-statistics / optimal-stopping / Markov), so rung-4's "run many trials" is at least defensible here — but rung-2 game-theory plan is still wrong and rung-1 still generic.

| Family | Accuracy | Thoroughness | ZPD | Note |
|---|---|---|---|---|
| genBackupDealer | 1.5 | 4.5 | 0 | rung-4 plausible (EV/order-stats); rung-2 wrong |
| genAdjacentCross | 1.5 | 4.5 | 0 | rung-4 plausible (linearity via trials); rung-2 wrong |
| genWalkOfferDown | 1.0 | 4.0 | 0 | `gradable:false` ⇒ rung-1 only via quiz path; rung-2 wrong |
| genFadingBuyer | 1.0 | 4.5 | 0 | `gradable:false`; rung-4 (trials) fits stochastic stopping |
| genRoundTrip | 1.5 | 4.5 | 0 | rung-4 fits; rung-2 wrong |
| genInventoryCap | 1.5 | 4.5 | 0 | rung-4 fits (Markov); rung-2 wrong |
| **Group B avg** | **1.3** | **4.4** | **0** | |

### Group C — Techniques Toolkit, static flashcards (`levels.ts`, `bt-4/5/6`) — 19 items
Counting/pigeonhole, invariants/parity, games/induction/lateral. Rung-2 falls to the topic-neutral `GENERIC_PLAN` (acceptable but bland); rung-4 probabilistic confront is wrong for invariants/games/number-theory; rung-5 strong.

| Metric | Avg | Notes |
|---|---|---|
| Accuracy | **2.0** | generic self-check less harmful for counting-flavored items, but still never names the trap |
| Thoroughness | **4.0** | rung-5 excellent; rung-2 generic-neutral; rung-4 wrong (BT-3); rung-3 hollow (BT-5) |
| Next-topic ZPD | **0** | routing absent |

### Group D — Techniques Toolkit, parametric families (`techniqueGenerators.ts`) — 8 families
`genPigeonhole, genHouseOfCards, genTwoBalls, genTrailingZeros, genDigitProduct, genBinaryWeights` (gradable) + `genModularHats, genSubtractionGame` (non-gradable).

| Family | Accuracy | Thoroughness | ZPD | Note |
|---|---|---|---|---|
| genPigeonhole | 2.0 | 4.0 | 0 | rung-4 "enumerate equally-likely outcomes" ≠ pigeonhole threshold |
| genHouseOfCards | 2.0 | 4.0 | 0 | triangular-sum count; rung-4 wrong |
| genTwoBalls | 2.0 | 4.0 | 0 | minimax/triangular; rung-4 wrong |
| genTrailingZeros | 2.0 | 4.0 | 0 | number theory; rung-4 wrong; rung-2 generic |
| genDigitProduct | 2.0 | 4.0 | 0 | greedy 9→2; rung-4 wrong |
| genBinaryWeights | 2.0 | 4.0 | 0 | binary encoding; rung-4 wrong |
| genModularHats | 1.5 | 4.0 | 0 | `gradable:false`; protocol answer |
| genSubtractionGame | 1.5 | 4.0 | 0 | `gradable:false`; mod-invariant game; rung-4 wrong |
| **Group D avg** | **1.9** | **4.0** | **0** | |

**Overall brainteasers:** Accuracy ≈ **1.7/10**, Thoroughness ≈ **3.9/10**, Next-topic ZPD ≈ **0/10**.

---

## Ranked worst offenders

1. **Core Puzzles gradable *logic/construction* cards — `bt-ropes`, `bt-bridge`, `bt-2eggs`, `bt-poison`, `bt-lockers`.** Triple mismatch on a single wrong attempt: BT-4 ("your logic is spot on, check arithmetic" — false; the error is the *construction*), BT-2 (game-theory "who are the players / no one wanting to switch" plan for a rate/encoding/minimax puzzle), and BT-3 (probabilistic "run many trials" for a deterministic puzzle). Every coaching rung 1–4 is actively wrong; only the reveal saves it.
2. **`genWalkOfferDown` / `bt-walk-offer-down` and `genFadingBuyer` / `bt-fading-buyer`.** Sequential-pricing / optimal-stopping. Rung-2 game-theory framing is *tangentially* closer but still off (single-seller pricing, not a multi-player equilibrium); rung-1/3 hollow; `gradable:false` means only rung-5 is trustworthy.
3. **Techniques *invariant/game* cards — `bt-inv-mutilated-board`, `bt-inv-coffee-cream`, `bt-game-wythoff`, `bt-game-fox-duck`, `bt-inv-casino-pairs`.** Rung-4's "enumerate the equally-likely outcomes and compare empirical frequency" is nonsensical for an impossibility proof / conservation invariant / golden-ratio game / pursuit problem.
4. **`genTrailingZeros`, `genDigitProduct`, `genBinaryWeights`, `genPigeonhole` (Techniques number-theory/counting families).** Rung-4 probabilistic confront contradicts the exact-counting technique; rung-1 never names the specific counting trap (e.g. "you counted 5s but forgot the extra 5 from 25").
5. **All `gradable:false` families/cards as a class** (`genModularHats`, `genSubtractionGame`, `bt-monty`, `bt-12balls`, `bt-blueeyes`, `bt-pirates`, `bt-100prisoners-switch`, and the invariant/lateral statics). No numeric grade ⇒ rungs 1–4 only ever appear via a quiz adaptation, and next-topic routing (BT-6) is dead — so the only functioning tutoring artifact is the rung-5 reveal.

---

## What's working (so the fixes stay surgical)

- **Rung-5 reveals** (`= question.explanation`) are consistently complete, correct, and surface the intended insight (the 'aha' / key identity / invariant). No truncation or mid-sentence cut-offs observed across static or generated items and seeds.
- Parametric families produce **exact, seed-stable** prompts/answers/explanations; the reveal text tracks the drawn parameters correctly (spot-checked backup-dealer, adjacent-cross, pigeonhole, trailing-zeros).
- The withholding invariant holds trivially (rungs 1–4 are generic and never leak the answer).

_No files under `src/**` were modified. Temporary audit harness created at `src/content/brainteasers/_qa_audit.test.ts` was deleted after the run._
