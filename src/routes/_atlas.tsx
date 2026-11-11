import {
  Outlet,
  createFileRoute,
  useMatch,
  useMatches,
} from '@tanstack/react-router'

import { AtlasLayout } from '#/features/atlas/atlas-layout'
import { getAtlas } from '#/features/works/works.functions'
import { SITE_URL } from '#/lib/seo'

/**
 * Pathless layout for every page of the atlas. Its component stays mounted while moving between
 * them, which keeps the jellyfish swimming across pages.
 */
export const Route = createFileRoute('/_atlas')({
  loader: () => getAtlas(),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.author },
          // Who the site is about, for search engines: the author, their online name, their line
          // and the places to find them elsewhere.
          {
            'script:ld+json': {
              '@context': 'https://schema.org',
              '@type': 'Person',
              name: loaderData.author,
              alternateName: loaderData.handle,
              jobTitle: loaderData.tagline.replace(/\.$/, ''),
              url: SITE_URL,
              sameAs: loaderData.links.map((link) => link.href),
            },
          },
        ]
      : [],
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
