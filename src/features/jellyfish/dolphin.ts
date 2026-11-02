import type { Bounds } from './jellyfish'

/**
 * A bottlenose dolphin seen from above: a short beak and a rounded forehead, a smooth body
 * narrowing to the tail stock, small side fins and wide tail flukes lying flat. It swims fast and
 * now and then rolls right over, its fins and flukes narrowing and its pale belly showing as it
 * turns. Unlike every other creature in the tank, it is drawn to the pointer: it comes over and
 * circles it, the two dolphins on opposite sides, and a click sets it rolling. Lengths are shares
 * of the screen's shorter side.
 */

const SPINE_POINTS = 12
/** Half the body's width at its widest, as a share of its length. */
const HALF_WIDTH = 0.1
/** How far the flukes reach behind the body, and half their span, as shares of its length. */
export const FLUKE_REACH = 0.12
const FLUKE_HALF_SPAN = 0.13
/**
 * Speed, in body lengths per second: cruising, circling the pointer, heading to it from further
 * off, and what excitement adds.
 */
const CRUISE = 0.45
const CIRCLING = 0.7
const CHASING = 1.4
const BURST = 0.9
/** Fastest turn (rad/s), and when heading to the pointer from further off. */
const TURN_RATE = 1.6
const CHASE_TURN_RATE = 2.8
/** Seconds per fluke stroke. */
const STROKE_TIME = 0.9
/** Seconds a roll takes, and the least and most time between rolls on its own. */
const ROLL_TIME = 1.3
const ROLL_GAP = [8, 16] as const
/** Margin, as a share of the shorter side, inside which its head turns away from the edge. */
const EDGE_MARGIN = 0.15
/** How long (s) it stays with the pointer after the pointer last moved near. */
const INTEREST_TIME = 6
/** Distance, in body lengths, within which it notices the pointer: about the whole tank. */
const NOTICE = 5
/** Radius it circles the pointer at, in body lengths, and how fast it goes round (rad/s). */
const ORBIT_RADIUS = 1.15
const ORBIT_SPEED = 0.9
/** Distance, in sizes (the pair's average), within which it steers away from another creature. */
const SEPARATION = 0.8

type Point = { x: number; y: number }

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/**
 * Half the body's width at `along` (0 at the tip of the beak, 1 at the tail stock), as a share of
 * the widest: a short narrow beak, the rounded forehead behind it, the widest point a third of
 * the way back, and a slim tail stock.
 */
export function dolphinProfile(along: number): number {
  const t = Math.min(1, Math.max(0, along))
  if (t < 0.07) return 0.22 + (t / 0.07) * 0.08
  if (t < 0.16)
    return 0.3 + 0.45 * Math.sin(((t - 0.07) / 0.09) * (Math.PI / 2))
  if (t < 0.35)
    return 0.75 + 0.25 * Math.sin(((t - 0.16) / 0.19) * (Math.PI / 2))
  return 1 - 0.88 * ((t - 0.35) / 0.65) ** 1.3
}

export type DolphinOptions = {
  x: number
  y: number
  heading: number
  /** Body length (without the flukes), as a share of the screen's shorter side. */
  lengthShare: number
  /** Where round the pointer it circles, in radians, so two dolphins keep to opposite sides. */
  orbitPhase: number
  /** Whether it shows when its water is seen from afar, as a small tank on the map. */
  shownAfar: boolean
  random?: () => number
}

export class Dolphin {
  readonly spine: Point[] = []
  /** Body length (px) and half its width at the widest. */
  length = 0
  halfWidth = 0
  heading: number
  /** How far it has rolled over (radians): 0 back up, π belly up. */
  roll = 0
  /** Where its flukes are in their up-and-down stroke, in radians. */
  stroke: number
  presence = 1
  readonly shownAfar: boolean
  private visibility = 1
  private speed = 0
  private excitement = 0
  private rolling = false
  private nextRollAt: number
  private orbit: number
  /** Where the pointer last was near it, and until when (s) it stays with it. */
  private interest: (Point & { until: number }) | undefined
  private targetX = 0
  private targetY = 0
  private retargetAt = 0
  private time = 0
  private bounds: Bounds
  private readonly lengthShare: number
  private readonly random: () => number

  constructor(bounds: Bounds, options: DolphinOptions) {
    this.bounds = bounds
    this.lengthShare = options.lengthShare
    this.shownAfar = options.shownAfar
    this.random = options.random ?? Math.random
    this.heading = options.heading
    this.orbit = options.orbitPhase
    this.stroke = this.random() * Math.PI * 2
    this.nextRollAt = this.rollGap()
    this.measure()
    this.speed = CRUISE * this.length
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
    this.time += dt
    this.presence +=
      (this.visibility - this.presence) * (1 - Math.exp(-dt / 0.35))
    this.excitement *= Math.exp(-dt / 1.5)

    // Rolls over now and then, and whenever something has excited it.
    if (!this.rolling && this.time >= this.nextRollAt) this.rolling = true
    if (this.rolling) {
      this.roll += (dt / ROLL_TIME) * Math.PI * 2
      if (this.roll >= Math.PI * 2) {
        this.roll = 0
        this.rolling = false
        this.nextRollAt = this.time + this.rollGap()
      }
    }

    const head = this.spine[0]
    const circling =
      this.interest !== undefined && this.time < this.interest.until
    if (circling && this.interest) {
      // Round the pointer, at its own place on the circle.
      this.orbit += dt * ORBIT_SPEED
      this.targetX =
        this.interest.x + Math.cos(this.orbit) * this.length * ORBIT_RADIUS
      this.targetY =
        this.interest.y + Math.sin(this.orbit) * this.length * ORBIT_RADIUS
    } else {
      this.interest = undefined
      if (
        this.time >= this.retargetAt ||
        Math.hypot(this.targetX - head.x, this.targetY - head.y) <
          this.length * 0.5
      ) {
        this.pickTarget()
      }
    }

    let wantX = this.targetX - head.x
    let wantY = this.targetY - head.y
    const toTarget = Math.hypot(wantX, wantY) || 1
    wantX /= toTarget
    wantY /= toTarget
    const margin = Math.min(this.bounds.width, this.bounds.height) * EDGE_MARGIN
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
    // Far from the pointer it is drawn to, it hurries over; close, it circles at ease.
    const chasing =
      circling &&
      this.interest !== undefined &&
      Math.hypot(this.interest.x - head.x, this.interest.y - head.y) >
        this.length * ORBIT_RADIUS * 1.8
    const turn = wrapAngle(Math.atan2(wantY, wantX) - this.heading)
    const rate =
      (chasing ? CHASE_TURN_RATE : TURN_RATE) * (1 + this.excitement) * dt
    this.heading += Math.max(-rate, Math.min(rate, turn))

    const pace = chasing ? CHASING : circling ? CIRCLING : CRUISE
    const wanted = this.length * (pace + BURST * this.excitement)
    this.speed += (wanted - this.speed) * (1 - Math.exp(-dt / 0.5))
    this.stroke +=
      (dt / STROKE_TIME) * Math.PI * 2 * (this.speed / (CRUISE * this.length))
    head.x += Math.cos(this.heading) * this.speed * dt
    head.y += Math.sin(this.heading) * this.speed * dt

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

  /** The pointer moving near: it comes over and circles the pointer for a while. */
  notice(x: number, y: number): void {
    const head = this.spine[0]
    if (Math.hypot(head.x - x, head.y - y) > this.length * NOTICE) {
      if (!this.interest) return
    }
    this.interest = { x, y, until: this.time + INTEREST_TIME }
  }

  /** A click near: delighted rather than startled, it rolls and dashes round the spot. */
  disturb(x: number, y: number): void {
    const head = this.spine[0]
    if (Math.hypot(head.x - x, head.y - y) > this.length * NOTICE) return
    this.excitement = 1
    this.rolling = true
    this.interest = { x, y, until: this.time + INTEREST_TIME }
  }

  /** The spine point at `along` (0 at the beak, 1 at the tail stock) and its normal there. */
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
      width: this.halfWidth * dolphinProfile(along),
    }
  }

  /**
   * The flukes as seen from above this moment: their two tips and the notch between them. They
   * look shorter as each stroke lifts or drops them, and narrower as the dolphin rolls on its side.
   */
  flukes(): { left: Point; right: Point; notch: Point } {
    const last = this.spine.length - 1
    const root = this.spine[last]
    const before = this.spine[last - 1]
    const away = Math.atan2(root.y - before.y, root.x - before.x)
    const reach =
      this.length * FLUKE_REACH * (0.7 + 0.3 * Math.abs(Math.cos(this.stroke)))
    const span = this.length * FLUKE_HALF_SPAN * Math.abs(Math.cos(this.roll))
    const backX = Math.cos(away)
    const backY = Math.sin(away)
    const tip = (side: number) => ({
      x: root.x + backX * reach - backY * span * side,
      y: root.y + backY * reach + backX * span * side,
    })
    return {
      left: tip(1),
      right: tip(-1),
      notch: {
        x: root.x + backX * reach * 0.55,
        y: root.y + backY * reach * 0.55,
      },
    }
  }

  /** How far out its side fins reach right now, in half widths: less when it is on its side. */
  finReach(): number {
    return 1.9 * Math.abs(Math.cos(this.roll))
  }

  /** How much of its pale belly shows (0 back up, 1 belly up). */
  belly(): number {
    return (1 - Math.cos(this.roll)) / 2
  }

  private rollGap(): number {
    return ROLL_GAP[0] + this.random() * (ROLL_GAP[1] - ROLL_GAP[0])
  }

  private measure(): void {
    this.length =
      Math.min(this.bounds.width, this.bounds.height) * this.lengthShare
    this.halfWidth = this.length * HALF_WIDTH
  }

  private pickTarget(): void {
    this.targetX = this.bounds.width * (0.2 + this.random() * 0.6)
    this.targetY = this.bounds.height * (0.2 + this.random() * 0.6)
    this.retargetAt = this.time + 4 + this.random() * 4
  }
}
