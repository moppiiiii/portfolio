import { useEffect, useRef } from 'react'

import type { JellyfishVariant } from './scene'
import { startJellyfishScene } from './scene'

/**
 * Decorative full-bleed jellyfish animation. The server renders an empty canvas; the animation
 * starts in the browser after hydration.
 */
export function JellyfishCanvas({
  className,
  variant = 'ascii',
}: {
  className?: string
  variant?: JellyfishVariant
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return startJellyfishScene(canvas, variant)
  }, [variant])

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />
}
