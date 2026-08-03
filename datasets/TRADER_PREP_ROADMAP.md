# Trader Prep Roadmap — Path to the #1 Quant *Trader* Prep Site

**Status:** PLANNING ONLY. No app code written, nothing committed. Sole artifact is this doc.
**Repo:** `~/Desktop/alphaAiProjects/quant-trader-prep` (Vite / React 18 / TS / Tailwind / Vitest; AWS Cognito + DynamoDB behind a swappable `StorageProvider`).
**House style (preserve everywhere):** pure, seedable, Vitest-covered engines (`Rng`) with content in self-contained `src/content/**` folders and thin React pages.

This roadmap was hardened by **two rounds of internal critic subagents** on three axes — trader-interview impact, technical feasibility/collisions, and competitor gap-closure (see §5). It prioritizes what **quant *trader* (market-maker / prop, not QR / quant-dev)** interviews actually test.

**Positioning honesty (from the competitor critique):** the app's *definitive* wedge — where it can plausibly be **#1 in the world** — is **adversarial market-making + confidence-interval estimation + arbitrage/de-vig + best-in-class readiness analytics**. Reaching **#1 overall** additionally requires closing four axes competitors win on: a **verified human-authored bank**, a **mock-interview (esp. verbal) layer**, a **real community**, and **mobile/retention**. Both sets of work are tiered below.

---

## 0. Where the app is today (grounding)

**Playable surface (verified in code):**
- **5 tracks** (`src/content/index.ts`), 17 mastery topics, Candy-Crush maps with mastery gating.
- **Mastery engine** (`src/lib/mastery/*`): per-topic Elo θ + Beta(α,β) posterior; `ciLow ≥ 0.8` mastery bar; reliability/Brier; misconceptions. Graded evidence is emitted by **`recordItemAttempt` → `applyItemAttempt`** (`ItemAttempt.mode ∈ {quiz, numeric, flashcard}`, `src/types/mastery.ts` L44). Remediation (`src/lib/remediation/*`) + Socratic tutor (`src/lib/tutor/*`).
- **Adaptivity** (`src/lib/adaptivity/*`): ZPDES review scheduler.
- **Diagnostic / Roadmap / Dashboard**: `src/content/diagnostic/blueprint.ts`, `src/lib/roadmap/{skillGraph,readiness}.ts`, mastery/calibration dashboard. Calibration pairs persist as **binary** `PersistedCalibrationPair {topicKey, pred∈[0,1], outcome∈0|1}` in `src/types/progress.ts`, written by `ProgressContext.recordCalibrationPair`, threaded through `src/lib/mastery/migrate.ts`.
- **Speed Arena** (`src/lib/arena/*`): timed-arithmetic state machine, pacing/rushing analytics, DynamoDB leaderboard, firm presets.
- **7 timed OA formats** (`src/lib/oa/config.ts`); content via `src/lib/oa/questionPool.ts` (`OA_CONTENT_POOLS`) drawing existing generators; benchmarks audited vs `src/content/arena/oaFormats.ts`.
- **8 quant games** (`src/lib/games/catalog.ts`): each a self-contained `src/lib/games/<game>/` + `src/pages/<Game>Page.tsx` + route in `App.tsx`. The Games hub renders from the catalog.
- Flashcard/brainteaser player lives **inline in `src/pages/LessonPage.tsx`** (`FlashcardLevel`/`FlashcardView`), which today calls **neither** `recordAttempt` nor `recordItemAttempt` (only `completeFlashcardLevel`/`markUnderstood`).

**Validated trader-relevant gaps (audits confirmed against code):**
| # | Gap | Evidence |
|---|-----|----------|
| G1 | **Estimation/Fermi thin**; no CI-elicitation scoring | `content/fermi/items.ts` = ~13 items; `lib/fermi/grader.ts` grades a single point estimate by log-distance — **no interval/CI scoring** (Old Mission scores CIs; JS grades mental-math with confidence). |
| G2 | **Sequences / pattern problems light** | No dedicated sequences family (only Markov pattern-waiting-time); OA `blitz`/`rapidMixed` lack a number-/letter-series archetype. Staple of Optiver/SIG/Citadel/Maven/Flow batteries. |
| G3 | **Arbitrage / de-vig has no dedicated timed drill** | `Probability Betting` is a *taker/sizing* game (odds↔implied, Kelly), **not** a de-vig / two-way-width / spot-the-cross drill. Ranked Optiver-signature, "no good free trainer" (`FIRM_TIMED_ASSESSMENTS §3 #6, §4 #6`). *(Elevated by critic round 1.)* |
| G4 | **Brainteasers are self-graded flashcards** (low adaptive signal) | Integrity flashcard deck emits **no** graded Elo/Beta evidence → invisible to mastery/readiness/remediation beyond level-completion. |
| G5 | **Bank breadth = procedural** (template fatigue); some topics 1-level-deep; content is machine-generated/reworded | `questionPool.ts` cycles a fixed generator list; no cross-session anti-repeat; `ORIGINALITY_AUDIT.md` confirms re-parametrized source material, **no human-verified provenance**. |
| G6 | **No verified firm-specific trader packs** (only "inspired") | `firmFormats.ts`/`oaFormats.ts` are "community-reported, may be outdated". |
| G7 | **Curation / community / social-proof immature** | Only a Speed-Arena leaderboard; no discussion, experience reports, verified solutions, or reputation. |
| G8 | **No live/bot market-making mock** | Games resolve vs scripted bots; `liveMarket.ts` is a batch `useMemo` policy toy. |
| G9 | **No mock-interview / verbal round; no mobile/PWA/SRS** | *(surfaced by competitor critic)* verbal mental-math-out-loud is *the* trader modality and is 100% absent; Zetamac/TraderMath drilling is phone-first; no spaced-repetition recall loop. |

**Two workstreams ALREADY STAFFED elsewhere — shown as `OWNED ELSEWHERE / IN PROGRESS`, not built by this swarm:**
- **W-A · The Trading Floor** (live adversarial MM mock) → closes **G8**. Spec: `datasets/TRADING_FLOOR_PLAN.md`.
- **W-B · Firm-Specific Research Packs** (12-firm deep research → Nessie) → closes **G6**. *(Critic note: W-B must also produce integrated per-firm tagged practice / faithful OA replicas, not just research docs — flagged to that swarm.)*

---

## 1. Prioritized task list (tiers)

Tiering = **(trader-interview signal) × (gap severity) × (engine leverage)** − dependency/collision risk. Infra that only *instruments* existing skills is gated **behind** trader-facing content (per critic round 1).

| ID | Task | Tier | Closes | Effort |
|----|------|------|--------|--------|
| **T1** | Estimation + **90% CI elicitation** scoring & bank expansion | **P0** | G1 | M (4–6 d) |
| **T2** | **Sequences & Pattern Recognition** (numeric **+ alphabetic + matrix/odd-one-out**) | **P0** | G2 | M (4–6 d) |
| **T3** | **Timed Arbitrage & De-vig** (+ put-call-parity arb) | **P0** | G3 | S–M (3–5 d) |
| **T4** | **EV-under-time** timed decision drill | **P1** | G5 (EV signal) | M (4–6 d) |
| **T5** | **Weak-spot mental-math** adaptive mode | **P1** | mental-math depth | S (2–4 d) |
| **T6** | **Options & Vol Intuition** (directional Δ/ν, synthetics) | **P1** | curriculum breadth | M (4–6 d) |
| **T7** | **Objective-grade Brainteasers** (adaptive signal) | **P1** | G4 | M–L (5–8 d) |
| **T8** | **Question-bank depth + anti-repeat rotation** | **P1** | G5 | L (6–9 d) |
| **T9** | **Verified human/expert-authored problem bank** (provenance + full solutions) | **P1** | G5 (trust/breadth) | XL (own swarm) |
| **T10** | **Mock-interview layer**: verbal mental-math-out-loud + AI-voice | **P1** | G9 | L–XL |
| **T11** | **OA breadth**: wire T1/T2/T3 archetypes + fill flagged pool gaps | **P2** | G2/G1/G3 | S (2–3 d) |
| **T12** | **Rigorous adaptive engine** (IRT + Glicko + Thompson) + offline eval | **P2** | G5 (signal quality) | XL (rewrite + migration) |
| **T13** | **Community & social proof** (experience reports, per-item discussion, reputation, votes) | **P2** | G7 | L–XL |
| **T14** | **Mobile-first PWA + SRS retention** loop | **P2** | G9 | L |
| **T15** | **Winner's-curse / common-value auction** reasoning drill | **P2** | MM intuition | S–M |
| **W-A** | The Trading Floor (live MM mock) | — | G8 | **OWNED ELSEWHERE** |
| **W-B** | Firm-specific verified packs + OA replicas → Nessie | — | G6 | **OWNED ELSEWHERE** |

**Intra-P1 build order** (all P1, but sequence by trader-signal-per-effort): pure trader drills **T4 → T5 → T6**, then **T10** (verbal mock — near-P0 *signal*, held at P1 only by AI-voice effort), then **T9** (breadth/trust), then instrumentation **T7 → T8**.

---

## 2. P0 tasks (build first)

### T1 — Estimation + 90% CI Elicitation & bank expansion · P0 · closes G1
**Problem.** 13 Fermi items, and grading only a point estimate by log-distance. Real trader OAs score **confidence intervals** and reward calibrated ranges. High-signal skill the app can neither train nor measure.

**Solution / scope.**
1. Expand `FERMI_ITEMS` 13 → ~45–60, weighted to **markets/trading** estimation (daily notional of an ADR, options contracts traded, HFT messages/sec, colo racks, auction size, perp funding) + durable classics. Keep the `factors → coded product == reference` self-consistency test (a factor typo fails CI).
2. **Add `gradeInterval({lo,hi}, reference)`** in `lib/fermi/grader.ts` — a **proper interval score** (Winkler: width penalty + miss penalty) + hit/miss + running empirical coverage. **Additive**: the point-estimate path (`gradeFermi`/`gradeFermiValue`) is untouched.
3. **"90% CI in 60s" mode** on the existing `FermiPage` (toggle, not a fork); debrief shows coverage ("your 90% CIs contained the truth 6/10 → overconfident") reusing `ReliabilityDiagram`.

**⚠ Feasibility guardrails (from critic round 1 — do NOT violate).**
- **Do NOT modify** `PersistedCalibrationPair` (`src/types/progress.ts`), `ProgressContext.recordCalibrationPair`, or `migrate.ts`. A 90% CI hit **is a binary event**: feed calibration as **`(pred = 0.9, outcome = hit ? 1 : 0)`** through the *existing* `recordCalibrationPair`. The Winkler interval score has **no home in the persisted log** — keep it **Fermi-local / in-round debrief only**.
- There is **no Fermi/estimation node in `skillGraph.ts`**, so these pairs land only in the **pooled** reliability diagram (not a per-topic skill). Do not invent a skill-graph node here (that would drag in the Integrator + `blueprint.ts`).
- `FermiPage.tsx` does not currently use `ProgressContext`; newly importing `useProgress` to call `recordCalibrationPair` is fine (it's a *read* of an existing writer API, not a shared-file edit).

**Files.** `content/fermi/items.ts`(+test), `lib/fermi/grader.ts`(+test), `pages/FermiPage.tsx`, new `components/fermi/CiElicitation.tsx`. Read-only reuse of `lib/calibration/*` + `components/dashboard/ReliabilityDiagram.tsx`.
**Effort.** M (4–6 d). **Deps.** None to start.
**Acceptance.** items.test still asserts product==reference, ≥45 items across ≥3 markets categories; grader.test: interval score proper (tight-correct beats wide; miss penalized), coverage correct, point path unchanged; FermiPage point+interval modes; existing Fermi tests green; typecheck+test green.

### T2 — Sequences & Pattern Recognition family + OA integration · P0 · closes G2
**Problem.** Number-**and-letter** series / odd-one-out / matrix-analogy are staples of Optiver/SIG/Citadel/**Maven (num+alpha)**/**Flow/Akuna/PEAK6 (grid)** batteries and are absent.

**Solution / scope.** New self-contained `src/content/sequences/` following generator+verifier pattern: parametric generators build a sequence from a *known rule* → answer correct-by-construction, distractors encode rule-mis-reads. **Scope explicitly includes (critic round 1):** numeric (arithmetic, geometric, polynomial/finite-difference, interleaved, Fibonacci-like, alternating-op), **alphabetic** (letter-position rules), and **matrix/odd-one-out/analogy**. Modes `quiz` + `numeric`.

**Files.** New `src/content/sequences/{generators.ts,solvers.ts,levels.ts,sequences.test.ts}`. Integration to OA pools is deferred to **T11** (owns `questionPool.ts`).
**Effort.** M (4–6 d). **Deps.** Engine fully isolated; OA wiring in T11.
**Acceptance.** For every generator the produced answer satisfies the rule; distractors distinct + format-parity (no length leak); ≥6 numeric + ≥2 alphabetic + ≥1 matrix families, parametric (no hardcoded lists); typecheck+test green.

### T3 — Timed Arbitrage & De-vig (+ put-call-parity arb) · P0 · closes G3
**Problem.** *(Elevated to P0 by the trader-signal critic — the single biggest missing high-ROI drill.)* Arbitrage/de-vig is Optiver-signature and implicit in every MM round, with "no good free trainer." The existing betting game is taker-sizing, not a de-vig/spot-the-cross drill.

**Solution / scope.** New self-contained family: quotes/odds → **implied prob → remove the vig/overround → spot the cross/arb → size it**; plus **put-call-parity as no-arbitrage** (spot the mispriced leg / synthetic) folded in here (moved out of T6). Same generator+verifier shape as T2: exact-by-construction, distractors encode *didn't-remove-vig*, *wrong leg / wrong direction*, *unweighted basket*. Timed-OA-shaped (drives a `quiz`/`numeric` pool). Package as an Interview-Games section or a small new game.

**Files.** New `src/content/arbitrage/{generators.ts,solvers.ts,levels.ts,arbitrage.test.ts}` (+ optional `src/lib/games/arbitrage/` + page). Integration (catalog/route/OA pool) centralized in Integrator + T11.
**Effort.** S–M (3–5 d). **Deps.** Engine isolated.
**Acceptance.** De-vig + arb-direction + PCP answers exact-by-construction; distractors encode the named errors; wired into OA pools by T11; typecheck+test green.

---

## 3. P1 / P2 tasks

### T4 — EV-under-time timed decision drill · P1 · (trader EV signal, G5)
**Problem.** "Probability/EV under time" is the #2 durable trader category yet has no dedicated NEW drill (only folded into bank-deepening). DRW/Five Rings/Wolverine hammer it.
**Solution.** A timed "compute the fair value, then decide under a clock" mode reusing existing EV/optimal-stopping/fair-value generators (`content/interviewGames/generators.ts`, `probabilityStats/expectedValue/*`) inside a new timed wrapper that **reuses the Arena/OA session pattern read-only** (imports it; **must NOT edit `lib/arena/*` or `lib/oa/store.ts`** — that's the Wave-2 Arena/OA-store owner's territory). Engine/config isolated in its own folder; OA-pool exposure via T11.
**Files.** New `src/lib/evTimed/*` or a new OA format config entry (via T11); no new shared writes in build phase. **Effort.** M. **Acceptance.** deterministic-by-seed, timed scoring tested, no regression to existing EV generators.

### T5 — Weak-spot mental-math adaptive mode · P1
**Problem.** Speed Arena trains raw speed but has no mode that *finds* your fraction/division/percentage blind spot (Optiver +1/−1 punishes exactly the weak op).
**Solution.** A mode over the **existing** `lib/arena/*` analytics that buckets error rate by operation/operand-shape and over-samples weak buckets. **Collision note:** touches `lib/arena/*` (shared) — assign the arena owner and sequence against T8's rotation wiring (§4).
**Files.** `src/lib/arena/*` (owned slot) + a new arena preset. **Effort.** S. **Acceptance.** weak-bucket detection unit-tested; over-sampling deterministic-by-seed.

### T6 — Options & Vol Intuition (directional Δ/ν, synthetics) · P1
**Problem.** SIG/Optiver/IMC/Akuna/CTC/Wolverine **are** options MMs; app has zero options intuition. *(Promoted P2→P1 by trader critic; PCP-arb moved to T3.)*
**Solution.** Trader-scoped drill: which option has more delta/vega directionally, moneyness/expiry intuition, synthetic-position reasoning. **Explicitly excludes** BS/MC/Greeks-engine/delta-hedging (QR-flavored, deferred). Parametric + exact verifiers.
**Files.** New `src/content/options/*` (+ optional game). Integration centralized. **Effort.** M. **Acceptance.** intuition items exact-by-construction; distractors encode direction errors.

### T7 — Objective-grade Brainteasers (adaptive signal) · P1 · closes G4
**Problem.** Integrity flashcards emit no graded evidence → mastery/readiness/remediation blind to brainteaser skill. *(Was P0; demoted by trader critic — it instruments existing mastery rather than training a new skill; keep it, but not ahead of trader-facing content.)*
**Solution.** Commit-then-reveal: learner types a free-response answer *before* revealing; grade the **numeric/closed-form subset** via existing tolerant `src/lib/numeric.ts`; open puzzles stay reveal+reflect (`gradable:false`, never inflate mastery).
**⚠ Feasibility corrections (critic round 1):**
- Emit graded evidence via **`recordItemAttempt({ mode:"flashcard", topicKey: topicKeyForLevel(...), tier, correct })`** — **NOT** `recordAttempt` (which only writes level/xp/streak, never `topicMastery`). `mode:"flashcard"` already exists in `ItemAttempt`. Brainteaser sections (`Core Puzzles`, `Techniques Toolkit`) are real skill-graph nodes (`BT_CORE`, `BT_TECHNIQUES`), so emitting genuinely moves readiness; `applyItemAttempt` writes optional maps → v1→v2 migration stays safe.
- The flashcard player is **inline in `LessonPage.tsx`** (`FlashcardLevel`/`FlashcardView`) — it currently calls **neither** record fn, so this is **net-new wiring** there. `components/tutor/*` does **not** render the deck.
- Brainteaser `answer` fields are **prose** ("10 lockers…", "17 minutes…"); each gradable card needs a hand-added `numericAnswer` + `tolerance` across `levels.ts` / `generators.ts` / `techniqueGenerators.ts`.
**Files.** `src/types/content.ts` (extend `Flashcard`: `gradable`, `numericAnswer?`, `tolerance?`), `content/brainteasers/*`, `pages/LessonPage.tsx` (`FlashcardLevel`/`FlashcardView`). Reuse `lib/numeric.ts`, call existing `recordItemAttempt`.
**Effort.** M–L (5–8 d). **Deps.** Owns shared `types/content.ts` + `LessonPage.tsx` — see §4. **Acceptance.** numeric teasers grade (locker=10, bridge=17 fixtures); `gradable:false` never emits; graded teasers move `topicMastery` + readiness; commit-before-reveal keyboard-accessible; dashboard/roadmap tests updated; typecheck+test green.

### T8 — Question-bank depth + anti-repeat rotation · P1 · closes G5
**Problem.** Template fatigue; some `probabilityStats/*` families 1-level-deep.
**Solution.** (a) new pure `src/lib/content/rotation.ts` — seed-aware selector tracking recently-served item *signatures*, biasing away from repeats; (b) deepen shallow families with **sub-generators inside existing `generators.ts`** (+ verifier tests).
**⚠ Feasibility corrections (critic round 1):**
- **Constrain deepening to sub-generators within existing `generators.ts`** (NO new levels), else each sub-agent must edit the shared **`src/content/probabilityStats/index.ts`** section-order barrel → sub-agents collide. If new levels are truly needed, the **Integrator** owns that barrel.
- Only `rotation.ts` itself is isolated. Its **wiring** touches shared `questionPool.ts` (→ T11 owns), plus **`lib/arena/*`** and **`lib/oa/store.ts`** for served-signature state → a **sequenced** integration step with a named owner (§4). Do not claim the wiring is isolated.
**Files.** New `src/lib/content/rotation.ts`(+test); additive sub-generators in one `probabilityStats/<family>/generators.ts` per sub-agent; wiring in T11/arena slot. **Effort.** L (6–9 d). **Acceptance.** rotation unit-tested (no repeat within window; deterministic-by-seed); deepened families 100% verifier pass; measured repeat-rate drop; typecheck+test green.

### T9 — Verified human/expert-authored problem bank · P1 (own swarm) · closes G5 trust/breadth
**Problem.** *(Biggest competitor gap per gap-closure critic.)* All content is machine-generated/reworded (no human-verified provenance). QuantGuide/Green Book/HotS win on a **broad, tagged, verified, solution-backed** catalog with real interview provenance. Infinite instances of ~few rule families ≠ conceptual breadth.
**Solution.** A curated, human/expert-verified bank of interview-style problems with **provenance tags (firm/round/year), full worked solutions, difficulty, legal-distinctness review**, loaded as data alongside generators. Own workstream (content + light schema/loader). Coordinate firm tags with W-B. **Scale target (critic round 2):** beating QuantGuide breadth is a scale-and-refresh problem — aim for an initial **≥300–500 verified items** with an **ongoing sourcing cadence** (e.g. +50/mo), not a one-time load.
**Files.** New `src/content/verifiedBank/*` + loader; surfaced in tracks/OA via Integrator. **Effort.** XL. **Acceptance.** schema-validated items with required provenance+solution fields; loader tested; no legal-verbatim copies.

### T10 — Mock-interview layer: verbal mental-math-out-loud + AI-voice · P1 · closes G9 (verbal)
**Problem.** *(Entirely missing per gap-closure critic.)* Verbal mental-math / spoken reasoning is *the* trader modality (JS/Optiver phone screens); plus behavioral/fit. Zero coverage.
**Solution.** An AI-voice interviewer mode: (a) spoken mental-math with follow-ups, (b) brainteasers-under-time with probes, (c) behavioral. Stretch: peer-to-peer scheduled mocks. Isolate engine (`src/lib/mock/*`) + page + components; route via Integrator.
**Files.** New `src/lib/mock/*`, `src/pages/MockPage.tsx`, `src/components/mock/*`. **Effort.** L–XL. **Acceptance.** deterministic scoring for the math portion; graceful degradation without mic; no PII leaks.

### T11 — OA breadth: wire new archetypes + fill flagged gaps · P2 · closes G2/G1/G3
**Solution.** The **single integration slot** that owns the shared **`questionPool.ts` + `oaFormats.ts` (+ `config.ts`)** edits for the wave: adds T2 (sequences), T3 (arbitrage/de-vig), and T1 (CI where MCQ-able) into `OA_CONTENT_POOLS`, removes noted fallbacks, wires T8 rotation into `questionPool.ts`, re-runs the OA benchmark audit. **Deps.** After T1/T2/T3 engines + T8 rotation exist. **Acceptance.** archetypes in correct pools; `oaFormats` audit + `questionPool` tests green; budgets within tolerance.

### T12 — Rigorous adaptive engine (IRT + Glicko + Thompson) + offline eval · P2 · signal quality
**Problem.** Selection is ad-hoc (Elo/ZPDES); not psychometrically principled. *(Gated behind trader content per trader critic — it adds no new drill.)*
**Solution.** 2PL IRT ability, Glicko item difficulty, Thompson-sampling selector, offline eval (simulated learners → learning-gain curves).
**⚠ Feasibility (critic round 1).** Replacing Elo θ changes `TopicMastery` (`src/types/mastery.ts`), consumed by `verdict.ts`, `unlock.ts` (`ciLow ≥ 0.8` bar), dashboard → needs a **v2→v3 migration** in `migrate.ts` keeping existing θ/α/β valid, and every `recordItemAttempt` call site (LessonPage quiz+numeric, 2× remediation, diagnostic, and now T7 flashcards) must keep working. **Effort bumped to XL.** **Ordering:** lands **last**; consumes whatever `ItemAttempt` shape exists (no interface-freeze precondition — see §4). **Acceptance.** estimators recover known params; offline eval ≥ baseline gain; migration keeps progress valid (`migrate.test.ts`); typecheck+test green.

### T13 — Community & social proof · P2 · closes G7
**Problem.** *(Re-scoped from thin voting per gap-closure critic; demoted by trader critic since it's growth, not interview signal.)* Real stickiness = content people return for.
**Solution.** DynamoDB-backed (behind `StorageProvider`): **interview experience reports**, **per-item discussion + user-submitted solutions**, **verified-solution flags**, **difficulty/quality votes**, **durable reputation/karma**, social-proof widgets. Pure aggregation in `src/lib/community/*`; network isolated in `awsStorage.ts` (+`infra/` schema — the one serialization point, owned solo).
**Files.** New `src/lib/community/*`(+tests), `src/components/community/*`, additive `awsStorage.ts`+`infra/`. **Effort.** L–XL. **Acceptance.** aggregation unit-tested; content round-trips; offline-graceful; no PII.

### T14 — Mobile-first PWA + SRS retention · P2 · closes G9 (mobile/retention)
**Problem.** *(Gap-closure critic.)* Drill audience (Zetamac/TraderMath) is phone-first; no spaced-repetition recall loop or reminders.
**Solution.** PWA (installable, offline drill loop, notifications) + explicit **SRS** (forgetting-curve recall) layered atop ZPDES. **Files.** `vite.config.ts` (PWA), new `src/lib/srs/*`(+tests), service worker, mobile-first passes on drill pages. **⚠ Scheduling (critic round 2):** T14 is **cross-cutting** — it edits shared `vite.config.ts` and does mobile passes on `FermiPage.tsx` (T1-owned) and `LessonPage.tsx` (T7-owned). Give it a **serialized late slot alongside the Integrator** (not a parallel wave). **Effort.** L. **Acceptance.** installable PWA; SRS scheduling unit-tested; offline drills work.

### T15 — Winner's-curse / common-value auction reasoning drill · P2 · MM intuition
**Problem.** *(Optional, trader critic.)* The adverse-selection intuition every MM round tests, in puzzle form. **Solution.** Parametric common-value-auction / winner's-curse items (exact-by-construction). **Files.** new `src/content/auctions/*`. **Effort.** S–M.

---

## 4. PARALLELIZATION & FILE OWNERSHIP (fan-out plan)

**Principle for a single shared working tree:** each workstream builds in its **own new folder** touching **zero shared files**; every edit to a **shared "hub" file** is funneled to **one owner** and sequenced last. This confines all conflicts to a short serialized phase. *(§4 was materially corrected by the feasibility critic — the corrections are baked in below.)*

### 4a. Shared "hub" files — ONE owner each (collision map)
| Hub file | Why shared | Owner |
|----------|-----------|-------|
| `src/App.tsx` (routes) | any new page | **Integrator** (last) |
| `src/lib/games/catalog.ts` | any new game | **Integrator** |
| `src/content/index.ts` | any new track | **Integrator** |
| **`src/content/probabilityStats/index.ts`** *(missed in v1)* | section-order barrel; any new level | **Integrator** (T8 must avoid by using sub-generators only) |
| `src/lib/oa/questionPool.ts` + `oaFormats.ts` + `oa/config.ts` | pools/formats/audit | **T11** |
| `src/lib/oa/store.ts` + `src/lib/arena/*` | rotation served-signature state; T5 weak-spot | **Rotation/Arena owner** (T11/T5 coordinate; sequence) |
| `src/types/content.ts` | T7 extends `Flashcard` | **T7** |
| `src/pages/LessonPage.tsx` (`FlashcardLevel`/`FlashcardView`) | T7 commit-then-reveal | **T7** |
| **`src/types/progress.ts` + `ProgressContext.recordCalibrationPair` + `migrate.ts`** *(NOT T1)* | calibration persisted shape | **Frozen** — T1 must use as-is `(0.9,hit)`; only T12 may touch in its migration |
| `src/lib/mastery/{mastery.ts,elo.ts}` + `src/types/mastery.ts` + `verdict.ts`/`unlock.ts` | Elo→Glicko rewrite | **T12** (last) — T7 only *calls* `recordItemAttempt`, never edits these |
| `src/lib/awsStorage.ts` + `infra/` schema | T13 persistence | **T13** (solo) |
| `src/lib/roadmap/{skillGraph,readiness}.ts` + `diagnostic/blueprint.ts` | new surfaced topics; §S3 exact `section`→`topicKey` match invariant (`skillGraph.test.ts`) | **Integrator** |

### 4b. FULLY-PARALLEL workstreams (build phase writes only NEW folders)
- **WS-1 · T2 Sequences** → `src/content/sequences/**`. ✅
- **WS-2 · T1 Estimation/CI** → `src/content/fermi/**`, `src/lib/fermi/**`, `src/components/fermi/**`, `FermiPage.tsx` (game-specific page; only *reads* `recordCalibrationPair`). ✅
- **WS-3 · T3 Arbitrage/De-vig** → `src/content/arbitrage/**` (+ optional game folder/page). ✅
- **WS-4 · T4 EV-under-time** → `src/lib/evTimed/**` (+ config exposed via T11). ✅
- **WS-5 · T6 Options intuition** → `src/content/options/**`. ✅
- **WS-6 · T8 rotation util** → `src/lib/content/rotation.ts` **only** (wiring is NOT isolated — see 4c). ✅ for the util
- **WS-7 · T9 Verified bank** → `src/content/verifiedBank/**` (own swarm). ✅
- **WS-8 · T10 Mock-interview** → `src/lib/mock/**`, `src/pages/MockPage.tsx`, `src/components/mock/**`. ✅ (route via Integrator)
- **WS-9 · T13 Community logic** → `src/lib/community/**`, `src/components/community/**` (backend edit serialized). ✅
- **WS-10 · T15 Auctions** → `src/content/auctions/**`. ✅

> These write only new folders during build. **No two write the same file.**

### 4c. MUST-be-sequenced (shared-file writers) — and why
- **T7 (brainteasers)** — sole writer of `src/types/content.ts` **and** `LessonPage.tsx`. Runs in Wave 1 but *owns* those two files; no other Wave-1 task may touch them. Emits via existing `recordItemAttempt` (no `mastery/*` edits).
- **T8 deepening families** — isolated **only if** limited to sub-generators inside each family's existing `generators.ts`. New levels ⇒ `probabilityStats/index.ts` (Integrator). One family per sub-agent.
- **T8 rotation wiring / T5 weak-spot** — both touch `lib/arena/*` (+ `lib/oa/store.ts` for rotation). Assign a single **Arena/OA-store owner**; sequence after the pure util lands. Rotation into `questionPool.ts` is done by **T11**.
- **T11 (OA integration)** — sole writer of `questionPool.ts`/`oaFormats.ts`/`config.ts`; runs **after** T1/T2/T3 engines + rotation util exist.
- **T12 (adaptive engine)** — sole writer of `mastery/*`/`types/mastery.ts`/`verdict.ts`/`unlock.ts` + the `migrate.ts` v2→v3. Lands **last**; **no interface-freeze precondition** (the v1 cycle is deleted — it simply consumes the `ItemAttempt` shape that exists).
- **T13 backend** — sole writer of `awsStorage.ts` + `infra/`.
- **Integrator pass (very last)** — sole writer of `App.tsx`, `catalog.ts`, `content/index.ts`, `probabilityStats/index.ts`, `skillGraph.ts`/`readiness.ts`/`blueprint.ts`. Wires every new page/game/track/topic in one serialized commit; enforces the `section`→`topicKey` char-exact invariant; runs full `typecheck` + `test` + OA audit.

### 4d. Wave schedule
```
Wave 1 (parallel):   WS-1(T2) WS-2(T1) WS-3(T3) WS-4(T4) WS-5(T6) WS-6(T8 util)
                     WS-7(T9) WS-8(T10) WS-9(T13 logic) WS-10(T15)
                     + T7 (sequenced; sole owner of content.ts + LessonPage.tsx)
Wave 2 (sequential): Arena/OA-store owner (T8 rotation wiring + T5 weak-spot)
                     → T11 (OA pool/format wiring, after T1/T2/T3 + rotation)
                     → T13 backend edit (awsStorage/infra, solo)
Wave 3 (last):       T12 (adaptive rewrite + v2→v3 migration)
Wave 4 (serialized): Integrator pass (App.tsx / catalog.ts / index.ts / probStats barrel /
                     skillGraph / blueprint) + T14 (vite.config PWA + mobile passes on
                     FermiPage/LessonPage) → full CI (typecheck + test + OA audit)
```
**Conflict-freedom guarantee:** Wave-1 agents write only new folders except T7 (sole owner of `content.ts`+`LessonPage.tsx`). T1 uses the calibration log **as-is** (no `types/progress.ts` edit). All remaining hub writes are quarantined to a single owner each (T11 OA, T13 backend, T12 mastery, Integrator routes/registries), serialized in Waves 2–4.

---

## 5. Critic iterations — how the plan changed

**Round 1 — three critics (trader-impact, feasibility, competitor-gap):**
- **Trader impact** → **Added T3 Timed Arbitrage/De-vig as P0** (biggest missing high-ROI drill); **demoted brainteasers P0→P1** (instruments mastery, doesn't train a new skill) and **demoted social-proof to P2**; **promoted Options intuition P2→P1**; added **T4 EV-under-time**, **T5 weak-spot mental-math**, **T15 winner's-curse**; **widened T2** to alphabetic + matrix; gated infra (T12) behind trader content.
- **Feasibility** → **Corrected the brainteaser emit to `recordItemAttempt` (not `recordAttempt`)** and located the player inline in `LessonPage.tsx`; **forbade T1 from touching the calibration persisted shape** (feed `(0.9,hit)`; keep interval score local; no Fermi skill-graph node); **added the missing `probabilityStats/index.ts` barrel** and constrained T8 to sub-generators; **assigned owners for rotation wiring (`lib/arena/*`,`oa/store.ts`)**; **deleted the T12↔T3/T4 interface-freeze ordering cycle** and moved T12 last; **bumped T12 to XL** (Glicko changes `TopicMastery` + migration).
- **Competitor gap** → **Added T9 Verified human-authored bank**, **T10 Mock-interview (verbal)**, **re-scoped T13 into a real community**, **added T14 Mobile/PWA+SRS**; added the **positioning-honesty** note (definitive wedge vs. #1-overall requirements); flagged that **W-B must ship integrated firm-tagged practice / OA replicas**, not just research docs.

**Round 2 — same three critics re-ran on the revision; all three returned NO remaining MAJOR objections.** Only minor, non-blocking notes were folded in: added an **intra-P1 build order** (pure drills T4/T5/T6 → verbal-mock T10 → verified-bank T9 → instrumentation T7/T8); **scheduled T14** into the serialized Integrator slot (it edits `vite.config.ts` + T1/T7-owned drill pages) and pinned **T4 to read-only reuse** of `lib/arena/*`/`oa/store.ts`; gave **T9 a concrete scale/refresh target** (≥300–500 verified items, ongoing cadence); and noted **live *human* mocks stay out of near-term "#1" marketing** until the T10 stretch ships. No new cycles, no new build-phase collisions.

---

## 6. Out of scope / owned elsewhere
- **W-A The Trading Floor** (`datasets/TRADING_FLOOR_PLAN.md`) — closes G8.
- **W-B Firm-specific verified packs + faithful OA replicas → Nessie** — closes G6 (must integrate per-firm tagged practice, not just research docs).
- Full **Options Desk** (BS/MC/Greeks/delta-hedge), **LOB/matching engine**, **Stat-Arb Lab** — QR/quant-dev-flavored; deferred for a *trader* focus (`datasets/QUANT_NEXT_LEVEL_IDEAS.md`).
