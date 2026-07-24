import type { Theme } from "../types";
import { BASE_DARK, BASE_LIGHT, BASE_SHAPE, BASE_TYPOGRAPHY } from "../base";
import { ChalkboardBackground } from "./Background";
import { getChalkboardIllustration } from "./illustrations";
import { getChalkboardStation } from "./stations";
import { ChalkboardMapBackground } from "./MapBackground";
import { ChalkboardTableOfContents } from "./TableOfContents";

/**
 * "Chalkboard" — a hand-drawn math-class aesthetic.
 *
 * Dark: a green classroom slate with chalk-white text and pastel-chalk accents
 * (yellow / blue / pink), a faint chalk-dust grain, and slightly imperfect
 * hand-drawn rules.
 *
 * Light: a lined composition-book page — ink/pencil handwriting on cream ruled
 * paper with a red margin line and a light-blue graph grid.
 *
 * Fonts are handwriting-family (Caveat display, Patrick Hand body, Cutive Mono
 * for data) — expressive but kept legible, and every text token clears WCAG-AA
 * on both `bg` and `surface` in both variants.
 */

// --- Dark: green chalkboard, chalk on slate -------------------------------
const CHALK_DARK = {
  ...BASE_DARK,
  bg: "28 48 40", // deep classroom-slate green
  surface: "34 56 47",
  surfaceRaised: "41 64 54",
  surfaceMuted: "31 52 44",
  border: "82 110 98", // faint chalk hairline
  borderStrong: "223 231 218", // chalk-white ink
  textPrimary: "237 240 232", // chalk white
  textSecondary: "201 214 200",
  textMuted: "170 190 176",
  accent: "245 224 138", // pastel chalk yellow
  accentHover: "250 234 168",
  accentContrast: "26 42 34", // dark board text on yellow chalk
  accent2: "150 200 230", // pastel chalk blue
  accent2Hover: "176 216 238",
  gold: "240 210 120",
  success: "150 214 160", // chalk green
  successSoft: "34 66 50",
  danger: "244 160 168", // chalk pink
  dangerSoft: "66 40 44",
  warning: "245 214 130",
  bull: "150 214 160",
  bear: "244 150 158",
  texGrid: "78 104 92", // faint chalk grid
  grainOpacity: "0.09", // chalk dust
};

// --- Light: cream ruled composition book, pencil/ink ----------------------
const CHALK_LIGHT = {
  ...BASE_LIGHT,
  bg: "250 247 236", // cream paper
  surface: "253 251 244",
  surfaceRaised: "255 254 249",
  surfaceMuted: "242 238 224",
  border: "180 198 214", // ruled light-blue line
  borderStrong: "40 46 66", // dark ink
  textPrimary: "28 34 54", // blue-black ink
  textSecondary: "60 68 92",
  textMuted: "96 104 128",
  accent: "196 52 58", // schoolhouse red margin / pen
  accentHover: "168 40 46",
  accentContrast: "255 250 245",
  accent2: "40 78 148", // ballpoint blue
  accent2Hover: "30 62 122",
  gold: "168 120 20",
  success: "36 122 72", // green pen
  successSoft: "220 236 224",
  danger: "186 44 48", // red pen
  dangerSoft: "246 224 220",
  warning: "160 96 16",
  bull: "36 122 72",
  bear: "186 44 48",
  texGrid: "186 204 220", // graph-paper blue
  grainOpacity: "0.04",
};

export const chalkboardTheme: Theme = {
  id: "chalkboard",
  label: "Chalkboard",
  description:
    "Hand-drawn chalk on a classroom slate — a warm math-notebook world of doodled curves and tally marks.",
  colors: { light: CHALK_LIGHT, dark: CHALK_DARK },
  typography: {
    ...BASE_TYPOGRAPHY,
    display: '"Caveat", "Patrick Hand", "Comic Sans MS", cursive',
    body: '"Patrick Hand", "Comic Sans MS", ui-rounded, system-ui, sans-serif',
    mono: '"Cutive Mono", ui-monospace, SFMono-Regular, monospace',
    fontLinks: [
      "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Patrick+Hand&family=Cutive+Mono&display=swap",
    ],
  },
  shape: {
    ...BASE_SHAPE,
    radiusSm: "4px",
    radius: "7px",
    radiusMd: "11px",
  },
  Background: ChalkboardBackground,
  MapBackground: ChalkboardMapBackground,
  getLevelIllustration: getChalkboardIllustration,
  getMapStation: getChalkboardStation,
  TableOfContents: ChalkboardTableOfContents,
};
