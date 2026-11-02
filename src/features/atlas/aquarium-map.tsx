import { Link } from '@tanstack/react-router'
import type { CSSProperties, RefObject } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'

import { easeInOut } from './aquarium-camera'
import type { Place, Plan } from './aquarium-plan'
import { PLANS, pointAlong, shareAlong } from './aquarium-plan'
import { useAtlas } from './atlas-context'
import { AuthorName } from './author-name'

const TANKS = [
  { id: 'works', number: 1, label: 'WORKS', to: '/plates', life: 'jellyfish' },
  { id: 'career', number: 2, label: 'CAREER', to: '/career', life: 'goldfish' },
  { id: 'about', number: 3, label: 'ABOUT', to: '/about', life: 'manta ray' },
  {
    id: 'ocean',
    number: 4,
    label: 'OCEAN',
    to: '/ocean',
    life: 'sharks, dolphins, rays, turtle',
  },
] as const

/** Grid references along the sheet's edges, as on a printed map. */
const COLUMNS = ['A', 'B', 'C', 'D']
const ROWS = ['1', '2', '3']

const ARROWS = { up: '▲', right: '▶', down: '▼', left: '◀' }

const LABEL = 'absolute text-[10px] tracking-[0.3em] whitespace-nowrap'

/** Both plans, in the order their you-are-here marks are kept. */
const PLAN_LIST = [PLANS.landscape, PLANS.portrait]
/** Seconds the you-are-here mark takes to walk the route to a new place. */
const WALK_TIME = 0.8

/** Puts an element's top-left corner at a point of the plan (percent of the screen). */
function at([x, y]: readonly [number, number]): CSSProperties {
  return { left: `${x}%`, top: `${y}%` }
}

/** A tank's number in a small circle, as on the plan and in the legend. */
function TankNumber({ number }: { number: number }) {
  return (
    <span className="grid size-4 shrink-0 place-items-center rounded-full border border-current text-[9px] tracking-normal">
      {number}
    </span>
  )
}

/**
 * The sheet's border, with grid references along it: letters across the top and bottom, numbers
 * down the sides. Each reference sits on the floor colour, so the line breaks around it.
 */
function SheetFrame() {
  const reference =
    'absolute -translate-1/2 bg-(--jelly-floor) px-1.5 text-[10px] leading-none tracking-[0.2em] opacity-(--jelly-faint)'
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-[2.5%] top-[7%] bottom-[3%] border border-current/35 portrait:inset-x-[4%] portrait:top-[6%]"
    >
      {COLUMNS.map((column, index) => {
        const left = `${((index + 0.5) / COLUMNS.length) * 100}%`
        return (
          <span key={column}>
            <span className={reference} style={{ left, top: 0 }}>
              {column}
            </span>
            <span className={reference} style={{ left, top: '100%' }}>
              {column}
            </span>
          </span>
        )
      })}
      {ROWS.map((row, index) => {
        const top = `${((index + 0.5) / ROWS.length) * 100}%`
        return (
          <span key={row}>
            <span className={reference} style={{ left: 0, top }}>
              {row}
            </span>
            <span className={reference} style={{ left: '100%', top }}>
              {row}
            </span>
          </span>
        )
      })}
    </div>
  )
}

/** What the marks on the plan mean, and what lives in each tank. */
function Legend() {
  return (
    <div
      aria-hidden="true"
      className="absolute top-[77%] left-[6%] w-[32%] text-[10px] tracking-[0.2em] portrait:static portrait:w-auto [@media(orientation:portrait)_and_(max-height:740px)]:hidden"
    >
      <p className="mb-2.5 opacity-(--jelly-faint) portrait:mb-2">LEGEND</p>
      <ul className="space-y-1.5 portrait:space-y-1 [@media(max-height:700px)]:space-y-1">
        {TANKS.map((tank) => (
          <li key={tank.id} className="flex items-center gap-2">
            <TankNumber number={tank.number} />
            <span>{tank.label}</span>
            <span className="min-w-4 flex-1 overflow-hidden whitespace-nowrap opacity-30">
              {'. '.repeat(40)}
            </span>
            <span className="tracking-[0.1em] opacity-(--jelly-soft)">
              {tank.life}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="w-4 text-center text-(--jelly-accent)">⋯</span>
          <span>ROUTE</span>
          <span className="ml-5 grid w-4 place-items-center">
            <span className="size-2 rounded-full bg-(--jelly-accent)" />
          </span>
          <span>YOU ARE HERE</span>
        </li>
      </ul>
    </div>
  )
}

/**
 * The title block in the sheet's corner, as on an architect's drawing: the author's name (taking
 * turns with the online name) over their line, with the north arrow beside them.
 */
function TitleBlock({ isHome }: { isHome: boolean }) {
  const { atlas } = useAtlas()
  return (
    <div className="absolute top-[77%] right-[6%] w-[38%] border border-current/50 portrait:static portrait:w-auto">
      <div className="flex items-center justify-between gap-4 border-b border-current/30 px-4 py-3 portrait:px-3 portrait:py-2">
        <AuthorName
          as={isHome ? 'h1' : 'p'}
          align="start"
          className="text-2xl font-semibold tracking-[0.25em] lg:text-3xl portrait:text-xl"
        />
        <div
          aria-hidden="true"
          className="flex shrink-0 flex-col items-center gap-0.5 text-[10px] opacity-(--jelly-faint)"
        >
          <span>N</span>
          <span className="h-4 w-px bg-current" />
          <span className="size-1.5 rounded-full border border-current" />
        </div>
      </div>
      <p className="px-4 py-2 text-[12px] opacity-(--jelly-soft) portrait:px-3 portrait:py-1.5">
        {atlas.tagline}
      </p>
    </div>
  )
}

/**
 * One floor plan: the floor laid over the water everywhere but in the tanks, so only they show
 * water, double outer walls with the entrance and exit, thin walls between halls, the visitors'
 * route in the accent colour with arrows, the you-are-here mark, and the tanks, each a link into
 * its page.
 */
function FloorPlan({
  plan,
  isHome,
  firstPlace,
  markRef,
}: {
  plan: Plan
  isHome: boolean
  /** Where the you-are-here mark is first drawn; the map walks it on from there. */
  firstPlace: Place
  markRef: (element: HTMLElement | null) => void
}) {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        {/* The floor, with a hole for each tank. */}
        <path
          d={`M 0 0 H 100 V 100 H 0 Z ${TANKS.map(({ id }) => {
            const { x, y, size } = plan.tanks[id]
            return `M ${x} ${y} h ${size} v ${size} h ${-size} Z`
          }).join(' ')}`}
          fillRule="evenodd"
          style={{ fill: 'var(--jelly-floor)' }}
        />
        {/* A wide line hollowed out by a narrower one in the floor's colour: a double wall. */}
        <path
          d={plan.outerWalls}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.55}
          strokeWidth={5}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={plan.outerWalls}
          fill="none"
          style={{ stroke: 'var(--jelly-floor)' }}
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={plan.innerWalls}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.4}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={plan.route.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          style={{ stroke: 'var(--jelly-accent)' }}
          strokeWidth={1.5}
          strokeDasharray="1 6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {plan.arrows.map((arrow) => (
        <span
          key={`${arrow.at[0]} ${arrow.at[1]}`}
          aria-hidden="true"
          style={at(arrow.at)}
          className="absolute -translate-1/2 text-[11px] leading-none text-(--jelly-accent)"
        >
          {ARROWS[arrow.way]}
        </span>
      ))}

      <span
        ref={markRef}
        aria-hidden="true"
        style={at(plan.stops[firstPlace])}
        className="absolute"
      >
        <span className="absolute size-2.5 -translate-1/2 rounded-full bg-(--jelly-accent)" />
        <span
          className={`${LABEL} top-2.5 -translate-x-1/2 text-(--jelly-accent)`}
        >
          YOU ARE HERE
        </span>
      </span>
      <span
        aria-hidden="true"
        style={at(plan.entrance)}
        className={`${LABEL} -translate-1/2 opacity-(--jelly-faint)`}
      >
        ENTRANCE
      </span>
      <span
        aria-hidden="true"
        style={at(plan.exit)}
        className={`${LABEL} -translate-1/2 opacity-(--jelly-faint)`}
      >
        EXIT
      </span>

      {TANKS.map((tank) => {
        const box = plan.tanks[tank.id]
        return (
          <Link
            key={tank.id}
            to={tank.to}
            data-tank={tank.id}
            style={{
              left: `${box.x}%`,
              top: `${box.y}%`,
              width: `${box.size}%`,
              height: `${box.size}%`,
            }}
            className={`group absolute border border-current/60 outline outline-offset-4 outline-current/20 transition-colors hover:border-current ${isHome ? 'pointer-events-auto' : ''}`}
          >
            <span className="absolute bottom-full left-0 mb-2.5 flex items-center gap-2 text-[10px] tracking-[0.3em] whitespace-nowrap opacity-(--jelly-soft) transition-opacity group-hover:opacity-100 sm:text-xs">
              <TankNumber number={tank.number} />
              {tank.label}
            </span>
          </Link>
        )
      })}
    </>
  )
}

/**
 * The aquarium's map, which is the home page, drawn as one sheet of an architect's drawings: a
 * bordered sheet with grid references, the floor plan of the halls with one tank per part of the
 * site, a legend, and a title block with the author's name. Only the tanks show water; the floor
 * covers the rest. Each tank has the screen's shape, so the camera can dive into one until it
 * fills the screen, and that part's page shows over its water. Jellyfish live in the works tank,
 * goldfish in the career tank and manta rays in the about tank.
 *
 * The you-are-here mark stands where the visitor is, or last was: inside the entrance at first,
 * then in front of the tank of the page they are on or have just come back from, walking the
 * route between places.
 *
 * It stays mounted on every page. The layout moves it with the camera and fades it out inside a
 * tank; away from home it cannot be reached by keyboard or screen readers. The tank the camera
 * goes to is found by its `data-tank` attribute, on the plan for the screen's orientation.
 */
export function AquariumMap({
  isHome,
  layerRef,
  here,
}: {
  isHome: boolean
  layerRef: RefObject<HTMLDivElement | null>
  /** Where the visitor is, or last was. */
  here: Place
}) {
  // The mark is drawn at the first place, then moved straight on its element as it walks, so a
  // render never puts it back.
  const [firstPlace] = useState(here)
  const marks = useRef<(HTMLElement | null)[]>([])
  /** How far along each plan's route the mark is (0 to 1), once it has moved. */
  const shares = useRef<number[] | null>(null)
  const lastPlace = useRef(here)
  useLayoutEffect(() => {
    const layer = layerRef.current
    const previous = lastPlace.current
    if (!layer || previous === here) return
    lastPlace.current = here
    const size = () => ({
      width: layer.clientWidth,
      height: layer.clientHeight,
    })
    const from =
      shares.current ??
      PLAN_LIST.map((plan) => shareAlong(plan, plan.stops[previous], size()))
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let frame = 0
    const walk = (now: number) => {
      const screen = size()
      const t = still ? 1 : Math.min(1, (now - start) / (WALK_TIME * 1000))
      shares.current = PLAN_LIST.map((plan, index) => {
        const to = shareAlong(plan, plan.stops[here], screen)
        const share = from[index] + (to - from[index]) * easeInOut(t)
        const mark = marks.current[index]
        if (mark) {
          const [x, y] = pointAlong(plan, share, screen)
          mark.style.left = `${x}%`
          mark.style.top = `${y}%`
        }
        return share
      })
      if (t < 1) frame = requestAnimationFrame(walk)
    }
    walk(start)
    return () => cancelAnimationFrame(frame)
  }, [here, layerRef])

  return (
    <div
      ref={layerRef}
      inert={!isHome}
      className={`pointer-events-none fixed inset-0 origin-top-left ${isHome ? '' : 'opacity-0'}`}
    >
      <div className="absolute inset-0 portrait:hidden">
        <FloorPlan
          plan={PLANS.landscape}
          isHome={isHome}
          firstPlace={firstPlace}
          markRef={(element) => {
            marks.current[0] = element
          }}
        />
      </div>
      <div className="absolute inset-0 landscape:hidden">
        <FloorPlan
          plan={PLANS.portrait}
          isHome={isHome}
          firstPlace={firstPlace}
          markRef={(element) => {
            marks.current[1] = element
          }}
        />
      </div>

      <SheetFrame />
      {/* On a landscape screen these sit side by side under the plan, each placed on its own. On a
          portrait one they stack up from the bottom of the sheet, the legend left out where the
          screen is too short for it. */}
      <div className="contents portrait:absolute portrait:inset-x-[7%] portrait:bottom-[4.5%] portrait:flex portrait:flex-col portrait:gap-3">
        <Legend />
        <TitleBlock isHome={isHome} />
      </div>
    </div>
  )
}
