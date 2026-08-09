import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { Question } from "@/types/content";
import {
  HARD_OA_BUILDERS,
  HARD_OA_GENERATORS,
  fmt,
  valueOf,
  type Built,
} from "./generators";
import { pathIntersectProb, sameTimeMeetProb } from "./solvers";

/** Parse a canonical choice string ("a/b", integer, or non-numeric) to a Number. */
function parseVal(s: string): number {
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(Number);
    return a / b;
  }
  return Number(s);
}

const FAMILIES = Object.keys(HARD_OA_BUILDERS);
const SEEDS = [0, 1, 2, 3, 7, 11, 42, 99, 123, 2024, 2026, 31337];

describe("HARD_OA registry shape", () => {
  it("exposes a generator for every builder, keyed by family", () => {
    expect(Object.keys(HARD_OA_GENERATORS).sort()).toEqual(FAMILIES.sort());
    expect(FAMILIES.length).toBeGreaterThanOrEqual(14);
  });

  it("every family id is distinct", () => {
    expect(new Set(FAMILIES).size).toBe(FAMILIES.length);
  });
});

describe.each(FAMILIES)("hard generator %s", (family) => {
  const build = HARD_OA_BUILDERS[family];
  const gen = HARD_OA_GENERATORS[family];

  it("(a) the marked-correct choice equals the exact verifier answer", () => {
    for (const seed of SEEDS) {
      const { answer, question }: Built = build(new Rng(seed));
      const correct = question.choices[question.correctIndex];
      expect(
        Math.abs(parseVal(correct) - valueOf(answer)),
        `${family} seed ${seed}: choice ${correct} vs answer ${fmt(answer)}`,
      ).toBeLessThan(1e-9);
      // The formatted correct choice is exactly the canonical answer string.
      expect(correct).toBe(fmt(answer));
    }
  });

  it("(b) has exactly four unique choices with exactly one correct", () => {
    for (const seed of SEEDS) {
      const { answer, question }: Built = build(new Rng(seed));
      expect(question.choices.length, `${family} seed ${seed}`).toBe(4);
      expect(new Set(question.choices).size, `${family} seed ${seed}`).toBe(4);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(4);
      // No distractor numerically ties the exact answer.
      const target = valueOf(answer);
      const matches = question.choices.filter(
        (c) => Number.isFinite(parseVal(c)) && Math.abs(parseVal(c) - target) < 1e-9,
      );
      expect(matches.length, `${family} seed ${seed}`).toBe(1);
    }
  });

  it("(b') is a well-formed MCQ Question", () => {
    const q: Question = gen(new Rng(5));
    expect(q.prompt.length).toBeGreaterThan(0);
    expect(q.explanation.length).toBeGreaterThan(0);
    expect(q.difficulty).toBe("hard");
    expect(typeof q.concept).toBe("string");
    expect((q.concept as string).length).toBeGreaterThan(0);
    for (const c of q.choices) expect(c.length).toBeGreaterThan(0);
  });

  it("(c) is deterministic: same seed ⇒ identical prompt/choices/correctIndex", () => {
    for (const seed of SEEDS) {
      const a = gen(new Rng(seed));
      const b = gen(new Rng(seed));
      expect(a.prompt).toBe(b.prompt);
      expect(a.choices).toEqual(b.choices);
      expect(a.correctIndex).toBe(b.correctIndex);
      expect(a.id).toBe(b.id);
    }
  });

  it("(d) stamps a stable `family` matching its registry key", () => {
    for (const seed of SEEDS) {
      expect(gen(new Rng(seed)).family).toBe(family);
    }
  });
});

describe("flagship — lattice path intersection", () => {
  it("re-derives the exact answer from the drawn parameters (via solvers)", () => {
    for (const seed of SEEDS) {
      const { answer, question } = HARD_OA_BUILDERS.hardPathIntersect(
        new Rng(seed),
      );
      const [, , bxs, bys] = question.id.split("-");
      const bx = Number(bxs);
      const by = Number(bys);
      // The generator's answer IS the exact verifier output for these params.
      expect(valueOf(answer)).toBeCloseTo(pathIntersectProb(bx, by).valueOf(), 12);
      // The same-time (parity) trap distractor is present among the choices.
      expect(question.choices).toContain(fmt(sameTimeMeetProb(bx, by)));
    }
  });

  it("serves the verified anchor 3273/4096 for B=(3,4)", () => {
    // Probe seeds until the (3,4) instance is drawn, then assert the anchor.
    let hit = false;
    for (let seed = 0; seed < 500 && !hit; seed++) {
      const { answer, question } = HARD_OA_BUILDERS.hardPathIntersect(
        new Rng(seed),
      );
      if (question.id === "hard-pathIntersect-3-4") {
        hit = true;
        expect(fmt(answer)).toBe("3273/4096");
        expect(question.choices).toContain("3273/4096");
        expect(question.choices[question.correctIndex]).toBe("3273/4096");
      }
    }
    expect(hit).toBe(true);
  });

  it("Monte-Carlo agrees with the served exact answer (2e5 trials)", () => {
    const { answer, question } = HARD_OA_BUILDERS.hardPathIntersect(new Rng(1));
    const [, , bxs, bys] = question.id.split("-");
    const bx = Number(bxs);
    const by = Number(bys);
    const s = bx + by;
    const rng = new Rng(7);
    const trials = 200000;
    let hits = 0;
    for (let t = 0; t < trials; t++) {
      const ax = new Int16Array(s + 1);
      let x = 0;
      for (let i = 1; i <= s; i++) {
        if (rng.chance(0.5)) x++;
        ax[i] = x;
      }
      const bxd = new Int16Array(s + 1);
      bxd[s] = bx;
      let xb = bx;
      for (let j = 1; j <= s; j++) {
        if (rng.chance(0.5)) xb--;
        bxd[s - j] = xb;
      }
      for (let k = 0; k <= s; k++) {
        if (ax[k] === bxd[k]) {
          hits++;
          break;
        }
      }
    }
    expect(Math.abs(hits / trials - valueOf(answer))).toBeLessThan(0.01);
  });
});

describe("M7 — hardGraphHitting cube branch is parametrized (no longer parameter-free)", () => {
  it("renders more than one distinct cube/hypercube prompt across seeds", () => {
    const cubePrompts = new Set<string>();
    for (let s = 0; s < 300; s++) {
      const { question } = HARD_OA_BUILDERS.hardGraphHitting(new Rng(s));
      if (question.id.startsWith("hard-graphHitting-cube")) {
        cubePrompts.add(question.prompt);
      }
    }
    // d ∈ {3, 4} → at least two distinct cube prompts (was one fixed prompt).
    expect(cubePrompts.size).toBeGreaterThanOrEqual(2);
  });

  it("still serves the classic 8-corner cube (answer 10) as the d=3 instance", () => {
    let hit = false;
    for (let s = 0; s < 300 && !hit; s++) {
      const { answer, question } = HARD_OA_BUILDERS.hardGraphHitting(new Rng(s));
      if (question.id === "hard-graphHitting-cube-3") {
        hit = true;
        expect(fmt(answer)).toBe("10");
        expect(question.prompt).toContain("8 corners");
      }
    }
    expect(hit).toBe(true);
  });
});

describe("probabilistic sanity — biased-ruin duration Monte-Carlo", () => {
  it("simulated absorption time matches the served exact duration", () => {
    const { answer, question } = HARD_OA_BUILDERS.hardRuinDuration(new Rng(3));
    const [, , as, Ns, pns, pds] = question.id.split("-");
    const a = Number(as);
    const N = Number(Ns);
    const p = Number(pns) / Number(pds);
    const rng = new Rng(9);
    const trials = 120000;
    let total = 0;
    for (let t = 0; t < trials; t++) {
      let pos = a;
      let steps = 0;
      while (pos > 0 && pos < N) {
        pos += rng.chance(p) ? 1 : -1;
        steps++;
      }
      total += steps;
    }
    expect(Math.abs(total / trials - valueOf(answer))).toBeLessThan(0.15);
  });
});
