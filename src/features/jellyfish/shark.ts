import type { Bounds } from './jellyfish'

/**
 * A shark seen from above. Its body bends along its spine as it turns: the head swims and each
 * point behind follows the one ahead, and the tail's sweep swings the head from side to side.
 * What sets one kind apart (its shape, its fins, its pace) is in its `SharkKind`. Lengths are
 * shares of the screen's shorter side.
 */

const SPINE_POINTS = 16
/** Distance, in sizes (the pair's average), within which it steers away from another creature. */
const SEPARATION = 1

type Point = { x: number; y: number }

export type SharkKind = {
  /** Half the body's width at its widest, as a share of its length. */
  halfWidth: number
  /** Half the body's width at `along` (0 at the snout, 1 at the tail's root), as a share of the widest. */
  profile: (along: number) => number
  /** Length of the tail fin beyond the body, as a share of the body's length. */
  tailShare: number
  /** Cruising speed, in body lengths per second, and the most a fright adds. */
  cruise: number
  burst: number
  /** Fastest turn (rad/s). */
  turnRate: number
  /** Seconds per tail sweep, and how far each sweep swings the head (rad). */
  sweepTime: number
  sweepSwing: number
  /** Margin, as a share of the shorter side, inside which its head turns away from the edge. */
  edgeMargin: number
  /** Seconds for a fright to fade to about a third. */
  frightDecay: number
  /**
   * Side fins: where along the body their front edge starts, their tip lies and their back edge
   * ends, and how far the tip reaches out, in half widths of the body.
   */
  fins: { front: number; tip: number; back: number; reach: number }
  /** Whether rows of pale spots cover its back. */
  spotted: boolean
  /** Half the span of a hammer-shaped head across the snout, as a share of its length; 0 for none. */
  hammer: number
}

/**
 * A whale shark: a broad, flat head cut square at the snout, a long body narrowing to the tail,
 * big side fins and rows of pale spots. It cruises very slowly and comes round in long curves.
 */
export const WHALE_SHARK: SharkKind = {
  halfWidth: 0.1,
  profile: (along) => {
    const t = Math.min(1, Math.max(0, along))
    if (t < 0.18) return 0.78 + 0.22 * Math.sin((t / 0.18) * (Math.PI / 2))
    return 1 - 0.85 * ((t - 0.18) / 0.82) ** 1.15
  },
  tailShare: 0.26,
  cruise: 0.05,
  burst: 0.12,
  turnRate: 0.22,
  sweepTime: 4.2,
  sweepSwing: 0.09,
  edgeMargin: 0.3,
  frightDecay: 2,
  fins: { front: 0.2, tip: 0.42, back: 0.32, reach: 2.4 },
  spotted: true,
  hammer: 0,
}

/**
 * A hammerhead shark: a slim body behind a flat, wide head shaped like a hammer, with an eye at
 * each end. It swims faster than the whale shark and sweeps its head from side to side.
 */
export const HAMMERHEAD: SharkKind = {
  halfWidth: 0.085,
  profile: (along) => {
    const t = Math.min(1, Math.max(0, along))
    if (t < 0.3) return 0.45 + 0.55 * Math.sin((t / 0.3) * (Math.PI / 2))
    return 1 - 0.85 * ((t - 0.3) / 0.7) ** 1.1
  },
  tailShare: 0.3,
  cruise: 0.2,
  burst: 0.6,
  turnRate: 0.8,
  sweepTime: 1.6,
  sweepSwing: 0.18,
  edgeMargin: 0.18,
  frightDecay: 1.2,
  // Shorter than the hammer, so the head stays the one T across the body.
  fins: { front: 0.24, tip: 0.4, back: 0.31, reach: 2.4 },
  spotted: false,
  hammer: 0.15,
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export type SharkOptions = {
  x: number
  y: number
  heading: number
  /** Body length (without the tail fin), as a share of the screen's shorter side. */
  lengthShare: number
  /** Whether it shows when its water is seen from afar, as a small tank on the map. */
  shownAfar: boolean
  random?: () => number
}

export class Shark {
  readonly kind: SharkKind
  readonly spine: Point[] = []
  /** Body length (px) and half its width at the widest. */
  length = 0
  halfWidth = 0
  /** Direction its head is heading (screen radians). */
  heading: number
  /** The tail's sweep, in radians. */
  sweep: number
  presence = 1
  readonly shownAfar: boolean
  private visibility = 1
  private speed = 0
  private fright = 0
  private targetX = 0
  private targetY = 0
  private retargetAt = 0
  private time = 0
  private bounds: Bounds
  private readonly lengthShare: number
  private readonly random: () => number

  constructor(bounds: Bounds, kind: SharkKind, options: SharkOptions) {
    this.bounds = bounds
    this.kind = kind
    this.lengthShare = options.lengthShare
    this.shownAfar = options.shownAfar
    this.random = options.random ?? Math.random
    this.heading = options.heading
    this.sweep = this.random() * Math.PI * 2
    this.measure()
    this.speed = kind.cruise * this.length
    for (let i = 0; i < SPINE_POINTS; i++) {
      const back = (i / (SPINE_POINTS - 1)) * this.length
      this.spine.push({
        x: options.x - Math.cos(this.heading) * back,
        y: options.y - Math.sin(this.heading) * back,
      })
    }
    this.pickTarget()
  }

  /** The middle of its body: where others keep clear of. */
  get x(): number {
    return this.spine[Math.floor(SPINE_POINTS / 3)].x
  }

  get y(): number {
    return this.spine[Math.floor(SPINE_POINTS / 3)].y
  }

  /** Length (px) of the tail fin beyond the body. */
  get tailLength(): number {
    return this.length * this.kind.tailShare
  }

  /** How big it is to keep clear of, as the others measure themselves. */
  get size(): number {
    return this.length * 0.8
  }

  setBounds(bounds: Bounds): void {
    this.bounds = bounds
    const before = this.length
    this.measure()
    if (before === 0) return
    const ratio = this.length / before
    const head = this.spine[0]
    for (const point of this.spine) {
      point.x = head.x + (point.x - head.x) * ratio
      point.y = head.y + (point.y - head.y) * ratio
    }
  }

  setVisibility(visibility: number, immediately = false): void {
    this.visibility = visibility
    if (immediately) this.presence = visibility
  }

  /** Moves on by `dt` seconds, its head steering clear of `others` (anything with a place and a size). */
  step(
    dt: number,
    others: readonly { x: number; y: number; size: number }[] = [],
  ): void {
    const { kind } = this
    this.time += dt
    this.presence +=
      (this.visibility - this.presence) * (1 - Math.exp(-dt / 0.35))
    this.fright *= Math.exp(-dt / kind.frightDecay)

    const head = this.spine[0]
    if (
      this.time >= this.retargetAt ||
      Math.hypot(this.targetX - head.x, this.targetY - head.y) <
        this.length * 0.3
    ) {
      this.pickTarget()
    }

    let wantX = this.targetX - head.x
    let wantY = this.targetY - head.y
    const toTarget = Math.hypot(wantX, wantY) || 1
    wantX /= toTarget
    wantY /= toTarget
    const margin =
      Math.min(this.bounds.width, this.bounds.height) * kind.edgeMargin
    const edge = (distance: number) => Math.max(0, 1 - distance / margin) * 3
    wantX += edge(head.x) - edge(this.bounds.width - head.x)
    wantY += edge(head.y) - edge(this.bounds.height - head.y)
    for (const other of others) {
      if (other === this) continue
      const dx = head.x - other.x
      const dy = head.y - other.y
      const distance = Math.hypot(dx, dy) || 1
      const range = (this.size + other.size) * 0.5 * SEPARATION
      if (distance >= range) continue
      const push = (1 - distance / range) * 1.5
      wantX += (dx / distance) * push
      wantY += (dy / distance) * push
    }
    const turn = wrapAngle(Math.atan2(wantY, wantX) - this.heading)
    const rate = kind.turnRate * (1 + this.fright) * dt
    this.heading += Math.max(-rate, Math.min(rate, turn))

    const wanted = this.length * (kind.cruise + kind.burst * this.fright)
    this.speed += (wanted - this.speed) * (1 - Math.exp(-dt / 1.2))
    this.sweep += (dt / kind.sweepTime) * Math.PI * 2 * (1 + this.fright)
    const swim = this.heading + Math.sin(this.sweep) * kind.sweepSwing
    head.x += Math.cos(swim) * this.speed * dt
    head.y += Math.sin(swim) * this.speed * dt

    const segment = this.length / (SPINE_POINTS - 1)
    for (let i = 1; i < this.spine.length; i++) {
      const ahead = this.spine[i - 1]
      const point = this.spine[i]
      const dx = point.x - ahead.x
      const dy = point.y - ahead.y
      const distance = Math.hypot(dx, dy) || 1
      point.x = ahead.x + (dx / distance) * segment
      point.y = ahead.y + (dy / distance) * segment
    }
  }

  /** The pointer passing near its head: it turns away. */
  avoid(x: number, y: number): void {
    this.startle(x, y, 0.4)
  }

  /** A click near its head: it sweeps harder and heads off. */
  disturb(x: number, y: number): void {
    this.startle(x, y, 1)
  }

  /** The spine point at `along` (0 at the snout, 1 at the tail's root) and its normal there. */
  at(
    along: number,
  ): Point & { normalX: number; normalY: number; width: number } {
    const last = this.spine.length - 1
    const index = Math.min(last - 1, Math.floor(along * last))
    const t = along * last - index
    const a = this.spine[index]
    const b = this.spine[index + 1]
    const size = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      normalX: -(b.y - a.y) / size,
      normalY: (b.x - a.x) / size,
      width: this.halfWidth * this.kind.profile(along),
    }
  }

  /**
   * The pale spots over its back, in rows from behind the head to the tail, each row set half a
   * step across from the last, as on a whale shark. None for a kind without spots.
   */
  spots(): Point[] {
    if (!this.kind.spotted) return []
    const spots: Point[] = []
    let row = 0
    for (let along = 0.12; along < 0.86; along += 0.075) {
      const spot = this.at(along)
      const shift = row % 2 === 0 ? 0 : 0.16
      for (const across of [-0.64, -0.32, 0, 0.32, 0.64]) {
        const out = (across + shift) * spot.width
        if (Math.abs(across + shift) > 0.75) continue
        spots.push({
          x: spot.x + spot.normalX * out,
          y: spot.y + spot.normalY * out,
        })
      }
      row++
    }
    return spots
  }

  /**
   * The hammer-shaped head, for a kind that has one: an oval across the snout, with its centre,
   * radii (px) and the direction of its long axis.
   */
  hammerHead() {
    if (this.kind.hammer <= 0) return undefined
    const snout = this.at(0.025)
    return {
      x: snout.x,
      y: snout.y,
      long: this.kind.hammer * this.length,
      wide: 0.05 * this.length,
      angle: Math.atan2(snout.normalY, snout.normalX),
    }
  }

  /** The eyes: at the ends of a hammer, or else at the sides of the head behind the snout. */
  eyes(): Point[] {
    const hammer = this.hammerHead()
    if (hammer) {
      const out = hammer.long * 0.88
      const cos = Math.cos(hammer.angle)
      const sin = Math.sin(hammer.angle)
      return [
        { x: hammer.x + cos * out, y: hammer.y + sin * out },
        { x: hammer.x - cos * out, y: hammer.y - sin * out },
      ]
    }
    const head = this.at(0.05)
    const out = head.width * 0.9
    return [
      { x: head.x + head.normalX * out, y: head.y + head.normalY * out },
      { x: head.x - head.normalX * out, y: head.y - head.normalY * out },
    ]
  }

  private startle(x: number, y: number, strength: number): void {
    const head = this.spine[0]
    const dx = head.x - x
    const dy = head.y - y
    const distance = Math.hypot(dx, dy) || 1
    const reach = this.length * 0.5 * (1 + strength)
    if (distance > reach) return
    this.fright = Math.max(this.fright, (1 - distance / reach) * strength)
    this.targetX = head.x + (dx / distance) * this.length
    this.targetY = head.y + (dy / distance) * this.length
    this.retargetAt = this.time + 4
  }

  private measure(): void {
    this.length =
      Math.min(this.bounds.width, this.bounds.height) * this.lengthShare
    this.halfWidth = this.length * this.kind.halfWidth
  }

  private pickTarget(): void {
    this.targetX = this.bounds.width * (0.2 + this.random() * 0.6)
    this.targetY = this.bounds.height * (0.2 + this.random() * 0.6)
    this.retargetAt = this.time + 10 + this.random() * 8
  }
}
