import { createRouter as createTanStackRouter } from '@tanstack/react-router'

import { ErrorPage } from './features/atlas/error-page'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Shown in place of any page that fails, instead of the router's plain message.
    defaultErrorComponent: ErrorPage,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
