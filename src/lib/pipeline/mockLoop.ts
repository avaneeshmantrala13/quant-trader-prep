import type { PipelineMockResult, UserProgress } from "@/types/progress";
import { MOCK_CONSECUTIVE, MOCK_GATE_PCT, passesMockGate } from "./gates";
import {
  MOCK_PRESETS,
  PRESET_ORDER,
  computePerformance,
  deterministicDiagnosis,
  type MockConfig,
  type MockPerformance,
  type MockSession,
  type PresetId,
  type PresetItemKind,
} from "@/lib/mock";

/**
 * ============================================================================
 *  MOCK-INTERVIEW LOOP LOGIC (guided pipeline — Phase P7, Stage 7)
 * ============================================================================
 *
 * PURE, framework-free helpers for the terminal mock-interview gate (spec §2 /
 * §3.6 / §10.4). No React, no DOM, no storage — every function is a
 * deterministic read over the append-only `progress.pipeline.mocks` log (the
 * SAME log `passesMockGate` reads) or a pure assembly of a mock spec from the
 * EXISTING firm presets/pools. `MockStage.tsx` is a thin renderer over these.
 *
 * ── THE GATE (RESOLVED DECISION §10.4) ──────────────────────────────────────
 *  ≥ 90% accuracy on 3 CONSECUTIVE mocks. A single sub-90% mock RESETS the
 *  streak to 0. This module REUSES the gate constants and predicate from
 *  `gates.ts` EXACTLY (`MOCK_GATE_PCT` = 90, `MOCK_CONSECUTIVE` = 3,
 *  `passesMockGate`) — it never re-implements the pass math. The streak here is
 *  purely the `scorePct >= MOCK_GATE_PCT` run; the authoritative gate
 *  (`passesMockGate`) additionally requires each of the last 3 mocks to also be
 *  `wouldPass !== "no"`, so a mock produced by `MockStage` always carries the
 *  matching verdict (see `buildMockResult`).
 *
 * ── THE MOCK IS THOROUGH + ALL-TOPICS, NOT WEAKNESS-WEIGHTED ─────────────────
 *  A real mock covers everything, so `assembleThoroughMock` draws a STANDARD
 *  firm-style interview from the existing presets/pools and takes NO mastery /
 *  weakness input at all — it CANNOT be weighted toward the user's weaknesses.
 *  The firm preset is CYCLED across the three consecutive mocks
 *  (Optiver → Jane Street → SIG), and the union of the three presets spans every
 *  topic area the firm-mock battery covers ({@link ALL_MOCK_TOPIC_AREAS}). Each
 *  preset is itself a thorough, per-question-timed interview whose pinned
 *  firm-signature archetypes (Optiver's quadratic demo, the lattice/parity
 *  anchor, Jane Street's bank-or-roll cascade, SIG's confidence→bet-size, …) all
 *  flow through unchanged.
 */

/* -------------------------------------------------------------------------- */
/*  Streak math (reuses gates.ts constants + predicate)                        */
/* -------------------------------------------------------------------------- */

/**
 * Whether ONE recorded mock counts as a pass for the streak: its `scorePct`
 * clears the 90% bar (spec §10.4). This is the streak signal; the full gate
 * (`passesMockGate`) also checks `wouldPass !== "no"`.
 */
export function mockCountsAsPass(m: Pick<PipelineMockResult, "scorePct">): boolean {
  return m.scorePct >= MOCK_GATE_PCT;
}

/**
 * The current CONSECUTIVE ≥90% streak, counted from the END of the append-only
 * log: walk newest → oldest, counting passes until the first sub-90% mock breaks
 * it (a fail RESETS the streak to 0). Empty log ⇒ 0.
 */
export function mockPassStreak(mocks: readonly PipelineMockResult[] = []): number {
  let streak = 0;
  for (let i = mocks.length - 1; i >= 0; i--) {
    if (mockCountsAsPass(mocks[i])) streak += 1;
    else break;
  }
  return streak;
}

/**
 * How many more consecutive ≥90% mocks are still needed to clear the gate:
 * `MOCK_CONSECUTIVE − streak`, floored at 0.
 */
export function consecutivePassesRemaining(
  mocks: readonly PipelineMockResult[] = [],
): number {
  return Math.max(0, MOCK_CONSECUTIVE - mockPassStreak(mocks));
}

/** The current streak read straight off `progress.pipeline.mocks`. */
export function currentMockStreak(progress: UserProgress): number {
  return mockPassStreak(progress.pipeline?.mocks ?? []);
}

/** How many more consecutive ≥90% mocks the user still owes, from `progress`. */
export function mocksRemaining(progress: UserProgress): number {
  return consecutivePassesRemaining(progress.pipeline?.mocks ?? []);
}

/**
 * Whether the Stage-7 mock gate is CLEARED. Delegates to `passesMockGate`
 * (gates.ts) — the single authority — so this re-evaluates from live results and
 * a later sub-90% mock relocks it just like every other pipeline gate.
 */
export function mockGateCleared(progress: UserProgress): boolean {
  return passesMockGate(progress);
}

/* -------------------------------------------------------------------------- */
/*  Thorough, all-topics, non-weakness-weighted mock assembly                  */
/* -------------------------------------------------------------------------- */

/** A topic area a mock item can belong to (the preset item kinds). */
export type MockTopicArea = PresetItemKind;

/**
 * EVERY topic area the firm-mock battery spans, derived (not hand-listed) from
 * the union of all firm presets' items — so it stays in lockstep with the
 * presets. Across the 3-consecutive-mock cycle every one of these is exercised.
 */
export const ALL_MOCK_TOPIC_AREAS: MockTopicArea[] = Array.from(
  new Set(
    PRESET_ORDER.flatMap((id) => MOCK_PRESETS[id].items.map((it) => it.kind)),
  ),
).sort();

/** The distinct topic areas a single firm preset covers (sorted, deduped). */
export function topicAreasForPreset(id: PresetId): MockTopicArea[] {
  return Array.from(new Set(MOCK_PRESETS[id].items.map((it) => it.kind))).sort();
}

/**
 * The firm preset for the mock at a given position in the streak, CYCLED across
 * the three (§10.4): mock 0 → Optiver, 1 → Jane Street, 2 → SIG, then wraps.
 * Depends ONLY on the index — never on mastery — so it can't be weakness-biased.
 */
export function presetForMockIndex(mockIndex: number): PresetId {
  const n = PRESET_ORDER.length;
  return PRESET_ORDER[((mockIndex % n) + n) % n];
}

/** A fully-resolved spec for ONE thorough mock, ready to hand to the engine. */
export interface ThoroughMockSpec {
  /** Which mock in the streak this is (0-based; drives preset cycling). */
  mockIndex: number;
  /** The cycled firm preset id. */
  preset: PresetId;
  /** Human name of the preset (for the stage header). */
  presetName: string;
  /** Deterministic RNG seed handed to `buildInterview`. */
  seed: number;
  /** The exact `MockConfig` for `buildInterview` — reuses the preset path. */
  config: MockConfig;
  /** The topic areas THIS mock covers (from its preset). */
  topicAreas: MockTopicArea[];
}

/**
 * Assemble ONE thorough, all-topics, TIMED mock spec (spec BUILD-1). It draws a
 * standard firm interview from the EXISTING presets/pools and takes NO mastery /
 * weakness input, so it is provably NOT weighted toward the user's weaknesses.
 * The firm preset is cycled by `mockIndex`; the returned `config` is the plain
 * preset path into `buildInterview`, so every pinned firm-signature archetype
 * (Optiver quadratic demo, lattice/parity anchor, bank-or-roll, …) flows
 * through unchanged.
 */
export function assembleThoroughMock(args: {
  mockIndex: number;
  seed: number;
}): ThoroughMockSpec {
  const preset = presetForMockIndex(args.mockIndex);
  return {
    mockIndex: args.mockIndex,
    preset,
    presetName: MOCK_PRESETS[preset].name,
    seed: args.seed,
    config: { seed: args.seed, preset },
    topicAreas: topicAreasForPreset(preset),
  };
}

/**
 * The three specs that make up ONE full run at the gate (the 3 consecutive
 * mocks), cycling the firm presets. Their combined `topicAreas` cover every area
 * in {@link ALL_MOCK_TOPIC_AREAS} — the sense in which the mock battery is
 * genuinely all-topics.
 */
export function assembleThoroughMockCycle(seed: number): ThoroughMockSpec[] {
  return Array.from({ length: MOCK_CONSECUTIVE }, (_, i) =>
    assembleThoroughMock({ mockIndex: i, seed: seed + i }),
  );
}

/** Every topic area the full 3-mock gate battery exercises (union of the cycle). */
export function mockGateBatteryTopicAreas(seed = 0): MockTopicArea[] {
  return Array.from(
    new Set(assembleThoroughMockCycle(seed).flatMap((s) => s.topicAreas)),
  ).sort();
}

/* -------------------------------------------------------------------------- */
/*  Result → PipelineMockResult (reuses the mock diagnosis EXACTLY)            */
/* -------------------------------------------------------------------------- */

/**
 * Project a finished mock `MockSession` into the append-only
 * {@link PipelineMockResult} the coordinator appends to
 * `progress.pipeline.mocks`. REUSES the mock engine's own pure aggregation:
 * `computePerformance(session).scorePct` for the accuracy and
 * `deterministicDiagnosis(perf).wouldPass` for the verdict the authoritative
 * gate cross-checks. Pure + deterministic.
 *
 * Also records `reasoningOk` — the REASONING-QUALITY greenlight gate. It is
 * `true` ONLY when the mock has NO correct-but-vague/flawed item, NO `flawed`
 * reasoning, and NO unresolved `ambiguous` reasoning. This is what stops a
 * candidate who got the right ANSWERS with poor REASONING from greenlighting.
 */
export function buildMockResult(
  session: MockSession,
  at: string = new Date().toISOString(),
): PipelineMockResult {
  const perf = computePerformance(session);
  const diag = deterministicDiagnosis(perf);
  return {
    at,
    scorePct: perf.scorePct,
    wouldPass: diag.wouldPass,
    reasoningOk: mockReasoningIsSound(perf),
  };
}

/**
 * REASONING-QUALITY predicate for the greenlight gate: the mock's reasoning is
 * sound enough to greenlight ⇔ it has ZERO correct-but-vague/flawed items, ZERO
 * `flawed` reasoning tags, and ZERO unresolved `ambiguous` reasoning tags. A
 * high score with poor reasoning therefore does NOT clear the gate. Exported so
 * the UI summary and gate can share ONE definition.
 */
export function mockReasoningIsSound(
  perf: Pick<MockPerformance, "correctButVagueCount" | "reasoningTags">,
): boolean {
  return (
    perf.correctButVagueCount === 0 &&
    perf.reasoningTags.flawed === 0 &&
    (perf.reasoningTags.ambiguous ?? 0) === 0
  );
}
