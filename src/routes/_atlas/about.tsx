import { createFileRoute } from '@tanstack/react-router'

import { AboutText } from '#/features/atlas/about-text'

export const Route = createFileRoute('/_atlas/about')({
  staticData: { atlasPage: 'about' },
  head: () => ({ meta: [{ title: 'About' }] }),
  component: AboutText,
})
