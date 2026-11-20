import type { Point } from "../model/internal-types"

export const isInlineTerminalPair = (
  first: Point,
  second: Point,
  spineNormal: Point,
): boolean => {
  const deltaX = first.x - second.x
  const deltaY = first.y - second.y
  const separation = Math.hypot(deltaX, deltaY)
  return (
    separation > 1e-8 &&
    Math.abs(deltaX * spineNormal.x + deltaY * spineNormal.y) / separation < 0.5
  )
}
