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
  type LevelProgress,
  type ResumeState,
  type UserProgress,
} from "@/types/progress";
import { useAuth } from "./AuthContext";

interface ProgressContextValue {
  progress: UserProgress;
  getLevelProgress: (levelId: string) => LevelProgress | undefined;
  getResume: (levelId: string) => ResumeState | undefined;
  saveResume: (state: ResumeState) => void;
  clearResume: (levelId: string) => void;
  /** Record a finished level attempt; updates mastery, xp, and streak. */
  recordAttempt: (
    levelId: string,
    scoreFraction: number,
    masteryThreshold: number,
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
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { username } = useAuth();
  // Load synchronously on first render (the session/username is already known
  // from AuthProvider) so a hard reload / deep-link into a level sees the real
  // progress immediately — no first-paint flash of "empty" progress that would
  // wrongly re-lock levels or drop resume/understood state.
  const [progress, setProgress] = useState<UserProgress>(() =>
    username ? storage.loadProgress(username) : emptyProgress(),
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reload whenever the active user changes (login / logout / switch).
  useEffect(() => {
    if (username) {
      setProgress(storage.loadProgress(username));
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
    (levelId: string, scoreFraction: number, masteryThreshold: number) => {
      const mastered = scoreFraction >= masteryThreshold;
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
