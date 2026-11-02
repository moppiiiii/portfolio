import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_atlas/')({
  staticData: { atlasPage: 'frontispiece' },
  // Home is the aquarium's map, which the shared layout draws and moves on every page.
  component: () => null,
})
