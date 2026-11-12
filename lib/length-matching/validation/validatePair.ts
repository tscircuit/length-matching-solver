import type { SimpleRouteConnection } from "../../types"

import type { LengthMatchingPair } from "../types"

/** Fail early when a pair cannot refer to two routable source connections. */
export const validatePair = (
  pair: LengthMatchingPair,
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
  for (const distance of [
    pair.minimumCenterlineDistance,
    pair.maximumCenterlineDistance,
  ])
    if (distance !== undefined && (!Number.isFinite(distance) || distance <= 0))
      throw new Error(
        "LengthMatchingSolver: differential pair centerline distances must be positive finite numbers",
      )
  if (
    pair.minimumCenterlineDistance !== undefined &&
    pair.maximumCenterlineDistance !== undefined &&
    pair.minimumCenterlineDistance > pair.maximumCenterlineDistance
  )
    throw new Error(
      "LengthMatchingSolver: differential pair minimumCenterlineDistance cannot exceed maximumCenterlineDistance",
    )
  const connectionsByName = new Map(
    originalConnections.map((connection) => [connection.name, connection]),
  )
  const connectionNames = pair.connectionNames.flatMap((lane) => lane)
  if (
    pair.connectionNames.some(
      (lane) => Array.isArray(lane) && lane.length === 0,
    )
  )
    throw new Error(
      "LengthMatchingSolver: an ordered lane must contain at least one hop",
    )
  if (new Set(connectionNames).size !== connectionNames.length)
    throw new Error(
      "LengthMatchingSolver: lane hops must be distinct within and across lanes",
    )
  for (const connectionName of connectionNames) {
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
