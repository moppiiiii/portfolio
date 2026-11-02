import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { toRoman } from '#/lib/roman'

import { atlasText, career, works } from './works.server'

/**
 * Everything every page of the atlas needs: its text, and one entry per plate (work). Plates are
 * numbered in the order of the works, as Roman numerals: PLATE I., PLATE II., ...
 */
export const getAtlas = createServerFn({ method: 'GET' }).handler(() => ({
  ...atlasText,
  plates: works.map((work, index) => ({
    slug: work.slug,
    title: work.title,
    summary: work.summary,
    year: work.year,
    role: work.role,
    tools: work.tools,
    /** The first paragraph of the work's description, shown cut short in the contents. */
    lead: work.body[0] ?? '',
    image: work.image,
    imageAlt: work.imageAlt,
    notes: work.notes,
    numeral: toRoman(index + 1),
  })),
}))

/** One work's plate in full. Unknown slugs become the not-found page. */
export const getPlate = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1).max(100) }))
  .handler(({ data }) => {
    const index = works.findIndex((work) => work.slug === data.slug)
    if (index === -1) throw notFound()
    return { ...works[index], numeral: toRoman(index + 1) }
  })

/** The career page: its sections, with the works of each entry resolved to their plates. */
export const getCareer = createServerFn({ method: 'GET' }).handler(() =>
  career.map((section) => ({
    heading: section.heading,
    entries: section.entries.map((entry) => ({
      ...entry,
      plates: (entry.plates ?? []).flatMap((slug) => {
        const index = works.findIndex((work) => work.slug === slug)
        return index === -1
          ? []
          : [{ slug, numeral: toRoman(index + 1), title: works[index].title }]
      }),
    })),
  })),
)
