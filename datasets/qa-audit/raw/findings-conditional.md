# QA sub-audit — hint-ladder quality: `conditionalProbability`

READ-ONLY audit. No `src/**` files modified. Evidence: `datasets/qa-audit/raw/conditional.txt`
(6 levels, 8 seeds), builder `src/lib/tutor/hintLadder.ts`, sim map
`src/lib/tutor/hintTopicHelp.ts`, plan resolver `src/lib/tutor/plans/probabilityPlans.ts`,
routing `src/lib/remediation/policy.ts` + `prereqDAG.ts`, and generator source
`src/content/probabilityStats/conditionalProbability/{generators,cp,levels}.ts`.

Node = **Conditional Probability & Bayes**, prereqs = **[L1 Meaning of Probability & Sample Space, Counting & Combinatorics]**.
Levels graded: cp-1 Reduced Sample Space (numeric), cp-2 Bayes (numeric), cp-3 Total Prob & Continuous
(numeric), cp-4 Races & Recursion (numeric), cp-5 Russian Roulette (quiz). cp-6 Paradoxes is a
`flashcard` level — **0 gradable (item,wrong-answer) pairs**, so no ladder to audit there.

Severity key: **S1** critical (wrong explanation / diagnosis / routing) · **S2** major
(generic-when-should-be-specific / mismatched sim / incomplete explanation / missing rationale) ·
**S3** minor (formatting / slightly-generic / known truncation).

---

## 1. Defect table

Rows are representative of each defect **class**; the "scope" note quantifies how widely the same
root cause recurs (deduped by family+tag). Quotes are verbatim from `conditional.txt`.

| level / family | item id | wrong-answer | actual bad output (quote) | metric(s) failed | sev |
|---|---|---|---|---|---|
| cp-5 genRRFixed | `cp-rrfixed-5-3` | `1/2` (idx 3) | R1: `"That's not the right answer yet — and it doesn't line up with any of the usual mistakes for this question, so I won't guess…"` — despite AUTHORED `"The symmetry guess. With 5 chambers (odd count) the first player pulls the extra chamber, so it isn't exactly ½, it's 2/5."` | accuracy | **S2** |
| cp-5 genRRRespun | `cp-rrrespun-8-1` | `7/15` (idx 1) | R1: generic-fallback `"…it doesn't line up with any of the usual mistakes…"` — AUTHORED was specific: `"That's the FIRST player's survival 7/15. Player 2 is safer…: 8/15."` | accuracy | **S2** |
| cp-3 genTransfer | `cp-transfer-4-4-2-2-3` | `0.6` | R1: generic-fallback — AUTHORED `"You assumed a RED marble made the trip for certain. It is red only w.p. 1/2; average over both transfer outcomes."` (the "1/2" collides with the answer 0.5) | accuracy | **S2** |
| cp-5 genRRFixed / genRRRespun / genRRTwoRandom / genRRTwoConsecutive | all cp-5 items | all | R4: `"Open the Simulations tab → "Bayes via Natural Frequencies" … see why a positive test is usually a false alarm."` — a base-rate/false-positive sim, unrelated to memoryless-cylinder survival | thoroughness (R4 sim) | **S2** |
| cp-4 genSumRace | `cp-race-6-5-2` | `0.6` | R4 → `"Bayes via Natural Frequencies"` on an ordered-dice race (should be the sample-space "count the cells" sim); R1 also clipped to `"…counting unordered pairs gives 3 and 2 ways."` | thoroughness (R4 sim) | **S2** |
| cp-4 genFirstStep / genTie / genFirstToss | `cp-firststep-3-4-0`, `cp-tie-12-1`, … | all | R4 → `"Bayes via Natural Frequencies"` on recursion / re-roll race items; no sim fits, yet it links to the Bayes sim anyway | thoroughness (R4 sim) | **S2** |
| cp-3 genUniform | `cp-unif-2-12-10-1-0` | `0.1` | R4 → `"Bayes via Natural Frequencies"` for a continuous-uniform "not memoryless" item; R2 → `"Which direction is being asked — the chance of A given B, or of B given A?"` (irrelevant to the method) | thoroughness (R4 sim + R2 plan) | **S2** |
| cp-1 genBertrandNumeric | `cp-bertnum-2-3-0` | `0.5` (must_be_half) | R4 → `"Bayes via Natural Frequencies"` for a Bertrand's-box faces-vs-objects item (siblings `faces_not_objects`→dice-rolls, `complement_confusion`→venn — inconsistent) | thoroughness (R4 sim) | **S2** |
| cp-3 genLotpLine / genTransfer, cp-4 all | many | many | R2: `"…the chance of A given B, or of B given A? … Which group does the 'given' fact restrict you to…"` applied to law-of-total-probability, continuous, race & recursion items — wrong framing for those methods | thoroughness (R2 plan) | **S2** |
| cp-1 genBothNumeric | `cp-bothnum-10-2` | `0.1` | R2: `"Are these two events independent, or does one shift once the other has happened? … 'and' or 'or'…"` — frames a "both given at-least-one" reduced-sample-space conditional as an independence/AND problem | thoroughness (R2 plan) | **S2** |
| cp-1 genBertrandNumeric | `cp-bertnum-2-3-0` | (R5) | R5: `"P(underside also red) = 4/7 = 4/7 ≈ 0.5714"` — duplicated fraction (`= X = X`) | thoroughness (R5 fmt) | **S3** |
| cp-1 genAllOnNumeric | `cp-allonnum-3-1` | (R5) | R5: `"P(A|B) = (1/8)/(7/8) = 1/7 = 1/7 ≈ 0.1429"` — duplicated fraction | thoroughness (R5 fmt) | **S3** |
| cp-1 genBothNumeric | `cp-bothnum-10-2` | (R5) | R5: `"…so P = 1/19 = 1/19 ≈ 0.0526."` — duplicated fraction | thoroughness (R5 fmt) | **S3** |
| cp-1 genGivenSumNumeric | `cp-gsumnum-8-4-2-2` | (R5) | R5: `"…so the conditional probability is 1/3 = 1/3 ≈ 0.3333."` — duplicated fraction | thoroughness (R5 fmt) | **S3** |
| cp-1 genTableNumeric | `cp-tablenum-2-11` | (R5) | R5: `"…so P = 2/11 = 2/11 ≈ 0.1818."` — duplicated fraction | thoroughness (R5 fmt) | **S3** |
| cp-3 genUniform | `cp-unif-2-12-10-1-0` | (R5) | R5: `"…giving P = 1/2 = 1/2 ≈ 0.50."` — duplicated fraction | thoroughness (R5 fmt) | **S3** |
| cp-5 genRRFixed | `cp-rrfixed-5-3` | (R5) | R5: `"So P(unharmed) = 2/5 = 2/5."` — duplicated fraction | thoroughness (R5 fmt) | **S3** |
| cp-1 genBertrandNumeric | `cp-bertnum-2-1-3` | (R5) | R5: `"…and 1 red faces on two-tone chips…"` — plural noun after "1" (grammar) | thoroughness (R5 fmt) | **S3** |
| cp-2 genInversionNumeric | `cp-invnum-25-30-24-0` | `0.06` (joint) | R1 clipped to `"That's the JOINT P(A∩B) = P(B|A)P(A). To turn a joint into P(A|B)."` — the corrective Socratic tail (`", what must you still divide by?"`) is dropped, leaving a mid-instruction fragment | accuracy | **S3** |
| cp-2 genBayesTestNumeric | `cp-btnum-2-95-30-4` | `0.019` (joint) | R1 clipped to `"…To turn a joint into P(condition | +)."` — same dropped-question fragment | accuracy | **S3** |
| cp-4 genTie | `cp-tie-12-1` | `0.0833` | R1 clipped to `"That's P(tie) = 12/144 on one round."` (drops the "condition on the 78 decisive outcomes" nudge) | accuracy | **S3** |

No **S1** defects found: every R5 that was checked is mathematically **correct** (e.g. `18/37 ≈ 0.4865`,
`2/13 ≈ 0.1538`, `4/5 ≈ 0.80`, `19/313 ≈ 0.0607`); the duplicated-fraction is cosmetic, the value is right.
No routing target is unrelated (every route lands on L1 or Counting, both genuine prereqs of the node).
The mid-sentence "…so should you keep or" truncation class flagged in the brief did **not** surface in this
module (harness emitted 0 `<<<` truncation flags) — the name-only clip here removes trailing Socratic
*questions* cleanly (S3 fragments above), not connectives.

### Scope of the systematic issues (deduped counts)
- **Duplicated-fraction R5** (`= X = X`): **118** rung-5 lines, spanning `genBertrandNumeric`,
  `genAllOnNumeric`, `genBothNumeric`, `genGivenSumNumeric`, `genTableNumeric`, `genUniform`, and
  `genRRFixed`. Root cause verified in source: every reveal prints `…= <a/b> = ${fracText(value)}…`,
  and when `a/b` is already lowest-terms `fracText` returns the identical string (e.g.
  `generators.ts:399` Bertrand, `:447` AllOn, `:285/837` Both, `:346/896` GivenSum, `:235/784` Table,
  `:1420` Uniform, `:1725` RRFixed). It only *looks* like a reduction when `a/b` is reducible
  (`3/12 = 1/4`, `2/4 = 1/2`). So NOT scoped to `genBertrandNumeric` — the brief's spotted bug has ~117 siblings.
- **Generic-fallback R1 despite an authored rationale**: **7** pairs — the `genRRFixed` "½ symmetry"
  distractor (odd-chamber answers 2/5, 3/7, 4/9), the `genRRRespun` "first player's survival" distractor
  (7/15, 9/19, 11/23), and `cp-transfer-4-4-2-2-3 @0.6`. Mechanism confirmed: the authored text states the
  correct answer, `containsFinalAnswer` trips (`hintLadder.ts:327`), and R1 is nuked to
  `genericFallbackCoaching`. These are the two RR distractor templates that always name the answer.
- **Mismatched R4 sim** = the whole of **cp-3 + cp-4 + cp-5** (races, recursion, continuous, Russian
  Roulette) plus `genBertrandNumeric/must_be_half`. Root cause verified: those families are **absent from
  `SIM_BY_FAMILY`** and their tags aren't Bayes tags, so `simLinkFor` falls through to the section default
  `SECTION_SIM_OVERRIDES["Conditional Probability"] = "bayes-natural-frequency"`
  (`hintTopicHelp.ts:199`). Contrast cp-1 counting families, which *are* mapped → correct "sample-space" sim.
- **Mismatched R2 plan**: the `"conditional"` section keyword (`probabilityPlans.ts:92`) hands
  `PLAN_CONDITIONAL` ("A given B / B given A") to every cp-3/cp-4/cp-5 item without a family/tag plan;
  and `genBothNumeric` is family-mapped to `PLAN_INDEP_AND` (`:50`), actively mis-framing a
  reduced-sample-space conditional as an independence problem.

---

## 2. Per-metric averages

Representative sample: **60 distinct (family, tag) pairs** across the 5 gradable levels
(cp-1 ×16, cp-2 ×12, cp-3 ×9, cp-4 ×12, cp-5 ×11), deduped by family+tag. cp-6 flashcards excluded (0 pairs).

| metric | mean / 10 | read |
|---|---|---|
| **Accuracy** (R1 names the SPECIFIC trap for that exact wrong answer) | **8.4** | Strong — most R1s are precise, per-value diagnoses. Dragged down only by the 7 answer-leak generic-fallbacks and a handful of over-eager name-only clips that drop the Socratic tail. |
| **Thoroughness** (rungs complete+coherent, R2 useful, R4 right sim, R5 complete+correct) | **5.4** | Weakest axis. Two systematic drags: R4 points cp-3/cp-4/cp-5 at the Bayes sim, and R5 duplicated-fraction is near-universal in cp-1. cp-2 (Bayes) is the bright spot (~9). |
| **Next-topic ZPD** (routes to an appropriate prereq) | **6.9** | Acceptable but blunt — canonical Bayes/counting tags route via misconception-edge to the right prereq; everything else defaults to L1 "Meaning of Probability", which is a fine floor for cp-1/cp-3 but too-easy for cp-4 recursion / cp-5 Russian Roulette. |

Level-by-level thoroughness: cp-2 ≈ 8.6 (excellent) ≫ cp-1 ≈ 6.2 (dup R5) > cp-3 ≈ 4.6 ≈ cp-4 ≈ 3.8 ≈ cp-5 ≈ 3.7 (mismatched sim + plan).

---

## 3. Ranked top ~8 worst offenders

1. **cp-5 `genRRFixed` "½-symmetry" distractor** (`cp-rrfixed-5-3/-7-3/-9-…` idx for `1/2`) — *triple hit*:
   R1 collapses to generic-fallback because the authored rationale leaks the answer (`"…it's 2/5"`), R4
   points at the unrelated Bayes sim, and R5 duplicates (`"P(unharmed) = 2/5 = 2/5"`). Worst single cell in the module.
2. **cp-5 `genRRRespun` "first player's survival" distractor** (`cp-rrrespun-8-1/-10-4/-12-5`) — well-authored,
   specific coaching (`"That's the FIRST player's survival 7/15…"`) silently discarded to generic-fallback by the answer-leak guard.
3. **cp-3 `genTransfer` @0.6** (`cp-transfer-4-4-2-2-3`) — the only *numeric* generic-fallback: authored `"…red only w.p. 1/2…"` collides with the 0.5 answer and gets nuked; learner sees boilerplate for a genuinely distinct LOTP mistake.
4. **cp-4 `genSumRace` (all tags)** — R4 sends an ordered-dice race to "Bayes via Natural Frequencies" when the sample-space "count the cells" sim is exactly the right confront; compounded by R2's conditional-direction plan and clipped R1.
5. **cp-3 `genUniform` (all tags)** — continuous "not memoryless" item gets the Bayes sim *and* the "A given B vs B given A" plan (neither applies) *and* a duplicated `1/2 = 1/2` reveal.
6. **cp-4 `genFirstStep` / `genFirstToss` / `genTie`** — recursion & re-roll races routed to the Bayes sim + conditional-direction plan, and ZPD floors to L1 (too easy for a fixed-point recursion learner).
7. **cp-1 `genBertrandNumeric/must_be_half`** — because the family is missing from `SIM_BY_FAMILY`, this tag falls through to the Bayes sim while its two siblings get dice-rolls / venn; add the duplicated `4/7 = 4/7` reveal and the `"1 red faces"` grammar.
8. **cp-1 `genBothNumeric` (all tags)** — R2 = `PLAN_INDEP_AND` mis-frames "both given at-least-one" as an independence/AND question (the whole lesson is that conditioning breaks independence), plus duplicated `1/19 = 1/19` reveal.

Honorable mention (pervasive, low severity): the **duplicated-fraction R5** across 118 lines and the
**name-only clip dropping the Socratic tail** (`"To turn a joint into P(A|B)."`) across the Bayes joint/likelihood
distractors — both cosmetic but high-frequency.
