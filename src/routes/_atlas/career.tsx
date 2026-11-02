import { createFileRoute } from '@tanstack/react-router'

import { CareerList } from '#/features/atlas/career-list'
import { getCareer } from '#/features/works/works.functions'

export const Route = createFileRoute('/_atlas/career')({
  staticData: { atlasPage: 'career' },
  loader: () => getCareer(),
  head: () => ({ meta: [{ title: 'Career' }] }),
  component: CareerPage,
})

function CareerPage() {
  const career = Route.useLoaderData()
  return <CareerList career={career} />
}
