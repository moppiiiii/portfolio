import { TanStackDevtools } from '@tanstack/react-devtools'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import { THEME_SCRIPT } from '#/features/theme/theme'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      // Only for pages outside the atlas, such as a crash; every atlas page sets its own title.
      {
        title: 'Tomohisa Tanaka',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      // A smiling face. The ICO holds 16, 32 and 48 px images, transparent outside the face so it
      // reads on light and dark tabs alike.
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: '16x16 32x32 48x48',
      },
      // iOS fills transparency with black, so this one is on a white square.
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // The theme script below sets a class on <html> before React hydrates it.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme before the first paint, so the other theme never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
