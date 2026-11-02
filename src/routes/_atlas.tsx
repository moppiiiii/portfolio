import {
  Outlet,
  createFileRoute,
  useMatch,
  useMatches,
} from '@tanstack/react-router'

import { AtlasLayout } from '#/features/atlas/atlas-layout'
import { getAtlas } from '#/features/works/works.functions'

/**
 * Pathless layout for every page of the atlas. Its component stays mounted while moving between
 * them, which keeps the jellyfish swimming across pages.
 */
export const Route = createFileRoute('/_atlas')({
  loader: () => getAtlas(),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.author }] : [],
  }),
  component: AtlasRoute,
})

function AtlasRoute() {
  const atlas = Route.useLoaderData()
  const page =
    useMatches({
      select: (matches) => {
        const last = matches.at(-1)
        // An unknown address, or a plate that does not exist.
        return last?.status === 'notFound'
          ? 'missing'
          : last?.staticData.atlasPage
      },
    }) ?? 'frontispiece'
  const plate = useMatch({ from: '/_atlas/plates/$slug', shouldThrow: false })
  return (
    <AtlasLayout atlas={atlas} page={page} plateSlug={plate?.params.slug}>
      <Outlet />
    </AtlasLayout>
  )
}
