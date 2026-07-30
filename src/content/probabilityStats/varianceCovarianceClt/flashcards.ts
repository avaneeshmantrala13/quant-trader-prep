import type { Flashcard } from "@/types/content";

/**
 * Reasoning-desk flashcards for the **Variance, Covariance & the CLT**
 * subcategory (re-homed from the former "General" reasoning desk): deducing a
 * linear relation from perfect correlation (a procedure), and the
 * dependence-vs-independence dry-weekend answer (a conditional). Neither has a
 * single scalar answer.
 */
export const varianceCovarianceCltFlashcards: Flashcard[] = [
  {
    // GN43 — Perfect Correlation — a procedure, not a number.
    id: "gen-fc-perfectcorr",
    prompt:
      "Suppose two signals are PERFECTLY correlated (|ρ| = 1), so plotting one against the other traces an exact straight line. I read off the current value of the second signal; what must you already know to recover the first signal's value exactly, and why is this a deterministic question with no probability to compute?",
    answer:
      "Perfect correlation means an exact linear relation X = aY + b. To pin down a and b you need TWO distinct observed (X, Y) pairs; then X is determined exactly for any given Y. There is no probability to compute — the relationship is deterministic once |ρ| = 1.",
    explanation:
      "|ρ(X,Y)| = 1 holds iff X and Y are affinely related: X = aY + b with a ≠ 0 (a > 0 for ρ = +1, a < 0 for ρ = −1). A single (X, Y) pair leaves a one-parameter family of lines through it; two distinct pairs (X₁,Y₁), (X₂,Y₂) solve a = (X₁−X₂)/(Y₁−Y₂) and b = X₁ − aY₁ uniquely. After that, any Y maps to a single X with certainty. The trap is to start computing a conditional distribution or a variance — under perfect correlation there is no spread to integrate over; the deliverable is the PROCEDURE (two pairs ⇒ solve the line), not a scalar.",
    difficulty: "easy",
    concept: "Deducing a linear relation from perfect correlation",
    source: "Variance & Covariance · procedure, not a scalar",
  },
  {
    // GN44 — Rainy Day — conditional / two-part answer.
    id: "gen-fc-dependence",
    prompt:
      "The chance of rain Saturday is 40% and Sunday is 50%. What is the probability of a dry weekend (no rain either day)? Then: what changes if the two days are NOT independent, and what extra information would you demand?",
    answer:
      "If the days are INDEPENDENT: P(dry) = 0.6 × 0.5 = 0.3. If they are NOT independent, 0.3 is wrong — you cannot answer without the dependence structure. Ask for the correlation (or covariance) between the two rain indicators; equivalently their joint distribution.",
    explanation:
      "Let S, R be the rain indicators. P(dry) = P(Sᶜ ∩ Rᶜ). Under independence this factors as P(Sᶜ)P(Rᶜ) = 0.6·0.5 = 0.3. In general P(Sᶜ ∩ Rᶜ) = P(Sᶜ) + P(Rᶜ) − P(Sᶜ ∪ Rᶜ), which needs the joint law. For indicators, Cov(S,R) = ρ·√(Var S · Var R) with Var S = 0.4·0.6, Var R = 0.5·0.5, and E[S·R] = E[S]E[R] + Cov. Positive correlation (rain clusters) makes dry weekends MORE likely than 0.3; negative correlation makes them less likely. The correct interview move is to give 0.3 for the independent case and then explicitly refuse to guess otherwise, requesting the variances + correlation (i.e. the covariance).",
    difficulty: "medium",
    concept: "Independence vs dependence (conditional answer)",
    source: "Variance & Covariance · conditional (independence)",
  },
];
