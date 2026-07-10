import { getMinimumSegmentDistance } from "../route-geometry"
import type { HighDensityRoute, Obstacle, RoutePoint } from "../types"
import { getLogicalConnectionName } from "./connection-routes"

const isObstacleOnLayer = (
  obstacle: Obstacle,
  z: number,
  layerCount: number,
): boolean => {
  if (obstacle.zLayers) return obstacle.zLayers.includes(z)
  return obstacle.layers.some(
    (layer) =>
      (layer === "top" && z === 0) ||
      (layer === "bottom" && z === layerCount - 1) ||
      layer === `inner${z}`,
  )
}

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
  if ((start.x >= minX && start.x <= maxX && start.y >= minY && start.y <= maxY) || (end.x >= minX && end.x <= maxX && end.y >= minY && end.y <= maxY)) return true
  const corners = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }]
  return corners.some((corner, index) => getMinimumSegmentDistance(start, end, corner, corners[(index + 1) % corners.length]!) === 0)
}

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
  if (input.bounds && input.meanderPoints.some((point) => point.x < input.bounds!.minX || point.x > input.bounds!.maxX || point.y < input.bounds!.minY || point.y > input.bounds!.maxY)) return false
  const connectionName = getLogicalConnectionName(input.route)
  const obstacleMargin = input.route.traceThickness / 2 + input.obstacleMargin
  for (let index = 0; index < input.meanderPoints.length - 1; index++) {
    const start = input.meanderPoints[index]!
    const end = input.meanderPoints[index + 1]!
    for (const obstacle of input.obstacles) {
      if (!isObstacleOnLayer(obstacle, start.z, input.layerCount)) continue
      const isTerminalLead = index === 0 || index === input.meanderPoints.length - 2
      if (obstacle.connectedTo.includes(connectionName) && isTerminalLead) continue
      if (segmentTouchesInflatedObstacle(start, end, obstacle, obstacleMargin)) return false
    }
    for (const otherRoute of input.routedRoutes) {
      if (getLogicalConnectionName(otherRoute) === connectionName) continue
      for (let otherIndex = 0; otherIndex < otherRoute.route.length - 1; otherIndex++) {
        const otherStart = otherRoute.route[otherIndex]!
        const otherEnd = otherRoute.route[otherIndex + 1]!
        if (start.z !== otherStart.z || start.z !== otherEnd.z) continue
        const requiredDistance = input.route.traceThickness / 2 + otherRoute.traceThickness / 2 + input.obstacleMargin
        if (getMinimumSegmentDistance(start, end, otherStart, otherEnd) < requiredDistance) return false
      }
    }
  }
  return true
}
