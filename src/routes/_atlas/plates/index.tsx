import { createFileRoute } from '@tanstack/react-router'

import { ContentsList } from '#/features/atlas/contents-list'
import { SITE_NAME, pageHead } from '#/lib/seo'

export const Route = createFileRoute('/_atlas/plates/')({
  staticData: { atlasPage: 'contents' },
  head: () =>
    pageHead({
      title: 'Contents',
      description: `Works by ${SITE_NAME}, a full-stack engineer who builds web services.`,
      path: '/plates',
    }),
  component: ContentsList,
})
