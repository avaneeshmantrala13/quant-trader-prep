import type { Theme } from "../types";
import { BASE_DARK, BASE_LIGHT, BASE_SHAPE, BASE_TYPOGRAPHY } from "../base";
import { CyberpunkBackground } from "./Background";
import { getCyberpunkIllustration } from "./illustrations";
import { getCyberpunkStation } from "./stations";
import { CyberpunkMapBackground } from "./MapBackground";
import { CyberpunkTableOfContents } from "./TableOfContents";
import { CyberpunkDashboard } from "./Dashboard";
import { celebrateCyberpunk } from "./celebrate";

/**
 * "Cyberpunk" — an immersive NEON NIGHT-CITY back-alley.
 *
 *  • Dark  = the natural home: a deep blue-black / indigo alley at night, lit by
 *            ELECTRIC CYAN + HOT MAGENTA signboards, glowing storefronts, wet
 *            reflective asphalt, tangled overhead cables and atmospheric haze
 *            receding into fog. Bright neon type against the dark.
 *  • Light = a "neon dusk": a pale lavender-cyan haze (daytime-neon) carrying
 *            the SAME cyan + magenta identity as DEEP, saturated ink so every
 *            glyph stays crisp and legible against the bright panel — like the
 *            same street photographed just after sundown.
 *
 * LEGIBILITY: text never sits on a neon fill. Body/annotation text uses the
 * accessible text tokens; neon (accent / accent2 / borderStrong) is used for
 * headings-as-accents, rules, sign-glow and line-art only. Every token pair
 * used for text clears WCAG-AA in BOTH variants (verified against bg/surface/
 * muted, plus accentContrast on accent and the bg-on-bull mastered node). Neon
 * "pop" is decorative glow/SVG shadow, so it never lowers text contrast.
 *
 * Motion (sign flicker/buzz, drifting haze, wet-asphalt shimmer, falling rain,
 * swaying signboards, beacon pulses) is transform/opacity/stroke-only and
 * collapses to a clean static state under `prefers-reduced-motion` via the
 * `.cp-anim` rule + the global rule in index.css. Edits are isolated to
 * `src/themes/cyberpunk/`.
 */

const CYBERPUNK_DARK = {
  ...BASE_DARK,
  bg: "8 9 22", // deep indigo-black night alley
  surface: "16 18 40", // panel — lit shopfront glass
  surfaceRaised: "26 30 58", // elevated / neon-lit panel
  surfaceMuted: "11 12 28", // subtle fills / wet asphalt
  border: "52 66 120", // dim electric-blue hairline
  borderStrong: "94 226 255", // bright neon-cyan rule / ink line
  textPrimary: "228 240 255", // bright neon white-blue
  textSecondary: "154 198 234",
  textMuted: "142 168 210",
  accent: "34 224 255", // electric cyan (primary neon)
  accentHover: "120 240 255",
  accentContrast: "5 10 22", // near-black on cyan
  accent2: "255 92 196", // hot magenta / pink (secondary neon)
  accent2Hover: "255 138 214",
  gold: "245 220 90", // warm amber window / streetlamp glow
  success: "56 240 170", // neon mint-green ("open")
  successSoft: "10 40 34",
  danger: "255 96 132", // neon hot-pink-red
  dangerSoft: "48 14 26",
  warning: "255 190 96", // sodium-lamp amber
  bull: "56 240 170",
  bear: "255 96 132",
  texGrid: "40 74 140", // electric-blue grid on the night
  grainOpacity: "0.06",
};

const CYBERPUNK_LIGHT = {
  ...BASE_LIGHT,
  bg: "231 233 249", // pale lavender-cyan dusk haze
  surface: "241 242 252",
  surfaceRaised: "250 250 255",
  surfaceMuted: "216 222 242",
  border: "182 196 226",
  borderStrong: "16 30 74", // deep ink rule
  textPrimary: "12 18 46", // deep navy near-black
  textSecondary: "44 56 100",
  textMuted: "72 86 128",
  accent: "6 104 136", // deep saturated cyan (AA as text)
  accentHover: "4 84 112",
  accentContrast: "240 252 255", // near-white on deep cyan
  accent2: "178 20 128", // deep neon magenta (AA as text)
  accent2Hover: "150 16 106",
  gold: "150 106 16",
  success: "8 106 82", // deep neon-teal green (AA as text)
  successSoft: "210 236 226",
  danger: "188 26 76", // deep neon pink-red (AA as text)
  dangerSoft: "246 216 224",
  warning: "146 84 12",
  bull: "8 106 82",
  bear: "188 26 76",
  texGrid: "150 184 224", // electric-blue grid on pale base
  grainOpacity: "0.04",
};

export const cyberpunkTheme: Theme = {
  id: "cyberpunk",
  label: "Cyberpunk",
  description:
    "A neon night-city back-alley — electric cyan + hot magenta signs on wet blue-black streets.",
  colors: { light: CYBERPUNK_LIGHT, dark: CYBERPUNK_DARK },
  typography: {
    ...BASE_TYPOGRAPHY,
    display: '"Orbitron", "Chakra Petch", ui-monospace, monospace',
    body: '"Rajdhani", "Chakra Petch", system-ui, -apple-system, sans-serif',
    mono: '"Share Tech Mono", "IBM Plex Mono", ui-monospace, monospace',
    fontLinks: [
      "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap",
    ],
  },
  shape: {
    ...BASE_SHAPE,
    radiusSm: "1px",
    radius: "2px",
    radiusMd: "4px",
  },
  Background: CyberpunkBackground,
  MapBackground: CyberpunkMapBackground,
  getLevelIllustration: getCyberpunkIllustration,
  getMapStation: getCyberpunkStation,
  celebration: celebrateCyberpunk,
  TableOfContents: CyberpunkTableOfContents,
  Dashboard: CyberpunkDashboard,
};
