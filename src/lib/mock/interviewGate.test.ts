/**
 * mock/interviewGate.test.ts — the INTERVIEW-GRADE acceptance gate suite.
 *
 * This is the anti-regression net the user asked for. It proves, deterministically
 * and in CI, that the exact failures they hit can never ship again:
 *   1. no follow-up is a DECOMPOSITION of its base (the "give me the numerator"
 *      trap on the urn problem),
 *   2. no follow-up is EASIER than its base and every follow-up is taxonomy-typed,
 *   3. no two ADJACENT scored items share a topic-family (the three-sequences-in-
 *      a-row complaint), with per-family caps and ≥ N distinct families,
 *   4. every scored item clears the HARD difficulty floor,
 *   5. the market-making pool never poses a freshman drill ("make a market on
 *      12 × 14"),
 *   6. the SENIOR-QUANT LLM reviewer (mockable) agrees, and its heuristic twin
 *      flags each failure mode.
 *
 * Every firm preset is ASSEMBLED across many seeds and run through `auditScript`.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { buildInterview } from "./engine";
import { PRESET_ORDER } from "./presets";
import { buildMockMmStep } from "./marketMaking";
import {
  auditFollowup,
  auditScript,
  belowFloorReason,
  decompositionReason,
  difficultyRank,
  familyCap,
  familyOfStep,
  isEasyFamily,
  EASY_FAMILY_CAP,
  FAMILY_DIFFICULTY,
  missingTypeReason,
  type FollowupBase,
} from "./interviewGate";
import type { TopicFamily } from "./types";
import {
  buildRubricPrompt,
  parseRubricResponse,
  reviewItem,
  reviewItemHeuristic,
  reviewScript,
  rubricItemsFromScript,
  summarizeVerdicts,
  type RubricItem,
  type RubricLlm,
} from "./interviewRubric";
import type { MathStep } from "./types";

const SEEDS = Array.from({ length: 120 }, (_, i) => i * 29 + 5);

/* -------------------------------------------------------------------------- */
/*  1. Per-preset structural gate                                             */
/* -------------------------------------------------------------------------- */

describe("interview gate — every firm preset assembles interview-grade", () => {
  for (const preset of PRESET_ORDER) {
    it(`${preset}: passes the full structural audit across many seeds`, () => {
      const failures: string[] = [];
      for (const seed of SEEDS) {
        const script = buildInterview({ seed, preset });
        const report = auditScript(script);
        if (!report.ok) {
          failures.push(`seed ${seed}: ${report.violations.join(" | ")}`);
        }
      }
      expect(failures, failures.slice(0, 8).join("\n")).toHaveLength(0);
    });

    it(`${preset}: covers ≥ 5 distinct topic-families and no back-to-back repeats`, () => {
      const script = buildInterview({ seed: 4242, preset });
      const report = auditScript(script);
      expect(report.families.length).toBeGreaterThanOrEqual(5);
      // The audit already asserts adjacency; re-check the message channel is clean.
      expect(report.violations.filter((v) => v.includes("back-to-back"))).toHaveLength(0);
    });
  }
});

/* -------------------------------------------------------------------------- */
/*  1b. Difficulty-aware per-topic caps — EASY families ≤ 1 per mock          */
/* -------------------------------------------------------------------------- */

describe("interview gate — easy-family hard cap (≤ 1 per mock)", () => {
  const EASY: TopicFamily[] = ["sequences", "mental-math", "estimation"];

  it("classifies sequences / mental-math / estimation as EASY and caps them at one", () => {
    for (const fam of EASY) {
      expect(FAMILY_DIFFICULTY[fam]).toBe("easy");
      expect(isEasyFamily(fam)).toBe(true);
      expect(familyCap(fam)).toBe(EASY_FAMILY_CAP);
      expect(familyCap(fam)).toBe(1);
    }
  });

  it("classifies genuinely-hard families as HARD and lets them exceed one", () => {
    for (const fam of ["conditional-prob", "bayes", "gamblers-ruin", "combinatorics"] as TopicFamily[]) {
      expect(FAMILY_DIFFICULTY[fam]).toBe("hard");
      expect(isEasyFamily(fam)).toBe(false);
      expect(familyCap(fam)).toBeGreaterThanOrEqual(2);
    }
  });

  it("no assembled firm mock contains an easy family more than once (all seeds)", () => {
    const failures: string[] = [];
    for (const preset of PRESET_ORDER) {
      for (const seed of SEEDS) {
        const script = buildInterview({ seed, preset });
        const counts: Record<string, number> = {};
        for (const step of script.steps) {
          const fam = familyOfStep(step);
          if (fam) counts[fam] = (counts[fam] ?? 0) + 1;
        }
        for (const [fam, n] of Object.entries(counts)) {
          if (isEasyFamily(fam as TopicFamily) && n > EASY_FAMILY_CAP) {
            failures.push(`${preset} seed ${seed}: easy family "${fam}" ×${n}`);
          }
        }
      }
    }
    expect(failures, failures.slice(0, 8).join("\n")).toHaveLength(0);
  });

  it("auditScript reports the easy-family cap as a STRUCTURAL violation when tripped", () => {
    // Hand-build a script with two `sequences` (an easy family) items.
    const seqStep = (id: string) =>
      ({
        kind: "math",
        id,
        qtype: "sequences",
        family: "sequences",
        difficulty: "hard",
        prompt: "next term?",
        answer: 42,
        targetMs: 45000,
      }) as unknown as MathStep;
    const script = {
      seed: 1,
      tier: "hard",
      presetId: "optiver",
      presetName: "x",
      scoringNote: "x",
      calculatorAllowed: false,
      intro: "x",
      steps: [seqStep("a"), { kind: "behavioral", id: "b", prompt: "p" } as never, seqStep("c")],
    } as never;
    const report = auditScript(script);
    expect(report.familyCounts.sequences).toBe(2);
    expect(report.ok).toBe(false);
    expect(report.violations.some((v) => /easy family "sequences"/.test(v))).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  2. Decomposition / floor / taxonomy predicates                           */
/* -------------------------------------------------------------------------- */

describe("interview gate — decomposition detection has teeth", () => {
  const base: FollowupBase = {
    answer: 0.5,
    difficulty: "hard",
    baseIntermediates: [0.25, 3, 10],
  };

  it("flags a follow-up whose answer equals a base intermediate (the numerator trap)", () => {
    const reason = decompositionReason(base, {
      prompt: "What is the count of favourable outcomes?",
      answerKind: "numeric",
      answer: 3, // a value already computed in the base
    });
    expect(reason).toBeTruthy();
  });

  it("flags a follow-up whose answer equals the base answer", () => {
    expect(
      decompositionReason(base, { prompt: "restate it", answer: 0.5 }),
    ).toBeTruthy();
  });

  it("flags decomposition PHRASING even when the number differs", () => {
    expect(
      decompositionReason(base, {
        prompt: "First nail the numerator before conditioning.",
        answer: 0.9999,
      }),
    ).toBeTruthy();
  });

  it("passes a genuine curveball (new number, no banned phrasing)", () => {
    expect(
      decompositionReason(base, {
        prompt: "Now generalize to three draws — what is P(all three red | ≥ two red)?",
        answer: 0.128,
      }),
    ).toBeNull();
  });

  it("reasoning follow-ups are never decompositions by numeric match", () => {
    expect(
      decompositionReason(base, {
        prompt: "State the general rule.",
        answerKind: "reasoning",
      }),
    ).toBeNull();
  });
});

describe("interview gate — difficulty floor + taxonomy predicates", () => {
  it("difficultyRank totally orders the bands with stretch≈expert on top", () => {
    expect(difficultyRank("easy")).toBeLessThan(difficultyRank("medium"));
    expect(difficultyRank("medium")).toBeLessThan(difficultyRank("hard"));
    expect(difficultyRank("hard")).toBeLessThan(difficultyRank("stretch"));
    expect(difficultyRank("stretch")).toBe(difficultyRank("expert"));
  });

  it("belowFloorReason flags an easier follow-up and allows equal/harder", () => {
    const base: FollowupBase = { answer: 1, difficulty: "hard" };
    expect(belowFloorReason(base, { prompt: "x", difficulty: "medium" })).toBeTruthy();
    expect(belowFloorReason(base, { prompt: "x", difficulty: "hard" })).toBeNull();
    expect(belowFloorReason(base, { prompt: "x", difficulty: "stretch" })).toBeNull();
    // Absent follow-up difficulty defaults to the base ⇒ never easier.
    expect(belowFloorReason(base, { prompt: "x" })).toBeNull();
  });

  it("missingTypeReason requires a valid taxonomy type", () => {
    expect(missingTypeReason({ prompt: "x" })).toBeTruthy();
    // @ts-expect-error — deliberately invalid type
    expect(missingTypeReason({ prompt: "x", type: "make-it-easier" })).toBeTruthy();
    expect(missingTypeReason({ prompt: "x", type: "generalize-n" })).toBeNull();
  });

  it("auditFollowup aggregates every violation at once", () => {
    const base: FollowupBase = { answer: 5, difficulty: "hard", baseIntermediates: [2] };
    const violations = auditFollowup(base, {
      prompt: "the numerator?",
      answer: 2,
      difficulty: "easy",
    });
    expect(violations.length).toBeGreaterThanOrEqual(2); // decomposition + floor + type
  });
});

/* -------------------------------------------------------------------------- */
/*  3. Every reachable authored follow-up is interview-grade                  */
/* -------------------------------------------------------------------------- */

describe("interview gate — no authored follow-up in any mock is a decomposition", () => {
  it("across presets and seeds, every probe/adversarial passes the follow-up audit", () => {
    const failures: string[] = [];
    let audited = 0;
    for (const preset of PRESET_ORDER) {
      for (const seed of SEEDS) {
        const script = buildInterview({ seed, preset });
        for (const step of script.steps) {
          if (step.kind !== "math") continue;
          const s = step as MathStep;
          if (s.qtype === "mental-math") continue;
          const base: FollowupBase = {
            answer: s.answer,
            // Compare against the generator's INTRINSIC difficulty, exactly as the
            // gate does (a `hard` item in a `stretch` pacing slot has a `hard` base).
            difficulty: s.baseDifficulty ?? s.difficulty,
            baseIntermediates: s.baseIntermediates,
          };
          for (const [label, fu] of [
            ["probe", s.authoredProbe],
            ["adversarial", s.authoredAdversarial],
          ] as const) {
            if (!fu) continue;
            audited++;
            const v = auditFollowup(base, {
              prompt: fu.prompt,
              answerKind: fu.answerKind,
              answer: fu.answer,
              type: fu.type,
              difficulty: fu.difficulty,
            });
            if (v.length) failures.push(`${preset} seed ${seed} ${s.id} ${label}: ${v.join(", ")}`);
          }
        }
      }
    }
    expect(audited).toBeGreaterThan(500);
    expect(failures, failures.slice(0, 10).join("\n")).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  4. Market-making pool is never a freshman drill                          */
/* -------------------------------------------------------------------------- */

describe("interview gate — market-making poses no trivial arithmetic", () => {
  const APPROVED_MM = new Set([
    "series-sum",
    "pairs-combinatorics",
    "polygon-diagonals",
    "series-squares",
    "dice-max-order-statistic",
  ]);
  /** The exact freshman patterns the user called out. */
  const TRIVIAL_MM = [
    /market on the value of\s*\d{1,2}\s*[x*×]\s*\d{1,2}\b/i, // "12 × 14"
    /number of items in\s*\d+\s*dozen/i,
    /market on\s*\d{1,2}%\s*of/i,
  ];

  it("every MM scenario carries a vetted concept and no trivial prompt (many seeds)", () => {
    const bad: string[] = [];
    let checked = 0;
    for (let i = 0; i < 4; i++) {
      for (const seed of SEEDS) {
        const step = buildMockMmStep(new Rng(seed), "hard", i);
        checked++;
        if (!APPROVED_MM.has(step.concept ?? "")) {
          bad.push(`seed ${seed}: un-vetted MM concept "${step.concept}"`);
        }
        for (const re of TRIVIAL_MM) {
          if (re.test(step.prompt)) bad.push(`seed ${seed}: trivial MM "${step.prompt}"`);
        }
      }
    }
    expect(checked).toBeGreaterThan(400);
    expect(bad, bad.slice(0, 8).join("\n")).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  5. The senior-quant rubric reviewer (heuristic + mockable LLM)           */
/* -------------------------------------------------------------------------- */

/** A good, interview-grade item (base + two typed, harder, non-decomp probes). */
function goodItem(): RubricItem {
  return {
    id: "good-1",
    family: "conditional-prob",
    difficulty: "hard",
    prompt: "Urn with 4 red / 6 blue, draw two without replacement. P(both red | ≥ one red)?",
    baseAnswer: 0.1667,
    baseIntermediates: [0.1333, 0.6667],
    prevFamily: "sequences",
    followups: [
      { role: "probe", type: "generalize-n", difficulty: "hard", prompt: "Three draws now: P(all three red | ≥ two red)?", answerKind: "numeric", answer: 0.05 },
      { role: "adversarial", type: "invert", difficulty: "stretch", prompt: "How many reds would make P(both red | ≥ one red) exceed 1/2?", answerKind: "reasoning" },
    ],
  };
}

describe("interview rubric — heuristic reviewer flags each failure mode", () => {
  it("passes a genuinely interview-grade item", () => {
    const v = reviewItemHeuristic(goodItem());
    expect(v.interviewGrade).toBe(true);
    expect(v.flags).toHaveLength(0);
  });

  it("flags a trivial base (make a market on 12 × 14)", () => {
    const item = { ...goodItem(), prompt: "Make me a market on 12 × 14." };
    const v = reviewItemHeuristic(item);
    expect(v.flags).toContain("trivial-base");
    expect(v.interviewGrade).toBe(false);
  });

  it("flags an easy base", () => {
    const v = reviewItemHeuristic({ ...goodItem(), difficulty: "easy" });
    expect(v.flags).toContain("easy-base");
  });

  it("flags a decomposition follow-up (asks for an intermediate)", () => {
    const item = goodItem();
    item.followups = [
      { role: "probe", type: "invert", difficulty: "hard", prompt: "What is the joint P(both red) alone?", answerKind: "numeric", answer: 0.1333 },
      item.followups[1],
    ];
    const v = reviewItemHeuristic(item);
    expect(v.flags).toContain("decomposition-followup");
  });

  it("flags a duplicate adjacent topic-family", () => {
    const v = reviewItemHeuristic({ ...goodItem(), prevFamily: "conditional-prob" });
    expect(v.flags).toContain("duplicate-topic");
  });

  it("flags an untyped and an easier follow-up", () => {
    const item = goodItem();
    item.difficulty = "hard";
    item.followups = [
      { role: "probe", prompt: "no type here", answerKind: "reasoning" },
      { role: "adversarial", type: "invert", difficulty: "medium", prompt: "easier one", answerKind: "reasoning" },
    ];
    const v = reviewItemHeuristic(item);
    expect(v.flags).toContain("untyped-followup");
    expect(v.flags).toContain("easy-followup");
  });
});

describe("interview rubric — mockable LLM path is deterministic", () => {
  it("buildRubricPrompt embeds the base intermediates and follow-up types", () => {
    const prompt = buildRubricPrompt(goodItem());
    expect(prompt).toContain("SENIOR QUANT");
    expect(prompt).toContain("BASE INTERMEDIATES");
    expect(prompt).toContain("generalize-n");
  });

  it("parseRubricResponse tolerates fenced JSON and filters unknown flags", () => {
    const v = parseRubricResponse(
      '```json\n{"interviewGrade": false, "flags": ["trivial-base", "made-up"], "notes": "nope"}\n```',
      "x",
    );
    expect(v.interviewGrade).toBe(false);
    expect(v.flags).toEqual(["trivial-base"]);
  });

  it("parseRubricResponse degrades safely on garbage", () => {
    const v = parseRubricResponse("not json at all", "x");
    expect(v.interviewGrade).toBe(false);
  });

  it("reviewItem uses the injected LLM verdict verbatim", async () => {
    const llm: RubricLlm = async () =>
      JSON.stringify({ interviewGrade: true, flags: [], notes: "senior quant approves" });
    const v = await reviewItem(goodItem(), llm);
    expect(v.interviewGrade).toBe(true);
    expect(v.notes).toContain("senior quant");
  });

  it("reviewScript with a canned APPROVE llm yields a clean summary for real mocks", async () => {
    const approve: RubricLlm = async () =>
      JSON.stringify({ interviewGrade: true, flags: [], notes: "ok" });
    const script = buildInterview({ seed: 7, preset: "optiver" });
    const verdicts = await reviewScript(script, approve);
    const summary = summarizeVerdicts(verdicts);
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.passRate).toBe(1);
    // And the item extraction only pulls SCORED conceptual math items.
    expect(rubricItemsFromScript(script).length).toBe(verdicts.length);
  });

  it("the OFFLINE heuristic reviewer passes every assembled firm mock", async () => {
    const failures: string[] = [];
    for (const preset of PRESET_ORDER) {
      for (const seed of SEEDS.slice(0, 40)) {
        const script = buildInterview({ seed, preset });
        const verdicts = await reviewScript(script); // no llm ⇒ heuristic
        for (const v of verdicts) {
          if (!v.interviewGrade) failures.push(`${preset} seed ${seed} ${v.id}: ${v.flags.join(",")}`);
        }
      }
    }
    expect(failures, failures.slice(0, 10).join("\n")).toHaveLength(0);
  });
});
