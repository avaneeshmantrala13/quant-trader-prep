import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { PipelineStage } from "@/types/progress";
import { stageOrder } from "@/lib/pipeline/stateMachine";

/**
 * ============================================================================
 *  GUIDED PIPELINE — STAGE-COMPONENT CONTRACT + REGISTRY  (Phase P1)
 * ============================================================================
 *
 * This is the single table the guided shell renders against: it maps every
 * {@link PipelineStage} to a lazy stage component. The stage screens themselves
 * are owned by later phases; until each lands, its slot holds a clear
 * placeholder ("This stage is coming soon"), so the registry is COMPLETE and
 * testable from P1 onward — every stage resolves to a component today.
 *
 * ── THE STAGE-COMPONENT CONTRACT (what P3/P4/P5/P6/P7 implement) ─────────────
 * A stage screen is a self-contained React component that renders the stage's
 * ONE task (spec §2) and calls `onComplete(result?)` exactly once, when the
 * user finishes that task. It owns NO navigation — the stage router
 * (`RequirePipelineStage`) decides what to show next; the stage only reports
 * that it is done. It receives no other props: everything it needs (mastery,
 * timers, question banks) it reads from the existing contexts/engines directly.
 *
 *     type StageComponent =
 *       (props: { onComplete: (result?: unknown) => void }) => JSX.Element;
 *
 * `result` is stage-specific and OPTIONAL — the shell forwards it to whatever
 * persists pipeline progress (a later phase). A stage that has nothing to hand
 * back simply calls `onComplete()`.
 *
 * ── HOW A LATER PHASE PLUGS IN ITS REAL SCREEN ──────────────────────────────
 * Build the component at the stage's `plannedPath` below with the
 * {@link StageComponent} signature, then replace that stage's registry entry's
 * `Component` with `lazy(() => import("<plannedPath>"))` and flip `placeholder`
 * to `false`. Nothing else in the shell changes — it already renders the lazy
 * component inside a Suspense boundary.
 */

/** Result payload a stage may hand back on completion (stage-specific). */
export type StageResult = unknown;

/** Props every stage screen receives (the whole contract — see file header). */
export interface StageComponentProps {
  /** Call once when the stage's ONE task is finished. */
  onComplete: (result?: StageResult) => void;
}

/** A guided-pipeline stage screen. */
export type StageComponent = ComponentType<StageComponentProps>;

/** Registry row: the lazy component + the copy + build-ownership metadata. */
export interface StageMeta {
  stage: PipelineStage;
  /** Short label for the compact 8-step stepper. */
  label: string;
  /** Headline shown above the stage in the "Your Next Task" area. */
  title: string;
  /** One-line description of the stage's ONE action. */
  blurb: string;
  /** The lazy stage component (a placeholder until the owning phase lands). */
  Component: LazyExoticComponent<StageComponent>;
  /** True while this slot is the coming-soon placeholder (not the real screen). */
  placeholder: boolean;
  /** Agreed path the owning phase drops the REAL component at. */
  plannedPath: string;
  /** The build phase that owns the real screen. */
  ownedBy: string;
}

/** Static per-stage copy + build-ownership plan (order matches `stageOrder`). */
const STAGE_PLAN: Record<
  PipelineStage,
  Pick<StageMeta, "label" | "title" | "blurb" | "plannedPath" | "ownedBy">
> = {
  "diagnostic-untimed": {
    label: "Untimed",
    title: "Untimed diagnostic",
    blurb:
      "Answer ~100 free-response questions at your own pace to map your starting level across every topic.",
    plannedPath: "src/components/pipeline/stages/UntimedDiagnosticStage.tsx",
    ownedBy: "P3",
  },
  "diagnostic-timed": {
    label: "Timed",
    title: "Timed diagnostic",
    blurb:
      "30 questions in 45 minutes — this measures the speed of your correct thinking under the clock.",
    plannedPath: "src/components/pipeline/stages/TimedDiagnosticStage.tsx",
    ownedBy: "P4",
  },
  "game-oa": {
    label: "Game-OA",
    title: "Trading-intuition games",
    blurb:
      "Play a battery of market & cognitive games to gauge your trading intuition.",
    plannedPath: "src/components/pipeline/stages/GameOaStage.tsx",
    ownedBy: "P5",
  },
  diagnosis: {
    label: "Diagnosis",
    title: "Your diagnosis",
    blurb:
      "Review your ranked weakest→strongest topics across the four metrics and your drill plan.",
    plannedPath: "src/components/pipeline/stages/DiagnosisStage.tsx",
    ownedBy: "P6",
  },
  drilling: {
    label: "Drilling",
    title: "Drill your weakest topic",
    blurb:
      "Work weakest-first with the hint ladder until every topic clears its mastery bar.",
    plannedPath: "src/components/pipeline/stages/DrillingStage.tsx",
    ownedBy: "P6",
  },
  mock: {
    label: "Mock",
    title: "Mock interview",
    blurb:
      "Pass 3 consecutive firm-style mock interviews at ≥90% accuracy.",
    plannedPath: "src/components/pipeline/stages/MockStage.tsx",
    ownedBy: "P7",
  },
  greenlight: {
    label: "Greenlight",
    title: "You're ready to apply",
    blurb:
      "You've cleared every gate — you're greenlit to apply to quant firms.",
    plannedPath: "src/components/pipeline/stages/GreenlightStage.tsx",
    ownedBy: "P7",
  },
};

/**
 * Build the lazy placeholder for a stage: a real {@link StageComponent} that
 * wraps the shared `ComingSoonStage` with this stage's copy. Kept lazy (like the
 * real screens will be) so the shell's Suspense path is identical today and
 * after cutover, and so swapping in a real screen is a one-line change.
 */
function comingSoon(
  stage: PipelineStage,
  title: string,
  blurb: string,
): LazyExoticComponent<StageComponent> {
  return lazy(async () => {
    const { ComingSoonStage } = await import("./stages/ComingSoonStage");
    const Placeholder: StageComponent = ({ onComplete }) => (
      <ComingSoonStage
        stage={stage}
        title={title}
        blurb={blurb}
        onComplete={onComplete}
      />
    );
    return { default: Placeholder };
  });
}

/**
 * Real stage screens that have landed. Each maps a {@link PipelineStage} to its
 * lazy component at the agreed `plannedPath`. Stages absent here still render the
 * coming-soon placeholder. Adding a row here is the entire "plug in" step.
 */
const REAL_STAGES: Partial<
  Record<PipelineStage, LazyExoticComponent<StageComponent>>
> = {
  "diagnostic-untimed": lazy(() =>
    import("./stages/UntimedDiagnosticStage").then((m) => ({
      default: m.UntimedDiagnosticStage,
    })),
  ),
  "diagnostic-timed": lazy(() => import("./stages/TimedDiagnosticStage")),
  "game-oa": lazy(() => import("./stages/GameOaStage")),
  diagnosis: lazy(() => import("./stages/DiagnosisStage")),
  drilling: lazy(() => import("./stages/DrillingStage")),
  mock: lazy(() => import("./stages/MockStage")),
  greenlight: lazy(() => import("./stages/GreenlightStage")),
};

/**
 * THE registry: every {@link PipelineStage} → its {@link StageMeta}. Complete by
 * construction (built from `stageOrder`), so the "every stage resolves to a
 * component" invariant holds and is unit-tested.
 */
export const STAGE_REGISTRY: Record<PipelineStage, StageMeta> = Object.fromEntries(
  stageOrder.map((stage) => {
    const plan = STAGE_PLAN[stage];
    const real = REAL_STAGES[stage];
    return [
      stage,
      {
        stage,
        ...plan,
        Component: real ?? comingSoon(stage, plan.title, plan.blurb),
        placeholder: real == null,
      } satisfies StageMeta,
    ];
  }),
) as Record<PipelineStage, StageMeta>;

/** Resolve one stage's registry entry (always defined — registry is complete). */
export function stageMetaFor(stage: PipelineStage): StageMeta {
  return STAGE_REGISTRY[stage];
}

/** Every stage entry in canonical `stageOrder` (for the stepper / audits). */
export function allStageMeta(): StageMeta[] {
  return stageOrder.map((s) => STAGE_REGISTRY[s]);
}
