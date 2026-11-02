import type { Rect } from './renderer'

/**
 * Elements whose whole box counts as text, such as a row of leader dots cut off by
 * `overflow: hidden`, where the text itself would reach past what is shown.
 */
export const TEXT_BOX_ATTRIBUTE = 'data-water-text-box'
/** Text never seen on screen. */
const UNSEEN = '.sr-only'
/**
 * Text counts only while it can be seen: not hidden, and not fully transparent, such as a page
 * waiting to fade in while the camera is still on its way.
 */
const SEEN: CheckVisibilityOptions = {
  visibilityProperty: true,
  opacityProperty: true,
}

/**
 * Returns a function that lists where the text inside `root` sits on screen right now, one rect
 * per line of each text node, in viewport px. It is meant to run every frame, so that the water
 * under the text follows it through scrolling, page changes and settling animations.
 */
export function textRectsIn(root: Element): () => readonly Rect[] {
  const range = document.createRange()
  const rects: Rect[] = []
  const add = (box: DOMRect) => {
    if (box.width > 0 && box.height > 0) {
      rects.push({
        x: box.left,
        y: box.top,
        width: box.width,
        height: box.height,
      })
    }
  }

  return () => {
    rects.length = 0
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement
      if (!parent || !node.nodeValue?.trim()) continue
      if (parent.closest(`${UNSEEN}, [${TEXT_BOX_ATTRIBUTE}]`)) continue
      if (!parent.checkVisibility(SEEN)) continue
      range.selectNodeContents(node)
      for (const box of range.getClientRects()) add(box)
    }
    for (const element of root.querySelectorAll(`[${TEXT_BOX_ATTRIBUTE}]`)) {
      if (element.checkVisibility(SEEN)) {
        add(element.getBoundingClientRect())
      }
    }
    return rects
  }
}
