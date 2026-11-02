import { useEffect, useLayoutEffect, useRef } from 'react'

import type { Rect, View } from './renderer'
import { IDENTITY_VIEW } from './renderer'
import type {
  JellyfishScene,
  JellyfishVariant,
  SceneFrame,
  SceneMode,
} from './scene'
import { startJellyfishScene } from './scene'

type Point = { x: number; y: number }

type JellyfishCanvasProps = {
  className?: string
  variant?: JellyfishVariant
  count?: number
  /** What the water is doing on this page. */
  mode?: SceneMode
  /** What the goldfish are doing on this page. */
  schoolMode?: SceneMode
  /** What the rays are doing on this page. */
  rayMode?: SceneMode
  /** URL of a picture to show in the water; null for none. */
  picture?: string | null
  /**
   * Called when the picture changes, to ask where its ripple should spread from (viewport px),
   * such as the link that was clicked. Without a point, the picture fades in instead.
   */
  takeRevealOrigin?: () => Point | undefined
  /** The area (viewport px) the picture should fill, read every frame. */
  getPictureFrame?: () => Rect | undefined
  /** Where page text lies over the canvas (viewport px), read every frame. */
  getTextRects?: () => readonly Rect[]
  /** Where the jellyfish's water appears on the canvas, read every frame; the whole canvas if absent. */
  getView?: () => View
  /** Where the goldfish's tank appears on the canvas, read every frame; no goldfish if absent. */
  getSchoolView?: () => View | undefined
  /** Where the rays' tank appears on the canvas, read every frame; no rays if absent. */
  getRayView?: () => View | undefined
  /** Where the big ocean tank appears on the canvas, read every frame; none if absent. */
  getOceanView?: () => View | undefined
  /**
   * Changing this redraws a still frame (reduced motion), for changes the scene cannot see
   * itself, such as the camera moving to another place.
   */
  redrawKey?: string
  /** Called after every drawn frame, with where overlays should go. */
  onFrame?: (frame: SceneFrame) => void
}

/**
 * Full-bleed jellyfish animation. The server renders an empty canvas; the animation starts in the
 * browser after hydration. Keep it mounted across pages so the jellyfish never stop.
 */
export function JellyfishCanvas({
  className,
  variant = 'ascii',
  count = 5,
  mode = 'open',
  schoolMode = 'open',
  rayMode = 'open',
  picture = null,
  takeRevealOrigin,
  getPictureFrame,
  getTextRects,
  getView,
  getSchoolView,
  getRayView,
  getOceanView,
  redrawKey,
  onFrame,
}: JellyfishCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<JellyfishScene | null>(null)
  // The latest props, read by the running scene, so changing them does not restart it.
  const latest = useRef({
    onFrame,
    mode,
    picture,
    takeRevealOrigin,
    getPictureFrame,
    getTextRects,
    getView,
    getSchoolView,
    schoolMode,
    getRayView,
    rayMode,
    getOceanView,
  })
  useLayoutEffect(() => {
    latest.current = {
      onFrame,
      mode,
      picture,
      takeRevealOrigin,
      getPictureFrame,
      getTextRects,
      getView,
      getSchoolView,
      schoolMode,
      getRayView,
      rayMode,
      getOceanView,
    }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = startJellyfishScene(canvas, {
      variant,
      count,
      getPictureFrame: () => latest.current.getPictureFrame?.(),
      getTextRects: () => latest.current.getTextRects?.() ?? [],
      getView: () => latest.current.getView?.() ?? IDENTITY_VIEW,
      getSchoolView: () => latest.current.getSchoolView?.(),
      getRayView: () => latest.current.getRayView?.(),
      getOceanView: () => latest.current.getOceanView?.(),
      onFrame: (frame) => latest.current.onFrame?.(frame),
    })
    scene.setMode(latest.current.mode)
    scene.setSchoolMode(latest.current.schoolMode)
    scene.setRayMode(latest.current.rayMode)
    scene.setPicture(latest.current.picture)
    sceneRef.current = scene
    return () => {
      scene.stop()
      sceneRef.current = null
    }
  }, [variant, count])

  useEffect(() => {
    sceneRef.current?.setMode(mode)
  }, [mode])

  useEffect(() => {
    sceneRef.current?.setSchoolMode(schoolMode)
  }, [schoolMode])

  useEffect(() => {
    sceneRef.current?.setRayMode(rayMode)
  }, [rayMode])

  useEffect(() => {
    sceneRef.current?.setPicture(picture, latest.current.takeRevealOrigin?.())
  }, [picture])

  useEffect(() => {
    sceneRef.current?.refresh()
  }, [redrawKey])

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />
}
