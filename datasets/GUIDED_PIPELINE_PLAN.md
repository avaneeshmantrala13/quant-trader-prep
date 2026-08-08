# Guided Pipeline Build Spec — Login → Greenlight

**Status:** DRAFT for approval. No application code changes yet — this is the plan.
**Scope:** Redesign the app from a free-roam toolkit into ONE guided, loop-based pipeline that carries a user from login to a "greenlight to apply to quant firms" verdict, **reusing** the existing engines (mastery/KST, hint ladder, drill/remediation, diagnostic, timed OA, mock, market-making games, parametric generators + verifiers) and **stripping** the free-roam shell (tabs, extra themes).
**Repo:** `/Users/avaneeshmantrala/Desktop/alphaAiProjects/quant-trader-prep`

> Honesty note up front: most of the *engines* already exist and are strong. The *pipeline orchestration* (a linear stage machine + a single "next task" shell), the **100-item untimed free-response diagnostic**, the **two new KST competency nodes** (brainteaser-reasoning, trading-intuition), the **90% timed/mock gates**, and the **strip-down** are the real new build. Details below.

---

## 1. Vision + the linear pipeline

One screen at a time. Each stage is **gated** by the previous. No free navigation.

```
┌────────────┐
│ 1. LOGIN   │  (exists: LoginPage + Cognito/local)
└─────┬──────┘
      ▼
┌──────────────────────────────┐
│ 2. UNTIMED DIAGNOSTIC         │  ~100 free-response Qs, untimed, ALL topics
│    (incl. brainteaser         │  span: easy-EV floor → lattice/random-walk ceiling
│     FLASHCARDS, self-eval)    │  seeds KST mastery + brainteaser-reasoning node
└─────┬────────────────────────┘
      ▼
┌──────────────────────────────┐
│ 3. TIMED DIAGNOSTIC           │  30 Qs / 45 min, strict wall-clock, hard multi-topic
│                               │  measures speed of correct thinking
└─────┬────────────────────────┘
      ▼
┌──────────────────────────────┐
│ 4. GAME-OA / TRADING INTUITION│  make-a-market vs informed bot ("lightbulbs in TX")
│                               │  seeds trading-intuition node
└─────┬────────────────────────┘
      ▼
┌──────────────────────────────┐
│ 5. BACKEND DIAGNOSIS          │  KST + Bloom 80% → weakest→strongest ordering across
│                               │  4 metrics: content · timed · brainteaser · trading
└─────┬────────────────────────┘
      ▼
┌──────────────────────────────┐        gates (per stage):
│ 6. DRILLING LOOP              │  ── content: every KST node CI_low ≥ 0.80 (credit-weighted)
│    weakest-first, hint ladder │  ── timed multi-topic sections: ≥ 90% accuracy (HIGHER gate)
│    + credit-weighted mastery  │  ── brainteaser-reasoning node: mastered
│    + strict timed sections    │  ── trading-intuition node: mastered
└─────┬────────────────────────┘
      ▼  (unlocks only after 6 fully passes)
┌──────────────────────────────┐
│ 7. MOCK INTERVIEW STAGE       │  firm-accurate mocks (MM intuition + hard math),
│                               │  ≥ 90% accuracy required
└─────┬────────────────────────┘
      ▼
┌──────────────────────────────┐
│ 8. GREENLIGHT to apply        │
└──────────────────────────────┘
```

**Gate math at a glance** (all reuse existing primitives):

| Gate | Threshold | Existing primitive |
|---|---|---|
| Untimed content mastery (per KST node) | credit-weighted `CI_low ≥ 0.80` | `MASTERY_BAR` (`src/lib/mastery/config.ts`), `deriveVerdict().mastered` (`verdict.ts`), `meetsMasteryGate` (`score.ts`) |
| Timed multi-topic sections | **≥ 90%** accuracy | `meetsMasteryGate(score, 0.90)` + OA scoring (`src/lib/oa/scoring.ts`) |
| Brainteaser-reasoning competency | node mastered (self-eval ratio) | new node in KST + Beta on self-assessed "got" |
| Trading-intuition competency | node mastered (MM P&L/verdict) | new node in KST + MM engine verdict (`makeMarket/engine.ts`) |
| Mock interview | **≥ 90%** accuracy | `computePerformance` + reworked `wouldPass` gate (`mock/diagnosis.ts`) |

---

## 2. Screen-by-screen UX flow (stripped-down shell)

The shell collapses to: **one "Your Next Task" screen** + **a Progress/Roadmap panel** + **Sign out**. No tabs, no hub pages, no theme switcher.

| Stage | What the user sees | The ONE action | Progress view shows |
|---|---|---|---|
| 1. Login | Login/sign-up (existing `LoginPage`) | Sign in | — |
| 2. Untimed diagnostic | A single free-response question at a time (numeric entry or, for brainteasers, a flashcard with "Show answer → I got it / I missed it"). Untimed, progress bar `n/100`. | Answer / self-grade → Next | Stage 2 of 8, items done |
| 3. Timed diagnostic | One question + a live section countdown (45:00) + `n/30`, reload-proof. | Answer → Next / auto-submit at 0:00 | Stage 3, time left, answered |
| 4. Game-OA | Make-a-market panel (quote bid/ask + size) vs the informed bot; a few rounds on hard-to-value quantities. | Submit quote each round | Stage 4, rounds done, running P&L |
| 5. Diagnosis | A read-only report: ranked weakest→strongest topics across the 4 metrics + "here's your drill plan." | Continue → start drilling | Full per-topic mastery snapshot |
| 6. Drilling loop | "Your next task: **drill `<weakest topic>`**." A lesson round (5 items) with the hint ladder; occasionally a strict timed multi-topic section. | Answer items; use hints if needed | Per-node mastery bars, weakest-first queue, what's left to 80%/90% |
| 7. Mock | "Your next task: **Mock interview (`<firm>` style)**." The existing mock runner (math + brainteasers + market-making + follow-ups). | Run the mock | Mock accuracy vs 90% |
| 8. Greenlight | Celebration + verdict + "you're ready to apply" summary. | (done) | All stages green |

**The shell** (both the "Next Task" screen and Progress panel) is one persistent layout with a header showing: current stage, a compact 8-step stepper, and Sign out. The Progress/Roadmap view is a **read-only** projection of KST mastery (reuse `useRoadmapData` / `dashboardView` data, not their pages).

---

## 3. Data model

### 3.1 KST node set (topic nodes)

The KST already exists twice, in lockstep: the **prerequisite DAG** (`src/content/remediation/prereqDAG.ts`, `PREREQ_DAG`) and its superset the **skill graph** (`src/lib/roadmap/skillGraph.ts`, `SKILL_GRAPH`). Nodes are `topicKeyOf(trackId, section)` so mastery reads/writes the same bucket. **Reuse as-is.**

**Scored topic nodes (26)** — grouped by tier (from `skillGraph.ts`):

- **Foundations:** Mental Arithmetic *(L0 floor)*, Rates/Algebra & Word Problems *(floor)*, Number Theory & Counting, Geometry & Derivations.
- **Probability foundations:** Core Probability *(L1 floor)*, Combinatorial Analysis, Conditional Probability & Bayes.
- **Expectation / distributions:** Expected Value, Conditional Expectation, Geometric Probability, Poisson, Order Statistics, Continuous Distributions, Variance/Covariance & CLT.
- **Processes / applications:** Betting & Sizing (Kelly), Interview Games (EV decision & market-making), Markov Chains & Random Walks, Game Theory & Puzzles, Brownian Motion.
- **Course-completeness:** MGF, Gamma, Joint Distributions, Limit Theorems, Branching, CTMC, Markov Chain Structure.

**External timed-drill / game stubs (6)** — already modeled (`external: true`): Sequences & Pattern Recognition, No-Arbitrage/De-vig, Fermi, EV-under-time, Speed Arena, Winner's-Curse Auctions. They route remediation down to real prereqs.

**Flashcard-only (2):** Brainteasers · Core Puzzles, Brainteasers · Techniques Toolkit (self-assessed; excluded from the scored DAG today).

### 3.2 Two NEW competency nodes (the key data-model addition)

Add two first-class KST competency nodes that MUST be mastered to pass Stage 6:

| New node (proposed `topicKey`) | Fed by | Prereqs | Gate |
|---|---|---|---|
| `competency::brainteaser-reasoning` | Stage-2 brainteaser flashcards (self-eval) + Stage-6/7 brainteaser steps | Combinatorial Analysis, Conditional Probability, Expected Value (advisory) | Beta on self-assessed "got" ≥ 0.80 CI_low |
| `competency::trading-intuition` | Stage-4 game-OA + drilling MM rounds + mock MM | Expected Value, Interview Games | positive/edge-capturing MM verdict over N rounds; Beta ≥ 0.80 |

These are added to `SKILL_GRAPH` (and, since they have no in-place probe content of their own, marked like the `external` stubs so the "resolves to a real level" invariant skips them) and given entries in a small **competency scorer** that folds self-eval / MM outcomes into a `TopicMastery` bucket via the SAME `applyItemAttempt`/Beta path. Because brainteaser reasoning is self-graded and MM is P&L-graded, they use `applyItemAttempt` with a computed `credit ∈ [0,1]` rather than the hint ladder.

### 3.3 The 4 metrics per node/user

All four live on the **same `TopicMasteryMap`** keyed by topicKey, distinguished by which node they write to — no new storage shape needed for (a); (b)–(d) get their own keys:

| Metric | Where it's stored | Written by |
|---|---|---|
| (a) content mastery | `TopicMastery` on each topic node (θ, α, β, misconceptions, IRT/Glicko) | untimed diagnostic seed + drilling attempts (`applyItemAttempt`) |
| (b) timed performance | a parallel per-topic timed tally (proposed `timedMastery?: Record<topicKey, {correct,total,...}>` on `UserProgress`, or reuse `oaTimed` results tagged by topic) | timed diagnostic + strict timed sections |
| (c) brainteaser reasoning | `TopicMastery` on `competency::brainteaser-reasoning` | flashcard self-eval + mock brainteaser steps |
| (d) trading intuition | `TopicMastery` on `competency::trading-intuition` | game-OA + MM rounds |

### 3.4 Stage-unlock state (new, additive to `UserProgress`)

`UserProgress` (`src/types/progress.ts`) is versioned and additive-friendly (every new field is optional; `migrateProgress` fills defaults). Add one field:

```ts
// proposed addition to UserProgress (bump version 5 → 6, add a no-op migration)
pipeline?: {
  stage: "diagnostic-untimed" | "diagnostic-timed" | "game-oa"
       | "diagnosis" | "drilling" | "mock" | "greenlight";
  untimedDoneAt?: string;
  timedDoneAt?: string;
  gameOaDoneAt?: string;
  diagnosisComputedAt?: string;
  drillingClearedAt?: string;   // set when all §6 gates pass
  mockClearedAt?: string;
  greenlitAt?: string;
  // per-run results for the progress view / audit
  untimed?: DiagnosticResult;   // reuse existing type
  timed?: { correct: number; total: number; sections: {...}[] };
  gameOa?: { rounds: number; pnl: number; verdict: string };
  mocks?: { at: string; scorePct: number; wouldPass: string }[];
};
```

This mirrors the existing `diagnosticDoneAt` pattern (a stamp that a pure guard reads — see `shouldRedirectToDiagnostic`), so the stage router is a pure function of `pipeline.stage` + the stamps.

### 3.5 Persistence (local + AWS)

Everything above rides the existing persistence, unchanged: `StorageProvider` (`src/lib/storage.ts`) with `LocalStorageProvider` (localStorage, `qtp.progress.<user>`) and `AwsStorageProvider` (`src/lib/awsStorage.ts`, Cognito + DynamoDB). `loadProgress`/`saveProgress` already round-trip the whole `UserProgress` blob, so the new `pipeline` field syncs cross-device for free. Reload-proof in-progress timed state already persists via `progress.oaTimed` (wall-clock deadlines in `timedSession.ts`). Session scoping per user via `userScope.ts`.

### 3.6 Mastery gate math per stage (formal)

- **Untimed content (per node):** `deriveVerdict(m, key).mastered === true`, i.e. Beta `CI_low ≥ MASTERY_BAR (0.80)`; drilling attempts feed `applyItemAttempt` with credit-weighted score, and a level's pass uses `meetsMasteryGate(creditRoundScore, 0.80)`.
- **Timed multi-topic sections:** `meetsMasteryGate(sectionScore, 0.90)` — the SAME gate function with a **0.90** threshold (it already takes the threshold as a parameter). Applies to the timed diagnostic and the in-loop strict timed sections.
- **Brainteaser-reasoning / trading-intuition:** each node's Beta `CI_low ≥ 0.80`.
- **Mocks:** `computePerformance(session).scorePct ≥ 90` AND `wouldPass !== "no"` (rework `deterministicDiagnosis`'s gate constants to a 90% bar for this stage).
- **Stage-6 overall pass = ALL of:** every scored KST node mastered (0.80) **and** timed sections ≥ 0.90 **and** both competency nodes mastered.

---

## 4. Backend diagnosis algorithm (Stage 5)

Produces the weakest→strongest ordering and the drill queue. **Reuses** the KST, Bloom 80% bar, and the remediation cascade.

1. **Seed mastery from the diagnostics.** Untimed free-response outcomes fold into each topic node via `applyDiagnosticSeed` / `applyItemAttempt` (`src/lib/mastery/mastery.ts`). Timed outcomes fold into the timed tally (metric b). Game-OA folds into `competency::trading-intuition`; brainteaser flashcards into `competency::brainteaser-reasoning`.
2. **Compute per-node verdicts.** `deriveVerdict` → `{ mean, lo, hi, mastered }` for every node (`src/lib/mastery/verdict.ts`). Bloom "mastered" ⇔ `lo ≥ 0.80`.
3. **Order weakest→strongest.** Rank unmastered nodes by mastery mean (θ tie-break), **respecting prerequisites** so a node is never drilled before its prereqs (`prereqClosure` in `unlockGraph.ts`; `gatingPriority` in `mode/visibility.ts` gives foundation-first ordering). This is the drill queue.
4. **Drive the drill queue.** For each queued node, serve items at the ZPD tier via `probeTierFor` (`remediation/policy.ts`, 85% target band, Glicko/IRT-aware). On repeated misses, the remediation cascade (`remediationStep`) descends the prereq DAG (misconception-edge first via `MISCONCEPTION_EDGE`, else weakest-prereq), teaches at the frontier/floor, then climbs back (`remediation/session.ts`, `climbBack.ts`, `relock.ts`). **Reuse as-is** — this is exactly what the loop needs.
5. **Brainteaser + trading-intuition gating.** These two competency nodes are added to the queue like any node; they're only "mastered" when their Beta clears 0.80. Because they have no in-place probe ladder, drilling them routes to: brainteaser flashcard sets (self-eval) and MM game rounds respectively.
6. **Timed gate as a separate overlay.** Independently of the 80% content bar, the loop periodically serves a **strict timed multi-topic section** (hard questions across the user's covered topics) and requires ≥ 90%. This reuses the OA timed engine (§5-timed) with a new 0.90 pass threshold.

**Report surface:** reuse the mock diagnosis prose generator pattern (`deterministicDiagnosis`) and the dashboard weakness projection (`components/dashboard/dashboardView.ts`, `WeaknessList`) for the read-only Stage-5 report — but render it inside the guided shell, not the old dashboard page.

---

## 5. Content plan — infinite bank via generators + verifiers

### 5.1 Architecture (already the house pattern — reuse + extend)

Questions are **parametric generators** whose correct answer comes from an **exact numeric/code verifier**, never a hardcoded per-instance answer. This exists and is battle-tested:

| Layer | Files | Notes |
|---|---|---|
| Hard OA archetypes (14) | `src/lib/oa/hardContent/generators.ts` + `solvers.ts` | lattice path-intersection (parity trap), biased ruin duration, Conway pattern wait, secretary, graph hitting/meeting, reset coupon collector, hidden-composition Bayes, coin-bias Bayes, dice order stats, informed-lift adverse selection, one-reroll EV, step-landing recurrence, Kelly. Each `build*` returns the **exact verifier answer**. |
| Mock verifiers | `src/lib/mock/archetypes/verifiers.ts` | bank-or-roll cascade, order stats, hidden-composition, Kelly, hypercube/pattern hitting times, gambler's ruin, secretary, urn posterior — exact, unit- + Monte-Carlo-tested. |
| Per-topic generators | `src/content/probabilityStats/**/generators.ts`, `interviewGames/`, `arbitrage/`, `auctions/`, `sequences/`, `brainteasers/` | quiz + numeric generators with authored `commonErrors`/`distractorRationale` (misconception-tagged). |
| Numeric verifier | `src/lib/numeric.ts` (`numericMatches`), `src/content/materialize.ts` | tolerant grading for free-response numeric answers. |
| Brainteaser generators | `src/content/brainteasers/{generators,solvers,techniqueGenerators,techniqueSolvers}.ts` | exact-verified flashcards; `gradableFlashcards.test.ts`, `ALL_BRAINTEASER_FAMILIES`. |

**Calibration from firm examples:** the research files (`datasets/TOP10_2026/*`, `JANE_STREET_2026_DEEP.md`, `OPTIVER_2026_DEEP.md`, etc.) are used to pick archetypes, difficulty, and traps — but we serve ONLY original generated, verifier-checked instances (never verbatim). This is already the documented rule ("Paraphrase rule").

**Gap for the pipeline:** most hard generators emit **MCQ** (`choices`/`correctIndex`). The untimed diagnostic is **free-response**. Fix: add thin **free-response adapters** that reuse each `build*`'s exact `answer` as a `NumericQuestion` (`answer` + `commonErrors` from the existing distractors) so the hint ladder + `numericMatches` grade them. This is a small, additive layer over existing solvers — no new math.

### 5.2 Difficulty tiers (per topic): non-trivial floor → hard ceiling

Every topic must span a real range. Tiers already exist (`DIFFICULTY_META`: intro/easy/medium/hard/expert; `TIER_SEED` in `mastery/config.ts`). Precedent for a **non-trivial floor** exists: `mock/mathGate.ts` deliberately excludes memorized freebies. Apply the same principle to the diagnostic.

| Topic (example) | Non-trivial floor (NOT trivial) | Hard ceiling (force-you-to-think) |
|---|---|---|
| Expected Value | "EV of a $2 bet paying 5:1 at p=1/4" (a real EV calc, **not** P(heads)=1/2) | one-reroll / bank-or-roll optimal-stopping EV |
| Markov / random walk | expected steps of a small 3-state chain | biased gambler's-ruin duration; lattice path-intersection (parity trap) |
| Combinatorics | count arrangements with a simple constraint | inclusion–exclusion / stars-and-bars with a twist |
| Conditional / Bayes | "P(sum=7 \| ≥ one 3)" | hidden-composition / fair-vs-biased-coin predictive posterior |
| Order statistics | E[max of 2 dice] | E[max/min of m dice] + auction winner's-curse shading |
| Optimal stopping | keep-or-reroll once | secretary optimal cutoff; casino-adversary bank-or-roll |

The diagnostic blueprint (§below) explicitly samples **both** floor and ceiling tiers per topic so there is no "all-easy-then-pass."

### 5.3 Brainteaser flashcard model (self-eval)

Reuse `src/content/brainteasers/*` + the mock's brainteaser step shape (`engine.ts` `BrainteaserStep`: prompt, answer, explanation, self-assessed `"got"|"missed"`, timer). In the diagnostic these render as flashcards: show prompt → user thinks → "Show answer" → self-grade. Self-grades fold into `competency::brainteaser-reasoning`. We cannot auto-grade open reasoning, so self-eval is the signal (same as the mock today).

### 5.4 Firm research → topic taxonomy (reconciliation + TODO)

The 2026 firm research maps cleanly onto the existing skill-graph topics. Consolidated (from `datasets/TOP10_2026/SIG_IMC_DRW.md §4` and `JS_CITADEL_OPTIVER.md`):

| Firm-tested skill (research) | Canonical KST node |
|---|---|
| Mental math (2-dig ×, %, fractions) | Mental Arithmetic |
| Expected value | Expected Value |
| Conditional / Bayes updating | Conditional Probability & Bayes |
| Combinatorics | Combinatorial Analysis |
| Markov chains / hitting times | Markov Chains + Markov Chain Structure |
| Recursion / DP, random walks, lattice paths | Markov Chains (+ hard OA archetypes) |
| Order statistics | Order Statistics |
| Optimal stopping (bank-or-roll, reroll) | Interview Games / EV |
| Estimation / Fermi → market | Fermi (external) → Interview Games |
| Game theory / bluff freq | Game Theory & Puzzles |
| Betting / Kelly / confidence-to-bet | Betting & Sizing |
| Market-making intuition | Interview Games + **trading-intuition competency** |
| Brainteasers / deductive logic | **brainteaser-reasoning competency** |
| Sequences / pattern recognition | Sequences (external) |
| Martingales / optional stopping | Expected Value / Markov (implicit) |

> **TODO (fold in when it lands):** `datasets/TOP10_2026/*` is still being written. Before build, reconcile the final per-firm checklists against this table and confirm no new archetype family is required (e.g. DRW linear-algebra is currently a **known gap** — see `oa/questionPool.ts` note). Add generators for any firm-tested family not yet covered.

---

## 6. Reuse map (capability → files → verdict)

| Capability | Existing file(s) | Verdict |
|---|---|---|
| KST / prerequisite DAG | `src/content/remediation/prereqDAG.ts` (`PREREQ_DAG`, `MISCONCEPTION_EDGE`), `src/lib/roadmap/skillGraph.ts` (`SKILL_GRAPH`), `src/lib/mastery/unlockGraph.ts` (`prereqClosure`) | **Reuse**; **extend** with 2 competency nodes + gating |
| Mastery engine | `src/lib/mastery/{mastery,config,verdict,beta,elo,glicko,irt,thompson}.ts` (`applyItemAttempt`, `applyDiagnosticSeed`, `deriveVerdict`, `MASTERY_BAR=0.8`) | **Reuse as-is** |
| Credit-weighted mastery gate | `src/lib/score.ts` (`creditRoundScore`, `meetsMasteryGate`), `src/context/ProgressContext.tsx` (`recordAttempt`, `recordItemAttempt`) | **Reuse**; call with 0.90 for timed/mock |
| Hint ladder + credit penalty | `src/lib/tutor/hintLadder.ts` (5-rung, answer-withholding), `src/lib/tutor/creditSchedule.ts` (`RUNG_CREDIT`), `src/lib/tutor/{planOfAttack,workedSibling,misconception}.ts` | **Reuse as-is** |
| Diagnostic flow | `src/lib/diagnostic/{run,multistage,gate,history}.ts`, `src/content/diagnostic/{blueprint,items}.ts`, `src/pages/DiagnosticPage.tsx` | **Extend**: current is ≤30 MCQ; build the ~100-item **free-response untimed** blueprint on the same plumbing |
| Drill / targeted practice / remediation | `src/lib/remediation/{policy,session,climbBack,relock,targetedPractice,finish,noMastery,suggestPrereqs,probe}.ts`, `src/lib/drill/{assemble,parseIntent,aiIntent}.ts`, `src/pages/{DrillPage,lesson/remediation}.tsx` | **Reuse** engines; new orchestration drives the queue |
| SRS | `src/lib/srs/{deck,schedule,store}.ts` | **Reuse** (optional retention layer inside the loop) |
| Mock interview engine + diagnosis | `src/lib/mock/{engine,presets,questionPools,mathGate,scoring,reasoning,followups,behavioral,marketMaking,diagnosis}.ts`, `src/components/mock/*` | **Reuse**; **rework** the pass gate to 90% for Stage 7 |
| Mock verifiers | `src/lib/mock/archetypes/verifiers.ts` | **Reuse as-is** |
| Market-making / trading games | `src/lib/games/makeMarket/engine.ts` (informed+noise flow, break-even, coaching), `src/lib/games/{marketOfCards,cardsMarketMaking,nextCardBetting,...}`, `src/lib/tradingFloor/*`, `src/pages/{MakeMarketPage,TradingFloorPage}.tsx` | **Reuse** engines for Stage 4 + trading-intuition drilling |
| Question generators + verifiers | `src/lib/oa/hardContent/{generators,solvers}.ts`, `src/content/**/generators.ts`, `src/lib/mock/archetypes/verifiers.ts`, `src/content/materialize.ts`, `src/lib/numeric.ts` | **Reuse**; **add** free-response adapters for MCQ archetypes |
| Timed OA engine + reload-proof timers | `src/lib/oa/{timedSession,config,store,scoring,stats,types}.ts`, `src/components/oa/*`, `src/pages/OaSectionsPage.tsx` | **Reuse**; **add** a 30Q/45min format for the timed diagnostic + a 0.90 gate |
| Routing / nav / mode visibility | `src/App.tsx`, `src/lib/mode/visibility.ts` (`navFor`, `QUANT_ONLY_ROUTES`), `src/components/layout/{AppShell,NavMenu}.tsx` | **Rewrite** shell to guided flow; hide free-roam routes |
| Themes | `src/themes/index.ts` (`THEMES`, `DEFAULT_THEME_ID="minimalist"`), `src/themes/{broadsheet,casino,chalkboard,cyberpunk,kids}/`, `src/pages/ThemesPage.tsx`, `src/context/ThemeContext.tsx` | **Delete** 5 themes + switcher; hard-lock minimalist |
| Auth/login + persistence | `src/pages/LoginPage.tsx`, `src/context/AuthContext.tsx`, `src/lib/{storage,awsStorage,awsConfig,userScope}.ts`, `src/types/progress.ts` | **Reuse as-is**; add `pipeline` field to `UserProgress` |

---

## 7. Strip-down plan (hide UI, KEEP engines)

**Precedent:** `AppShell.tsx` already hard-locks `FRONTEND_GOAL_MODE = "interview"` and keeps course-mode code importable-but-dormant. We do the same for the whole free-roam surface.

### 7.1 Routes/nav to remove from the shell
Replace the flat menu in `src/lib/mode/visibility.ts` (`interviewNav`) and the `AppShell` outlet with the guided flow. **Hidden** (routes deleted from `App.tsx` nav, engines kept):

- Games hub (`/games`), all game pages (`/make-market`, `/probability-betting`, `/cards-market-making`, `/market-of-cards`, `/fruit-market`, `/dice-and-cards`, `/next-card-betting`), Trading Floor (`/trading-floor`).
- Simulations (`/simulations`), Dashboard (`/dashboard`), Roadmap (`/roadmap` — replaced by the in-loop Progress panel), Table of Contents (`/contents`), tracks (`/track/*`, `/course/*`), lessons player (`/track/:t/level/:l` — reused internally by the loop, not user-navigable), SRS review (`/review`).
- Standalone drills (`/arena`, `/oa`, `/arbitrage`, `/ev-timed`, `/fermi`, `/drill`), Optiver cluster (`/numberlogic`, `/beat-the-odds`, `/stockmaster`, `/number-box`, `/shape-shift`), Mock hub (`/mock` — reused internally by Stage 7).
- Community, Leaderboard (already un-advertised).

The pipeline stage router (`RequirePipelineStage`, modeled on the existing `RequireDiagnostic`/`Guarded` wrappers) becomes the single navigation authority: it renders the right stage component for `pipeline.stage` and redirects everything else to it.

### 7.2 Themes
- Delete `src/themes/{broadsheet,casino,chalkboard,cyberpunk,kids}/` and their registrations in `src/themes/index.ts`; keep only `minimalist`. `DEFAULT_THEME_ID` stays `"minimalist"`.
- Remove `src/pages/ThemesPage.tsx`, the `/themes` route, and the theme-switcher UI; simplify `ThemeContext` to hard-lock minimalist (keep the light/dark toggle if desired, or drop it). Update `THEMES.md` note.
- Per-theme Dashboard variants (`src/themes/*/Dashboard.tsx`) go with their theme folders; the guided Progress view uses `BaseDashboard` data helpers only.

### 7.3 What stays (engines, never deleted)
Everything under `src/lib/**` (mastery, remediation, tutor, mock, oa, games, diagnostic, srs, roadmap, drill), `src/content/**` (generators/verifiers), and the lesson player internals — all reused by the guided flow. The strip-down is **UI-only**.

---

## 8. Phased execution plan (parallel-friendly)

Ordered milestones with clear file-ownership boundaries so multiple build agents can work without conflicts.

| Phase | Milestone | Owns (files) | Depends on | Parallel? |
|---|---|---|---|---|
| **P0** | Data model + stage router | `src/types/progress.ts` (add `pipeline`), `src/lib/mastery/migrate*.ts` (v5→v6 no-op), new `src/lib/pipeline/{stateMachine,gates}.ts`, `src/App.tsx` route skeleton | — | foundational; do first |
| **P1** | Strip-down shell + themes | `src/components/layout/AppShell.tsx`, `src/lib/mode/visibility.ts` (nav), `src/App.tsx` (nav), `src/themes/*`, `ThemeContext`, `ThemesPage` | P0 | ‖ with P2–P5 (different files) |
| **P2** | KST competency nodes + competency scorer | `skillGraph.ts`, `prereqDAG.ts`, new `src/lib/mastery/competency.ts` | P0 | ‖ |
| **P3** | Untimed free-response diagnostic (~100) | new `src/content/diagnostic/untimedBlueprint.ts`, free-response adapters `src/lib/oa/hardContent/frAdapters.ts`, new `src/lib/diagnostic/untimedRun.ts`, Stage-2 UI | P0, (adapters ‖ P2) | ‖ |
| **P4** | Timed diagnostic (30Q/45min) + 0.90 gate | `src/lib/oa/config.ts` (new format), reuse `timedSession.ts`, Stage-3 UI, `oa/scoring.ts` threshold plumbing | P0 | ‖ |
| **P5** | Game-OA / trading-intuition (Stage 4) | Stage-4 UI over `games/makeMarket/engine.ts`, wire into `competency::trading-intuition` | P0, P2 | ‖ after P2 |
| **P6** | Diagnosis + drilling loop orchestrator (Stage 5–6) | new `src/lib/pipeline/drillQueue.ts` over `remediation/*` + `mastery/verdict`, Stage-5 report, Stage-6 "next task" runner | P0, P2, P3, P4 | serial-ish (integration) |
| **P7** | Mock stage 90% gate + greenlight (Stage 7–8) | `mock/diagnosis.ts` (90% gate rework), Stage-7 wrapper over mock runner, Stage-8 screen | P0, P6 | after P6 |
| **P8** | Progress/Roadmap panel + polish | Progress view over `dashboardView`/`useRoadmapData` data, end-to-end tests | all | last |

**Riskiest parts (call-outs):**
1. **The ~100-item untimed free-response diagnostic** — biggest genuinely-new content build; needs the MCQ→free-response adapters and a difficulty-spanning blueprint that guarantees hard-end items. (P3)
2. **The drilling-loop orchestrator** — the integration seam that turns the (excellent, existing) remediation cascade + mastery verdicts into a linear weakest-first queue with the 80%/90%/competency gates. Most cross-module coupling. (P6)
3. **Two competency nodes** — self-eval + P&L don't fit the hint-ladder credit path; need a clean `credit ∈ [0,1]` mapping so `applyItemAttempt` stays the single mastery entry point. (P2)
4. **Timed gate = 90%** — must not accidentally change the global 80% content bar; keep it a per-call threshold, never a config change. (P4)

---

## 9. Open questions / risks / decisions needed

1. **Untimed diagnostic length & seeding.** 100 free-response items is long and untimed — confirm we want all 100 to *seed mastery* (vs. a subset seeding + rest for coverage). How many items per topic, and exact floor/ceiling split per topic?
2. **Brainteaser self-eval trust.** Self-graded "got/missed" is gameable. Do we accept it as-is (matches today's mock), or add a lightweight confirm (e.g. enter the final number where a brainteaser *has* one)?
3. **Trading-intuition threshold.** What MM outcome = "mastered"? Positive P&L over N rounds, or an edge/verdict bar from `makeMarket/engine.ts`? How many rounds in Stage 4 vs. drilling?
4. **Timed section composition in the loop.** How often does the loop inject a strict timed multi-topic section, and which topics compose it (only mastered ones, or stretch)?
5. **Mock stage: how many mocks / which firms.** ≥90% on how many mocks, and do we cycle Optiver/JaneStreet/SIG presets or pick by weakest signal?
6. **Retry/backoff on gate failure.** On a failed timed (`<90%`) or mock, what's the re-entry — immediate retry, mandatory extra drilling, cooldown?
7. **Relock semantics in the loop.** The existing `relock`/`climbBack` can pull a node back below threshold. Confirm a re-locked node re-enters the drill queue and can *un-greenlight* a user, or freeze mastery once a stage passes.
8. **Light/dark toggle** — keep it under the hard-locked minimalist theme, or remove entirely?
9. **DRW linear-algebra gap** (noted in `oa/questionPool.ts`) — build a generator family, or accept the gap for v1?
10. **Existing users' progress.** On migration to `pipeline`, do returning users (with `diagnosticDoneAt`) start at Stage 2, or are they seeded into drilling from prior mastery?

---

### Appendix — key anchors (for builders)
- Mastery bar: `MASTERY_BAR = 0.8`, `P_TARGET = 0.8` (`src/lib/mastery/config.ts`).
- Gate fn: `meetsMasteryGate(creditWeightedScore, threshold)` (`src/lib/score.ts`) — pass `0.90` for timed/mock.
- Credit schedule: `RUNG_CREDIT` 1.0 / 0.65 / 0.45 / 0.2 / 0.1 / 0.04 (`src/lib/tutor/creditSchedule.ts`).
- Remediation cascade entry: `remediationStep(input)` (`src/lib/remediation/policy.ts`); descent DAG `PREREQ_DAG`.
- Reload-proof timers: absolute `deadlineTs` in `src/lib/oa/timedSession.ts`; persisted via `progress.oaTimed`.
- MM engine verdict/P&L: `counterpartyTight`, `markToTrue`, `breakEven` (`src/lib/games/makeMarket/engine.ts`).
- Onboarding-gate precedent to copy: `shouldRedirectToDiagnostic` (`src/lib/diagnostic/gate.ts`) + `Guarded`/`RequireDiagnostic` (`src/App.tsx`).

---

## 10. RESOLVED DECISIONS (locked — 2026-08-07, user-approved)

These override the open questions in §9. All build phases MUST follow them.

1. **Architecture approved.** Build in the phase order (P0 first).
2. **Optiver / mental math:** Do NOT include the "80-in-8" branded arithmetic sprint (the user did not encounter it in any 2026 OA). BUT **Mental Arithmetic remains a core, heavily-drilled topic** — the user must be excellent at mental math. Calibrate Optiver around the newer battery modules (NumberLogic, Beat the Odds, Zap-N / Zap-Q, Likelihood List, Intervals, Order Books) + hard probability/EV.
3. **Brainteaser gate = HYBRID:** self-eval flashcards, BUT when a brainteaser has a numeric answer, require the user to ENTER the number (objectively graded via `numericMatches`); pure self-eval only when there is genuinely no numeric answer.
4. **Mock stage:** require **≥90% on 3 CONSECUTIVE mocks**. Each mock is a THOROUGH, timed, realistic interview covering ALL topics — **NOT weighted toward the user's weaknesses** (a real mock isn't). Cycle the firm presets across the three.
5. **Relock:** a decayed/relocked node re-enters the drill queue and **CAN un-greenlight** a user. Readiness must stay earned (no permanent freeze).
6. **Untimed diagnostic:** all ~100 items seed mastery; ~3–4 per topic, each guaranteeing a non-trivial floor + a hard ceiling.
7. **Theme:** keep a **light/dark toggle** under the hard-locked minimalist theme.
8. **Accepted defaults:** trading-intuition mastery = edge-capturing MM verdict over N rounds (Beta `CI_low ≥ 0.80`); the loop injects strict timed multi-topic sections periodically from covered + stretch topics; a failed timed/mock gate triggers mandatory targeted drilling before retry; build a small **DRW linear-algebra generator family** for v1; returning users start at Stage 2 (untimed diagnostic) but seed priors from prior mastery.
9. **Mental math is a first-class SCORED KST node** (not merely an L0 floor). It is drilled and gated like any other topic (needed for OA performance), and modeled with **subtopic granularity** — e.g. multi-digit multiplication, division, percentages, fractions↔decimals, ratios/odds-to-probability, and fast sequence arithmetic — each attributable and drillable. (Implemented in P2 taxonomy; drilled everywhere it appears.)
10. **Attribution accuracy (hard requirement):** the engine MUST be precise about which problem and which *mistake* maps to which subtopic. Every generated/served item carries a precise KST subtopic tag, and every authored wrong-answer (`commonErrors` / `distractorRationale`) maps to the correct **misconception → subtopic/prereq edge** so that (a) mastery updates hit the right node, (b) remediation routes to the true weak subtopic, and (c) the weakness report names the real cause. Add tests asserting: every item resolves to a valid subtopic node; every misconception tag resolves to a real node/`MISCONCEPTION_EDGE`; no orphan tags. Owned by **P2** (subtopic taxonomy + attribution map) and **P3** (diagnostic item tagging), with a dedicated attribution-accuracy audit pass.
