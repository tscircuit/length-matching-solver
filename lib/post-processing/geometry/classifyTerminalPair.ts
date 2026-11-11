import type { Point } from "../model/internal-types"

/** Classify the two terminal wire ends relative to the pair's routing spine. */
export function classifyTerminalPair(
  first: Point,
  second: Point,
  normal: Point,
  combinedRadii: number,
): "inline" | "facing" | "staggered" {
  const dx = first.x - second.x
  const dy = first.y - second.y
  const separation = Math.hypot(dx, dy)
  const transverseSeparation = Math.abs(dx * normal.x + dy * normal.y)
  if (separation > 1e-8 && transverseSeparation / separation < 0.5)
    return "inline"

  // A transverse line can intersect both wire end caps when their projections
  // along the spine overlap. This also covers slightly staggered facing pads.
  const longitudinalSeparation = Math.abs(dx * normal.y - dy * normal.x)
  return longitudinalSeparation <= combinedRadii ? "facing" : "staggered"
}
