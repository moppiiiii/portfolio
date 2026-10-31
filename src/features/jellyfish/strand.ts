export type Force = { x: number; y: number }

/** Returns the acceleration (px/s²) acting on node `index`, written into `out`. */
export type ForceField = (index: number, out: Force) => void

/**
 * Share of each length correction removed from the node's velocity. At 1, being dragged by the
 * bell gives a node no momentum of its own, so it cannot overshoot and fold over when the bell
 * slows down. Tentacles in water behave like this.
 */
const CORRECTION_DAMPING = 1

/**
 * A hanging strand, used for tentacles and oral arms.
 *
 * Nodes move with Verlet integration. After each step, every node is pulled back to exactly one
 * segment length from its parent ("follow the leader"), so the strand never stretches. Node 0 is
 * pinned to an anchor on the bell every step.
 */
export class Strand {
  readonly nodeCount: number
  readonly segmentLength: number
  readonly x: Float32Array
  readonly y: Float32Array
  private readonly prevX: Float32Array
  private readonly prevY: Float32Array
  private readonly force: Force = { x: 0, y: 0 }

  constructor(
    nodeCount: number,
    segmentLength: number,
    originX: number,
    originY: number,
  ) {
    this.nodeCount = nodeCount
    this.segmentLength = segmentLength
    this.x = new Float32Array(nodeCount)
    this.y = new Float32Array(nodeCount)
    this.prevX = new Float32Array(nodeCount)
    this.prevY = new Float32Array(nodeCount)
    for (let i = 0; i < nodeCount; i++) {
      this.x[i] = originX
      this.y[i] = originY + i * segmentLength
      this.prevX[i] = this.x[i]
      this.prevY[i] = this.y[i]
    }
  }

  step(
    anchorX: number,
    anchorY: number,
    dt: number,
    damping: number,
    field: ForceField,
  ): void {
    const { x, y, prevX, prevY, force, nodeCount, segmentLength } = this
    const dt2 = dt * dt

    x[0] = anchorX
    y[0] = anchorY
    prevX[0] = anchorX
    prevY[0] = anchorY

    for (let i = 1; i < nodeCount; i++) {
      const vx = (x[i] - prevX[i]) * damping
      const vy = (y[i] - prevY[i]) * damping
      prevX[i] = x[i]
      prevY[i] = y[i]
      field(i, force)
      x[i] += vx + force.x * dt2
      y[i] += vy + force.y * dt2
    }

    for (let i = 1; i < nodeCount; i++) {
      const dx = x[i] - x[i - 1]
      const dy = y[i] - y[i - 1]
      const scale = segmentLength / (Math.hypot(dx, dy) || 1)
      const correctionX = x[i - 1] + dx * scale - x[i]
      const correctionY = y[i - 1] + dy * scale - y[i]
      x[i] += correctionX
      y[i] += correctionY
      prevX[i] += correctionX * CORRECTION_DAMPING
      prevY[i] += correctionY * CORRECTION_DAMPING
    }
  }
}
