import { createFileRoute } from '@tanstack/react-router'

import { ContentsList } from '#/features/atlas/contents-list'

export const Route = createFileRoute('/_atlas/plates/')({
  staticData: { atlasPage: 'contents' },
  head: () => ({ meta: [{ title: 'Contents' }] }),
  component: ContentsList,
})
