import { useIsDeveloper } from "@/context/AuthContext";
import { useDevPipeline } from "@/context/DevPipelineContext";
import { resetDeveloperProgress } from "@/lib/dev/devReset";

/**
 * DevResetControl — the DEVELOPER-only "Reset demo progress" control for the
 * guided shell (a demo-polish escape hatch, NOT a normal-user affordance).
 *
 * It renders ONLY for a developer session (`useIsDeveloper`), mirroring
 * {@link DevStageControl} / {@link DevKstView}. Clicking it FULLY resets the
 * developer demo:
 *   1. clears the in-memory dev `forcedStage` override (and its persisted key),
 *   2. wipes every developer-scoped localStorage key and re-seeds a clean,
 *      empty progress doc (see {@link resetDeveloperProgress}), then
 *   3. reloads to `/`, so the app re-hydrates from the wiped state and lands on
 *      the very first pipeline stage (a fresh diagnostic).
 *
 * It is idempotent and repeatable, and it never touches the dev SESSION flag
 * (you stay logged in as the developer) or any real account's data. Real users
 * never see this — the flag is false — so there is ZERO behavior change for
 * normal accounts.
 */
export function DevResetControl() {
  const isDeveloper = useIsDeveloper();
  const { setForcedStage } = useDevPipeline();

  // Defense in depth: never render the reset for a non-developer session.
  if (!isDeveloper) return null;

  const handleReset = () => {
    // Drop the in-memory override first (and clears its persisted key), then
    // wipe the developer namespace and re-seed a clean default progress doc.
    setForcedStage(null);
    resetDeveloperProgress();
    // Full reload back to the entry point so every context re-hydrates from the
    // fresh state and the router lands on the first pipeline stage.
    try {
      window.location.assign("/");
    } catch {
      /* jsdom / non-browser env — the wipe above already happened */
    }
  };

  return (
    <section
      data-testid="dev-reset-control"
      aria-label="Developer demo reset"
      className="border-l-4 border-accent bg-accent/5 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="label shrink-0 text-accent">Dev · demo reset</span>
        <span className="font-mono text-[11px] text-secondary">
          Wipe developer progress &amp; return to stage 1
        </span>
        <div className="flex flex-1 items-center justify-end">
          <button
            type="button"
            data-testid="dev-reset"
            className="btn-ghost !min-h-0 !px-2.5 !py-1.5 text-[11px]"
            title="Fully reset the developer demo (progress, forced stage) to a fresh diagnostic"
            onClick={handleReset}
          >
            Reset demo progress
          </button>
        </div>
      </div>
    </section>
  );
}
