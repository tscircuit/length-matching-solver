import { getMinimumSegmentDistance } from "../../route-geometry"
import { getObstacleLayerIndexes } from "../../obstacles/getObstacleLayerIndexes"
import { normalizeOvalObstacles } from "../../obstacles/normalizeOvalObstacles"
import type { HighDensityRoute, Obstacle, RoutePoint } from "../../types"
import { getLogicalConnectionName } from "../connection-routes"

/** Check candidate bounds, obstacle clearance, and clearance from other connections. */
export const isCandidateGeometryValid = (input: {
  route: HighDensityRoute
  meanderPoints: RoutePoint[]
  routedRoutes: HighDensityRoute[]
  obstacles: Obstacle[]
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  obstacleMargin: number
}): boolean => {
  const segmentTouchesInflatedObstacle = (
    start: RoutePoint,
    end: RoutePoint,
    obstacle: Obstacle,
    margin: number,
  ): boolean => {
    const minX = obstacle.center.x - obstacle.width / 2 - margin
    const maxX = obstacle.center.x + obstacle.width / 2 + margin
    const minY = obstacle.center.y - obstacle.height / 2 - margin
    const maxY = obstacle.center.y + obstacle.height / 2 + margin
    if (
      (start.x >= minX &&
        start.x <= maxX &&
        start.y >= minY &&
        start.y <= maxY) ||
      (end.x >= minX && end.x <= maxX && end.y >= minY && end.y <= maxY)
    )
      return true
    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ]
    return corners.some(
      (corner, index) =>
        getMinimumSegmentDistance(
          start,
          end,
          corner,
          corners[(index + 1) % corners.length]!,
        ) === 0,
    )
  }
  if (
    input.bounds &&
    input.meanderPoints.some(
      (point) =>
        point.x < input.bounds!.minX ||
        point.x > input.bounds!.maxX ||
        point.y < input.bounds!.minY ||
        point.y > input.bounds!.maxY,
    )
  )
    return false
  const pointToSegmentDistance = (
    point: { x: number; y: number },
    start: RoutePoint,
    end: RoutePoint,
  ): number => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const progress =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point.x - start.x) * dx + (point.y - start.y) * dy) /
                lengthSquared,
            ),
          )
    return Math.hypot(
      point.x - (start.x + progress * dx),
      point.y - (start.y + progress * dy),
    )
  }
  const connectionName = getLogicalConnectionName(input.route)
  const obstacleMargin = input.route.traceThickness / 2 + input.obstacleMargin
  const obstacles = normalizeOvalObstacles(input.obstacles)
  for (let index = 0; index < input.meanderPoints.length - 1; index++) {
    const start = input.meanderPoints[index]!
    const end = input.meanderPoints[index + 1]!
    for (const obstacle of obstacles) {
      if (
        !getObstacleLayerIndexes(obstacle, input.layerCount).includes(start.z)
      )
        continue
      const isTerminalLead =
        index === 0 || index === input.meanderPoints.length - 2
      if (obstacle.connectedTo.includes(connectionName) && isTerminalLead)
        continue
      if (segmentTouchesInflatedObstacle(start, end, obstacle, obstacleMargin))
        return false
    }
    for (const otherRoute of input.routedRoutes) {
      const sameConnection =
        getLogicalConnectionName(otherRoute) === connectionName
      for (const via of otherRoute.vias) {
        if (via.zLayers && !via.zLayers.includes(start.z)) continue
        const touchesSegmentEndpoint =
          Math.hypot(via.x - start.x, via.y - start.y) <= 1e-8 ||
          Math.hypot(via.x - end.x, via.y - end.y) <= 1e-8
        const requiredDistance =
          input.route.traceThickness / 2 +
          otherRoute.viaDiameter / 2 +
          input.obstacleMargin
        if (
          !(sameConnection && touchesSegmentEndpoint) &&
          pointToSegmentDistance(via, start, end) < requiredDistance
        )
          return false
      }
      if (sameConnection) continue
      for (
        let otherIndex = 0;
        otherIndex < otherRoute.route.length - 1;
        otherIndex++
      ) {
        const otherStart = otherRoute.route[otherIndex]!
        const otherEnd = otherRoute.route[otherIndex + 1]!
        if (start.z !== otherStart.z || start.z !== otherEnd.z) continue
        const requiredDistance =
          input.route.traceThickness / 2 +
          otherRoute.traceThickness / 2 +
          input.obstacleMargin
        if (
          getMinimumSegmentDistance(start, end, otherStart, otherEnd) <
          requiredDistance
        )
          return false
      }
    }
  }
  return true
}
