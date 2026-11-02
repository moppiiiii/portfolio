import { createFileRoute } from '@tanstack/react-router'

import { OceanLabel } from '#/features/atlas/ocean-label'

export const Route = createFileRoute('/_atlas/ocean')({
  staticData: { atlasPage: 'ocean' },
  head: () => ({ meta: [{ title: 'Ocean' }] }),
  component: OceanLabel,
})
