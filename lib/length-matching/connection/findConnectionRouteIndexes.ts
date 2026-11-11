import type { HighDensityRoute } from "../../types"

/** Select exact hop names; roots retain electrical meaning for clearance. */
export const findConnectionRouteIndexes = (
  routes: HighDensityRoute[],
  connectionName: string,
): number[] =>
  routes.flatMap((route, index) =>
    route.connectionName === connectionName ? [index] : [],
  )
