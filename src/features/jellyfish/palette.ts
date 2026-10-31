export type Palette = {
  /** Background colour of the water. */
  water: string
  /** Main colour for every line and glyph. */
  ink: string
  /** Second colour, used for the gonads inside the bell. */
  accent: string
  /** Whether marks glow, as in the dark (deep-sea) theme. */
  glow: boolean
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
    glow: read('--jelly-glow', '0') === '1',
  }
}
