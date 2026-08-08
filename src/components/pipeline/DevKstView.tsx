import { useEffect, useState } from "react";
import { useIsDeveloper } from "@/context/AuthContext";
import { useRoadmapData } from "@/components/roadmap/useRoadmapData";
import { SkillGraph } from "@/components/roadmap/SkillGraph";
import { ChartIcon, CloseIcon } from "@/components/icons";

/**
 * DevKstView — a DEVELOPER-only viewer for the Knowledge State Tree (a live demo
 * aid, NOT a normal-user affordance).
 *
 * It REUSES the existing roadmap graph verbatim: the Sugiyama-laid-out
 * {@link SkillGraph} (`graphLayout.ts` + `skillGraph.ts`) fed by
 * {@link useRoadmapData}, so nodes are coloured/labelled by the CURRENT
 * (developer) user's live mastery verdicts — mastered / in-progress / ready /
 * locked — with prerequisite edges and a "you are here" ring. The graph is
 * opened on demand in a modal overlay from the guided shell.
 *
 * GATING: renders NOTHING unless the session is a developer (`useIsDeveloper`),
 * mirroring `DevStageControl`. There is no route and no other entry point, so a
 * normal user can neither see nor reach it. Node clicks are a no-op here (the
 * free-roam routes are unmounted in the guided pipeline) — the view is for
 * pointing at prereqs / the weak topic during a demo, not navigation.
 */
export function DevKstView() {
  const isDeveloper = useIsDeveloper();
  const [open, setOpen] = useState(false);

  // Gate AFTER the hooks so hook order stays stable; a non-dev renders nothing.
  if (!isDeveloper) return null;

  return (
    <section
      data-testid="dev-kst-view"
      aria-label="Developer knowledge-state tree"
      className="border-l-4 border-accent bg-accent/5 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="label shrink-0 text-accent">Dev · knowledge state</span>
        <span className="font-mono text-[11px] text-secondary">
          Live KST for the current user's mastery
        </span>
        <div className="flex flex-1 items-center justify-end">
          <button
            type="button"
            data-testid="dev-kst-open"
            className="btn-ghost !min-h-0 gap-1.5 !px-2.5 !py-1.5 text-[11px]"
            onClick={() => setOpen(true)}
          >
            <ChartIcon width={13} height={13} />
            View knowledge-state tree
          </button>
        </div>
      </div>

      {open && <DevKstModal onClose={() => setOpen(false)} />}
    </section>
  );
}

/**
 * The modal overlay. Split out so {@link useRoadmapData} (and the graph) are
 * only mounted while the tree is actually open — a developer viewing the demo,
 * never a closed panel or a non-developer.
 */
function DevKstModal({ onClose }: { onClose: () => void }) {
  const model = useRoadmapData();

  // Escape closes the overlay (standard dialog affordance).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Knowledge State Tree (developer view)"
      data-testid="dev-kst-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      {/* Backdrop — click to dismiss. */}
      <div
        className="absolute inset-0 bg-black/60"
        aria-hidden="true"
        onClick={onClose}
      />

      <div className="panel relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden p-0">
        <header className="flex items-center justify-between gap-3 border-b border-subtle bg-surface px-5 py-3">
          <div className="min-w-0">
            <span className="label text-accent">Dev · Knowledge State Tree</span>
            <h2 className="font-display text-lg font-semibold text-primary">
              Live KST — {model.state.masteredCount}/{model.state.totalCount}{" "}
              mastered · {model.state.overallReadiness}% ready
            </h2>
          </div>
          <button
            type="button"
            data-testid="dev-kst-close"
            className="btn-ghost !min-h-0 gap-1.5 !px-2 !py-1.5"
            aria-label="Close knowledge-state tree"
            onClick={onClose}
          >
            <CloseIcon width={16} height={16} />
            <span className="label hidden text-[9px] sm:inline">Close</span>
          </button>
        </header>

        <div className="overflow-auto p-5">
          <SkillGraph
            rows={model.rows}
            currentKey={model.state.currentSkillKey}
            // Node clicks would deep-link into free-roam routes that are
            // unmounted under the guided pipeline; keep the demo view inert.
            onNavigate={() => {}}
            ariaLabel="Developer knowledge state graph (live mastery)"
          />
        </div>
      </div>
    </div>
  );
}
