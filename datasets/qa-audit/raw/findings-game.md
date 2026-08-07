# QA Sub-Audit — Hint-Ladder Quality: `gamePuzzle` module

**Module:** `src/content/probabilityStats/gamePuzzle` (Probability & Statistics).
**Scope:** READ-ONLY. No file under `src/**` was modified.
**Data:** `datasets/qa-audit/raw/game.txt` (8-seed pre-gen) + fresh re-run `qa_harness.ts game 20`.
**Verified against:** `generators.ts`, `puzzles.ts`, `levels.ts`, `hintLadder.ts`, `planOfAttack.ts` + `plans/gamesMiscPlans.ts`, `hintTopicHelp.ts` (`simLinkFor`), `errorModes.ts`, `answerWithholding.ts`, `topicKey.ts`, `prereqDAG.ts`, `simulations/catalog.ts`.

## Module shape (what actually produces a ladder)

Three levels, all `section: "Game Theory & Puzzles"`:

| Level | Title | Mode | Ladder? | Families / branches |
|---|---|---|---|---|
| `gp-1` | Rig the Bags | numeric | YES | `genRigBags` — 4 wrong-answer classes |
| `gp-2` | Spotting Arbitrage | numeric | YES | `genArbitrage` — 3 wrong-answer classes |
| `gp-3` | Betting Strategy Desk | flashcard | NO (0 ladders) | open-ended cards, no wrong-answer ladder |

20-seed enumeration: **15 distinct `gp-1` instances × 4 branches = 60 rows**, **8 distinct `gp-2` instances × 3 branches = 24 rows**, `gp-3` = 0. **Deduped by family+misconception class ⇒ 7 distinct (item, wrong-answer) classes.** No truncation flags fired anywhere in this module (the "…keep or" mid-sentence class does NOT appear here).

## ROOT CAUSE (drives most defects) — the section mislabel

Per the `levels.ts` header comment, the two **numeric** families were re-tagged `section: "Game Theory & Puzzles"` during a "section-consolidation pass" and interleaved with the real Game-Theory family. But:

- `gp-1` Rig the Bags is a **single-agent law-of-total-probability optimization** (`concept: "Law of total probability (optimization)"`).
- `gp-2` Spotting Arbitrage is **implied-probability detection** (`concept: "Arbitrage detection (implied probability)"`).

Neither is game theory. Yet that one section string is the join key for THREE ladder subsystems, so it corrupts all three at once:

1. **R2 plan** — `resolveGamesMiscPlan` matches the section keyword `"game theory"`/`"puzzle"` → `PLANS.gameTheory` (players / payoffs / Nash equilibrium).
2. **R4 sim** — `simLinkFor` has no family/misconception mapping for `genRigBags`/`genArbitrage`, so it falls to `SIM_BY_SECTION["Game Theory & Puzzles"]` = `game-theory-matrix` ("Mixed Strategies (2×2 Zero-Sum)"), the only sim claiming that topic (`catalog.ts:285-291`).
3. **ROUTE** — `topicKeyOf("probability","Game Theory & Puzzles")` → `GAME_THEORY` node, whose `prereqs = [INTERVIEW_GAMES, EXPECTED_VALUE]` (`prereqDAG.ts:264-271`). The DAG node **exists** (so this is NOT a "(no DAG node)" gap), but its prereqs do not include Core Probability / Conditional Probability / Law of Total Probability — the concepts these items actually test.

A secondary root cause amplifies #2/#3: `roundedErrorPusher.push` in `generators.ts` emits `commonErrors` as `{value, feedback}` with **no `misconception` field**, so every tag resolves to the generic `err:<value>`. Because those tags are absent from `MISCONCEPTION_EDGE` and `SIM_BY_MISCONCEPTION`, misconception-specific routing and sims can **never** fire for this module — every wrong answer routes identically to `prereqs[0]` and gets the same sim.

---

## (1) Defect table

Severity key: **S1** = critical (wrong explanation/diagnosis / broken-or-missing routing); **S2** = major (generic-when-should-be-specific / mismatched sim / incomplete explanation / missing rationale); **S3** = minor (formatting / slightly-generic / known-truncation).

| Level / family | Item id | Wrong-answer (tag) | Actual bad output (quoted) | Metric(s) failed | Sev |
|---|---|---|---|---|---|
| gp-1 `genRigBags` | all `gp-bags-*` (60 rows) | R2 for every branch | `"Let's make a plan. (1) Who are the players here… (2) …make as large or as small as possible? (3) …which choice profile could hold steady with no one wanting to switch…"` — a Nash-equilibrium/game plan for a **single-agent** probability optimization (no players, no equilibrium). | THOROUGHNESS (R2 useful) | **S2** |
| gp-1 `genRigBags` | all `gp-bags-*` (60 rows) | R4 for every branch | `"Open the Simulations tab → "Mixed Strategies (2×2 Zero-Sum)" and adjust the 2×2 payoffs to find the game's value…"` (`/simulations#game-theory-matrix`). A bag/law-of-total-probability puzzle is not a 2×2 zero-sum game — **wrong sim**, actively misdirects. | THOROUGHNESS (R4 appropriate) | **S2** |
| gp-1 `genRigBags` | all `gp-bags-*` (60 rows) | ROUTE, every branch | `"node=Game Theory & Puzzles | via=prereqs[0] (no edge) | target=EV Decision Games & Market Making"` — a failed law-of-total-probability item remediates to EV market-making; the true prereq (Core/Conditional Probability) is **not even a prereq** of the node, so remediation can't teach the missing skill. Identical for all 4 misconceptions. | NEXT-TOPIC ZPD | **S2** |
| gp-2 `genArbitrage` | `gp-arb-2.00-2.00-*` | `err:4` (added-odds) | `"That's not the right answer yet — and it doesn't line up with any of the usual mistakes for this question, so I won't guess at what went wrong…"` — **generic fallback despite an authored rationale** ("You added the decimal ODDS themselves…"). | ACCURACY (R1) | **S2** |
| gp-2 `genArbitrage` | `gp-arb-2.00-2.00-*` | `err:2` (net-odds) | Same generic fallback, though the authored rationale is `"You used net odds (o − 1) in the reciprocal…"`. | ACCURACY (R1) | **S2** |
| gp-2 `genArbitrage` | all `gp-arb-*` (24 rows) | R2 for every branch | Same `gameTheory` "Who are the players…" plan. Correct plan (`PLANS.deVig`: "what do the quoted prices imply… where is the built-in margin hiding") exists but is unreachable because the section reads "game theory/puzzle", not "no-arbitrage/de-vig". | THOROUGHNESS (R2 useful) | **S2** |
| gp-2 `genArbitrage` | all `gp-arb-*` (24 rows) | R4 for every branch | Same `game-theory-matrix` sim. An implied-probability/de-vig item is not a 2×2 zero-sum game; a de-vig sim (e.g. `marble-winner-markets`) fits far better. | THOROUGHNESS (R4 appropriate) | **S2** |
| gp-2 `genArbitrage` | all `gp-arb-*` (24 rows) | ROUTE, every branch | `target=EV Decision Games & Market Making` — adjacent (odds/betting) but still not the true gap (meaning of probability / implied-prob reciprocal); no misconception-specific edge fires. | NEXT-TOPIC ZPD | **S2** |
| gp-1 `genRigBags` | e.g. `gp-bags-21-5-*` (f₂=0.8), `gp-bags-6-20-*` (f₂=0.2) | R5 tail | `"…the other half you still win almost half the time."` — a fixed tail that is inaccurate when f₂ is far from ½ (0.80 is "most of the time"; 0.20 is "about a fifth"). Explanation body/answer are correct. | THOROUGHNESS (R5 precise) | **S3** |
| gp-1 `genRigBags` | `gp-bags-*` mirror-split & second-bag branches | `err:0.5`, `err:(gold-1)/25` | R1 keeps the full authored line, which states the **method** at rung 1: `"The trick is to isolate ONE winning token in its own bag so that bag wins with certainty."` / `"P = ½·1 + ½·f₂."` Rung 1 is meant to be name-only. `nameOnlyCoaching` doesn't cut it (no corrective marker before "The trick is…"). | THOROUGHNESS (R1 name-only contract) | **S3** |
| gp-1/gp-2 all numeric | all | commonErrors metadata | `commonErrors` carry no `misconception` field (`generators.ts` `push`), so tags degrade to `err:<value>` → misconception-aware routing (`MISCONCEPTION_EDGE`) and misconception-aware sims (`SIM_BY_MISCONCEPTION`) can never engage for this module. | NEXT-TOPIC ZPD / R4 (contributing) | **S3** |

> Note on the generic-fallback bug (rows 4–5): it is answer-value dependent. `containsFinalAnswer(text, 1)` (`answerWithholding.ts`) extracts the bare "1" from "1/o" / "1/o₁" in the authored rationale; the only odds pair whose implied sum rounds to exactly **1.00** is `2.00/2.00`, so the guard wipes the two rationales that mention "1/o" (added-odds, net-odds) to the generic message. The third branch ("forgot the other outcome") has no digit `1` and survives. All non-1.00 pairs (0.95–1.06) keep their rationales.

## (2) Per-metric averages + sample size

**Sample size:** 84 enumerated wrong-answer rows across 23 distinct instances (15 `gp-1` + 8 `gp-2`); `gp-3` flashcards produce 0 ladders. **Deduped scoring set = 7 distinct (family, misconception) classes.**

Scores /10 per class (ACCURACY = R1 names the specific trap; THOROUGHNESS = rungs complete+coherent, R2 useful, R4 right, R5 complete+correct; ZPD = routes to an appropriate prereq):

| Class | ACCURACY | THOROUGHNESS | NEXT-TOPIC ZPD |
|---|---|---|---|
| RigBags · mirror-split (`err:0.5`) | 8 | 3 | 2 |
| RigBags · raw-fraction | 9 | 3 | 2 |
| RigBags · second-bag-only (forgot ½·1) | 8 | 3 | 2 |
| RigBags · isolated-losing-token | 9 | 3 | 2 |
| Arb · added-odds | 9† | 3 | 3 |
| Arb · net-odds | 9† | 3 | 3 |
| Arb · forgot-outcome | 9 | 3 | 3 |
| **Average (7 classes)** | **8.7** | **3.0** | **2.4** |

† The two arb classes drop to **ACCURACY ≈ 1** on the `2.00/2.00` (answer 1.00) instances specifically, where R1 becomes the generic fallback.

**Composite ≈ 4.7/10.** Diagnosis quality (R1 name-trap) is genuinely strong; the module is dragged down almost entirely by the section-mislabel triple (R2 plan, R4 sim, ZPD routing) that hits **every** row.

## (3) Ranked worst offenders

1. **Next-topic routing is off-target for Rig the Bags (S2).** A law-of-total-probability failure remediates to *EV Decision Games & Market Making*; Core/Conditional Probability isn't a prereq of the `Game Theory & Puzzles` node, so the learner can never be dropped to the concept they actually missed. ZPD = 2/10, identical for all 4 misconceptions.
2. **R4 points at the wrong simulation for 100% of rows (S2).** Both a single-agent bag puzzle and an arbitrage-detection item are told to "adjust the 2×2 payoffs to find the game's value" in the Mixed-Strategies sim — a sim that models neither.
3. **R2 is the Nash-equilibrium "who are the players" plan for non-game items (S2).** Meaningless for a probability optimization; the genuinely fitting `deVig` plan exists for the arbitrage family but is unreachable.
4. **R1 collapses to "…doesn't line up with any of the usual mistakes" on the fair `2.00/2.00` book despite an authored rationale (S2).** The withholding guard mistakes the "1" in "1/o" for the answer (1.00) and discards the correct diagnosis.
5. **No `misconception` tags on numeric `commonErrors` (S3, systemic amplifier).** Guarantees generic `err:<value>` tags, disabling all misconception-specific routing and sims for the module.
6. **R5 boilerplate tail "still win almost half the time" is numerically loose (S3)** when the optimal f₂ is far from ½; body and final answer remain correct.

## What is actually good (for balance)

- **R1 diagnosis is specific and correct** on 6 of 7 classes and every non-1.00 arbitrage instance — it names the exact trap ("You reported the overall green-fraction (16/26)", "You added the decimal ODDS themselves", "You isolated a LOSING token").
- **R5 reveals are correct and complete** (exact `fraction.js` ground truth), modulo the loose closing clause above.
- **No mid-sentence truncation** in this module.
- **`gp-3` flashcards correctly produce no ladder** (open-ended, no wrong-answer branch) — not a defect.

## Suggested fixes (not applied — read-only)

- Give the two numeric families a truthful section (e.g. keep display grouping but route via `"Core Probability"` for Rig-the-Bags and `"No-Arbitrage"`/de-vig for Arbitrage), OR add `SIM_BY_FAMILY`/`plans` entries + a `MISCONCEPTION_EDGE`-eligible tag so plan/sim/route stop keying on the game-theory label.
- Add a `Game Theory & Puzzles` (or family-level) prereq path down to Core/Conditional Probability + implied-probability so remediation lands on the real gap.
- Add `misconception` tags to `commonErrors` in `generators.ts` so misconception-aware routing/sims can engage.
- Make the `containsFinalAnswer` guard tolerant of "1" inside "1/o" (e.g. token-boundary aware) so the fair-book rationale isn't wiped.
