# Firm Mock-Interview Presets — As-Shipped Specs

**Refreshed:** 9 Aug 2026 · Source of truth: `src/lib/mock/presets.ts` (this doc is
kept in sync with the code, not the other way around). Companion to
`FIRM_INTERVIEW_LIVE_RESEARCH_2026.md`.

> **Scope / what actually ships.** Exactly **three** presets are wired and
> runnable: **Optiver**, **Jane Street**, and **SIG**. Every other firm in the
> research (Citadel, IMC, DRW, Five Rings, Akuna, Jump, HRT, …) is **reference /
> blueprint only** — there is no runnable preset for them, so they are **not
> generated, not sampled, and not measured** by `scripts/mockQualitySampler.ts`.
> Do not read their appearance in the research docs as a shipped product.

**Design rules (apply to all shipped presets):**
- **No finance/options domain knowledge required.** Every item tests reasoning,
  mental math, probability/EV, estimation, sequences, or market-making
  *intuition* — never Greeks, pricing models, or product knowledge.
- **Question-type vocabulary:** `mental-math`, `probability-ev`,
  `market-making`, `brainteaser`, `sequences`, `estimation`.
- **Difficulty tiers:** `easy` / `medium` / `hard` / `stretch` (hardest). Every
  scored item clears the **hard floor** enforced by `interviewGate.auditScript`
  (market-making and brainteaser rounds are floor-checked too).
- **Easy-family hard cap = 1.** The "easy" FAMILIES — `sequences`,
  `mental-math`, `estimation` — may each appear at most **once** per mock.
- **Per-question time target** is in seconds. Two regimes: **sprint** (~8–20s)
  and **reasoning** (~45–240s).
- **Pinned archetypes are verifier-sourced.** Slots that pin a firm-signature
  archetype (`optiver-quadratic-demo`, `lattice-paths`, `bank-or-roll`,
  `sig-confidence-bet`) draw a fixed flagship problem whose answers come from the
  deterministic verifiers in `src/lib/mock/archetypes/verifiers.ts` — not inline
  literals.
- **Adversarial behavior** is defined per-firm and drives the app's mid-answer
  `probe` and post-answer `adversarial` follow-up systems.

**Preset headline comparison (as shipped):**

| Preset | Scored Q | Pace regime | Scoring | Signature adversary |
|---|---|---|---|---|
| Optiver Style — *Sequences & Odds* | **13** | 1 sequence + 1 timed estimate + rapid prob/EV (45–120s) + 2 MM | reasoning-graded; speed graded but a right answer is always right | Pickoff bot + relentless clock |
| Jane Street Style — *Make a Market* | **11** | 8s numeric gate + reasoning (120–180s) + 3-round MM finale | raw-correct gate; reasoning/MM reasoning-graded | Adverse selection + "defend & extend" |
| SIG Style — *Think in Bets* | **12** | 20s numeric warm-up + deep reasoning (180–240s), calculator allowed | no penalty; reasoning-graded, partial credit | "How much would you bet?" + poker EV |

Each preset appends **2 behavioral prompts** at the very end as **unscored**
flashcards (excluded from every score).

---

## PRESET 1 — "Optiver Style — Sequences & Odds" (13 scored)

**What this firm is really testing (2026 format):** Optiver phased out the old
80-in-8 arithmetic sprint from *this* round; its OA is now progressive
number-**sequence** patterns (NumberLogic) and rapid **probability/EV** (Beat the
Odds), plus **time-starved estimation** where you must *bucket rather than
compute exactly*, and a face-down-cards market-making game.

- **Speed decision (documented):** the standalone timed-arithmetic screen
  (80-in-8) is **intentionally delegated to the Speed Arena**, not duplicated
  here — this preset is the reasoning half. To preserve Optiver's *other*
  signature hardness, the preset now includes **one hard estimation item on a
  punishing 60s clock** (bucket/estimate, don't compute exactly).
- **Scoring:** reasoning-graded; speed is graded but a correct answer is always
  correct. Sequences and estimation are easy FAMILIES, so exactly **one of each**
  appears; the discriminating signal is the probability/EV run.

**Ordered question mix (13):**

| # | Type | Difficulty | Time (s) | Notes |
|---|---|---|---|---|
| 1 | sequences | hard | 45 | **Pinned** NumberLogic demo `5, 11, 23, 41, 65 → 95` (constant 2nd difference) |
| 2 | probability-ev | hard | 60 | Beat-the-Odds: conditional draw without replacement |
| 3 | **estimation** | hard | 60 | **Time-starved Fermi** — estimate/bucket under a punishing clock (Optiver signature) |
| 4 | probability-ev | hard | 60 | Beat-the-Odds: independence / two-of-three |
| 5 | probability-ev | hard | 75 | expected flips = 1/p; memorylessness |
| 6 | probability-ev | hard | 75 | combinatorics / counting with a constraint |
| 7 | probability-ev | stretch | 120 | **Pinned anchor** `lattice-paths`: random-walk meeting + parity trap |
| 8 | probability-ev | hard | 90 | order statistics (max/min of dice) |
| 9 | probability-ev | stretch | 100 | pattern-wait / gambler's ruin (self-overlap trap) |
| 10 | probability-ev | hard | 90 | optimal stopping / bank-or-roll EV |
| 11 | probability-ev | stretch | 120 | Bayes / combinatorics with a constraint |
| 12 | market-making | hard | 120 | face-down cards: quote a two-way market; bot picks off |
| 13 | market-making | stretch | 120 | bot picks off harder — reveal a card, re-quote tighter |

**Adversary:** the **clock and the pickoff** are the adversary. On probability
items the probe nudges toward estimation/bucketing when the candidate stalls; in
the MM finale the pickoff *is* the feedback (quote too cheap → ask lifted; too
wide → refused).

---

## PRESET 2 — "Jane Street Style — Make a Market" (11 scored)

**What this firm is really testing:** Jane Street screens arithmetic in a
**separate** timed math test, so this mock is the **trader conversation**, not a
math sprint — one quick numeric warm-up, then reasoning out loud: EV /
optimal-stopping games that **mutate** as you go, probability with a twist, logic
brainteasers, and an escalating make-a-market finale.

- **Scoring:** raw-correct on the numeric gate (no penalty); probability /
  brainteaser items reasoning-graded; market-making scored on P&L + update
  quality. Every right answer earns a follow-up that **changes an assumption or
  generalizes** ("defend & extend").
- **Note:** there is **no** standalone Fermi/estimation item in this preset (the
  intro no longer promises one).

**Ordered question mix (11):**

| # | Type | Difficulty | Time (s) | Notes |
|---|---|---|---|---|
| 1 | mental-math | hard | 8 | one hard numeric warm-up (math is screened separately) |
| 2 | probability-ev | hard | 120 | conditional / gambler's ruin — narrate, then change an assumption |
| 3 | brainteaser | hard | 120 | logic puzzle under pressure; clarify the rules |
| 4 | probability-ev | hard | 150 | **Pinned** `bank-or-roll` cascade: rule change → generalize-to-n |
| 5 | probability-ev | stretch | 140 | hard conditional / pattern-wait; change an assumption |
| 6 | brainteaser | hard | 150 | generalize-to-n variant |
| 7 | probability-ev | hard | 120 | optimal-stopping EV — narrate, then mutate a rule |
| 8 | probability-ev | stretch | 140 | hard Bayes / combinatorics with a constraint |
| 9 | market-making | hard | 150 | make a market on a hidden value; interviewer trades |
| 10 | market-making | hard | 150 | adverse selection → re-quote, manage inventory |
| 11 | market-making | stretch | 180 | quote on a running sum |

**Adversary:** **"defend & extend"** — after a correct answer, *"Why?"* → *"What
if I change this parameter?"* → *"Now generalize to n."* Plus adverse-selection
needling in the MM finale.

---

## PRESET 3 — "SIG (Susquehanna) Style — Think in Bets" (12 scored)

**What this firm is really testing:** **calibrated decision-making under
uncertainty**, not arithmetic speed. SIG allows a **calculator + scratch pad**;
the difficulty is **framing the problem correctly** and **betting appropriately
on your own confidence**.

- **Scoring:** no wrong-answer penalty; reasoning-graded with partial credit for
  correct framing even if the final number slips. One quick numeric warm-up up
  front; after that the calculator is enabled and arithmetic speed is not the
  differentiator.

**Ordered question mix (12):**

| # | Type | Difficulty | Time (s) | Notes |
|---|---|---|---|---|
| 1 | mental-math | hard | 20 | one hard numeric warm-up (do it in your head) |
| 2 | probability-ev | hard | 180 | **Pinned** `sig-confidence-bet`: confidence → how much would you bet? |
| 3 | probability-ev | hard | 180 | conditional draw / independence, multi-step |
| 4 | brainteaser | hard | 240 | logic + path-counting |
| 5 | probability-ev | hard | 210 | conditional / Bayes, multi-step |
| 6 | probability-ev | stretch | 240 | combinatorics with a constraint |
| 7 | brainteaser | hard | 210 | constraint / deduction |
| 8 | probability-ev | hard | 210 | geometric expected waiting-time |
| 9 | brainteaser | stretch | 240 | single-variable optimization |
| 10 | probability-ev | stretch | 210 | bet on your own posterior (Bayesian composition) |
| 11 | market-making | hard | 150 | make a market as a bet-sizing decision |
| 12 | market-making | hard | 180 | pot-odds / EV under social pressure |

**Adversary:** the **confidence-calibration probe** — *"How confident are you?"*
then *"How much of your bankroll would you bet?"*; miscalibration is met with a
bet at exploitative odds.

---

## Cross-preset implementation notes

- **Regime flags per item:** each item carries `regime: sprint | reasoning` so
  the timer UI switches between hard auto-advance and soft/generous pacing.
- **Diversity + floors enforced in code:** `interviewGate.auditScript` checks
  adjacency (no back-to-back same family; MM finale exempt), per-family caps, ≥5
  distinct families, the easy-family hard cap (=1), and the **hard difficulty
  floor on every scored item — math, market-making, AND brainteaser**.
- **Rubric coverage:** `interviewRubric.rubricItemsFromScript` extracts every
  scored item — conceptual math (base + two typed follow-ups), market-making
  rounds, and brainteasers — so the trivial-base guard (e.g. "make a market on
  12 × 14") and hard-floor check reach MM and brainteaser steps. MM/brainteaser
  items press via the quote sequence / reflect probes, so they are reviewed for a
  non-trivial hard-floor BASE only (not the two-follow-up expectation).
- **Market-making scenarios** are computable and non-trivial (Gauss sums,
  handshake/diagonal counts, sum-of-squares, and an **order-statistic** E[max of
  k dice] — the trivial linear "3.5 × k dice sum" was removed).
- **Metrics:** `datasets/mock-quality-metrics.md` reports the structural gate and
  the deterministic heuristic re-check across all three runnable presets.
