import { getMinimumSegmentDistance } from "../../route-geometry"
import type { HighDensityRoute, RoutePoint } from "../../types"

/** Measure the length-weighted distance-range violation of a proposed meander. */
export const getMeanderCenterlineDistanceCost = (input: {
  meanderPoints: RoutePoint[]
  pairedRoutes: HighDensityRoute[]
  minimumCenterlineDistance?: number
  maximumCenterlineDistance?: number
}): number => {
  const sampleCount = 4
  let totalSegmentLength = 0
  let weightedDistanceCost = 0
  for (let index = 0; index < input.meanderPoints.length - 1; index++) {
    const start = input.meanderPoints[index]!
    const end = input.meanderPoints[index + 1]!
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y)
    if (segmentLength === 0) continue
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
      const progress = (sampleIndex + 0.5) / sampleCount
      const point = {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      }
      const centerlineDistances = input.pairedRoutes.flatMap((route) =>
        route.route.slice(0, -1).flatMap((otherStart, otherIndex) => {
          const otherEnd = route.route[otherIndex + 1]!
          return start.z === otherStart.z && start.z === otherEnd.z
            ? [getMinimumSegmentDistance(point, point, otherStart, otherEnd)]
            : []
        }),
      )
      if (centerlineDistances.length === 0)
        throw new Error(
          "LengthMatchingSolver: cannot measure meander centerline distance without paired same-layer geometry",
        )
      const nearestDistance = Math.min(...centerlineDistances)
      const distanceCost = Math.max(
        0,
        (input.minimumCenterlineDistance ?? Number.NEGATIVE_INFINITY) -
          nearestDistance,
        nearestDistance -
          (input.maximumCenterlineDistance ?? Number.POSITIVE_INFINITY),
      )
      weightedDistanceCost += (segmentLength * distanceCost) / sampleCount
    }
    totalSegmentLength += segmentLength
  }
  if (totalSegmentLength === 0)
    throw new Error(
      "LengthMatchingSolver: cannot measure a zero-length meander centerline",
    )
  return weightedDistanceCost / totalSegmentLength
}
