import type { HighDensityRoute } from "../../types"
import { getLogicalConnectionName } from "./getLogicalConnectionName"

/** Find each routed branch that belongs to one logical connection. */
export const findConnectionRouteIndexes = (
  routes: HighDensityRoute[],
  connectionName: string,
): number[] =>
  routes.flatMap((route, index) =>
    getLogicalConnectionName(route) === connectionName ? [index] : [],
  )
