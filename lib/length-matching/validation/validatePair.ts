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
