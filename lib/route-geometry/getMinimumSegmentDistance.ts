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
  const firstVector = {
    x: firstEnd.x - firstStart.x,
    y: firstEnd.y - firstStart.y,
  }
  const secondVector = {
    x: secondEnd.x - secondStart.x,
    y: secondEnd.y - secondStart.y,
  }
  const betweenStarts = {
    x: secondStart.x - firstStart.x,
    y: secondStart.y - firstStart.y,
  }
  const cross = (left: Point2D, right: Point2D): number =>
    left.x * right.y - left.y * right.x
  const denominator = cross(firstVector, secondVector)
  const firstLength = Math.hypot(firstVector.x, firstVector.y)
  const secondLength = Math.hypot(secondVector.x, secondVector.y)
  const scale = firstLength * secondLength + 1
  const intersectionEpsilon = scale * 1e-12
  if (Math.abs(denominator) > intersectionEpsilon) {
    const firstProgress = cross(betweenStarts, secondVector) / denominator
    const secondProgress = cross(betweenStarts, firstVector) / denominator
    if (
      firstProgress >= -1e-12 &&
      firstProgress <= 1 + 1e-12 &&
      secondProgress >= -1e-12 &&
      secondProgress <= 1 + 1e-12
    )
      return 0
  } else if (
    firstLength > 1e-12 &&
    Math.abs(cross(betweenStarts, firstVector)) <= intersectionEpsilon
  ) {
    const useX = Math.abs(firstVector.x) >= Math.abs(firstVector.y)
    const firstMinimum = Math.min(
      useX ? firstStart.x : firstStart.y,
      useX ? firstEnd.x : firstEnd.y,
    )
    const firstMaximum = Math.max(
      useX ? firstStart.x : firstStart.y,
      useX ? firstEnd.x : firstEnd.y,
    )
    const secondMinimum = Math.min(
      useX ? secondStart.x : secondStart.y,
      useX ? secondEnd.x : secondEnd.y,
    )
    const secondMaximum = Math.max(
      useX ? secondStart.x : secondStart.y,
      useX ? secondEnd.x : secondEnd.y,
    )
    if (
      Math.max(firstMinimum, secondMinimum) <=
      Math.min(firstMaximum, secondMaximum) + 1e-12
    )
      return 0
  }
  return Math.min(
    pointToSegmentDistance(firstStart, secondStart, secondEnd),
    pointToSegmentDistance(firstEnd, secondStart, secondEnd),
    pointToSegmentDistance(secondStart, firstStart, firstEnd),
    pointToSegmentDistance(secondEnd, firstStart, firstEnd),
  )
}
