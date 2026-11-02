import { useEffect, useRef, useState } from 'react'

/** Characters text passes through while settling: the same weights the jellyfish are drawn in. */
const GLYPHS = '.:-=+*tosxzXS%8&@#'
/** Seconds for the whole text to settle. */
const SETTLE_TIME = 0.7

/**
 * Text that settles into place from random ASCII characters, left to right, whenever it changes
 * (and on mount with `settleOnMount`). The server and the first render show the text as is, and
 * screen readers only ever get the final text.
 */
export function ScrambleText({
  text,
  className,
  settleOnMount = false,
}: {
  text: string
  className?: string
  settleOnMount?: boolean
}) {
  const [scrambled, setScrambled] = useState<string | null>(null)
  const settledText = useRef<string | null>(settleOnMount ? null : text)

  useEffect(() => {
    if (settledText.current === text) return
    settledText.current = text
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const start = performance.now()
    const settle = (now: number) => {
      const progress = (now - start) / 1000 / SETTLE_TIME
      if (progress >= 1) {
        setScrambled(null)
        return
      }
      const settledCount = Math.floor(progress * text.length)
      setScrambled(
        Array.from(text, (char, index) =>
          index < settledCount || char === ' '
            ? char
            : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        ).join(''),
      )
      frame = requestAnimationFrame(settle)
    }
    frame = requestAnimationFrame(settle)
    return () => cancelAnimationFrame(frame)
  }, [text])

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{scrambled ?? text}</span>
    </span>
  )
}
