import type { Dolphin } from './dolphin'
import type { Goldfish } from './goldfish'
import type { Jellyfish } from './jellyfish'
import type { Manta } from './manta'
import type { Palette } from './palette'
import type { Ripple } from './ripple'
import type { Shark } from './shark'
import type { SeaTurtle } from './turtle'

/**
 * Camera for drawing: a world point (x, y) appears on screen at
 * (x * zoom + offsetX, y * zoom + offsetY). Ripples, pictures and the background grid stay in
 * screen space. With `clip` (screen px), the jellyfish are drawn only inside it, such as the tank
 * they live in.
 */
export type View = {
  zoom: number
  offsetX: number
  offsetY: number
  clip?: Rect
  /**
   * How much larger than `zoom` each jellyfish's body is drawn, about its own place, which stays
   * where `zoom` puts it. Jellyfish seen small, in a tank on a map, would otherwise be a few
   * characters across and unrecognisable. 1 when absent.
   */
  bodyScale?: number
  /**
   * How far away the water is seen, from 0 (filling the screen) to 1 (a small tank on a map).
   * Jellyfish that are not `shownAfar` fade out with it. 0 when absent.
   */
  afar?: number
}

export const IDENTITY_VIEW: View = { zoom: 1, offsetX: 0, offsetY: 0 }

/** A rectangle on screen, in CSS px. */
export type Rect = { x: number; y: number; width: number; height: number }

/** A picture placed in the water, such as a work's image, in screen px. */
export type PictureDraw = {
  /** The image as returned by the renderer's `preparePicture`. */
  source: CanvasImageSource
  x: number
  y: number
  width: number
  height: number
  /** 0 to 1. */
  alpha: number
  /**
   * Draws only inside, or only outside, this circle. Used to reveal a picture behind the crest of
   * a ripple as it spreads.
   */
  clip?: { x: number; y: number; radius: number; inside: boolean }
}

/** The goldfish of a second tank, drawn through their own view. */
export type School = { fish: readonly Goldfish[]; view: View }
/** The rays of a third tank, drawn through their own view. */
export type Rays = { rays: readonly Manta[]; view: View }
/** The big tank's many kinds, drawn through its own view. */
export type Ocean = {
  view: View
  rays: readonly Manta[]
  turtles: readonly SeaTurtle[]
  sharks: readonly Shark[]
  dolphins: readonly Dolphin[]
}
/** The creatures of the tanks beside the jellyfish's, each through its own view. */
export type SideTanks = { school?: School; rays?: Rays; ocean?: Ocean }

/** Draws a group of jellyfish, and any pictures in the water, onto a 2D canvas. */
export interface JellyfishRenderer {
  /** Called whenever the canvas size or pixel ratio changes. Sizes are in CSS pixels. */
  resize(width: number, height: number, pixelRatio: number): void
  setPalette(palette: Palette): void
  /**
   * Turns a loaded image into what this renderer draws, such as a brightness map for ASCII.
   * Results are cached per image until the palette changes.
   */
  preparePicture(image: HTMLImageElement): CanvasImageSource
  /**
   * Draws one frame. `pictures` go under the jellyfish; `group` must be ordered from the furthest
   * jellyfish to the nearest and is drawn through `view`; `ripples` bend everything on top.
   * `textRects` are where page text lies over the canvas: the water is drawn faint under them so
   * the text stays readable. `sides` are the creatures of the other tanks, when there are any.
   */
  render(
    ctx: CanvasRenderingContext2D,
    group: readonly Jellyfish[],
    ripples: readonly Ripple[],
    view: View,
    pictures: readonly PictureDraw[],
    textRects: readonly Rect[],
    sides?: SideTanks,
  ): void
}

/** Opacity multiplier for a jellyfish at `depth` (0 = furthest, 1 = nearest). */
export function depthFade(depth: number): number {
  return 0.35 + 0.65 * depth
}

/**
 * Opacity multiplier for drawing `jellyfish`: its depth fade, times how far it has faded in, and,
 * for one not shown from afar, how close the water is seen through `view`.
 */
export function jellyfishFade(jellyfish: Jellyfish, view: View): number {
  const seen = jellyfish.shownAfar ? 1 : 1 - (view.afar ?? 0)
  return depthFade(jellyfish.depth) * jellyfish.presence * seen
}

/**
 * Opacity multiplier for drawing a goldfish, a ray, a turtle or a school: how far it has faded
 * in, and, for one not shown from afar, how close its water is seen through `view`.
 */
export function creatureFade(
  creature: { presence: number; shownAfar: boolean },
  view: View,
): number {
  const seen = creature.shownAfar ? 1 : 1 - (view.afar ?? 0)
  return creature.presence * seen
}
