# Free-Response + 5-Rung Hint Ladder + Partial-Credit Mastery — Design & Rationale

This documents the finalized partial-credit schedule, its grounding in the Nessie
brainlift **"BrainLift: Adaptive Learning Engine for Quant-Trader Prep
(Remediation, Tutoring, Assessment, ML)"** (DOK 1/2), and the shared
infrastructure that implements the free-response, hint-attempt flow. Cross-refs
the feature→DOK map in `datasets/FEATURE_TO_BRAINLIFT_MAP.md` (§Tutoring, §Mastery).

Brainlift source context id: `d2b94e7d-6d89-4926-a2f0-835c1116b023`.

---

## 1. The flow (confirmed decisions)

On a **wrong** free-response answer the app does **not** reveal the solution. It
discloses a 5-rung hint ladder **one rung at a time** and lets the learner
**re-attempt the same instance** after each rung. We track the **highest rung
reached** before a correct answer. If still wrong after all 5 rungs, the item is
fully wrong (credit 0). A correct answer after the full solution has been shown
(rungs 3, and especially 5) is worth almost nothing.

The 5 rungs (target design):

1. **Detected-misconception coaching** — when the wrong numeric entry matches a
   known **parametric error mode** for the question's family, show a specific,
   encouraging sentence that names the mistake and asks a leading question
   (answer withheld). Falls back to a solid generic nudge on no/ambiguous match.
2. **Guided intuition** — a concrete worked mini-example / case analysis adapted
   to the family (e.g. the natural-frequency tree for Bayes). Answer withheld.
3. **Worked walkthrough with different numbers** — the full method on a fresh
   same-family sibling, every shown computation code-verified. (Method revealed.)
4. **Deep-link to the exact simulation** on the Simulations tab (elicit-then-confront).
5. **Exact same problem solved end-to-end** — every step, code-verified. (Answer revealed.)

---

## 2. Final partial-credit schedule

| Highest rung reached before correct | Credit | User's proposal |
|---|---|---|
| No hint (first-try correct) | **100%** | 100% |
| Correct after rung 1 (misconception coaching) | **65%** | 60% |
| Correct after rung 2 (guided intuition) | **45%** | 50% |
| Correct after rung 3 (diff-numbers walkthrough) | **20%** | 20% |
| Correct after rung 4 (sim deep-link) | **10%** | 10% |
| Correct after rung 5 (exact solution shown) | **4%** | 5% |
| Wrong after all 5 rungs | **0%** | 0% |

Implemented in `src/lib/tutor/creditSchedule.ts` (`RUNG_CREDIT`, `creditForEpisode`).

### Why these numbers (reconciling research with the user's proposal)

The credit tracks **how much of the answer/solution was handed over** — the
KR < KCR < EF feedback hierarchy plus the answer-withholding stance:

- **Van der Kleij, Feskens & Eggen (2015) + Shute (2008)** [DOK C2.2]: elaborated,
  answer-**withholding** feedback (EF, d≈0.49) ≫ giving the correct answer
  (KCR, d≈0.32) ≫ bare right/wrong (KR, d≈0.05), with the largest effects in
  mathematics. Rungs 1–2 are EF that **withhold** the answer → high credit; rungs
  3–5 progressively reveal the method then the answer (KCR-ward) → the credit
  cliff at rung 3.
- **Kapur (2008; 2014) productive failure** [DOK C1.2]: a first miss followed by a
  single misconception nudge the learner self-corrects from is a *productive*
  recovery, close to independent solving → rung-1 credit stays **high (0.65)**,
  a small bump over the user's 60.
- **VanLehn (2011)** [DOK C2.2]: step-based guidance is genuine learning (d≈0.76),
  so early-rung recoveries keep **meaningful, not near-zero** credit.
- **Corbett & Anderson BKT** guess parameter P(G) [DOK C3.1]: a correct answer
  *after the exact problem was solved end-to-end* (rung 5) is near-guess-level
  evidence of knowledge → **floor credit (0.04)** — "almost nothing," as asked.
- **Shute's** "do not always immediately reveal the answer" + help-abuse framing:
  the user cited **Aleven & Koedinger** (gaming-the-system / help-seeking). Note
  this brainlift has **no dedicated Aleven/Koedinger DOK entry**; we ground the
  help penalty in Shute + Van der Kleij (KCR<EF) + BKT-guess instead. Withholding
  the answer and decaying credit disincentivises hint-mining while still rewarding
  genuine guided recovery.

Deltas vs the user's proposal and why:

- **Rung 1 60→65**: EF is the single highest-value feedback type and the answer is
  fully withheld — a self-correction from one leading question is close to
  productive-failure independent recovery (Kapur). Still well below 100 to
  preserve the no-help signal and discourage help-mining.
- **Rung 2 50→45**: widen the rung-1↔2 gap so *fewer hints* is more clearly
  rewarded; rung 2 hands over a concrete worked mini-example (more scaffolding
  than rung 1's single nudge), so its evidence of **independent** mastery is
  lower. Rungs 1–2 (answer-withheld EF) stay clearly above the rung-3 cliff.
- **Rung 3 kept at 20**: the deliberate cliff — a full worked method (different
  numbers) is shown, crossing EF→KCR territory.
- **Rung 4 kept at 10**: sim deep-link (elicit-then-confront; Fischbein/Konold,
  Gigerenzer) — heavy scaffolding.
- **Rung 5 5→4**: the exact problem is solved end-to-end ⇒ answer effectively
  revealed; a subsequent correct is near-guess evidence (BKT P(G)). A tiny
  non-zero floor acknowledges engagement without materially moving mastery.

The schedule is **strictly monotone decreasing**; the largest single drop is
no-hint→rung-1 (0.35 — the "any help at all" penalty) and the largest drop among
hinted rungs is rung-2→3 (0.25 — the answer-withheld→method-revealed boundary).

---

## 3. How partial credit feeds the mastery engine (Elo + Beta)

The mastery fold `applyItemAttempt` (`src/lib/mastery/mastery.ts`) now reads an
optional fractional `credit ∈ [0,1]` off `ItemAttempt`; when absent it falls back
to the binary `correct ? 1 : 0`, so **every existing binary caller (quiz,
remediation, diagnostic) is unchanged and back-compatible**.

- **Elo** (Pelánek 2016, DOK C3.1): the fractional credit is used directly as the
  actual score `S ∈ [0,1]` in `θ += K_s(n)·(S − P)` and `d += K_d·(P − S)`.
  `updateElo` was widened from `y: 0|1` to `y: number`; the update expression is
  identical, so partial credit "just works." Free-response items are no-guess
  (`kOptions` omitted ⇒ `P = σ(θ−d)`).
- **Beta-Binomial** (Bayes Rules! — Johnson, Ott & Dogucu, DOK C3.1): the credit is
  a **fractional pseudo-count** — `α += credit`, `β += (1 − credit)` — the
  principled continuous generalization of the α=successes/β=failures conjugate
  update (posterior-mean blend). A rung-5 recovery (0.04) adds ≈0.04 success +
  ≈0.96 failure, barely moving the posterior mean and correctly signalling "still
  essentially can't do this unaided," which keeps the credible-interval verdict
  honest.
- **Misconceptions**: the fold now decays flags only on a **clean full-credit
  solve (S ≥ 1)** and bumps the tripped keys whenever any help was needed
  (credit < 1) or the item was missed — because a partial-credit recovery still
  demonstrated the misconception on its first wrong attempt.
- **Analytics**: `ItemAttempt.highestRung` records the highest rung reached
  per item (cheap; never affects the math).
- **Calibration**: the reliability-diagram outcome logs the **unaided** signal
  (first-try correct, `highestRung===0`), not the hinted recovery, so
  "confidently wrong" stays meaningful.
- **Level unlock gate** (`recordAttempt`, `LevelProgress.mastered`) is unchanged
  and still binary on the final answer — the Candy-Crush locking is intentionally
  separate from the per-topic Elo/Beta mastery estimate.

---

## 4. Shared infrastructure (Phase 1, all additive + green)

| Module | Purpose |
|---|---|
| `src/lib/tutor/creditSchedule.ts` | `RUNG_CREDIT` map + `creditForEpisode`. |
| `src/lib/tutor/hintEpisode.ts` | Pure state machine for the re-attempt episode (reveal-one-rung-per-miss, track highest rung, resolve credit). |
| `src/lib/tutor/errorModes.ts` | Parametric error-mode framework: `ErrorModeSpec<P>`, `ErrorModeCatalog<P>`, `buildCommonErrors` (generation-time), `matchErrorMode` (grade-time), collision handling. |
| `src/lib/numeric.ts` | `parseFreeResponse` (numbers/fractions/decimals/percentages/simple `+−×÷()` expressions, safe recursive-descent — no `eval`) + `gradeFreeResponse`. |
| `src/lib/mastery/{elo,beta,mastery}.ts`, `src/types/mastery.ts` | Fractional-credit Elo/Beta; `ItemAttempt.credit`/`highestRung`. |
| `src/components/tutor/HintLadder.tsx` | Optional `controlledRevealed` for parent-driven, re-attempt-paced disclosure. |
| `src/pages/LessonPage.tsx` `FreeResponseCard` | The primary-round free-response player: input stays live for re-attempts, ladder discloses one rung per miss, resolves once and folds partial credit. |

Tests: `creditSchedule.test.ts`, `hintEpisode.test.ts`, `errorModes.test.ts`,
`numeric.test.ts` (free-response cases), `mastery/partialCredit.test.ts`.

---

## 5. Error-mode catalog design (the heart of rung 1)

Questions are **parametric** (generators + exact solvers), so the "top mistakes"
are implemented as **parametric error-mode functions per family**: each mode is a
tiny solver computing the WRONG value for ANY parameterization, keyed to a
misconception id (`src/lib/tutor/misconception.ts` `MISCONCEPTION.*`) + a rung-1
coaching sentence template. A per-family `ErrorModeCatalog<P>`:

- at **generation time** a generator calls `buildCommonErrors(catalog, params,
  correct, { decimals })` to emit the instance's `NumericQuestion.commonErrors`
  (value + coaching feedback + misconception tag), computed from the same params
  as the correct answer so they can never drift;
- at **grade time** `gradeFreeResponse` / `matchErrorMode` normalizes the entry
  and matches it against those values; unmatched ⇒ generic rung-1 nudge;
- **collisions**: a mode equal to the correct value is dropped; two modes with the
  same value keep the first (deterministic).

Worked example (matches the user's own "you added the probabilities" example):
`src/content/probabilityStats/errorModeCatalogs.ts` +
`errorModeCatalogs.test.ts` — the independent-AND family with
`added_instead_of_multiplied`, etc. Enumerate GENUINE modes per family (typically
5–15; cap 50; never pad).
