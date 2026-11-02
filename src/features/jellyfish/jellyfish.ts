import type { Force } from './strand'
import { Strand } from './strand'

/**
 * The area the jellyfish live in, in px. `top` and `bottom` are bands at the top and bottom
 * edge (such as text) that the jellyfish keep out of.
 */
export type Bounds = {
  width: number
  height: number
  top?: number
  bottom?: number
}

/** Height of the open water between the bands. */
function waterHeight(bounds: Bounds): number {
  return Math.max(1, bounds.height - (bounds.top ?? 0) - (bounds.bottom ?? 0))
}

/** One of several equal parts of the water, which a jellyfish keeps to. */
export type Lane = { index: number; count: number }

/**
 * The part of the water `lane` covers, as shares (0 to 1) of the water's width and height: a
 * column on a landscape screen and a row on a portrait one, so lanes run along the longer side.
 * The whole water without a lane.
 */
export function laneArea(bounds: Bounds, lane: Lane | undefined) {
  const whole = { left: 0, right: 1, top: 0, bottom: 1 }
  if (!lane) return whole
  const from = lane.index / lane.count
  const to = (lane.index + 1) / lane.count
  return bounds.width >= waterHeight(bounds)
    ? { ...whole, left: from, right: to }
    : { ...whole, top: from, bottom: to }
}

export type JellyfishOptions = {
  /** Starting position. Defaults to the lower middle of the screen. */
  x?: number
  y?: number
  /** Starting direction of the bell top, in screen radians. Defaults to straight up. */
  heading?: number
  /** Size relative to the largest jellyfish. */
  scale?: number
  /** 1 is nearest the viewer, 0 is furthest away. Renderers fade distant jellyfish. */
  depth?: number
  /** Palette colour the jellyfish is drawn in: 0 is the ink colour, 1 the accent colour. */
  tint?: 0 | 1
  /**
   * Whether it shows when its water is seen from afar, as a small tank on the map. The others
   * appear only as the camera comes close. Defaults to true.
   */
  shownAfar?: boolean
  /**
   * The part of the water it keeps to when choosing where to swim, so the jellyfish shown on the
   * map do not run together there. Anywhere when absent.
   */
  lane?: Lane
  random?: () => number
}

export type Tentacle = {
  strand: Strand
  /** Angle around the bell rim. sin(azimuth) > 0 means the tentacle hangs in front of the bell. */
  azimuth: number
  front: boolean
  swaySeed: number
  /** Sway frequency (rad/s) and strength multiplier, so tentacles never move in lockstep. */
  swayRate: number
  swayScale: number
}

export type OralArm = {
  strand: Strand
  /** Horizontal attachment offset under the bell, as a fraction of the bell radius. */
  offset: number
  swaySeed: number
}

export const TAU = Math.PI * 2
const UP = -Math.PI / 2

// Size.
/** Bell radius of the nearest jellyfish, as a share of the screen's shorter side. */
const RADIUS_SHARE = 0.1
/**
 * Limits on that radius (px). The floor keeps the smallest, furthest jellyfish on a phone wide
 * enough to read as a jellyfish when drawn in characters.
 */
const MIN_RADIUS = 56
const MAX_RADIUS = 110

// Swimming. Lengths and accelerations are multiples of the bell radius, so any size behaves alike.
/** Share of one pulse spent contracting. The rest is the slow relaxation. */
const CONTRACT_SHARE = 0.3
/** Speed gained over one full contraction at full effort. */
const THRUST = 2.6
/** Velocity decay rate of the body in water (1/s). */
const BODY_DRAG = 1.3
/** Downward acceleration while resting, and the floor of it while swimming. */
const SINK_RESTING = 0.3
const SINK_SWIMMING = 0.1
/** Largest tilt away from straight up. Jellyfish here never swim head-down. */
const MAX_TILT = 0.85
/** Fastest heading change (rad/s). */
const TURN_RATE = 0.7
/** Seconds for swimming effort to settle after the target changes side. */
const EFFORT_EASE = 1.5

// Reaction to a click or tap nearby.
/** Distance within which a jellyfish reacts, as a share of the screen's shorter side. */
const DISTURB_REACH_SHARE = 0.4
/** Speed the water push gives a jellyfish right at the click point, in radii per second. */
const DISTURB_PUSH = 2.2
/** While startled, pulses come this much faster and push this much harder (at full fright). */
const FRIGHT_TEMPO = 0.45
const FRIGHT_THRUST = 0.8
/** Seconds for fright to fade to about a third. */
const FRIGHT_DECAY = 1.6
/** Seconds a fleeing jellyfish keeps heading away before wandering again. */
const FLEE_TIME = 5

// Reaction to the pointer passing nearby: unhurried, unlike a click.
/** Distance from the rim centre within which a jellyfish notices the pointer, in bell radii. */
const AVOID_REACH = 2.6
/** Speed the pointer's wake gives a jellyfish right at the pointer, in radii per second. */
const AVOID_PUSH = 0.35
/** Fright at the pointer: pulses quicken a little, but the jellyfish does not bolt. */
const AVOID_FRIGHT = 0.4
/** How far it heads away, in bell radii, and the least time (s) it keeps heading there. */
const AVOID_DISTANCE = 5
const AVOID_TIME = 3

/** Seconds for fading out of or back into view to mostly settle. */
const PRESENCE_EASE = 0.35

// Staying on screen.
/**
 * Margins between the rim centre and the screen edges, in bell radii. Inside them the whole bell
 * is on screen; only the tips of the tentacles may hang past the bottom.
 */
const EDGE_SIDE = 1.15
const EDGE_TOP = 1.1
const EDGE_BOTTOM = 1.5
/** Pull back towards the screen per pixel past a margin (1/s²). */
const EDGE_SPRING = 30
/** Extra drag on outward motion past a margin (1/s), so a pushed jellyfish stops quickly. */
const EDGE_DRAG = 8

// Separation from neighbours at a similar depth, so the group does not clump.
/** Neighbours further apart in depth than this ignore each other: they read as near and far. */
const SEPARATION_DEPTH = 0.3
/** Distance, in summed radii, below which two jellyfish push apart. */
const SEPARATION_RANGE = 1.6
/**
 * The same for two jellyfish that both show on the map, at any depth: wide enough to keep them
 * apart there, where their bodies are drawn about twice the size of their place.
 */
const SEPARATION_RANGE_AFAR = 2.2
/** Push strength at zero distance, in radii per second squared. */
const SEPARATION_PUSH = 1.2

// Bell shape.
/** Bell height relative to its radius. */
const BELL_HEIGHT = 0.82
/** Pole-to-rim profile exponent of the dome. Below 1 makes it fuller near the rim. */
export const DOME_FULLNESS = 0.75
/** How much of the rim's underside the viewer sees: 0 is edge-on, 1 is straight from below. */
export const RIM_TILT = 0.28
/** How far the bell narrows and lengthens at full contraction. */
const SQUEEZE_WIDTH = 0.24
const SQUEEZE_HEIGHT = 0.12

// Strands.
const TENTACLE_COUNT = 18
const TENTACLE_NODES = 40
const TENTACLE_SEGMENT = 0.085
const ORAL_ARM_COUNT = 4
const ORAL_ARM_NODES = 18
const ORAL_ARM_SEGMENT = 0.08
const STRAND_GRAVITY = 0.8
const TENTACLE_DRAG = 2.2
const ORAL_ARM_DRAG = 3
const TENTACLE_SWAY = 0.6
const ORAL_ARM_SWAY = 0.2

/**
 * Point on the bell surface in the bell's own frame (rim centre at the origin, apex towards -y).
 * `polar` runs from 0 at the apex to π/2 at the rim. Returns the depth: positive faces the viewer.
 */
export function bellSurfacePoint(
  halfWidth: number,
  height: number,
  polar: number,
  azimuth: number,
  out: Force,
): number {
  const ring = halfWidth * Math.sin(polar)
  const depth = ring * Math.sin(azimuth)
  out.x = ring * Math.cos(azimuth)
  out.y = -height * Math.cos(polar) ** DOME_FULLNESS + depth * RIM_TILT
  return depth
}

/** Point on the dome silhouette, from the left rim (side = -π/2) over the apex to the right. */
export function domeOutlinePoint(
  halfWidth: number,
  height: number,
  side: number,
  out: Force,
): void {
  out.x = halfWidth * Math.sin(side)
  out.y = -height * Math.cos(side) ** DOME_FULLNESS
}

/** Bell radius of a jellyfish at `scale` on a screen of `bounds`. */
export function bellRadius(bounds: Bounds, scale = 1): number {
  return (
    clamp(
      Math.min(bounds.width, waterHeight(bounds)) * RADIUS_SHARE,
      MIN_RADIUS,
      MAX_RADIUS,
    ) * scale
  )
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Bell contraction from 0 (relaxed) to 1 (fully squeezed) over one pulse. */
function pulseCurve(phase: number): number {
  if (phase < CONTRACT_SHARE) return smoothstep(phase / CONTRACT_SHARE)
  const t = (phase - CONTRACT_SHARE) / (1 - CONTRACT_SHARE)
  return (1 - t) * (1 - t)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export class Jellyfish {
  x: number
  y: number
  vx = 0
  vy = 0
  /** Direction the top of the bell points, in screen radians. */
  heading = UP
  /** Current bell contraction, 0 to 1. */
  contraction = 0
  time = 0
  readonly radius: number
  readonly depth: number
  readonly tint: 0 | 1
  readonly shownAfar: boolean
  readonly lane: Lane | undefined
  /** 1 fully in view, 0 faded out. Eases towards `visibility`. */
  presence = 1
  private visibility = 1
  readonly tentacles: Tentacle[] = []
  readonly oralArms: OralArm[] = []

  private phase: number
  private period: number
  private effort = 1
  /** 0 when calm, 1 right after a click close by. */
  private fright = 0
  private targetX = 0
  private targetY = 0
  private retargetAt = 0
  private bounds: Bounds
  private readonly random: () => number
  private readonly anchor: Force = { x: 0, y: 0 }

  constructor(bounds: Bounds, options: JellyfishOptions = {}) {
    const random = options.random ?? Math.random
    this.bounds = bounds
    this.random = random
    this.depth = options.depth ?? 1
    this.tint = options.tint ?? 0
    this.shownAfar = options.shownAfar ?? true
    this.lane = options.lane
    this.radius = bellRadius(bounds, options.scale)
    this.x = options.x ?? bounds.width * 0.5
    this.y = options.y ?? bounds.height * 0.62
    this.heading = options.heading ?? UP
    this.phase = random()
    this.period = this.nextPeriod()
    this.pickTarget()

    for (let i = 0; i < TENTACLE_COUNT; i++) {
      const azimuth = (i / TENTACLE_COUNT) * TAU + random() * 0.2
      const lengthScale = 0.6 + random() * 0.4
      const nodes = Math.round(TENTACLE_NODES * lengthScale)
      this.rimPoint(azimuth, this.anchor)
      this.tentacles.push({
        strand: new Strand(
          nodes,
          this.radius * TENTACLE_SEGMENT,
          this.anchor.x,
          this.anchor.y,
        ),
        azimuth,
        front: Math.sin(azimuth) > 0,
        swaySeed: random() * TAU,
        swayRate: 0.7 + random() * 0.8,
        swayScale: 0.6 + random() * 0.6,
      })
    }

    for (let i = 0; i < ORAL_ARM_COUNT; i++) {
      const offset = ((i + 0.5) / ORAL_ARM_COUNT - 0.5) * 0.36
      this.toWorld(offset * this.radius, 0, this.anchor)
      this.oralArms.push({
        strand: new Strand(
          ORAL_ARM_NODES,
          this.radius * ORAL_ARM_SEGMENT,
          this.anchor.x,
          this.anchor.y,
        ),
        offset,
        swaySeed: random() * TAU,
      })
    }
  }

  setBounds(bounds: Bounds): void {
    this.bounds = bounds
    this.pickTarget()
  }

  /** Half-width of the bell rim right now. */
  get bellHalfWidth(): number {
    return this.radius * (1 - SQUEEZE_WIDTH * this.contraction)
  }

  /** Height of the bell from rim to apex right now. */
  get bellHeight(): number {
    return this.radius * BELL_HEIGHT * (1 + SQUEEZE_HEIGHT * this.contraction)
  }

  /** Rotation that turns bell-local coordinates (apex towards -y) into screen coordinates. */
  get rotation(): number {
    return this.heading + Math.PI / 2
  }

  /** Converts a bell-local point (origin at the rim centre, apex towards -y) to screen space. */
  toWorld(localX: number, localY: number, out: Force): void {
    const cos = Math.cos(this.rotation)
    const sin = Math.sin(this.rotation)
    out.x = this.x + localX * cos - localY * sin
    out.y = this.y + localX * sin + localY * cos
  }

  /** Screen position of the rim at `azimuth`. */
  rimPoint(azimuth: number, out: Force): void {
    const halfWidth = this.bellHalfWidth
    this.toWorld(
      halfWidth * Math.cos(azimuth),
      halfWidth * RIM_TILT * Math.sin(azimuth),
      out,
    )
  }

  /**
   * Sets how visible the jellyfish should be, from 0 (gone) to 1 (fully visible). It fades there
   * gradually, or at once with `immediately`.
   */
  setVisibility(visibility: number, immediately = false): void {
    this.visibility = visibility
    if (immediately) this.presence = visibility
  }

  step(dt: number, neighbours: readonly Jellyfish[] = []): void {
    this.time += dt
    this.presence +=
      (this.visibility - this.presence) * (1 - Math.exp(-dt / PRESENCE_EASE))
    this.steer(dt)
    this.keepApart(dt, neighbours)
    this.keepOnScreen(dt)
    this.swim(dt)
    this.moveStrands(dt)
  }

  /**
   * Where the rim centre may be for the whole bell to stay on screen. On a screen too small for
   * the margins, the area shrinks to the centre line.
   */
  private onScreenArea() {
    const { width, height } = this.bounds
    const waterTop = this.bounds.top ?? 0
    const waterBottom = height - (this.bounds.bottom ?? 0)
    const r = this.radius
    const left = Math.min(r * EDGE_SIDE, width / 2)
    const top = Math.min(waterTop + r * EDGE_TOP, (waterTop + waterBottom) / 2)
    return {
      left,
      right: Math.max(left, width - r * EDGE_SIDE),
      top,
      bottom: Math.max(top, waterBottom - r * EDGE_BOTTOM),
    }
  }

  /**
   * Pulls the jellyfish back when it drifts or is pushed past the screen margins, more strongly
   * the further out it is, and brakes any further outward motion. It glides back as if the water
   * near the edge pushed it, rather than bouncing off a wall.
   */
  private keepOnScreen(dt: number): void {
    const { left, right, top, bottom } = this.onScreenArea()
    const brake = Math.exp(-EDGE_DRAG * dt)
    if (this.x < left) {
      this.vx += (left - this.x) * EDGE_SPRING * dt
      if (this.vx < 0) this.vx *= brake
    } else if (this.x > right) {
      this.vx -= (this.x - right) * EDGE_SPRING * dt
      if (this.vx > 0) this.vx *= brake
    }
    if (this.y < top) {
      this.vy += (top - this.y) * EDGE_SPRING * dt
      if (this.vy < 0) this.vy *= brake
    } else if (this.y > bottom) {
      this.vy -= (this.y - bottom) * EDGE_SPRING * dt
      if (this.vy > 0) this.vy *= brake
    }
  }

  /** Drifts away from neighbours at a similar depth that come too close. */
  private keepApart(dt: number, neighbours: readonly Jellyfish[]): void {
    for (const other of neighbours) {
      if (other === this) continue
      const afar = this.shownAfar && other.shownAfar
      if (!afar && Math.abs(other.depth - this.depth) > SEPARATION_DEPTH) {
        continue
      }
      const dx = this.x - other.x
      const dy = this.y - other.y
      const distance = Math.hypot(dx, dy) || 1
      const range =
        (this.radius + other.radius) *
        (afar ? SEPARATION_RANGE_AFAR : SEPARATION_RANGE)
      if (distance >= range) continue
      const push = (1 - distance / range) * SEPARATION_PUSH * this.radius * dt
      this.vx += (dx / distance) * push
      this.vy += (dy / distance) * push
    }
  }

  private swim(dt: number): void {
    this.fright *= Math.exp(-dt / FRIGHT_DECAY)
    this.phase += dt / (this.period * (1 - FRIGHT_TEMPO * this.fright))
    if (this.phase >= 1) {
      this.phase -= 1
      this.period = this.nextPeriod()
    }

    // A tired jellyfish still pulses, just more shallowly.
    const depth = 0.55 + 0.45 * this.effort
    const previous = this.contraction
    this.contraction = pulseCurve(this.phase) * depth
    const squeeze = this.contraction - previous

    // Thrust only comes from squeezing water out; relaxing produces none.
    if (squeeze > 0) {
      const impulse =
        THRUST *
        this.radius *
        squeeze *
        this.effort *
        (1 + FRIGHT_THRUST * this.fright)
      this.vx += Math.cos(this.heading) * impulse
      this.vy += Math.sin(this.heading) * impulse
    }

    const sink =
      SINK_SWIMMING + (SINK_RESTING - SINK_SWIMMING) * (1 - this.effort)
    this.vy += sink * this.radius * dt

    const drag = Math.exp(-BODY_DRAG * dt)
    this.vx *= drag
    this.vy *= drag
    this.x += this.vx * dt
    this.y += this.vy * dt
  }

  /**
   * Wanders between random targets. The bell only tilts towards the target's side; to go down it
   * swims more lazily and lets itself sink.
   */
  private steer(dt: number): void {
    const dx = this.targetX - this.x
    const dy = this.targetY - this.y
    if (
      this.time >= this.retargetAt ||
      Math.hypot(dx, dy) < this.radius * 1.5
    ) {
      this.pickTarget()
    }

    const tilt = clamp(dx / (this.radius * 6), -1, 1) * MAX_TILT
    const turn = wrapAngle(UP + tilt - this.heading)
    this.heading += clamp(turn, -TURN_RATE * dt, TURN_RATE * dt)

    const wanted = dy < 0 ? 1 : 0.15
    this.effort += (wanted - this.effort) * (1 - Math.exp(-dt / EFFORT_EASE))
  }

  private moveStrands(dt: number): void {
    const { radius, time, anchor } = this
    const gravity = STRAND_GRAVITY * radius

    const tentacleDamping = Math.exp(-TENTACLE_DRAG * dt)
    for (const tentacle of this.tentacles) {
      this.rimPoint(tentacle.azimuth, anchor)
      const sway = TENTACLE_SWAY * radius * tentacle.swayScale
      const last = tentacle.strand.nodeCount - 1
      tentacle.strand.step(
        anchor.x,
        anchor.y,
        dt,
        tentacleDamping,
        (i, out) => {
          // Roots stay calm; the sway grows towards the tip.
          const reach = 0.3 + (0.7 * i) / last
          out.x =
            sway *
            reach *
            Math.sin(time * tentacle.swayRate - i * 0.14 + tentacle.swaySeed)
          out.y = gravity
        },
      )
    }

    const armDamping = Math.exp(-ORAL_ARM_DRAG * dt)
    for (const arm of this.oralArms) {
      this.toWorld(arm.offset * this.bellHalfWidth, 0, anchor)
      const sway = ORAL_ARM_SWAY * radius
      arm.strand.step(anchor.x, anchor.y, dt, armDamping, (i, out) => {
        out.x = sway * Math.sin(time * 0.8 - i * 0.18 + arm.swaySeed)
        out.y = gravity
      })
    }
  }

  /**
   * Reacts to a click or tap at (x, y). The water pushes the jellyfish away at once, and it then
   * flees with fast, hard pulses. Jellyfish further than the reach ignore it.
   */
  disturb(x: number, y: number): void {
    const dx = this.x - x
    const dy = this.y - y
    const distance = Math.hypot(dx, dy) || 1
    const reach =
      Math.min(this.bounds.width, waterHeight(this.bounds)) *
      DISTURB_REACH_SHARE
    if (distance > reach) return

    const closeness = 1 - distance / reach
    const push = DISTURB_PUSH * this.radius * closeness
    this.vx += (dx / distance) * push
    this.vy += (dy / distance) * push
    this.fright = Math.max(this.fright, closeness)
    this.effort = 1

    const flee = this.radius * 8
    const area = this.onScreenArea()
    this.targetX = clamp(this.x + (dx / distance) * flee, area.left, area.right)
    this.targetY = clamp(this.y + (dy / distance) * flee, area.top, area.bottom)
    this.retargetAt = this.time + FLEE_TIME
  }

  /**
   * Reacts to the pointer passing at (x, y): the jellyfish is nudged by the pointer's wake and
   * turns to swim away at an unhurried pace. Jellyfish further than the reach ignore it.
   */
  avoid(x: number, y: number): void {
    const dx = this.x - x
    const dy = this.y - y
    const distance = Math.hypot(dx, dy) || 1
    const reach = this.radius * AVOID_REACH
    if (distance > reach) return

    const closeness = 1 - distance / reach
    const push = AVOID_PUSH * this.radius * closeness
    this.vx += (dx / distance) * push
    this.vy += (dy / distance) * push
    this.fright = Math.max(this.fright, closeness * AVOID_FRIGHT)

    const away = this.radius * AVOID_DISTANCE
    const area = this.onScreenArea()
    this.targetX = clamp(this.x + (dx / distance) * away, area.left, area.right)
    this.targetY = clamp(this.y + (dy / distance) * away, area.top, area.bottom)
    this.retargetAt = Math.max(this.retargetAt, this.time + AVOID_TIME)
  }

  private pickTarget(): void {
    const { width } = this.bounds
    const waterTop = this.bounds.top ?? 0
    const area = laneArea(this.bounds, this.lane)
    this.targetX =
      width *
      (area.left + (area.right - area.left) * (0.12 + this.random() * 0.76))
    this.targetY =
      waterTop +
      waterHeight(this.bounds) *
        (area.top + (area.bottom - area.top) * (0.25 + this.random() * 0.5))
    this.retargetAt = this.time + 10 + this.random() * 6
  }

  private nextPeriod(): number {
    return 1.9 + this.random() * 0.5
  }
}
