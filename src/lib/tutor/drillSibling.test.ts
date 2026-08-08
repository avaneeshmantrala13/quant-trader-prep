import { describe, expect, it } from "vitest";
import {
  untimedContentItems,
  type UntimedAdapterItem,
} from "@/content/diagnostic/untimedBlueprint";
import {
  materializeUntimedItem,
  type MaterializedNumericItem,
} from "@/lib/diagnostic/untimedRun";
import { formatNumericAnswer } from "@/lib/numeric";
import { drillWorkedSiblingLevel } from "./drillSibling";
import { buildWorkedSibling } from "./workedSibling";

/**
 * The DRILLING loop (Stage 6) serves items from the untimed blueprint, not from
 * a `Level`, so it needs `drillWorkedSiblingLevel` to build a genuine rung-3
 * worked sibling. These tests lock the header ⇔ steps invariant at the data
 * layer: every hard-OA ADAPTER family yields a CONCRETE, verifier-backed,
 * different-numbers sibling, and authored singletons correctly yield none.
 */

/** One unique materialized item per distinct adapter family in the blueprint. */
function adapterItemsByFamily(seed: number): MaterializedNumericItem[] {
  const seen = new Set<string>();
  const out: MaterializedNumericItem[] = [];
  untimedContentItems().forEach((it, i) => {
    if (it.kind !== "numeric-adapter") return;
    const fam = (it as UntimedAdapterItem).family;
    if (seen.has(fam)) return;
    seen.add(fam);
    const m = materializeUntimedItem(it, seed, i);
    if (m.kind === "numeric") out.push(m);
  });
  return out;
}

describe("drillWorkedSiblingLevel — every hard-OA adapter family (drilling loop rung 3)", () => {
  it("covers a representative set of adapter families (precondition)", () => {
    expect(adapterItemsByFamily(1).length).toBeGreaterThanOrEqual(10);
  });

  it("produces a CONCRETE, different-numbers worked sibling for EVERY adapter family and seed", () => {
    for (const seed of [1, 7, 42, 101, 999]) {
      for (const item of adapterItemsByFamily(seed)) {
        const level = drillWorkedSiblingLevel(item);
        expect(level, `level for ${item.item.kind}`).not.toBeNull();
        if (!level) continue;

        const sib = buildWorkedSibling({
          level,
          question: item.question,
          seed: seed * 31 + 5,
        });
        const fam =
          item.item.kind === "numeric-adapter" ? item.item.family : "?";
        // A genuine worked sibling — NOT the orphan-header fallback.
        expect(sib, `sibling for family ${fam} (seed ${seed})`).not.toBeNull();
        if (!sib) continue;

        // Real problem statement, numbered worked steps carrying real numbers,
        // and the sibling's own final answer.
        expect(sib.prompt.trim().length).toBeGreaterThan(0);
        expect(sib.steps.length).toBeGreaterThan(0);
        expect(sib.steps.some((s) => s.trim().length > 0)).toBe(true);
        expect(sib.steps.some((s) => /\d/.test(s))).toBe(true);
        expect(/\d/.test(sib.answer)).toBe(true);

        // Different numbers ⇒ different problem, and it never leaks the current
        // item's answer (compared by VALUE at the item's own precision).
        expect(sib.prompt).not.toBe(item.question.prompt);
        const f = 10 ** (item.question.decimals ?? 2);
        const sibValue = Number(sib.answer.replace(/[^0-9.\-]/g, ""));
        const curValue = Number(formatNumericAnswer(item.question).replace(/[^0-9.\-]/g, ""));
        expect(Math.round(sibValue * f)).not.toBe(Math.round(curValue * f));
      }
    }
  });

  it("is deterministic for a fixed seed (reproducible save/resume + tests)", () => {
    const item = adapterItemsByFamily(3)[0];
    const level = drillWorkedSiblingLevel(item)!;
    const a = buildWorkedSibling({ level, question: item.question, seed: 555 });
    const b = buildWorkedSibling({ level, question: item.question, seed: 555 });
    expect(a).toEqual(b);
  });
});

describe("drillWorkedSiblingLevel — authored singletons cannot regenerate", () => {
  it("returns null for an authored (non-adapter) drill item ⇒ ladder drops the rung", () => {
    const authored = untimedContentItems().find(
      (it) => it.kind === "numeric-authored",
    )!;
    const m = materializeUntimedItem(authored, 1, 0);
    expect(m.kind).toBe("numeric");
    if (m.kind !== "numeric") return;
    expect(drillWorkedSiblingLevel(m)).toBeNull();
  });
});
