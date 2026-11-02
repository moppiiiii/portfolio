import type { Dolphin } from './dolphin'
import type { Goldfish } from './goldfish'
import { bodyProfile } from './goldfish'
import type { Jellyfish } from './jellyfish'
import { RIM_TILT, TAU, bellSurfacePoint, domeOutlinePoint } from './jellyfish'
import type { Manta } from './manta'
import type { Palette } from './palette'
import type {
  JellyfishRenderer,
  PictureDraw,
  Rect,
  SideTanks,
  View,
} from './renderer'
import { creatureFade, jellyfishFade } from './renderer'
import type { Ripple } from './ripple'
import type { RippleFrame, RippleSample } from './ripple'
import { prepareRipples, sampleRipples } from './ripple'
import type { Shark } from './shark'
import type { Force, Strand } from './strand'
import type { Part, SeaTurtle } from './turtle'

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
// The ramp's characters first, then the eye, which is only ever placed on purpose.
const GLYPHS = [...new Set([...RAMP.flat(), 'o'])]
/** Eyes, drawn as this character whatever the brightness there. */
const EYE_GLYPH = GLYPHS.indexOf('o')

/**
 * A cell given a character of its own, whatever the brightness there makes of it, in one of the
 * palette's colours (0 ink, 1 accent, 2 gold).
 */
type Mark = { glyph: number; strength: number; tone: number }
const RAMP_GLYPHS = RAMP.map((step) => step.map((char) => GLYPHS.indexOf(char)))
/** Raises mid-tones so bells read as solid bodies rather than speckle. */
const RAMP_GAMMA = 0.7

/** Cells fainter than this stay empty water. */
const MIN_INTENSITY = 0.06
/** Opacity of the faint grid drawn over the whole water. */
const GRID_ALPHA = 0.05
/** Spacing (px) of the points a grid line is bent through where a ripple crosses it. */
const GRID_BEND_STEP = 4

/** Share of its brightness the water keeps right under page text. */
const UNDER_TEXT_BRIGHTNESS = 0.25
/** Margin (px) around text where the water stays at its faintest. */
const TEXT_MARGIN = 4
/** Distance (px) beyond that margin over which the water returns to full brightness. */
const TEXT_FEATHER = 22

/** Pictures are reduced to at most this width (px) before drawing; cells need no more detail. */
const PICTURE_MAX_WIDTH = 480
/** Brightness below this share of the range counts as empty water in a picture. */
const PICTURE_FLOOR = 0.06
/**
 * Share of a picture's pixels, counted by how far they are from its background, below which
 * full brightness is set. Lower than 1 so a few extreme pixels do not decide the scale.
 */
const PICTURE_PEAK = 0.98
/** Smallest difference from the background that may count as full brightness. */
const MIN_PICTURE_RANGE = 0.12

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
  /** Brightness maps of pictures, per image, for the current palette. */
  private pictures = new WeakMap<HTMLImageElement, HTMLCanvasElement>()
  private readonly rippleSample: RippleSample = { dx: 0, dy: 0, light: 0 }
  /** Per cell, the share of brightness kept because of text over it (1 = no text nearby). */
  private textShade = new Float32Array(0)

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width
    this.height = height
    this.pixelRatio = pixelRatio
    this.cellWidth = Math.min(10, Math.max(7, Math.round(width / 150)))
    this.cellHeight = this.cellWidth + 2
    this.cols = Math.ceil(width / this.cellWidth)
    this.rows = Math.ceil(height / this.cellHeight)
    this.textShade = new Float32Array(this.cols * this.rows)

    const field = document.createElement('canvas')
    field.width = this.cols * SUPERSAMPLE
    field.height = this.rows * SUPERSAMPLE
    this.field =
      field.getContext('2d', { willReadFrequently: true }) ?? undefined
    this.rebuild()
  }

  setPalette(palette: Palette): void {
    this.palette = palette
    this.pictures = new WeakMap()
    this.rebuild()
  }

  /**
   * Turns an image into a brightness map in the ink channel, so it is drawn with the same
   * characters as the jellyfish. What counts is how far each pixel is from the image's background
   * colour, read from its edges: the background stays empty water and the content becomes dense
   * characters, on either theme, whether the image is light or dark.
   */
  preparePicture(image: HTMLImageElement): CanvasImageSource {
    const cached = this.pictures.get(image)
    if (cached) return cached
    const scale = Math.min(1, PICTURE_MAX_WIDTH / (image.naturalWidth || 1))
    const map = document.createElement('canvas')
    map.width = Math.max(1, Math.round(image.naturalWidth * scale))
    map.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const g = map.getContext('2d', { willReadFrequently: true })
    if (!g) return map
    g.drawImage(image, 0, 0, map.width, map.height)
    const data = g.getImageData(0, 0, map.width, map.height)
    const { data: pixels } = data
    const luminanceAt = (i: number) =>
      (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) /
      255
    const background = edgeLuminance(map.width, map.height, luminanceAt)
    const distance = (i: number) =>
      Math.abs(luminanceAt(i) - background) * (pixels[i + 3] / 255)
    // Stretch so the image's own strongest content reaches full brightness. Pale, low-contrast
    // images (a map, a light UI) would otherwise fade into the water.
    const range = Math.max(
      MIN_PICTURE_RANGE,
      percentile(pixels.length / 4, (n) => distance(n * 4), PICTURE_PEAK),
    )
    for (let i = 0; i < pixels.length; i += 4) {
      const ink = Math.min(1, distance(i) / range)
      const level = Math.max(0, (ink - PICTURE_FLOOR) / (1 - PICTURE_FLOOR))
      pixels[i] = Math.round(level ** 0.9 * 255)
      pixels[i + 1] = 0
      pixels[i + 2] = 0
      pixels[i + 3] = 255
    }
    g.putImageData(data, 0, 0)
    this.pictures.set(image, map)
    return map
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
    const { palette, field, backdrop, sheet } = this
    const school = sides?.school
    const rays = sides?.rays
    const ocean = sides?.ocean
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
    // Pictures sit in screen space, under the jellyfish.
    const toCellsX = SUPERSAMPLE / this.cellWidth
    const toCellsY = SUPERSAMPLE / this.cellHeight
    field.setTransform(toCellsX, 0, 0, toCellsY, 0, 0)
    for (const picture of pictures) this.paintPicture(field, picture)
    field.save()
    this.clipToTank(field, view)
    for (const jellyfish of group) {
      this.placeBody(field, view, jellyfish)
      this.paintJellyfish(field, jellyfish, view)
    }
    field.restore()
    if (school) {
      field.save()
      this.clipToTank(field, school.view)
      for (const fish of school.fish) {
        this.placeBody(field, school.view, fish)
        this.paintFish(field, fish, school.view)
      }
      field.restore()
    }
    if (rays) {
      field.save()
      this.clipToTank(field, rays.view)
      for (const ray of rays.rays) {
        this.placeBody(field, rays.view, ray)
        this.paintRay(field, ray, rays.view)
      }
      field.restore()
    }
    if (ocean) {
      // The sharks swim deepest, then the turtles, and the rays glide over them.
      field.save()
      this.clipToTank(field, ocean.view)
      for (const shark of ocean.sharks) {
        this.placeBody(field, ocean.view, shark)
        this.paintShark(field, shark, ocean.view)
      }
      for (const dolphin of ocean.dolphins) {
        this.placeBody(field, ocean.view, dolphin)
        this.paintDolphin(field, dolphin, ocean.view)
      }
      for (const turtle of ocean.turtles) {
        this.placeBody(field, ocean.view, turtle)
        this.paintTurtle(field, turtle, ocean.view)
      }
      for (const ray of ocean.rays) {
        this.placeBody(field, ocean.view, ray)
        this.paintRay(field, ray, ocean.view)
      }
      field.restore()
    }
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
    const shade = this.shadeUnderText(textRects)
    const marks = this.markCells(sides)
    const tones = [palette.ink, palette.accent, palette.gold]
    const tileAlpha = palette.tile
    const gap = palette.tileGap
    const { lift } = palette
    let tileTone = -1
    /** Draws one cell: its tile, then its character. */
    const drawCell = (
      col: number,
      row: number,
      tone: number,
      glyph: number,
      alpha: number,
      tile: number,
    ) => {
      const x = col * cellWidth
      const y = row * cellHeight
      if (tileAlpha > 0) {
        if (tone !== tileTone) {
          ctx.fillStyle = tones[tone]
          tileTone = tone
        }
        ctx.globalAlpha = tile
        ctx.fillRect(
          x + gap,
          y + gap,
          cellWidth - gap * 2,
          cellHeight - gap * 2,
        )
      }
      ctx.globalAlpha = alpha
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
        let gold = 0
        let accent = 0
        for (let sy = 0; sy < SUPERSAMPLE; sy++) {
          let offset = ((fieldY + sy) * fieldWidth + fieldX) * 4
          for (let sx = 0; sx < SUPERSAMPLE; sx++) {
            ink += pixels[offset]
            gold += pixels[offset + 1]
            accent += pixels[offset + 2]
            offset += 4
          }
        }
        const keep = shade ? shade[row * cols + col] : 1
        const mark = marks?.get(row * cols + col)
        const brightest = Math.max(ink, accent, gold)
        let tone = brightest === ink ? 0 : brightest === accent ? 1 : 2
        let intensity = (brightest / samples + light) * keep
        if (mark !== undefined) {
          tone = mark.tone
          intensity = Math.max(intensity, mark.strength * keep)
        }
        if (intensity < MIN_INTENSITY) continue

        const step = Math.min(
          RAMP.length - 1,
          Math.floor(intensity ** RAMP_GAMMA * RAMP.length),
        )
        const choices = RAMP_GLYPHS[step]
        const glyph =
          mark !== undefined
            ? mark.glyph
            : choices[cellHash(col, row) % choices.length]
        // The character keeps the weight the brightness picked; only its ink is lifted.
        const alpha =
          Math.min(1, 0.25 + Math.min(1, intensity) ** lift * 1.1) * keep
        drawCell(col, row, tone, glyph, alpha, intensity * tileAlpha)
      }
    }
    ctx.globalAlpha = 1
  }

  /**
   * Works out, per cell, how much brightness the water keeps under the page text: the least right
   * under and around each text rect, easing back to all of it a little further out, so the water
   * goes quiet under the words without a hard edge. Undefined when there is no text.
   */
  private shadeUnderText(rects: readonly Rect[]): Float32Array | undefined {
    if (rects.length === 0) return undefined
    const { cols, rows, cellWidth, cellHeight, textShade: shade } = this
    shade.fill(1)
    const reach = TEXT_MARGIN + TEXT_FEATHER
    for (const rect of rects) {
      const left = rect.x
      const right = rect.x + rect.width
      const top = rect.y
      const bottom = rect.y + rect.height
      const firstCol = Math.max(0, Math.floor((left - reach) / cellWidth))
      const lastCol = Math.min(
        cols - 1,
        Math.floor((right + reach) / cellWidth),
      )
      const firstRow = Math.max(0, Math.floor((top - reach) / cellHeight))
      const lastRow = Math.min(
        rows - 1,
        Math.floor((bottom + reach) / cellHeight),
      )
      for (let row = firstRow; row <= lastRow; row++) {
        const centreY = (row + 0.5) * cellHeight
        const dy = Math.max(top - centreY, 0, centreY - bottom)
        for (let col = firstCol; col <= lastCol; col++) {
          const centreX = (col + 0.5) * cellWidth
          const dx = Math.max(left - centreX, 0, centreX - right)
          const distance = Math.hypot(dx, dy)
          if (distance >= reach) continue
          const t = Math.max(0, (distance - TEXT_MARGIN) / TEXT_FEATHER)
          const keep =
            UNDER_TEXT_BRIGHTNESS +
            (1 - UNDER_TEXT_BRIGHTNESS) * t * t * (3 - 2 * t)
          const index = row * cols + col
          if (keep < shade[index]) shade[index] = keep
        }
      }
    }
    return shade
  }

  /**
   * Keeps what is painted next inside the tank of `view`, when it has one. A cell the edge runs
   * through is drawn whole, so inside the canvas the bodies are kept a cell clear of the edge,
   * and no character crosses it.
   */
  private clipToTank(field: CanvasRenderingContext2D, view: View) {
    const { clip } = view
    if (!clip) return
    const left = clip.x > 0 ? clip.x + this.cellWidth : clip.x
    const top = clip.y > 0 ? clip.y + this.cellHeight : clip.y
    const right = clip.x + clip.width
    const bottom = clip.y + clip.height
    field.setTransform(
      SUPERSAMPLE / this.cellWidth,
      0,
      0,
      SUPERSAMPLE / this.cellHeight,
      0,
      0,
    )
    field.beginPath()
    field.rect(
      left,
      top,
      (right < this.width ? right - this.cellWidth : right) - left,
      (bottom < this.height ? bottom - this.cellHeight : bottom) - top,
    )
    field.clip()
  }

  /**
   * Sets the field's transform for one creature at (x, y) in its water: the camera first, then
   * screen pixels to cells. Its body is scaled about its own place, so only its size changes, not
   * where it swims.
   */
  private placeBody(
    field: CanvasRenderingContext2D,
    view: View,
    { x, y }: { x: number; y: number },
  ) {
    const toCellsX = SUPERSAMPLE / this.cellWidth
    const toCellsY = SUPERSAMPLE / this.cellHeight
    const body = view.bodyScale ?? 1
    const zoom = view.zoom * body
    field.setTransform(
      toCellsX * zoom,
      0,
      0,
      toCellsY * zoom,
      toCellsX * (view.offsetX + x * view.zoom * (1 - body)),
      toCellsY * (view.offsetY + y * view.zoom * (1 - body)),
    )
  }

  /**
   * Paints one goldfish seen from above: a soft body in the ink channel with its patches in the
   * gold channel, and a forked tail fin and two side fins, both translucent so they come out in
   * faint characters.
   */
  private paintFish(
    field: CanvasRenderingContext2D,
    fish: Goldfish,
    view: View,
  ) {
    const fade = creatureFade(fish, view)
    if (fade <= 0) return
    const { spine, halfWidth, length, beat } = fish
    const last = spine.length - 1
    const left: Force[] = []
    const right: Force[] = []
    const normals: Force[] = []
    for (let i = 0; i <= last; i++) {
      const ahead = spine[Math.max(0, i - 1)]
      const behind = spine[Math.min(last, i + 1)]
      const tx = behind.x - ahead.x
      const ty = behind.y - ahead.y
      const size = Math.hypot(tx, ty) || 1
      const normal = { x: -ty / size, y: tx / size }
      const width = halfWidth * bodyProfile(i / last)
      normals.push(normal)
      left.push({
        x: spine[i].x + normal.x * width,
        y: spine[i].y + normal.y * width,
      })
      right.push({
        x: spine[i].x - normal.x * width,
        y: spine[i].y - normal.y * width,
      })
    }
    const traceBody = () => {
      field.beginPath()
      field.moveTo(left[0].x, left[0].y)
      for (const point of left) field.lineTo(point.x, point.y)
      for (let i = last; i >= 0; i--) field.lineTo(right[i].x, right[i].y)
      field.closePath()
    }
    /** The spine point and its normal at `along` (0 at the nose, 1 at the tail's root). */
    const at = (along: number) => {
      const index = Math.min(last - 1, Math.floor(along * last))
      const t = along * last - index
      const a = spine[index]
      const b = spine[index + 1]
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        normal: normals[index],
        width: halfWidth * bodyProfile(along),
      }
    }

    field.save()
    field.globalCompositeOperation = 'lighter'

    // Side fins, just behind the head, swept back and rowing with the tail beat.
    const fin = at(0.24)
    const tailward = Math.atan2(
      spine[last].y - spine[0].y,
      spine[last].x - spine[0].x,
    )
    for (const side of [1, -1]) {
      const outward = Math.atan2(fin.normal.y * side, fin.normal.x * side)
      const sweep = Math.atan2(
        Math.sin(tailward - outward),
        Math.cos(tailward - outward),
      )
      field.save()
      field.translate(
        fin.x + fin.normal.x * fin.width * side * 0.9,
        fin.y + fin.normal.y * fin.width * side * 0.9,
      )
      field.rotate(outward + sweep * 0.35 + Math.sin(beat + side) * 0.25)
      field.fillStyle = `rgba(255, 0, 0, ${0.32 * fade})`
      field.beginPath()
      field.ellipse(length * 0.08, 0, length * 0.11, length * 0.04, 0, 0, TAU)
      field.fill()
      field.restore()
    }

    // The forked tail fin, swinging with the beat.
    const root = spine[last]
    const before = spine[last - 1]
    const away = Math.atan2(root.y - before.y, root.x - before.x)
    const swing = away + Math.sin(beat - 1.2) * 0.35
    const tail = length * 0.5
    const lobe = (spread: number) => ({
      x: root.x + Math.cos(swing + spread) * tail,
      y: root.y + Math.sin(swing + spread) * tail,
    })
    const upper = lobe(0.5)
    const lower = lobe(-0.5)
    const notch = {
      x: root.x + Math.cos(swing) * tail * 0.45,
      y: root.y + Math.sin(swing) * tail * 0.45,
    }
    field.beginPath()
    field.moveTo(root.x, root.y)
    field.quadraticCurveTo(
      (root.x + upper.x) / 2 + Math.cos(swing + 1.2) * tail * 0.12,
      (root.y + upper.y) / 2 + Math.sin(swing + 1.2) * tail * 0.12,
      upper.x,
      upper.y,
    )
    field.lineTo(notch.x, notch.y)
    field.lineTo(lower.x, lower.y)
    field.quadraticCurveTo(
      (root.x + lower.x) / 2 + Math.cos(swing - 1.2) * tail * 0.12,
      (root.y + lower.y) / 2 + Math.sin(swing - 1.2) * tail * 0.12,
      root.x,
      root.y,
    )
    // Mostly gold with a little ink, and lighter than the body: a see-through orange fin.
    field.fillStyle = `rgba(90, 170, 0, ${0.7 * fade})`
    field.fill()

    // The body, then its patches, kept inside it.
    traceBody()
    field.fillStyle = `rgba(255, 0, 0, ${0.82 * fade})`
    field.fill()
    traceBody()
    field.clip()
    field.fillStyle = `rgba(0, 255, 0, ${0.95 * fade})`
    for (const patch of fish.patches) {
      const spot = at(patch.along)
      field.beginPath()
      field.arc(
        spot.x + spot.normal.x * spot.width * patch.across,
        spot.y + spot.normal.y * spot.width * patch.across,
        Math.max(1, spot.width * patch.size),
        0,
        TAU,
      )
      field.fill()
    }
    field.restore()
  }

  /**
   * Paints one manta ray seen from above: a broad body, brightest along its middle and fading
   * toward the thin wing tips, pale shoulder marks in the accent channel, the horns in front of
   * the mouth, and a long tail thinning to a point.
   */
  private paintRay(field: CanvasRenderingContext2D, ray: Manta, view: View) {
    const fade = creatureFade(ray, view)
    if (fade <= 0) return
    field.save()
    field.globalCompositeOperation = 'lighter'
    field.lineCap = 'round'

    const tail = ray.tail()
    field.strokeStyle = `rgba(255, 0, 0, ${0.55 * fade})`
    for (let i = 1; i < tail.length; i++) {
      field.lineWidth = ray.span * (0.004 + 0.02 * (1 - i / tail.length))
      field.beginPath()
      field.moveTo(tail[i - 1].x, tail[i - 1].y)
      field.lineTo(tail[i].x, tail[i].y)
      field.stroke()
    }

    field.fillStyle = `rgba(255, 0, 0, ${0.8 * fade})`
    for (const horn of ray.horns()) {
      field.beginPath()
      field.ellipse(horn.x, horn.y, horn.long, horn.wide, horn.angle, 0, TAU)
      field.fill()
    }

    const outline = ray.outline()
    const traceBody = () => {
      field.beginPath()
      for (const point of outline) field.lineTo(point.x, point.y)
      field.closePath()
    }
    const glow = field.createRadialGradient(
      ray.x,
      ray.y,
      0,
      ray.x,
      ray.y,
      ray.span * 0.5,
    )
    glow.addColorStop(0, `rgba(255, 0, 0, ${0.9 * fade})`)
    glow.addColorStop(0.5, `rgba(255, 0, 0, ${0.7 * fade})`)
    glow.addColorStop(1, `rgba(255, 0, 0, ${0.3 * fade})`)
    traceBody()
    field.fillStyle = glow
    field.fill()
    traceBody()
    field.clip()
    field.fillStyle = `rgba(0, 0, 255, ${0.95 * fade})`
    for (const mark of ray.shoulders()) {
      field.beginPath()
      field.ellipse(mark.x, mark.y, mark.long, mark.wide, mark.angle, 0, TAU)
      field.fill()
    }
    field.restore()
  }

  /**
   * Paints a shark seen from above: its side fins and narrow tail, then its long body in the ink
   * channel, and a hammerhead's hammer across the snout. A whale shark's spots are marked in
   * afterwards.
   */
  private paintShark(
    field: CanvasRenderingContext2D,
    shark: Shark,
    view: View,
  ) {
    const fade = creatureFade(shark, view)
    if (fade <= 0) return
    const last = shark.spine.length - 1
    const left: Force[] = []
    const right: Force[] = []
    for (let i = 0; i <= last; i++) {
      const point = shark.at(i / last)
      left.push({
        x: point.x + point.normalX * point.width,
        y: point.y + point.normalY * point.width,
      })
      right.push({
        x: point.x - point.normalX * point.width,
        y: point.y - point.normalY * point.width,
      })
    }
    field.save()
    field.globalCompositeOperation = 'lighter'

    // Side fins: swept back from just behind the head.
    const { fins } = shark.kind
    field.fillStyle = `rgba(255, 0, 0, ${0.55 * fade})`
    for (const side of [1, -1]) {
      const front = shark.at(fins.front)
      const back = shark.at(fins.back)
      const tip = shark.at(fins.tip)
      const reach = shark.halfWidth * fins.reach * side
      field.beginPath()
      field.moveTo(
        front.x + front.normalX * front.width * side,
        front.y + front.normalY * front.width * side,
      )
      field.lineTo(tip.x + tip.normalX * reach, tip.y + tip.normalY * reach)
      field.lineTo(
        back.x + back.normalX * back.width * side,
        back.y + back.normalY * back.width * side,
      )
      field.closePath()
      field.fill()
    }

    // The tail: a narrow blade sweeping from side to side.
    const root = shark.spine[last]
    const before = shark.spine[last - 1]
    const away =
      Math.atan2(root.y - before.y, root.x - before.x) +
      Math.sin(shark.sweep - 1.2) * 0.4
    const tail = shark.tailLength
    field.beginPath()
    field.moveTo(left[last].x, left[last].y)
    field.lineTo(
      root.x + Math.cos(away + 0.18) * tail,
      root.y + Math.sin(away + 0.18) * tail,
    )
    field.lineTo(
      root.x + Math.cos(away) * tail * 0.7,
      root.y + Math.sin(away) * tail * 0.7,
    )
    field.lineTo(
      root.x + Math.cos(away - 0.18) * tail * 0.8,
      root.y + Math.sin(away - 0.18) * tail * 0.8,
    )
    field.lineTo(right[last].x, right[last].y)
    field.closePath()
    field.fillStyle = `rgba(255, 0, 0, ${0.6 * fade})`
    field.fill()

    // The body.
    field.beginPath()
    for (const point of left) field.lineTo(point.x, point.y)
    for (let i = last; i >= 0; i--) field.lineTo(right[i].x, right[i].y)
    field.closePath()
    field.fillStyle = `rgba(255, 0, 0, ${0.82 * fade})`
    field.fill()
    // A hammerhead's hammer: a bar across the snout, never thinner than a row of characters, so
    // the T it makes with the body reads even on a small shark.
    const hammer = shark.hammerHead()
    if (hammer) {
      const rowInWater = this.cellHeight / (view.zoom * (view.bodyScale ?? 1))
      const reach = hammer.long - hammer.wide
      const cos = Math.cos(hammer.angle) * reach
      const sin = Math.sin(hammer.angle) * reach
      field.strokeStyle = `rgba(255, 0, 0, ${0.95 * fade})`
      field.lineWidth = Math.max(hammer.wide * 2, rowInWater * 1.1)
      field.lineCap = 'round'
      field.beginPath()
      field.moveTo(hammer.x + cos, hammer.y + sin)
      field.lineTo(hammer.x - cos, hammer.y - sin)
      field.stroke()
    }
    field.restore()
  }

  /**
   * Paints a dolphin seen from above: its side fins and flat flukes as strokes at least a row of
   * characters thick, then its smooth body, a little brighter as it rolls its pale belly up.
   */
  private paintDolphin(
    field: CanvasRenderingContext2D,
    dolphin: Dolphin,
    view: View,
  ) {
    const fade = creatureFade(dolphin, view)
    if (fade <= 0) return
    const row = this.cellHeight / (view.zoom * (view.bodyScale ?? 1))
    const last = dolphin.spine.length - 1
    const left: Force[] = []
    const right: Force[] = []
    for (let i = 0; i <= last; i++) {
      const point = dolphin.at(i / last)
      left.push({
        x: point.x + point.normalX * point.width,
        y: point.y + point.normalY * point.width,
      })
      right.push({
        x: point.x - point.normalX * point.width,
        y: point.y - point.normalY * point.width,
      })
    }
    field.save()
    field.globalCompositeOperation = 'lighter'
    field.lineCap = 'round'
    field.lineJoin = 'round'
    field.strokeStyle = `rgba(255, 0, 0, ${0.7 * fade})`

    // Side fins, swept back from behind the head.
    const fin = dolphin.at(0.24)
    const tipAt = dolphin.at(0.34)
    const reach = dolphin.halfWidth * dolphin.finReach()
    field.lineWidth = Math.max(dolphin.length * 0.03, row * 0.9)
    for (const side of [1, -1]) {
      field.beginPath()
      field.moveTo(
        fin.x + fin.normalX * fin.width * side,
        fin.y + fin.normalY * fin.width * side,
      )
      field.lineTo(
        tipAt.x + tipAt.normalX * (tipAt.width + reach) * side,
        tipAt.y + tipAt.normalY * (tipAt.width + reach) * side,
      )
      field.stroke()
    }

    // The flukes: a crescent across the end of the tail.
    const flukes = dolphin.flukes()
    const root = dolphin.spine[last]
    field.lineWidth = Math.max(dolphin.length * 0.05, row)
    field.beginPath()
    field.moveTo(flukes.left.x, flukes.left.y)
    field.quadraticCurveTo(root.x, root.y, flukes.notch.x, flukes.notch.y)
    field.quadraticCurveTo(root.x, root.y, flukes.right.x, flukes.right.y)
    field.stroke()
    field.beginPath()
    field.moveTo(root.x, root.y)
    field.lineTo(flukes.notch.x, flukes.notch.y)
    field.stroke()

    // The body.
    field.beginPath()
    for (const point of left) field.lineTo(point.x, point.y)
    for (let i = last; i >= 0; i--) field.lineTo(right[i].x, right[i].y)
    field.closePath()
    field.fillStyle = `rgba(255, 0, 0, ${(0.78 + 0.2 * dolphin.belly()) * fade})`
    field.fill()
    field.restore()
  }

  /**
   * Paints one sea turtle seen from above: its flippers and head in the ink channel, under a
   * shell in the gold channel whose plates are a little brighter, so its pattern shows.
   */
  private paintTurtle(
    field: CanvasRenderingContext2D,
    turtle: SeaTurtle,
    view: View,
  ) {
    const fade = creatureFade(turtle, view)
    if (fade <= 0) return
    const oval = (part: Part) => {
      field.beginPath()
      field.ellipse(part.x, part.y, part.long, part.wide, part.angle, 0, TAU)
      field.fill()
    }
    field.save()
    field.globalCompositeOperation = 'lighter'
    field.fillStyle = `rgba(255, 0, 0, ${0.62 * fade})`
    for (const flipper of turtle.flippers()) oval(flipper)
    oval(turtle.head())
    field.fillStyle = `rgba(0, 255, 0, ${0.72 * fade})`
    oval(turtle.shell())
    field.fillStyle = `rgba(0, 255, 0, ${0.25 * fade})`
    for (const plate of turtle.plates()) oval(plate)
    field.restore()
  }

  /**
   * The cells given characters of their own: the eyes of the goldfish, rays and turtles, as 'o',
   * drawn whatever the bodies around it make of the cell. Undefined without other tanks.
   */
  private markCells(
    sides: SideTanks | undefined,
  ): Map<number, Mark> | undefined {
    if (!sides) return undefined
    const marks = new Map<number, Mark>()
    /** The cell at (x, y) on screen, if it lies inside the tank of `view` clear of its edge. */
    const cellAt = (view: View, x: number, y: number) => {
      const { clip } = view
      if (
        clip &&
        (x < clip.x + this.cellWidth ||
          y < clip.y + this.cellHeight ||
          x > clip.x + clip.width - this.cellWidth ||
          y > clip.y + clip.height - this.cellHeight)
      ) {
        return undefined
      }
      const col = Math.floor(x / this.cellWidth)
      const row = Math.floor(y / this.cellHeight)
      if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
        return undefined
      }
      return { col, row }
    }
    /** Marks the eyes of one creature at `anchor`, drawn through `view` at `fade`. */
    const markEyes = (
      view: View,
      anchor: { x: number; y: number },
      eyes: readonly { x: number; y: number }[],
      fade: number,
    ) => {
      if (fade < 0.2) return
      const body = view.bodyScale ?? 1
      for (const eye of eyes) {
        // Into screen space the way the body is drawn: scaled about its own place.
        const cell = cellAt(
          view,
          view.offsetX +
            anchor.x * view.zoom +
            (eye.x - anchor.x) * view.zoom * body,
          view.offsetY +
            anchor.y * view.zoom +
            (eye.y - anchor.y) * view.zoom * body,
        )
        if (cell) {
          marks.set(cell.row * this.cols + cell.col, {
            glyph: EYE_GLYPH,
            strength: 0.85 * fade,
            tone: 0,
          })
        }
      }
    }
    if (sides.school) {
      const { view } = sides.school
      for (const fish of sides.school.fish) {
        markEyes(view, fish, fish.eyes(), creatureFade(fish, view))
      }
    }
    if (sides.rays) {
      const { view } = sides.rays
      for (const ray of sides.rays.rays) {
        markEyes(view, ray, ray.eyes(), creatureFade(ray, view))
      }
    }
    if (sides.ocean) {
      const { view } = sides.ocean
      for (const shark of sides.ocean.sharks) {
        // The spots, as round marks in the accent colour, so they show at any size.
        const fade = creatureFade(shark, view)
        const body = view.bodyScale ?? 1
        if (fade >= 0.2) {
          for (const spot of shark.spots()) {
            const cell = cellAt(
              view,
              view.offsetX +
                shark.x * view.zoom +
                (spot.x - shark.x) * view.zoom * body,
              view.offsetY +
                shark.y * view.zoom +
                (spot.y - shark.y) * view.zoom * body,
            )
            if (cell) {
              marks.set(cell.row * this.cols + cell.col, {
                glyph: EYE_GLYPH,
                strength: 0.9 * fade,
                tone: 1,
              })
            }
          }
        }
        markEyes(view, shark, shark.eyes(), fade)
      }
      for (const creature of [...sides.ocean.turtles, ...sides.ocean.rays]) {
        markEyes(view, creature, creature.eyes(), creatureFade(creature, view))
      }
    }
    return marks
  }

  /**
   * Paints one jellyfish as light: translucent tentacles and oral arms, then a bell that is
   * brighter at the top and along its edges, with a darker opening underneath.
   */
  private paintJellyfish(
    field: CanvasRenderingContext2D,
    jellyfish: Jellyfish,
    view: View,
  ) {
    const fade = jellyfishFade(jellyfish, view)
    if (fade <= 0) return
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

  /** Adds a picture's brightness to the field, clipped to its reveal circle if it has one. */
  private paintPicture(field: CanvasRenderingContext2D, picture: PictureDraw) {
    if (picture.alpha <= 0) return
    field.save()
    field.globalCompositeOperation = 'lighter'
    field.globalAlpha = Math.min(1, picture.alpha)
    const { clip } = picture
    if (clip) {
      field.beginPath()
      // Outside the circle: the whole screen with the circle cut out of it.
      if (!clip.inside) field.rect(0, 0, this.width, this.height)
      field.arc(clip.x, clip.y, Math.max(0, clip.radius), 0, TAU)
      field.clip(clip.inside ? 'nonzero' : 'evenodd')
    }
    field.drawImage(
      picture.source,
      picture.x,
      picture.y,
      picture.width,
      picture.height,
    )
    field.restore()
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

  /** Pre-draws every character in each colour, with the glow baked in for the dark theme. */
  private buildSheet(palette: Palette) {
    const { pixelRatio, cellWidth, cellHeight } = this
    this.pad = palette.glow ? GLOW_PAD : 0
    this.spriteWidth = Math.ceil((cellWidth + this.pad * 2) * pixelRatio)
    this.spriteHeight = Math.ceil((cellHeight + this.pad * 2) * pixelRatio)

    const sheet = document.createElement('canvas')
    sheet.width = this.spriteWidth * GLYPHS.length
    sheet.height = this.spriteHeight * 3
    const g = sheet.getContext('2d')
    if (!g) return
    g.font = `${palette.weight} ${Math.round(cellHeight * 0.8 * pixelRatio)}px ${FONT_FAMILY}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (const [tone, color] of [
      [0, palette.ink],
      [1, palette.accent],
      [2, palette.gold],
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

/** The value below which `share` of `count` values (each 0 to 1) fall, from a 256-step histogram. */
function percentile(
  count: number,
  valueAt: (index: number) => number,
  share: number,
): number {
  const bins = new Uint32Array(256)
  for (let n = 0; n < count; n++) {
    bins[Math.min(255, Math.floor(valueAt(n) * 256))]++
  }
  let seen = 0
  for (let bin = 0; bin < 256; bin++) {
    seen += bins[bin]
    if (seen >= count * share) return (bin + 1) / 256
  }
  return 1
}

/** Average luminance of the outermost pixels of an image, taken as its background colour. */
function edgeLuminance(
  width: number,
  height: number,
  luminanceAt: (index: number) => number,
): number {
  let sum = 0
  let count = 0
  const add = (x: number, y: number) => {
    sum += luminanceAt((y * width + x) * 4)
    count++
  }
  for (let x = 0; x < width; x++) {
    add(x, 0)
    add(x, height - 1)
  }
  for (let y = 1; y < height - 1; y++) {
    add(0, y)
    add(width - 1, y)
  }
  return count > 0 ? sum / count : 0
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
