import { useAtlas } from './atlas-context'
import { ScrambleText } from './scramble-text'

/** The about page: the author's name and online name over a short column of text. */
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
    </section>
  )
}
