import type { LengthMatchingGroup, SimpleRouteConnection } from "../../types"

/** Fail early when a skew group cannot refer to routable source connections. */
export const validateLengthMatchingGroup = (
  group: LengthMatchingGroup,
  originalConnections: SimpleRouteConnection[],
): void => {
  if (
    !Array.isArray(group.connectionNames) ||
    group.connectionNames.length < 2 ||
    group.connectionNames.some(
      (connectionName) =>
        typeof connectionName !== "string" || connectionName.length === 0,
    ) ||
    new Set(group.connectionNames).size !== group.connectionNames.length
  ) {
    throw new Error(
      "LengthMatchingSolver: a length matching group must reference at least two distinct connections",
    )
  }
  if (!Number.isFinite(group.maxLengthSkew) || group.maxLengthSkew < 0) {
    throw new Error(
      "LengthMatchingSolver: length matching group maxLengthSkew must be a non-negative finite number",
    )
  }
  for (const [connectionName, fixedLength] of Object.entries(
    group.fixedLengthByConnectionName ?? {},
  ))
    if (
      !group.connectionNames.includes(connectionName) ||
      !Number.isFinite(fixedLength) ||
      fixedLength < 0
    )
      throw new Error(
        "LengthMatchingSolver: length matching group fixed lengths must be non-negative finite values for declared connections",
      )
  const connectionsByName = new Map(
    originalConnections.map((connection) => [connection.name, connection]),
  )
  for (const connectionName of group.connectionNames) {
    const connection = connectionsByName.get(connectionName)
    if (!connection)
      throw new Error(
        `LengthMatchingSolver: length matching group references unknown connection "${connectionName}"`,
      )
    if (connection.pointsToConnect.length !== 2)
      throw new Error(
        `LengthMatchingSolver: length matching group connection "${connectionName}" must have exactly two points before MST splitting`,
      )
  }
}
