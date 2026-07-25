import type { Theme } from "../types";
import { BASE_DARK, BASE_LIGHT, BASE_SHAPE, BASE_TYPOGRAPHY } from "../base";
import { CasinoBackground } from "./Background";
import { getCasinoLevelIllustration } from "./illustrations";
import { getCasinoStation } from "./stations";
import { CasinoMapBackground } from "./MapBackground";
import { celebrateCasino } from "./celebrate";
import { CasinoTableOfContents } from "./TableOfContents";
import { CasinoDashboard } from "./Dashboard";

/**
 * "Casino Felt" — an elegant card-room aesthetic for a probability/EV product.
 *
 * Dark: deep baize-green felt with cream/gold type, gold hairline trim, red
 *   heart/diamond + dark spade/club accents, poker-chip motifs. A classy
 *   card room, not neon Vegas.
 * Light: a lighter card-table baize with dark ink and antique-gold accents.
 *
 * Typography pairs Cinzel (engraved, luxe casino signage) for display with Jost
 * (a clean geometric deco face) for body/UI. All colors are space-separated RGB
 * channels; cream/gold on green is bumped bright enough to clear WCAG-AA in both
 * variants.
 */

const DARK = {
  ...BASE_DARK,
  bg: "9 38 24", // deep felt green
  surface: "14 51 33",
  surfaceRaised: "18 61 40",
  surfaceMuted: "12 45 29",
  border: "94 120 78",
  borderStrong: "197 160 74", // gold rule
  textPrimary: "245 240 224", // cream
  textSecondary: "214 205 176",
  textMuted: "182 176 150",
  accent: "212 175 74", // gold
  accentHover: "230 196 110",
  accentContrast: "20 40 26", // near-black green on gold
  accent2: "196 60 66", // card red
  accent2Hover: "214 84 90",
  gold: "212 175 74",
  success: "88 200 130",
  successSoft: "16 58 36",
  // Integration fix (AA): the darker card-red failed as small text on the felt
  // surface and as the deep-green "text-bg" on the rejected-ticket header;
  // brightened so it clears WCAG-AA in both roles.
  danger: "236 120 116",
  dangerSoft: "58 22 24",
  warning: "224 176 72",
  bull: "88 200 130",
  bear: "236 120 116",
  texGrid: "40 74 54",
  grainOpacity: "0.08",
};

const LIGHT = {
  ...BASE_LIGHT,
  bg: "205 224 206", // light table baize
  surface: "224 236 224",
  surfaceRaised: "236 244 235",
  surfaceMuted: "196 216 197",
  border: "168 192 168",
  borderStrong: "140 100 14", // antique gold rule
  textPrimary: "24 38 28", // dark ink
  textSecondary: "52 72 56",
  // Integration fix (AA): muted sage was ~3.8–3.2 on the light-baize map board
  // for the small de-emphasized ".num" question-count text; deepened (same
  // sage/green cast) to clear WCAG-AA on the felt, including vignetted/landmark
  // patches. Still clearly lighter than the near-black primary ink.
  textMuted: "50 66 52",
  // Integration fix (AA): antique-gold + felt-green were too light as small
  // text on the light baize; deepened (same hues) to clear WCAG-AA.
  accent: "108 76 6", // deep antique gold
  accentHover: "92 64 4",
  accentContrast: "255 250 240", // cream on gold
  accent2: "170 36 42", // card red
  accent2Hover: "146 28 34",
  gold: "140 104 20",
  success: "20 102 56",
  successSoft: "210 232 214",
  danger: "176 34 40",
  dangerSoft: "244 216 214",
  warning: "132 84 8",
  bull: "20 102 56",
  bear: "176 34 40",
  texGrid: "168 192 168",
  grainOpacity: "0.05",
};

export const casinoTheme: Theme = {
  id: "casino",
  label: "Casino",
  description:
    "An elegant card room — green felt, gold trim, cards, chips, and dice.",
  colors: { light: LIGHT, dark: DARK },
  typography: {
    ...BASE_TYPOGRAPHY,
    display: '"Cinzel", "Playfair Display", Georgia, serif',
    body: '"Jost", system-ui, -apple-system, sans-serif',
    fontLinks: [
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Jost:wght@300;400;500;600&display=swap",
    ],
  },
  shape: {
    ...BASE_SHAPE,
    radiusSm: "3px",
    radius: "6px",
    radiusMd: "10px",
  },
  Background: CasinoBackground,
  MapBackground: CasinoMapBackground,
  getLevelIllustration: getCasinoLevelIllustration,
  getMapStation: getCasinoStation,
  celebration: celebrateCasino,
  TableOfContents: CasinoTableOfContents,
  Dashboard: CasinoDashboard,
};
