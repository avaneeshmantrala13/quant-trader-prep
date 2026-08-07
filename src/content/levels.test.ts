import { describe, expect, it } from "vitest";
import { PLAYABLE_TRACKS } from "./index";
import { materializeLevel, materializeNumericLevel } from "./materialize";
import {
  isFlashcardLevel,
  isNumericLevel,
  totalQuestions,
} from "@/types/content";
import { expectedValueLevels } from "./probabilityStats/expectedValue/levels";
import { conditionalProbabilityLevels } from "./probabilityStats/conditionalProbability/levels";
import { markovChainsLevels } from "./probabilityStats/markovChains/levels";
import { combinatorialAnalysisLevels } from "./probabilityStats/combinatorialAnalysis/levels";
import { geometricProbabilityLevels } from "./probabilityStats/geometricProbability/levels";
import { orderStatisticsLevels } from "./probabilityStats/orderStatistics/levels";
import { varianceCovarianceCltLevels } from "./probabilityStats/varianceCovarianceClt/levels";
import { poissonLevels } from "./probabilityStats/poisson/levels";
import { conditionalExpectationLevels } from "./probabilityStats/conditionalExpectation/levels";
import { jointDistributionsLevels } from "./probabilityStats/jointDistributions/levels";
import { continuousDistributionsLevels } from "./probabilityStats/continuousDistributions/levels";
import { brownianMotionLevels } from "./probabilityStats/brownianMotion/levels";

describe("every level is well-formed under its play mode", () => {
  for (const track of PLAYABLE_TRACKS) {
    for (const level of track.levels) {
      it(`${track.id}/${level.id}`, () => {
        // Every playable level must carry a single-sentence Table-of-Contents
        // blurb (concrete, ≈ ≤ 140 chars) — shown on the `/contents` page.
        expect(level.blurb.trim().length).toBeGreaterThan(10);
        expect(level.blurb.length).toBeLessThanOrEqual(160);

        // ---- Flashcard levels (integrity-based; NO multiple choice) ----
        if (isFlashcardLevel(level)) {
          const cards = level.flashcards ?? [];
          expect(cards.length).toBe(totalQuestions(level));
          expect(cards.length).toBeGreaterThan(0);
          const ids = new Set<string>();
          for (const c of cards) {
            // Unique ids so the "understood" set is unambiguous.
            expect(ids.has(c.id)).toBe(false);
            ids.add(c.id);
            // Non-empty prompt, an explicit answer to reveal, and a genuinely
            // substantive explanation (not a one-liner).
            expect(c.prompt.trim().length).toBeGreaterThan(5);
            expect(c.answer.trim().length).toBeGreaterThan(0);
            expect(c.explanation.trim().length).toBeGreaterThan(40);
          }
          // Flashcards are intentionally NOT required to have MC choices.
          return;
        }

        // ---- Numeric (free-entry) levels — NO multiple choice ----
        if (isNumericLevel(level)) {
          for (const seed of [1, 42, 1000, 7777, 123456]) {
            const qs = materializeNumericLevel(level, seed);
            expect(qs.length).toBe(totalQuestions(level));
            expect(qs.length).toBeGreaterThan(0);
            const ids = new Set<string>();
            for (const q of qs) {
              // Unique ids per attempt.
              expect(ids.has(q.id)).toBe(false);
              ids.add(q.id);
              // Non-empty prompt, an exact integer answer, and a substantive
              // worked explanation — but NOT required to carry MC choices.
              expect(q.prompt.trim().length).toBeGreaterThan(5);
              // Integer answers (Kelly dollar stakes) by default; when a level
              // declares `decimals` the answer may be a clean non-integer (a
              // game value like 2.8, a probability like 0.0625).
              if (q.decimals == null) {
                expect(Number.isInteger(q.answer)).toBe(true);
                expect(q.answer).toBeGreaterThan(0);
              } else {
                // Decimals-carrying free-response answers may be SIGNED — e.g. a
                // correlation (−0.6) or a CLT z-argument (−2) — so only require
                // finiteness, not non-negativity.
                expect(Number.isFinite(q.answer)).toBe(true);
              }
              expect(q.explanation.trim().length).toBeGreaterThan(40);
              // Any common-error feedback must be finite and ≠ answer (at the
              // level's grading precision, so no distractor collides with the key).
              for (const ce of q.commonErrors ?? []) {
                expect(Number.isFinite(ce.value)).toBe(true);
                if (q.decimals == null) {
                  expect(ce.value).not.toBe(q.answer);
                } else {
                  const f = 10 ** q.decimals;
                  expect(Math.round(ce.value * f)).not.toBe(
                    Math.round(q.answer * f),
                  );
                }
              }
            }
          }
          return;
        }

        // ---- Quiz levels (multiple-choice contract, unchanged) ----
        for (const seed of [1, 42, 1000, 7777, 123456]) {
          const qs = materializeLevel(level, seed);
          expect(qs.length).toBe(totalQuestions(level));
          const ids = new Set<string>();
          for (const q of qs) {
            expect(ids.has(q.id)).toBe(false);
            ids.add(q.id);
            // Every choice-based question must offer at least 4 options (see
            // `mcqOptionCount.test.ts` for the exhaustive multi-seed audit).
            expect(q.choices.length).toBeGreaterThanOrEqual(4);
            expect(new Set(q.choices).size).toBe(q.choices.length); // no dup options
            expect(q.correctIndex).toBeGreaterThanOrEqual(0);
            expect(q.correctIndex).toBeLessThan(q.choices.length);
            expect(q.choices[q.correctIndex]).toBeTruthy();
            expect(q.prompt.trim().length).toBeGreaterThan(5);
            expect(q.explanation.trim().length).toBeGreaterThan(5);
            if (q.distractorRationale) {
              expect(q.distractorRationale.length).toBe(q.choices.length);
              // Rationale must stay aligned with the correct option after shuffle.
              expect(q.distractorRationale[q.correctIndex].length).toBeGreaterThan(0);
            }
          }
        }
      });
    }
  }
});

/* ========================================================================== */
/*  Expected Value subcategory — placement + section-label contract.           */
/* ========================================================================== */

describe("Expected Value subcategory is registered and section-tagged", () => {
  it("exposes 8 levels, all tagged section 'Expected Value'", () => {
    expect(expectedValueLevels.length).toBe(8);
    for (const lvl of expectedValueLevels) {
      expect(lvl.section).toBe("Expected Value");
      expect(lvl.blurb.trim().length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
      expect(lvl.lesson.paragraphs.length).toBeGreaterThan(0);
      expect(lvl.lesson.keyIdea?.length).toBeGreaterThan(0);
    }
  });

  it("uses all three play modes (quiz, numeric, flashcard)", () => {
    const modes = new Set(expectedValueLevels.map((l) => l.mode ?? "quiz"));
    expect(modes.has("quiz")).toBe(true);
    expect(modes.has("numeric")).toBe(true);
    expect(modes.has("flashcard")).toBe(true);
  });

  it("difficulty ramps Easy → Hard across the path", () => {
    const order = { intro: 0, easy: 1, medium: 2, hard: 3, expert: 4 } as const;
    const seq = expectedValueLevels.map((l) => order[l.difficulty]);
    // Non-decreasing overall ramp.
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    }
    expect(seq[0]).toBe(order.easy);
    expect(seq[seq.length - 1]).toBe(order.hard);
  });

  it("is wired into the Probability & Statistics aggregator exactly once", () => {
    const track = PLAYABLE_TRACKS.find((t) =>
      t.levels.some((l) => l.section === "Expected Value"),
    );
    expect(track).toBeTruthy();
    const evIds = track!.levels
      .filter((l) => l.section === "Expected Value")
      .map((l) => l.id);
    expect(evIds).toEqual(expectedValueLevels.map((l) => l.id));
    expect(new Set(evIds).size).toBe(evIds.length);
  });
});

/* ========================================================================== */
/*  Conditional Probability subcategory — placement + section-label contract.  */
/* ========================================================================== */

describe("Conditional Probability subcategory is registered and section-tagged", () => {
  it("exposes 6 levels, all tagged section 'Conditional Probability'", () => {
    expect(conditionalProbabilityLevels.length).toBe(6);
    for (const lvl of conditionalProbabilityLevels) {
      expect(lvl.section).toBe("Conditional Probability");
      expect(lvl.blurb.trim().length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
      expect(lvl.lesson.paragraphs.length).toBeGreaterThan(0);
      expect(lvl.lesson.keyIdea?.length).toBeGreaterThan(0);
    }
  });

  it("uses all three play modes (quiz, numeric, flashcard)", () => {
    const modes = new Set(conditionalProbabilityLevels.map((l) => l.mode ?? "quiz"));
    expect(modes.has("quiz")).toBe(true);
    expect(modes.has("numeric")).toBe(true);
    expect(modes.has("flashcard")).toBe(true);
  });

  it("difficulty ramps Easy → Hard across the path", () => {
    const order = { intro: 0, easy: 1, medium: 2, hard: 3, expert: 4 } as const;
    const seq = conditionalProbabilityLevels.map((l) => order[l.difficulty]);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    }
    expect(seq[0]).toBe(order.easy);
    expect(seq[seq.length - 1]).toBe(order.hard);
  });

  it("is wired into the Probability & Statistics aggregator exactly once, before Expected Value", () => {
    const track = PLAYABLE_TRACKS.find((t) =>
      t.levels.some((l) => l.section === "Conditional Probability"),
    );
    expect(track).toBeTruthy();
    const cpIds = track!.levels
      .filter((l) => l.section === "Conditional Probability")
      .map((l) => l.id);
    expect(cpIds).toEqual(conditionalProbabilityLevels.map((l) => l.id));
    expect(new Set(cpIds).size).toBe(cpIds.length);
    // In the difficulty-ordered path Conditional Probability precedes Expected Value.
    const sections = track!.levels.map((l) => l.section);
    expect(sections.lastIndexOf("Conditional Probability")).toBeLessThan(
      sections.indexOf("Expected Value"),
    );
  });
});

/* ========================================================================== */
/*  Markov Chains subcategory — placement + section-label contract.            */
/* ========================================================================== */

describe("Markov Chains subcategory is registered and section-tagged", () => {
  it("exposes 8 levels, all tagged section 'Markov Chains'", () => {
    expect(markovChainsLevels.length).toBe(8);
    for (const lvl of markovChainsLevels) {
      expect(lvl.section).toBe("Markov Chains");
      expect(lvl.blurb.trim().length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
      expect(lvl.lesson.paragraphs.length).toBeGreaterThan(0);
      expect(lvl.lesson.keyIdea?.length).toBeGreaterThan(0);
    }
  });

  it("uses numeric + flashcard modes (mc-5 converted to free-response; quiz no longer required)", () => {
    // Phase-2 follow-up: mc-5 was converted MCQ→free-response, so Markov Chains
    // may have no quiz level. The invariant is relaxed to require the graded
    // free-response mode + the integrity flashcard mode.
    const modes = new Set(markovChainsLevels.map((l) => l.mode ?? "quiz"));
    expect(modes.has("numeric")).toBe(true);
    expect(modes.has("flashcard")).toBe(true);
  });

  it("difficulty ramps Easy → Hard across the path", () => {
    const order = { intro: 0, easy: 1, medium: 2, hard: 3, expert: 4 } as const;
    const seq = markovChainsLevels.map((l) => order[l.difficulty]);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    }
    expect(seq[0]).toBe(order.easy);
    expect(seq[seq.length - 1]).toBe(order.hard);
  });

  it("is wired into the Probability & Statistics aggregator exactly once, after Variance, Covariance & the CLT", () => {
    const track = PLAYABLE_TRACKS.find((t) =>
      t.levels.some((l) => l.section === "Markov Chains"),
    );
    expect(track).toBeTruthy();
    const mcIds = track!.levels
      .filter((l) => l.section === "Markov Chains")
      .map((l) => l.id);
    expect(mcIds).toEqual(markovChainsLevels.map((l) => l.id));
    expect(new Set(mcIds).size).toBe(mcIds.length);
    // Markov Chains sits near the hard end, after the statistics block.
    const sections = track!.levels.map((l) => l.section);
    expect(sections.lastIndexOf("Variance, Covariance & the CLT")).toBeLessThan(
      sections.indexOf("Markov Chains"),
    );
  });
});

/* ========================================================================== */
/*  Geometric Probability subcategory (re-homed from "General").               */
/* ========================================================================== */

describe("Geometric Probability subcategory is registered and section-tagged", () => {
  it("exposes 2 levels, all tagged section 'Geometric Probability'", () => {
    expect(geometricProbabilityLevels.length).toBe(2);
    for (const lvl of geometricProbabilityLevels) {
      expect(lvl.section).toBe("Geometric Probability");
      expect(lvl.blurb.trim().length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
      expect(lvl.lesson.paragraphs.length).toBeGreaterThan(0);
      expect(lvl.lesson.keyIdea?.length).toBeGreaterThan(0);
    }
  });

  it("difficulty is non-decreasing and starts easy", () => {
    const order = { intro: 0, easy: 1, medium: 2, hard: 3, expert: 4 } as const;
    const seq = geometricProbabilityLevels.map((l) => order[l.difficulty]);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    }
    expect(seq[0]).toBe(order.easy);
  });

  it("is wired into the aggregator exactly once, after Combinatorial Analysis", () => {
    const track = PLAYABLE_TRACKS.find((t) =>
      t.levels.some((l) => l.section === "Geometric Probability"),
    );
    expect(track).toBeTruthy();
    const ids = track!.levels
      .filter((l) => l.section === "Geometric Probability")
      .map((l) => l.id);
    expect(ids).toEqual(geometricProbabilityLevels.map((l) => l.id));
    const sections = track!.levels.map((l) => l.section);
    expect(sections.lastIndexOf("Combinatorial Analysis")).toBeLessThan(
      sections.indexOf("Geometric Probability"),
    );
  });
});

/* ========================================================================== */
/*  Order Statistics subcategory (re-homed from "General").                    */
/* ========================================================================== */

describe("Order Statistics subcategory is registered and section-tagged", () => {
  it("exposes 1 level, tagged section 'Order Statistics'", () => {
    expect(orderStatisticsLevels.length).toBe(1);
    for (const lvl of orderStatisticsLevels) {
      expect(lvl.section).toBe("Order Statistics");
      expect(lvl.blurb.trim().length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
      expect(lvl.lesson.paragraphs.length).toBeGreaterThan(0);
      expect(lvl.lesson.keyIdea?.length).toBeGreaterThan(0);
    }
  });

  it("is wired into the aggregator exactly once, after Betting & Sizing", () => {
    const track = PLAYABLE_TRACKS.find((t) =>
      t.levels.some((l) => l.section === "Order Statistics"),
    );
    expect(track).toBeTruthy();
    const ids = track!.levels
      .filter((l) => l.section === "Order Statistics")
      .map((l) => l.id);
    expect(ids).toEqual(orderStatisticsLevels.map((l) => l.id));
    const sections = track!.levels.map((l) => l.section);
    expect(sections.lastIndexOf("Betting & Sizing")).toBeLessThan(
      sections.indexOf("Order Statistics"),
    );
  });
});

/* ========================================================================== */
/*  Variance, Covariance & the CLT subcategory (re-homed from "General").      */
/* ========================================================================== */

describe("Variance, Covariance & the CLT subcategory is registered and section-tagged", () => {
  it("exposes 3 levels, all tagged section 'Variance, Covariance & the CLT'", () => {
    expect(varianceCovarianceCltLevels.length).toBe(3);
    for (const lvl of varianceCovarianceCltLevels) {
      expect(lvl.section).toBe("Variance, Covariance & the CLT");
      expect(lvl.blurb.trim().length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
      expect(lvl.lesson.paragraphs.length).toBeGreaterThan(0);
      expect(lvl.lesson.keyIdea?.length).toBeGreaterThan(0);
    }
  });

  it("uses numeric + flashcard modes (vc-1 converted to free-response; quiz no longer required)", () => {
    // Phase-2 follow-up: vc-1 was converted MCQ→free-response, so Variance/CLT
    // may have no quiz level. Relaxed to require free-response + flashcard.
    const modes = new Set(varianceCovarianceCltLevels.map((l) => l.mode ?? "quiz"));
    expect(modes.has("numeric")).toBe(true);
    expect(modes.has("flashcard")).toBe(true);
  });

  it("difficulty is non-decreasing and ends hard", () => {
    const order = { intro: 0, easy: 1, medium: 2, hard: 3, expert: 4 } as const;
    const seq = varianceCovarianceCltLevels.map((l) => order[l.difficulty]);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    }
    expect(seq[seq.length - 1]).toBe(order.hard);
  });

  it("is wired into the aggregator exactly once, after Order Statistics and before Markov Chains", () => {
    const track = PLAYABLE_TRACKS.find((t) =>
      t.levels.some((l) => l.section === "Variance, Covariance & the CLT"),
    );
    expect(track).toBeTruthy();
    const ids = track!.levels
      .filter((l) => l.section === "Variance, Covariance & the CLT")
      .map((l) => l.id);
    expect(ids).toEqual(varianceCovarianceCltLevels.map((l) => l.id));
    const sections = track!.levels.map((l) => l.section);
    expect(sections.lastIndexOf("Order Statistics")).toBeLessThan(
      sections.indexOf("Variance, Covariance & the CLT"),
    );
    expect(sections.lastIndexOf("Variance, Covariance & the CLT")).toBeLessThan(
      sections.indexOf("Markov Chains"),
    );
  });
});

/* ========================================================================== */
/*  Combinatorial Analysis subcategory — placement + section-label contract.    */
/* ========================================================================== */

describe("Combinatorial Analysis subcategory is registered and section-tagged", () => {
  it("exposes 14 levels, all tagged section 'Combinatorial Analysis'", () => {
    expect(combinatorialAnalysisLevels.length).toBe(14);
    for (const lvl of combinatorialAnalysisLevels) {
      expect(lvl.section).toBe("Combinatorial Analysis");
      expect(lvl.blurb.trim().length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
      expect(lvl.lesson.paragraphs.length).toBeGreaterThan(0);
      expect(lvl.lesson.keyIdea?.length).toBeGreaterThan(0);
    }
  });

  it("uses all three play modes (quiz, numeric, flashcard)", () => {
    const modes = new Set(combinatorialAnalysisLevels.map((l) => l.mode ?? "quiz"));
    expect(modes.has("quiz")).toBe(true);
    expect(modes.has("numeric")).toBe(true);
    expect(modes.has("flashcard")).toBe(true);
  });

  it("difficulty ramps Easy → Hard across the path", () => {
    const order = { intro: 0, easy: 1, medium: 2, hard: 3, expert: 4 } as const;
    const seq = combinatorialAnalysisLevels.map((l) => order[l.difficulty]);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    }
    expect(seq[0]).toBe(order.easy);
    expect(seq[seq.length - 1]).toBe(order.hard);
  });

  it("is the first Probability & Statistics subcategory, right after Core Probability", () => {
    const track = PLAYABLE_TRACKS.find((t) =>
      t.levels.some((l) => l.section === "Combinatorial Analysis"),
    );
    expect(track).toBeTruthy();
    const caIds = track!.levels
      .filter((l) => l.section === "Combinatorial Analysis")
      .map((l) => l.id);
    expect(caIds).toEqual(combinatorialAnalysisLevels.map((l) => l.id));
    expect(new Set(caIds).size).toBe(caIds.length);
    // Core Probability (the foundation) precedes it; Combinatorial Analysis is
    // the easiest Probability & Statistics subcategory, so it comes first.
    const sections = track!.levels.map((l) => l.section);
    expect(sections.lastIndexOf("Core Probability")).toBeLessThan(
      sections.indexOf("Combinatorial Analysis"),
    );
  });
});

/* ========================================================================== */
/*  UT M362K/M362M coverage additions (Bucket 1 + Bucket 2).                    */
/* ========================================================================== */

const probTrack = () =>
  PLAYABLE_TRACKS.find((t) => t.levels.some((l) => l.section === "Core Probability"))!;

describe("Poisson Distribution & Process (Bucket 1)", () => {
  it("exposes 3 numeric levels tagged 'Poisson Distribution & Process'", () => {
    expect(poissonLevels.length).toBe(3);
    for (const lvl of poissonLevels) {
      expect(lvl.section).toBe("Poisson Distribution & Process");
      expect(lvl.mode).toBe("numeric");
      expect(lvl.blurb.length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
    }
  });
  it("adds a po-3 process-depth level (interarrivals, conditional uniformity, compound)", () => {
    const depth = poissonLevels.find((l) => l.id === "po-3");
    expect(depth).toBeDefined();
    expect(depth!.difficulty).toBe("hard");
  });
  it("is wired after Expected Value and before Betting & Sizing", () => {
    const sections = probTrack().levels.map((l) => l.section);
    expect(sections.lastIndexOf("Expected Value")).toBeLessThan(
      sections.indexOf("Poisson Distribution & Process"),
    );
    expect(sections.lastIndexOf("Poisson Distribution & Process")).toBeLessThan(
      sections.indexOf("Betting & Sizing"),
    );
  });
});

describe("Conditional Expectation subcategory (ADD — M362M)", () => {
  it("exposes 2 numeric levels tagged 'Conditional Expectation', ramping medium→hard", () => {
    expect(conditionalExpectationLevels.length).toBe(2);
    for (const lvl of conditionalExpectationLevels) {
      expect(lvl.section).toBe("Conditional Expectation");
      expect(lvl.mode).toBe("numeric");
      expect(lvl.blurb.trim().length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
      expect(lvl.lesson.paragraphs.length).toBeGreaterThan(0);
      expect(lvl.lesson.keyIdea?.length).toBeGreaterThan(0);
    }
    expect(conditionalExpectationLevels[0].difficulty).toBe("medium");
    expect(conditionalExpectationLevels[1].difficulty).toBe("hard");
  });
  it("is wired into the aggregator exactly once, after Expected Value and before Poisson", () => {
    const track = probTrack();
    const ceIds = track.levels
      .filter((l) => l.section === "Conditional Expectation")
      .map((l) => l.id);
    expect(ceIds).toEqual(conditionalExpectationLevels.map((l) => l.id));
    expect(new Set(ceIds).size).toBe(ceIds.length);
    const sections = track.levels.map((l) => l.section);
    expect(sections.lastIndexOf("Expected Value")).toBeLessThan(
      sections.indexOf("Conditional Expectation"),
    );
    expect(sections.lastIndexOf("Conditional Expectation")).toBeLessThan(
      sections.indexOf("Poisson Distribution & Process"),
    );
  });
});

describe("Continuous Distributions (Bucket 1)", () => {
  it("exposes 3 numeric levels tagged 'Continuous Distributions'", () => {
    expect(continuousDistributionsLevels.length).toBe(3);
    for (const lvl of continuousDistributionsLevels) {
      expect(lvl.section).toBe("Continuous Distributions");
      expect(lvl.mode).toBe("numeric");
    }
  });
  it("is wired after Order Statistics and before Variance/CLT", () => {
    const sections = probTrack().levels.map((l) => l.section);
    expect(sections.lastIndexOf("Order Statistics")).toBeLessThan(
      sections.indexOf("Continuous Distributions"),
    );
    expect(sections.lastIndexOf("Continuous Distributions")).toBeLessThan(
      sections.indexOf("Variance, Covariance & the CLT"),
    );
  });
});

describe("Brownian Motion (Bucket 1)", () => {
  it("exposes 1 expert numeric level tagged 'Brownian Motion'", () => {
    expect(brownianMotionLevels.length).toBe(1);
    expect(brownianMotionLevels[0].section).toBe("Brownian Motion");
    expect(brownianMotionLevels[0].mode).toBe("numeric");
    expect(brownianMotionLevels[0].difficulty).toBe("expert");
  });
  it("is wired after Markov Chains", () => {
    const sections = probTrack().levels.map((l) => l.section);
    expect(sections.lastIndexOf("Markov Chains")).toBeLessThan(
      sections.indexOf("Brownian Motion"),
    );
  });
});

describe("Markov stationary distribution level (Bucket 1)", () => {
  it("adds an mc-stationary numeric level inside the Markov Chains section", () => {
    const st = markovChainsLevels.find((l) => l.id === "mc-stationary");
    expect(st).toBeDefined();
    expect(st!.section).toBe("Markov Chains");
    expect(st!.mode).toBe("numeric");
  });
});

describe("Joint Distributions (Bucket 2 — first-class topic)", () => {
  it("exposes 3 numeric joint levels (continuous, discrete pmf, covariance/region)", () => {
    expect(jointDistributionsLevels.length).toBe(3);
    const ids = jointDistributionsLevels.map((l) => l.id);
    expect(ids).toEqual(["ek-joint", "ek-joint-2", "ek-joint-3"]);
    for (const lvl of jointDistributionsLevels) {
      expect(lvl.section).toBe("Joint Distributions");
      expect(lvl.mode).toBe("numeric");
      expect(lvl.blurb.trim().length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
    }
  });
  it("the joint levels are a contiguous run (its own section divider)", () => {
    const track = probTrack();
    const jointIdx = track.levels
      .map((l, i) => ({ id: l.id, i }))
      .filter((x) => x.id.startsWith("ek-joint"))
      .map((x) => x.i);
    for (let k = 1; k < jointIdx.length; k++) {
      expect(jointIdx[k]).toBe(jointIdx[k - 1] + 1);
    }
  });
});

describe("Course-completeness topics (Bucket 2 — the former ERK split)", () => {
  // The single "Extra Relevant Knowledge" bucket is now SEVEN first-class
  // topics, each its OWN section (mastery bucket / skill-graph node / DAG node),
  // in a contiguous run at the END of the track, in content order.
  const SPLIT_SECTIONS = [
    "Moment Generating Functions",
    "Gamma Distribution",
    "Joint Distributions",
    "Branching Processes",
    "Continuous-Time Markov Chains",
    "Limit Theorems",
    "Markov Chain Structure",
  ] as const;

  it("no level is still tagged the old 'Extra Relevant Knowledge' section", () => {
    const track = probTrack();
    expect(
      track.levels.some((l) => l.section === "Extra Relevant Knowledge"),
    ).toBe(false);
  });

  it("each of the seven sections is a single contiguous run, in order, at the end", () => {
    const track = probTrack();
    const sections = track.levels.map((l) => l.section);
    // The last seven distinct sections, in first-appearance order, are the split.
    const runs: string[] = [];
    for (const s of sections) {
      if (s && runs[runs.length - 1] !== s) runs.push(s);
    }
    expect(runs.slice(-SPLIT_SECTIONS.length)).toEqual([...SPLIT_SECTIONS]);
    // Each section appears as exactly one maximal contiguous run.
    for (const s of SPLIT_SECTIONS) {
      const first = sections.indexOf(s);
      const last = sections.lastIndexOf(s);
      const count = sections.filter((x) => x === s).length;
      expect(last - first + 1).toBe(count);
    }
    // The very last section is Markov Chain Structure.
    expect(sections[sections.length - 1]).toBe("Markov Chain Structure");
  });

  it("covers the required Bucket-2 level families", () => {
    const track = probTrack();
    const ids = new Set(track.levels.map((l) => l.id));
    for (const id of [
      "ek-mgf",
      "ek-gamma",
      "ek-joint",
      "ek-branching",
      "ek-ctmc",
      "ek-limit",
      "ek-markov-pn",
      "ek-markov-class",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
