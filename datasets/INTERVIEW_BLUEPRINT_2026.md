# Interview Blueprint 2026 — machine-readable, wired to runtime

**Source of truth:** `src/lib/mock/blueprint.ts` (`INTERVIEW_BLUEPRINT_2026`).
**Grounded in:** `datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md`, `FIRM_MOCK_PRESETS.md`,
`FIRM_INTERVIEW_RESEARCH.md`, plus firm-official material (Jane Street trading
mock, SIG game-theory page, Optiver 2026 OA write-ups).

This document is the human-readable companion to the typed blueprint the
generator + acceptance gate actually consume. Previously the hard archetypes
lived only in prose in `datasets/*.md` and were never wired into the runtime mock
generators — this closes that docs→runtime gap: the blueprint is now code, a
conformance test (`blueprint.test.ts`) asserts the presets satisfy it, and the
acceptance gate (`interviewGate.ts` + `interviewRubric.ts`) enforces it.

---

## Gold anchors (the difficulty floor)

Every valid **opener** must be at least as hard as these two calibration
problems. Nothing easier counts as interview-grade.

| Anchor | Family | Min difficulty | Why it's the floor |
|---|---|---|---|
| Urn `P(both red \| ≥ one red)` | `conditional-prob` | `hard` | The canonical conditional-probability opener; requires the complement + a conditional, not a single ratio. |
| Lattice-path intersection / meeting | `random-walk` | `stretch` | Parity trap (same-time meeting = 0) plus a path-intersection reframe; multi-idea. |

---

## Follow-up taxonomy (the only legit curveball moves)

A follow-up MUST be one of these six types, MUST be at least as hard as the base
(ideally harder), and MUST NOT be a **decomposition** (asking for a sub-step the
candidate already computed). Enforced by `interviewGate.auditFollowup`.

| Type | The move | Example |
|---|---|---|
| `generalize-n` | concrete count → n / third player / one more stage | urn two draws → three draws: `P(all three red \| ≥ two red)` |
| `invert` | solve for an input, or swap probability↔expectation, count↔threshold | Bayes `P(disease\|+)` → what prevalence makes a positive a 50/50? |
| `add-constraint` | layer an extra condition / exclusion / unit conversion | committee with A&B → exclude committees where A,B,C are all together |
| `change-regime` | flip a structural assumption (with→without replacement, fair→biased, add a cost) | gambler's ruin 0.6 coin → 0.4 coin (ratio r > 1) |
| `adversarial-trap` | challenge a CORRECT answer / bait a wrong commitment | lattice meeting = 0 → "forget timing: do the paths cross > or < 1/2?" |
| `act-on-it` | now price / bet / quote on the result | SIG: given your probability, how much of your bankroll would you stake? |

---

## Before / after — the urn problem (the exact complaint)

**Base (unchanged, a good hard opener):** an urn with red/blue balls, draw two
without replacement — `P(both red | at least one red)`.

**❌ OLD follow-up (a decomposition — UNACCEPTABLE):**
> "What is the numerator alone — the unconditional `P(both red)`?"

This just asks for a sub-step the candidate already computed en route to the
base answer. No new reasoning. The gate now **rejects** this two ways: the
numeric answer equals a stored `baseIntermediate`, and the phrasing matches the
decomposition blocklist (`/\bthe numerator\b/i`).

**✅ NEW follow-ups (genuine curveballs, harder than the base):**
- **Probe (`generalize-n`, harder):** "Now three balls are drawn. Given that at
  least **two** are red, what is `P(all three red)`?" — a fresh, escalated
  conditional requiring a new inclusion of the `p³` term.
- **Adversarial (`invert`/`adversarial-trap`):** "How many reds would the urn
  need for `P(both red | ≥ one red)` to exceed 1/2?" — invert the formula and
  solve for the composition.

Neither answer equals any value computed in the base; both are strictly harder.

---

## Per-firm blueprint (wired presets in **bold**)

| Firm | Preset | Gate | Signature reasoning | Hard archetypes | Follow-up patterns |
|---|---|---|---|---|---|
| **Optiver** | `optiver` | NumberLogic sequences + Beat-the-Odds prob/EV (2026: no arithmetic sprint on the main track) | progressive sequences + rapid prob/EV under the clock | `optiver-quadratic-demo`, `lattice-paths` | generalize-n, change-regime, adversarial-trap, act-on-it |
| **Jane Street** | `janestreet` | ~60Q/8min Zetamac mental-math (screened separately) | EV / optimal-stopping games that MUTATE each part | `bank-or-roll` | change-regime, generalize-n, adversarial-trap, act-on-it |
| **SIG** | `sig` | Mercer\|Mettl, calculator allowed | "how confident? how much would you bet?" bet-sizing | `sig-confidence-bet` | act-on-it, change-regime, invert, adversarial-trap |
| Citadel Securities | — | prob + game theory (+coding) | superday MM + "bet on the next draw" | `citadel-bet` | act-on-it, invert, adversarial-trap |
| IMC | — | mental-math + sequences + prob | 1:1/group trading game; challenges correct answers | `monty-hold-firm` | adversarial-trap, generalize-n, act-on-it |
| DRW | — | 6Q/45min deep math (one ~unsolvable) | 1:1 market-making mock; defend a hard result | `lattice-paths` | generalize-n, change-regime, adversarial-trap |
| Five Rings | — | 15–20Q/<20min typed numeric | rapid-fire prob/estimation | — | generalize-n, invert |
| HRT | — | CodeSignal + math (trader) | derive AND simulate | — | generalize-n, invert, add-constraint |
| Jump | — | rapid mental-math + prob | futures/market intuition | — | change-regime, generalize-n |
| Akuna | — | 80-in-8 + sequences + betting game | PnL-ranked group trading game | `sig-confidence-bet` | act-on-it, generalize-n, adversarial-trap |

Firms without a preset are reference data (rounds/families/archetypes/follow-up
patterns are declared in `blueprint.ts`) so a future preset ships with its spec
already in place.

---

## Assembly constraints (diversity + difficulty)

Enforced by the family-aware assembler (`engine.ts`) and re-checked by
`auditScript`:

- **No back-to-back same archetype** — adjacent scored items must be different
  topic-families (market-making's escalating multi-round finale is the one
  intentional exception).
- **Per-family caps** — each fine-grained probability/EV family ≤ 2 per mock;
  sequences ≤ 3 (Optiver's signature); brainteasers ≤ 3; market-making ≤ 3.
- **Coverage** — every firm mock spans **≥ 5 distinct topic-families** (the live
  sampler averages 7–8).
- **Difficulty floor** — every scored item is `hard`+ (no `easy`/`medium` slot in
  any firm mock), and every follow-up is ≥ its base's intrinsic difficulty.

See `datasets/mock-quality-metrics.md` for the live sampler results (900 mocks,
100% structural + rubric pass).
