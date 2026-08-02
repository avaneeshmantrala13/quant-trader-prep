import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { storage } from "@/lib/storage";
import {
  bumpStreakInPlace,
  completeFlashcardLevelInPlace,
  FLASHCARD_MASTERY_XP,
  getUnderstood as getUnderstoodOp,
  markUnderstoodInPlace,
} from "@/lib/progressOps";
import {
  emptyProgress,
  type DiagnosticResult,
  type GoalMode,
  type LevelProgress,
  type ResumeState,
  type UserProgress,
} from "@/types/progress";
import {
  appendOaResult,
  clearActiveSession,
  putActiveSession,
} from "@/lib/oa/store";
import type { OaSessionResult, OaSessionState } from "@/lib/oa/types";
import { appendPersistedPair } from "@/lib/calibration/persistedLog";
import { recordCalibrationPair as recordSessionCalibrationPair } from "@/lib/calibration/sessionLog";
import { appendDiagnosticResult } from "@/lib/diagnostic/history";
import type { ItemAttempt, TopicMastery } from "@/types/mastery";
import { migrateProgress } from "@/lib/mastery/migrate";
import { migrateErkSplit } from "@/lib/mastery/migrateErkSplit";
import { markOnboardingTourDoneInPlace } from "@/lib/onboarding/tour";
import {
  applyDiagnosticSeed,
  applyItemAttempt,
  applyReviewSchedule,
} from "@/lib/mastery/mastery";
import { deriveVerdict, type TopicVerdict } from "@/lib/mastery/verdict";
import { tierDifficultyKey, tierExposureKey } from "@/lib/mastery/topicKey";
import { useAuth } from "./AuthContext";

interface ProgressContextValue {
  progress: UserProgress;
  getLevelProgress: (levelId: string) => LevelProgress | undefined;
  getResume: (levelId: string) => ResumeState | undefined;
  saveResume: (state: ResumeState) => void;
  clearResume: (levelId: string) => void;
  /**
   * Record a finished level attempt; updates mastery, xp, and streak.
   *
   * `scoreFraction` is the CREDIT-WEIGHTED VISIBLE score (mean of per-item
   * hint-credit) — it is stored as `bestScore` (what the map/summary show) and
   * drives `xpGained`. The pass/advance/unlock decision instead uses the
   * optional lenient `gateFraction` (the binary "ultimately correct" fraction),
   * so using hints lowers the displayed % but can NEVER bounce a learner below
   * the pass bar. Back-compat: when `gateFraction` is omitted the gate falls
   * back to `scoreFraction`, preserving the original behavior for other callers.
   */
  recordAttempt: (
    levelId: string,
    scoreFraction: number,
    masteryThreshold: number,
    gateFraction?: number,
  ) => { mastered: boolean; xpGained: number; isNewMastery: boolean };
  // ---- flashcard (integrity-based) levels ----
  /** The set of problem ids marked "Got it" for a flashcard level. */
  getUnderstood: (levelId: string) => string[];
  /** Persist that a specific flashcard problem was marked "Got it". */
  markUnderstood: (levelId: string, problemId: string) => void;
  /**
   * Master a flashcard level (both completion paths: all cards marked, or the
   * explicit "I understand this topic" button). Updates mastery, xp, streak.
   */
  completeFlashcardLevel: (
    levelId: string,
  ) => { isNewMastery: boolean; xpGained: number };
  // ---- Phase 1: mastery & calibration (COORDINATION §2.3) ----
  /**
   * Fold ONE graded item into topic mastery + tier difficulty. Additive and
   * INDEPENDENT of `recordAttempt` — it never touches `LevelProgress.mastered`
   * (the unlock gate). Pure logic lives in `src/lib/mastery`.
   */
  recordItemAttempt: (a: ItemAttempt) => void;
  /** Read the current (possibly undefined) mastery for a topic. */
  getTopicMastery: (topicKey: string) => TopicMastery | undefined;
  /** Derived, calibration-aware verdict for the dashboard/adaptivity (Phase 5). */
  getTopicVerdict: (topicKey: string) => TopicVerdict;
  /**
   * Persist the SM-2 spaced-review schedule for a topic (COORDINATION §2.1
   * `reviewDue`/`reviewStep`). Additive integration seam: Phase 4's climb-back /
   * Phase 5's scheduler compute the next `{reviewDue, reviewStep}` (single owner:
   * `scheduleReview` in `src/lib/remediation/climbBack.ts`) and persist it here.
   * Creates a fresh TopicMastery entry when absent; NEVER touches `recordAttempt`,
   * `recordItemAttempt`, `LevelProgress.mastered`, or the v1→v2 migration.
   */
  setReviewSchedule: (
    topicKey: string,
    reviewDue: string,
    reviewStep: number,
  ) => void;
  /**
   * Phase 3 (diagnostic) seed writer. OVERWRITES per-topic priors from a
   * completed diagnostic run (via Phase-1 `applyDiagnosticSeed`) and stamps
   * `diagnosticDoneAt`. An empty `seeds` array records a SKIP (timestamp only,
   * nothing seeded). NEVER touches `LevelProgress.mastered` / locking — the
   * diagnostic is non-scoring and non-gating (PHASE_3 §5/§7).
   */
  applyDiagnosticSeeds: (seeds: DiagnosticSeed[], at?: string) => void;
  /**
   * Append ONE completed diagnostic attempt to the additive `diagnosticHistory`
   * (powers the Recalibrate improvement graph). Independent of
   * `applyDiagnosticSeeds`: it never touches per-topic mastery, seeds, scoring,
   * `LevelProgress.mastered`, locking, or the v1→v2 migration. Initializes the
   * array when absent and appends immutably (capped) via `appendDiagnosticResult`.
   */
  recordDiagnosticResult: (result: DiagnosticResult) => void;
  /**
   * Stamp the additive `onboardingTourDoneAt` UI flag so the new-user
   * onboarding tour "shows once". Purely additive (mirrors the diagnostic
   * stamp): NEVER touches `recordAttempt`, `recordItemAttempt`,
   * `LevelProgress.mastered`, locking, scoring, or the v1→v2 migration.
   */
  markOnboardingTourDone: (at?: string) => void;
  /**
   * Set the user-selected Goal Mode (Case A "course" | Case B "interview"). A
   * pure VIEW selector: it ONLY rewrites `goalMode` and NEVER touches mastery,
   * levels, streak, xp, locking, scoring, or the v1→v2 migration — so toggling
   * A↔B is instant and non-destructive (progress carries over by construction).
   */
  setGoalMode: (mode: GoalMode) => void;
  /**
   * Log ONE graded item's (predicted, outcome) calibration pair. Persists it to
   * the capped, additive `calibrationLog` (so the reliability panel accrues
   * ACROSS sessions) and mirrors it into the in-memory session log. Additive and
   * INDEPENDENT of mastery/scoring/locking — never gates content.
   */
  recordCalibrationPair: (
    topicKey: string,
    pred: number,
    outcome: 0 | 1,
  ) => void;
  // ---- Timed OA (Case B) persistence (src/lib/oa) ----
  /**
   * Persist (or overwrite) the single in-progress Timed OA session as the
   * store's `active`, preserving completed `results`. Reload-proof: the session
   * carries absolute epoch-ms deadlines, so exiting/reloading/re-login resumes
   * it exactly. Additive & INDEPENDENT of mastery/scoring/locking — the OA store
   * NEVER gates content or affects the v1→v2 migration.
   */
  saveOaSession: (session: OaSessionState) => void;
  /**
   * Clear the in-progress Timed OA `active` session (e.g. on abandon), keeping
   * completed `results`. Additive & independent of mastery/scoring/locking.
   */
  clearOaActiveSession: () => void;
  /**
   * Record a completed Timed OA `result` into the capped history AND clear the
   * `active` session in one step (finishing a session ends the resumable one, per
   * `appendOaResult`). Additive & independent of mastery/scoring/locking.
   */
  recordOaResult: (result: OaSessionResult) => void;
}

/**
 * Minimal per-topic seed shape written by Phase 3. Kept structural (not an
 * import of the Phase-3 module) so this Phase-1-owned context has no dependency
 * on `src/lib/diagnostic`; it mirrors `TopicSeed` there.
 */
export interface DiagnosticSeed {
  topicKey: string;
  successes: number;
  failures: number;
  thetaSeed?: number;
  /** Namespaced misconception keys tripped during the diagnostic. */
  misconceptions?: string[];
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { username } = useAuth();
  // Load synchronously on first render (the session/username is already known
  // from AuthProvider) so a hard reload / deep-link into a level sees the real
  // progress immediately — no first-paint flash of "empty" progress that would
  // wrongly re-lock levels or drop resume/understood state.
  const [progress, setProgress] = useState<UserProgress>(() =>
    username
      ? migrateErkSplit(migrateProgress(storage.loadProgress(username)))
      : emptyProgress(),
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reload whenever the active user changes (login / logout / switch). Every
  // loaded blob is passed through migrateProgress so a v1 save upgrades to v2
  // (empty mastery maps) without losing level mastery / xp / streak.
  useEffect(() => {
    if (username) {
      setProgress(migrateErkSplit(migrateProgress(storage.loadProgress(username))));
    } else {
      setProgress(emptyProgress());
    }
  }, [username]);

  // Debounced persistence to avoid excessive writes (mirrors the PRD's
  // debounced-write guidance for the future Firestore backend).
  const persist = useCallback(
    (next: UserProgress) => {
      if (!username) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        storage.saveProgress(username, next);
      }, 250);
    },
    [username],
  );

  const update = useCallback(
    (mut: (p: UserProgress) => UserProgress) => {
      setProgress((prev) => {
        const next = mut(structuredClone(prev));
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const getLevelProgress = useCallback(
    (levelId: string) => progress.levelProgress[levelId],
    [progress],
  );

  const getResume = useCallback(
    (levelId: string) => progress.resume[levelId],
    [progress],
  );

  const saveResume = useCallback(
    (state: ResumeState) => {
      update((p) => {
        p.resume[state.levelId] = state;
        return p;
      });
    },
    [update],
  );

  const clearResume = useCallback(
    (levelId: string) => {
      update((p) => {
        delete p.resume[levelId];
        return p;
      });
    },
    [update],
  );

  const recordAttempt = useCallback(
    (
      levelId: string,
      scoreFraction: number,
      masteryThreshold: number,
      gateFraction?: number,
    ) => {
      // Split the two concerns: `scoreFraction` is the credit-weighted VISIBLE
      // score (bestScore + xp), while the pass/advance decision uses the lenient
      // binary `gateFraction` (falling back to `scoreFraction` for back-compat)
      // so hint use never bounces a learner below the pass bar.
      const gate = gateFraction ?? scoreFraction;
      const mastered = gate >= masteryThreshold;
      const prior = progress.levelProgress[levelId];
      const isNewMastery = mastered && !prior?.mastered;
      const xpGained = Math.round(scoreFraction * 100) + (isNewMastery ? 50 : 0);

      update((p) => {
        const existing = p.levelProgress[levelId];
        const best = Math.max(existing?.bestScore ?? 0, scoreFraction);
        p.levelProgress[levelId] = {
          bestScore: best,
          mastered: (existing?.mastered ?? false) || mastered,
          attempts: (existing?.attempts ?? 0) + 1,
          completedAt: mastered
            ? new Date().toISOString()
            : existing?.completedAt,
        };
        // Clear resume for a passed level.
        if (mastered) delete p.resume[levelId];
        p.xp += xpGained;
        bumpStreakInPlace(p);
        return p;
      });

      return { mastered, xpGained, isNewMastery };
    },
    [progress, update],
  );

  const getUnderstood = useCallback(
    (levelId: string) => getUnderstoodOp(progress, levelId),
    [progress],
  );

  const markUnderstood = useCallback(
    (levelId: string, problemId: string) => {
      update((p) => {
        markUnderstoodInPlace(p, levelId, problemId);
        return p;
      });
    },
    [update],
  );

  const completeFlashcardLevel = useCallback(
    (levelId: string) => {
      // Derive the return value from the CURRENT snapshot (mirrors
      // recordAttempt) so callers get a stable result synchronously.
      const prior = progress.levelProgress[levelId];
      const isNewMastery = !prior?.mastered;
      const xpGained = isNewMastery ? FLASHCARD_MASTERY_XP : 0;
      update((p) => {
        completeFlashcardLevelInPlace(p, levelId);
        return p;
      });
      return { isNewMastery, xpGained };
    },
    [progress, update],
  );

  const recordItemAttempt = useCallback(
    (a: ItemAttempt) => {
      update((p) => {
        if (!p.topicMastery) p.topicMastery = {};
        if (!p.tierDifficulty) p.tierDifficulty = {};
        const dKey = tierDifficultyKey(a.topicKey, a.tier);
        const expKey = tierExposureKey(a.topicKey, a.tier);
        const dExposures = p.tierDifficulty[expKey] ?? 0;
        const { mastery, tierD } = applyItemAttempt(
          p.topicMastery[a.topicKey],
          p.tierDifficulty[dKey],
          a,
          dExposures,
        );
        p.topicMastery[a.topicKey] = mastery;
        p.tierDifficulty[dKey] = tierD;
        p.tierDifficulty[expKey] = dExposures + 1;
        return p;
      });
    },
    [update],
  );

  const getTopicMastery = useCallback(
    (topicKey: string) => progress.topicMastery?.[topicKey],
    [progress],
  );

  const getTopicVerdict = useCallback(
    (topicKey: string) =>
      deriveVerdict(progress.topicMastery?.[topicKey], topicKey),
    [progress],
  );

  const setReviewSchedule = useCallback(
    (topicKey: string, reviewDue: string, reviewStep: number) => {
      update((p) => {
        if (!p.topicMastery) p.topicMastery = {};
        p.topicMastery[topicKey] = applyReviewSchedule(
          p.topicMastery[topicKey],
          reviewDue,
          reviewStep,
        );
        return p;
      });
    },
    [update],
  );

  const applyDiagnosticSeeds = useCallback(
    (seeds: DiagnosticSeed[], at?: string) => {
      update((p) => {
        if (!p.topicMastery) p.topicMastery = {};
        const stamp = at ?? new Date().toISOString();
        for (const s of seeds) {
          const seeded = applyDiagnosticSeed(p.topicMastery[s.topicKey], {
            successes: s.successes,
            failures: s.failures,
            thetaSeed: s.thetaSeed,
            at: stamp,
          });
          // `applyDiagnosticSeed` preserves prior misconception flags but does
          // not add new ones; fold in the diagnostic's tripped keys here.
          for (const key of s.misconceptions ?? []) {
            seeded.misconceptions[key] = (seeded.misconceptions[key] ?? 0) + 1;
          }
          p.topicMastery[s.topicKey] = seeded;
        }
        p.diagnosticDoneAt = stamp;
        return p;
      });
    },
    [update],
  );

  const recordDiagnosticResult = useCallback(
    (result: DiagnosticResult) => {
      update((p) => {
        p.diagnosticHistory = appendDiagnosticResult(
          p.diagnosticHistory,
          result,
        );
        return p;
      });
    },
    [update],
  );

  const markOnboardingTourDone = useCallback(
    (at?: string) => {
      update((p) => markOnboardingTourDoneInPlace(p, at));
    },
    [update],
  );

  const setGoalMode = useCallback(
    (mode: GoalMode) => {
      update((p) => {
        p.goalMode = mode;
        return p;
      });
    },
    [update],
  );

  const recordCalibrationPair = useCallback(
    (topicKey: string, pred: number, outcome: 0 | 1) => {
      // Mirror into the in-memory session log (kept for any session-scoped
      // consumers) and persist a capped cross-session copy so the dashboard's
      // reliability panel accrues instead of resetting on reload.
      recordSessionCalibrationPair(topicKey, pred, outcome);
      update((p) => {
        p.calibrationLog = appendPersistedPair(p.calibrationLog, {
          topicKey,
          pred,
          outcome,
          at: new Date().toISOString(),
        });
        return p;
      });
    },
    [update],
  );

  const saveOaSession = useCallback(
    (session: OaSessionState) => {
      update((p) => {
        p.oaTimed = putActiveSession(p.oaTimed, session);
        return p;
      });
    },
    [update],
  );

  const clearOaActiveSession = useCallback(() => {
    update((p) => {
      p.oaTimed = clearActiveSession(p.oaTimed);
      return p;
    });
  }, [update]);

  const recordOaResult = useCallback(
    (result: OaSessionResult) => {
      update((p) => {
        p.oaTimed = appendOaResult(p.oaTimed, result);
        return p;
      });
    },
    [update],
  );

  const value = useMemo<ProgressContextValue>(
    () => ({
      progress,
      getLevelProgress,
      getResume,
      saveResume,
      clearResume,
      recordAttempt,
      getUnderstood,
      markUnderstood,
      completeFlashcardLevel,
      recordItemAttempt,
      getTopicMastery,
      getTopicVerdict,
      setReviewSchedule,
      applyDiagnosticSeeds,
      recordDiagnosticResult,
      markOnboardingTourDone,
      setGoalMode,
      recordCalibrationPair,
      saveOaSession,
      clearOaActiveSession,
      recordOaResult,
    }),
    [
      progress,
      getLevelProgress,
      getResume,
      saveResume,
      clearResume,
      recordAttempt,
      getUnderstood,
      markUnderstood,
      completeFlashcardLevel,
      recordItemAttempt,
      getTopicMastery,
      getTopicVerdict,
      setReviewSchedule,
      applyDiagnosticSeeds,
      recordDiagnosticResult,
      markOnboardingTourDone,
      setGoalMode,
      recordCalibrationPair,
      saveOaSession,
      clearOaActiveSession,
      recordOaResult,
    ],
  );

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}
