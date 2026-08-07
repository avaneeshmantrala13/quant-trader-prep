import type { Flashcard } from "@/types/content";
import { jumpingRobotsRoot } from "../coreSolvers";

/**
 * Reasoning-desk flashcard re-homed from the former "General" reasoning desk
 * into **Game Theory & Puzzles** (gt-6): the Jumping-Robots optimal-stopping
 * equilibrium, whose threshold has no closed form (Newton's-method root). The
 * numeric value is computed from the verified solver in `../coreSolvers`.
 */
const { x: robotThreshold, pZero: robotPZero } = jumpingRobotsRoot();

export const gameTheoryGeneralFlashcards: Flashcard[] = [
  {
    // GN38. Jumping Robots. Newton's-method equilibrium root (9 dp).
    id: "gen-fc-threshold-root",
    prompt:
      "Two identical robots advance from 0 by adding independent U[0,1] steps; each must 'lock in' before its running total crosses 1 (else it scores 0), and locking in adds one final U[0,1]. They play head-to-head, higher score wins, a double-zero is replayed, and both play the known optimal strategy. The optimum is a threshold x (lock in once the position ≥ x), where x solves (x³ − 3x + 2)·eˣ = 3x. What is the probability the very first attempt scores 0? (9 decimals.)",
    answer:
      `The equilibrium threshold is x ≈ ${robotThreshold.toFixed(9)}, and P(the first attempt scores 0) = 1 − (1−x)eˣ ≈ ${robotPZero.toFixed(9)}. There is no clean closed form, it is a Newton's-method root.`,
    explanation:
      "With a threshold strategy x, let q(s) be the probability of eventually locking in (not busting) from position s < x. Waiting an infinitesimal step gives q′(s) = −q(s), so q(s) = C·e^{−s}; the boundary q(x) = 1 − x (from x you lock in and add a final uniform, busting only if it overshoots 1 − x) fixes q(s) = (1−x)·e^{x−s}. Indifference between locking in and waiting at the threshold, combined with the head-to-head win-probability algebra, reduces to (x³ − 3x + 2)·eˣ = 3x. Newton's method converges to x ≈ 0.416195355. The chance the FIRST attempt busts (scores 0) is 1 − q(0) = 1 − (1−x)eˣ ≈ 0.114845886. The lesson: some optimal-stopping equilibria have no algebraic solution, set up the ODE + indifference condition and root-find.",
    difficulty: "hard",
    concept: "Equilibrium threshold strategy; ODE + root-finding",
    source: "Game Theory & Puzzles · Optimizing agents (Newton root)",
  },
];
