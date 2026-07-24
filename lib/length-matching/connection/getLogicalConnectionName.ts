import type { HighDensityRoute } from "../../types"

export const getLogicalConnectionName = (route: HighDensityRoute): string =>
  route.rootConnectionName ?? route.connectionName
