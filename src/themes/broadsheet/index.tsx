import { DeskBackground } from "@/components/visuals/DeskBackground";
import type { Theme } from "../types";
import { BASE_DARK, BASE_LIGHT, BASE_SHAPE, BASE_TYPOGRAPHY } from "../base";
import { getBroadsheetStation } from "./stations";
import { BroadsheetMapBackground } from "./MapBackground";
import { BroadsheetTableOfContents } from "./TableOfContents";
import { BroadsheetDashboard } from "./Dashboard";

/**
 * The default theme — "a trader's desk rendered as a financial broadsheet"
 * (Bloomberg terminal × FT print). This is the reference implementation: it
 * simply wires the base tokens + the DeskBackground into the theme contract.
 */

// Integration fix (AA): the base dark MUTED token was borderline (~4.25–4.49)
// as the small de-emphasized ".num" question-count text on this theme's
// paper-gradient map board. Lightened slightly (same warm-tan cast) to clear
// WCAG-AA here without touching the shared base (which other themes build on).
// Still well below the secondary/primary tan, so the muted hierarchy holds.
const DARK = {
  ...BASE_DARK,
  textMuted: "150 138 115",
};

export const broadsheetTheme: Theme = {
  id: "broadsheet",
  label: "Broadsheet",
  description:
    "A trader's desk rendered as a financial broadsheet — Bloomberg terminal × Financial Times print.",
  colors: { light: BASE_LIGHT, dark: DARK },
  typography: BASE_TYPOGRAPHY,
  shape: BASE_SHAPE,
  Background: DeskBackground,
  MapBackground: BroadsheetMapBackground,
  getMapStation: getBroadsheetStation,
  TableOfContents: BroadsheetTableOfContents,
  Dashboard: BroadsheetDashboard,
};
