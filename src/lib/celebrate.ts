import confetti from "canvas-confetti";

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A restrained, on-brand "fill" celebration: small square "tick" particles in
 * amber / bull-green / ink (no rainbow confetti). Paired in the UI with a
 * rubber-stamp seal. Respects reduced-motion by doing nothing.
 */
export function celebrate(): void {
  if (reducedMotion()) return;
  const colors = ["#f0a92b", "#46c06a", "#1a140c", "#a87210"];

  const fire = (particleRatio: number, opts: confetti.Options) =>
    confetti({
      origin: { y: 0.62 },
      colors,
      shapes: ["square"],
      particleCount: Math.floor(120 * particleRatio),
      scalar: 0.85,
      ticks: 180,
      ...opts,
    });

  fire(0.3, { spread: 24, startVelocity: 48 });
  fire(0.25, { spread: 55 });
  fire(0.2, { spread: 90, decay: 0.92 });
  fire(0.15, { spread: 120, startVelocity: 30, decay: 0.93 });
}
