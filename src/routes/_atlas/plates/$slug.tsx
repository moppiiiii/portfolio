import { createFileRoute } from '@tanstack/react-router'

import { MissingPage } from '#/features/atlas/missing-page'
import { PlateSheet } from '#/features/atlas/plate-sheet'
import { getPlate } from '#/features/works/works.functions'
import { hiddenPageHead, pageHead } from '#/lib/seo'

export const Route = createFileRoute('/_atlas/plates/$slug')({
  staticData: { atlasPage: 'plate' },
  loader: ({ params }) => getPlate({ data: { slug: params.slug } }),
  head: ({ loaderData }) =>
    loaderData
      ? pageHead({
          title: `PLATE ${loaderData.numeral}. ${loaderData.title}`,
          description: loaderData.summary,
          path: `/plates/${loaderData.slug}`,
        })
      : hiddenPageHead('Not found'),
  notFoundComponent: MissingPage,
  component: PlatePage,
})

function PlatePage() {
  const plate = Route.useLoaderData()
  return <PlateSheet plate={plate} />
}
