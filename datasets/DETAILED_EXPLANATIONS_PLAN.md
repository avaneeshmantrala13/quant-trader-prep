# Detailed Explanations — Plan & Provenance

Program: repurpose the redundant second button on the lesson-intro / worked-example
screen into a genuinely useful **"Explain in more detail"** deep-dive, for every
path, level, and tab. **Accuracy above all.**

## Step 1 — Root cause (confirmed)

The lesson-intro screen shown before a level's questions is rendered by:

- `src/components/tutor/TutorController.tsx` → `WorkedExample` (quiz/numeric,
  low-θ learners) or `FadedSteps` (transition). This is the screenshot's
  MGF worked-example screen (cyberpunk theme).
- `src/pages/LessonPage.tsx` → `LessonIntro` (flashcard/brainteaser briefing).

Both worked-example components had two footer buttons where the **second button
fell through to the same handler** as the first:

- `WorkedExample` / `FadedSteps`: `onClick={onSkip ?? onContinue}` — and
  `TutorController` never passed `onSkip`, so both buttons called `onStart`.
- `LessonIntro`: literally `<button onClick={onStart}>` on both.

⇒ Confirmed: both bottom buttons took you straight into the questions. The
second button was redundant in every level of every tab, because the intro
rendering is **shared** (themes are 100% token-driven — there is no per-theme
intro component; `src/themes/*` only supply tokens, illustrations, and
whole-page ToC/Dashboard renderers). One shared fix therefore covers all 6
themes, light + dark.

## Step 1 — Audit of ALL two-button footers

IN SCOPE (redundant — both buttons did the same thing → fixed):

| Component | File | Was | Now |
|---|---|---|---|
| `WorkedExample` | `components/tutor/WorkedExample.tsx` | Start / Skip (both → quiz) | Start / **Explain in more detail** (toggles deep dive) |
| `FadedSteps` | `components/tutor/FadedSteps.tsx` | Start / Skip (both → quiz) | Start / **Explain in more detail** |
| `LessonIntro` | `pages/LessonPage.tsx` | Start / Skip (both → cards) | Start / **Explain in more detail** |

OUT OF SCOPE (genuinely distinct actions — left intact):

- Flashcard `FlashCard`: "Got it ✓" vs "Give me another ↻" (self-assessment vs new instance).
- `FlashDone` / `Summary` / `NumericSummary`: "Continue/Re-run" vs "Back to Route".
- `QuizPractice` / `NumericPractice`: "Generate another" vs "✨ Fresh variant" (AI).
- `RemediationFlow`, `HintLadder`: single/step-wise distinct actions.
- Non-lesson screens with distinct buttons: `FermiPage` (Start; Estimate Again/Back),
  `DiagnosticPage`, `ArenaRunner`, `PresetPicker`, simulation `groups/*`
  ("Run again"/preset pickers), `OnboardingTour`, `LandingPage`, `ThemesPage`,
  theme Dashboards, `ReviewsDue`.

## Step 2 — UX design

Cleanest pattern: **inline expandable "Explain in more detail" panel** (no new
route). The PRIMARY button still proceeds into the questions (skip-straight-in is
always available for power users). The SECONDARY button toggles a
`DeepDivePanel` beneath the worked example; the panel itself ends with a
"Start the questions ▸" CTA so a learner who opened it can proceed.

Token-themed only (`panel`, `label`, `chip`, `btn-*`, `text-*`, `border-*`,
`bg-surface*`, `accent`) → renders in all 6 themes, light+dark, AA; the toggle
uses `aria-expanded` + `aria-controls`.

## Step 2 — Content model (additive, back-compatible)

`src/types/content.ts`: new optional `DeepDive` on `LessonContent.deepDive`:

```ts
interface DeepDive { whyItWorks?: string; approach?: string[]; pitfalls?: string[]; }
```

**Accuracy contract:** `deepDive` fields are CONCEPTUAL framing only (mental
model, general method, pitfalls in words). They MUST NOT restate concrete
numeric results. Every concrete number in the panel comes from the level's OWN
solver output:

- worked **steps** = `deriveWorkedSteps(sample.explanation)` (already used by the
  worked example),
- **answer** = the solver's exact answer,
- solver **pitfalls** = the WRONG-option `distractorRationale` (quiz) or
  `commonErrors[].feedback` (numeric).

Composition is a pure, unit-tested function `src/lib/tutor/deepDive.ts`
(`buildDeepDive`), rendered by `src/components/tutor/DeepDivePanel.tsx`.

**Fallback:** with NO authored `deepDive`, a quiz/numeric level still yields a
complete, accurate panel (key idea + worked steps + solver pitfalls). Authored
content only enriches it. ⇒ 100% coverage by construction; authoring adds the
conceptual "why/method/traps" layer per level.

## Step 3 — Per-tab authoring assignments (DISJOINT file ownership)

Only the coordinator edits shared files. Each authoring worker owns its listed
`levels.ts` files exclusively and adds `lesson.deepDive` to each level, grounded
in that folder's `generators.ts` / solver.

- **A** — Core Probability (`probability/levels.ts`), Combinatorial Analysis.
- **B** — Conditional Probability, Geometric Probability, Expected Value.
- **C** — Poisson, Betting & Sizing, Order Statistics, Continuous Distributions, Variance/Covariance & CLT.
- **D** — Markov Chains, Brownian Motion, Game Theory, Game Puzzle.
- **E** — Extra Relevant Knowledge (MGF, Gamma, Joint, Branching, CTMC, Limit Theorems, Markov Structure).
- **F** — Applied Math & Number Puzzles (`mathQuestions`), Mental Math.
- **G** — Brainteasers, Interview Games (incl. trading drills + Fermi).

## Step 4 — Independent accuracy review (mandatory)

A separate review pass re-derives / spot-checks EVERY authored `deepDive`
against the level's solver: math correctness, correct terminology, no misleading
simplifications, beginner-appropriate. Anything flagged is fixed before ship.
Backed by unit tests (`deepDive.test.ts`) asserting the panel is solver-grounded.

## Verification gates (serialized)

`npx tsc -b --noEmit` (after deleting tsbuildinfo) · `npx vite build` ·
`VITE_AI_LAYER=on VITE_AI_STUB=on npx vite build` · `npx vitest run`.
Baseline: tsc green · builds green · **114 files / 1604 tests** green.
