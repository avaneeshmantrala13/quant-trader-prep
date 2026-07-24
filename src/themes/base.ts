import type { ThemeColorTokens, ThemeShape, ThemeTypography } from "./types";

/**
 * Base token values = the default "broadsheet" look. Shared, READ-ONLY for
 * theme authors: import these into your `src/themes/<id>/index.ts` and override
 * only what you need (spread then change), so an unfinished theme still renders
 * a complete, contrast-safe UI.
 *
 *   import { BASE_LIGHT, BASE_DARK, BASE_TYPOGRAPHY, BASE_SHAPE } from "../base";
 *   colors: { light: { ...BASE_LIGHT, accent: "12 120 200" }, dark: { ...BASE_DARK } }
 *
 * Colors are space-separated RGB channels ("R G B"); grainOpacity is 0–1.
 */

export const BASE_LIGHT: ThemeColorTokens = {
  bg: "249 237 224",
  surface: "253 247 238",
  surfaceRaised: "255 251 245",
  surfaceMuted: "240 229 213",
  border: "210 193 170",
  borderStrong: "38 30 20",
  textPrimary: "26 20 12",
  textSecondary: "74 63 48",
  textMuted: "101 88 70",
  accent: "138 76 10",
  accentHover: "112 61 6",
  accentContrast: "255 250 243",
  accent2: "33 74 92",
  accent2Hover: "24 58 73",
  gold: "168 114 16",
  success: "26 116 66",
  successSoft: "220 235 223",
  danger: "173 38 27",
  dangerSoft: "244 222 214",
  warning: "150 88 8",
  bull: "26 116 66",
  bear: "173 38 27",
  texGrid: "210 193 170",
  grainOpacity: "0.05",
};

export const BASE_DARK: ThemeColorTokens = {
  bg: "12 11 8",
  surface: "22 19 14",
  surfaceRaised: "29 25 18",
  surfaceMuted: "33 28 21",
  border: "56 48 36",
  borderStrong: "122 106 80",
  textPrimary: "237 228 211",
  textSecondary: "180 168 145",
  textMuted: "142 130 108",
  accent: "240 169 43",
  accentHover: "246 189 88",
  accentContrast: "20 16 8",
  accent2: "92 180 212",
  accent2Hover: "122 198 226",
  gold: "240 191 74",
  success: "74 194 110",
  successSoft: "18 41 27",
  danger: "240 92 62",
  dangerSoft: "46 22 16",
  warning: "240 169 43",
  bull: "74 194 110",
  bear: "240 92 62",
  texGrid: "70 60 44",
  grainOpacity: "0.06",
};

export const BASE_TYPOGRAPHY: ThemeTypography = {
  display: '"Fraunces", Georgia, Cambria, serif',
  body: '"Archivo", system-ui, -apple-system, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
};

export const BASE_SHAPE: ThemeShape = {
  radiusSm: "2px",
  radius: "3px",
  radiusMd: "4px",
};
