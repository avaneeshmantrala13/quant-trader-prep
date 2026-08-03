import type { Rng } from "@/lib/rng";
import type { BehavioralStep } from "./types";

/**
 * Behavioral / fit question bank for the mock interview's part (c).
 *
 * These are REFLECT-ONLY: there is no correct answer and nothing is scored. Each
 * item carries an optional single probing follow-up and a short list of
 * self-review hints (what a strong answer tends to cover) so the learner can
 * grade themselves. Selection is deterministic given a seed.
 */

interface BehavioralSeed {
  id: string;
  prompt: string;
  followUp?: string;
  reflectionHints: string[];
}

const BANK: BehavioralSeed[] = [
  {
    id: "bhv-why-trading",
    prompt:
      "Why do you want to be a trader rather than, say, a quant researcher or a software engineer?",
    followUp:
      "What specifically about the day-to-day of trading appeals to you?",
    reflectionHints: [
      "A concrete, personal reason — not a generic 'I like markets'.",
      "Evidence you understand what the role actually involves.",
      "Honesty about the fast feedback loop and decision-making under uncertainty.",
    ],
  },
  {
    id: "bhv-risk-decision",
    prompt:
      "Tell me about a time you made an important decision with incomplete information. What was your process?",
    followUp: "Knowing what you know now, would you decide differently?",
    reflectionHints: [
      "A clear situation → action → result structure (STAR).",
      "How you weighed probabilities / expected value, not just gut feel.",
      "What you learned and how it changed your later decisions.",
    ],
  },
  {
    id: "bhv-mistake",
    prompt:
      "Describe a significant mistake you made. How did you handle it and what changed afterward?",
    followUp: "How did you make sure it wouldn't happen again?",
    reflectionHints: [
      "Ownership — no blaming others or circumstances.",
      "A concrete corrective action, not just 'I was more careful'.",
      "Comfort discussing loss/failure calmly (crucial on a trading desk).",
    ],
  },
  {
    id: "bhv-competition",
    prompt:
      "Talk about a competitive environment you thrived in. What drove your performance?",
    followUp: "How did you handle losing or being behind?",
    reflectionHints: [
      "Genuine competitiveness balanced with teamwork.",
      "Resilience after setbacks — a growth response, not tilt.",
      "Specifics: rankings, stakes, what you did differently.",
    ],
  },
  {
    id: "bhv-teamwork",
    prompt:
      "Give an example of disagreeing with a teammate on an analytical question. How did you resolve it?",
    followUp: "How do you change your mind when the data says you're wrong?",
    reflectionHints: [
      "Willingness to update on evidence (intellectual honesty).",
      "Respectful, direct communication under disagreement.",
      "A resolution grounded in reasoning/data, not seniority or ego.",
    ],
  },
  {
    id: "bhv-pressure",
    prompt:
      "Tell me about the most pressure you've been under. How did you keep performing?",
    followUp: "What is your routine for staying level when things go against you?",
    reflectionHints: [
      "Concrete stakes and a real time constraint.",
      "A repeatable method for staying calm (process over panic).",
      "Evidence you perform, not just cope.",
    ],
  },
  {
    id: "bhv-learning",
    prompt:
      "How do you go about learning something genuinely hard and unfamiliar quickly?",
    followUp: "Give a recent example and the result.",
    reflectionHints: [
      "A deliberate learning process (first principles, feedback loops).",
      "Curiosity and self-direction.",
      "A concrete, recent example with an outcome.",
    ],
  },
  {
    id: "bhv-strength-weakness",
    prompt:
      "What's a real weakness of yours, and what are you actively doing about it?",
    followUp: "How would a teammate who knows you well describe that trade-off?",
    reflectionHints: [
      "A genuine weakness, not a humble-brag.",
      "Specific, ongoing action to improve.",
      "Self-awareness without over-apologizing.",
    ],
  },
];

/** The full bank size (for tests / capacity checks). */
export const BEHAVIORAL_BANK_SIZE = BANK.length;

/**
 * Deterministically select `count` distinct behavioral questions using the
 * provided RNG. Same RNG stream ⇒ same questions in the same order.
 */
export function selectBehavioral(rng: Rng, count: number): BehavioralStep[] {
  const n = Math.max(0, Math.min(count, BANK.length));
  const shuffled = rng.shuffle(BANK);
  return shuffled.slice(0, n).map((b) => ({
    kind: "behavioral" as const,
    id: b.id,
    prompt: b.prompt,
    followUp: b.followUp,
    reflectionHints: b.reflectionHints,
  }));
}
