import { describe, expect, it } from "vitest";
import { naturalFrequencyTree } from "./naturalFrequency";

describe("naturalFrequencyTree (Gigerenzer & Hoffrage 1995)", () => {
  it("prevalence 1%, sens 80%, fpr 9.6%, total 1000 ⇒ 8 sick+ and 95 healthy+", () => {
    const t = naturalFrequencyTree({
      prior: 0.01,
      sens: 0.8,
      fpr: 0.096,
      total: 1000,
    });
    expect(t.total).toBe(1000);
    const [sick, healthy] = t.branches;
    expect(sick.count).toBe(10);
    expect(sick.positive).toBe(8);
    expect(healthy.count).toBe(990);
    expect(healthy.positive).toBe(95);
  });

  it("leaves the final division blank as '8 / (8 + 95)'", () => {
    const t = naturalFrequencyTree({
      prior: 0.01,
      sens: 0.8,
      fpr: 0.096,
      total: 1000,
    });
    expect(t.finalRatioBlank).toBe("8 / (8 + 95)");
  });

  it("defaults total to 1000", () => {
    const t = naturalFrequencyTree({ prior: 0.01, sens: 0.8, fpr: 0.096 });
    expect(t.total).toBe(1000);
  });
});
