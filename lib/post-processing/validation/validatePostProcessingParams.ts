import { getObstacleLayerIndexes } from "../../obstacles/getObstacleLayerIndexes"
import { resolvePostProcessingGridConfig } from "../routing/resolvePostProcessingGridConfig"
import type { PostProcessingSolverParams } from "../types"

/** Validate only the basic shape and numeric safety of native input. */
export function validatePostProcessingParams(
  params: PostProcessingSolverParams,
): void {
  if (!params || typeof params !== "object")
    throw new Error("PostProcessingSolver: params must be an object")
  if (!Array.isArray(params.hdRoutes))
    throw new Error("PostProcessingSolver: hdRoutes must be an array")
  if (!Array.isArray(params.differentialPairs))
    throw new Error("PostProcessingSolver: differentialPairs must be an array")
  if (!Array.isArray(params.obstacles))
    throw new Error("PostProcessingSolver: obstacles must be an array")
  if (!Number.isInteger(params.layerCount) || params.layerCount < 1)
    throw new Error(
      "PostProcessingSolver: layerCount must be a positive integer",
    )

  for (const obstacle of params.obstacles) {
    if (
      !obstacle ||
      typeof obstacle !== "object" ||
      obstacle.type !== "rect" ||
      !obstacle.center ||
      !Number.isFinite(obstacle.center.x) ||
      !Number.isFinite(obstacle.center.y) ||
      !Number.isFinite(obstacle.width) ||
      obstacle.width <= 0 ||
      !Number.isFinite(obstacle.height) ||
      obstacle.height <= 0 ||
      !Array.isArray(obstacle.layers) ||
      obstacle.layers.some((layer) => typeof layer !== "string") ||
      !Array.isArray(obstacle.connectedTo) ||
      obstacle.connectedTo.some(
        (connectionName) =>
          typeof connectionName !== "string" || connectionName.length === 0,
      ) ||
      (obstacle.ccwRotationDegrees !== undefined &&
        !Number.isFinite(obstacle.ccwRotationDegrees))
    )
      throw new Error("PostProcessingSolver: obstacle declaration is invalid")
    getObstacleLayerIndexes(obstacle, params.layerCount)
  }
  const { minX, maxX, minY, maxY } = params.bounds ?? {}
  if (
    ![minX, maxX, minY, maxY].every(Number.isFinite) ||
    minX >= maxX ||
    minY >= maxY
  )
    throw new Error(
      "PostProcessingSolver: bounds must have finite positive extents",
    )
  for (const route of params.hdRoutes) {
    if (
      !route ||
      typeof route !== "object" ||
      typeof route.connectionName !== "string" ||
      route.connectionName.length === 0 ||
      (route.rootConnectionName !== undefined &&
        (typeof route.rootConnectionName !== "string" ||
          route.rootConnectionName.length === 0)) ||
      !Number.isFinite(route.traceThickness) ||
      route.traceThickness <= 0 ||
      !Number.isFinite(route.viaDiameter) ||
      route.viaDiameter < 0 ||
      !Array.isArray(route.route) ||
      !Array.isArray(route.vias) ||
      (route.jumpers !== undefined && !Array.isArray(route.jumpers))
    )
      throw new Error("PostProcessingSolver: HD route declaration is invalid")
    if (
      (route.startPcbPortId !== undefined &&
        (typeof route.startPcbPortId !== "string" ||
          route.startPcbPortId.length === 0)) ||
      (route.endPcbPortId !== undefined &&
        (typeof route.endPcbPortId !== "string" ||
          route.endPcbPortId.length === 0))
    )
      throw new Error(
        `PostProcessingSolver: HD route "${route.connectionName}" has invalid terminal metadata`,
      )
    for (const point of route.route) {
      if (
        !point ||
        typeof point !== "object" ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isInteger(point.z) ||
        point.z < 0 ||
        point.z >= params.layerCount ||
        (point.traceThickness !== undefined &&
          (!Number.isFinite(point.traceThickness) || point.traceThickness <= 0))
      )
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" has an invalid route point`,
        )
    }
    for (const via of route.vias) {
      if (
        !via ||
        typeof via !== "object" ||
        !Number.isFinite(via.x) ||
        !Number.isFinite(via.y) ||
        (via.zLayers !== undefined &&
          (!Array.isArray(via.zLayers) ||
            via.zLayers.some(
              (z) => !Number.isInteger(z) || z < 0 || z >= params.layerCount,
            )))
      )
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" has an invalid via`,
        )
    }
    if (route.vias.length > 0 && route.viaDiameter <= 0)
      throw new Error(
        `PostProcessingSolver: HD route "${route.connectionName}" has a non-positive via diameter`,
      )
    for (const jumper of route.jumpers ?? []) {
      if (
        !jumper ||
        typeof jumper !== "object" ||
        jumper.route_type !== "jumper" ||
        !Number.isFinite(jumper.start?.x) ||
        !Number.isFinite(jumper.start?.y) ||
        !Number.isFinite(jumper.end?.x) ||
        !Number.isFinite(jumper.end?.y) ||
        !["0603", "1206", "1206x4_pair"].includes(jumper.footprint)
      )
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" has an invalid jumper`,
        )
    }
  }

  const declaredConnections = new Set<string>()
  for (const pair of params.differentialPairs) {
    if (
      !pair ||
      typeof pair !== "object" ||
      !Array.isArray(pair.connectionNames) ||
      pair.connectionNames.length !== 2 ||
      pair.connectionNames[0] === pair.connectionNames[1] ||
      !pair.connectionNames.every(
        (name) => typeof name === "string" && name.length > 0,
      ) ||
      !Number.isFinite(pair.lengthTolerance) ||
      pair.lengthTolerance < 0
    )
      throw new Error(
        "PostProcessingSolver: differential pair declaration is invalid",
      )
    for (const distance of [
      pair.minimumCenterlineDistance,
      pair.maximumCenterlineDistance,
    ])
      if (
        distance !== undefined &&
        (!Number.isFinite(distance) || distance <= 0)
      )
        throw new Error(
          "PostProcessingSolver: differential pair centerline distances must be positive finite numbers",
        )
    if (
      pair.minimumCenterlineDistance !== undefined &&
      pair.maximumCenterlineDistance !== undefined &&
      pair.minimumCenterlineDistance > pair.maximumCenterlineDistance
    )
      throw new Error(
        "PostProcessingSolver: differential pair minimumCenterlineDistance cannot exceed maximumCenterlineDistance",
      )
    for (const connectionName of pair.connectionNames) {
      if (declaredConnections.has(connectionName))
        throw new Error(
          `PostProcessingSolver: connection "${connectionName}" belongs to multiple differential pairs`,
        )
      declaredConnections.add(connectionName)
    }
  }

  for (const defaultInnerGridStep of [0.25, 0.5])
    resolvePostProcessingGridConfig({
      config: params.routingGrid,
      bounds: params.bounds,
      defaultInnerGridStep,
    })
}
