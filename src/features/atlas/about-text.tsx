import { useAtlas } from './atlas-context'
import { ScrambleText } from './scramble-text'

/**
 * The about page: the author's name and online name over a short column of text, and under it
 * the places to find them elsewhere, each named on the left with its address beside it.
 */
export function AboutText() {
  const { atlas } = useAtlas()
  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 pt-24 pb-16 sm:px-6">
      <h1 className="pl-[0.2em] text-center text-2xl font-semibold tracking-[0.2em] uppercase">
        <ScrambleText text={atlas.author} settleOnMount />
      </h1>
      <p className="mt-3 pl-[0.2em] text-center text-xs tracking-[0.2em] opacity-(--jelly-faint)">
        @{atlas.handle}
      </p>
      <div className="mt-8 space-y-4 text-[13px] leading-7">
        {atlas.about.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <dl className="mt-8 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 text-xs leading-6">
        {atlas.links.map((link) => (
          <div key={link.href} className="contents">
            <dt className="opacity-(--jelly-faint)">{link.label}</dt>
            <dd>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-(--jelly-soft) transition-opacity hover:underline hover:opacity-100"
              >
                {link.href.replace(/^https:\/\//, '')}
              </a>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
