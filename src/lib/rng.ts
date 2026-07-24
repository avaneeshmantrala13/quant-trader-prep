/**
 * Deterministic, seedable PRNG (mulberry32). Given the same seed it always
 * produces the same stream — this is what makes generated questions
 * reproducible and lets an exact verifier compute the true answer from the
 * seed alone. Swap in a crypto RNG later without changing generator code.
 */
export class Rng {
  private state: number;
  readonly seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? (Math.floor(Math.random() * 2 ** 31) >>> 0);
    this.state = this.seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Pick a random element. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Fisher–Yates shuffle (returns a new array). */
  shuffle<T>(arr: readonly T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Boolean with probability p of true. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

/** Greatest common divisor, for reducing fractions in generators. */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}
