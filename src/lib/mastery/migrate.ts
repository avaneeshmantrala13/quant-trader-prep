import { emptyProgress, type UserProgress } from "@/types/progress";

/**
 * Non-destructive v1 → v2 → v3 progress migration (COORDINATION §2.2 / §3.3;
 * T12 adaptive engine).
 *
 * Any older (or partial) saved blob is upgraded to the CURRENT schema version
 * (now 3): missing mastery fields are filled with empty maps and `version` is
 * set to 3, while EVERY existing field is preserved untouched — `levelProgress`
 * / `resume` / `xp` / `streak` / `createdAt`, the Phase-1 mastery state (θ/α/β
 * via `topicMastery`, `tierDifficulty`), the diagnostic/goal/calibration/OA
 * add-ons, etc. Existing level mastery — the unlock gate — is NEVER lost, and
 * the recovered θ/α/β are carried through VALID and UNCHANGED.
 *
 * The v2 → v3 step is purely ADDITIVE: it introduces the optional T12
 * adaptive-engine field (`glickoDifficulty`) and leaves it ABSENT unless the
 * saved blob already carried it. The new per-topic IRT ability
 * (`TopicMastery.irtAbility`/`irtAbilitySe`) rides along inside `topicMastery`
 * and is likewise preserved-if-present / absent-otherwise — no field is
 * re-derived or reset here. Fully pure; safe (idempotent) to run on every load.
 * Runs inside ProgressContext right after `storage.loadProgress`.
 */
export function migrateProgress(raw: unknown): UserProgress {
  const fallback = emptyProgress();
  if (!raw || typeof raw !== "object") return fallback;

  const r = raw as Partial<UserProgress>;
  return {
    version: 3,
    levelProgress: r.levelProgress ?? {},
    resume: r.resume ?? {},
    xp: typeof r.xp === "number" ? r.xp : 0,
    streak: typeof r.streak === "number" ? r.streak : 0,
    lastActiveDate: r.lastActiveDate ?? fallback.lastActiveDate,
    createdAt: r.createdAt ?? fallback.createdAt,
    // Phase-1 mastery state: preserve EXACTLY if present (θ/α/β/misconceptions +
    // any T12 `irtAbility` riding inside), else start empty. Never re-derived.
    topicMastery: r.topicMastery ?? {},
    tierDifficulty: r.tierDifficulty ?? {},
    diagnosticDoneAt: r.diagnosticDoneAt,
    // Additive, back-compatible: preserve the "onboarding tour shown once" UI
    // flag so a completed/dismissed tour never re-auto-opens across reloads.
    onboardingTourDoneAt: r.onboardingTourDoneAt,
    // Additive, back-compatible: preserve diagnostic history if present.
    diagnosticHistory: r.diagnosticHistory,
    // Additive, back-compatible: preserve the Goal Mode selector if present.
    // `undefined` is treated as Case B ("interview") by `resolveGoalMode`, so a
    // pre-mode save keeps today's exact experience.
    goalMode: r.goalMode,
    // Additive, back-compatible: preserve the persisted calibration log.
    calibrationLog: r.calibrationLog,
    // Additive, back-compatible: preserve the durable Timed-OA store (a v3
    // non-destructive fix — an in-progress/complete OA session now survives the
    // migration instead of being dropped on load).
    oaTimed: r.oaTimed,
    // T12 (v2 → v3): preserve the optional Glicko difficulty map if present,
    // else leave it ABSENT. Purely additive parallel signal — never gates
    // content or affects scoring / mastery / unlock.
    glickoDifficulty: r.glickoDifficulty,
  };
}
