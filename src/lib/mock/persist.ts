/**
 * mock/persist.ts — a self-contained, dependency-free localStorage layer that
 * lets an IN-PROGRESS mock interview survive leaving and returning to `/mock`.
 *
 * Design goals, mirroring the immutable style of `@/lib/oa/store`:
 *   • PURE where it counts — `serializeSession` / `deserializeSession` are total,
 *     side-effect-free functions of their input (no clock, no I/O), so they are
 *     trivially unit-testable and safe to hand to `structuredClone` / React state.
 *   • I/O is a thin, defensive shell — `saveActiveSession` / `loadActiveSession` /
 *     `clearActiveSession` wrap a `Storage`-like backend in try/catch and guard
 *     `typeof window` / `typeof localStorage`, so they are safe no-ops in SSR and
 *     the Vitest `node` environment (no `window`).
 *   • Versioned + shape-guarded — the blob carries a schema version, and a
 *     malformed or stale payload is IGNORED (returns `null`) rather than throwing,
 *     so a bad/old save can never crash the page.
 *
 * SCOPE: this deliberately does NOT touch `UserProgress` / `ProgressContext`. It
 * is a standalone, namespaced key so the mock feature owns its own resume state.
 */
import type { MockSession, SessionStatus } from "./engine";
import type { MockScript, MockStep } from "./types";
import { userScopedKey } from "@/lib/userScope";

/**
 * Namespaced, versioned BASE key for the resumable in-progress session. The
 * actual storage key is per-user (see {@link mockActiveKey}) so two accounts on
 * the same browser never share — and therefore never leak — a mock session.
 */
export const MOCK_ACTIVE_KEY = "qtp.mock.active.v3";

/**
 * The per-user storage key for the in-progress session: the versioned base
 * scoped by the current user id (falls back to an anonymous namespace when
 * logged out). Keying by user is what stops account B from resuming account A's
 * half-finished interview on a shared browser.
 */
export function mockActiveKey(userId: string | null | undefined): string {
  return userScopedKey(MOCK_ACTIVE_KEY, userId);
}

/**
 * Current on-disk schema version. Bumped to 4 for the clarifying-follow-up
 * overhaul: responses/follow-ups can now carry a `clarify` state and follow-up
 * scores a three-way `verdict` (correct/missed/clarify), so resuming restores
 * exactly which clarify step you were on. Older v1–v3 blobs are ignored (a fresh
 * interview starts) rather than half-restored.
 */
export const MOCK_PERSIST_VERSION = 4 as const;

/** The tiny slice of `Storage` we depend on (so tests can inject a fake map). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The persisted envelope: a schema version wrapping the raw session. */
interface PersistEnvelope {
  v: typeof MOCK_PERSIST_VERSION;
  session: MockSession;
}

/* -------------------------------------------------------------------------- */
/*  PURE serialize / deserialize (no I/O, no clock)                            */
/* -------------------------------------------------------------------------- */

/**
 * Serialize a session to its versioned JSON envelope. Pure — never touches
 * storage. The session is already JSON-serializable (plain data), so this is a
 * total function of its input.
 */
export function serializeSession(session: MockSession): string {
  const envelope: PersistEnvelope = { v: MOCK_PERSIST_VERSION, session };
  return JSON.stringify(envelope);
}

const VALID_STATUSES: readonly SessionStatus[] = ["intro", "running", "summary"];

function isValidScript(script: unknown): script is MockScript {
  if (!script || typeof script !== "object") return false;
  const s = script as Record<string, unknown>;
  return (
    typeof s.seed === "number" &&
    typeof s.tier === "string" &&
    typeof s.intro === "string" &&
    Array.isArray(s.steps) &&
    (s.steps as unknown[]).every(
      (st) =>
        !!st &&
        typeof st === "object" &&
        typeof (st as MockStep).id === "string" &&
        typeof (st as MockStep).kind === "string",
    )
  );
}

/**
 * A defensive shape guard: is this parsed value a plausible `MockSession`? Kept
 * conservative on purpose — anything even slightly off is rejected so a stale or
 * corrupt blob is ignored instead of half-restored.
 */
function isValidSession(value: unknown): value is MockSession {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.speechSupported === "boolean" &&
    typeof s.status === "string" &&
    VALID_STATUSES.includes(s.status as SessionStatus) &&
    typeof s.index === "number" &&
    Number.isInteger(s.index) &&
    s.index >= 0 &&
    Array.isArray(s.responses) &&
    isValidScript(s.script) &&
    s.index < (s.script as MockScript).steps.length
  );
}

/**
 * Parse a persisted blob back into a `MockSession`, or `null` if it is missing,
 * malformed, the wrong version, or fails the shape guard. Pure — never throws.
 */
export function deserializeSession(raw: string | null): MockSession | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const env = parsed as Partial<PersistEnvelope>;
  if (env.v !== MOCK_PERSIST_VERSION) return null;
  if (!isValidSession(env.session)) return null;
  return env.session;
}

/* -------------------------------------------------------------------------- */
/*  Defensive I/O shell (SSR / test-safe)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort accessor for a `Storage` backend that is safe in SSR / node test
 * environments. Returns `null` when `window`/`localStorage` is unavailable or
 * inaccessible (e.g. blocked by privacy settings), so every I/O helper degrades
 * to a no-op rather than throwing.
 */
function defaultStore(): KeyValueStore | null {
  try {
    if (typeof window === "undefined") return null;
    if (typeof window.localStorage === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Persist the in-progress session under the CURRENT user's namespaced key. Safe
 * no-op when no storage backend exists or the write fails. `userId` scopes the
 * key (logged-out → anonymous namespace); `store` is injectable for tests.
 */
export function saveActiveSession(
  session: MockSession,
  userId: string | null | undefined,
  store: KeyValueStore | null = defaultStore(),
): void {
  if (!store) return;
  try {
    store.setItem(mockActiveKey(userId), serializeSession(session));
  } catch {
    /* best-effort: quota / privacy-mode failures must never surface */
  }
}

/**
 * Load the CURRENT user's persisted in-progress session, or `null` if
 * absent/malformed/stale. Because the key is user-scoped, one account can never
 * load another account's saved session. Callers decide whether to resume
 * (typically only when `status === "running"`).
 */
export function loadActiveSession(
  userId: string | null | undefined,
  store: KeyValueStore | null = defaultStore(),
): MockSession | null {
  if (!store) return null;
  try {
    return deserializeSession(store.getItem(mockActiveKey(userId)));
  } catch {
    return null;
  }
}

/**
 * Remove the CURRENT user's persisted in-progress session. Safe no-op without a
 * backend.
 */
export function clearActiveSession(
  userId: string | null | undefined,
  store: KeyValueStore | null = defaultStore(),
): void {
  if (!store) return;
  try {
    store.removeItem(mockActiveKey(userId));
  } catch {
    /* ignore */
  }
}
