import { createFileRoute } from '@tanstack/react-router'

import { AboutText } from '#/features/atlas/about-text'
import { SITE_NAME, pageHead } from '#/lib/seo'

export const Route = createFileRoute('/_atlas/about')({
  staticData: { atlasPage: 'about' },
  head: () =>
    pageHead({
      title: 'About',
      description: `About ${SITE_NAME} (inenico), a full-stack engineer who builds web services for both businesses and consumers.`,
      path: '/about',
    }),
  component: AboutText,
})
