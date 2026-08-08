import type { DifferentialPair, SimpleRouteConnection } from "../../types"

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
  for (const [connectionName, fixedLength] of Object.entries(
    pair.fixedLengthByConnectionName ?? {},
  ))
    if (
      !pair.connectionNames.includes(connectionName) ||
      !Number.isFinite(fixedLength) ||
      fixedLength < 0
    )
      throw new Error(
        "LengthMatchingSolver: differential pair fixed lengths must be non-negative finite values for declared connections",
      )
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
