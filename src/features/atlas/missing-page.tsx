import { Link, useRouterState } from '@tanstack/react-router'

import { ScrambleText } from './scramble-text'

/**
 * The page for an address the atlas does not have, set like the frontispiece: what happened, the
 * address that was asked for, and the way back to the contents.
 */
export function MissingPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <section className="flex h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="pl-[0.3em] text-xs tracking-[0.3em] uppercase opacity-(--jelly-faint)">
        Not found
      </p>
      <h1 className="mt-6 pl-[0.25em] text-4xl font-semibold tracking-[0.25em] sm:text-6xl">
        <ScrambleText text="404" settleOnMount />
      </h1>
      <p className="mt-6 max-w-md text-[13px] opacity-(--jelly-soft)">
        There is no page at <span className="break-all">{pathname}</span> in
        this atlas.
      </p>
      <Link
        to="/plates"
        className="mt-8 text-xs tracking-[0.2em] opacity-(--jelly-faint) transition-opacity hover:opacity-100"
      >
        ← CONTENTS
      </Link>
    </section>
  )
}
