import type { Theme } from "../types";
import { BASE_DARK, BASE_LIGHT, BASE_SHAPE, BASE_TYPOGRAPHY } from "../base";
import { MinimalBackground } from "./Background";
import { getMinimalistStation } from "./stations";
import { MinimalistMapBackground } from "./MapBackground";
import { MinimalistTableOfContents } from "./TableOfContents";
import { MinimalistDashboard } from "./Dashboard";

/**
 * "The Daybook" — an editorial trader's-daybook surface on a Swiss/International
 * typographic backbone. A WARM PARCHMENT canvas (never sterile white or pure
 * black), a single COOL deep-ink-blue accent used as punctuation (link / focus /
 * active / primary fill), functional pine-green + warm-brick for up/down &
 * correct/incorrect (never as decoration), hairline rules instead of shadows,
 * a real serif↔grotesque type pairing (Fraunces / Archivo / IBM Plex Mono — NOT
 * Inter), and tabular figures on every number. See datasets/UI_DESIGN_DIRECTION.md.
 *
 * All tokens spread the base then override only what the aesthetic needs, so
 * every semantic slot stays populated and contrast-safe. Text passes WCAG-AA
 * against both bg and surface in light and dark, and accentContrast passes AA
 * against accent in both variants.
 */

const MINIMAL_LIGHT = {
  ...BASE_LIGHT,
  bg: "243 240 232", // warm oat parchment page
  surface: "251 249 243", // warm paper panels (flat, no shadow)
  surfaceRaised: "255 255 255",
  surfaceMuted: "232 227 214", // tonal fills / tracks / secondary buttons
  border: "216 209 192", // warm hairline rules
  borderStrong: "35 31 24", // ink rules
  textPrimary: "33 30 23", // warm near-black ink (~14:1 on surface)
  textSecondary: "87 79 63", // ~7:1 on surface
  textMuted: "107 99 83", // ~4.8:1 on surface (AA)
  accent: "29 78 107", // the one accent — deep ink blue
  accentHover: "22 60 83",
  accentContrast: "251 249 243", // paper-white on accent → ~7.5:1
  accent2: "42 36 25", // secondary "accent" kept as ink (monochrome)
  accent2Hover: "35 31 24",
  gold: "154 107 30", // muted brass, for the rare mastery flourish
  success: "46 125 87", // pine green
  successSoft: "225 234 224",
  danger: "180 71 47", // warm brick (not alarm-red)
  dangerSoft: "240 226 216",
  warning: "176 125 40",
  bull: "46 125 87", // functional up/correct green
  bear: "180 71 47", // functional down/incorrect brick
  texGrid: "223 216 200", // barely-there ledger grid lines
  grainOpacity: "0.04", // whisper of paper grain
};

const MINIMAL_DARK = {
  ...BASE_DARK,
  bg: "23 21 15", // warm ink-brown near-black page
  surface: "32 29 21", // flat warm-dark panels
  surfaceRaised: "40 36 26",
  surfaceMuted: "47 42 31",
  border: "58 52 40", // warm hairline on dark
  borderStrong: "216 207 188", // warm light ink rules
  textPrimary: "236 230 216", // paper-white ink (~13:1 on surface)
  textSecondary: "189 179 156", // ~7:1 on surface
  textMuted: "158 149 129", // ~4.8:1 on the lightest dark surface (AA)
  accent: "131 169 199", // soft chalk-blue (desaturated, not neon)
  accentHover: "157 191 216",
  accentContrast: "23 21 15", // ink on accent → passes AA
  accent2: "207 199 180", // secondary as light ink (monochrome)
  accent2Hover: "236 230 216",
  gold: "201 162 74",
  success: "95 181 136", // pine green (brightened)
  successSoft: "24 42 32",
  danger: "217 113 79", // warm brick (brightened)
  dangerSoft: "46 28 20",
  warning: "208 162 74",
  bull: "95 181 136",
  bear: "217 113 79",
  texGrid: "43 38 25", // barely-there grid lines
  grainOpacity: "0.05",
};

export const minimalistTheme: Theme = {
  id: "minimalist",
  label: "Minimalist",
  description: "The Daybook — warm parchment, ink, and one deep-blue accent.",
  colors: { light: MINIMAL_LIGHT, dark: MINIMAL_DARK },
  typography: {
    ...BASE_TYPOGRAPHY,
    // Editorial serif↔grotesque pairing; mono reserved for data/labels. These
    // three families are self-loaded once in src/index.css (no extra fetch).
    display: '"Fraunces", Georgia, Cambria, "Times New Roman", serif',
    body: '"Archivo", system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
  },
  shape: {
    ...BASE_SHAPE,
    // Disciplined, near-square corners — considered instrument, not a toy.
    radiusSm: "2px",
    radius: "4px",
    radiusMd: "6px",
  },
  Background: MinimalBackground,
  MapBackground: MinimalistMapBackground,
  getMapStation: getMinimalistStation,
  TableOfContents: MinimalistTableOfContents,
  Dashboard: MinimalistDashboard,
};
