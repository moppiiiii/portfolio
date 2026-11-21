import { Link, useRouterState } from '@tanstack/react-router'
import type { MouseEvent, ReactNode } from 'react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { JellyfishCanvas } from '#/features/jellyfish/jellyfish-canvas'
import type { Rect } from '#/features/jellyfish/renderer'
import { IDENTITY_VIEW } from '#/features/jellyfish/renderer'
import type { SceneFrame, SceneMode } from '#/features/jellyfish/scene'
import { textRectsIn } from '#/features/jellyfish/text-rects'
import { ThemeSwitch } from '#/features/theme/theme-switch'

import type { Camera } from './aquarium-camera'
import {
  WHOLE_MAP,
  cameraBetween,
  cameraOn,
  easeInOut,
  layoutRect,
  tankView,
} from './aquarium-camera'
import { AquariumMap } from './aquarium-map'
import type { Place, Tank } from './aquarium-plan'
import type { Atlas, AtlasPage } from './atlas-context'
import { AtlasContext } from './atlas-context'
import { ScrambleText } from './scramble-text'

/** What the water does on each page. */
const WATER: Record<AtlasPage, SceneMode> = {
  frontispiece: 'open',
  contents: 'behind',
  plate: 'away',
  career: 'behind',
  about: 'behind',
  ocean: 'behind',
  missing: 'open',
}
/** The tank each page is set in. The frontispiece is the map of the whole aquarium. */
const TANK: Record<AtlasPage, Tank | null> = {
  frontispiece: null,
  contents: 'works',
  plate: 'works',
  missing: 'works',
  career: 'career',
  about: 'about',
  ocean: 'ocean',
}
/** Seconds the camera takes between the map and a tank, or from tank to tank. */
const CAMERA_TIME = 1.3
/** Share of the camera's move after which a page's text starts to drift in. */
const TEXT_AFTER = 0.7

/** The camera's current move: where it set off from (and when, in ms) and where it is going. */
type CameraMove = {
  from: Camera
  fromTank: Tank | null
  to: Tank | null
  start: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * How visible the map's drawing (name, walls, tank outlines) is, `t` of the way through a move. It
 * stays while the camera sets off into a tank and fades as the tank fills the screen; it comes
 * back early on the way out; between tanks it shows faintly as the camera passes along the hall.
 */
function mapOpacity(fromTank: Tank | null, toTank: Tank | null, t: number) {
  if (toTank === null) return fromTank === null ? 1 : clamp01((t - 0.15) / 0.6)
  if (fromTank === null) return 1 - clamp01((t - 0.45) / 0.5)
  return fromTank === toTank ? 0 : 0.5 * Math.sin(Math.PI * t)
}

/**
 * How much the goldfish grow when their tank is seen small (see `tankView`): less than the
 * jellyfish, as their long bodies still read as fish when smaller, and the career tank is small.
 */
const SCHOOL_GROWTH = 0.6
/**
 * The same for the ray, as for the jellyfish: the about tank is the smallest, and the ray's shape
 * only reads once it is a dozen and more characters across.
 */
const RAY_GROWTH = 0.55
/** The same for the big ocean tank's creatures. */
const OCEAN_GROWTH = 0.5

/** The element of `tank` on the floor plan shown for the screen's orientation. */
function findTank(layer: HTMLElement, tank: Tank): HTMLElement | undefined {
  return [...layer.querySelectorAll<HTMLElement>(`[data-tank="${tank}"]`)].find(
    (element) => element.offsetParent !== null,
  )
}

/** Gap (px) between a picture's edge and the notes beside, above or below it. */
const NOTE_GAP = 28
/** Space (px) kept between a note and the screen edge. */
const NOTE_MARGIN = 8
/** Space (px) kept between two notes set side by side above or below the picture. */
const NOTE_SPACING = 12
/** Space (px) between rows of notes above or below the picture. */
const NOTE_ROW_GAP = 4

const NAV_LINK =
  'opacity-(--jelly-faint) transition-opacity hover:opacity-100 data-[status=active]:opacity-100'

type Point = { x: number; y: number }

/** The stretch of the screen's width a note takes. */
type Span = { left: number; right: number }

function placeLine(line: SVGLineElement | null, from: Point, to: Point) {
  if (!line) return
  line.setAttribute('x1', String(from.x))
  line.setAttribute('y1', String(from.y))
  line.setAttribute('x2', String(to.x))
  line.setAttribute('y2', String(to.y))
  line.style.visibility = 'visible'
}

/** Moves a note so its top left corner is at `topLeft`. */
function placeNote(note: HTMLElement | null, topLeft: Point) {
  if (!note) return
  note.style.transform = `translate(${topLeft.x}px, ${topLeft.y}px)`
  note.style.visibility = 'visible'
}

function hide(element: HTMLElement | SVGElement | null) {
  if (element) element.style.visibility = 'hidden'
}

/** A note set above or below the picture, with its row counted out from the picture (0 nearest). */
type Stacked = Span & { row: number }

/** Whether a vertical line at `x` would run through, or brush, a note taking `span`. */
function covers(span: Span, x: number) {
  return x > span.left - NOTE_SPACING / 2 && x < span.right + NOTE_SPACING / 2
}

/**
 * Sets out the notes on one side of the picture, above or below it, given the point each describes
 * (`x`) and its width. No two notes overlap, and no line runs through a note nearer the picture:
 * each note is tried centred on its point, then ending at it, then starting from it, nearest row
 * first, and a place that covers the point of a note not yet placed is taken only when no other
 * is free. Only when points crowd closer than a note is wide can a line still cross a note.
 */
function stackNotes(
  notes: readonly { x: number; width: number }[],
  screenWidth: number,
): Stacked[] {
  const placed: Stacked[] = []
  const byPoint = notes.map((_, index) => index)
  byPoint.sort((a, b) => notes[a].x - notes[b].x)
  for (const index of byPoint) {
    const { x, width } = notes[index]
    const candidates = [x - width / 2, x - width, x].map((start) => {
      const left = Math.max(
        NOTE_MARGIN,
        Math.min(start, screenWidth - NOTE_MARGIN - width),
      )
      return { left, right: left + width }
    })
    const rowCount = placed.reduce(
      (count, other) => Math.max(count, other.row + 1),
      0,
    )
    // `every` passes over the notes not placed yet.
    const fits = (span: Span, row: number) =>
      placed.every((other, otherIndex) => {
        if (other.row === row)
          return (
            span.right + NOTE_SPACING <= other.left ||
            span.left >= other.right + NOTE_SPACING
          )
        // A note nearer the picture must not lie on this note's line, nor this one on the line of
        // a note further out.
        return other.row < row
          ? !covers(other, x)
          : !covers(span, notes[otherIndex].x)
      })
    // The notes still to place may end up further out, so their lines must stay clear too.
    const clearOfUnplaced = (span: Span) =>
      notes.every(
        (other, otherIndex) =>
          otherIndex === index ||
          otherIndex in placed ||
          !covers(span, other.x),
      )
    const choose = (strict: boolean) => {
      for (let row = 0; row <= rowCount; row++)
        for (const span of candidates)
          if (fits(span, row) && (!strict || clearOfUnplaced(span)))
            return { ...span, row }
      return undefined
    }
    placed[index] = choose(true) ??
      choose(false) ?? { ...candidates[0], row: rowCount }
  }
  return placed
}

/**
 * Frame shared by every page of the atlas, set in an aquarium. Home is the aquarium's map; every
 * other page is set in one of its tanks, and a camera dives from the map into the tank (or along
 * the hall between tanks) as the page changes, the page's text drifting in over the tank's water.
 * The jellyfish live in the works tank: they swim in full view on the map, fade back behind the
 * contents, and leave a plate's water to its work's picture. Only the four corners carry the way
 * around. Wherever text lies over the water, the water goes faint so the text stays readable.
 */
export function AtlasLayout({
  atlas,
  page,
  plateSlug,
  children,
}: {
  atlas: Atlas
  page: AtlasPage
  /** The plate on screen, when `page` is a plate. */
  plateSlug: string | undefined
  children: ReactNode
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const plate =
    page === 'plate'
      ? atlas.plates.find((entry) => entry.slug === plateSlug)
      : undefined
  const heading =
    page === 'plate'
      ? `PLATE ${plate?.numeral ?? '?'}.`
      : page === 'contents'
        ? 'CONTENTS'
        : page === 'career'
          ? 'CAREER'
          : page === 'about'
            ? 'ABOUT'
            : page === 'ocean'
              ? 'OCEAN'
              : ''

  // Where the last link to a plate was clicked, so its picture ripples out from there.
  const clickedAt = useRef<Point | undefined>(undefined)
  const rippleFrom = useCallback((event: MouseEvent) => {
    clickedAt.current = { x: event.clientX, y: event.clientY }
  }, [])
  const takeRevealOrigin = useCallback(() => {
    const origin = clickedAt.current
    clickedAt.current = undefined
    return origin
  }, [])

  // The empty element a plate leaves for its picture.
  const frameElement = useRef<HTMLElement | null>(null)
  const pictureFrame = useCallback((element: HTMLElement | null) => {
    frameElement.current = element
  }, [])
  const getPictureFrame = useCallback(
    () => frameElement.current?.getBoundingClientRect(),
    [],
  )

  // Every piece of text on the page, so the water goes faint under it.
  const stageRef = useRef<HTMLElement>(null)
  const measureText = useRef<(() => readonly Rect[]) | null>(null)
  useEffect(() => {
    if (stageRef.current) measureText.current = textRectsIn(stageRef.current)
  }, [])
  const getTextRects = useCallback(() => measureText.current?.() ?? [], [])

  // The aquarium: the map, the tank this page is set in, and the camera moving between them.
  const layerRef = useRef<HTMLDivElement>(null)
  const target = TANK[page]
  // Where the visitor is on the map: in front of this page's tank, or, back on the map, in front
  // of the tank they came from (inside the entrance before any).
  const [here, setHere] = useState<Place>(target ?? 'entrance')
  if (target !== null && here !== target) setHere(target)
  const move = useRef<CameraMove | null>(null)
  /** The camera and the map's opacity of the frame being drawn. */
  const shot = useRef({
    camera: WHOLE_MAP,
    opacity: page === 'frontispiece' ? 1 : 0,
  })

  /** Works out the camera and the map's opacity at `now` (ms). */
  const takeShot = useCallback((now: number) => {
    const layer = layerRef.current
    const current = move.current
    if (!layer || !current) return shot.current
    const screen = { width: layer.clientWidth, height: layer.clientHeight }
    const tank = current.to && findTank(layer, current.to)
    const to = tank ? cameraOn(layoutRect(tank, layer), screen) : WHOLE_MAP
    const t = clamp01((now - current.start) / (CAMERA_TIME * 1000))
    return {
      camera: t >= 1 ? to : cameraBetween(current.from, to, easeInOut(t)),
      opacity: mapOpacity(current.fromTank, current.to, t),
    }
  }, [])

  /** Moves and fades the map to match the frame the water was drawn with. */
  const placeMap = useCallback(() => {
    const layer = layerRef.current
    if (!layer) return
    const { camera, opacity } = shot.current
    layer.style.transform = `matrix(${camera.scale}, 0, 0, ${camera.scale}, ${camera.offsetX}, ${camera.offsetY})`
    layer.style.opacity = String(opacity)
    layer.style.visibility = opacity < 0.01 ? 'hidden' : 'visible'
  }, [])

  /** Where the jellyfish's water, the works tank, appears on screen this frame. */
  const getView = useCallback(() => {
    shot.current = takeShot(performance.now())
    const layer = layerRef.current
    const works = layer && findTank(layer, 'works')
    if (!layer || !works) return IDENTITY_VIEW
    return tankView(shot.current.camera, layoutRect(works, layer), {
      width: layer.clientWidth,
      height: layer.clientHeight,
    })
  }, [takeShot])

  /** Where the big ocean tank appears this frame, by the same camera. */
  const getOceanView = useCallback(() => {
    const layer = layerRef.current
    const ocean = layer && findTank(layer, 'ocean')
    if (!layer || !ocean) return undefined
    return tankView(
      shot.current.camera,
      layoutRect(ocean, layer),
      { width: layer.clientWidth, height: layer.clientHeight },
      OCEAN_GROWTH,
    )
  }, [])

  /** Where the ray's water, the about tank, appears this frame, by the same camera. */
  const getRayView = useCallback(() => {
    const layer = layerRef.current
    const about = layer && findTank(layer, 'about')
    if (!layer || !about) return undefined
    return tankView(
      shot.current.camera,
      layoutRect(about, layer),
      { width: layer.clientWidth, height: layer.clientHeight },
      RAY_GROWTH,
    )
  }, [])

  /** Where the goldfish's water, the career tank, appears this frame, by the same camera. */
  const getSchoolView = useCallback(() => {
    const layer = layerRef.current
    const career = layer && findTank(layer, 'career')
    if (!layer || !career) return undefined
    return tankView(
      shot.current.camera,
      layoutRect(career, layer),
      { width: layer.clientWidth, height: layer.clientHeight },
      SCHOOL_GROWTH,
    )
  }, [])

  // Sets the camera off whenever the page is in another tank (or on the map). On the first page,
  // and for visitors who ask for reduced motion, it is simply there.
  const lastTarget = useRef<Tank | null | undefined>(undefined)
  useLayoutEffect(() => {
    const previous = lastTarget.current
    lastTarget.current = target
    const still =
      previous === undefined ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const now = performance.now()
    move.current = still
      ? { from: WHOLE_MAP, fromTank: target, to: target, start: -Infinity }
      : {
          from: shot.current.camera,
          fromTank: previous,
          to: target,
          start: now,
        }
    shot.current = takeShot(now)
    placeMap()
  }, [target, takeShot, placeMap])

  // A page whose tank the camera is still travelling to drifts in once it is nearly there. Diving
  // in from the map, the jellyfish also stay in full view until then. The address changes a render
  // before the page does, so both are watched.
  const arrivalKey = `${pathname} ${target ?? 'map'}`
  const [arrival, setArrival] = useState({
    key: arrivalKey,
    target,
    delay: 0,
    fromMap: false,
  })
  if (arrival.key !== arrivalKey) {
    const moving =
      arrival.target !== target &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setArrival({
      key: arrivalKey,
      target,
      delay: moving ? CAMERA_TIME * TEXT_AFTER : 0,
      fromMap: moving && arrival.target === null,
    })
  }
  const [arrivedAt, setArrivedAt] = useState(arrivalKey)
  useEffect(() => {
    const timer = window.setTimeout(
      () => setArrivedAt(arrivalKey),
      arrival.delay * 1000,
    )
    return () => window.clearTimeout(timer)
  }, [arrivalKey, arrival.delay])
  const stillDiving = arrival.fromMap && arrivedAt !== arrivalKey
  const water = stillDiving ? WATER.frontispiece : WATER[page]
  // The goldfish and the ray fade back only behind their own page, once the camera is there.
  const school: SceneMode =
    page === 'career' && !stillDiving ? 'behind' : 'open'
  const rayWater: SceneMode =
    page === 'about' && !stillDiving ? 'behind' : 'open'

  const imageRef = useRef<HTMLImageElement>(null)
  const noteRefs = useRef<(HTMLSpanElement | null)[]>([])
  const noteLineRefs = useRef<(SVGLineElement | null)[]>([])
  const notes = useMemo(() => plate?.notes ?? [], [plate])
  const plateImage = plate?.image

  /**
   * Lays the work's image exactly over its drawing in the water and sets the notes out around it,
   * each joined by a line to the point it describes. The notes sit beside the picture, on the side
   * nearer their point, when every one of them fits there. On narrow screens, where they do not,
   * they sit above or below it instead, nearer their point, in rows so that none overlap.
   *
   * The drawing in characters is how the picture arrives: once it has finished spreading or
   * fading in, the image itself fades in over it and stays. A frame still showing the previous
   * plate's picture is ignored, so the next plate's image never shows before its drawing.
   */
  const followPicture = useCallback(
    ({ picture }: SceneFrame) => {
      if (!picture || picture.src !== plateImage) {
        hide(imageRef.current)
        for (const note of noteRefs.current) hide(note)
        for (const line of noteLineRefs.current) hide(line)
        return
      }
      const { rect } = picture
      const image = imageRef.current
      if (image) {
        image.style.left = `${rect.x}px`
        image.style.top = `${rect.y}px`
        image.style.width = `${rect.width}px`
        image.style.height = `${rect.height}px`
        image.style.visibility = 'visible'
        if (picture.settled) image.dataset.settled = ''
      }
      const screenWidth = document.documentElement.clientWidth
      const labels = notes.map((note, index) => {
        const element = noteRefs.current[index] ?? null
        return {
          element,
          line: noteLineRefs.current[index] ?? null,
          width: element?.offsetWidth ?? 0,
          height: element?.offsetHeight ?? 0,
          toLeft: note.x < 0.5,
          above: note.y < 0.5,
          at: {
            x: rect.x + note.x * rect.width,
            y: rect.y + note.y * rect.height,
          },
        }
      })

      const fitBeside = labels.every(({ toLeft, width }) =>
        toLeft
          ? rect.x - NOTE_GAP - width >= NOTE_MARGIN
          : rect.x + rect.width + NOTE_GAP + width <= screenWidth - NOTE_MARGIN,
      )
      if (fitBeside) {
        for (const { element, line, width, height, toLeft, at } of labels) {
          const edge = toLeft
            ? rect.x - NOTE_GAP
            : rect.x + rect.width + NOTE_GAP
          placeNote(element, {
            x: toLeft ? edge - width : edge,
            y: at.y - height / 2,
          })
          placeLine(line, at, { x: edge, y: at.y })
        }
        return
      }

      for (const above of [true, false]) {
        const side = labels.filter((label) => label.above === above)
        const stacked = stackNotes(
          side.map(({ at, width }) => ({ x: at.x, width })),
          screenWidth,
        )
        side.forEach(({ element, line, height, at }, index) => {
          const { left, right, row } = stacked[index]
          const offset = NOTE_GAP + row * (height + NOTE_ROW_GAP)
          const top = above
            ? rect.y - offset - height
            : rect.y + rect.height + offset
          placeNote(element, { x: left, y: top })
          placeLine(line, at, {
            x: Math.max(left, Math.min(at.x, right)),
            y: above ? top + height : top,
          })
        })
      }
    },
    [notes, plateImage],
  )

  const context = useMemo(
    () => ({ atlas, rippleFrom, pictureFrame }),
    [atlas, rippleFrom, pictureFrame],
  )

  return (
    <AtlasContext value={context}>
      <main
        ref={stageRef}
        className="jellyfish-stage relative isolate min-h-dvh overflow-y-clip font-mono text-[var(--jelly-ink)]"
      >
        {/* Always behind the page: the stage is its own stacking context and the water sits at
            its very back, whether or not the page text is animating. */}
        <JellyfishCanvas
          className="fixed inset-0 -z-10 size-full"
          mode={water}
          schoolMode={school}
          rayMode={rayWater}
          picture={plate?.image ?? null}
          takeRevealOrigin={takeRevealOrigin}
          getPictureFrame={getPictureFrame}
          getTextRects={getTextRects}
          getView={getView}
          getSchoolView={getSchoolView}
          getRayView={getRayView}
          getOceanView={getOceanView}
          redrawKey={target ?? 'map'}
          onFrame={(frame) => {
            placeMap()
            followPicture(frame)
          }}
        />

        <AquariumMap
          isHome={page === 'frontispiece'}
          layerRef={layerRef}
          here={here}
        />

        {/* The corners: the way home, the page's name, and the way around. */}
        <header className="absolute inset-x-0 top-0 z-10 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 px-4 pt-4 text-xs sm:px-6 sm:pt-5 md:grid-cols-[1fr_auto_1fr]">
          <div>
            {page !== 'frontispiece' && (
              <Link to="/" className={`tracking-[0.2em] ${NAV_LINK}`}>
                HOME
              </Link>
            )}
          </div>
          <p className="col-span-2 row-start-2 pl-[0.3em] text-center tracking-[0.3em] md:col-span-1 md:col-start-2 md:row-start-1">
            <ScrambleText text={heading} />
          </p>
          <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 tracking-[0.15em] sm:gap-x-5 sm:tracking-[0.2em] md:col-start-3">
            <Link to="/plates" className={NAV_LINK}>
              CONTENTS
            </Link>
            <Link to="/career" className={NAV_LINK}>
              CAREER
            </Link>
            <Link to="/about" className={NAV_LINK}>
              ABOUT
            </Link>
            <ThemeSwitch />
          </nav>
        </header>

        {/* Keyed by the page, so each page's text drifts in afresh. */}
        <div
          key={pathname}
          className="plate-band"
          style={
            arrival.delay > 0
              ? { animationDelay: `${arrival.delay}s` }
              : undefined
          }
        >
          {children}
        </div>

        {/* Over the drawing: the work's image, which fades in once the drawing has arrived, and
            the notes beside it. Backed with the water, so a transparent image hides the drawing,
            and ringed with it, one character cell wide, so the drawing's edge cells do not show. */}
        <div className="pointer-events-none fixed inset-0 z-20">
          {plate && (
            <img
              key={`image-${plate.slug}`}
              ref={imageRef}
              src={plate.image}
              alt={plate.imageAlt}
              className="invisible absolute rounded-xl bg-(--jelly-water) opacity-0 shadow-[0_0_0_12px_var(--jelly-water)] transition-opacity duration-700 ease-out data-settled:opacity-100 motion-reduce:transition-none"
            />
          )}
          <svg aria-hidden="true" className="absolute inset-0 size-full">
            <g key={plate?.slug ?? 'none'} className="plate-note">
              {notes.map((note, index) => (
                <line
                  key={note.text}
                  ref={(element) => {
                    noteLineRefs.current[index] = element
                  }}
                  stroke="currentColor"
                  strokeWidth={1}
                  opacity={0.5}
                  className="invisible"
                />
              ))}
            </g>
          </svg>
          <div
            key={`notes-${plate?.slug ?? 'none'}`}
            aria-hidden="true"
            className="plate-note"
          >
            {notes.map((note, index) => (
              <span
                key={note.text}
                ref={(element) => {
                  noteRefs.current[index] = element
                }}
                className="invisible absolute top-0 left-0 px-1 text-[11px] whitespace-nowrap"
              >
                {note.text}
              </span>
            ))}
          </div>
        </div>
      </main>
    </AtlasContext>
  )
}
