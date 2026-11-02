import type { GliderOptions, GliderSettings } from './glider'
import { Glider } from './glider'
import type { Bounds } from './jellyfish'

/**
 * A sea turtle seen from above. It rows with its long front flippers, sweeping them back
 * together and gliding between strokes, and steers with its small rear ones. The shape is drawn
 * in its own frame, `forward` along its heading and `across` to its right, in shares of its
 * shell's length (its size).
 */

export const TURTLE: GliderSettings = {
  sizeShare: 0.2,
  cruise: 0.32,
  burst: 1.4,
  turnRate: 0.7,
  edgeMargin: 0.22,
  separation: 2.2,
  notice: 1.2,
  frightDecay: 1.2,
}
/** Seconds per flipper stroke at rest, and how much faster a fright makes them. */
const STROKE_TIME = 2.6
const FRIGHT_STROKE = 1.4

/** An oval part of the body: centre in its water, radii (px) and the direction it lies along. */
export type Part = {
  x: number
  y: number
  long: number
  wide: number
  angle: number
}

export class SeaTurtle extends Glider {
  /** Where the flippers are in their stroke, in radians. */
  paddle: number

  constructor(bounds: Bounds, options: GliderOptions) {
    super(bounds, options, TURTLE)
    this.paddle = this.random() * Math.PI * 2
  }

  /** The front flippers' sweep pushes it on; between strokes it glides. */
  protected stroke(dt: number, fright: number): number {
    const strokeTime = STROKE_TIME / (1 + FRIGHT_STROKE * fright)
    this.paddle += (dt / strokeTime) * Math.PI * 2
    return 0.7 + 0.6 * Math.max(0, Math.sin(this.paddle))
  }

  /** An oval at [forward, across] (shell lengths), `along` radians off its heading. */
  private part(
    forward: number,
    across: number,
    long: number,
    wide: number,
    along: number,
  ): Part {
    const at = this.toWorld(forward, across)
    return {
      x: at.x,
      y: at.y,
      long: long * this.size,
      wide: wide * this.size,
      angle: this.heading + along,
    }
  }

  /** The shell, slightly longer than wide. */
  shell(): Part {
    return this.part(0, 0, 0.5, 0.4, 0)
  }

  /**
   * The plates of the shell: a row down the middle and one either side, drawn a little brighter
   * than the shell so its pattern shows.
   */
  plates(): Part[] {
    const plates: Part[] = []
    for (const forward of [0.26, 0.09, -0.08, -0.25]) {
      plates.push(this.part(forward, 0, 0.075, 0.09, 0))
      for (const side of [1, -1]) {
        plates.push(this.part(forward * 0.9, 0.2 * side, 0.07, 0.07, 0))
      }
    }
    return plates
  }

  /** The head, reaching out in front of the shell. */
  head(): Part {
    return this.part(0.62, 0, 0.16, 0.11, 0)
  }

  /**
   * The four flippers. The front ones sweep from reaching forward to lying back along the shell
   * with each stroke; the rear ones trail and paddle a little.
   */
  flippers(): Part[] {
    const sweep = Math.sin(this.paddle)
    const parts: Part[] = []
    for (const side of [1, -1] as const) {
      // Out to the side and forward at the start of a stroke, swept back at its end.
      const angle = side * (1.1 - 0.75 * sweep)
      const root = this.toWorld(0.28, 0.33 * side)
      const reach = 0.24 * this.size
      parts.push({
        x: root.x + Math.cos(this.heading + angle) * reach,
        y: root.y + Math.sin(this.heading + angle) * reach,
        long: 0.27 * this.size,
        wide: 0.07 * this.size,
        angle: this.heading + angle,
      })
      parts.push(
        this.part(
          -0.42,
          0.22 * side,
          0.12,
          0.06,
          side * (2.4 + 0.2 * Math.sin(this.paddle + 1)),
        ),
      )
    }
    return parts
  }

  /** Where the eyes are, in its water. */
  eyes(): { x: number; y: number }[] {
    return [this.toWorld(0.66, 0.07), this.toWorld(0.66, -0.07)]
  }
}
