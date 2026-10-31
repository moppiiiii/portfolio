import { createFileRoute } from '@tanstack/react-router'

import { JellyfishCanvas } from '#/features/jellyfish/jellyfish-canvas'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="jellyfish-stage relative h-dvh w-full overflow-hidden">
      <JellyfishCanvas className="absolute inset-0 size-full" />
    </main>
  )
}
