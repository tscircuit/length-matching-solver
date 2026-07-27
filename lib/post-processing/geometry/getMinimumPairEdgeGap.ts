import { getMinimumSegmentDistance } from "../../route-geometry"
import type { ParsedTrace } from "../model/internal-types"

/** Measure the final minimum edge-to-edge spacing between paired wire segments. */
export const getMinimumPairEdgeGap = (
  first: ParsedTrace,
  second: ParsedTrace,
): number => {
  let minimumGap = Number.POSITIVE_INFINITY
  for (const firstSegment of first.segments) {
    for (const secondSegment of second.segments) {
      if (firstSegment.layer !== secondSegment.layer) continue
      const centerlineDistance = getMinimumSegmentDistance(
        firstSegment.start,
        firstSegment.end,
        secondSegment.start,
        secondSegment.end,
      )
      minimumGap = Math.min(
        minimumGap,
        centerlineDistance - firstSegment.width / 2 - secondSegment.width / 2,
      )
    }
  }
  if (!Number.isFinite(minimumGap))
    throw new Error(
      "PostProcessingSolver: paired traces have no common-layer wire geometry",
    )
  return minimumGap
}
