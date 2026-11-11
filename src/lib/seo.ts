/**
 * What search engines and link previews (Open Graph, X cards) are told about each page.
 *
 * SITE_URL is the site's public address. public/robots.txt and public/sitemap.xml repeat it, so a
 * move to another domain changes all three.
 */
export const SITE_URL = 'https://portfolio.tnktmhssrc.workers.dev'

/** The author's name, as in `atlasText.author` (works.server.ts, which pages cannot import). */
export const SITE_NAME = 'Tomohisa Tanaka'

/** The home page's description, also the fallback for any page without one of its own. */
export const SITE_DESCRIPTION =
  'Portfolio of Tomohisa Tanaka (inenico), a full-stack engineer who builds web services for both businesses and consumers, from the interface to the server.'

/** The picture shown when a page is shared: the aquarium map of the home page. */
const SHARE_IMAGE = {
  path: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'The home page of Tomohisa Tanaka’s portfolio: an aquarium floor plan with tanks of sea creatures drawn in characters.',
}

/** Meta tags every page shares; a page's own tags replace those of the same name. */
export function siteHead() {
  const image = new URL(SHARE_IMAGE.path, SITE_URL).href
  return {
    meta: [
      { name: 'description', content: SITE_DESCRIPTION },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: String(SHARE_IMAGE.width) },
      { property: 'og:image:height', content: String(SHARE_IMAGE.height) },
      { property: 'og:image:alt', content: SHARE_IMAGE.alt },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }
}

/**
 * One page's title, description and address, for search results and link previews. The title is
 * followed by the author's name; leave it out for the home page, which is titled with the name
 * alone. The canonical link is set only here, by the page itself, so there is never more than one.
 */
export function pageHead({
  title,
  description,
  path,
}: {
  title?: string
  description: string
  /** The page's address on the site, such as '/about'. */
  path: string
}) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME
  const url = new URL(path, SITE_URL).href
  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: description },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}

/** For a page that should stay out of search results, such as the not-found page. */
export function hiddenPageHead(title: string) {
  return {
    meta: [
      { title: `${title} — ${SITE_NAME}` },
      { name: 'robots', content: 'noindex' },
    ],
  }
}
