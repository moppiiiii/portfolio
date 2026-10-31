/** A ripple spreading from a click or tap. Each one gets its own random shape. */
export type Ripple = {
  x: number
  y: number
  age: number
  /** Multiplier on the spreading speed, so no two ripples move alike. */
  speed: number
  /** Random phases that bend the rings and vary their strength around the circle. */
  phases: readonly [number, number, number, number]
}

/** Result of `sampleRipples` for one point. */
export type RippleSample = {
  /** How far (px) the view behind this point is shifted by refraction. */
  dx: number
  dy: number
  /** Faint brightness of the wave crest itself, 0 to about 0.1. */
  light: number
}

/** Seconds from the click until the last ring has faded. */
export const RIPPLE_LIFETIME = 2.2
/** How far the first ring travels per second, as a share of the screen's shorter side. */
const RING_SPEED_SHARE = 0.26
/** Each click sends out two rings, the second later and weaker. */
const RING_DELAYS = [0, 0.24]
const RING_STRENGTHS = [1, 0.45]
/** How far a ring's radius wanders around the circle, as a share of the radius. */
const WOBBLE = 0.07
/** Thickness of a ring's wave, as a share of the screen's shorter side. */
const RING_WIDTH_SHARE = 0.03
/** Largest shift of the view behind a ring, as a share of the screen's shorter side. */
const REFRACTION_SHARE = 0.03
/**
 * Brightness the wave crest adds on its own. Kept low: a ripple should show mostly by bending
 * the jellyfish behind it, the way real water does, not by drawing a line over them.
 */
const CREST_LIGHT = 0.1
/** Beyond this many ring widths from its centre line, a ring has no visible effect. */
const RING_REACH = 3

function randomPhase(): number {
  return Math.random() * Math.PI * 2
}

export function createRipple(x: number, y: number): Ripple {
  return {
    x,
    y,
    age: 0,
    speed: 0.85 + Math.random() * 0.3,
    phases: [randomPhase(), randomPhase(), randomPhase(), randomPhase()],
  }
}

/** Radius of `ring` before bending, and its strength (0-1); `undefined` once it has faded. */
function ringState(
  ripple: Ripple,
  ring: number,
  shortSide: number,
): { radius: number; strength: number } | undefined {
  const delay = RING_DELAYS[ring]
  const age = ripple.age - delay
  const life = age / (RIPPLE_LIFETIME - delay)
  if (age <= 0 || life >= 1) return undefined
  // Rings slow down slightly as they spread, and fade out towards the end.
  const radius =
    shortSide * RING_SPEED_SHARE * ripple.speed * age * (1 - 0.25 * life)
  return { radius, strength: RING_STRENGTHS[ring] * (1 - life) ** 1.5 }
}

/** How much the rings of `ripple` bulge out (above 1) or dip in (below 1) at `angle`. */
export function ringBend(ripple: Ripple, angle: number): number {
  const [a, b, c] = ripple.phases
  return (
    1 +
    WOBBLE *
      (0.5 * Math.sin(3 * angle + a) +
        0.3 * Math.sin(5 * angle + b) +
        0.2 * Math.sin(8 * angle + c))
  )
}

/** Strength multiplier at `angle`, from 0.1 to 1, so parts of each ring nearly vanish. */
export function ringPatch(ripple: Ripple, angle: number): number {
  const [a, , , d] = ripple.phases
  return 0.55 + 0.45 * Math.sin(2 * angle + d) * Math.sin(3 * angle - a)
}

/** Calls `visit` for each ring of `ripple` still visible, with its unbent radius and strength. */
export function forEachRing(
  ripple: Ripple,
  shortSide: number,
  visit: (radius: number, strength: number) => void,
): void {
  for (let ring = 0; ring < RING_DELAYS.length; ring++) {
    const state = ringState(ripple, ring, shortSide)
    if (state) visit(state.radius, state.strength)
  }
}

/**
 * A ripple's state for one frame. It is worked out once per frame by `prepareRipples`, so that
 * sampling thousands of points does not repeat it.
 */
export type RippleFrame = {
  ripple: Ripple
  /** Points further than this from the centre are untouched. */
  reach: number
  /** Points closer than this to the centre are untouched: the rings have already passed. */
  inside: number
  /** Unbent radius and strength of each ring. Strength is 0 for a ring not started or faded. */
  radii: number[]
  strengths: number[]
}

/** Works out this frame's state of every ripple still visible. */
export function prepareRipples(
  ripples: readonly Ripple[],
  shortSide: number,
): RippleFrame[] {
  const width = shortSide * RING_WIDTH_SHARE
  const frames: RippleFrame[] = []
  for (const ripple of ripples) {
    const radii: number[] = []
    const strengths: number[] = []
    let outer = -1
    let inner = Infinity
    for (let ring = 0; ring < RING_DELAYS.length; ring++) {
      const state = ringState(ripple, ring, shortSide)
      radii.push(state?.radius ?? 0)
      strengths.push(state?.strength ?? 0)
      if (state) {
        outer = Math.max(outer, state.radius)
        inner = Math.min(inner, state.radius)
      }
    }
    if (outer < 0) continue
    frames.push({
      ripple,
      reach: outer * (1 + WOBBLE) + width * RING_REACH,
      inside: inner * (1 - WOBBLE) - width * RING_REACH,
      radii,
      strengths,
    })
  }
  return frames
}

/**
 * Works out what the ripples do at (x, y): how far they shift the view behind the point, and how
 * much the wave crest brightens it. A ring acts as a lens: just inside and just outside its crest,
 * the view is pushed in opposite directions, following the slope of the wave.
 */
export function sampleRipples(
  frames: readonly RippleFrame[],
  shortSide: number,
  x: number,
  y: number,
  out: RippleSample,
): void {
  out.dx = 0
  out.dy = 0
  out.light = 0
  const width = shortSide * RING_WIDTH_SHARE
  const refraction = shortSide * REFRACTION_SHARE

  for (const frame of frames) {
    const { ripple } = frame
    const offsetX = x - ripple.x
    const offsetY = y - ripple.y
    const distance = Math.hypot(offsetX, offsetY)
    // Most of the screen lies outside the band the rings cover right now.
    if (distance > frame.reach || distance < frame.inside) continue

    const angle = Math.atan2(offsetY, offsetX)
    const bend = ringBend(ripple, angle)
    const patch = ringPatch(ripple, angle)
    const directionX = distance > 0 ? offsetX / distance : 0
    const directionY = distance > 0 ? offsetY / distance : 0

    for (let ring = 0; ring < frame.radii.length; ring++) {
      const strength = frame.strengths[ring]
      if (strength === 0) continue
      const across = (distance - frame.radii[ring] * bend) / width
      if (Math.abs(across) > RING_REACH) continue
      const envelope = Math.exp(-across * across)
      const amplitude = strength * patch
      const shift = refraction * amplitude * -2 * across * envelope
      out.dx += directionX * shift
      out.dy += directionY * shift
      out.light += CREST_LIGHT * amplitude * envelope
    }
  }
}
