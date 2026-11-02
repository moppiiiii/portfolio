export type Theme = 'light' | 'dark'

/** Where a visitor's chosen theme is kept between visits. */
const STORAGE_KEY = 'theme'
/** Class on <html> that turns on the dark theme, for this site's CSS and Tailwind's `dark:`. */
const DARK_CLASS = 'dark'

/**
 * Runs in <head> before the first paint, so the page never shows in the other theme first. It
 * takes the visitor's chosen theme, or else the OS setting. It must stay self-contained.
 */
export const THEME_SCRIPT = `(() => {
  let chosen = null
  try { chosen = localStorage.getItem('${STORAGE_KEY}') } catch {}
  const dark = chosen === 'dark' || (chosen !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('${DARK_CLASS}', dark)
})()`

/** Seconds for a new theme to spread over the whole screen. */
const TIDE_DURATION = 1.1
/** Steps the spreading edge is drawn in. */
const TIDE_FRAMES = 14
/** Points around the spreading edge. */
const TIDE_POINTS = 48
/** How far the edge strays from a circle, as a share of its radius. */
const TIDE_WOBBLE = 0.05

export function currentTheme(): Theme {
  return document.documentElement.classList.contains(DARK_CLASS)
    ? 'dark'
    : 'light'
}

/** The theme the visitor chose, or undefined while they follow the OS setting. */
function chosenTheme(): Theme | undefined {
  try {
    const chosen = localStorage.getItem(STORAGE_KEY)
    return chosen === 'light' || chosen === 'dark' ? chosen : undefined
  } catch {
    return undefined
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle(DARK_CLASS, theme === 'dark')
}

/**
 * Keeps the theme in step with the OS setting for visitors who have not chosen one. Returns a
 * function that stops it.
 */
export function followSystemTheme(): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (!chosenTheme()) applyTheme(query.matches ? 'dark' : 'light')
  }
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * Outline of the spreading theme at `progress` (0 to 1): a circle from `x`, `y` that reaches
 * every corner, with an uneven edge that shifts as it goes, like the ripples in the water.
 */
function tideOutline(x: number, y: number, reach: number, progress: number) {
  const radius = reach * progress
  const points: string[] = []
  for (let k = 0; k < TIDE_POINTS; k++) {
    const angle = (k / TIDE_POINTS) * Math.PI * 2
    const wobble =
      Math.sin(angle * 3 + progress * 4) * 0.6 +
      Math.sin(angle * 5 - progress * 6 + 1.3) * 0.4
    const r = radius * (1 + TIDE_WOBBLE * wobble)
    points.push(
      `${(x + Math.cos(angle) * r).toFixed(1)}px ${(y + Math.sin(angle) * r).toFixed(1)}px`,
    )
  }
  return `polygon(${points.join(', ')})`
}

/**
 * Switches to `next` and remembers the choice. Where the browser can, the new theme spreads out
 * from `origin` (viewport px) across the screen; with reduced motion it switches at once.
 */
export function switchTheme(next: Theme, origin: { x: number; y: number }) {
  if (currentTheme() === next) return
  const apply = () => {
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not remembered, but still switched.
    }
  }
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (still || !('startViewTransition' in document)) {
    apply()
    return
  }

  const transition = document.startViewTransition(apply)
  const width = document.documentElement.clientWidth
  const height = window.innerHeight
  // Far enough to pass the farthest corner even where the edge dips inwards.
  const reach =
    Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(width - origin.x, origin.y),
      Math.hypot(origin.x, height - origin.y),
      Math.hypot(width - origin.x, height - origin.y),
    ) /
    (1 - TIDE_WOBBLE)
  transition.ready
    .then(() =>
      document.documentElement.animate(
        {
          clipPath: Array.from({ length: TIDE_FRAMES }, (_, k) =>
            tideOutline(origin.x, origin.y, reach, k / (TIDE_FRAMES - 1)),
          ),
        },
        {
          duration: TIDE_DURATION * 1000,
          easing: 'cubic-bezier(0.25, 0.6, 0.3, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      ),
    )
    .catch(() => {
      // The transition was skipped; the theme has still switched.
    })
}
