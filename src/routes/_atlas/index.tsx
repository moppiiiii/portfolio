import { createFileRoute } from '@tanstack/react-router'

import { SITE_DESCRIPTION, pageHead } from '#/lib/seo'

export const Route = createFileRoute('/_atlas/')({
  staticData: { atlasPage: 'frontispiece' },
  head: () => pageHead({ description: SITE_DESCRIPTION, path: '/' }),
  // Home is the aquarium's map, which the shared layout draws and moves on every page.
  component: () => null,
})
