import { getMinimumSegmentDistance } from "../../route-geometry"
import type { Obstacle } from "../../types"
import type { CopperSegment, Point } from "../model/internal-types"

/** Test a copper centerline against a rotated rectangular obstacle plus inflation. */
export const segmentTouchesInflatedObstacle = (
  segment: CopperSegment,
  obstacle: Obstacle,
  inflation: number,
): boolean => {
  const rotateIntoObstacle = (point: Point): Point => {
    const radians = (-(obstacle.ccwRotationDegrees ?? 0) * Math.PI) / 180
    const dx = point.x - obstacle.center.x
    const dy = point.y - obstacle.center.y
    return {
      x: dx * Math.cos(radians) - dy * Math.sin(radians),
      y: dx * Math.sin(radians) + dy * Math.cos(radians),
    }
  }
  const start = rotateIntoObstacle(segment.start)
  const end = rotateIntoObstacle(segment.end)
  const halfWidth = obstacle.width / 2 + inflation
  const halfHeight = obstacle.height / 2 + inflation
  if (
    (Math.abs(start.x) <= halfWidth && Math.abs(start.y) <= halfHeight) ||
    (Math.abs(end.x) <= halfWidth && Math.abs(end.y) <= halfHeight)
  )
    return true
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ]
  return corners.some(
    (corner, index) =>
      getMinimumSegmentDistance(
        start,
        end,
        corner,
        corners[(index + 1) % corners.length]!,
      ) <= 1e-7,
  )
}
