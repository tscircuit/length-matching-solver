import { getObstacleLayerIndexes } from "../../obstacles/getObstacleLayerIndexes"
import { resolvePostProcessingGridConfig } from "../routing/resolvePostProcessingGridConfig"
import type {
  CompleteSimpleRouteJson,
  PostProcessingSolverParams,
  SimpleRouteJson,
} from "../types"

/** Validate run-wide inputs; pair-specific infeasibility is handled during stepping. */
export function validatePostProcessingParams<
  TSimpleRouteJson extends SimpleRouteJson,
>(
  params: PostProcessingSolverParams<TSimpleRouteJson>,
): asserts params is PostProcessingSolverParams<
  CompleteSimpleRouteJson<TSimpleRouteJson>
> {
  if (!params.simpleRouteJson || typeof params.simpleRouteJson !== "object")
    throw new Error("PostProcessingSolver: simpleRouteJson must be an object")
  const { simpleRouteJson } = params
  if (
    !Array.isArray(simpleRouteJson.traces) ||
    !Array.isArray(simpleRouteJson.differentialPairs)
  )
    throw new Error(
      "PostProcessingSolver: traces and differentialPairs must be arrays",
    )
  if (!Array.isArray(simpleRouteJson.obstacles))
    throw new Error("PostProcessingSolver: obstacles must be an array")
  if (
    !Number.isInteger(simpleRouteJson.layerCount) ||
    simpleRouteJson.layerCount < 1
  )
    throw new Error(
      "PostProcessingSolver: layerCount must be a positive integer",
    )
  for (const obstacle of simpleRouteJson.obstacles)
    getObstacleLayerIndexes(obstacle, simpleRouteJson.layerCount)
  const { minX, maxX, minY, maxY } = simpleRouteJson.bounds
  if (
    ![minX, maxX, minY, maxY].every(Number.isFinite) ||
    minX >= maxX ||
    minY >= maxY
  )
    throw new Error(
      "PostProcessingSolver: bounds must have finite positive extents",
    )
  for (const defaultInnerGridStep of [0.25, 0.5])
    resolvePostProcessingGridConfig({
      config: params.routingGrid,
      bounds: simpleRouteJson.bounds,
      defaultInnerGridStep,
    })
  const declaredConnections = new Set<string>()
  for (const pair of simpleRouteJson.differentialPairs) {
    if (
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
}
