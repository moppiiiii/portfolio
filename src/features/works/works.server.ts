/**
 * Content of the atlas: the frontispiece text, the about page, and one plate per work.
 * Server-only: pages read it through the server functions in `works.functions.ts`.
 *
 * Images live in /public/images/plates. The works marked `draft` are placeholders, kept off the
 * site until real works replace them.
 */

/** A note written beside a work's picture, pointing at one part of it. */
export type PlateNote = {
  /** The point it describes, as shares of the picture's width and height (0 to 1). */
  x: number
  y: number
  text: string
}

export type Work = {
  /** Used in the work's URL: /plates/<slug>. */
  slug: string
  title: string
  /** One line, shown in the table of plates. */
  summary: string
  /** Paragraphs on the work's plate. */
  body: string[]
  year: string
  tools: string
  role: string
  /** Where the work can be seen, linked in its description. Left out when it is not public. */
  url?: string
  /** Main image, drawn in characters in the water. A screenshot works best. */
  image: string
  imageAlt: string
  notes: PlateNote[]
  /**
   * Kept off the site while true: the work's page answers not found, and it is left out of the
   * contents, the career page and the plate numbering. Set it on works that are not ready.
   */
  draft?: boolean
}

export const atlasText = {
  /** Written as in a sentence; the frontispiece and the about page set it in capitals. */
  author: 'Tomohisa Tanaka',
  /**
   * The name used online, without the @ that pages put before it. It takes turns with the
   * author's name on the frontispiece.
   */
  handle: 'inenico',
  /** Shown under the author's name on the frontispiece. */
  tagline: 'Full-stack engineer.',
  about: [
    "I'm a full-stack engineer. I build web services for both businesses and consumers, from the interface to the server.",
    'This site is an aquarium I made. Every creature in it is drawn in characters and swims in real time.',
  ],
  /** Places to find the author elsewhere, listed under the about page's text. */
  links: [{ label: 'github', href: 'https://github.com/moppiiiii' }],
}

/** One line of the career page: a place worked or studied at. */
export type CareerEntry = {
  /** When, written as it should read, such as '2021 — present'. */
  period: string
  /** Where: the company, studio or school, by its English name. */
  place: string
  /** The position held, or the degree. */
  title?: string
  /** A sentence or two on what was done there. */
  note?: string
  /** Slugs of the works made there, linked to their plates. */
  plates?: string[]
}

/** The career page, in sections (work, education, ...), newest first within each. */
export const career: { heading: string; entries: CareerEntry[] }[] = [
  {
    heading: 'Experience',
    entries: [
      { period: '2025 — present', place: 'Undisclosed' },
      { period: '2023 — 2025', place: 'YUMEMI Inc.' },
      { period: '2020 — 2023', place: 'Sky Co., Ltd.' },
    ],
  },
]

const body = [
  'Placeholder. Describe what the work is, why it was made, and your part in it.',
]

export const works: Work[] = [
  {
    slug: 'tsukizuki',
    title: 'Tsukizuki',
    summary:
      'Sort your subscriptions into folders and see what you pay each month.',
    body: [
      'A web app that keeps subscriptions as cards in folders. Opening a folder fans its cards out, each with its price, billing cycle and next payment date. Every folder shows its monthly total, and one button shows what all of them cost per month and per year, and which payment comes next.',
      'Each card wears one of 24 patterns drawn in code on a canvas, in its own colour and with its own random seed, so no two cards look the same.',
      'Nothing is sent to a server: the data stays in the browser. The app can be added to the home screen and opened like an installed app.',
    ],
    year: '2026',
    tools: 'TypeScript, React, TanStack Start, Canvas API, Cloudflare Workers',
    role: 'Design & development',
    url: 'https://tsukizuki.inenico.dev',
    // A screenshot with sample data, taken at 960×640.
    image: '/images/plates/tsukizuki.webp',
    imageAlt:
      'Tsukizuki with one folder open: its subscription cards fanned out above it, among five other folders.',
    notes: [
      { x: 0.245, y: 0.22, text: 'one card per subscription' },
      { x: 0.77, y: 0.275, text: 'next payment' },
      { x: 0.075, y: 0.888, text: 'monthly total per folder' },
    ],
  },
  {
    slug: 'placeholder-one',
    // A placeholder, kept off the site until a real work replaces it.
    draft: true,
    title: 'Untitled work I',
    summary: 'Placeholder — a one-line description of the work.',
    body,
    year: '20XX',
    tools: 'Tools (placeholder)',
    role: 'Role (placeholder)',
    image: '/images/plates/placeholder-1.svg',
    imageAlt: 'Placeholder sketch of a landing page',
    notes: [
      { x: 0.08, y: 0.05, text: 'navigation (placeholder)' },
      { x: 0.78, y: 0.35, text: 'hero image (placeholder)' },
      { x: 0.2, y: 0.78, text: 'cards (placeholder)' },
    ],
  },
  {
    slug: 'placeholder-two',
    // A placeholder, kept off the site until a real work replaces it.
    draft: true,
    title: 'Untitled work II',
    summary: 'Placeholder — a one-line description of the work.',
    body,
    year: '20XX',
    tools: 'Tools (placeholder)',
    role: 'Role (placeholder)',
    image: '/images/plates/placeholder-2.svg',
    imageAlt: 'Placeholder sketch of a dashboard',
    notes: [
      { x: 0.08, y: 0.25, text: 'sidebar (placeholder)' },
      { x: 0.8, y: 0.4, text: 'chart (placeholder)' },
      { x: 0.6, y: 0.88, text: 'table (placeholder)' },
    ],
  },
  {
    slug: 'placeholder-three',
    // A placeholder, kept off the site until a real work replaces it.
    draft: true,
    title: 'Untitled work III',
    summary: 'Placeholder — a one-line description of the work.',
    body,
    year: '20XX',
    tools: 'Tools (placeholder)',
    role: 'Role (placeholder)',
    image: '/images/plates/placeholder-3.svg',
    imageAlt: 'Placeholder sketch of three phone screens',
    notes: [
      { x: 0.22, y: 0.35, text: 'feed (placeholder)' },
      { x: 0.5, y: 0.5, text: 'list (placeholder)' },
      { x: 0.78, y: 0.35, text: 'progress (placeholder)' },
    ],
  },
  {
    slug: 'placeholder-four',
    // A placeholder, kept off the site until a real work replaces it.
    draft: true,
    title: 'Untitled work IV',
    summary: 'Placeholder — a one-line description of the work.',
    body,
    year: '20XX',
    tools: 'Tools (placeholder)',
    role: 'Role (placeholder)',
    image: '/images/plates/placeholder-4.svg',
    imageAlt: 'Placeholder sketch of a map app',
    notes: [
      { x: 0.2, y: 0.18, text: 'search panel (placeholder)' },
      { x: 0.7, y: 0.4, text: 'destination (placeholder)' },
      { x: 0.45, y: 0.72, text: 'route (placeholder)' },
    ],
  },
  {
    slug: 'placeholder-five',
    // A placeholder, kept off the site until a real work replaces it.
    draft: true,
    title: 'Untitled work V',
    summary: 'Placeholder — a one-line description of the work.',
    body,
    year: '20XX',
    tools: 'Tools (placeholder)',
    role: 'Role (placeholder)',
    image: '/images/plates/placeholder-5.svg',
    imageAlt: 'Placeholder sketch of an article page',
    notes: [
      { x: 0.3, y: 0.15, text: 'headline (placeholder)' },
      { x: 0.7, y: 0.5, text: 'figure (placeholder)' },
      { x: 0.3, y: 0.85, text: 'body text (placeholder)' },
    ],
  },
]
