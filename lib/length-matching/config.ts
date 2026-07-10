import type { DifferentialPair, SimpleRouteConnection } from "../types"
import type { LengthMatchingConfig } from "./internal-types"
import type { LengthMatchingSolverParams } from "./types"

/** Validate public options once and resolve defaults for every internal module. */
export const validateAndResolveParams = (
  params: LengthMatchingSolverParams,
): LengthMatchingConfig => {
  const maximumMeanderDepth = params.maximumMeanderDepth ?? 5
  const maxToothCount = params.maxToothCount ?? 12
  if (!Number.isFinite(maximumMeanderDepth) || maximumMeanderDepth <= 0) {
    throw new Error(
      "LengthMatchingSolver: maximumMeanderDepth must be a positive finite number",
    )
  }
  if (
    params.minimumToothPitch !== undefined &&
    (!Number.isFinite(params.minimumToothPitch) ||
      params.minimumToothPitch <= 0)
  ) {
    throw new Error(
      "LengthMatchingSolver: minimumToothPitch must be a positive finite number",
    )
  }
  if (
    !Number.isFinite(maxToothCount) ||
    !Number.isInteger(maxToothCount) ||
    maxToothCount <= 0
  ) {
    throw new Error(
      "LengthMatchingSolver: maxToothCount must be a positive finite integer",
    )
  }
  return {
    maximumMeanderDepth,
    minimumToothPitch: params.minimumToothPitch,
    maxToothCount,
    obstacles: params.obstacles ?? [],
    bounds: params.bounds,
    obstacleMargin: params.obstacleMargin ?? 0.15,
    layerCount: params.layerCount ?? 2,
    colorMap: params.colorMap ?? {},
  }
}

/** Fail early when a pair cannot refer to two routable source connections. */
export const validatePair = (
  pair: DifferentialPair,
  originalConnections: SimpleRouteConnection[],
): void => {
  if (pair.connectionNames[0] === pair.connectionNames[1]) {
    throw new Error(
      "LengthMatchingSolver: a differential pair must reference two distinct connections",
    )
  }
  if (!Number.isFinite(pair.lengthTolerance) || pair.lengthTolerance < 0) {
    throw new Error(
      "LengthMatchingSolver: differential pair lengthTolerance must be a non-negative finite number",
    )
  }
  const connectionsByName = new Map(
    originalConnections.map((connection) => [connection.name, connection]),
  )
  for (const connectionName of pair.connectionNames) {
    const connection = connectionsByName.get(connectionName)
    if (!connection)
      throw new Error(
        `LengthMatchingSolver: differential pair references unknown connection "${connectionName}"`,
      )
    if (connection.pointsToConnect.length !== 2) {
      throw new Error(
        `LengthMatchingSolver: differential pair connection "${connectionName}" must have exactly two points before MST splitting`,
      )
    }
  }
}
