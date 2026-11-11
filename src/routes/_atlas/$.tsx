import { createFileRoute, notFound } from '@tanstack/react-router'

import { MissingPage } from '#/features/atlas/missing-page'
import { hiddenPageHead } from '#/lib/seo'

/**
 * Every address that is not a page of the atlas. It is answered with a 404 status and shown in the
 * water like any other page, rather than on a blank one.
 */
export const Route = createFileRoute('/_atlas/$')({
  loader: () => {
    throw notFound()
  },
  head: () => hiddenPageHead('Not found'),
  notFoundComponent: MissingPage,
})
