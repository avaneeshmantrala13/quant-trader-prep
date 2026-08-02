# Goal Mode (Case A / Case B) — Build Spec & Architecture Plan

**Status:** PLANNING ONLY (no app code changed, no commits). This doc is the
build spec for a user-selectable **Goal Mode** with two cases, chosen via a
mandatory diagnostic question and freely switchable later, with per-topic
progress preserved across toggles.

**Grounded in:** `datasets/UT_COURSE_GAP_ANALYSIS.md`,
`datasets/UT_TOPICS_BUILD_PLAN.md`, `datasets/CURRICULUM_ROADMAP.md`,
`datasets/FIRM_TIMED_ASSESSMENTS.md`; and the current code:
`src/types/progress.ts`, `src/lib/mastery/**`, `src/lib/roadmap/skillGraph.ts`,
`src/content/**`, `src/content/diagnostic/**`, `src/pages/DashboardPage.tsx` +
`src/components/dashboard/**` + `src/themes/**/Dashboard.tsx`,
`src/components/layout/AppShell.tsx`, `src/pages/SimulationsPage.tsx` +
`src/lib/simulations/**`, `src/App.tsx`.

---

## 0. The two cases (design intent)

- **Case A — "Course mastery"** (remediation for UT **M362K Intro to
  Probability** + **M362M Intro to Stochastic Processes**). Focus purely on
  MASTERING course topics. **No** market-making games, **no** speed/timing
  emphasis, **no** OA quirks. Navigation is restructured into **two course
  tracks**: **"Intro to Probability" (M362K)** and **"Intro to Stochastic
  Processes" (M362M)**. Existing topics map into these two courses; overlaps
  reuse teaching/hints **UNCHANGED**. A **double-integral visualization** is
  added to the Simulations tab.
- **Case B — "Quant interview / OA prep"** (≈ the current site). Topics
  taught → mastered, **then** timing becomes the priority; market-making games
  + OA quirks active; M362-only topics firms don't test live in **"Extra
  Relevant Knowledge."** Largely unchanged from today.

The core architectural claim, validated in §2: **mode is a filtered VIEW over
the same `topicKey`-keyed mastery store** — it changes navigation grouping,
which features/tracks are shown, gating priorities, and dashboard focus, but
**never** a separate progress store. Overlapping-topic progress is therefore
shared automatically when toggling A↔B.

---

## 1. Mode / diagnostic UX + wording proposal

### 1.1 The mandatory diagnostic question (mode router)

Today the required-once diagnostic (`src/pages/DiagnosticPage.tsx`, gated by
`RequireDiagnostic` in `src/App.tsx` until `progress.diagnosticDoneAt` is
stamped) has phases `intro → (selfreport | quiz) → summary`. We insert a NEW
mandatory **mode-select step as the very first screen**, before the warm-up
intro, for both the full-warm-up lane and the self-report lane.

Proposed copy (theme-agnostic, styled by tokens):

> **What are you here to do?**
> Pick a focus — you can switch anytime, and your progress carries over.
>
> **▸ Master my probability courses**
> "I'm taking (or reviewing) UT M362K / M362M — Intro to Probability and Intro
> to Stochastic Processes. Teach me the course topics and tell me how ready I am
> for each course. No trading games or speed drills."
>
> **▸ Prep for quant trading interviews / OAs**
> "Get me interview- and online-assessment-ready: the probability that firms
> test, market-making games, and timed speed drills."
>
> _You can change this later from the menu or your dashboard. Either choice uses
> the same practice history — switching never resets your progress._

- The choice writes `progress.goalMode` (§3) and is **mandatory** (no default
  advance until one is picked). It is NOT a graded item, so it does **not**
  affect the diagnostic's `≤ 30` item guarantee (`diagnosticMaxItemCount()` in
  `blueprint.ts`), which the prior work marked sensitive — untouched.
- After the mode choice, the existing intro (full warm-up vs 20-second
  self-report) proceeds unchanged.
- **Case A tailoring of the warm-up (optional, low-priority):** the warm-up can
  keep probing every topic (breadth is harmless — it only seeds priors), but the
  Summary copy should speak in course terms for Case A ("we've tuned your M362K
  starting point"). Minimal, copy-only.

### 1.2 Switching later

- A **mode toggle** appears in two places: the AppShell header meta-bar (next to
  the tutorial/theme buttons) and on the Dashboard header. Two-way segmented
  control: "Course mastery" ⇄ "Interview prep."
- Switching is instant and non-destructive: it only rewrites `goalMode`. No
  mastery, level, streak, or XP state is touched. A short toast confirms
  "Switched to Course mastery — your progress carried over."

### 1.3 Existing users (no `goalMode` yet)

- `migrateProgress` leaves `goalMode` undefined for old saves; the app treats
  `undefined` as **Case B (interview)** so the current experience is unchanged
  for anyone who already finished the diagnostic. (Decision D6.)

---

## 2. Progress model validation — mode as a filtered view

**Finding: fully feasible with the current model, no schema redesign.**

- Mastery is keyed by `topicKey = ${trackId}::${section ?? "_core"}`
  (`src/lib/mastery/topicKey.ts`). All per-topic state
  (`topicMastery`, `tierDifficulty`, misconception flags, review schedule) and
  per-level state (`levelProgress`) are keyed independently of any "mode."
- `UserProgress` (`src/types/progress.ts`) is a single localStorage blob per
  user (`ProgressContext`), version 2, with every Phase-1+ field **optional and
  additive** (see `emptyProgress`, `migrateProgress`). Adding one more optional
  field is the established, migration-safe pattern (mirrors `diagnosticDoneAt`,
  `onboardingTourDoneAt`, `diagnosticHistory`).
- Therefore **mode holds NO progress**. It is a pure projection input that
  selects/regroups/reorders the SAME topics for nav, dashboard, gating priority,
  and feature visibility. Overlapping topics (e.g. `probability::Conditional
  Probability`) are the identical bucket in both cases → progress is shared by
  construction. **No sync, no copy, no dual store.**

### 2.1 Exactly how mode is stored

Add ONE optional field to `UserProgress`:

```ts
// src/types/progress.ts
export type GoalMode = "course" | "interview";

export interface UserProgress {
  // …existing…
  /**
   * User-selected Goal Mode (Case A "course" | Case B "interview"). Additive &
   * optional (mirrors diagnosticDoneAt): older saves load unchanged and are
   * treated as "interview". A pure VIEW selector — it NEVER stores progress,
   * gates content, or affects scoring/mastery/the v1→v2 migration.
   */
  goalMode?: GoalMode;
}
```

- `emptyProgress()` may leave it undefined (treated as `"interview"`), or set it
  explicitly once the diagnostic mode-step runs.
- `ProgressContext` gains a `setGoalMode(mode)` writer (same `update()` pattern
  as `markOnboardingTourDone`) and exposes `goalMode` (defaulting undefined →
  `"interview"` via a helper `resolveGoalMode(progress)`).

### 2.2 How the diagnostic sets it

`DiagnosticPage` calls `setGoalMode(choice)` when the mandatory mode step is
answered (both lanes), independent of `applyDiagnosticSeeds`. The mode write and
the seed/`diagnosticDoneAt` write are orthogonal.

### 2.3 How toggling works

Header/Dashboard toggle → `setGoalMode(next)`. Because every consumer derives its
view from `resolveGoalMode(progress)` reactively (React context), the nav,
dashboard, and simulation visibility re-render immediately with the same
underlying mastery data.

---

## 3. The pure mode module (single source of truth for the projection)

New pure, unit-tested module `src/lib/mode/` (no React, mirrors
`skillGraph.ts`/`catalog.ts` conventions):

- `goalMode.ts`
  - `type GoalMode = "course" | "interview"`.
  - `resolveGoalMode(progress): GoalMode` (undefined → `"interview"`).
  - `MODE_META: Record<GoalMode, { id; label; blurb }>` for copy.
- `courseMap.ts` — the Case-A course→topic mapping (§4) as data:
  - `type CourseId = "m362k" | "m362m"`.
  - `COURSES: { id; label; code; blurb; topicKeys: string[] }[]` where every
    `topicKey` resolves to a REAL existing mastery bucket + skill-graph node.
    (This is a regrouping of existing `topicKey`s — it introduces **no new
    levels**.)
  - Helpers `courseForTopic(topicKey)`, `topicsInCourse(courseId)`.
- `visibility.ts` — mode → feature/nav visibility flags:
  - `navFor(mode): NavItem[]` (drives AppShell, §6).
  - `isFeatureVisible(mode, feature)` for `speed-arena`, `interview-games`,
    `market-making-sims`, `fermi`, `timing`, `double-integral-sim`,
    `extra-relevant-knowledge`.
  - Aggressiveness of hiding is a single knob here (Decision D3).

Everything mode-aware in the UI reads from this module, so behavior stays
consistent and testable.

---

## 4. Case A — course → topic mapping (reused vs new)

Mapping is grounded in `UT_COURSE_GAP_ANALYSIS.md` §3 (coverage matrix) and
`UT_TOPICS_BUILD_PLAN.md` (topics already added). **Key correction to the
original brief:** most "missing" M362K/M362M content the brief anticipated has
**already been built** by the UT topics workstream and ships today in
`src/content/probabilityStats/**` (Poisson, Continuous Distributions, Brownian
Motion, MGF, Gamma, **Joint Densities & Transformations incl. double integrals**,
Branching, CTMC, Limit Theorems, Markov structure). So Case A is largely a
**re-grouping + surfacing** job, plus a small set of genuine additions.

Legend: **REUSE** = existing level(s), teaching/hints unchanged · **SURFACE** =
exists but currently buried in "Extra Relevant Knowledge"; promote to a
first-class course topic in Case A only · **ADD** = genuinely missing, build via
the established pipeline.

### 4.1 M362K "Intro to Probability" → topics

| UT topic (gap doc) | Our topicKey / level | Action |
|---|---|---|
| K1 Combinatorics | `probability::Combinatorial Analysis` | REUSE |
| K2 Axioms / sample space / incl–excl | `probability::Core Probability` | REUSE |
| K3 Conditional / Bayes | `probability::Conditional Probability` | REUSE |
| K4 Discrete distributions (Bern/Binom/Geom/NegBin/Hypergeom) | Core Prob + `Expected Value` + `Combinatorial Analysis` | REUSE |
| K4 **Poisson distribution** | `probability::Poisson Distribution & Process` (`po-*`) | REUSE (already built) |
| K5 **Continuous (Uniform/Exp/Normal), PDFs/CDFs, integration** | `probability::Continuous Distributions` (`cd-*`) | REUSE (already built) |
| K5 **Gamma** | `probabilityStats/gammaDistribution` (`ek-*`, Extra) | SURFACE |
| K6 Expectation & variance | `probability::Expected Value` + `Variance, Covariance & the CLT` | REUSE |
| K7 **MGFs** | `probabilityStats/mgf` (Extra) | SURFACE |
| K8 Covariance & correlation | `probability::Variance, Covariance & the CLT` | REUSE |
| K8 **Joint (continuous) densities / marginals / double integrals / transforms** | `probabilityStats/jointDistributions` `ek-joint` (Extra) | SURFACE (+ expand, §4.3) |
| K8 Order statistics | `probability::Order Statistics` | REUSE |
| K9 Markov inequality | `probability::Variance, Covariance & the CLT` | REUSE |
| K9 **Chebyshev / LLN / formal CLT** | `probabilityStats/limitTheorems` (Extra) | SURFACE |

Geometric Probability (`probability::Geometric Probability`) maps to M362K ch.5
(continuous/uniform, applied) — REUSE, list under M362K.

### 4.2 M362M "Intro to Stochastic Processes" → topics

| UT topic (gap doc) | Our topicKey / level | Action |
|---|---|---|
| M1 Conditional prob review | `probability::Conditional Probability` | REUSE (shared with M362K) |
| M1 **Conditional expectation E[X\|Y] / tower rule** | (implicit only today) | **ADD** (§4.3) |
| M2 Random walks / gambler's ruin / hitting times | `probability::Markov Chains` (+ `Core Probability`, `Expected Value`) | REUSE |
| M3 **Branching processes** | `probabilityStats/branchingProcesses` (Extra) | SURFACE |
| M4 First-step / absorption | `probability::Markov Chains` | REUSE |
| M4 **Pⁿ / Chapman–Kolmogorov + state classification** | `probabilityStats/markovStructure` (Extra) | SURFACE |
| M4 **Stationary / limiting (πP=π)** | `probability::Markov Chains` (stationary level) | REUSE |
| M5 **Poisson processes** (basic) | `probability::Poisson Distribution & Process` | REUSE |
| M5 **Poisson process depth** (order-stat property, NHPP, compound) | partial today | **ADD (optional, D5)** |
| M6 **CTMC (+ queues)** | `probabilityStats/continuousTimeMarkov` (Extra) | SURFACE |
| M7 Martingales | applied only (EV/gambler's ruin) | leave applied (low course-exam value); optional ADD later |
| M8 **Brownian motion** | `probability::Brownian Motion` (`bm-*`) | REUSE (already built) |

### 4.3 New-content generation plan (for ADD / expand items)

Follow the ESTABLISHED pipeline documented in `UT_TOPICS_BUILD_PLAN.md` and the
`Feature → BrainLift` map — **no copyrighted textbook scraping**:

1. **Scrape EQUIVALENT credible/open sources** (as already used for the UT
   topics): Ross chapters' publicly-taught structure via open courseware — MIT
   OCW 6.041, PSU STAT 414/416, Grinstead & Snell (open), UT syllabi. Understand
   the LOGIC of correct vs wrong answers (the misconception taxonomy), never copy
   items.
2. **Author exact solvers + parametric generators** in a new folder under
   `src/content/probabilityStats/<topic>/` reusing `coreSolvers.ts` /
   `coreScaffold.ts` (`fraction.js` for rational, `normalCdf`/tolerance for
   transcendental). Distractors are re-derived NAMED misconceptions (guaranteed
   `≠` answer at grading precision), per `Question.misconceptions` /
   `NumericQuestion.commonErrors` tags.
3. **5-rung hint ladder + error modes** come for free: `buildHintLadder`
   (`src/lib/tutor/hintLadder.ts`) generates the name-trap → plan-of-attack →
   worked-sibling → elicit/confront → reveal ladder from the item's own
   distractor/`commonErrors` tags + `errorModeCatalogs.ts`. New generators must
   carry `family` ids + misconception tags so the ladder and mastery layer light
   up automatically.
4. **Original scraped items stay hidden** — live only as `*.test.ts` fixtures /
   independent re-derivations; users only ever see freshly generated items.
5. **Wire-up (serial shared edits):** add to
   `src/content/probabilityStats/index.ts`, add skill-graph node(s) in
   `skillGraph.ts` with prereqs/tier, update `levels.test.ts` counts +
   well-formedness suites.

**Concretely to ADD now (pending D5):**
- **Conditional Expectation & the Tower Rule** (M362M M1) — a `numeric`/`quiz`
  unit: `E[X] = E[E[X|Y]]`, double-expectation, `E[X|Y=y]` from a joint table,
  conditional-variance decomposition. New folder `conditionalExpectation/`.
- **Joint Distributions expansion** — `ek-joint` is a single thin level (5 Qs).
  For Case A promote it to a first-class M362K "Joint Distributions" topic and
  add 1–2 more levels (marginals from a table, `P((X,Y)∈region)`, covariance
  from joint pmf) so the course topic isn't one lonely level.
- **(Optional) Poisson-process depth** — order-statistics property, NHPP
  `∫λ(t)dt`, compound Poisson mean/variance, as extra levels in the existing
  Poisson section.

**SURFACE items require NO content generation** — they already exist and are
tested. Surfacing = the `courseMap.ts` grouping lists them under M362K/M362M and
(optionally) re-labels their section from "Extra Relevant Knowledge" to their
course topic **in Case A only** (Case B keeps "Extra Relevant Knowledge").
Cleanest implementation: keep the `section` string as-is in the level data and
resolve the DISPLAY label through the mode/course projection, so no content data
changes and Case B is untouched. (Decision D2.)

---

## 5. Case B behavior (≈ today)

- Navigation, tracks, Speed Arena, Interview Games (market-making), Fermi drill,
  timing, and OA quirks stay exactly as today.
- The taught→mastered→timing priority is preserved: gating priorities in Case B
  keep mental-arithmetic (Tier 0 gate) and the interview spine first, then timed
  drills; unchanged from the current skill-graph/readiness ordering.
- M362-only, firm-untested topics remain in the **"Extra Relevant Knowledge"**
  section (already implemented in `src/content/probabilityStats/index.ts`).
- Net effect: `goalMode === "interview"` reproduces the current app. This makes
  Case B the safe default and keeps the blast radius of the whole feature small.

---

## 6. Routing / navigation plan

### 6.1 AppShell nav (mode-aware)

`AppShell.tsx` currently builds a static `navItems` array (Home, Roadmap,
Dashboard, Table of Contents, Simulations, Fermi Drill, the 6 tracks, Speed
Arena, Recalibrate, Themes). Replace the static array with `navFor(mode)` from
`src/lib/mode/visibility.ts`:

- **Case A (course):**
  - Home · Roadmap (course-ordered) · Dashboard (course focus) · Table of
    Contents (course-grouped) · **Intro to Probability (M362K)** · **Intro to
    Stochastic Processes (M362M)** · Simulations · Recalibrate · Themes.
  - Hidden by default: Speed Arena, Fermi Drill, Interview Games, and the raw
    per-track links that don't map to a course (Mental Math shown as a
    "Foundations/prereq" item or hidden — Decision D1). Aggressiveness = D3.
- **Case B (interview):** exactly today's `navItems`.

Add the mode toggle to the header meta-bar (§1.2).

### 6.2 Course routes (Case A)

Two options; recommend **Option A** for lowest risk:

- **Option A (recommended): a `CourseTrackPage` at `/course/:courseId`**
  (`m362k` | `m362m`). It reuses the existing `TrackPage` topic-grouping
  machinery but sources its ordered topic list from `topicsInCourse(courseId)`
  (`courseMap.ts`), rendering the union of the mapped topics' levels as one
  course "route" with the existing section-divider + node map. Deep links to
  `/track/:trackId/level/:levelId` (the immersive player) are unchanged — the
  course page just curates which levels/sections are shown and in what order.
- **Option B:** reuse `/track/probability?course=m362k` with a `?course=` filter
  on `TrackPage` (like the existing `?topic=`). Lower new-surface but overloads
  TrackPage and doesn't cleanly span multiple tracks (M362M pulls from
  `probability` only, but foundations may pull `math-questions`).

Either way, ALL existing routes remain intact so Case B is unaffected, and the
lesson player, locking, mastery, and hint ladder are reused verbatim.

### 6.3 Table of Contents & Roadmap (mode-aware grouping)

- **Table of Contents** (`TableOfContentsPage` + theme `TableOfContents`): in
  Case A, group by the two courses (using `courseMap.ts`) instead of by track;
  in Case B, unchanged. The ToC theme contract already takes fully-projected
  `TocTrack[]` — we just build course-grouped `TocTrack`s from the page in
  Case A. No theme rewrite required (they render whatever tracks they're given).
- **Roadmap** (`skillGraph.ts` + `readiness.ts`): in Case A, present the pathway
  grouped/filtered by course and drop quant-only weights; in Case B, the current
  5-tier pathway. `skillGraph` already tags nodes with tiers/weights/prereqs;
  add a small course tag (or derive it via `courseForTopic`) and let the Roadmap
  page choose grouping by mode. Keep the graph data single-source.

---

## 7. Mode-aware dashboard redesign (incl. the calibration fix)

### 7.1 Design principles (both modes)

Extensive-but-intuitive, motivating, NOT a wall of metrics:

1. **One hero line + one clear next action** at the top (what to do next, and
   how close you are), not a grid of numbers.
2. **Progressive disclosure:** headline → a few focus cards → optional "details"
   accordions for power users (raw θ, Beta mean, counts, Brier).
3. **Gate low-confidence panels:** never show a statistic computed from a
   near-empty sample (this is the root of the calibration confusion, §7.3).
4. **Plain language over jargon.**

### 7.2 Mode adaptation

`DashboardViewProps` (`src/themes/types.ts`) gains `goalMode` and, for Case A,
`courses` (per-course readiness). `buildDashboardViewProps` branches on mode.

- **Case A (course focus):**
  - Two **course readiness cards** — "Intro to Probability (M362K)" and "Intro
    to Stochastic Processes (M362M)": % of course topics mastered (reuse the
    readiness math, restricted to `topicsInCourse`), the next unmastered course
    topic, and a compact per-course topic list with STRONG/WEAK/UNCERTAIN
    verdicts.
  - No market-making / timing / speed panels.
  - Calibration shown only as the gentle, gated "are you as sure as you should
    be?" panel (§7.3).
- **Case B (interview focus, ≈ today):**
  - Recommended next focus + weakness ranking (quant topics), reviews-due, and
    the calibration panel (fixed per §7.3).
  - **Timing/speed panel** shown ONLY if the learner has Speed Arena attempts
    (otherwise hidden — no empty panel). Market-making surfaced via Interview
    Games + trading-desk sims as today.

### 7.3 The calibration fix (explicit)

**Symptoms today** (`src/components/dashboard/ReliabilityDiagram.tsx` +
`src/lib/mastery/reliability.ts`, fed by an in-memory, session-only pooled log
`sessionCalibrationLog.current` via `useDashboardData`):
- "When you say ~80%, you're right 100% of the time (n=1)" — a statistic from a
  single data point.
- "Brier 0.211", "Brier gap …" — raw jargon chips.
- "over-confident" chip that can **contradict** the headline and the "below the
  line = over-confident" caption, because the chip's `lean` is a signed average
  across ALL bins while the headline reads only the ~80% bin, and with n≈1 the
  sign is noise.

**Root cause:** the panel renders as soon as `count > 0` (only the
`count === 0` empty state is guarded), on a tiny session-scoped sample, and
derives two labels from two different computations.

**Fix (mostly local to `reliability.ts` + `ReliabilityDiagram.tsx`; consumed by
all dashboards via the shared `reliability` prop):**

1. **Sufficiency gate.** Add `MIN_PAIRS` (e.g. 25 pooled) and `MIN_BIN` (e.g. 5
   in the headline ~80% bin). Extend `ReliabilityDiagramData` with
   `sufficient: boolean` + a `progressToMinimum` count. When not sufficient,
   render an encouraging progress state instead of numbers:
   > "Calibration needs a bit more data — answer ~25 confidence-rated questions
   > and we'll show how well your confidence matches your accuracy. (You're at
   > 8/25.)"
   This kills the n=1 panel outright.
2. **Single signed calibration number → both labels.** Compute ONE
   evidence-weighted signed gap `signed = Σ (nₖ/N)(confₖ − accₖ)` and derive the
   headline framing, the chip, and the caption from the SAME sign so they can
   never contradict. Add a dead-band (`|signed| < 0.02` ⇒ "well-calibrated").
3. **Plain-language framing** (replaces the Brier/relGap chips as the primary
   read):
   - `signed > band` → "You tend to be **over-confident** — you're right a bit
     less often than you feel."
   - `signed < −band` → "You tend to be **under-confident** — you're actually
     better than you think."
   - else → "You're **well-calibrated** — your confidence matches your
     accuracy."
4. **Correct + reconcile the caption.** Verify the geometry: over-confident =
   confidence > accuracy = points BELOW the diagonal; make the caption match the
   chip's derived sign exactly (fix the current standalone caption that can
   disagree).
5. **Details on demand.** Move Brier / relGap / per-bin counts behind an
   "Advanced details" accordion for power users; the default view is the single
   plain sentence + the (gated) diagram.
6. **Consider persistence (optional, D4):** the session-only log makes the
   sample tiny. Optionally persist a capped calibration log in `UserProgress`
   (additive, like `diagnosticHistory`) so the panel accrues across sessions and
   reaches sufficiency. Keep out of scope of the core fix if we prefer minimal
   change; the sufficiency gate already prevents the misleading display either
   way.

**Theme ripple:** the 6 theme dashboards (`src/themes/*/Dashboard.tsx`) plus
`BaseDashboard` all render the shared `ReliabilityDiagram` / `reliability` prop,
so fixing the shared component + adding `sufficient` covers every theme. Any
theme that inlines Brier chips gets the same accordion treatment. Mode-adaptive
sections (course cards vs weakness ranking) DO touch each theme dashboard —
scope decision D4.

---

## 8. Phased build plan (independent, parallelizable workstreams)

Dependency rule: **WS0 lands first** (everyone reads `goalMode`). WS-CAL is fully
independent and can start immediately. Content (WS-CONTENT) and the sim
(WS-SIM) are independent of the mode plumbing.

| WS | Title | Depends on | Scope / files |
|---|---|---|---|
| **WS0** | Mode state + pure module | — | `progress.ts` (`goalMode`), `migrate.ts` default, `ProgressContext` (`goalMode`/`setGoalMode`), `src/lib/mode/{goalMode,courseMap,visibility}.ts` + tests. Foundation. |
| **WS1** | Diagnostic mode step | WS0 | New first screen in `DiagnosticPage.tsx`; mandatory; both lanes; Summary copy tweaks. |
| **WS2** | Mode-aware nav + course routes | WS0 | `AppShell.tsx` `navFor(mode)`; header toggle; `CourseTrackPage` at `/course/:courseId` (Option A) in `App.tsx`. |
| **WS3** | Course grouping in ToC + Roadmap | WS0 | `TableOfContentsPage` course-grouped `TocTrack[]` (Case A); `RoadmapPage`/`skillGraph` course grouping. No theme rewrites (projected props). |
| **WS-CAL** | Calibration panel fix | — (independent) | `reliability.ts` (+`sufficient`, single signed label), `ReliabilityDiagram.tsx` (gate, plain language, details accordion, caption fix); optional persisted log (D4). |
| **WS4** | Mode-aware dashboard | WS0, WS-CAL | `DashboardViewProps` (+`goalMode`,`courses`), `buildDashboardViewProps` branch, `useDashboardData` course readiness; `BaseDashboard` + 6 theme dashboards (scope per D4). |
| **WS-CONTENT** | Case-A content additions | — (content-only) | New generators/levels: Conditional Expectation (ADD), Joint Distributions expansion (expand), optional Poisson-process depth (D5). Wire into `index.ts`, `skillGraph.ts`, `levels.test.ts`. Established pipeline. |
| **WS-SIM** | Double-integral visualization | — (content-only; nicer with WS0 to hide in Case B) | New `src/lib/simulations/jointDensity.ts` (pure math: shade region under z=f(x,y), Monte-Carlo ∫∫ estimate vs exact), new group component `components/simulations/groups/JointDensityGroup.tsx`, catalog entry in `catalog.ts` (topics: "Joint Distributions"), register in `SimulationsPage.tsx`. Visible in Case A; hidden/optional in Case B (D7). |

Suggested parallelization: **Track 1** WS0 → (WS1, WS2, WS3, WS4). **Track 2**
WS-CAL (independent, feeds WS4). **Track 3** WS-CONTENT + WS-SIM (independent,
content-only). WS4 is the integration point (needs WS0 + WS-CAL).

### 8.1 Testing / invariants to preserve
- Diagnostic `≤ 30` item guarantee untouched (mode step is non-graded).
- `migrateProgress` idempotency + v1→v2 unchanged; `goalMode` additive.
- Mastery/locking never read `goalMode` (mode is view-only) — assert in tests.
- Case B (`goalMode` undefined/"interview") is byte-for-byte the current UX.
- All content generators keep exact-solver green gates + 5-rung ladder tags.

---

## 9. Summary of the architecture

- **Mode = one optional `goalMode` field** on the existing `UserProgress` blob;
  a pure `src/lib/mode/` module projects it into nav, course grouping, feature
  visibility, gating priority, and dashboard focus.
- **Progress is shared automatically** because it's `topicKey`-keyed and mode
  holds none of it — toggling A↔B is instant and non-destructive.
- **Case A** re-groups mostly EXISTING topics into two UT course tracks (thanks
  to the UT topics already built), SURFACES the "Extra Relevant Knowledge"
  course topics, ADDs a small amount (conditional expectation; joint-dist
  expansion; optional Poisson-process depth), and adds a double-integral sim.
- **Case B** is the current app (safe default).
- **The dashboard** becomes mode-adaptive and the calibration panel is fixed by
  gating low-sample data, using one plain-language signed label, and moving
  jargon behind a details accordion.
