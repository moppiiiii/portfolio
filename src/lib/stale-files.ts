/**
 * Each deploy gives the site's script files new names and removes the old ones. A tab opened
 * before a deploy then fails to load any page it has not loaded yet. These helpers spot that
 * failure and reload the page once, which fetches the new files and shows the page asked for.
 */

/** When the page was last reloaded for this (ms since the epoch), kept for the tab's session. */
const RELOADED_AT = 'stale-files-reloaded-at'
/** No second reload within this many ms of the last, so a site that is really down cannot loop. */
const RELOAD_GUARD = 10_000

/** The messages browsers give when a script file cannot be fetched: Chrome, Firefox, Safari, Vite. */
const STALE_FILE_MESSAGE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

/** Whether `error` means a script file of the site could not be fetched. */
export function isStaleFileError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return STALE_FILE_MESSAGE.test(message)
}

/**
 * Whether the page may reload for this now: not if it already did a moment ago. Without session
 * storage (or on the server) there is no way to tell, so it leaves the reload to the visitor.
 */
export function mayReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0)
    return Date.now() - last >= RELOAD_GUARD
  } catch {
    return false
  }
}

/** Reloads the page to fetch the new files, noting when, so it is not repeated straight away. */
export function reloadForNewFiles(): void {
  try {
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
  } catch {
    // mayReload() said yes, so storage works; nothing to do if it fails now.
  }
  window.location.reload()
}

/** Reloads the page if it may (see `mayReload`). Returns whether it reloads. */
export function reloadOnce(): boolean {
  if (!mayReload()) return false
  reloadForNewFiles()
  return true
}
