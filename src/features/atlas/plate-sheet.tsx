import { Link } from '@tanstack/react-router'
import { useRef } from 'react'

import type { getPlate } from '#/features/works/works.functions'

import { useAtlas } from './atlas-context'
import { ScrambleText } from './scramble-text'

type Plate = Awaited<ReturnType<typeof getPlate>>

const LINK = 'opacity-(--jelly-faint) transition-opacity hover:opacity-100'

/**
 * One plate. The first screen leaves room for the work's picture, which arrives in the water, with
 * the work's name under it and the way back or on in the bottom corners. The full description follows
 * further down, over the open water.
 */
export function PlateSheet({ plate }: { plate: Plate }) {
  const { atlas, rippleFrom, pictureFrame } = useAtlas()
  const index = atlas.plates.findIndex((entry) => entry.slug === plate.slug)
  const previous = atlas.plates[index - 1]
  const next = atlas.plates[index + 1]
  const descriptionRef = useRef<HTMLElement>(null)

  const readDescription = () => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    descriptionRef.current?.scrollIntoView({
      behavior: still ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  return (
    <article>
      <section className="flex h-dvh flex-col px-4 pt-20 pb-4 sm:px-6 sm:pb-5 md:pt-16">
        {/* Left empty: the picture is drawn into the water here. */}
        <div
          ref={pictureFrame}
          className="mx-auto min-h-0 w-full max-w-5xl flex-1 md:w-[calc(100%-24rem)]"
        />
        <header className="mt-6 text-center">
          <h1 className="text-lg font-semibold tracking-[0.15em]">
            <ScrambleText text={plate.title} settleOnMount />
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[13px] opacity-(--jelly-soft)">
            {plate.summary}
          </p>
          <p className="mt-1 text-xs opacity-(--jelly-faint)">
            {plate.year} · {plate.role}
          </p>
        </header>
        <nav className="mt-6 grid grid-cols-[1fr_auto_1fr] items-end gap-4 text-xs tracking-[0.2em]">
          <Link to="/plates" className={`justify-self-start ${LINK}`}>
            ← CONTENTS
          </Link>
          <button
            type="button"
            onClick={readDescription}
            aria-label="Read the description"
            className={`cursor-pointer tracking-[0.2em] ${LINK}`}
          >
            <span className="hidden sm:inline">DESCRIPTION </span>↓
          </button>
          <span className="flex justify-end gap-6">
            {previous && (
              <Link
                to="/plates/$slug"
                params={{ slug: previous.slug }}
                onClick={rippleFrom}
                className={LINK}
              >
                ← {previous.numeral}.
              </Link>
            )}
            {next && (
              <Link
                to="/plates/$slug"
                params={{ slug: next.slug }}
                onClick={rippleFrom}
                className={LINK}
              >
                {next.numeral}. →
              </Link>
            )}
          </span>
        </nav>
      </section>

      <section
        ref={descriptionRef}
        className="mx-auto w-full max-w-xl scroll-mt-16 px-4 pt-16 pb-32 sm:px-6"
      >
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1 text-xs">
          <dt className="opacity-(--jelly-faint)">year</dt>
          <dd>{plate.year}</dd>
          <dt className="opacity-(--jelly-faint)">tools</dt>
          <dd>{plate.tools}</dd>
          <dt className="opacity-(--jelly-faint)">role</dt>
          <dd>{plate.role}</dd>
        </dl>
        <div className="mt-8 space-y-4 text-[13px] leading-7">
          {plate.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
    </article>
  )
}
