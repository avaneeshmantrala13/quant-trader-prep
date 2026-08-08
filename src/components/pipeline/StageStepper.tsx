import { useState } from "react";
import type { PipelineStage } from "@/types/progress";
import { stageIndex, stageOrder } from "@/lib/pipeline/stateMachine";
import { STAGE_REGISTRY } from "./stageRegistry";
import { CheckIcon } from "@/components/icons";

/**
 * The compact 8-step stepper for the guided shell header (spec §2). Step 1 is
 * LOGIN (always complete once the shell renders — the user is authenticated),
 * followed by the seven in-app {@link PipelineStage}s in `stageOrder`. It is a
 * PURE, read-only projection of the current stage:
 *   • steps BEFORE the current stage → done (check),
 *   • the current stage → active (accent),
 *   • steps AFTER → upcoming (muted).
 */
export interface StageStepperProps {
  /** The live resolved stage the shell is showing. */
  current: PipelineStage;
}

type StepState = "done" | "active" | "upcoming";

interface Step {
  key: string;
  label: string;
  state: StepState;
}

/** Build the 8 steps (Login + the 7 pipeline stages) with per-step state. */
export function stepperSteps(current: PipelineStage): Step[] {
  const currentIdx = stageIndex(current);
  const login: Step = { key: "login", label: "Login", state: "done" };
  const stages: Step[] = stageOrder.map((stage, i) => ({
    key: stage,
    label: STAGE_REGISTRY[stage].label,
    state: i < currentIdx ? "done" : i === currentIdx ? "active" : "upcoming",
  }));
  return [login, ...stages];
}

export function StageStepper({ current }: StageStepperProps) {
  const steps = stepperSteps(current);
  const activeNumber = steps.findIndex((s) => s.state === "active") + 1;

  return (
    <nav
      aria-label="Pipeline progress"
      data-testid="stage-stepper"
      className="w-full"
    >
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {steps.map((step, i) => (
          <StepItem
            key={step.key}
            step={step}
            stepNumber={i + 1}
            isLast={i === steps.length - 1}
          />
        ))}
      </ol>
      {/* Screen-reader summary — the visual labels are hidden on narrow widths. */}
      <p className="sr-only">
        Stage {activeNumber} of {steps.length}:{" "}
        {steps.find((s) => s.state === "active")?.label}
      </p>
    </nav>
  );
}

/**
 * One stepper node. Future steps stay GATED + non-clickable, but every pipeline
 * step is focusable and reveals a small description popover on hover AND keyboard
 * focus (a preview of what the step is) — the copy is the stage registry's
 * `title`/`blurb`, never invented here. The tooltip is `role="tooltip"`, linked
 * via `aria-describedby`, dismissible with Escape, and drops BELOW the header so
 * it isn't clipped. Login (step 1) has no registry entry, so it carries no tip.
 */
function StepItem({
  step,
  stepNumber,
  isLast,
}: {
  step: Step;
  stepNumber: number;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = step.key === "login" ? null : STAGE_REGISTRY[step.key as PipelineStage];
  const tipId = `stage-tip-${step.key}`;

  return (
    <li
      data-step={step.key}
      data-state={step.state}
      aria-current={step.state === "active" ? "step" : undefined}
      className="relative flex items-center gap-1.5"
    >
      <span
        className={[
          "flex items-center gap-1.5 rounded-sm outline-none",
          meta ? "cursor-help focus-visible:ring-1 focus-visible:ring-accent" : "",
        ].join(" ")}
        tabIndex={meta ? 0 : undefined}
        aria-describedby={meta ? tipId : undefined}
        onMouseEnter={meta ? () => setOpen(true) : undefined}
        onMouseLeave={meta ? () => setOpen(false) : undefined}
        onFocus={meta ? () => setOpen(true) : undefined}
        onBlur={meta ? () => setOpen(false) : undefined}
        onKeyDown={
          meta
            ? (e) => {
                if (e.key === "Escape") setOpen(false);
              }
            : undefined
        }
      >
        <span
          className={[
            "num grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold leading-none transition-colors",
            step.state === "done"
              ? "border-accent bg-accent text-accent-contrast"
              : step.state === "active"
                ? "border-accent bg-accent/10 text-accent ring-1 ring-accent/40"
                : "border-subtle text-muted",
          ].join(" ")}
        >
          {step.state === "done" ? (
            <CheckIcon width={11} height={11} aria-hidden="true" />
          ) : (
            stepNumber
          )}
        </span>
        <span
          className={[
            "hidden text-[10px] font-mono uppercase tracking-label sm:inline",
            step.state === "active"
              ? "font-semibold text-primary"
              : step.state === "done"
                ? "text-secondary"
                : "text-muted",
          ].join(" ")}
        >
          {step.label}
        </span>
      </span>

      {meta && (
        <span
          role="tooltip"
          id={tipId}
          className={[
            "panel absolute left-0 top-full z-50 mt-2 block w-56 space-y-1 p-3 text-left",
            "transition-opacity duration-150",
            open ? "visible opacity-100" : "invisible opacity-0",
          ].join(" ")}
        >
          <span className="label block text-accent">{meta.title}</span>
          <span className="block text-[11px] leading-snug text-secondary">
            {meta.blurb}
          </span>
        </span>
      )}

      {!isLast && (
        <span aria-hidden="true" className="mx-0.5 h-px w-3 bg-subtle sm:w-4" />
      )}
    </li>
  );
}
