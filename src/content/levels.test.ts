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
                expect(Number.isFinite(q.answer)).toBe(true);
                expect(q.answer).toBeGreaterThanOrEqual(0);
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
            expect(q.choices.length).toBeGreaterThanOrEqual(2);
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
  it("exposes 7 levels, all tagged section 'Markov Chains'", () => {
    expect(markovChainsLevels.length).toBe(7);
    for (const lvl of markovChainsLevels) {
      expect(lvl.section).toBe("Markov Chains");
      expect(lvl.blurb.trim().length).toBeGreaterThan(10);
      expect(lvl.blurb.length).toBeLessThanOrEqual(160);
      expect(lvl.lesson.paragraphs.length).toBeGreaterThan(0);
      expect(lvl.lesson.keyIdea?.length).toBeGreaterThan(0);
    }
  });

  it("uses all three play modes (quiz, numeric, flashcard)", () => {
    const modes = new Set(markovChainsLevels.map((l) => l.mode ?? "quiz"));
    expect(modes.has("quiz")).toBe(true);
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

  it("uses all three play modes (quiz, numeric, flashcard)", () => {
    const modes = new Set(varianceCovarianceCltLevels.map((l) => l.mode ?? "quiz"));
    expect(modes.has("quiz")).toBe(true);
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
