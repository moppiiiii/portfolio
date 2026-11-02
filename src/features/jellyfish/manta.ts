import type { GliderOptions, GliderSettings } from './glider'
import { Glider } from './glider'
import type { Bounds } from './jellyfish'

/**
 * A manta ray seen from above. It glides in wide curves, beating its wings slowly: each beat runs
 * as a wave from the body out to the wing tips, and a raised wing looks narrower from above.
 * The shape is drawn in the ray's own frame, `forward` along its heading and `across` to its
 * right, in shares of its wingspan (its size).
 */

export const MANTA: GliderSettings = {
  sizeShare: 0.45,
  cruise: 0.13,
  burst: 0.7,
  // Rays bank round in wide curves.
  turnRate: 0.55,
  edgeMargin: 0.28,
  // Wide, as their long tails and broad wings reach well past their middles.
  separation: 1.6,
  notice: 0.7,
  frightDecay: 1.4,
}
/** Seconds per wing beat at rest, and how much faster a fright makes them. */
const BEAT_TIME = 3.2
const FRIGHT_BEAT = 1.6

/**
 * Right half of the body's outline, from the head round the wing tip to the root of the tail:
 * [forward, across] in wingspans. The left half mirrors it. The tip is swept back to a point and
 * the trailing edge curves in toward it, giving the crescent wing of a manta.
 */
const OUTLINE: readonly (readonly [number, number])[] = [
  [0.2, 0],
  [0.205, 0.06],
  [0.17, 0.12],
  [0.12, 0.22],
  [0.05, 0.33],
  [-0.03, 0.43],
  [-0.11, 0.52],
  [-0.1, 0.44],
  [-0.12, 0.32],
  [-0.16, 0.2],
  [-0.22, 0.1],
  [-0.27, 0.04],
  [-0.3, 0],
]
/** Where the tail ends, behind the body, in wingspans. */
const TAIL_END = -0.95
/** The pale marks on the shoulders: centre [forward, across] and radii, in wingspans. */
const SHOULDER = { forward: 0.07, across: 0.15, long: 0.06, wide: 0.075 }
/** The eyes, at the sides of the head. */
const EYE: readonly [number, number] = [0.165, 0.105]

type Point = { x: number; y: number }

export class Manta extends Glider {
  /** Wing beat, in radians. */
  beat: number

  constructor(bounds: Bounds, options: GliderOptions) {
    super(bounds, options, MANTA)
    this.beat = this.random() * Math.PI * 2
  }

  /** Its wingspan (px). */
  get span(): number {
    return this.size
  }

  /** Each downstroke pushes it on; between strokes it glides. */
  protected stroke(dt: number, fright: number): number {
    const beatTime = BEAT_TIME / (1 + FRIGHT_BEAT * fright)
    this.beat += (dt / beatTime) * Math.PI * 2
    return 0.8 + 0.4 * Math.max(0, Math.sin(this.beat))
  }

  /**
   * The body's outline this moment, all the way round, in its water. Each wing is narrowed where
   * the beat has raised it, the wave reaching the tip last, and the inner wing of a turn dips.
   */
  outline(): Point[] {
    const wing = (side: 1 | -1) =>
      OUTLINE.map(([forward, across]) => {
        const out = across / 0.5
        const wave = Math.sin(this.beat - out * 1.6)
        const raised = (1 + wave) / 2 + this.bank * side * 0.25
        const narrow = 1 - 0.18 * out * out * Math.min(1, Math.max(0, raised))
        return this.toWorld(
          forward - 0.035 * out * out * wave,
          across * narrow * side,
        )
      })
    // Round the right wing from the head to the tail, then back up the left one.
    const around = wing(1)
    const left = wing(-1)
    for (let i = left.length - 1; i >= 0; i--) around.push(left[i])
    return around
  }

  /** The tail, from its root to its tip, swaying slowly. */
  tail(): Point[] {
    const points: Point[] = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      const forward = -0.3 + (TAIL_END + 0.3) * t
      const sway = 0.05 * t * t * Math.sin(this.beat * 0.5 + t * 2.5)
      points.push(this.toWorld(forward, sway))
    }
    return points
  }

  /** The shoulder marks: centres in its water, with radii (px) and the heading they lie along. */
  shoulders() {
    return ([1, -1] as const).map((side) => {
      const at = this.toWorld(SHOULDER.forward, SHOULDER.across * side)
      return {
        x: at.x,
        y: at.y,
        long: SHOULDER.long * this.size,
        wide: SHOULDER.wide * this.size,
        angle: this.heading + side * 0.5,
      }
    })
  }

  /** The two horn-like fins in front of the mouth. */
  horns() {
    return ([1, -1] as const).map((side) => {
      const at = this.toWorld(0.26, 0.07 * side)
      return {
        x: at.x,
        y: at.y,
        long: 0.075 * this.size,
        wide: 0.024 * this.size,
        angle: this.heading + side * 0.2,
      }
    })
  }

  /** Where the eyes are, in its water. */
  eyes(): Point[] {
    return [this.toWorld(EYE[0], EYE[1]), this.toWorld(EYE[0], -EYE[1])]
  }
}
