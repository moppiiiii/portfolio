import { useEffect, useState } from 'react'

import { useAtlas } from './atlas-context'
import { ScrambleText } from './scramble-text'

/** Seconds the author's name stays before the online name settles in, and the other way round. */
const NAME_HOLD = 5
const HANDLE_HOLD = 3

/**
 * The author's name, set large, taking turns with the online name (written with an @ so it reads
 * as an account name), each settling in from random characters. Visitors who ask for reduced
 * motion keep the author's name. Screen readers always get the author's name.
 */
export function AuthorName({
  as: Tag = 'h1',
  align = 'center',
  className,
}: {
  /** `p` where the name is not the page's heading. */
  as?: 'h1' | 'p'
  /** Whether the name sits centred or against the left edge. */
  align?: 'center' | 'start'
  className?: string
}) {
  const { atlas } = useAtlas()
  const names = [atlas.author.toUpperCase(), `@${atlas.handle}`]
  const [showHandle, setShowHandle] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const hold = showHandle ? HANDLE_HOLD : NAME_HOLD
    const timer = window.setTimeout(
      () => setShowHandle(!showHandle),
      hold * 1000,
    )
    return () => window.clearTimeout(timer)
  }, [showHandle])

  return (
    <Tag
      className={`grid items-center ${align === 'center' ? 'justify-items-center' : 'justify-items-start'} ${className ?? ''}`}
    >
      <span className="sr-only">{atlas.author}</span>
      {/* Both names, unseen, hold the room of the longer one, so nothing around it moves. */}
      {names.map((name) => (
        <span
          key={name}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1"
        >
          {name}
        </span>
      ))}
      <span aria-hidden="true" className="col-start-1 row-start-1">
        <ScrambleText text={names[showHandle ? 1 : 0]} settleOnMount />
      </span>
    </Tag>
  )
}
