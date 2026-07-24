import type { Theme } from "../types";
import { BASE_DARK, BASE_LIGHT, BASE_SHAPE, BASE_TYPOGRAPHY } from "../base";
import { KidsBackground } from "./Background";
import { getKidsIllustration } from "./illustrations";
import { getKidsStation } from "./stations";
import { KidsMapBackground } from "./MapBackground";
import { kidsCelebrate } from "./celebrate";
import { KidsTableOfContents } from "./TableOfContents";

/**
 * "Kids / Cartoon" — a happy, playful world of candy colors, chunky rounded
 * shapes, and bouncy cartoon mascots. Every probability level gets its own
 * bespoke animated illustration; the other tracks share charming motif scenes.
 *
 * Contrast is deliberately preserved: text uses deep ink-navy on cheerful
 * light surfaces (light) and soft near-white on a deep grape night (dark), so
 * body/secondary/muted text and on-accent text all pass WCAG-AA in BOTH modes.
 */
export const kidsTheme: Theme = {
  id: "kids",
  label: "Kids / Cartoon",
  description:
    "A playful cartoon world with friendly characters and bright candy colors.",
  colors: {
    light: {
      ...BASE_LIGHT,
      bg: "255 246 236",
      surface: "255 255 255",
      surfaceRaised: "255 255 255",
      surfaceMuted: "255 240 224",
      border: "245 208 178",
      borderStrong: "45 38 82",
      textPrimary: "40 33 74",
      textSecondary: "74 62 110",
      textMuted: "96 84 128",
      // Integration fix (AA): the original candy-bright orange/green/red failed
      // WCAG-AA as small text on the near-white light surfaces. Deepened to pass
      // (same hues), and accentContrast flipped to cream for button text.
      accent: "178 78 0",
      accentHover: "152 66 0",
      accentContrast: "255 248 240",
      accent2: "197 46 121",
      accent2Hover: "176 38 106",
      gold: "168 108 12",
      success: "20 118 70",
      successSoft: "213 244 224",
      danger: "190 38 38",
      dangerSoft: "252 224 224",
      warning: "168 100 12",
      bull: "20 118 70",
      bear: "190 38 38",
      texGrid: "255 224 196",
      grainOpacity: "0.03",
    },
    dark: {
      ...BASE_DARK,
      bg: "26 22 51",
      surface: "37 32 66",
      surfaceRaised: "46 40 79",
      surfaceMuted: "44 38 74",
      border: "70 62 110",
      borderStrong: "170 160 220",
      textPrimary: "245 240 255",
      textSecondary: "205 198 235",
      textMuted: "168 160 205",
      accent: "255 160 40",
      accentHover: "255 178 80",
      accentContrast: "40 26 66",
      accent2: "244 114 182",
      accent2Hover: "248 140 198",
      gold: "250 200 90",
      success: "74 205 130",
      successSoft: "26 66 44",
      danger: "255 110 110",
      dangerSoft: "72 32 40",
      warning: "250 180 60",
      bull: "74 205 130",
      bear: "255 110 110",
      texGrid: "70 60 110",
      grainOpacity: "0.05",
    },
  },
  typography: {
    ...BASE_TYPOGRAPHY,
    display: '"Baloo 2", "Comic Sans MS", system-ui, sans-serif',
    body: '"Nunito", system-ui, -apple-system, sans-serif',
    mono: '"Baloo 2", ui-monospace, SFMono-Regular, monospace',
    fontLinks: [
      "https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap",
    ],
  },
  shape: {
    ...BASE_SHAPE,
    radiusSm: "8px",
    radius: "14px",
    radiusMd: "20px",
  },
  Background: KidsBackground,
  MapBackground: KidsMapBackground,
  getLevelIllustration: getKidsIllustration,
  getMapStation: getKidsStation,
  celebration: kidsCelebrate,
  TableOfContents: KidsTableOfContents,
};
