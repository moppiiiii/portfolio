import type { GliderOptions, GliderSettings } from './glider'
import { Glider } from './glider'
import type { Bounds } from './jellyfish'

/**
 * A manta ray seen from above. It sweeps round in wide curves, beating its wings slowly a few
 * times and then gliding on them spread: each beat runs as a wave from the body out to the wing
 * tips, and a raised wing looks narrower from above.
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
  separation: 1.8,
  notice: 0.7,
  frightDecay: 1.4,
  sweep: { radius: 0.55, lead: 2.2, ease: 1.1, wander: 0.35 },
}
/** Seconds per wing beat at rest, and how much faster a fright makes them. */
const BEAT_TIME = 3.2
const FRIGHT_BEAT = 1.6
/** How many beats it gives in a row, and for how many seconds it then glides. */
const BEATS = { least: 2, most: 4 }
const GLIDE_TIME = { least: 2.5, most: 6 }
/** Seconds for its beating to die away into a glide, or to start up again. */
const SETTLE_TIME = 0.9
/** How much one beat's length can differ from the usual, either way. */
const BEAT_SPREAD = 0.12
/** How far the tail bends to follow it round a turn, in wingspans. */
const TAIL_BEND = 0.12

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
  /** How hard it beats its wings right now: 1 beating, 0 gliding on them spread. */
  private flapping = 1
  /** Whether it means to beat or to glide, and for how many more seconds. */
  private beating = true
  private boutLeft: number
  /** This beat's length, as a share of the usual. */
  private beatLength = 1

  constructor(bounds: Bounds, options: GliderOptions) {
    super(bounds, options, MANTA)
    this.beat = this.random() * Math.PI * 2
    this.boutLeft = this.beatBout() * this.random()
  }

  /** Its wingspan (px). */
  get span(): number {
    return this.size
  }

  /**
   * Each downstroke pushes it on. After a few beats it holds its wings spread and glides,
   * slowing a little, until it beats again; a fright keeps it beating.
   */
  protected stroke(dt: number, fright: number): number {
    this.boutLeft -= dt
    if (this.boutLeft <= 0) {
      this.beating = !this.beating
      this.boutLeft = this.beating
        ? this.beatBout()
        : GLIDE_TIME.least +
          (GLIDE_TIME.most - GLIDE_TIME.least) * this.random()
    }
    const wanted = this.beating || fright > 0.15 ? 1 : 0
    this.flapping +=
      (wanted - this.flapping) * (1 - Math.exp(-dt / SETTLE_TIME))

    const beatTime = (BEAT_TIME * this.beatLength) / (1 + FRIGHT_BEAT * fright)
    const before = Math.floor(this.beat / (Math.PI * 2))
    // Gliding, the wave runs on slowly as the wings settle.
    this.beat += (dt / beatTime) * Math.PI * 2 * (0.35 + 0.65 * this.flapping)
    if (Math.floor(this.beat / (Math.PI * 2)) !== before) {
      this.beatLength = 1 + BEAT_SPREAD * (this.random() * 2 - 1)
    }
    return 0.8 + this.flapping * (0.1 + 0.4 * Math.max(0, Math.sin(this.beat)))
  }

  /** Seconds for a run of a few beats. */
  private beatBout(): number {
    const beats = BEATS.least + (BEATS.most - BEATS.least) * this.random()
    return beats * BEAT_TIME
  }

  /**
   * The body's outline this moment, all the way round, in its water. Each wing is narrowed where
   * the beat has raised it, the wave reaching the tip last, and the inner wing of a turn dips.
   * Gliding, the wings lie spread.
   */
  outline(): Point[] {
    const wing = (side: 1 | -1) =>
      OUTLINE.map(([forward, across]) => {
        const out = across / 0.5
        const wave =
          Math.sin(this.beat - out * 1.6) * (0.15 + 0.85 * this.flapping)
        const raised =
          ((1 + wave) / 2) * this.flapping + this.bank * side * 0.25
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

  /** The tail, from its root to its tip, swaying slowly and bending to follow it round a turn. */
  tail(): Point[] {
    const points: Point[] = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      const forward = -0.3 + (TAIL_END + 0.3) * t
      const sway = 0.05 * t * t * Math.sin(this.beat * 0.5 + t * 2.5)
      points.push(this.toWorld(forward, sway + TAIL_BEND * this.bank * t * t))
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
