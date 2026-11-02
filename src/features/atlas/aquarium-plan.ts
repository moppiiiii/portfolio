/**
 * The aquarium's floor plan, in percent of the screen's width (x) and height (y). A tank as wide
 * as it is tall in these units has the screen's own shape, so the camera can fill the screen with
 * it. There is one plan for landscape screens and one for portrait ones.
 *
 * The route enters at the bottom, passes each tank in turn (works, career, about, then the big
 * ocean tank) and leaves at the bottom. On a landscape screen there are three halls side by side:
 * works on the left, career over about in the middle, the ocean tank on the right. On a portrait
 * one the route climbs the left side (works, then career), crosses at the top and comes down the
 * right side (about, then the ocean). The building takes the upper part of the sheet; the legend
 * and the title block sit under it.
 */

/** The tanks of the aquarium: one per part of the site, and the big tank to look into. */
export type Tank = 'works' | 'career' | 'about' | 'ocean'

/** Where a visitor can stand: just inside the entrance, or in front of a tank. */
export type Place = Tank | 'entrance'

type Point = readonly [x: number, y: number]
type Size = { width: number; height: number }

export type Plan = {
  /** Outer walls, drawn double, with gaps for the entrance and exit (SVG path, percent). */
  outerWalls: string
  /** Walls between halls, with doorways (SVG path, percent). */
  innerWalls: string
  /** Top-left corner and size of each tank. */
  tanks: Record<Tank, { x: number; y: number; size: number }>
  /** The visitors' route, from just outside the entrance to just outside the exit. */
  route: readonly Point[]
  /** Arrows along the route, pointing the way. */
  arrows: readonly { at: Point; way: 'up' | 'right' | 'down' | 'left' }[]
  /** Where a visitor stands at each place, on the route. */
  stops: Record<Place, Point>
  /** Where the entrance and exit are named, under their gaps in the wall and the route's ends. */
  entrance: Point
  exit: Point
}

export const PLANS: Record<'landscape' | 'portrait', Plan> = {
  landscape: {
    outerWalls: 'M 16 70 L 6 70 L 6 12 L 94 12 L 94 70 L 92 70 M 84 70 L 24 70',
    innerWalls:
      'M 38 12 L 38 46 M 38 54 L 38 70 M 62 12 L 62 50 M 62 58 L 62 70',
    tanks: {
      works: { x: 9, y: 18, size: 26 },
      career: { x: 42.5, y: 17.5, size: 16 },
      about: { x: 43, y: 46, size: 14 },
      ocean: { x: 65, y: 19, size: 27 },
    },
    route: [
      [20, 72.5],
      [20, 50],
      [40, 50],
      [40, 38],
      [60, 38],
      [60, 54],
      [88, 54],
      [88, 72.5],
    ],
    arrows: [
      { at: [20, 60], way: 'up' },
      { at: [31, 50], way: 'right' },
      { at: [40, 44], way: 'up' },
      { at: [56, 38], way: 'right' },
      { at: [60, 46], way: 'down' },
      { at: [70, 54], way: 'right' },
      { at: [88, 63], way: 'down' },
    ],
    stops: {
      entrance: [20, 66],
      works: [22, 50],
      career: [50.5, 38],
      about: [60, 53],
      ocean: [78.5, 54],
    },
    entrance: [20, 74.5],
    exit: [88, 74.5],
  },
  portrait: {
    outerWalls: 'M 35 63 L 7 63 L 7 10 L 93 10 L 93 63 L 65 63 M 55 63 L 45 63',
    innerWalls: 'M 50 28 L 50 63 M 7 33.5 L 38 33.5 M 62 33 L 93 33',
    tanks: {
      works: { x: 10, y: 37.5, size: 25 },
      career: { x: 13, y: 14, size: 18 },
      about: { x: 66, y: 14, size: 16 },
      ocean: { x: 64, y: 36.5, size: 24 },
    },
    route: [
      [40, 65],
      [40, 20],
      [60, 20],
      [60, 65],
    ],
    arrows: [
      { at: [40, 55], way: 'up' },
      { at: [40, 37], way: 'up' },
      { at: [50, 20], way: 'right' },
      { at: [60, 32], way: 'down' },
      { at: [60, 57], way: 'down' },
    ],
    stops: {
      entrance: [40, 60],
      works: [40, 50],
      career: [40, 23],
      about: [60, 22],
      ocean: [60, 48.5],
    },
    entrance: [40, 67],
    exit: [60, 67],
  },
}

/** Length (px) of each leg of the route on a screen of `size`. */
function legLengths(plan: Plan, size: Size): number[] {
  return plan.route.slice(1).map(([x, y], index) => {
    const [fromX, fromY] = plan.route[index]
    return Math.hypot(
      ((x - fromX) / 100) * size.width,
      ((y - fromY) / 100) * size.height,
    )
  })
}

/** How far along the route (0 at the start, 1 at the end) `point`, which lies on it, is. */
export function shareAlong(plan: Plan, point: Point, size: Size): number {
  const legs = legLengths(plan, size)
  const total = legs.reduce((sum, leg) => sum + leg, 0)
  let walked = 0
  for (const [index, leg] of legs.entries()) {
    const [fromX, fromY] = plan.route[index]
    const [toX, toY] = plan.route[index + 1]
    const within =
      point[0] >= Math.min(fromX, toX) - 0.01 &&
      point[0] <= Math.max(fromX, toX) + 0.01 &&
      point[1] >= Math.min(fromY, toY) - 0.01 &&
      point[1] <= Math.max(fromY, toY) + 0.01
    if (within) {
      const along = Math.hypot(
        ((point[0] - fromX) / 100) * size.width,
        ((point[1] - fromY) / 100) * size.height,
      )
      return (walked + along) / total
    }
    walked += leg
  }
  return 0
}

/** The point (percent) `share` of the way along the route. */
export function pointAlong(plan: Plan, share: number, size: Size): Point {
  const legs = legLengths(plan, size)
  let left = share * legs.reduce((sum, leg) => sum + leg, 0)
  for (const [index, leg] of legs.entries()) {
    const [fromX, fromY] = plan.route[index]
    const [toX, toY] = plan.route[index + 1]
    if (left <= leg || index === legs.length - 1) {
      const t = leg > 0 ? Math.min(1, left / leg) : 0
      return [fromX + (toX - fromX) * t, fromY + (toY - fromY) * t]
    }
    left -= leg
  }
  return plan.route[0]
}
