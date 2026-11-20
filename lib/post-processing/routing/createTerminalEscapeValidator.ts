import type { SearchGeometryValidator } from "../geometry/createSearchGeometryValidator"
import type { Point } from "../model/internal-types"
import type { CoupledPathPoint } from "./types"

/** Keep the search edges aligned with the validated leads at the pad stations. */
export const createTerminalEscapeValidator = (
  validator: SearchGeometryValidator,
  [start, end]: [CoupledPathPoint, CoupledPathPoint],
  directions: { startDirection: Point; endDirection: Point },
): SearchGeometryValidator => {
  const samePoint = (point: Point, target: Point): boolean =>
    point.x === target.x && point.y === target.y
  const matchesDirection = (edge: Point, heading: Point): boolean => {
    const length = Math.hypot(edge.x, edge.y)
    return (
      length > 1e-8 &&
      (edge.x * heading.x + edge.y * heading.y) / length >= 1 - 1e-8
    )
  }
  return {
    ...validator,
    isEdgeValid: (from, to) => {
      const direction = { x: to.x - from.x, y: to.y - from.y }
      if (
        (from.layer === start.layer &&
          samePoint(from, start) &&
          !matchesDirection(direction, directions.startDirection)) ||
        (to.layer === end.layer &&
          samePoint(to, end) &&
          !matchesDirection(direction, directions.endDirection))
      )
        return false
      return validator.isEdgeValid(from, to)
    },
    isViaValid: (point, toLayer, direction) => {
      if (
        toLayer === end.layer &&
        samePoint(point, end) &&
        !matchesDirection(direction, directions.endDirection)
      )
        return false
      return validator.isViaValid(point, toLayer, direction)
    },
  }
}
