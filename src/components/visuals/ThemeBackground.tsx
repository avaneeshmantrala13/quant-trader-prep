import { useTheme } from "@/context/ThemeContext";
import { DeskBackground } from "./DeskBackground";

/**
 * Renders the active theme's `Background` component, falling back to the default
 * DeskBackground when a theme doesn't supply one. Use this everywhere a backdrop
 * is needed so themes can swap the ambient visuals without touching pages.
 */
export function ThemeBackground() {
  const { themeDef } = useTheme();
  const Background = themeDef.Background ?? DeskBackground;
  return <Background />;
}
