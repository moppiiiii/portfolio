import type { Bounds } from './jellyfish'

/**
 * How a slow, gliding creature (a ray, a sea turtle) moves. Lengths are in its own size (a ray's
 * wingspan, a turtle's shell), which is a share of the screen's shorter side.
 */
export type GliderSettings = {
  /** Size as a share of the screen's shorter side, for the largest of its kind. */
  sizeShare: number
  /** Cruising speed, in sizes per second, and how much a fright adds. */
  cruise: number
  burst: number
  /** Fastest turn (rad/s). */
  turnRate: number
  /** Margin, as a share of the shorter side, inside which it turns away from the edge. */
  edgeMargin: number
  /** Distance, in sizes (the pair's average), within which two of a kind steer apart. */
  separation: number
  /** Distance, in sizes, within which it notices the pointer or a click. */
  notice: number
  /** Seconds for a fright to fade to about a third. */
  frightDecay: number
}

export type GliderOptions = {
  x: number
  y: number
  heading: number
  /** Size relative to its kind's usual size (`GliderSettings.sizeShare`). */
  scale: number
  /** Whether it shows when its water is seen from afar, as a small tank on the map. */
  shownAfar: boolean
  random?: () => number
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/**
 * A creature seen from above that glides in wide curves toward places it picks at random, turns
 * away from the edges and from others of its kind, and is pushed on by its strokes (wing beats,
 * flipper strokes), which each kind keeps to its own rhythm.
 */
export abstract class Glider {
  x: number
  y: number
  /** Direction of travel (screen radians, 0 is to the right). */
  heading: number
  /** Its size (px): a ray's wingspan, a turtle's shell. */
  size = 0
  /** How visible it is right now and should become (0 to 1). */
  presence = 1
  readonly shownAfar: boolean
  /** How hard it is turning (-1 to 1), for kinds that lean into turns. */
  protected bank = 0
  protected fright = 0
  protected time = 0
  protected readonly random: () => number
  private visibility = 1
  private speed = 0
  private targetX = 0
  private targetY = 0
  private retargetAt = 0
  private bounds: Bounds
  private readonly scale: number
  private readonly settings: GliderSettings

  constructor(
    bounds: Bounds,
    options: GliderOptions,
    settings: GliderSettings,
  ) {
    this.bounds = bounds
    this.settings = settings
    this.x = options.x
    this.y = options.y
    this.heading = options.heading
    this.scale = options.scale
    this.shownAfar = options.shownAfar
    this.random = options.random ?? Math.random
    this.measure()
    this.speed = settings.cruise * this.size
    this.pickTarget()
  }

  /**
   * Moves its own rhythm on by `dt` seconds (faster when `fright` is high) and returns how hard
   * it pushes itself on right now, around 1.
   */
  protected abstract stroke(dt: number, fright: number): number

  setBounds(bounds: Bounds): void {
    this.bounds = bounds
    this.measure()
  }

  setVisibility(visibility: number, immediately = false): void {
    this.visibility = visibility
    if (immediately) this.presence = visibility
  }

  /**
   * Moves on by `dt` seconds, keeping clear of `others`: its own kind, and any other creature
   * given with a place and a size.
   */
  step(
    dt: number,
    others: readonly { x: number; y: number; size: number }[] = [],
  ): void {
    const { settings } = this
    this.time += dt
    this.presence +=
      (this.visibility - this.presence) * (1 - Math.exp(-dt / 0.35))
    this.fright *= Math.exp(-dt / settings.frightDecay)

    if (
      this.time >= this.retargetAt ||
      Math.hypot(this.targetX - this.x, this.targetY - this.y) < this.size * 0.4
    ) {
      this.pickTarget()
    }

    // Toward its target, away from the edges and from others of its kind.
    let wantX = this.targetX - this.x
    let wantY = this.targetY - this.y
    const toTarget = Math.hypot(wantX, wantY) || 1
    wantX /= toTarget
    wantY /= toTarget
    const margin = this.margin()
    const edge = (distance: number) => Math.max(0, 1 - distance / margin) * 3
    wantX += edge(this.x) - edge(this.bounds.width - this.x)
    wantY += edge(this.y) - edge(this.bounds.height - this.y)
    for (const other of others) {
      if (other === this) continue
      const dx = this.x - other.x
      const dy = this.y - other.y
      const distance = Math.hypot(dx, dy) || 1
      const range = (this.size + other.size) * 0.5 * settings.separation
      if (distance >= range) continue
      const push = (1 - distance / range) * 2
      wantX += (dx / distance) * push
      wantY += (dy / distance) * push
    }
    const turn = wrapAngle(Math.atan2(wantY, wantX) - this.heading)
    const rate = settings.turnRate * (1 + this.fright) * dt
    const turned = Math.max(-rate, Math.min(rate, turn))
    this.heading += turned
    if (rate > 0) {
      this.bank += (turned / rate - this.bank) * (1 - Math.exp(-dt / 0.8))
    }

    // Each stroke pushes it on; between strokes it glides and slows a little.
    const push = this.stroke(dt, this.fright)
    const wanted =
      this.size * (settings.cruise + settings.burst * this.fright) * push
    this.speed += (wanted - this.speed) * (1 - Math.exp(-dt / 0.6))
    this.x += Math.cos(this.heading) * this.speed * dt
    this.y += Math.sin(this.heading) * this.speed * dt
  }

  /** The pointer passing near: it turns away. */
  avoid(x: number, y: number): void {
    this.startle(x, y, 0.4)
  }

  /** A click or tap near: it hurries off. */
  disturb(x: number, y: number): void {
    this.startle(x, y, 1)
  }

  /** A point of its own frame, `forward` along its heading and `across` to its right, in sizes. */
  toWorld(forward: number, across: number): { x: number; y: number } {
    const cos = Math.cos(this.heading)
    const sin = Math.sin(this.heading)
    const f = forward * this.size
    const a = across * this.size
    return { x: this.x + f * cos - a * sin, y: this.y + f * sin + a * cos }
  }

  private startle(x: number, y: number, strength: number): void {
    const dx = this.x - x
    const dy = this.y - y
    const distance = Math.hypot(dx, dy) || 1
    const reach = this.size * this.settings.notice * (1 + strength)
    if (distance > reach) return
    this.fright = Math.max(this.fright, (1 - distance / reach) * strength)
    const margin = this.margin()
    this.targetX = Math.min(
      this.bounds.width - margin,
      Math.max(margin, this.x + (dx / distance) * this.size * 1.5),
    )
    this.targetY = Math.min(
      this.bounds.height - margin,
      Math.max(margin, this.y + (dy / distance) * this.size * 1.5),
    )
    this.retargetAt = this.time + 3 + 2 * strength
  }

  private margin(): number {
    return (
      Math.min(this.bounds.width, this.bounds.height) * this.settings.edgeMargin
    )
  }

  private measure(): void {
    this.size =
      Math.min(this.bounds.width, this.bounds.height) *
      this.settings.sizeShare *
      this.scale
  }

  private pickTarget(): void {
    this.targetX = this.bounds.width * (0.25 + this.random() * 0.5)
    this.targetY = this.bounds.height * (0.25 + this.random() * 0.5)
    this.retargetAt = this.time + 8 + this.random() * 6
  }
}
