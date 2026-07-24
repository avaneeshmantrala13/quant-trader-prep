import confetti from "canvas-confetti";

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A joyful, kid-friendly mastery celebration: bright candy-rainbow confetti
 * that bursts up from both bottom corners and rains gentle round + star
 * particles from the top. Respects reduced-motion by doing nothing.
 */
export function kidsCelebrate(): void {
  if (reducedMotion()) return;
  const candy = [
    "#ff6b6b",
    "#ffd93d",
    "#57c785",
    "#5aa9ff",
    "#a78bfa",
    "#f472b6",
    "#ff9f45",
  ];

  // Twin corner cannons.
  confetti({
    particleCount: 90,
    angle: 60,
    spread: 70,
    startVelocity: 55,
    origin: { x: 0, y: 0.9 },
    colors: candy,
    shapes: ["circle", "star"],
    scalar: 1.05,
    ticks: 220,
  });
  confetti({
    particleCount: 90,
    angle: 120,
    spread: 70,
    startVelocity: 55,
    origin: { x: 1, y: 0.9 },
    colors: candy,
    shapes: ["circle", "star"],
    scalar: 1.05,
    ticks: 220,
  });

  // A gentle sprinkle drifting down from the top.
  window.setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 120,
      startVelocity: 22,
      gravity: 0.7,
      decay: 0.92,
      origin: { x: 0.5, y: -0.1 },
      colors: candy,
      shapes: ["circle", "star"],
      scalar: 1.1,
      ticks: 260,
    });
  }, 220);
}
