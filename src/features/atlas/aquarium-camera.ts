import type { Rect, View } from '#/features/jellyfish/renderer'

/**
 * How the aquarium map is shown on screen: a map point (x, y) appears at
 * (x * scale + offsetX, y * scale + offsetY). The map is laid out at the size of the screen, so
 * the identity camera shows all of it.
 */
export type Camera = { scale: number; offsetX: number; offsetY: number }

export const WHOLE_MAP: Camera = { scale: 1, offsetX: 0, offsetY: 0 }

type Size = { width: number; height: number }

/** The camera that fills the screen with `rect` (map px), centred, leaving none of the map around it. */
export function cameraOn(rect: Rect, screen: Size): Camera {
  const scale = Math.max(screen.width / rect.width, screen.height / rect.height)
  return {
    scale,
    offsetX: screen.width / 2 - (rect.x + rect.width / 2) * scale,
    offsetY: screen.height / 2 - (rect.y + rect.height / 2) * scale,
  }
}

/**
 * The camera part way (t from 0 to 1) from `from` to `to`. The zoom changes at an even rate, and
 * the one map point both cameras show at the same place stays there, so the view dives straight
 * into what it zooms to. Between cameras at the same zoom, it pans.
 */
export function cameraBetween(from: Camera, to: Camera, t: number): Camera {
  const scale = from.scale * (to.scale / from.scale) ** t
  const shrink = from.scale - to.scale
  if (Math.abs(shrink) < 1e-6) {
    return {
      scale,
      offsetX: from.offsetX + (to.offsetX - from.offsetX) * t,
      offsetY: from.offsetY + (to.offsetY - from.offsetY) * t,
    }
  }
  const stillX = (to.offsetX - from.offsetX) / shrink
  const stillY = (to.offsetY - from.offsetY) / shrink
  return {
    scale,
    offsetX: stillX * from.scale + from.offsetX - stillX * scale,
    offsetY: stillY * from.scale + from.offsetY - stillY * scale,
  }
}

/**
 * How much larger jellyfish seen in a shrunken tank are drawn, as a power of how far the tank is
 * shrunk: 0 draws them true to the tank, 1 would keep them their full size. At under a third of
 * the screen, the works tank on the map shows them at about three fifths of their size instead
 * of under a third: large enough to read as jellyfish in characters, small enough to sit in it.
 */
const BODY_GROWTH = 0.57

/** `rect` (map px) as it appears on screen through `camera`. */
export function onScreen(rect: Rect, camera: Camera): Rect {
  return {
    x: rect.x * camera.scale + camera.offsetX,
    y: rect.y * camera.scale + camera.offsetY,
    width: rect.width * camera.scale,
    height: rect.height * camera.scale,
  }
}

/**
 * The view for drawing water of size `world` (the jellyfish swim in a screen-sized water) inside
 * `tank` (map px), seen through `camera`. The jellyfish stay inside the tank; while it is shrunk,
 * they are drawn larger than their place in it, back to true size as it fills the screen. The
 * ones not shown from afar come into view from when the tank fills half the screen's width.
 */
export function tankView(
  camera: Camera,
  tank: Rect,
  world: Size,
  growth = BODY_GROWTH,
): View {
  const clip = onScreen(tank, camera)
  const zoom = clip.width / world.width
  return {
    zoom,
    offsetX: clip.x,
    offsetY: clip.y,
    clip,
    bodyScale: Math.max(1, (1 / zoom) ** growth),
    afar: Math.min(1, Math.max(0, 1 / zoom - 1)),
  }
}

/** Where `element` sits inside `root` (px), ignoring any transform on the way. */
export function layoutRect(element: HTMLElement, root: HTMLElement): Rect {
  let x = 0
  let y = 0
  let node: HTMLElement | null = element
  while (node && node !== root) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null
  }
  return { x, y, width: element.offsetWidth, height: element.offsetHeight }
}

/** Slow at both ends. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}
