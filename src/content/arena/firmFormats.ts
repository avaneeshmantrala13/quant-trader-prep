/**
 * content/arena/firmFormats.ts — dated, confidence-scored firm attribution for
 * Speed Arena formats (interim stand-in).
 *
 * WHY THIS EXISTS: firm names must NOT be baked into arena UI as fact. Which
 * firms use which assessment format changes over time and is only ever
 * community-reported to us, so the linkage lives here as plain data — each entry
 * carries an as-of date, a confidence score, and an explicit "community-reported;
 * may be outdated" caveat. Components render it clearly marked as community lore,
 * never as a verified claim.
 *
 * This is a deliberate interim layer: the planned Assessment-Freshness Engine
 * (PRD backlog) will eventually supply live, sourced data and should replace the
 * hard-coded entries below without changing the shape components consume.
 *
 * Everything here is static, local, Free-tier data — no network, no backend.
 */
import type { ArenaMode } from "@/lib/arena/config";

/** How much we trust a community-reported firm↔format linkage. */
export type AttributionConfidence = "low" | "medium" | "high";

/**
 * A community-reported linkage between an arena format and the firms said to use
 * it. `asOf` is an ISO year-month stamp for when this was last believed current;
 * `confidence` reflects how corroborated the reports are. The caveat is surfaced
 * verbatim so the UI can never present this as verified fact.
 */
export interface FirmFormatAttribution {
  /** Stable, human-readable format id (decoupled from the internal preset mode). */
  formatId: string;
  /** The generic, firm-neutral display name of the format. */
  formatLabel: string;
  /** Firms COMMUNITY-REPORTED to use a format like this. Not verified. */
  firms: string[];
  /** ISO year-month (YYYY-MM) this attribution was last believed current. */
  asOf: string;
  confidence: AttributionConfidence;
  /** Standing disclaimer rendered alongside the attribution. */
  caveat: string;
  /** Provenance marker — always community-sourced for this interim layer. */
  source: "community-reported";
}

const COMMUNITY_CAVEAT =
  "Community-reported; may be outdated. Firms change their assessments without notice — treat this as informal lore, not a verified fact.";

/**
 * Attribution keyed by the internal arena `mode`. Only formats with a plausible
 * real-world firm linkage appear; a mode with no entry (e.g. custom) simply has
 * no badge. The `optiver` mode maps to the generic 80/8 sprint format.
 */
export const FIRM_FORMATS: Partial<Record<ArenaMode, FirmFormatAttribution>> = {
  optiver: {
    formatId: "80-8-mental-math-sprint",
    formatLabel: "80/8 Mental-Math Sprint",
    firms: ["Optiver", "and other market makers"],
    asOf: "2026-07",
    confidence: "low",
    caveat: COMMUNITY_CAVEAT,
    source: "community-reported",
  },
  zetamac: {
    formatId: "fixed-window-zetamac",
    formatLabel: "Fixed-Window Arithmetic",
    firms: ["Jane Street", "and other quant desks"],
    asOf: "2026-07",
    confidence: "low",
    caveat: COMMUNITY_CAVEAT,
    source: "community-reported",
  },
};

/** Lookup the community-reported firm attribution for an arena mode, if any. */
export function firmFormatFor(
  mode: ArenaMode,
): FirmFormatAttribution | undefined {
  return FIRM_FORMATS[mode];
}

/**
 * Render-ready one-line summary of who reportedly uses a format, e.g.
 * "Reportedly used by Optiver and other market makers". Pure string helper so
 * components stay declarative.
 */
export function firmSummary(a: FirmFormatAttribution): string {
  if (a.firms.length === 0) return "Reportedly used in industry screens";
  return `Reportedly used by ${joinFirms(a.firms)}`;
}

function joinFirms(firms: string[]): string {
  if (firms.length === 1) return firms[0];
  if (firms.length === 2) return `${firms[0]} ${firms[1]}`;
  return `${firms.slice(0, -1).join(", ")}, ${firms[firms.length - 1]}`;
}
