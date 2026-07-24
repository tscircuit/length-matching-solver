import { getRouteLength } from "../../route-geometry"
import type { HighDensityRoute } from "../../types"

/** Sum every routed branch belonging to a logical connection. */
export const getConnectionLength = (
  routes: HighDensityRoute[],
  routeIndexes: number[],
): number =>
  routeIndexes.reduce(
    (total, routeIndex) => total + getRouteLength(routes[routeIndex]!),
    0,
  )
