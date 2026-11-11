import { createFileRoute } from '@tanstack/react-router'

import { CareerList } from '#/features/atlas/career-list'
import { getCareer } from '#/features/works/works.functions'
import { SITE_NAME, pageHead } from '#/lib/seo'

export const Route = createFileRoute('/_atlas/career')({
  staticData: { atlasPage: 'career' },
  loader: () => getCareer(),
  head: ({ loaderData }) => {
    // The places worked at, with when. A place not given yet (written '???') is left out.
    const places = (loaderData ?? [])
      .flatMap((section) => section.entries)
      .filter((entry) => /[a-z]/i.test(entry.place))
      .map((entry) => `${entry.place} (${entry.period})`)
    return pageHead({
      title: 'Career',
      description:
        places.length > 0
          ? `Career of ${SITE_NAME}, a full-stack engineer: ${places.join(', ')}.`
          : `Career of ${SITE_NAME}, a full-stack engineer.`,
      path: '/career',
    })
  },
  component: CareerPage,
})

function CareerPage() {
  const career = Route.useLoaderData()
  return <CareerList career={career} />
}
