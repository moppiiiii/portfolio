import { AsciiRenderer } from './ascii-renderer'
import { Dolphin, FLUKE_REACH } from './dolphin'
import type { Glider } from './glider'
import { Goldfish } from './goldfish'
import type { Bounds, Lane } from './jellyfish'
import { Jellyfish, bellRadius, laneArea } from './jellyfish'
import { LineRenderer } from './line-renderer'
import { MANTA, Manta } from './manta'
import { readPalette } from './palette'
import type { JellyfishRenderer, PictureDraw, Rect, View } from './renderer'
import { IDENTITY_VIEW } from './renderer'
import type { Ripple } from './ripple'
import { RIPPLE_LIFETIME, createRipple, crestRadius } from './ripple'
import { HAMMERHEAD, Shark, WHALE_SHARK } from './shark'
import { SeaTurtle, TURTLE } from './turtle'

/** `ascii` draws with monospace characters; `line` draws thin ink lines. */
export type JellyfishVariant = 'ascii' | 'line'

/**
 * What the water is doing on the current page.
 * - `open`: the jellyfish swim in full view (the frontispiece).
 * - `behind`: they fade into the background where they are, behind text (contents, about).
 * - `away`: they swim off, leaving the water to a work's picture (a plate).
 */
export type SceneMode = 'open' | 'behind' | 'away'

/** What overlays on the canvas need after each frame. */
export type SceneFrame = {
  /** The picture now in the water, once it is loaded; undefined otherwise. */
  picture:
    | {
        src: string
        /** Where it sits, in viewport px. */
        rect: Rect
        /** Whether it has finished appearing: no longer fading in or spreading behind a ripple. */
        settled: boolean
      }
    | undefined
}

export type JellyfishSceneOptions = {
  variant: JellyfishVariant
  count: number
  /**
   * The area (viewport px) the picture should fill, keeping its proportions, read every frame so
   * the picture follows the page as it scrolls. Undefined, or no function, centres it in the water.
   */
  getPictureFrame?: () => Rect | undefined
  /** Where page text lies over the canvas (viewport px), read every frame. */
  getTextRects?: () => readonly Rect[]
  /**
   * Where the jellyfish's water appears on the canvas, such as a tank on a map, read every frame.
   * Without it the water fills the canvas.
   */
  getView?: () => View
  /**
   * Where the goldfish's water, a second tank, appears on the canvas, read every frame. Without
   * it there are no goldfish.
   */
  getSchoolView?: () => View | undefined
  /** Where the rays' water, a third tank, appears on the canvas, read every frame; no rays without it. */
  getRayView?: () => View | undefined
  /**
   * Where the big ocean tank appears on the canvas, read every frame. Without it there is no
   * ocean tank.
   */
  getOceanView?: () => View | undefined
  /** Called after every drawn frame, so overlays can follow the picture. */
  onFrame?: (frame: SceneFrame) => void
}

export type JellyfishScene = {
  setMode: (mode: SceneMode) => void
  /** What the goldfish do: in full view, or faded back behind the page over their tank. */
  setSchoolMode: (mode: SceneMode) => void
  /** The same for the rays. */
  setRayMode: (mode: SceneMode) => void
  /**
   * Shows the picture at URL `src` in the water. With `from` (screen px), a ripple spreads from
   * there and the picture condenses behind its crest, replacing the old one; without, it fades in.
   * null fades the picture away.
   */
  setPicture: (src: string | null, from?: { x: number; y: number }) => void
  /** Redraws a still frame (reduced motion) after a change the scene cannot see itself. */
  refresh: () => void
  stop: () => void
}

/** Simulation step. A fixed step keeps the strands stable on any display refresh rate. */
const STEP = 1 / 120
/** Longest frame gap simulated after a stall, such as returning to a background tab. */
const MAX_FRAME = 0.1
/**
 * Seconds simulated before the first frame, so the group appears mid-swim with tentacles already
 * trailing, rather than every jellyfish starting from rest with straight tentacles.
 */
const START_WARMUP = 2.5
/** Seconds simulated before drawing the still frame shown to reduced-motion visitors. */
const STILL_FRAME_WARMUP = 6
/** Size of the furthest jellyfish relative to the nearest. */
const FURTHEST_SCALE = 0.45
/** How many of the nearest jellyfish show when their water is seen small, where more run together. */
const SHOWN_AFAR = 3

/** How visible the jellyfish are in each mode. */
const MODE_VISIBILITY: Record<SceneMode, number> = {
  open: 1,
  behind: 0.3,
  away: 0,
}

/** Share of the water's width and height a picture may take when no frame is given for it. */
const PICTURE_SHARE = 0.72
/** Seconds for a picture to mostly fade in or out when no ripple carries it. */
const PICTURE_FADE = 0.45
/** Opacity from which a picture fading in counts as having appeared. */
const PICTURE_SETTLED = 0.9
/** How much faster than a touch the ripple carrying a page transition spreads. */
const TRANSITION_PACE = 4.5

/** Ripples alive at once. A burst of clicks drops the oldest. */
const MAX_RIPPLES = 12

// The wake: small ripples the pointer leaves behind as it moves over the water.
/** Distance the pointer travels between wake ripples, as a share of the screen's shorter side. */
const WAKE_SPACING_SHARE = 0.05
/** Least time (ms) between wake ripples, so a fast sweep does not crowd the water. */
const WAKE_INTERVAL = 80
/** After this long (ms) without a wake ripple, the pointer's next move starts a new wake. */
const WAKE_PAUSE = 1000
/** How fast a wake ripple spreads and how strongly it shows, next to the ripple of a click. */
const WAKE_PACE = 0.45
const WAKE_STRENGTH = 0.4
/**
 * Pointer speed, in shorter sides of the screen per second, at which the wake shows at full
 * strength. Slower moves leave fainter ripples, down to the given share of it.
 */
const WAKE_FULL_SPEED = 1.2
const WAKE_FAINTEST = 0.3
/** Wake ripples alive at once. A long sweep drops the oldest. */
const MAX_WAKE = 16
/**
 * Clicks on these elements belong to them, so they do not ripple the water: links, buttons and
 * form fields, plus anything marked `data-no-water`.
 */
const INTERACTIVE_ELEMENTS =
  'a, button, input, textarea, select, label, summary, [role="button"], [contenteditable], [data-no-water]'

/** Whether the event happened on a link, button or other element that handles its own clicks. */
function belongsToPage(event: Event): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest(INTERACTIVE_ELEMENTS) !== null
  )
}

/** Largest random tilt of a jellyfish at the start, either side of straight up (radians). */
const START_TILT = 0.6
/**
 * Area a jellyfish occupies at the start, in bell radii around the rim centre: the bell above and
 * the tentacles hanging below. Starting areas must not overlap.
 */
const FOOTPRINT_SIDE = 1.15
const FOOTPRINT_ABOVE = 1
const FOOTPRINT_BELOW = 2.4
/** Random spots tried for each jellyfish. The least overlapping one is kept. */
const PLACEMENT_ATTEMPTS = 60

type Footprint = { left: number; right: number; top: number; bottom: number }

function footprint(x: number, y: number, radius: number): Footprint {
  return {
    left: x - radius * FOOTPRINT_SIDE,
    right: x + radius * FOOTPRINT_SIDE,
    top: y - radius * FOOTPRINT_ABOVE,
    bottom: y + radius * FOOTPRINT_BELOW,
  }
}

/** Area shared by two footprints (px²); 0 when they do not touch. */
function overlap(a: Footprint, b: Footprint): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return width > 0 && height > 0 ? width * height : 0
}

/**
 * Creates the group at random positions in the water, each tilted at random, keeping each
 * jellyfish clear of the others' bells and tentacles where there is room.
 * The group is ordered from the furthest jellyfish to the nearest so renderers can paint in order.
 */
function spawnGroup(bounds: Bounds, count: number): Jellyfish[] {
  const placed: Footprint[] = []
  const group: Jellyfish[] = []
  const waterTop = bounds.top ?? 0
  const waterHeight = Math.max(
    1,
    bounds.height - waterTop - (bounds.bottom ?? 0),
  )

  // The jellyfish shown on the map each keep to their own part of the water, in random order.
  const lanes = Array.from({ length: SHOWN_AFAR }, (_, index) => index)
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
  }

  // Place the nearest (largest) first: big ones are the hardest to fit.
  for (let i = count - 1; i >= 0; i--) {
    const depth = count === 1 ? 1 : i / (count - 1)
    const scale = FURTHEST_SCALE + (1 - FURTHEST_SCALE) * depth
    const radius = bellRadius(bounds, scale)
    const shownAfar = i >= count - SHOWN_AFAR
    const lane: Lane | undefined = shownAfar
      ? { index: lanes[count - 1 - i], count: SHOWN_AFAR }
      : undefined
    const part = laneArea(bounds, lane)
    let x = 0
    let y = 0
    let leastOverlap = Infinity
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const candidateX =
        bounds.width *
        (part.left + (part.right - part.left) * (0.08 + Math.random() * 0.84))
      const candidateY =
        waterTop +
        waterHeight *
          (part.top + (part.bottom - part.top) * (0.1 + Math.random() * 0.65))
      const area = footprint(candidateX, candidateY, radius)
      const shared = placed.reduce(
        (sum, other) => sum + overlap(area, other),
        0,
      )
      if (shared < leastOverlap) {
        leastOverlap = shared
        x = candidateX
        y = candidateY
      }
      if (shared === 0) break
    }
    placed.push(footprint(x, y, radius))
    group[i] = new Jellyfish(bounds, {
      depth,
      // Only the middle jellyfish by depth takes the accent colour, so it reads as an accent
      // the eye finds rather than a second main colour.
      tint: i === Math.floor(count / 2) ? 1 : 0,
      shownAfar,
      lane,
      scale,
      x,
      y,
      heading: -Math.PI / 2 + (Math.random() * 2 - 1) * START_TILT,
    })
  }
  return group
}

/** Goldfish in their tank. */
const FISH_COUNT = 5
/** How many of the largest goldfish show when their tank is seen small on the map. */
const FISH_SHOWN_AFAR = 2

/**
 * Creates the goldfish at random headings, largest first. Those shown on the map each keep to
 * their own lane of the water, in random order, and start in it.
 */
function spawnSchool(bounds: Bounds): Goldfish[] {
  const lanes = Array.from({ length: FISH_SHOWN_AFAR }, (_, index) => index)
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
  }
  return Array.from({ length: FISH_COUNT }, (_, index) => {
    const shownAfar = index < FISH_SHOWN_AFAR
    const lane: Lane | undefined = shownAfar
      ? { index: lanes[index], count: FISH_SHOWN_AFAR }
      : undefined
    const part = laneArea(bounds, lane)
    return new Goldfish(bounds, {
      x:
        bounds.width *
        (part.left + (part.right - part.left) * (0.3 + Math.random() * 0.4)),
      y:
        bounds.height *
        (part.top + (part.bottom - part.top) * (0.3 + Math.random() * 0.4)),
      heading: Math.random() * Math.PI * 2,
      scale: 1 - (index / FISH_COUNT) * 0.35,
      shownAfar,
      lane,
    })
  })
}

/** Rays in their tank, of falling size. Only the largest shows on the map. */
const RAY_SCALES = [1, 0.8, 0.65]

/** Creates the rays spread across their water, largest first, heading anywhere. */
function spawnRays(bounds: Bounds): Manta[] {
  const columns = RAY_SCALES.map((_, index) => index)
  for (let i = columns.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[columns[i], columns[j]] = [columns[j], columns[i]]
  }
  return RAY_SCALES.map(
    (scale, index) =>
      new Manta(bounds, {
        x: bounds.width * (0.25 + (columns[index] / 2) * 0.5),
        y: bounds.height * (0.35 + Math.random() * 0.3),
        heading: Math.random() * Math.PI * 2,
        scale,
        shownAfar: index === 0,
      }),
  )
}

/** The big ocean tank's creatures. */
type Ocean = {
  rays: Manta[]
  turtles: SeaTurtle[]
  sharks: Shark[]
  dolphins: Dolphin[]
  /** The rays and turtle, which glide. */
  gliders: Glider[]
  /** Every creature in the tank, which all keep clear of one another. */
  obstacles: { x: number; y: number; size: number }[]
}

/**
 * The ocean tank's creatures keep their real sizes to one another, set by the whale shark: one in
 * a big aquarium tank is about 9 m long, snout to tail, a hammerhead 3.5 m (a smaller one 3 m), a
 * bottlenose dolphin 3 m (a younger one 2.6 m), a manta ray's wings span about 4.5 m (a younger
 * one's 3.5 m), and a green sea turtle's shell is about 1 m long. The whale shark's body takes
 * this share of the screen's shorter side.
 */
const WHALE_SHARK_BODY_SHARE = 0.62
const WHALE_SHARK_METRES = 9
const HAMMERHEAD_METRES = [3.5, 3]
const DOLPHIN_METRES = [3, 2.6]
const RAY_SPAN_METRES = [4.5, 3.5]
const TURTLE_SHELL_METRES = 1

/**
 * Fills the ocean tank: a whale shark, two hammerheads, two dolphins, two rays and a turtle,
 * spread about the water. On the map, only the whale shark, the larger hammerhead, dolphin and
 * ray, and the turtle show.
 */
function spawnOcean(bounds: Bounds): Ocean {
  const place = (x: number, y: number) => ({
    x: bounds.width * x,
    y: bounds.height * y,
    heading: Math.random() * Math.PI * 2,
  })
  /** One metre, as a share of the screen's shorter side. */
  const metre =
    (WHALE_SHARK_BODY_SHARE * (1 + WHALE_SHARK.tailShare)) / WHALE_SHARK_METRES
  const rays = RAY_SPAN_METRES.map(
    (span, index) =>
      new Manta(bounds, {
        ...place(index === 0 ? 0.3 : 0.7, index === 0 ? 0.35 : 0.65),
        scale: (span * metre) / MANTA.sizeShare,
        shownAfar: index === 0,
      }),
  )
  const turtles = [
    new SeaTurtle(bounds, {
      ...place(0.7, 0.3),
      scale: (TURTLE_SHELL_METRES * metre) / TURTLE.sizeShare,
      shownAfar: true,
    }),
  ]
  const sharks = [
    new Shark(bounds, WHALE_SHARK, {
      ...place(0.55, 0.5),
      lengthShare: WHALE_SHARK_BODY_SHARE,
      shownAfar: true,
    }),
    ...HAMMERHEAD_METRES.map(
      (metres, index) =>
        new Shark(bounds, HAMMERHEAD, {
          ...place(index === 0 ? 0.25 : 0.8, index === 0 ? 0.75 : 0.25),
          lengthShare: (metres * metre) / (1 + HAMMERHEAD.tailShare),
          shownAfar: index === 0,
        }),
    ),
  ]
  const dolphins = DOLPHIN_METRES.map(
    (metres, index) =>
      new Dolphin(bounds, {
        ...place(index === 0 ? 0.4 : 0.6, index === 0 ? 0.2 : 0.8),
        lengthShare: (metres * metre) / (1 + FLUKE_REACH),
        // Opposite sides of the pointer when they circle it.
        orbitPhase: index * Math.PI,
        shownAfar: index === 0,
      }),
  )
  const gliders = [...rays, ...turtles]
  return {
    rays,
    turtles,
    sharks,
    dolphins,
    gliders,
    obstacles: [...gliders, ...sharks, ...dolphins],
  }
}

/** A picture in the water and how far it has faded in or been revealed. */
type PictureLayer = {
  src: string
  image: HTMLImageElement
  /** Current opacity: easing towards 1 while shown, towards 0 on its way out. */
  alpha: number
  /** While set, the picture shows only inside this ripple's crest. */
  revealedBy?: Ripple
  /** While set, the picture shows only outside this ripple's crest (the next one covers it). */
  coveredBy?: Ripple
  /**
   * Where it was last placed, in canvas px. A picture on its way out stays where it was, even when
   * the page that framed it has gone.
   */
  rect?: Rect
}

/** Images by URL, loaded once and kept for every plate visited. */
const images = new Map<string, HTMLImageElement>()

function loadImage(src: string): HTMLImageElement {
  let image = images.get(src)
  if (!image) {
    image = new Image()
    image.decoding = 'async'
    image.src = src
    images.set(src, image)
  }
  return image
}

function isLoaded(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0
}

/**
 * The point in the water drawn through `through` (a tank's view) under a point on the canvas, or
 * undefined when it lies outside that water (such as the floor around the tank).
 */
function toWater(
  at: { x: number; y: number },
  through: View | undefined,
): { x: number; y: number } | undefined {
  if (!through) return undefined
  const { clip } = through
  if (
    clip &&
    (at.x < clip.x ||
      at.y < clip.y ||
      at.x > clip.x + clip.width ||
      at.y > clip.y + clip.height)
  ) {
    return undefined
  }
  return {
    x: (at.x - through.offsetX) / through.zoom,
    y: (at.y - through.offsetY) / through.zoom,
  }
}

/** Starts the jellyfish animation on `canvas`. */
export function startJellyfishScene(
  canvas: HTMLCanvasElement,
  options: JellyfishSceneOptions,
): JellyfishScene {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      setMode: () => {},
      setSchoolMode: () => {},
      setRayMode: () => {},
      setPicture: () => {},
      refresh: () => {},
      stop: () => {},
    }
  }

  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const renderer: JellyfishRenderer =
    options.variant === 'ascii' ? new AsciiRenderer() : new LineRenderer()
  renderer.setPalette(readPalette(canvas))

  let group: Jellyfish[] = []
  let ripples: Ripple[] = []
  let wake: Ripple[] = []
  /** Where and when (ms) the last wake ripple was left. */
  let wakeFrom: { x: number; y: number; time: number } | undefined
  let frame = 0
  let lastTime = 0
  let pending = 0
  let width = 0
  let height = 0
  let mode: SceneMode = 'open'
  let school: Goldfish[] = []
  let schoolMode: SceneMode = 'open'
  let rays: Manta[] = []
  let rayMode: SceneMode = 'open'
  let ocean: Ocean | undefined
  let picture: PictureLayer | null = null
  let leaving: PictureLayer[] = []

  const draws: PictureDraw[] = []

  const bounds = (): Bounds => ({ width, height })
  const shortSide = () => Math.max(1, Math.min(width, height))

  /** Where the canvas sits in the viewport, to turn page positions into canvas positions. */
  let origin = { x: 0, y: 0 }
  /** The views of the last frame drawn, to turn pointer positions into each tank's water. */
  let view: View = IDENTITY_VIEW
  let schoolView: View | undefined
  let rayView: View | undefined
  let oceanView: View | undefined

  /**
   * Places the current picture: as large as fits in the frame the page gives for it, or in the
   * middle of the water, keeping its proportions.
   */
  const placePicture = () => {
    if (!picture || !isLoaded(picture.image)) return
    const given = options.getPictureFrame?.()
    const area: Rect = given
      ? {
          x: given.x - origin.x,
          y: given.y - origin.y,
          width: given.width,
          height: given.height,
        }
      : {
          x: (width * (1 - PICTURE_SHARE)) / 2,
          y: (height * (1 - PICTURE_SHARE)) / 2,
          width: width * PICTURE_SHARE,
          height: height * PICTURE_SHARE,
        }
    const { naturalWidth, naturalHeight } = picture.image
    const fit = Math.max(
      0,
      Math.min(area.width / naturalWidth, area.height / naturalHeight),
    )
    const pictureWidth = naturalWidth * fit
    const pictureHeight = naturalHeight * fit
    picture.rect = {
      x: area.x + (area.width - pictureWidth) / 2,
      y: area.y + (area.height - pictureHeight) / 2,
      width: pictureWidth,
      height: pictureHeight,
    }
  }

  /** Whether a ripple's crest has passed every corner of the rect. */
  const crestHasCovered = (ripple: Ripple, rect: Rect) => {
    const radius = crestRadius(ripple, shortSide())
    const corners = [
      [rect.x, rect.y],
      [rect.x + rect.width, rect.y],
      [rect.x, rect.y + rect.height],
      [rect.x + rect.width, rect.y + rect.height],
    ] as const
    return corners.every(
      ([x, y]) => Math.hypot(x - ripple.x, y - ripple.y) < radius,
    )
  }

  const easePictures = (dt: number) => {
    const fade = 1 - Math.exp(-dt / PICTURE_FADE)
    if (picture) {
      picture.alpha += (1 - picture.alpha) * fade
      const { revealedBy, rect } = picture
      if (revealedBy && rect && crestHasCovered(revealedBy, rect)) {
        picture.revealedBy = undefined
      }
    }
    for (const layer of leaving) {
      if (!layer.coveredBy) layer.alpha += (0 - layer.alpha) * fade
    }
    leaving = leaving.filter((layer) => {
      if (layer.coveredBy) {
        return (
          layer.rect !== undefined &&
          !crestHasCovered(layer.coveredBy, layer.rect)
        )
      }
      return layer.alpha > 0.01
    })
  }

  const advance = (steps: number) => {
    for (let n = 0; n < steps; n++) {
      for (const jellyfish of group) jellyfish.step(STEP, group)
      for (const fish of school) fish.step(STEP, school)
      for (const ray of rays) ray.step(STEP, rays)
      if (ocean) {
        for (const glider of ocean.gliders) glider.step(STEP, ocean.obstacles)
        for (const shark of ocean.sharks) shark.step(STEP, ocean.obstacles)
        for (const dolphin of ocean.dolphins) {
          dolphin.step(STEP, ocean.obstacles)
        }
      }
      for (const ripple of ripples) ripple.age += STEP
      for (const ripple of wake) ripple.age += STEP
      easePictures(STEP)
    }
    if (wake.length > 0) {
      wake = wake.filter((ripple) => ripple.age < RIPPLE_LIFETIME)
    }
    // Transition ripples stay while a picture still follows their crest.
    if (ripples.length > 0) {
      ripples = ripples.filter(
        (ripple) =>
          ripple.age < RIPPLE_LIFETIME ||
          picture?.revealedBy === ripple ||
          leaving.some((layer) => layer.coveredBy === ripple),
      )
    }
  }

  /** The draw list for the pictures in the water this frame. */
  const pictureDraws = () => {
    draws.length = 0
    for (const layer of [...leaving, ...(picture ? [picture] : [])]) {
      const { rect } = layer
      if (!rect || layer.alpha <= 0.01) continue
      const ripple = layer.revealedBy ?? layer.coveredBy
      draws.push({
        source: renderer.preparePicture(layer.image),
        ...rect,
        alpha: layer.alpha,
        clip: ripple
          ? {
              x: ripple.x,
              y: ripple.y,
              radius: crestRadius(ripple, shortSide()),
              inside: layer.revealedBy !== undefined,
            }
          : undefined,
      })
    }
    return draws
  }

  const textRects: Rect[] = []
  /** Where page text lies over the canvas this frame, in canvas px. */
  const readTextRects = () => {
    textRects.length = 0
    for (const rect of options.getTextRects?.() ?? []) {
      textRects.push({
        x: rect.x - origin.x,
        y: rect.y - origin.y,
        width: rect.width,
        height: rect.height,
      })
    }
    return textRects
  }

  const render = () => {
    if (group.length === 0) return
    const box = canvas.getBoundingClientRect()
    origin = { x: box.left, y: box.top }
    placePicture()
    view = options.getView?.() ?? IDENTITY_VIEW
    schoolView = options.getSchoolView?.()
    rayView = options.getRayView?.()
    oceanView = options.getOceanView?.()
    renderer.render(
      ctx,
      group,
      wake.length > 0 ? ripples.concat(wake) : ripples,
      view,
      pictureDraws(),
      readTextRects(),
      {
        school: schoolView && { fish: school, view: schoolView },
        rays: rayView && { rays, view: rayView },
        ocean: ocean &&
          oceanView && {
            view: oceanView,
            rays: ocean.rays,
            turtles: ocean.turtles,
            sharks: ocean.sharks,
            dolphins: ocean.dolphins,
          },
      },
    )
    const rect = picture?.rect
    options.onFrame?.({
      picture:
        picture && rect
          ? {
              src: picture.src,
              rect: {
                x: rect.x + origin.x,
                y: rect.y + origin.y,
                width: rect.width,
                height: rect.height,
              },
              settled: !picture.revealedBy && picture.alpha >= PICTURE_SETTLED,
            }
          : undefined,
    })
  }

  const tick = (now: number) => {
    pending += Math.min((now - lastTime) / 1000, MAX_FRAME)
    lastTime = now
    const steps = Math.floor(pending / STEP)
    pending -= steps * STEP
    advance(steps)
    render()
    frame = requestAnimationFrame(tick)
  }

  const play = () => {
    cancelAnimationFrame(frame)
    if (reducedMotion.matches) {
      render()
      return
    }
    lastTime = performance.now()
    frame = requestAnimationFrame(tick)
  }

  /** A still frame is not redrawn by the animation loop, so redraw it after changes. */
  const redrawIfStill = () => {
    if (reducedMotion.matches) render()
  }

  const applyMode = (immediately: boolean) => {
    for (const jellyfish of group) {
      jellyfish.setVisibility(MODE_VISIBILITY[mode], immediately)
    }
    for (const fish of school) {
      fish.setVisibility(MODE_VISIBILITY[schoolMode], immediately)
    }
    for (const ray of rays) {
      ray.setVisibility(MODE_VISIBILITY[rayMode], immediately)
    }
  }

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(rect.width * pixelRatio)
    canvas.height = Math.round(rect.height * pixelRatio)
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    renderer.resize(rect.width, rect.height, pixelRatio)
    width = rect.width
    height = rect.height

    if (group.length > 0) {
      for (const jellyfish of group) jellyfish.setBounds(bounds())
      for (const fish of school) fish.setBounds(bounds())
      for (const ray of rays) ray.setBounds(bounds())
      if (ocean) {
        for (const glider of ocean.gliders) glider.setBounds(bounds())
        for (const shark of ocean.sharks) shark.setBounds(bounds())
        for (const dolphin of ocean.dolphins) dolphin.setBounds(bounds())
      }
    } else {
      group = spawnGroup(bounds(), options.count)
      if (options.getSchoolView) school = spawnSchool(bounds())
      if (options.getRayView) rays = spawnRays(bounds())
      if (options.getOceanView) ocean = spawnOcean(bounds())
      applyMode(true)
      const warmup = reducedMotion.matches ? STILL_FRAME_WARMUP : START_WARMUP
      advance(Math.round(warmup / STEP))
      play()
    }
    render()
  }

  /** Re-reads the colours after the theme changes. */
  const onColorSchemeChange = () => {
    renderer.setPalette(readPalette(canvas))
    render()
  }

  /** Canvas coordinates of a pointer or touch, or undefined outside the canvas. */
  const toCanvas = (point: { clientX: number; clientY: number }) => {
    const rect = canvas.getBoundingClientRect()
    const x = point.clientX - rect.left
    const y = point.clientY - rect.top
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return undefined
    return { x, y }
  }

  const addRipple = (ripple: Ripple) => {
    ripples.push(ripple)
    if (ripples.length > MAX_RIPPLES) ripples.shift()
  }

  /** Pushes the jellyfish away from a point in their water. */
  const disturbAt = (x: number, y: number) => {
    for (const jellyfish of group) jellyfish.disturb(x, y)
  }

  /** A click or tap on the water sends out a ripple and startles nearby jellyfish. */
  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || reducedMotion.matches) return
    if (belongsToPage(event)) return
    const at = toCanvas(event)
    if (!at) return
    addRipple(createRipple(at.x, at.y))
    const water = toWater(at, view)
    if (water) disturbAt(water.x, water.y)
    const pond = toWater(at, schoolView)
    if (pond) for (const fish of school) fish.disturb(pond.x, pond.y)
    const sea = toWater(at, rayView)
    if (sea) for (const ray of rays) ray.disturb(sea.x, sea.y)
    const deep = ocean && toWater(at, oceanView)
    if (ocean && deep) {
      for (const glider of ocean.gliders) glider.disturb(deep.x, deep.y)
      for (const shark of ocean.sharks) shark.disturb(deep.x, deep.y)
      for (const dolphin of ocean.dolphins) dolphin.disturb(deep.x, deep.y)
    }
  }

  /**
   * The pointer or a finger moving over the water leaves small ripples behind it, fainter the
   * slower it moves, and jellyfish close by move out of its way.
   */
  const leaveWake = (point: { clientX: number; clientY: number }) => {
    if (reducedMotion.matches) return
    const at = toCanvas(point)
    if (!at) return
    const now = performance.now()
    const elapsed = wakeFrom ? now - wakeFrom.time : Infinity
    if (!wakeFrom || elapsed > WAKE_PAUSE) {
      wakeFrom = { ...at, time: now }
      return
    }
    const travelled = Math.hypot(at.x - wakeFrom.x, at.y - wakeFrom.y)
    if (
      travelled < shortSide() * WAKE_SPACING_SHARE ||
      elapsed < WAKE_INTERVAL
    ) {
      return
    }
    const speed = travelled / shortSide() / (elapsed / 1000)
    const strength =
      WAKE_STRENGTH *
      Math.min(1, Math.max(WAKE_FAINTEST, speed / WAKE_FULL_SPEED))
    wake.push(createRipple(at.x, at.y, WAKE_PACE, strength))
    if (wake.length > MAX_WAKE) wake.shift()
    const water = toWater(at, view)
    if (water) for (const jellyfish of group) jellyfish.avoid(water.x, water.y)
    const pond = toWater(at, schoolView)
    if (pond) for (const fish of school) fish.avoid(pond.x, pond.y)
    const sea = toWater(at, rayView)
    if (sea) for (const ray of rays) ray.avoid(sea.x, sea.y)
    const deep = ocean && toWater(at, oceanView)
    if (ocean && deep) {
      for (const glider of ocean.gliders) glider.avoid(deep.x, deep.y)
      for (const shark of ocean.sharks) shark.avoid(deep.x, deep.y)
      // The dolphins come over instead.
      for (const dolphin of ocean.dolphins) dolphin.notice(deep.x, deep.y)
    }
    wakeFrom = { ...at, time: now }
  }

  const onPointerMove = (event: PointerEvent) => {
    // A finger is followed through touchmove instead, which keeps coming while the page scrolls.
    if (event.pointerType !== 'touch') leaveWake(event)
  }

  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (touch) leaveWake(touch)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  // The theme changes with the OS setting, or with a class or attribute on <html>.
  colorScheme.addEventListener('change', onColorSchemeChange)
  const themeObserver = new MutationObserver(onColorSchemeChange)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  })
  reducedMotion.addEventListener('change', play)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: true })
  // Text and pictures move with the page, so a still frame is redrawn as it scrolls.
  window.addEventListener('scroll', redrawIfStill, { passive: true })

  return {
    setMode: (next) => {
      if (next === mode) return
      mode = next
      applyMode(reducedMotion.matches)
      // Leaving the water to a picture: the jellyfish scatter from its middle as they go.
      if (next === 'away' && !reducedMotion.matches && width > 0) {
        disturbAt(width / 2, height / 2)
      }
      redrawIfStill()
    },
    setSchoolMode: (next) => {
      if (next === schoolMode) return
      schoolMode = next
      applyMode(reducedMotion.matches)
      redrawIfStill()
    },
    setRayMode: (next) => {
      if (next === rayMode) return
      rayMode = next
      applyMode(reducedMotion.matches)
      redrawIfStill()
    },
    setPicture: (src, from) => {
      if (picture?.src === src) return
      const still = reducedMotion.matches
      const next: PictureLayer | null = src
        ? { src, image: loadImage(src), alpha: still ? 1 : 0 }
        : null
      if (next && from && !still) {
        // The new picture condenses behind the crest of a ripple; the old one stays outside it.
        const ripple = createRipple(from.x, from.y, TRANSITION_PACE)
        addRipple(ripple)
        next.alpha = 1
        next.revealedBy = ripple
        if (picture) {
          picture.revealedBy = undefined
          picture.coveredBy = ripple
          leaving.push(picture)
        }
      } else if (picture) {
        // The old picture fades out. A still frame is not animated, so there it goes at once.
        picture.revealedBy = undefined
        if (!still) leaving.push(picture)
      }
      picture = next
      // A still frame needs the image before it can be drawn.
      if (next && still && !isLoaded(next.image)) {
        next.image.addEventListener('load', () => render(), { once: true })
      }
      redrawIfStill()
    },
    refresh: redrawIfStill,
    stop: () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('scroll', redrawIfStill)
      cancelAnimationFrame(frame)
      observer.disconnect()
      colorScheme.removeEventListener('change', onColorSchemeChange)
      themeObserver.disconnect()
      reducedMotion.removeEventListener('change', play)
    },
  }
}
