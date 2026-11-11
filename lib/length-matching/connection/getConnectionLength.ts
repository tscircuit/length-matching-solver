import { getRouteLength } from "../../route-geometry"
import type { HighDensityRoute } from "../../types"

/** Sum planar copper for the explicitly selected lane route indexes. */
export const getConnectionLength = (
  routes: HighDensityRoute[],
  routeIndexes: number[],
): number =>
  routeIndexes.reduce(
    (total, routeIndex) => total + getRouteLength(routes[routeIndex]!),
    0,
  )
