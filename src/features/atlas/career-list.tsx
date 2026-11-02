import { Link } from '@tanstack/react-router'

import type { getCareer } from '#/features/works/works.functions'

import { useAtlas } from './atlas-context'

type Career = Awaited<ReturnType<typeof getCareer>>

/** Dots between a place and the position held there, cut to the space between them. */
const LEADER = '. '.repeat(120)

/**
 * The career page, set like the chronological table of an old book: the period on the left, and
 * beside it the place, joined by dots to the position held there when one is given, then a note
 * on what was done and the plates of the works made there, when given. Opening a plate sends its
 * picture out on a ripple from the link.
 */
export function CareerList({ career }: { career: Career }) {
  const { rippleFrom } = useAtlas()
  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 pt-24 pb-24 sm:px-6">
      <h1 className="sr-only">Career</h1>
      <div className="space-y-16">
        {career.map((part) => (
          <section key={part.heading}>
            <h2 className="text-xs tracking-[0.3em] uppercase opacity-(--jelly-faint)">
              {part.heading}
            </h2>
            <ol className="mt-6 space-y-8">
              {part.entries.map((entry) => (
                <li
                  key={`${entry.period} ${entry.place}`}
                  className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)]"
                >
                  <p className="text-xs leading-5 opacity-(--jelly-faint) sm:text-[13px]">
                    {entry.period}
                  </p>
                  <div>
                    {/* On a phone the position goes under the place, without the dots. */}
                    <p className="flex flex-col text-sm sm:flex-row sm:items-baseline sm:gap-3">
                      <span className="font-semibold">{entry.place}</span>
                      {entry.title && (
                        <>
                          {/* The whole box counts as text for the water: the dots run on past it, hidden. */}
                          <span
                            aria-hidden="true"
                            data-water-text-box
                            className="hidden min-w-6 flex-1 overflow-hidden whitespace-nowrap opacity-30 sm:block"
                          >
                            {LEADER}
                          </span>
                          <span className="shrink-0 opacity-(--jelly-soft)">
                            {entry.title}
                          </span>
                        </>
                      )}
                    </p>
                    {entry.note && (
                      <p className="mt-2 text-xs leading-6 opacity-(--jelly-faint)">
                        {entry.note}
                      </p>
                    )}
                    {entry.plates.length > 0 && (
                      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 text-xs">
                        <dt className="leading-6 opacity-(--jelly-faint)">
                          works
                        </dt>
                        <dd className="flex flex-wrap gap-x-5 leading-6">
                          {entry.plates.map((plate) => (
                            <Link
                              key={plate.slug}
                              to="/plates/$slug"
                              params={{ slug: plate.slug }}
                              onClick={rippleFrom}
                              className="opacity-(--jelly-soft) transition-opacity hover:underline hover:opacity-100"
                            >
                              <span className="tracking-[0.2em]">
                                {plate.numeral}.
                              </span>{' '}
                              {plate.title}
                            </Link>
                          ))}
                        </dd>
                      </dl>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  )
}
