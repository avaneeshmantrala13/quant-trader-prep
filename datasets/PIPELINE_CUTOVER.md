# Guided-Pipeline Cutover Runbook

**Status:** PREPARED (not executed). This is the exact, ordered checklist the
**integration phase** runs to flip the app from the free-roam shell to the
guided pipeline. Phase **P1** built everything below but left it DORMANT to
avoid a broken interim UX (the real stage screens don't exist yet). Nothing in
this runbook is done automatically — a human/agent runs it once P3–P7 have
landed real stage screens.

> Guiding rule (spec §7.3): **UI-only strip-down.** Never delete engine, page,
> lib, or content files. The free-roam route/page files stay importable because
> stage screens reuse them internally (the lesson player by the drilling loop,
> the mock runner by Stage 7, the MM engine by Stage 4, the timed-OA engine by
> Stage 3, etc.). We only stop advertising/mounting them as user navigation.

---

## 0. Preconditions (must ALL be true before cutover)

- [ ] Every `PipelineStage` has a REAL screen registered in
      `src/components/pipeline/stageRegistry.tsx` (each `placeholder: false`),
      built at its `plannedPath` with the documented `StageComponent` contract
      (`(props: { onComplete }) => JSX.Element`).
      - P3 → `stages/UntimedDiagnosticStage.tsx`
      - P4 → `stages/TimedDiagnosticStage.tsx`
      - P5 → `stages/GameOaStage.tsx`
      - P6 → `stages/DiagnosisStage.tsx`, `stages/DrillingStage.tsx`
      - P7 → `stages/MockStage.tsx`, `stages/GreenlightStage.tsx`
- [ ] The stage-completion wiring exists: a `ProgressContext` writer that
      stamps the stage's `*At` marker / appends its per-run result and lets
      `resolveStage` advance (mirrors the `diagnosticDoneAt` pattern). The
      `GuidedShell.onStageComplete(stage, result)` hook is wired to it.
- [ ] `npx tsc --noEmit`, `npx vitest run`, and `npm run build` are all green.

---

## 1. Flip the master flag

- [ ] In `src/components/pipeline/RequirePipelineStage.tsx` set
      `export const PIPELINE_ENABLED = true;`
      - This alone makes `RequirePipelineStage` an ACTIVE guard (it stops being a
        pass-through) and re-enables the `/pipeline` route block in `App.tsx`.

## 2. Mount the guided shell as the sole navigation authority

- [ ] In `src/App.tsx`, add the pipeline stage routes (one per `STAGE_PATH` entry
      in `RequirePipelineStage.tsx`), each wrapped in
      `ProtectedRoute → RequirePipelineStage stage={…}` and rendering the
      `GuidedShell` (the shell reads the live stage; the guard redirects any
      mismatched stage to the resolved one):

      ```tsx
      <Route
        path="/pipeline/untimed"
        element={
          <ProtectedRoute>
            <RequirePipelineStage stage="diagnostic-untimed">
              <GuidedShell />
            </RequirePipelineStage>
          </ProtectedRoute>
        }
      />
      // …one per stage, using STAGE_PATH from RequirePipelineStage.tsx
      ```

- [ ] Change the authenticated landing behavior so a signed-in, past-login user
      is routed to `STAGE_PATH[resolveStage(progress)]` (the guided flow),
      instead of the free-roam Home/AppShell.

## 3. Hide the free-roam routes (keep files importable)

- [ ] Remove (or guard behind `!PIPELINE_ENABLED`) the free-roam `<Route>`s in
      `App.tsx` for every base in `GUIDED_HIDDEN_ROUTES`
      (`src/lib/mode/visibility.ts`). Do **not** delete the page modules — they
      stay lazy-importable so stage screens can reuse them.
- [ ] Swap the shell nav source: use `guidedNavFor(mode)` (returns `[]` — no
      free-roam menu) instead of `navFor(mode)`. The stepper + Progress panel
      replace the menu entirely.
- [ ] Keep exactly `GUIDED_KEPT_ROUTES` reachable: `/`, `/login`, `/pipeline/*`.
      The `<Route path="*">` catch-all should redirect to the resolved stage.

## 4. Fold the onboarding + free-roam gate

- [ ] `RequireDiagnostic` / `shouldRedirectToDiagnostic` become subsumed by the
      stage router (the untimed diagnostic is Stage 2). Leave the diagnostic
      engine/pages importable; just stop force-routing to `/diagnostic`.

## 5. Verify

- [ ] `npx tsc --noEmit` → 0 errors.
- [ ] `npx vitest run` → all green (update any route/nav tests that assumed the
      free-roam shell was live).
- [ ] `npm run build` → success.
- [ ] Manual smoke: login → lands on the resolved stage; the stepper shows the
      right step; the Progress panel reads live mastery; Sign out + light/dark
      toggle work; no free-roam route is reachable by URL (each redirects to the
      resolved stage).

---

## What P1 already shipped (so this runbook is short)

- Themes stripped to the single locked **minimalist** theme; the `/themes`
  gallery + named-theme switcher removed; a working **light/dark toggle** kept
  (`ThemeContext`).
- `GuidedShell` + `ProgressPanel` + `StageStepper` built under
  `src/components/pipeline/`.
- `stageRegistry.tsx`: every `PipelineStage` → a lazy stage component (all
  placeholders today) + the documented `StageComponent` contract.
- `visibility.ts`: additive `guidedNavFor`, `GUIDED_HIDDEN_ROUTES`,
  `GUIDED_KEPT_ROUTES` (the exact hide/keep sets this runbook uses).
- `PIPELINE_ENABLED` remains `false`; `App.tsx` routing unchanged except the
  removed (deleted) `/themes` route.
