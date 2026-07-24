import confetti from "canvas-confetti";

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Cyberpunk mastery celebration — twin neon cannons (cyan + magenta) firing up
 * from the bottom corners, then a fine sparkle rain in electric hues. Respects
 * reduced-motion by doing nothing.
 */
export function celebrateCyberpunk(): void {
  if (reducedMotion()) return;
  const neon = ["#22e0ff", "#ff5cc4", "#38f0aa", "#f5dc5a", "#7af0ff", "#ff8ad6"];

  confetti({
    particleCount: 80,
    angle: 60,
    spread: 68,
    startVelocity: 58,
    origin: { x: 0, y: 0.9 },
    colors: neon,
    shapes: ["square", "circle"],
    scalar: 0.9,
    ticks: 220,
  });
  confetti({
    particleCount: 80,
    angle: 120,
    spread: 68,
    startVelocity: 58,
    origin: { x: 1, y: 0.9 },
    colors: neon,
    shapes: ["square", "circle"],
    scalar: 0.9,
    ticks: 220,
  });

  window.setTimeout(() => {
    confetti({
      particleCount: 55,
      spread: 130,
      startVelocity: 20,
      gravity: 0.7,
      decay: 0.92,
      origin: { x: 0.5, y: -0.1 },
      colors: neon,
      shapes: ["square"],
      scalar: 0.8,
      ticks: 260,
    });
  }, 200);
}
