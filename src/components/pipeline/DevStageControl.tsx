import { useIsDeveloper } from "@/context/AuthContext";
import { useDevPipeline } from "@/context/DevPipelineContext";
import {
  nextStage,
  stageOrder,
  type Stage,
} from "@/lib/pipeline/stateMachine";
import { STAGE_REGISTRY } from "./stageRegistry";

/**
 * DevStageControl — the DEVELOPER-only skip-gating control for the guided shell
 * (a demo escape hatch, NOT a normal-user affordance).
 *
 * It renders ONLY for a developer session (`useIsDeveloper`) and drives the
 * existing pipeline state machine through the dev `forcedStage` override rather
 * than fabricating mastery data. From here a developer can:
 *   • ADVANCE to the next stage regardless of whether the gate is satisfied, and
 *   • JUMP directly to ANY stage (so every feature is demoable).
 *
 * It only calls `setForcedStage(...)`. The forced stage flows into
 * {@link devEffectiveStage}, so the route guard (`RequirePipelineStage`)
 * redirects to the target stage's screen automatically — no navigation is done
 * here. "Resume real progress" clears the override and returns the demo to the
 * live, gate-derived stage.
 *
 * Real users never see this (the flag is false) and the real gates are never
 * touched, so there is ZERO behavior change for normal accounts.
 */
export function DevStageControl({ current }: { current: Stage }) {
  const isDeveloper = useIsDeveloper();
  const { forcedStage, setForcedStage } = useDevPipeline();

  // Defense in depth: never render the bypass for a non-developer session.
  if (!isDeveloper) return null;

  const next = nextStage(current);

  return (
    <section
      data-testid="dev-stage-control"
      aria-label="Developer stage controls"
      className="border-l-4 border-accent bg-accent/5 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="label shrink-0 text-accent">
          Dev · skip gating
        </span>

        <span className="font-mono text-[11px] text-secondary">
          {forcedStage
            ? `Forced → ${STAGE_REGISTRY[forcedStage].label}`
            : "Following live gates"}
        </span>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            data-testid="dev-advance"
            className="btn-ghost !min-h-0 !px-2.5 !py-1.5 text-[11px]"
            disabled={next === null}
            title={
              next === null
                ? "Already at the final stage"
                : `Advance to ${STAGE_REGISTRY[next].label} (bypass gate)`
            }
            onClick={() => {
              if (next) setForcedStage(next);
            }}
          >
            Advance → next stage
          </button>

          <label className="flex items-center gap-1.5">
            <span className="sr-only">Jump to stage</span>
            <select
              data-testid="dev-jump"
              className="input !min-h-0 !w-auto !py-1.5 text-[11px]"
              value={forcedStage ?? current}
              onChange={(e) => setForcedStage(e.target.value as Stage)}
            >
              {stageOrder.map((stage) => (
                <option key={stage} value={stage}>
                  Jump to · {STAGE_REGISTRY[stage].label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            data-testid="dev-resume"
            className="btn-ghost !min-h-0 !px-2.5 !py-1.5 text-[11px]"
            disabled={forcedStage === null}
            title="Clear the override and follow the real gates"
            onClick={() => setForcedStage(null)}
          >
            Resume real progress
          </button>
        </div>
      </div>
    </section>
  );
}
