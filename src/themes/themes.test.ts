import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, THEMES, getTheme } from "./index";
import { themeToCss, type ThemeColorTokens } from "./types";
import { BASE_LIGHT } from "./base";

// The registry is hard-locked to the single minimalist theme (spec §7.2).
const REQUIRED_IDS = ["minimalist"];

const COLOR_KEYS = Object.keys(BASE_LIGHT) as (keyof ThemeColorTokens)[];

/* ---- WCAG contrast helpers (sRGB relative luminance + ratio) ---- */
function channelsToRgb(s: string): [number, number, number] {
  const [r, g, b] = s.trim().split(/\s+/).map(Number);
  return [r, g, b];
}
function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(fg: string, bg: string): number {
  const L1 = relLuminance(channelsToRgb(fg));
  const L2 = relLuminance(channelsToRgb(bg));
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
const AA = 4.5; // WCAG-AA for normal body text

describe("theme registry contract", () => {
  it("registers only the locked minimalist theme, with a unique id", () => {
    const ids = THEMES.map((t) => t.id);
    for (const id of REQUIRED_IDS) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    // No alternate themes remain — the registry is minimalist-only.
    expect(ids).toEqual(["minimalist"]);
    expect(DEFAULT_THEME_ID).toBe("minimalist");
  });

  it("getTheme always resolves to the locked minimalist theme", () => {
    expect(getTheme("does-not-exist").id).toBe("minimalist");
    expect(getTheme(null).id).toBe("minimalist");
    expect(getTheme("minimalist").id).toBe("minimalist");
    expect(getTheme().id).toBe("minimalist");
  });

  for (const t of THEMES) {
    it(`${t.id}: satisfies the token contract`, () => {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      for (const mode of ["light", "dark"] as const) {
        const c = t.colors[mode];
        for (const k of COLOR_KEYS) {
          expect(typeof c[k]).toBe("string");
          expect(c[k].length).toBeGreaterThan(0);
        }
      }
      expect(t.typography.display.length).toBeGreaterThan(0);
      expect(t.typography.body.length).toBeGreaterThan(0);
      expect(t.typography.mono.length).toBeGreaterThan(0);
      expect(t.shape.radiusSm.length).toBeGreaterThan(0);
      expect(t.shape.radius.length).toBeGreaterThan(0);
      expect(t.shape.radiusMd.length).toBeGreaterThan(0);
    });
  }

  // The (single) theme's text tokens must clear WCAG-AA against the surfaces
  // they sit on, in BOTH light and dark, so text never becomes illegible.
  const SURFACES = [
    "bg",
    "surface",
    "surfaceRaised",
    "surfaceMuted",
  ] as const;
  const TEXTS = ["textPrimary", "textSecondary", "textMuted"] as const;
  for (const t of THEMES) {
    for (const mode of ["light", "dark"] as const) {
      it(`${t.id} (${mode}): text tokens clear WCAG-AA`, () => {
        const c = t.colors[mode];
        for (const fg of TEXTS) {
          for (const bg of SURFACES) {
            const r = contrastRatio(c[fg], c[bg]);
            expect(
              r,
              `${t.id}.${mode}: ${fg} on ${bg} = ${r.toFixed(2)}`,
            ).toBeGreaterThanOrEqual(AA);
          }
        }
        // text/icon color placed ON the accent must be legible.
        expect(
          contrastRatio(c.accentContrast, c.accent),
          `${t.id}.${mode}: accentContrast on accent`,
        ).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  it("themeToCss emits :root + .dark blocks with the core tokens", () => {
    const css = themeToCss(getTheme("minimalist"));
    expect(css).toContain(":root{");
    expect(css).toContain(".dark{");
    expect(css).toContain("--color-bg:");
    expect(css).toContain("--color-text-primary:");
    expect(css).toContain("--font-display:");
    expect(css).toContain("--radius:");
    expect(css).toContain("--grain-opacity:");
  });
});
