import type { RoutePoint } from "../types"

/** Return the Euclidean length of a same-layer or multi-layer route segment. */
export const getSegmentLength = (start: RoutePoint, end: RoutePoint): number =>
  Math.hypot(end.x - start.x, end.y - start.y)
