import type { Jellyfish } from './jellyfish'
import { RIM_TILT, TAU, bellSurfacePoint, domeOutlinePoint } from './jellyfish'
import type { Palette } from './palette'
import type { JellyfishRenderer } from './renderer'
import { depthFade } from './renderer'
import type { Ripple } from './ripple'
import type { RippleFrame, RippleSample } from './ripple'
import { prepareRipples, sampleRipples } from './ripple'
import type { Force, Strand } from './strand'

/**
 * Characters from faint to dense. Each step lists look-alikes of similar weight; every cell picks
 * one by its position, so a filled area reads as a varied texture instead of one repeated letter.
 */
const RAMP = [
  ['.', ','],
  [':', '-', ';'],
  ['=', '+', '~', '*'],
  ['t', 'o', 's', 'c', 'i'],
  ['x', 'S', '%', 'z', 'k'],
  ['X', '8', '&', 'Z', 'O'],
  ['@', '#', 'B', 'W', 'M'],
]
const GLYPHS = [...new Set(RAMP.flat())]
const RAMP_GLYPHS = RAMP.map((step) => step.map((char) => GLYPHS.indexOf(char)))
/** Raises mid-tones so bells read as solid bodies rather than speckle. */
const RAMP_GAMMA = 0.7

/** Cells fainter than this stay empty water. */
const MIN_INTENSITY = 0.06
/** Opacity of the square tile behind a fully bright cell. */
const TILE_ALPHA = 0.28
/** Opacity of the faint grid drawn over the whole water. */
const GRID_ALPHA = 0.05
/** Spacing (px) of the points a grid line is bent through where a ripple crosses it. */
const GRID_BEND_STEP = 4

/** The brightness field is drawn at this many pixels per cell side, then averaged per cell. */
const SUPERSAMPLE = 2

const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
/** Extra space around each pre-drawn character so the dark theme's glow is not cut off. */
const GLOW_PAD = 4

const OUTLINE_STEPS = 32
const MERIDIAN_COUNT = 10
const MERIDIAN_STEPS = 10
const RIM_STEPS = 32
const SCALLOP_COUNT = 16
const SCALLOP_DEPTH = 0.05

/**
 * Draws jellyfish as dense ASCII art on a grid of monospace cells, the way an image is turned into
 * ASCII.
 *
 * Each frame, every jellyfish is painted as a soft, translucent body into a small hidden canvas
 * with one brightness sample per cell. Jellyfish drawn in the ink colour add to its red channel and
 * those in the accent colour to its blue channel, so the two never mix. Each cell's brightness then
 * picks a character from `RAMP` and the opacity of a faint square tile behind it.
 */
export class AsciiRenderer implements JellyfishRenderer {
  private width = 0
  private height = 0
  private pixelRatio = 1
  private cellWidth = 10
  private cellHeight = 12
  private cols = 0
  private rows = 0
  private palette: Palette | undefined
  private field: CanvasRenderingContext2D | undefined
  private backdrop: HTMLCanvasElement | undefined
  private sheet: HTMLCanvasElement | undefined
  private spriteWidth = 0
  private spriteHeight = 0
  private pad = 0
  private readonly point: Force = { x: 0, y: 0 }
  private readonly rippleSample: RippleSample = { dx: 0, dy: 0, light: 0 }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width
    this.height = height
    this.pixelRatio = pixelRatio
    this.cellWidth = Math.min(10, Math.max(7, Math.round(width / 150)))
    this.cellHeight = this.cellWidth + 2
    this.cols = Math.ceil(width / this.cellWidth)
    this.rows = Math.ceil(height / this.cellHeight)

    const field = document.createElement('canvas')
    field.width = this.cols * SUPERSAMPLE
    field.height = this.rows * SUPERSAMPLE
    this.field =
      field.getContext('2d', { willReadFrequently: true }) ?? undefined
    this.rebuild()
  }

  setPalette(palette: Palette): void {
    this.palette = palette
    this.rebuild()
  }

  render(
    ctx: CanvasRenderingContext2D,
    group: readonly Jellyfish[],
    ripples: readonly Ripple[],
  ): void {
    const { palette, field, backdrop, sheet } = this
    if (!palette || !field || !backdrop || !sheet) return
    const shortSide = Math.min(this.width, this.height)
    const frames = prepareRipples(ripples, shortSide)

    // 1. Paint every jellyfish into the brightness field.
    const fieldWidth = field.canvas.width
    field.setTransform(1, 0, 0, 1, 0, 0)
    field.globalCompositeOperation = 'source-over'
    field.globalAlpha = 1
    field.fillStyle = '#000'
    field.fillRect(0, 0, fieldWidth, field.canvas.height)
    field.setTransform(
      SUPERSAMPLE / this.cellWidth,
      0,
      0,
      SUPERSAMPLE / this.cellHeight,
      0,
      0,
    )
    for (const jellyfish of group) this.paintJellyfish(field, jellyfish)
    const pixels = field.getImageData(
      0,
      0,
      fieldWidth,
      field.canvas.height,
    ).data

    // 2. Water and grid.
    this.drawWater(ctx, palette, backdrop, frames, shortSide)

    // 3. One tile and one character per lit cell.
    const {
      cols,
      rows,
      cellWidth,
      cellHeight,
      pad,
      spriteWidth,
      spriteHeight,
    } = this
    const samples = SUPERSAMPLE * SUPERSAMPLE * 255
    const fieldHeight = field.canvas.height
    const sample = this.rippleSample
    const drawWidth = cellWidth + pad * 2
    const drawHeight = cellHeight + pad * 2
    let tileTone = -1
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Where a ripple passes, the field is read from a shifted spot, so the jellyfish behind
        // the water appear bent by it (refraction).
        let fieldX = col * SUPERSAMPLE
        let fieldY = row * SUPERSAMPLE
        let light = 0
        if (frames.length > 0) {
          sampleRipples(
            frames,
            shortSide,
            (col + 0.5) * cellWidth,
            (row + 0.5) * cellHeight,
            sample,
          )
          fieldX = Math.min(
            fieldWidth - SUPERSAMPLE,
            Math.max(
              0,
              Math.round(fieldX + (sample.dx / cellWidth) * SUPERSAMPLE),
            ),
          )
          fieldY = Math.min(
            fieldHeight - SUPERSAMPLE,
            Math.max(
              0,
              Math.round(fieldY + (sample.dy / cellHeight) * SUPERSAMPLE),
            ),
          )
          light = sample.light
        }

        let ink = 0
        let accent = 0
        for (let sy = 0; sy < SUPERSAMPLE; sy++) {
          let offset = ((fieldY + sy) * fieldWidth + fieldX) * 4
          for (let sx = 0; sx < SUPERSAMPLE; sx++) {
            ink += pixels[offset]
            accent += pixels[offset + 2]
            offset += 4
          }
        }
        const tone = accent > ink ? 1 : 0
        const intensity = Math.max(ink, accent) / samples + light
        if (intensity < MIN_INTENSITY) continue

        const x = col * cellWidth
        const y = row * cellHeight
        if (tone !== tileTone) {
          ctx.fillStyle = tone === 1 ? palette.accent : palette.ink
          tileTone = tone
        }
        ctx.globalAlpha = intensity * TILE_ALPHA
        ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2)

        const step = Math.min(
          RAMP.length - 1,
          Math.floor(intensity ** RAMP_GAMMA * RAMP.length),
        )
        const choices = RAMP_GLYPHS[step]
        const glyph = choices[cellHash(col, row) % choices.length]
        ctx.globalAlpha = Math.min(1, 0.25 + intensity * 1.1)
        ctx.drawImage(
          sheet,
          glyph * spriteWidth,
          tone * spriteHeight,
          spriteWidth,
          spriteHeight,
          x - pad,
          y - pad,
          drawWidth,
          drawHeight,
        )
      }
    }
    ctx.globalAlpha = 1
  }

  /**
   * Paints one jellyfish as light: translucent tentacles and oral arms, then a bell that is
   * brighter at the top and along its edges, with a darker opening underneath.
   */
  private paintJellyfish(
    field: CanvasRenderingContext2D,
    jellyfish: Jellyfish,
  ) {
    const fade = depthFade(jellyfish.depth)
    const channel = jellyfish.tint === 1 ? '0, 0, 255' : '255, 0, 0'
    const color = `rgb(${channel})`
    const cell = this.cellWidth

    field.globalCompositeOperation = 'lighter'
    field.lineCap = 'round'
    field.lineJoin = 'round'
    field.strokeStyle = color
    field.fillStyle = color

    for (const tentacle of jellyfish.tentacles) {
      paintStrand(
        field,
        tentacle.strand,
        cell * 0.8,
        (tentacle.front ? 0.65 : 0.4) * fade,
      )
    }
    for (const arm of jellyfish.oralArms) {
      field.globalAlpha = 0.3 * fade
      field.lineWidth = cell * 1.3
      traceStrand(field, arm.strand, 0, arm.strand.nodeCount - 1)
      field.globalAlpha = 0.35 * fade
      field.lineWidth = cell * 0.45
      traceStrand(field, arm.strand, 0, arm.strand.nodeCount - 1)
    }

    const halfWidth = jellyfish.bellHalfWidth
    const height = jellyfish.bellHeight
    const { point } = this
    field.save()
    field.translate(jellyfish.x, jellyfish.y)
    field.rotate(jellyfish.rotation)

    const dome = new Path2D()
    for (let k = 0; k <= OUTLINE_STEPS; k++) {
      domeOutlinePoint(
        halfWidth,
        height,
        -Math.PI / 2 + (Math.PI * k) / OUTLINE_STEPS,
        point,
      )
      dome.lineTo(point.x, point.y)
    }
    const body = new Path2D(dome)
    for (let k = 1; k < OUTLINE_STEPS; k++) {
      const azimuth = (Math.PI * k) / OUTLINE_STEPS
      body.lineTo(
        halfWidth * Math.cos(azimuth),
        halfWidth * RIM_TILT * Math.sin(azimuth),
      )
    }

    // Body, brightest at the apex.
    const shade = field.createLinearGradient(
      0,
      -height,
      0,
      halfWidth * RIM_TILT,
    )
    shade.addColorStop(0, `rgba(${channel}, 1)`)
    shade.addColorStop(0.6, `rgba(${channel}, 0.8)`)
    shade.addColorStop(1, `rgba(${channel}, 0.6)`)
    field.globalAlpha = fade
    field.fillStyle = shade
    // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- canvas fill, not Array#fill
    field.fill(body)

    // The opening under the bell is darker. Painting black over the field dims whatever lies
    // there, including jellyfish further back, which reads as the bell hiding them.
    field.globalCompositeOperation = 'source-over'
    field.globalAlpha = 0.45 * fade
    field.fillStyle = '#000'
    field.beginPath()
    field.ellipse(
      0,
      -height * 0.05,
      halfWidth * 0.82,
      halfWidth * 0.82 * RIM_TILT,
      0,
      0,
      TAU,
    )
    field.fill()
    field.globalCompositeOperation = 'lighter'
    field.fillStyle = color

    // Radial canals on the near side.
    field.lineWidth = cell * 0.3
    field.globalAlpha = 0.25 * fade
    for (let m = 0; m < MERIDIAN_COUNT; m++) {
      const azimuth = ((m + 0.5) / MERIDIAN_COUNT) * TAU
      if (Math.sin(azimuth) <= 0) continue
      field.beginPath()
      for (let s = 1; s <= MERIDIAN_STEPS; s++) {
        bellSurfacePoint(
          halfWidth,
          height,
          (s / MERIDIAN_STEPS) * (Math.PI / 2),
          azimuth,
          point,
        )
        field.lineTo(point.x, point.y)
      }
      field.stroke()
    }

    // Four gonads, glowing through the bell.
    for (let k = 0; k < 4; k++) {
      const azimuth = Math.PI / 4 + (k * Math.PI) / 2
      const depth = bellSurfacePoint(halfWidth, height, 0.62, azimuth, point)
      const size = halfWidth * 0.2
      field.globalAlpha = (depth > 0 ? 0.45 : 0.2) * fade
      field.beginPath()
      field.ellipse(point.x, point.y, size, size * 0.65, 0, 0, TAU)
      field.fill()
    }

    // Bright edges: the dome outline and the scalloped near rim.
    field.globalAlpha = 0.55 * fade
    field.lineWidth = cell * 0.7
    field.stroke(dome)
    field.globalAlpha = 0.6 * fade
    field.lineWidth = cell * 0.8
    field.beginPath()
    for (let k = 0; k <= RIM_STEPS; k++) {
      const azimuth = (Math.PI * k) / RIM_STEPS
      const scallop =
        1 + SCALLOP_DEPTH * Math.abs(Math.sin((SCALLOP_COUNT / 2) * azimuth))
      field.lineTo(
        halfWidth * scallop * Math.cos(azimuth),
        halfWidth * scallop * RIM_TILT * Math.sin(azimuth),
      )
    }
    field.stroke()

    field.restore()
  }

  /**
   * Draws the water and its faint grid. With no ripples this is the cached picture. While ripples
   * are alive, the grid is redrawn bent by them, so even a single ripple shows across open water
   * by the way it bends the grid, the same way it bends the jellyfish.
   */
  private drawWater(
    ctx: CanvasRenderingContext2D,
    palette: Palette,
    backdrop: HTMLCanvasElement,
    frames: readonly RippleFrame[],
    shortSide: number,
  ) {
    const { width, height, cellWidth, cellHeight } = this
    ctx.globalAlpha = 1
    if (frames.length === 0) {
      ctx.drawImage(backdrop, 0, 0, width, height)
      return
    }

    ctx.fillStyle = palette.water
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = palette.ink
    ctx.globalAlpha = GRID_ALPHA
    ctx.lineWidth = 1 / this.pixelRatio
    ctx.beginPath()
    for (let x = cellWidth; x < width; x += cellWidth) {
      this.traceGridLine(ctx, frames, shortSide, true, x, height)
    }
    for (let y = cellHeight; y < height; y += cellHeight) {
      this.traceGridLine(ctx, frames, shortSide, false, y, width)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  /**
   * Adds one grid line to the current path. It is straight where no ripple reaches and bent
   * through closely spaced points where one does. Each ripple can only reach a square around its
   * centre, so only the stretches of the line inside those squares are bent.
   */
  private traceGridLine(
    ctx: CanvasRenderingContext2D,
    frames: readonly RippleFrame[],
    shortSide: number,
    vertical: boolean,
    position: number,
    length: number,
  ) {
    // Stretches along the line that some ripple may reach, in order along the line.
    const spans: [number, number][] = []
    for (const { ripple, reach } of frames) {
      const across = vertical ? ripple.x : ripple.y
      if (Math.abs(position - across) > reach) continue
      const along = vertical ? ripple.y : ripple.x
      spans.push([Math.max(0, along - reach), Math.min(length, along + reach)])
    }
    spans.sort((a, b) => a[0] - b[0])

    const sample = this.rippleSample
    const lineTo = (along: number, bent: boolean) => {
      const x = vertical ? position : along
      const y = vertical ? along : position
      if (!bent) {
        ctx.lineTo(x, y)
        return
      }
      sampleRipples(frames, shortSide, x, y, sample)
      // What lies at a point is seen shifted back by the refraction, the reverse of how cells
      // read the jellyfish.
      ctx.lineTo(x - sample.dx, y - sample.dy)
    }

    ctx.moveTo(vertical ? position : 0, vertical ? 0 : position)
    let end = 0
    for (const [spanStart, spanEnd] of spans) {
      // Overlapping stretches continue from where the previous one ended.
      const start = Math.max(spanStart, end)
      if (start >= spanEnd) continue
      lineTo(start, false)
      for (let along = start; along < spanEnd; along += GRID_BEND_STEP) {
        lineTo(along, true)
      }
      lineTo(spanEnd, false)
      end = spanEnd
    }
    lineTo(length, false)
  }

  /** Rebuilds everything that depends on both the size and the palette. */
  private rebuild() {
    if (!this.palette || this.cols === 0) return
    this.buildBackdrop(this.palette)
    this.buildSheet(this.palette)
  }

  /** Water colour with a faint grid that shows the cells, drawn once per size and palette. */
  private buildBackdrop(palette: Palette) {
    const { width, height, pixelRatio, cellWidth, cellHeight } = this
    const backdrop = document.createElement('canvas')
    backdrop.width = Math.round(width * pixelRatio)
    backdrop.height = Math.round(height * pixelRatio)
    const g = backdrop.getContext('2d')
    if (!g) return
    g.scale(pixelRatio, pixelRatio)
    g.fillStyle = palette.water
    g.fillRect(0, 0, width, height)
    g.strokeStyle = palette.ink
    g.globalAlpha = GRID_ALPHA
    g.lineWidth = 1 / pixelRatio
    g.beginPath()
    for (let x = cellWidth; x < width; x += cellWidth) {
      g.moveTo(x, 0)
      g.lineTo(x, height)
    }
    for (let y = cellHeight; y < height; y += cellHeight) {
      g.moveTo(0, y)
      g.lineTo(width, y)
    }
    g.stroke()
    this.backdrop = backdrop
  }

  /** Pre-draws every character in both colours, with the glow baked in for the dark theme. */
  private buildSheet(palette: Palette) {
    const { pixelRatio, cellWidth, cellHeight } = this
    this.pad = palette.glow ? GLOW_PAD : 0
    this.spriteWidth = Math.ceil((cellWidth + this.pad * 2) * pixelRatio)
    this.spriteHeight = Math.ceil((cellHeight + this.pad * 2) * pixelRatio)

    const sheet = document.createElement('canvas')
    sheet.width = this.spriteWidth * GLYPHS.length
    sheet.height = this.spriteHeight * 2
    const g = sheet.getContext('2d')
    if (!g) return
    g.font = `600 ${Math.round(cellHeight * 0.8 * pixelRatio)}px ${FONT_FAMILY}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (const [tone, color] of [
      [0, palette.ink],
      [1, palette.accent],
    ] as const) {
      g.fillStyle = color
      g.shadowColor = color
      g.shadowBlur = palette.glow ? 4 * pixelRatio : 0
      GLYPHS.forEach((glyph, index) => {
        g.fillText(
          glyph,
          (index + 0.5) * this.spriteWidth,
          (tone + 0.5) * this.spriteHeight,
        )
      })
    }
    this.sheet = sheet
  }
}

/** Stable pseudo-random number per cell, used to vary characters of the same weight. */
function cellHash(col: number, row: number): number {
  return ((col * 73856093) ^ (row * 19349663)) >>> 0
}

/** Strokes a strand in three bands that fade towards the tip. */
function paintStrand(
  field: CanvasRenderingContext2D,
  strand: Strand,
  width: number,
  alpha: number,
) {
  const last = strand.nodeCount - 1
  const firstCut = Math.floor(last * 0.4)
  const secondCut = Math.floor(last * 0.75)
  field.lineWidth = width
  field.globalAlpha = alpha
  traceStrand(field, strand, 0, firstCut)
  field.globalAlpha = alpha * 0.7
  traceStrand(field, strand, firstCut, secondCut)
  field.globalAlpha = alpha * 0.4
  field.lineWidth = width * 0.8
  traceStrand(field, strand, secondCut, last)
}

/** Strokes nodes `from`..`to` of a strand as one smooth curve through the segment midpoints. */
function traceStrand(
  field: CanvasRenderingContext2D,
  strand: Strand,
  from: number,
  to: number,
) {
  const { x, y } = strand
  field.beginPath()
  field.moveTo(x[from], y[from])
  for (let i = from + 1; i < to; i++) {
    field.quadraticCurveTo(
      x[i],
      y[i],
      (x[i] + x[i + 1]) / 2,
      (y[i] + y[i + 1]) / 2,
    )
  }
  field.lineTo(x[to], y[to])
  field.stroke()
}
