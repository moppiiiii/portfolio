export type Palette = {
  /** Background colour of the water. */
  water: string
  /** Main colour for every line and glyph. */
  ink: string
  /** Second colour, used for the gonads inside the bell. */
  accent: string
  /** Goldfish orange, for the patches and fins of the goldfish. */
  gold: string
  /** Light the ocean tank's floor gives back, added to the water (black for none). */
  seabed: string
  /** Shadows cast on the ocean tank's floor, and their opacity where darkest. */
  shadow: string
  shadowAlpha: number
  /** Whether marks glow, as in the dark (deep-sea) theme. */
  glow: boolean
  /** Opacity of the square behind a fully lit character cell, 0 for none. */
  tile: number
  /**
   * Gap (px) left around each square. With a gap, the squares read as glowing cells on dark water;
   * without, they join into a soft wash of colour under the characters, as on a tinted print.
   */
  tileGap: number
  /** Font weight of the characters. Ink on paper needs more weight than glowing marks. */
  weight: number
  /**
   * Exponent applied to a cell's brightness when setting how strongly its character is inked
   * (not which character it is). Below 1 darkens the faint characters of the tentacles and lower
   * bell, which glow enough on dark water but fade to grey on paper.
   */
  lift: number
}

/**
 * Reads the stage colours from CSS custom properties on `element`, so the stylesheet stays the
 * only place colours are defined.
 */
export function readPalette(element: Element): Palette {
  const style = getComputedStyle(element)
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback
  return {
    water: read('--jelly-water', '#efe8d8'),
    ink: read('--jelly-ink', '#24324a'),
    accent: read('--jelly-accent', '#b5523b'),
    gold: read('--jelly-gold', '#d9822b'),
    seabed: read('--jelly-seabed', '#000000'),
    shadow: read('--jelly-shadow', '#6b5a3c'),
    shadowAlpha: Number(read('--jelly-shadow-alpha', '0')) || 0,
    glow: read('--jelly-glow', '0') === '1',
    tile: Number(read('--jelly-tile', '0')) || 0,
    tileGap: Number(read('--jelly-tile-gap', '1')) || 0,
    weight: Number(read('--jelly-weight', '600')) || 600,
    lift: Number(read('--jelly-lift', '1')) || 1,
  }
}
