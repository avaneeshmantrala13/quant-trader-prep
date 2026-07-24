import confetti from "canvas-confetti";

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Casino Felt mastery flourish: a burst of round "poker chip" / gold-coin
 * particles in gold, felt-green and card-red — a jackpot cash-out. Uses circle
 * shapes (vs. the default square "ticks") to read as chips, and does nothing
 * under reduced-motion.
 */
export function celebrateCasino(): void {
  if (reducedMotion()) return;
  const colors = ["#d4af4a", "#f0cf6e", "#3fae6e", "#c23c42", "#f5efdf"];

  const fire = (particleRatio: number, opts: confetti.Options) =>
    confetti({
      origin: { y: 0.6 },
      colors,
      shapes: ["circle"],
      particleCount: Math.floor(150 * particleRatio),
      scalar: 1.05,
      ticks: 220,
      ...opts,
    });

  // A two-sided cash-out toss from the felt edges toward the center.
  fire(0.3, { spread: 26, startVelocity: 52, origin: { x: 0.15, y: 0.7 }, angle: 60 });
  fire(0.3, { spread: 26, startVelocity: 52, origin: { x: 0.85, y: 0.7 }, angle: 120 });
  fire(0.25, { spread: 70, startVelocity: 40 });
  fire(0.2, { spread: 110, startVelocity: 34, decay: 0.92, scalar: 0.9 });
}
