import { useEffect, useRef, useState } from "react";

/**
 * Shared helper for every theme's tiled MAP BOARD background.
 *
 * The level-map board is `levels × 138px` tall and varies wildly per track — the
 * Probability/Math track alone is dozens of levels (~8000px). Each theme paints
 * its scene as a vertical stack of identical, seamless `TILE_H`-tall tiles that
 * the parent clips. Historically the tile COUNT was a hard-coded constant (e.g.
 * `TILES = 6`, ≈3312px), so on long tracks the artwork simply ran out ~40% down
 * the page (around the Expected Value section) leaving a blank lower half.
 *
 * This hook makes the tile count track the layer's ACTUAL rendered height: attach
 * the returned `ref` to the full-height background root (an `absolute inset-0`
 * element inside the `position: relative`, `height: totalHeight` board), and it
 * returns how many tiles are needed to cover it — `ceil(height / tileH) + 1`, so
 * the bottom seam is always filled — recomputing via a `ResizeObserver` whenever
 * the board grows or shrinks. This works for tracks of any length: short tracks
 * still fill the viewport, and very long tracks fill the entire scroll height,
 * with a bounded, performant number of tiles (no per-level node explosion).
 *
 * @param tileH   The theme's tile height in px (the `TILE_H` constant).
 * @param minTiles Tiles to render before/without measurement (keeps the first
 *                 paint covered and guarantees viewport coverage on short boards).
 */
export function useMapTiles(tileH: number, minTiles = 6) {
  const ref = useRef<HTMLDivElement>(null);
  const [tiles, setTiles] = useState(minTiles);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const h = el.clientHeight || el.getBoundingClientRect().height;
      // +1 tile so the final seam is always covered as the board grows.
      const needed = Math.max(minTiles, Math.ceil(h / tileH) + 1);
      setTiles((prev) => (prev === needed ? prev : needed));
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tileH, minTiles]);

  return [ref, tiles] as const;
}
