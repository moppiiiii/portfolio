import type { Jellyfish, OralArm, Tentacle } from './jellyfish'
import { RIM_TILT, TAU, bellSurfacePoint, domeOutlinePoint } from './jellyfish'
import type { Palette } from './palette'
import type {
  JellyfishRenderer,
  PictureDraw,
  Rays,
  Rect,
  School,
  SideTanks,
  View,
} from './renderer'
import { creatureFade, jellyfishFade } from './renderer'
import type { Ripple } from './ripple'
import { forEachRing, ringBend, ringPatch } from './ripple'
import type { Force, Strand } from './strand'

const MERIDIAN_COUNT = 16
const MERIDIAN_STEPS = 14
const OUTLINE_STEPS = 48
const RIM_STEPS = 48
const SCALLOP_COUNT = 16
const SCALLOP_DEPTH = 0.035
/** Pieces each ripple ring is drawn in, so its strength can vary around the circle. */
const RIPPLE_SEGMENTS = 48

/** Opacity of the water colour laid over the drawing under page text. */
const UNDER_TEXT_VEIL = 0.8
/** Margin (px) the veil reaches past the text, and how far (px) its edge blurs out. */
const VEIL_MARGIN = 4
const VEIL_BLUR = 16

// Line opacity for the parts of the bell facing the viewer and facing away.
const FRONT_ALPHA = 0.55
const BACK_ALPHA = 0.16

/** Draws jellyfish as thin ink lines, like a plate in Haeckel's "Kunstformen der Natur". */
export class LineRenderer implements JellyfishRenderer {
  private width = 0
  private height = 0
  private palette: Palette | undefined
  /** Opacity multiplier of the jellyfish being drawn, from its depth. */
  private fade = 1
  private readonly point: Force = { x: 0, y: 0 }
  /** Reused buffers for oral-arm outlines, so drawing allocates nothing per frame. */
  private readonly leftX = new Float32Array(64)
  private readonly leftY = new Float32Array(64)
  private readonly rightX = new Float32Array(64)
  private readonly rightY = new Float32Array(64)

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
  }

  setPalette(palette: Palette): void {
    this.palette = palette
  }

  /** Line drawings show pictures as they are, only faded and in grey. */
  preparePicture(image: HTMLImageElement): CanvasImageSource {
    return image
  }

  render(
    ctx: CanvasRenderingContext2D,
    group: readonly Jellyfish[],
    ripples: readonly Ripple[],
    view: View,
    pictures: readonly PictureDraw[],
    textRects: readonly Rect[],
    sides?: SideTanks,
  ): void {
    const { palette } = this
    if (!palette) return
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    ctx.fillStyle = palette.water
    ctx.fillRect(0, 0, this.width, this.height)
    for (const picture of pictures) this.drawPicture(ctx, picture)

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (palette.glow) {
      ctx.shadowColor = palette.ink
      ctx.shadowBlur = 6
    }
    ctx.save()
    if (view.clip) {
      ctx.beginPath()
      ctx.rect(view.clip.x, view.clip.y, view.clip.width, view.clip.height)
      ctx.clip()
    }
    ctx.transform(view.zoom, 0, 0, view.zoom, view.offsetX, view.offsetY)
    const body = view.bodyScale ?? 1
    for (const jellyfish of group) {
      this.fade = jellyfishFade(jellyfish, view)
      const color = jellyfish.tint === 1 ? palette.accent : palette.ink
      ctx.strokeStyle = color
      ctx.fillStyle = color
      if (palette.glow) ctx.shadowColor = color
      // The body scaled about its own place, so only its size changes, not where it swims.
      ctx.save()
      ctx.translate(jellyfish.x * (1 - body), jellyfish.y * (1 - body))
      ctx.scale(body, body)
      this.drawJellyfish(ctx, jellyfish, palette)
      ctx.restore()
    }
    ctx.restore()
    if (sides?.school) this.drawSchool(ctx, sides.school, palette)
    if (sides?.rays) this.drawRays(ctx, sides.rays, palette)
    if (sides?.ocean) {
      const { ocean } = sides
      this.drawRays(ctx, { rays: ocean.rays, view: ocean.view }, palette)
    }
    this.drawRipples(ctx, ripples, palette)
    this.veilText(ctx, textRects, palette)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  /** Rays in their own tank, each as a faint filled outline. */
  private drawRays(
    ctx: CanvasRenderingContext2D,
    { rays, view }: Rays,
    palette: Palette,
  ) {
    ctx.save()
    if (view.clip) {
      ctx.beginPath()
      ctx.rect(view.clip.x, view.clip.y, view.clip.width, view.clip.height)
      ctx.clip()
    }
    ctx.transform(view.zoom, 0, 0, view.zoom, view.offsetX, view.offsetY)
    const body = view.bodyScale ?? 1
    ctx.fillStyle = palette.ink
    for (const ray of rays) {
      ctx.save()
      ctx.translate(ray.x * (1 - body), ray.y * (1 - body))
      ctx.scale(body, body)
      ctx.globalAlpha = 0.4 * creatureFade(ray, view)
      ctx.beginPath()
      for (const point of ray.outline()) ctx.lineTo(point.x, point.y)
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }

  /** Goldfish in their own tank, each as one thick orange stroke along its spine. */
  private drawSchool(
    ctx: CanvasRenderingContext2D,
    { fish: school, view }: School,
    palette: Palette,
  ) {
    ctx.save()
    if (view.clip) {
      ctx.beginPath()
      ctx.rect(view.clip.x, view.clip.y, view.clip.width, view.clip.height)
      ctx.clip()
    }
    ctx.transform(view.zoom, 0, 0, view.zoom, view.offsetX, view.offsetY)
    const body = view.bodyScale ?? 1
    ctx.strokeStyle = palette.gold
    for (const fish of school) {
      ctx.save()
      ctx.translate(fish.x * (1 - body), fish.y * (1 - body))
      ctx.scale(body, body)
      ctx.globalAlpha = 0.8 * creatureFade(fish, view)
      ctx.lineWidth = fish.halfWidth * 1.6
      ctx.beginPath()
      for (const point of fish.spine) ctx.lineTo(point.x, point.y)
      ctx.stroke()
      ctx.restore()
    }
    ctx.restore()
  }

  /**
   * Lines cannot be thinned cell by cell the way characters are, so the drawing is covered with a
   * soft-edged veil of water colour under page text instead.
   */
  private veilText(
    ctx: CanvasRenderingContext2D,
    rects: readonly Rect[],
    palette: Palette,
  ) {
    if (rects.length === 0) return
    ctx.save()
    ctx.globalAlpha = UNDER_TEXT_VEIL
    ctx.fillStyle = palette.water
    ctx.shadowColor = palette.water
    ctx.shadowBlur = VEIL_BLUR
    for (const rect of rects) {
      ctx.fillRect(
        rect.x - VEIL_MARGIN,
        rect.y - VEIL_MARGIN,
        rect.width + VEIL_MARGIN * 2,
        rect.height + VEIL_MARGIN * 2,
      )
    }
    ctx.restore()
  }

  private drawPicture(ctx: CanvasRenderingContext2D, picture: PictureDraw) {
    if (picture.alpha <= 0) return
    ctx.save()
    ctx.globalAlpha = Math.min(1, picture.alpha) * 0.5
    ctx.filter = 'grayscale(1)'
    const { clip } = picture
    if (clip) {
      ctx.beginPath()
      if (!clip.inside) ctx.rect(0, 0, this.width, this.height)
      ctx.arc(clip.x, clip.y, Math.max(0, clip.radius), 0, TAU)
      ctx.clip(clip.inside ? 'nonzero' : 'evenodd')
    }
    ctx.drawImage(
      picture.source,
      picture.x,
      picture.y,
      picture.width,
      picture.height,
    )
    ctx.restore()
  }

  /**
   * Draws ripple rings as faint, uneven ink lines. This style cannot bend what lies behind the
   * water the way the ASCII style does, so the rings stay very light instead.
   */
  private drawRipples(
    ctx: CanvasRenderingContext2D,
    ripples: readonly Ripple[],
    palette: Palette,
  ) {
    const shortSide = Math.min(this.width, this.height)
    ctx.strokeStyle = palette.ink
    if (palette.glow) ctx.shadowColor = palette.ink
    ctx.lineWidth = 1
    for (const ripple of ripples) {
      forEachRing(ripple, shortSide, (radius, strength) => {
        for (let k = 0; k < RIPPLE_SEGMENTS; k++) {
          const from = (k / RIPPLE_SEGMENTS) * TAU
          const to = ((k + 1) / RIPPLE_SEGMENTS) * TAU
          const middle = (from + to) / 2
          ctx.globalAlpha = strength * ringPatch(ripple, middle) * 0.3
          ctx.beginPath()
          for (const angle of [from, middle, to]) {
            const bent = radius * ringBend(ripple, angle)
            ctx.lineTo(
              ripple.x + Math.cos(angle) * bent,
              ripple.y + Math.sin(angle) * bent,
            )
          }
          ctx.stroke()
        }
      })
    }
  }

  private alpha(ctx: CanvasRenderingContext2D, value: number) {
    ctx.globalAlpha = value * this.fade
  }

  private drawJellyfish(
    ctx: CanvasRenderingContext2D,
    jellyfish: Jellyfish,
    palette: Palette,
  ) {
    for (const tentacle of jellyfish.tentacles) {
      if (!tentacle.front) this.drawTentacle(ctx, tentacle, 0.35)
    }
    for (const arm of jellyfish.oralArms) {
      this.drawOralArm(ctx, arm, jellyfish)
    }

    ctx.save()
    ctx.translate(jellyfish.x, jellyfish.y)
    ctx.rotate(jellyfish.rotation)
    // Gonads take the other palette colour so they stand out from the body.
    const [bodyColor, gonadColor] =
      jellyfish.tint === 1
        ? [palette.accent, palette.ink]
        : [palette.ink, palette.accent]
    this.drawBell(
      ctx,
      jellyfish.bellHalfWidth,
      jellyfish.bellHeight,
      bodyColor,
      gonadColor,
    )
    ctx.restore()

    for (const tentacle of jellyfish.tentacles) {
      if (tentacle.front) this.drawTentacle(ctx, tentacle, 0.8)
    }
  }

  /** Draws the bell in its own frame: rim centre at the origin, apex towards -y. */
  private drawBell(
    ctx: CanvasRenderingContext2D,
    halfWidth: number,
    height: number,
    bodyColor: string,
    gonadColor: string,
  ) {
    const { point } = this

    // Translucent body: the dome silhouette closed by the front half of the rim.
    const dome = new Path2D()
    for (let k = 0; k <= OUTLINE_STEPS; k++) {
      const side = -Math.PI / 2 + (Math.PI * k) / OUTLINE_STEPS
      domeOutlinePoint(halfWidth, height, side, point)
      dome.lineTo(point.x, point.y)
    }
    const body = new Path2D(dome)
    for (let k = 0; k <= OUTLINE_STEPS; k++) {
      const azimuth = (Math.PI * k) / OUTLINE_STEPS
      body.lineTo(
        halfWidth * Math.cos(azimuth),
        halfWidth * RIM_TILT * Math.sin(azimuth),
      )
    }
    this.alpha(ctx, 0.07)
    // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- canvas fill, not Array#fill
    ctx.fill(body)

    // Everything seen through the bell stays inside its outline. Without the clip, lines on the
    // far side would poke out above the dome.
    ctx.save()
    ctx.clip(body)

    // Radial canals, drawn as meridians from the apex down to the rim.
    ctx.lineWidth = 0.8
    for (let m = 0; m < MERIDIAN_COUNT; m++) {
      const azimuth = (m / MERIDIAN_COUNT) * TAU
      this.alpha(ctx, Math.sin(azimuth) > 0 ? FRONT_ALPHA : BACK_ALPHA)
      ctx.beginPath()
      for (let s = 1; s <= MERIDIAN_STEPS; s++) {
        const polar = (s / MERIDIAN_STEPS) * (Math.PI / 2)
        bellSurfacePoint(halfWidth, height, polar, azimuth, point)
        if (s === 1) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      }
      ctx.stroke()
    }

    // Four gonad rings seen through the bell, as on a moon jelly.
    ctx.strokeStyle = gonadColor
    for (let k = 0; k < 4; k++) {
      const azimuth = Math.PI / 4 + (k * Math.PI) / 2
      const depth = bellSurfacePoint(halfWidth, height, 0.62, azimuth, point)
      const size = halfWidth * 0.17
      this.alpha(ctx, depth > 0 ? 0.6 : BACK_ALPHA)
      ctx.beginPath()
      ctx.ellipse(point.x, point.y, size, size * 0.62, 0, 0, TAU)
      ctx.stroke()
    }
    ctx.strokeStyle = bodyColor

    // Far half of the scalloped rim, seen through the bell.
    this.drawRim(ctx, halfWidth, Math.PI, TAU, BACK_ALPHA + 0.1)

    // Inner margin (velum), slightly inside and above the rim.
    ctx.lineWidth = 0.7
    this.alpha(ctx, 0.3)
    ctx.beginPath()
    ctx.ellipse(
      0,
      -height * 0.06,
      halfWidth * 0.86,
      halfWidth * 0.86 * RIM_TILT,
      0,
      0,
      TAU,
    )
    ctx.stroke()
    ctx.restore()

    // Outline of the dome and the near half of the rim, drawn last and strongest.
    this.alpha(ctx, 0.9)
    ctx.lineWidth = 1.2
    ctx.stroke(dome)
    this.drawRim(ctx, halfWidth, 0, Math.PI, 0.9)
  }

  private drawRim(
    ctx: CanvasRenderingContext2D,
    halfWidth: number,
    from: number,
    to: number,
    alpha: number,
  ) {
    this.alpha(ctx, alpha)
    ctx.lineWidth = 1.1
    ctx.beginPath()
    for (let k = 0; k <= RIM_STEPS; k++) {
      const azimuth = from + ((to - from) * k) / RIM_STEPS
      const scallop =
        1 + SCALLOP_DEPTH * Math.abs(Math.sin((SCALLOP_COUNT / 2) * azimuth))
      const x = halfWidth * scallop * Math.cos(azimuth)
      const y = halfWidth * scallop * RIM_TILT * Math.sin(azimuth)
      if (k === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  /** Draws a tentacle in three bands that get thinner and fainter towards the tip. */
  private drawTentacle(
    ctx: CanvasRenderingContext2D,
    tentacle: Tentacle,
    alpha: number,
  ) {
    const { strand } = tentacle
    const last = strand.nodeCount - 1
    const firstCut = Math.floor(last * 0.4)
    const secondCut = Math.floor(last * 0.75)

    this.alpha(ctx, alpha)
    ctx.lineWidth = 1.1
    traceStrand(ctx, strand, 0, firstCut)
    this.alpha(ctx, alpha * 0.7)
    ctx.lineWidth = 0.8
    traceStrand(ctx, strand, firstCut, secondCut)
    this.alpha(ctx, alpha * 0.4)
    ctx.lineWidth = 0.55
    traceStrand(ctx, strand, secondCut, last)
  }

  /** Draws an oral arm as a ruffled ribbon that narrows towards its end. */
  private drawOralArm(
    ctx: CanvasRenderingContext2D,
    arm: OralArm,
    jellyfish: Jellyfish,
  ) {
    const { leftX, leftY, rightX, rightY } = this
    const { x, y, nodeCount } = arm.strand
    const baseWidth = jellyfish.radius * 0.075
    const time = jellyfish.time

    for (let i = 0; i < nodeCount; i++) {
      const prev = Math.max(0, i - 1)
      const next = Math.min(nodeCount - 1, i + 1)
      const dx = x[next] - x[prev]
      const dy = y[next] - y[prev]
      const length = Math.hypot(dx, dy) || 1
      const normalX = -dy / length
      const normalY = dx / length
      const taper = (1 - i / nodeCount) ** 0.6
      const width = baseWidth * taper + jellyfish.radius * 0.008
      const ruffle = i * 1.7 + time * 2.4 + arm.swaySeed
      const left = width * (1 + 0.35 * Math.sin(ruffle))
      const right = width * (1 + 0.35 * Math.sin(ruffle + 2))
      leftX[i] = x[i] + normalX * left
      leftY[i] = y[i] + normalY * left
      rightX[i] = x[i] - normalX * right
      rightY[i] = y[i] - normalY * right
    }

    this.alpha(ctx, 0.06)
    ctx.beginPath()
    for (let i = 0; i < nodeCount; i++) ctx.lineTo(leftX[i], leftY[i])
    for (let i = nodeCount - 1; i >= 0; i--) ctx.lineTo(rightX[i], rightY[i])
    ctx.fill()

    this.alpha(ctx, 0.45)
    ctx.lineWidth = 0.75
    for (const [edgeX, edgeY] of [
      [leftX, leftY],
      [rightX, rightY],
    ] as const) {
      ctx.beginPath()
      for (let i = 0; i < nodeCount; i++) ctx.lineTo(edgeX[i], edgeY[i])
      ctx.stroke()
    }
  }
}

/** Strokes nodes `from`..`to` of a strand as one smooth curve through the segment midpoints. */
function traceStrand(
  ctx: CanvasRenderingContext2D,
  strand: Strand,
  from: number,
  to: number,
) {
  const { x, y } = strand
  ctx.beginPath()
  ctx.moveTo(x[from], y[from])
  for (let i = from + 1; i < to; i++) {
    ctx.quadraticCurveTo(
      x[i],
      y[i],
      (x[i] + x[i + 1]) / 2,
      (y[i] + y[i + 1]) / 2,
    )
  }
  ctx.lineTo(x[to], y[to])
  ctx.stroke()
}
