import { getRouteLength } from "../route-geometry"
import type { HighDensityRoute } from "../types"

export const getLogicalConnectionName = (route: HighDensityRoute): string =>
  route.rootConnectionName ?? route.connectionName

/** Find each routed branch that belongs to one logical connection. */
export const findConnectionRouteIndexes = (
  routes: HighDensityRoute[],
  connectionName: string,
): number[] =>
  routes.flatMap((route, index) =>
    getLogicalConnectionName(route) === connectionName ? [index] : [],
  )

/** Sum every routed branch belonging to a logical connection. */
export const getConnectionLength = (
  routes: HighDensityRoute[],
  routeIndexes: number[],
): number =>
  routeIndexes.reduce(
    (total, routeIndex) => total + getRouteLength(routes[routeIndex]!),
    0,
  )
