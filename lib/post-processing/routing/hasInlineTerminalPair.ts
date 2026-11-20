import type { Point } from "../model/internal-types"

export function hasInlineTerminalPair(
  terminals: [Point, Point],
  spineNormal: Point,
): boolean {
  const [first, second] = terminals
  const dx = first.x - second.x
  const dy = first.y - second.y
  const separation = Math.hypot(dx, dy)
  return separation > 1e-8 &&
    Math.abs(dx * spineNormal.x + dy * spineNormal.y) / separation < 0.5
}
