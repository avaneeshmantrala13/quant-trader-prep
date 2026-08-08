import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { userScopedKey } from "@/lib/userScope";
import { isValidStage } from "@/lib/dev/devStage";
import type { Stage } from "@/lib/pipeline/stateMachine";

/**
 * DevPipelineContext — the DEVELOPER-only "forced stage" override for the guided
 * pipeline (a demo escape hatch).
 *
 * It holds a single optional `forcedStage`. When a developer sets it, the nav
 * authorities (`RequirePipelineStage`, `HomeRoute`, `GuidedShell`) treat that as
 * the effective stage via {@link devEffectiveStage}, so the demo can jump to /
 * advance past ANY stage without satisfying the real gates. It is PERSISTED
 * under the dev user's own namespace ({@link userScopedKey}) so a jumped-to
 * stage survives a reload (the route guard would otherwise bounce back to the
 * gate-derived stage).
 *
 * SAFETY: the value is forced to `null` whenever the session is not a developer,
 * so a normal account is byte-for-byte unaffected. The default context value
 * (no provider) is also inert, so components render unchanged in isolation.
 */

interface DevPipelineValue {
  /** The dev-forced stage, or `null` to follow the live gate-derived stage. */
  forcedStage: Stage | null;
  /** Set (or clear, with `null`) the dev-forced stage. No-op for non-devs. */
  setForcedStage: (stage: Stage | null) => void;
}

const DevPipelineContext = createContext<DevPipelineValue>({
  forcedStage: null,
  setForcedStage: () => {},
});

/** Base localStorage key; scoped per (dev) user via {@link userScopedKey}. */
const FORCED_STAGE_BASE = "qtp.dev.forcedStage";

export function DevPipelineProvider({ children }: { children: ReactNode }) {
  const { username, isDeveloper } = useAuth();
  const [forcedStage, setForcedStageState] = useState<Stage | null>(null);

  // Hydrate the persisted override for the active DEV user. Non-devs never read
  // it (and it is cleared below), so this has zero effect for real accounts.
  useEffect(() => {
    if (!isDeveloper) {
      setForcedStageState(null);
      return;
    }
    try {
      const raw = localStorage.getItem(userScopedKey(FORCED_STAGE_BASE, username));
      setForcedStageState(isValidStage(raw) ? raw : null);
    } catch {
      setForcedStageState(null);
    }
  }, [isDeveloper, username]);

  const setForcedStage = useCallback(
    (stage: Stage | null) => {
      setForcedStageState(stage);
      try {
        const key = userScopedKey(FORCED_STAGE_BASE, username);
        if (stage) localStorage.setItem(key, stage);
        else localStorage.removeItem(key);
      } catch {
        /* storage unavailable — the in-memory override still works this session */
      }
    },
    [username],
  );

  // Hard guard: a non-developer session NEVER exposes a forced stage, so the
  // bypass is impossible to reach without `isDeveloper`.
  const value = useMemo<DevPipelineValue>(
    () => ({ forcedStage: isDeveloper ? forcedStage : null, setForcedStage }),
    [isDeveloper, forcedStage, setForcedStage],
  );

  return (
    <DevPipelineContext.Provider value={value}>
      {children}
    </DevPipelineContext.Provider>
  );
}

export function useDevPipeline(): DevPipelineValue {
  return useContext(DevPipelineContext);
}
