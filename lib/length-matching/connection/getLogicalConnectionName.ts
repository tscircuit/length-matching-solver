import type { HighDensityRoute } from "../../types"

/**
 * Resolve the connection name shared by all branches of a routed connection.
 */
export const getLogicalConnectionName = (route: HighDensityRoute): string =>
  route.rootConnectionName ?? route.connectionName
