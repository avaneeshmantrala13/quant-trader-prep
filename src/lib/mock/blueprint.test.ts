/**
 * mock/blueprint.test.ts — the docs→runtime CONFORMANCE guard.
 *
 * Proves the machine-readable `INTERVIEW_BLUEPRINT_2026` is actually WIRED to the
 * runtime presets (not prose that drifts): every hard archetype the blueprint
 * demands is pinned in its firm's preset, every declared follow-up pattern is a
 * real taxonomy type, the difficulty bands clear the gold-anchor floor, and the
 * taxonomy covers all six legit follow-up moves.
 */
import { describe, expect, it } from "vitest";
import {
  blueprintForPreset,
  FOLLOWUP_TAXONOMY,
  GOLD_ANCHORS,
  INTERVIEW_BLUEPRINT_2026,
  referenceFirms,
  requiredArchetypes,
  runnableFirms,
} from "./blueprint";
import { MOCK_PRESETS, PRESET_ORDER } from "./presets";
import { FOLLOWUP_TYPES, difficultyRank, MIN_ITEM_DIFFICULTY_RANK } from "./interviewGate";
import type { FollowupType } from "./types";

describe("blueprint — wired to the runtime presets", () => {
  for (const presetId of PRESET_ORDER) {
    it(`${presetId}: has a blueprint whose required archetypes are all pinned`, () => {
      const bp = blueprintForPreset(presetId);
      expect(bp, `no blueprint for ${presetId}`).toBeTruthy();
      const pinned = new Set(
        MOCK_PRESETS[presetId].items
          .map((i) => i.archetype)
          .filter((a): a is NonNullable<typeof a> => Boolean(a)),
      );
      for (const arch of requiredArchetypes(bp!)) {
        expect(pinned.has(arch), `${presetId} must pin archetype ${arch}`).toBe(true);
      }
    });

    it(`${presetId}: every declared follow-up pattern is a real taxonomy type`, () => {
      const bp = blueprintForPreset(presetId)!;
      for (const t of bp.followupPatterns) {
        expect(FOLLOWUP_TYPES.has(t)).toBe(true);
      }
    });

    it(`${presetId}: every reasoning/MM round clears the gold-anchor difficulty floor`, () => {
      const bp = blueprintForPreset(presetId)!;
      for (const round of bp.rounds) {
        if (round.round === "arithmetic-gate") continue; // sprint gate is its own thing
        for (const band of round.difficultyBands) {
          expect(difficultyRank(band)).toBeGreaterThanOrEqual(MIN_ITEM_DIFFICULTY_RANK);
        }
      }
    });
  }
});

describe("blueprint — taxonomy + anchors are complete", () => {
  it("FOLLOWUP_TAXONOMY documents all six legit follow-up moves", () => {
    const documented = new Set(FOLLOWUP_TAXONOMY.map((f) => f.type));
    const all: FollowupType[] = [
      "generalize-n",
      "invert",
      "add-constraint",
      "change-regime",
      "adversarial-trap",
      "act-on-it",
    ];
    for (const t of all) expect(documented.has(t)).toBe(true);
    expect(documented.size).toBe(all.length);
  });

  it("both gold anchors sit at the hard floor or above", () => {
    for (const anchor of GOLD_ANCHORS) {
      expect(difficultyRank(anchor.minDifficulty)).toBeGreaterThanOrEqual(
        MIN_ITEM_DIFFICULTY_RANK,
      );
    }
  });

  it("every firm entry declares at least one round and only valid follow-up types", () => {
    for (const [key, bp] of Object.entries(INTERVIEW_BLUEPRINT_2026)) {
      expect(bp.rounds.length, `${key} has no rounds`).toBeGreaterThan(0);
      for (const t of bp.followupPatterns) {
        expect(FOLLOWUP_TYPES.has(t), `${key} bad follow-up type ${t}`).toBe(true);
      }
    }
  });
});

describe("blueprint — exactly 3 runnable mocks + 7 reference profiles", () => {
  it("runnableFirms() are EXACTLY the wired presets, one per PRESET_ORDER id", () => {
    const runnable = runnableFirms();
    // Every runnable firm carries a presetId; the set of ids equals PRESET_ORDER.
    for (const bp of runnable) expect(bp.presetId).toBeTruthy();
    const ids = runnable.map((b) => b.presetId).sort();
    expect(ids).toEqual([...PRESET_ORDER].sort());
    // …and there are exactly three of them.
    expect(runnable).toHaveLength(3);
    expect(runnable).toHaveLength(PRESET_ORDER.length);
  });

  it("referenceFirms() are the OTHER seven, all preset-less and non-runnable", () => {
    const reference = referenceFirms();
    expect(reference).toHaveLength(7);
    for (const bp of reference) {
      expect(bp.presetId, `${bp.firm} must not be wired to a preset`).toBeUndefined();
    }
    // The seven are exactly the firms the product calls reference-only.
    expect(reference.map((b) => b.firm).sort()).toEqual(
      [
        "Akuna Capital",
        "Citadel Securities",
        "DRW",
        "Five Rings",
        "HRT",
        "IMC",
        "Jump Trading",
      ].sort(),
    );
  });

  it("runnable + reference partition the whole blueprint with no overlap", () => {
    const total = Object.keys(INTERVIEW_BLUEPRINT_2026).length;
    expect(runnableFirms().length + referenceFirms().length).toBe(total);
    expect(total).toBe(10);
  });
});
