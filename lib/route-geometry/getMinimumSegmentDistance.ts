import { doSegmentsIntersect } from "@tscircuit/math-utils"

type Point2D = { readonly x: number; readonly y: number }

/** Return the minimum planar clearance between two closed line segments. */
export const getMinimumSegmentDistance = (
  firstStart: Point2D,
  firstEnd: Point2D,
  secondStart: Point2D,
  secondEnd: Point2D,
): number => {
  const pointToSegmentDistance = (
    point: Point2D,
    segmentStart: Point2D,
    segmentEnd: Point2D,
  ): number => {
    const segment = {
      x: segmentEnd.x - segmentStart.x,
      y: segmentEnd.y - segmentStart.y,
    }
    const fromStart = {
      x: point.x - segmentStart.x,
      y: point.y - segmentStart.y,
    }
    const segmentLengthSquared = segment.x ** 2 + segment.y ** 2
    const projection =
      segmentLengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              (fromStart.x * segment.x + fromStart.y * segment.y) /
                segmentLengthSquared,
            ),
          )
    return Math.hypot(
      point.x - (segmentStart.x + projection * segment.x),
      point.y - (segmentStart.y + projection * segment.y),
    )
  }
  if (doSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
    return 0
  }
  return Math.min(
    pointToSegmentDistance(firstStart, secondStart, secondEnd),
    pointToSegmentDistance(firstEnd, secondStart, secondEnd),
    pointToSegmentDistance(secondStart, firstStart, firstEnd),
    pointToSegmentDistance(secondEnd, firstStart, firstEnd),
  )
}
