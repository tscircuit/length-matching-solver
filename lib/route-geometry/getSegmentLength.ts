import type { RoutePoint } from "../types"

/**
 * Return the planar Euclidean length between two route points.
 */
export const getSegmentLength = (start: RoutePoint, end: RoutePoint): number =>
  Math.hypot(end.x - start.x, end.y - start.y)
