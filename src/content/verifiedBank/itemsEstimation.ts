import type { VerifiedItem } from "./schema";

/**
 * Estimation (Fermi) items — order-of-magnitude sizing under pressure. Each
 * worked solution lays out the factor decomposition and the arithmetic so the
 * stated answer is auditable. Numbers are round; the SKILL is the breakdown.
 */
export const ESTIMATION_ITEMS: VerifiedItem[] = [
  {
    id: "vb-es-001",
    prompt:
      "Roughly how many trades execute on a major US stock exchange in a single trading day? Give an order-of-magnitude estimate.",
    category: "estimation",
    difficulty: "medium",
    answer: "~50–100 million trades/day (order 10⁷–10⁸)",
    workedSolution:
      "Anchor on daily share volume of ~10 billion shares across US venues and an average trade size of ~100–200 shares. 10,000,000,000 ÷ ~150 ≈ 67,000,000 trades. So tens of millions per day — order of magnitude 10⁷–10⁸.",
    provenance: {
      firm: "Citadel Securities",
      genre: "markets sizing (trade count)",
    },
    tags: ["markets", "fermi", "decomposition", "volume"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-es-002",
    prompt:
      "Estimate how many ping-pong balls would fit inside a standard 40-foot shipping container.",
    category: "estimation",
    difficulty: "medium",
    answer: "~2 million balls",
    workedSolution:
      "Container interior ≈ 12 m × 2.3 m × 2.4 m ≈ 66 m³ ≈ 66,000,000 cm³. A ping-pong ball (4 cm diameter) occupies a ~4 cm cube ≈ 64 cm³ if loosely packed. Apply ~70% packing efficiency: usable volume ≈ 46,000,000 cm³; 46,000,000 ÷ 64 ≈ 720,000 — but using the sphere volume (~33 cm³) with 65% packing gives ≈ 66,000,000 × 0.65 ÷ 33 ≈ 1.3–2 million. Order 10⁶.",
    provenance: {
      genre: "counting-by-volume with packing efficiency",
    },
    tags: ["fermi", "volume", "packing-efficiency", "decomposition"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-es-003",
    prompt:
      "How many haircuts are performed in the United States on a typical day? Estimate the count.",
    category: "estimation",
    difficulty: "easy",
    answer: "~4–5 million haircuts/day",
    workedSolution:
      "US population ≈ 330 million. Suppose a person gets ~10 haircuts per year on average (some far more, kids/short styles; some far fewer). Annual haircuts ≈ 3.3 billion. Spread over ~300 salon-operating days: 3,300,000,000 ÷ 300 ≈ 11 million; using ~365 days and a lower 6/yr rate gives ~5 million. Order a few million per day.",
    provenance: {
      genre: "frequency sizing (per-capita rate ÷ days)",
    },
    tags: ["fermi", "frequency", "decomposition"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-es-004",
    prompt:
      "Estimate the mass of water, in kilograms, in a full Olympic-size swimming pool.",
    category: "estimation",
    difficulty: "easy",
    answer: "~2.5 million kg (2,500 metric tons)",
    workedSolution:
      "An Olympic pool is 50 m × 25 m × 2 m = 2,500 m³. Water is 1,000 kg per m³, so mass ≈ 2,500 × 1,000 = 2,500,000 kg. The trick is remembering 1 m³ of water = 1 tonne.",
    provenance: {
      genre: "physical sizing (volume × density)",
    },
    tags: ["fermi", "volume", "density", "unit-conversion"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-es-005",
    prompt:
      "Estimate the total number of smartphones sold worldwide in a year.",
    category: "estimation",
    difficulty: "medium",
    answer: "~1–1.5 billion phones/year",
    workedSolution:
      "About 4–5 billion people own smartphones, and a phone is replaced roughly every ~3 years. Replacement demand ≈ 4.5 billion ÷ 3 ≈ 1.5 billion per year, plus modest first-time buyers. Order ~10⁹ — a billion-plus units annually.",
    provenance: {
      genre: "installed-base ÷ replacement-cycle sizing",
    },
    tags: ["fermi", "installed-base", "replacement-cycle"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-es-006",
    prompt:
      "How many gallons of gasoline are consumed by passenger cars in the US per day? Estimate.",
    category: "estimation",
    difficulty: "hard",
    answer: "~350–400 million gallons/day",
    workedSolution:
      "≈ 250 million passenger vehicles, each driven ~12,000 miles/year ≈ ~33 miles/day, at ~25 mpg → ~1.3 gallons/car/day. 250,000,000 × 1.3 ≈ 330 million gallons/day. Order a few hundred million gallons daily.",
    provenance: {
      genre: "throughput sizing (fleet × usage ÷ efficiency)",
    },
    tags: ["fermi", "throughput", "decomposition", "energy"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-es-007",
    prompt:
      "Estimate the number of words in a typical 300-page hardcover novel.",
    category: "estimation",
    difficulty: "easy",
    answer: "~90,000–100,000 words",
    workedSolution:
      "A printed page holds roughly 300 words (≈ 30 lines × ~10 words). 300 pages × 300 words/page ≈ 90,000 words. Order 10⁵ — right where publishers say a standard novel lives.",
    provenance: {
      genre: "counting sizing (unit × count)",
    },
    tags: ["fermi", "decomposition", "counting"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-es-008",
    prompt:
      "Estimate how many gigabytes of data a single high-definition (1080p) streaming movie of two hours consumes.",
    category: "estimation",
    difficulty: "medium",
    answer: "~4–6 GB",
    workedSolution:
      "1080p streams at roughly 5 megabits per second. Over 2 hours = 7,200 seconds: 5 Mb/s × 7,200 s = 36,000 megabits. Convert to bytes ÷ 8 = 4,500 megabytes ≈ 4.5 GB. Order a handful of gigabytes.",
    provenance: {
      genre: "data-rate sizing (bitrate × time)",
    },
    tags: ["fermi", "bitrate", "unit-conversion", "data"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
];
