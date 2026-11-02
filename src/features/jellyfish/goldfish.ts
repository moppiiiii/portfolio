import type { Bounds, Lane } from './jellyfish'
import { laneArea } from './jellyfish'

/**
 * A goldfish seen from above, as in a pond. Its body is a chain of points along the spine: the
 * head swims and each point follows the one ahead at a fixed distance, so the body bends into
 * S-curves as it turns and waves as its tail beats. Lengths are shares of the screen's shorter
 * side, so a fish looks the same size on any screen.
 */

/** Points along the spine, head first. */
const SPINE_POINTS = 12
/** Length of the body (without the tail fin) as a share of the screen's shorter side. */
const LENGTH_SHARE = 0.34
/**
 * Half the body's width at its widest, as a share of its length. Slimmer than a real goldfish:
 * in characters, a long body is what reads as a fish rather than a blot.
 */
const HALF_WIDTH = 0.115
/** Cruising speed, in body lengths per second, and the most a fright adds to it. */
const CRUISE = 0.22
const BURST = 1.1
/** Seconds for a fright to fade to about a third. */
const FRIGHT_DECAY = 0.9
/** Fastest turn (rad/s), and how much faster a frightened fish turns. */
const TURN_RATE = 1.4
const FRIGHT_TURN = 1.6
/** Tail beats per second at cruising speed, and how far each beat swings the head (rad). */
const BEAT_RATE = 1.3
const BEAT_SWING = 0.22
/**
 * Margin, as a share of the shorter side, inside which a fish turns away from the edge. Wide, so
 * that on the map, where the bodies are drawn larger than their place, they stay in the tank.
 */
const EDGE_MARGIN = 0.2
/** Distance, in body lengths, within which two fish steer apart. */
const SEPARATION = 0.7
/**
 * The same for two fish that both show on the map: wider, as their bodies are drawn larger than
 * their place there and would otherwise run together in the small tank.
 */
const SEPARATION_AFAR = 1.4
/** Where the eyes sit: along the body from the nose, and out from the spine (share of width). */
const EYE_ALONG = 0.1
const EYE_OUT = 0.62
/** Distance, in body lengths, within which a fish notices the pointer or a click. */
const NOTICE = 0.9

/** A coloured patch on the body, in the body's own terms. */
export type Patch = {
  /** Where along the body (0 at the nose, 1 at the tail's root). */
  along: number
  /** Where across it (-1 to 1, left to right edge). */
  across: number
  /** Radius as a share of the body's half width there. */
  size: number
}

export type GoldfishOptions = {
  x: number
  y: number
  heading: number
  /** Size relative to the largest fish. */
  scale: number
  /** Whether it shows when its water is seen from afar, as a small tank on the map. */
  shownAfar: boolean
  /**
   * The part of the water it keeps to when choosing where to swim, so the fish shown on the map
   * do not run together there. Anywhere when absent.
   */
  lane?: Lane
  random?: () => number
}

type Point = { x: number; y: number }

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/** Half the body's width at `along` (0 at the nose, 1 at the tail's root), as a share of its peak. */
export function bodyProfile(along: number): number {
  return Math.sin(Math.PI * Math.min(1, Math.max(0, along)) ** 0.62) ** 0.9
}

export class Goldfish {
  readonly spine: Point[] = []
  readonly patches: Patch[] = []
  readonly shownAfar: boolean
  readonly lane: Lane | undefined
  /** Body length (px) without the tail fin, and half its width at the widest. */
  length = 0
  halfWidth = 0
  /** Heading of the head (screen radians, 0 is to the right). */
  heading: number
  /** Tail beat, in radians; drives the body wave, the tail fin and the fins. */
  beat = 0
  /** How visible it is right now and should become (0 to 1). */
  presence = 1
  private visibility = 1
  private speed = 0
  private fright = 0
  private targetX = 0
  private targetY = 0
  private retargetAt = 0
  private time = 0
  private bounds: Bounds
  private readonly scale: number
  private readonly random: () => number

  constructor(bounds: Bounds, options: GoldfishOptions) {
    this.bounds = bounds
    this.scale = options.scale
    this.shownAfar = options.shownAfar
    this.lane = options.lane
    this.random = options.random ?? Math.random
    this.heading = options.heading
    this.beat = this.random() * Math.PI * 2
    this.measure()
    this.speed = CRUISE * this.length
    // Laid out straight behind the head.
    for (let i = 0; i < SPINE_POINTS; i++) {
      const back = (i / (SPINE_POINTS - 1)) * this.length
      this.spine.push({
        x: options.x - Math.cos(this.heading) * back,
        y: options.y - Math.sin(this.heading) * back,
      })
    }
    // Two to four patches, mostly over the back and sides, some spilling to the tail.
    const count = 2 + Math.floor(this.random() * 3)
    for (let i = 0; i < count; i++) {
      this.patches.push({
        along: 0.12 + this.random() * 0.75,
        across: (this.random() * 2 - 1) * 0.6,
        size: 0.7 + this.random() * 0.9,
      })
    }
    this.pickTarget()
  }

  get x(): number {
    return this.spine[0].x
  }

  get y(): number {
    return this.spine[0].y
  }

  setBounds(bounds: Bounds): void {
    this.bounds = bounds
    const before = this.length
    this.measure()
    if (before === 0) return
    // Keep the body's shape, at the new size.
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

  step(dt: number, school: readonly Goldfish[]): void {
    this.time += dt
    this.presence +=
      (this.visibility - this.presence) * (1 - Math.exp(-dt / 0.35))
    this.fright *= Math.exp(-dt / FRIGHT_DECAY)

    const head = this.spine[0]
    if (
      this.time >= this.retargetAt ||
      Math.hypot(this.targetX - head.x, this.targetY - head.y) <
        this.length * 0.5
    ) {
      this.pickTarget()
    }

    // Where it would like to head: its target, away from the edges and from other fish.
    let wantX = this.targetX - head.x
    let wantY = this.targetY - head.y
    const toTarget = Math.hypot(wantX, wantY) || 1
    wantX /= toTarget
    wantY /= toTarget
    const margin = Math.min(this.bounds.width, this.bounds.height) * EDGE_MARGIN
    const edge = (distance: number) => Math.max(0, 1 - distance / margin) * 2.5
    wantX += edge(head.x) - edge(this.bounds.width - head.x)
    wantY += edge(head.y) - edge(this.bounds.height - head.y)
    for (const other of school) {
      if (other === this) continue
      const dx = head.x - other.spine[3].x
      const dy = head.y - other.spine[3].y
      const distance = Math.hypot(dx, dy) || 1
      const afar = this.shownAfar && other.shownAfar
      const range =
        (this.length + other.length) *
        0.5 *
        (afar ? SEPARATION_AFAR : SEPARATION)
      if (distance >= range) continue
      const push = (1 - distance / range) * 1.5
      wantX += (dx / distance) * push
      wantY += (dy / distance) * push
    }
    const turn = wrapAngle(Math.atan2(wantY, wantX) - this.heading)
    const rate = TURN_RATE * (1 + FRIGHT_TURN * this.fright) * dt
    this.heading += Math.max(-rate, Math.min(rate, turn))

    // Speed eases toward cruising, plus whatever fright adds.
    const wanted = this.length * (CRUISE + BURST * this.fright)
    this.speed += (wanted - this.speed) * (1 - Math.exp(-dt / 0.4))

    // The tail beats faster the faster it swims, swinging the head from side to side.
    this.beat +=
      dt * BEAT_RATE * Math.PI * 2 * (this.speed / (CRUISE * this.length))
    const swim = this.heading + Math.sin(this.beat) * BEAT_SWING
    head.x += Math.cos(swim) * this.speed * dt
    head.y += Math.sin(swim) * this.speed * dt

    // Each point follows the one ahead at a fixed distance.
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

  /** Where the eyes are, in its water: either side of the head. */
  eyes(): Point[] {
    const last = this.spine.length - 1
    const index = Math.floor(EYE_ALONG * last)
    const a = this.spine[index]
    const b = this.spine[index + 1]
    const size = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const out = this.halfWidth * bodyProfile(EYE_ALONG) * EYE_OUT
    const normalX = (-(b.y - a.y) / size) * out
    const normalY = ((b.x - a.x) / size) * out
    return [
      { x: a.x + normalX, y: a.y + normalY },
      { x: a.x - normalX, y: a.y - normalY },
    ]
  }

  /** The pointer passing near: the fish turns away and swims off a little faster. */
  avoid(x: number, y: number): void {
    this.startle(x, y, 0.35)
  }

  /** A click or tap near: the fish darts away. */
  disturb(x: number, y: number): void {
    this.startle(x, y, 1)
  }

  private startle(x: number, y: number, strength: number): void {
    const head = this.spine[0]
    const dx = head.x - x
    const dy = head.y - y
    const distance = Math.hypot(dx, dy) || 1
    const reach = this.length * NOTICE * (1 + strength)
    if (distance > reach) return
    const closeness = 1 - distance / reach
    this.fright = Math.max(this.fright, closeness * strength)
    this.targetX = head.x + (dx / distance) * this.length * 2
    this.targetY = head.y + (dy / distance) * this.length * 2
    this.clampTarget()
    this.retargetAt = this.time + 2 + 2 * strength
  }

  private measure(): void {
    const shorter = Math.min(this.bounds.width, this.bounds.height)
    this.length = shorter * LENGTH_SHARE * this.scale
    this.halfWidth = this.length * HALF_WIDTH
  }

  private pickTarget(): void {
    const area = laneArea(this.bounds, this.lane)
    const within = (from: number, to: number) => {
      // Clear of the water's edges, and of the lane's own edges too.
      const low = Math.max(0.22, from + (to - from) * 0.2)
      const high = Math.min(0.78, to - (to - from) * 0.2)
      return low + this.random() * Math.max(0, high - low)
    }
    this.targetX = this.bounds.width * within(area.left, area.right)
    this.targetY = this.bounds.height * within(area.top, area.bottom)
    this.retargetAt = this.time + 6 + this.random() * 6
  }

  private clampTarget(): void {
    const margin = Math.min(this.bounds.width, this.bounds.height) * EDGE_MARGIN
    this.targetX = Math.min(
      this.bounds.width - margin,
      Math.max(margin, this.targetX),
    )
    this.targetY = Math.min(
      this.bounds.height - margin,
      Math.max(margin, this.targetY),
    )
  }
}
