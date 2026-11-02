import { useAtlas } from './atlas-context'
import { AuthorName } from './author-name'

/**
 * The frontispiece, set like a title page: the author's name and one line under it.
 * Not in use while the aquarium map stands in for it; kept to switch back to.
 */
export function Frontispiece() {
  const { atlas } = useAtlas()
  return (
    <section className="flex h-dvh flex-col items-center justify-center px-6 text-center">
      <AuthorName className="pl-[0.25em] text-4xl font-semibold tracking-[0.25em] sm:text-6xl" />
      <p className="mt-6 max-w-md text-[13px] opacity-(--jelly-soft)">
        {atlas.tagline}
      </p>
    </section>
  )
}
