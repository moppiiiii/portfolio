import type { Jellyfish } from './jellyfish'
import type { Palette } from './palette'
import type { Ripple } from './ripple'

/** Draws a group of jellyfish onto a 2D canvas. */
export interface JellyfishRenderer {
  /** Called whenever the canvas size or pixel ratio changes. Sizes are in CSS pixels. */
  resize(width: number, height: number, pixelRatio: number): void
  setPalette(palette: Palette): void
  /**
   * Draws one frame. `group` must be ordered from the furthest jellyfish to the nearest.
   * `ripples` are drawn over the jellyfish.
   */
  render(
    ctx: CanvasRenderingContext2D,
    group: readonly Jellyfish[],
    ripples: readonly Ripple[],
  ): void
}

/** Opacity multiplier for a jellyfish at `depth` (0 = furthest, 1 = nearest). */
export function depthFade(depth: number): number {
  return 0.35 + 0.65 * depth
}
