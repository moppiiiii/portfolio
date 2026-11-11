import type { ErrorComponentProps } from '@tanstack/react-router'
import { useContext, useEffect, useState } from 'react'

import {
  isStaleFileError,
  mayReload,
  reloadForNewFiles,
} from '#/lib/stale-files'

import { AtlasContext } from './atlas-context'
import { ScrambleText } from './scramble-text'

const ACTION =
  'text-xs tracking-[0.2em] opacity-(--jelly-faint) transition-opacity hover:opacity-100'

/**
 * The page shown when something goes wrong, set like the not-found page. When the page's files
 * were replaced by a deploy, it reloads once to fetch the new ones and says so meanwhile;
 * otherwise it offers a reload and the way home.
 *
 * Inside the atlas it shows over the water like any page. When the atlas itself failed, it sets
 * up the stage's colours on its own.
 */
export function ErrorPage({ error }: ErrorComponentProps) {
  const inAtlas = useContext(AtlasContext) !== null
  // Decided once, when the page first shows: reload for new files, or offer the way on.
  const [reloading] = useState(() => isStaleFileError(error) && mayReload())
  useEffect(() => {
    if (reloading) reloadForNewFiles()
  }, [reloading])

  const page = (
    <section className="flex h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="pl-[0.3em] text-xs tracking-[0.3em] uppercase opacity-(--jelly-faint)">
        Something went wrong
      </p>
      <h1 className="mt-6 pl-[0.25em] text-4xl font-semibold tracking-[0.25em] sm:text-6xl">
        <ScrambleText text="ERROR" settleOnMount />
      </h1>
      <p className="mt-6 max-w-md text-[13px] opacity-(--jelly-soft)">
        {reloading
          ? 'The site has been updated. Loading the latest version…'
          : 'This page could not be shown. Reloading usually fixes it.'}
      </p>
      {!reloading && (
        <div className="mt-8 flex gap-8">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={ACTION}
          >
            RELOAD
          </button>
          {/* A full page load, as the router itself may be what failed. */}
          <a href="/" className={ACTION}>
            ← HOME
          </a>
        </div>
      )}
    </section>
  )

  return inAtlas ? (
    page
  ) : (
    <main className="jellyfish-stage relative isolate min-h-dvh font-mono text-[var(--jelly-ink)]">
      {page}
    </main>
  )
}
