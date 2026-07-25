import { emptyProgress, type UserProgress } from "@/types/progress";

/**
 * Non-destructive v1 → v2 progress migration (COORDINATION §2.2 / §3.3).
 *
 * Any older (or partial) saved blob is upgraded: missing mastery fields are
 * filled with empty maps, `version` is set to 2, and `levelProgress` / `resume`
 * / `xp` / `streak` / `createdAt` are preserved untouched. Existing level
 * mastery — the unlock gate — is NEVER lost. Fully pure; safe to run on every
 * load. Runs inside ProgressContext right after `storage.loadProgress`.
 */
export function migrateProgress(raw: unknown): UserProgress {
  const fallback = emptyProgress();
  if (!raw || typeof raw !== "object") return fallback;

  const r = raw as Partial<UserProgress>;
  return {
    version: 2,
    levelProgress: r.levelProgress ?? {},
    resume: r.resume ?? {},
    xp: typeof r.xp === "number" ? r.xp : 0,
    streak: typeof r.streak === "number" ? r.streak : 0,
    lastActiveDate: r.lastActiveDate ?? fallback.lastActiveDate,
    createdAt: r.createdAt ?? fallback.createdAt,
    // New Phase-1 fields: preserve if already present, else start empty.
    topicMastery: r.topicMastery ?? {},
    tierDifficulty: r.tierDifficulty ?? {},
    diagnosticDoneAt: r.diagnosticDoneAt,
  };
}
