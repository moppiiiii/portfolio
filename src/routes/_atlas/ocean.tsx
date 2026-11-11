import { createFileRoute } from '@tanstack/react-router'

import { OceanLabel, SPECIES } from '#/features/atlas/ocean-label'
import { pageHead } from '#/lib/seo'

/** The kinds in the tank, in words: 'whale shark, …, manta ray and green sea turtle'. */
const kinds = SPECIES.map((species) => species.name.toLowerCase())
const kindList = `${kinds.slice(0, -1).join(', ')} and ${kinds.at(-1)}`

export const Route = createFileRoute('/_atlas/ocean')({
  staticData: { atlasPage: 'ocean' },
  head: () =>
    pageHead({
      title: 'Ocean',
      description: `A large tank of sea creatures drawn in characters, swimming in real time: ${kindList}.`,
      path: '/ocean',
    }),
  component: OceanLabel,
})
