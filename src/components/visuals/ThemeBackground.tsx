import { useTheme } from "@/context/ThemeContext";
import { DeskBackground } from "./DeskBackground";

/**
 * AMBIENT BACKGROUND TOGGLE.
 *
 * A single, app-wide subtle "ledger dot-grid" field rendered behind all content
 * (see {@link PaperField}). Flip this to `false` to remove it everywhere — the
 * app falls back to the plain themed page color with zero other changes.
 */
const SHOW_AMBIENT_FIELD = false;

/**
 * The chosen tasteful background: a faint **dot-grid on paper**, edge-faded.
 *
 * WHY this one (researched, and why it reads as original / non-AI):
 * - It's the "graph-paper / technical manual" texture — exactly the trader's
 *   *daybook / ledger* metaphor this product is built around, so it's motivated
 *   by the concept rather than a generic hero-gradient.
 * - Pure CSS (one `radial-gradient` + a radial edge-fade `mask`), NO animation
 *   loop and NO GPU cost — it can't jank.
 * - Theme-aware: the dots use the `--tex-grid` token (a hair off the page color)
 *   in BOTH light and dark, so they stay subliminal and never drop text
 *   contrast (text sits on `surface`/`bg`; the dots are ~page-tone and behind
 *   everything, so all WCAG-AA ratios are unaffected).
 * - The radial edge-fade mask makes it feel composed (fading out toward the
 *   margins) instead of a flat tiled wallpaper — the modern, intentional look.
 */
function PaperField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundImage:
          "radial-gradient(circle at center, rgb(var(--tex-grid) / 0.85) 1px, transparent 1.5px)",
        backgroundSize: "22px 22px",
        // Fade the field out toward the edges so it reads as a composed layer,
        // not wall-to-wall wallpaper.
        maskImage:
          "radial-gradient(115% 115% at 50% 30%, black 45%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(115% 115% at 50% 30%, black 45%, transparent 100%)",
      }}
    />
  );
}

/**
 * Renders the active theme's `Background` component (falling back to
 * {@link DeskBackground}), plus the app-wide {@link PaperField}. Use this
 * everywhere a backdrop is needed so themes can swap the ambient visuals — and
 * the tasteful field can be toggled — without touching pages.
 */
export function ThemeBackground() {
  const { themeDef } = useTheme();
  const Background = themeDef.Background ?? DeskBackground;
  return (
    <>
      {SHOW_AMBIENT_FIELD && <PaperField />}
      <Background />
    </>
  );
}
