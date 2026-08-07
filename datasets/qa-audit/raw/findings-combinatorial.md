# QA Sub-Audit — Hint-Ladder Quality — Module: `combinatorialAnalysis`

Read-only audit. No `src/**` files modified. Source of truth: `datasets/qa-audit/raw/combinatorial.txt`
(1,192 blocks, 8 seeds, 14 levels — 13 scored + 1 flashcard), cross-checked against the generators
(`genChooseK.ts`, `genTraps.ts`, `genArrangements.ts`, `genBinomial.ts`, `genGrid.ts`, `genHyper.ts`,
`genPoker.ts`, `genGeneralCounting.ts`, `solvers.ts`, `levels.ts`), the ladder builder
(`hintLadder.ts`), the answer-leak guard (`answerWithholding.ts`), sim resolver (`hintTopicHelp.ts`),
plan resolver (`evCombinatoricsPlans.ts`), and remediation (`policy.ts`, `prereqDAG.ts`).

Sample: **58 distinct `(item, wrong-answer)` pairs**, deduped by `family + tag + choice`, spanning all
13 scored levels (`ca-1, ca-2, ca-3, ca-comp, ca-bino, ca-symm, ca-4, ca-5, ca-6, ca-7, ca-tourn,
ca-count, ca-8`) and ~45 generator families. `ca-9` is flashcard-mode → 0 laddered items (correctly skipped).

---

## 0. Headline

Two systematic root-cause defect classes dominate; the rest of the module is genuinely strong (correct
R5 math everywhere, always a domain R2 plan, no broken routing, no incorrect explanations).

- **DEFECT CLASS A — answer-leak-guard false positive (S2, ~12 distinct classes, 15 raw blocks).**
  When an authored distractor rationale legitimately references a number that *numerically equals the
  correct answer* (a factor, a lattice coordinate, or an intermediate), `containsFinalAnswer` fires and
  `hintLadder` silently replaces the specific coaching with `genericFallbackCoaching`
  ("That's not the right answer yet — and it doesn't line up with any of the usual mistakes…").
  The learner loses the one rung that names their exact mistake. Verified mechanism in
  `answerWithholding.ts` (`extractNumbers` pulls `a/b` fractions and every plain number).

- **DEFECT CLASS B — `nameOnlyCoaching` keeps the pre-"but" concession, drops the diagnosis (S2, 3 classes, ~24 raw blocks).**
  For authored feedback shaped "You did X right, **but** [the real error]", the `" but "` structural
  marker in `nameOnlyCoaching` (`hintLadder.ts`) cuts *after* the concession, so rung 1 keeps only the
  praise ("You have order right.", "You allowed repeats, good.", "Shrinking the pool size.") and throws
  away the actual mistake. The `genOrderedDraw` case is the worst: "Shrinking the pool size." describes
  the *correct* action, so the rung is actively misleading.

Positives: **R5 reveals were complete and mathematically correct in 100% of sampled items**; **R2 was a
domain plan in 100% of items** (zero `GENERIC_PLAN` — grep for "before you recompute" = 0); **routing
never broke** (every block resolves to a valid node/target); **no S1** (no wrong math, no wrong-error
diagnosis, no broken descent). The already-known mid-sentence truncation class is effectively fixed —
the harness `truncationFlag` produced **0** flags; only one residual formatting blemish remains
(unbalanced paren, S3 below).

---

## 1. Defect table

Severity: **S1** critical (wrong/incorrect explanation, diagnosis, or broken routing); **S2** major
(generic-when-should-be-specific / mismatched sim / incomplete explanation / missing rationale); **S3**
minor (formatting / slightly-generic / known-truncation).

| level/family | item id | wrong-answer | actual bad output (short quote) | metric(s) failed | sev |
|---|---|---|---|---|---|
| ca-tourn / genSemicircle | `gen-semicircle-4-4` | 0.125 | R1 = "That's not the right answer yet — … doesn't line up with any of the usual mistakes…" (authored: "(1/2)^{n−1} = 1/8 …") | ACCURACY | S2 |
| ca-tourn / genSemicircle | `gen-semicircle-4-4` | 0.0625 | same generic fallback (authored: "(1/2)^n = 1/16 …") | ACCURACY | S2 |
| ca-tourn / genSemicircle | `gen-semicircle-4-4` | 0.25 | same generic fallback (authored: "n·(1/2)^n = 1/4 …") | ACCURACY | S2 |
| ca-7 / genOrderedDraw | `gen-ordereddraw-5-6-1100-0` | 0.1136 | R1 = "Shrinking the pool size." (authored real error dropped: "…but reusing the ORIGINAL colour counts") | ACCURACY (misleading) | S2 |
| ca-5 / genReplacementTrapNumeric | `replacement-trap-num-n4-k3` | 24 (P(n,k)) | R1 = "You have order right." (drops "…but P(4,3) forbids reusing a symbol") | ACCURACY | S2 |
| ca-5 / genReplacementTrapNumeric | `replacement-trap-num-n4-k3` | 20 (C(n+k−1,k)) | R1 = "You allowed repeats, good." (drops "…but C(4+3−1,3) treats the positions as unordered") | ACCURACY | S2 |
| ca-1 / genOneAssignment | `ca-oneassign-8-7-0` | 0 | generic fallback; authored "1/8! = 1/40320 …" leaks "1/8" = answer 0.125 | ACCURACY | S2 |
| ca-1 / genOneAssignment | `ca-oneassign-5-4-2` | 0.01 | generic; authored "1/5! = 1/120 …" leaks "1/5" = answer 0.2 | ACCURACY | S2 |
| ca-1 / genOneAssignment | `ca-oneassign-5-4-2` | 0 | generic; authored "1/5^4 = 1/625 …" leaks "1/5" = answer 0.2 | ACCURACY | S2 |
| ca-bino / genDigitOrder | `gen-digits-distinct-2-2` | 0.81 | generic; authored "(9/10)^2 …" leaks "9/10" = answer 0.9 | ACCURACY | S2 |
| ca-bino / genDigitOrder | `gen-digits-distinct-2-2` | 0.19 | generic; authored "(9/10)^2 …" leaks "9/10" = answer 0.9 | ACCURACY | S2 |
| ca-6 / genAlternatingSteps | `gen-altstride-14-3-1-3-2` | 680 | generic; authored "C(17, 3) = 680 … to (14, 3)" leaks coordinate "14" = answer 14 | ACCURACY | S2 |
| ca-6 / genAlternatingSteps | `gen-altstride-16-3-1-3-4` | 84 | generic; authored "C(9, 3) = 84 … must SUM to 3" leaks "3" = answer 3 | ACCURACY | S2 |
| ca-6 / genAlternatingSteps | `gen-altstride-16-3-1-3-4` | 512 | generic; authored "2^9 = 512 … total exactly 3" leaks "3" = answer 3 | ACCURACY | S2 |
| ca-count / genLinearityWords | `gen-linwords-4-1-17-5` | 17 | generic; authored "…16·1/16 = 1 …" leaks "16" = answer 16 | ACCURACY | S2 |
| ca-symm / genDieCompare | `gen-diecmp-pair-10-20-3` | choiceIdx=1 ("31/40") | R1 = "Counts TIES as wins (P(≥)." — cut at " instead", unbalanced paren, reads as clipped | THOROUGHNESS | S3 (known-class) |
| ca-3 / genPokerHandNumeric | `ca-poker-num-*` (all) | all | R4 → "Two-Dice Sample Space" (sample-space) though `poker-hand-equity`/`poker-pot-odds` sims exist and fit better | THOROUGHNESS | S3 |
| ALL levels / ALL families | (module-wide) | all | R4 always resolves to the single sim "Two-Dice Sample Space"; fine for dice-sum/ratio items, weak for arrangements/lattice-paths/coupon/circular items | THOROUGHNESS | S3 |
| trap-heavy families (ordered_vs_unordered / forgot_divide_by_two / faces_not_objects) | e.g. `ca-poker-num-flush-1` v=0.99, `stars-bars`/`ties`/`replacement` | — | ROUTE target = "Mental Arithmetic (L0)" for conceptual-counting slips (arithmetic is the only prereq of the Counting node); slightly too-easy for a *counting-concept* gap | ZPD | S3 |

Note on volume: Class A recurs 15× in the file, Class B recurs ~24× (praise-lead: 18 `genReplacementTrapNumeric`
+ 6 `genOrderedDraw`), but they collapse to ~12 + 3 distinct `(family,tag)` classes after dedupe.

---

## 2. Per-metric average scores  (n = 58 distinct (item, wrong-answer) pairs)

| Metric | Score /10 | Basis |
|---|---|---|
| **ACCURACY** (R1 names the specific trap for that exact wrong answer) | **7.3** | ~26% of R1s are non-specific: ~21% generic-fallback via leak guard (Class A) + ~5% praise-only via pre-"but" cut (Class B). The remaining ~74% name the exact mistake precisely and correctly (poker, hyper, complement, dice-sum, incl–excl, binomial-walk, stars&bars, strictly-increasing all excellent). |
| **THOROUGHNESS** (every rung coherent; R2 useful; R4 the RIGHT sim; R5 complete+correct) | **7.6** | R5 = complete & correct 100% (10). R2 = always a domain plan (9), occasionally off-target for symmetry/EV-flavored items. R4 = the single "Two-Dice Sample Space" sim for the whole module (right for dice/ratio, generic for paths/arrangements/poker/coupon) drags this to ~6–7. Plus the leak/praise R1s are incoherent as a "name". One S3 unbalanced-paren clip. |
| **NEXT-TOPIC ZPD** (failure routes to an appropriate prereq, ~85% target) | **8.6** | 100% of items route to a valid node (Counting & Combinatorics) → **Mental Arithmetic (L0)**, which is the *correct and only* prerequisite of the Counting node, so routing is never broken or unrelated. Docked ~15% because conceptual-counting misconceptions (ordered_vs_unordered / forgot_divide_by_two / faces_not_objects) implicate Counting itself and therefore fall to *pure arithmetic*, which is slightly too-easy for a counting-concept gap — a DAG-structure ceiling, not a per-item routing error. |

---

## 3. Ranked worst offenders (top 8)

1. **`gen-semicircle-4-4` (ca-tourn, genSemicircle)** — *fully degraded item*: **all three** distractors
   (0.125, 0.0625, 0.25) fall to the generic fallback because the answer is exactly **1/2** and every
   authored rationale references the factor "(1/2)", which the leak guard reads as the answer. Zero
   specific coaching on any wrong answer.
2. **`gen-ordereddraw-*` "Shrinking the pool size." (ca-7, genOrderedDraw)** — *actively misleading*:
   the `" but "` cut keeps the concession describing the **correct** action and discards the real error
   ("reusing the ORIGINAL colour counts"). The learner is told the right move was the mistake.
3. **`replacement-trap-num-*` v=P(n,k) "You have order right." (ca-5, genReplacementTrapNumeric)** —
   praise-only rung 1; names nothing about the "forgot replacement" slip. 9 seed-instances.
4. **`replacement-trap-num-*` v=C(n+k−1,k) "You allowed repeats, good." (ca-5)** — same class; drops the
   "order matters" diagnosis. 9 seed-instances.
5. **`ca-oneassign-*` v∈{0, 0.01} (ca-1, genOneAssignment)** — "1/8!", "1/5!", "1/5^4" leak the fraction
   "1/8"/"1/5" that equals the answer → generic. Three distinct low-value distractors degraded.
6. **`gen-altstride-*` v=680/84/512 (ca-6, genAlternatingSteps)** — the destination **coordinate**
   "(14, 3)" (and the "up-strides must sum to 3") contains the integer answer, so the C(n,k)/2^n
   distractors go generic.
7. **`gen-digits-distinct-2-2` v=0.81 & 0.19 (ca-bino, genDigitOrder)** — both distractors leak the
   factor "9/10" that equals the answer 0.9 → generic on both.
8. **`gen-linwords-4-1-17-5` v=17 (ca-count, genLinearityWords)** — "16·1/16 = 1" leaks "16" = answer →
   generic. (Honorable mention: `gen-diecmp-pair-10-20-3` "Counts TIES as wins (P(≥)." unbalanced-paren
   clip, S3 known-class.)

---

## 4. Grounding / verification notes

- **Leak mechanism confirmed in source.** `answerWithholding.ts::extractNumbers` matches `a/b` fractions
  first (so "1/8" → 0.125) and every plain integer/decimal; `hintLadder.ts` lines ~327–329 fall back to
  `genericFallbackCoaching` whenever `containsFinalAnswer(rung1Text, answer)` is true. This exactly
  reproduces the 15 observed generic blocks — each authored rationale I quoted contains a token equal to
  that item's answer. Note it is **parameter-dependent**: `gen-linwords-5-2-26-2` (answer 24) keeps its
  full specific R1, while `gen-linwords-4-1-17-5` (answer 16, rationale mentions "16") does not.
- **Praise-lead cut confirmed.** `genReplacementTrapNumeric` authored coach strings begin "You have order
  right, but …" / "You allowed repeats, good, but …" and `genOrderedDraw` begins "Shrinking the pool size
  but …". `nameOnlyCoaching` cuts at the earliest `STRUCTURAL_MARKER` `" but "`, keeping the head.
- **Routing confirmed.** `prereqDAG.ts`: `COUNTING = "Counting & Combinatorics"` has `prereqs: [L0_ARITHMETIC]`.
  `MISCONCEPTION_EDGE` sends ordered_vs_unordered/faces_not_objects/forgot_divide_by_two → `COUNTING`, but
  since that is the node itself (not in its own prereqs) `descentTarget`/`routeTarget` fall to
  `prereqs[0] = L0_ARITHMETIC`. Hence the uniform "Mental Arithmetic (L0)" target and the `via=prereqs[0]
  (edge not a prereq of node)` / `(no edge)` annotations. No misroute; the ceiling is structural.
- **R5 spot-checks all correct**, e.g. semicircle P = n·½^{n−1} = 4·1/8 = 1/2; poker one-pair
  1098240/2,598,960 = 42.257%; hypergeometric ΣC(8,t)C(19,5−t)/C(27,5) = 3839/4485 ≈ 0.856; lattice-meet
  ΣC(6,i)²/4^6 = C(12,6)/4^6 = 231/1024. No duplicated-token or cut-off reveals found.

---

## 5. Suggested fixes (out of scope — not applied)

1. **Class A:** make `containsFinalAnswer` context-aware for rung-1 sanitisation — e.g. only treat a
   number as a leak if it is presented as the *result/answer* (right of an "=", or the final token),
   not when it appears inside a labeled wrong-method expression ("1/8!", "(1/2)^{n−1}", the coordinate
   "(14, 3)"); or sanitise by masking the leaking token rather than nuking the whole sentence to generic.
2. **Class B:** in `nameOnlyCoaching`, when the pre-marker head for `" but "` is a *concessive* clause
   (starts with "You have…/You allowed…/…right/…good" or is shorter than the post-marker naming clause),
   keep the post-"but" naming clause instead of the concession.
3. **Sim (S3):** add `genPokerHandNumeric → poker-hand-equity` (and consider path/arrangement families)
   to `SIM_BY_FAMILY` in `hintTopicHelp.ts` so rung 4 stops defaulting everything to the two-dice grid.
