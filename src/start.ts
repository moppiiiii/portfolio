import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

/**
 * Server functions are same-origin endpoints. This middleware rejects calls to them that come
 * from other sites, as TanStack Start recommends.
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}))
