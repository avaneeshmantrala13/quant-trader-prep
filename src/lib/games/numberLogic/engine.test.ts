import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  advanceNumberLogic,
  answerNumberLogic,
  buildItem,
  buildNumberLogicPaper,
  buildOptions,
  createNumberLogicSession,
  DEFAULT_NUMBERLOGIC_COUNT,
  summarizeNumberLogic,
  tierForIndex,
  type SequenceItem,
} from "./engine";

/**
 * NUMBERLOGIC engine: determinism, structural validity, escalating difficulty,
 * durable session transitions, and honest scoring.
 */

describe("NumberLogic — paper generation", () => {
  it("is deterministic: same seed ⇒ identical paper", () => {
    const a = buildNumberLogicPaper(1234);
    const b = buildNumberLogicPaper(1234);
    expect(a).toEqual(b);
  });

  it("different seeds generally differ", () => {
    const a = JSON.stringify(buildNumberLogicPaper(1));
    const b = JSON.stringify(buildNumberLogicPaper(2));
    expect(a).not.toEqual(b);
  });

  it("produces the default 26 items", () => {
    expect(buildNumberLogicPaper(7)).toHaveLength(DEFAULT_NUMBERLOGIC_COUNT);
  });

  it("escalates difficulty from tier 1 to tier 3 across the paper", () => {
    expect(tierForIndex(0, 26)).toBe(1);
    expect(tierForIndex(13, 26)).toBe(2);
    expect(tierForIndex(25, 26)).toBe(3);
    const paper = buildNumberLogicPaper(99);
    expect(paper[0].tier).toBe(1);
    expect(paper[paper.length - 1].tier).toBe(3);
  });
});

describe("NumberLogic — item validity (winnable)", () => {
  const papers = [11, 22, 33, 44, 55].flatMap((s) => buildNumberLogicPaper(s));

  it("every item has exactly 5 distinct options containing the answer once", () => {
    for (const it of papers) {
      expect(it.options).toHaveLength(5);
      expect(new Set(it.options).size).toBe(5);
      const hits = it.options.filter((o) => o === it.answer).length;
      expect(hits).toBe(1);
    }
  });

  it("correctIndex points at the answer for every item", () => {
    for (const it of papers) {
      expect(it.options[it.correctIndex]).toBe(it.answer);
    }
  });

  it("the answer is consistent with the family's rule", () => {
    for (const it of papers) verifyAnswer(it);
  });

  it("shows at least 4 terms of context per item", () => {
    for (const it of papers) expect(it.terms.length).toBeGreaterThanOrEqual(4);
  });
});

describe("buildOptions", () => {
  it("always returns 5 unique options including the answer", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 500; i++) {
      const answer = rng.int(-50, 500);
      const last = answer - rng.int(1, 40);
      const opts = buildOptions(rng, [last - 2, last - 1, last], answer);
      expect(opts).toHaveLength(5);
      expect(new Set(opts).size).toBe(5);
      expect(opts).toContain(answer);
    }
  });
});

describe("NumberLogic — session lifecycle", () => {
  it("answers the current item and advances, finishing at the end", () => {
    let s = createNumberLogicSession({ seed: 5, nowTs: 0, count: 3 });
    const items = buildNumberLogicPaper(5, 3);
    for (let i = 0; i < 3; i++) {
      s = answerNumberLogic(s, items[i].correctIndex);
      s = advanceNumberLogic(s, 1000);
    }
    expect(s.status).toBe("finished");
    const sum = summarizeNumberLogic(s, items);
    expect(sum.correct).toBe(3);
    expect(sum.accuracyPct).toBe(100);
    expect(sum.score).toBe(sum.maxScore);
  });

  it("finishes early when the whole-paper clock elapses", () => {
    let s = createNumberLogicSession({ seed: 5, nowTs: 0, count: 10, budgetMs: 1000 });
    s = advanceNumberLogic(s, 5000);
    expect(s.status).toBe("finished");
  });

  it("scores a mixed paper honestly (weighted by tier)", () => {
    const items = buildNumberLogicPaper(5, 3);
    let s = createNumberLogicSession({ seed: 5, nowTs: 0, count: 3 });
    // Answer first correct, second wrong, third correct.
    s = answerNumberLogic(s, items[0].correctIndex);
    s = advanceNumberLogic(s, 0);
    s = answerNumberLogic(s, (items[1].correctIndex + 1) % 5);
    s = advanceNumberLogic(s, 0);
    s = answerNumberLogic(s, items[2].correctIndex);
    s = advanceNumberLogic(s, 0);
    const sum = summarizeNumberLogic(s, items);
    expect(sum.correct).toBe(2);
    expect(sum.answered).toBe(3);
    expect(sum.score).toBe(items[0].tier + items[2].tier);
  });
});

/* -------------------------------------------------------------------------- */
/*  A tiny independent verifier of each family's stated rule.                  */
/* -------------------------------------------------------------------------- */

function verifyAnswer(it: SequenceItem): void {
  const t = it.terms;
  switch (it.family) {
    case "arithmetic": {
      const d = t[1] - t[0];
      expect(it.answer).toBe(t[t.length - 1] + d);
      break;
    }
    case "geometric": {
      const r = t[1] / t[0];
      expect(it.answer).toBe(t[t.length - 1] * r);
      break;
    }
    case "polynomial": {
      // term k = b·k² + c, terms shown at k=1..5, answer at k=6.
      const c2 = t[1] - t[0]; // b·3
      const b = c2 / 3;
      const c = t[0] - b;
      expect(it.answer).toBe(b * 36 + c);
      break;
    }
    case "ratio-offset": {
      // Solve r, c from the first three terms: t1 = t0·r + c, t2 = t1·r + c.
      const rr = (t[2] - t[1]) / (t[1] - t[0]);
      const cc = t[1] - t[0] * rr;
      expect(it.answer).toBe(t[t.length - 1] * rr + cc);
      break;
    }
    case "second-difference": {
      const g1 = t[1] - t[0];
      const g2 = t[2] - t[1];
      const dd = g2 - g1;
      const lastGap = t[t.length - 1] - t[t.length - 2];
      expect(it.answer).toBe(t[t.length - 1] + lastGap + dd);
      break;
    }
    case "fibonacci": {
      const c = t[2] - t[1] - t[0];
      expect(it.answer).toBe(t[t.length - 1] + t[t.length - 2] + c);
      break;
    }
    case "alternating-ops": {
      // Shown terms are start + 5 steps popped to length 5; recompute the rule
      // by inferring ×m from step 0 and +a from step 1.
      const m = t[1] / t[0];
      const add = t[2] - t[1];
      // The next op after 5 shown terms alternates ×m,+a,×m,+a,×m → next is +a.
      const nextIsMultiply = (t.length - 1) % 2 === 0;
      expect(it.answer).toBe(
        nextIsMultiply ? t[t.length - 1] * m : t[t.length - 1] + add,
      );
      break;
    }
    case "interleaved": {
      // A at 0,2,4 ; B at 1,3 ; answer continues B at position 5.
      const d2 = t[3] - t[1];
      expect(it.answer).toBe(t[3] + d2);
      break;
    }
  }
}

describe("buildItem", () => {
  it("labels the item with its requested tier", () => {
    const rng = new Rng(1);
    expect(buildItem(rng, 0, 2).tier).toBe(2);
  });
});
