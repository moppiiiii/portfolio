import { Moon, Sun } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useEffect, useSyncExternalStore } from 'react'

import type { Theme } from './theme'
import { currentTheme, followSystemTheme, switchTheme } from './theme'

/** Calls `onChange` whenever the theme class on <html> changes. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

/** The theme in use; undefined on the server, which cannot know it. */
function useTheme(): Theme | undefined {
  return useSyncExternalStore(subscribe, currentTheme, () => undefined)
}

/** Icons swap with a quarter turn as the theme changes. */
const ICON =
  'absolute size-3.5 transition-[opacity,rotate] duration-500 ease-out motion-reduce:transition-none'

/** Switches to the other theme, spreading it from the middle of the clicked button. */
function toggle(event: MouseEvent<HTMLButtonElement>) {
  const box = event.currentTarget.getBoundingClientRect()
  switchTheme(currentTheme() === 'dark' ? 'light' : 'dark', {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  })
}

/**
 * One icon button that toggles the dark theme: a moon on the light theme, a sun on the dark one.
 * Which icon shows comes from the CSS (`dark:`), so the server-rendered page is already right
 * before this hydrates. The new theme spreads out from the button.
 */
export function ThemeSwitch() {
  const theme = useTheme()
  useEffect(() => followSystemTheme(), [])

  return (
    <button
      type="button"
      aria-label="Dark theme"
      aria-pressed={theme && theme === 'dark'}
      onClick={toggle}
      className="relative -my-1 grid size-6 cursor-pointer place-items-center opacity-(--jelly-faint) transition-opacity hover:opacity-100"
    >
      <Moon
        aria-hidden="true"
        strokeWidth={1.5}
        className={`${ICON} rotate-0 opacity-100 dark:-rotate-90 dark:opacity-0`}
      />
      <Sun
        aria-hidden="true"
        strokeWidth={1.5}
        className={`${ICON} rotate-90 opacity-0 dark:rotate-0 dark:opacity-100`}
      />
    </button>
  )
}
