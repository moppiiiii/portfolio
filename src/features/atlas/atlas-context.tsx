import { createContext, useContext } from 'react'
import type { MouseEvent } from 'react'

import type { getAtlas } from '#/features/works/works.functions'

export type Atlas = Awaited<ReturnType<typeof getAtlas>>

/**
 * The pages of the atlas. Each route names its page in `staticData.atlasPage`; `missing` is any
 * address the atlas has nothing for.
 */
export type AtlasPage =
  | 'frontispiece'
  | 'contents'
  | 'plate'
  | 'career'
  | 'about'
  | 'ocean'
  | 'missing'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Which page of the atlas a route is, so the shared layout knows what the water shows. */
    atlasPage?: AtlasPage
  }
}

type AtlasState = {
  atlas: Atlas
  /**
   * Remembers where a link to a plate was clicked, so the plate's picture ripples out from there.
   * Pass it as the link's onClick.
   */
  rippleFrom: (event: MouseEvent) => void
  /**
   * Ref for the empty element a plate leaves for its picture. The picture is drawn into the water
   * to fill it, and follows it as the page scrolls.
   */
  pictureFrame: (element: HTMLElement | null) => void
}

export const AtlasContext = createContext<AtlasState | null>(null)

/** The atlas content and water controls, for anything rendered inside `AtlasLayout`. */
export function useAtlas(): AtlasState {
  const state = useContext(AtlasContext)
  if (!state) throw new Error('useAtlas must be used inside AtlasLayout')
  return state
}
