import { AsciiRenderer } from './ascii-renderer'
import type { Bounds } from './jellyfish'
import { Jellyfish, bellRadius } from './jellyfish'
import { LineRenderer } from './line-renderer'
import { readPalette } from './palette'
import type { JellyfishRenderer } from './renderer'
import type { Ripple } from './ripple'
import { RIPPLE_LIFETIME, createRipple } from './ripple'

/** `ascii` draws with monospace characters; `line` draws thin ink lines. */
export type JellyfishVariant = 'ascii' | 'line'

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
/** Number of jellyfish on screen, whatever the screen size. */
const JELLYFISH_COUNT = 5
/** Size of the furthest jellyfish relative to the nearest. */
const FURTHEST_SCALE = 0.45

/** Ripples alive at once. A burst of clicks drops the oldest. */
const MAX_RIPPLES = 12
/**
 * Clicks on these elements belong to them (links, buttons, form fields), so they do not ripple
 * the water. This matters once text and links sit on top of the canvas.
 */
const INTERACTIVE_ELEMENTS =
  'a, button, input, textarea, select, label, summary, [role="button"], [contenteditable]'

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
 * Creates the group at random positions anywhere on screen, each tilted at random, keeping each
 * jellyfish clear of the others' bells and tentacles where the screen has room.
 * The group is ordered from the furthest jellyfish to the nearest so renderers can paint in order.
 */
function spawnGroup(bounds: Bounds): Jellyfish[] {
  const count = JELLYFISH_COUNT
  const placed: Footprint[] = []
  const group: Jellyfish[] = []

  // Place the nearest (largest) first: big ones are the hardest to fit.
  for (let i = count - 1; i >= 0; i--) {
    const depth = i / (count - 1)
    const scale = FURTHEST_SCALE + (1 - FURTHEST_SCALE) * depth
    const radius = bellRadius(bounds, scale)
    let x = 0
    let y = 0
    let leastOverlap = Infinity
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const candidateX = bounds.width * (0.08 + Math.random() * 0.84)
      const candidateY = bounds.height * (0.1 + Math.random() * 0.65)
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
      scale,
      x,
      y,
      heading: -Math.PI / 2 + (Math.random() * 2 - 1) * START_TILT,
    })
  }
  return group
}

/** Starts the jellyfish animation on `canvas` and returns a function that stops it. */
export function startJellyfishScene(
  canvas: HTMLCanvasElement,
  variant: JellyfishVariant,
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const renderer: JellyfishRenderer =
    variant === 'ascii' ? new AsciiRenderer() : new LineRenderer()
  renderer.setPalette(readPalette(canvas))

  let group: Jellyfish[] = []
  let ripples: Ripple[] = []
  let frame = 0
  let lastTime = 0
  let pending = 0

  const advance = (steps: number) => {
    for (let n = 0; n < steps; n++) {
      for (const jellyfish of group) jellyfish.step(STEP, group)
      for (const ripple of ripples) ripple.age += STEP
    }
    if (ripples.length > 0) {
      ripples = ripples.filter((ripple) => ripple.age < RIPPLE_LIFETIME)
    }
  }

  const render = () => {
    if (group.length > 0) renderer.render(ctx, group, ripples)
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

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(rect.width * pixelRatio)
    canvas.height = Math.round(rect.height * pixelRatio)
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    renderer.resize(rect.width, rect.height, pixelRatio)

    const bounds = { width: rect.width, height: rect.height }
    if (group.length > 0) {
      for (const jellyfish of group) jellyfish.setBounds(bounds)
    } else {
      group = spawnGroup(bounds)
      const warmup = reducedMotion.matches ? STILL_FRAME_WARMUP : START_WARMUP
      advance(Math.round(warmup / STEP))
      play()
    }
    render()
  }

  const onColorSchemeChange = () => {
    renderer.setPalette(readPalette(canvas))
    render()
  }

  /** A click or tap on the water sends out a ripple and startles nearby jellyfish. */
  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || reducedMotion.matches) return
    if (
      event.target instanceof Element &&
      event.target.closest(INTERACTIVE_ELEMENTS)
    ) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return
    ripples.push(createRipple(x, y))
    if (ripples.length > MAX_RIPPLES) ripples.shift()
    for (const jellyfish of group) jellyfish.disturb(x, y)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  colorScheme.addEventListener('change', onColorSchemeChange)
  reducedMotion.addEventListener('change', play)
  window.addEventListener('pointerdown', onPointerDown)

  return () => {
    window.removeEventListener('pointerdown', onPointerDown)
    cancelAnimationFrame(frame)
    observer.disconnect()
    colorScheme.removeEventListener('change', onColorSchemeChange)
    reducedMotion.removeEventListener('change', play)
  }
}
