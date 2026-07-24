import type { Theme } from "../types";
import { BASE_DARK, BASE_LIGHT, BASE_SHAPE, BASE_TYPOGRAPHY } from "../base";
import { MinimalBackground } from "./Background";
import { getMinimalistStation } from "./stations";
import { MinimalistMapBackground } from "./MapBackground";
import { MinimalistTableOfContents } from "./TableOfContents";

/**
 * "Minimalist" — Swiss / International typographic style meets Dieter Rams
 * functional minimalism. A near-monochrome palette (crisp near-black on white
 * in light; off-white on near-black in dark), ONE restrained signal-red accent
 * used sparingly, hairline dividers, flat surfaces (no shadows / gradients /
 * texture noise), disciplined near-square radii, and a strong grotesque
 * (Inter / Inter Tight) type system. Calmer and quieter than the default
 * broadsheet — timeless and editorial, never sterile.
 *
 * All tokens spread the base then override only what the aesthetic needs, so
 * every semantic slot stays populated and contrast-safe. Text passes WCAG-AA
 * against both bg and surface in light and dark, and accentContrast passes AA
 * against accent in both variants.
 */

const MINIMAL_LIGHT = {
  ...BASE_LIGHT,
  bg: "250 250 250", // off-white page
  surface: "255 255 255", // pure-white panels (flat, no shadow)
  surfaceRaised: "255 255 255",
  surfaceMuted: "244 244 245", // subtle fills / tracks
  border: "226 226 229", // hairline rules
  borderStrong: "23 23 23", // ink lines
  textPrimary: "17 17 17", // crisp near-black (~19:1 on white)
  textSecondary: "64 64 64", // ~10.4:1 on white
  textMuted: "88 88 88", // ~7.1:1 on white
  accent: "209 42 42", // single restrained signal red
  accentHover: "176 32 32",
  accentContrast: "255 255 255", // white on accent → ~5.1:1
  accent2: "38 38 38", // secondary "accent" kept as ink (monochrome)
  accent2Hover: "23 23 23",
  gold: "146 100 20", // muted, for the rare mastery flourish
  success: "21 128 61",
  successSoft: "233 240 234",
  danger: "185 28 28",
  dangerSoft: "244 232 232",
  warning: "146 100 20",
  bull: "21 128 61", // functional up/correct green (restrained)
  bear: "185 28 28", // functional down/incorrect red
  texGrid: "230 230 230", // barely-there grid lines
  grainOpacity: "0", // no texture noise — reduce visual noise
};

const MINIMAL_DARK = {
  ...BASE_DARK,
  bg: "10 10 10", // near-black page
  surface: "23 23 23", // flat dark panels
  surfaceRaised: "28 28 28",
  surfaceMuted: "38 38 38",
  border: "42 42 42", // subtle hairline on dark
  borderStrong: "235 235 235", // off-white ink lines
  textPrimary: "237 237 237", // off-white (~15:1 on surface)
  textSecondary: "176 176 176", // ~8.3:1 on surface
  textMuted: "150 150 150", // ~6:1 on surface
  accent: "246 96 96", // brighter red for dark visibility (AA as small text)
  accentHover: "250 128 128",
  accentContrast: "10 10 10", // near-black on accent → passes AA
  accent2: "212 212 212", // ink → off-white (monochrome)
  accent2Hover: "235 235 235",
  gold: "212 175 90",
  success: "74 194 110",
  successSoft: "16 33 22",
  danger: "248 113 113",
  dangerSoft: "40 18 18",
  warning: "212 175 90",
  bull: "74 194 110",
  bear: "248 113 113",
  texGrid: "34 34 34", // barely-there grid lines
  grainOpacity: "0",
};

export const minimalistTheme: Theme = {
  id: "minimalist",
  label: "Minimalist",
  description: "Clean, quiet, monochrome — maximum focus, minimum chrome.",
  colors: { light: MINIMAL_LIGHT, dark: MINIMAL_DARK },
  typography: {
    ...BASE_TYPOGRAPHY,
    // Tight grotesque for headlines, neutral grotesque for UI/body.
    display: '"Inter Tight", "Inter", system-ui, -apple-system, sans-serif',
    body: '"Inter", system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
    fontLinks: [
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&display=swap",
    ],
  },
  shape: {
    ...BASE_SHAPE,
    // Disciplined, near-square corners.
    radiusSm: "0px",
    radius: "2px",
    radiusMd: "3px",
  },
  Background: MinimalBackground,
  MapBackground: MinimalistMapBackground,
  getMapStation: getMinimalistStation,
  TableOfContents: MinimalistTableOfContents,
};
