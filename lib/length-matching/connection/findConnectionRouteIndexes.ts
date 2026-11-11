import type { HighDensityRoute } from "../../types"
import type { LengthMatchingLane } from "../types"
import { getLogicalConnectionName } from "./getLogicalConnectionName"

/** Strings select logical roots; ordered lists select only their exact routes. */
export const findConnectionRouteIndexes = (
  routes: HighDensityRoute[],
  connectionName: LengthMatchingLane,
): number[] => {
  if (typeof connectionName === "string")
    return routes.flatMap((route, index) =>
      getLogicalConnectionName(route) === connectionName ? [index] : [],
    )
  return connectionName.map((hopName) => {
    const indexes = routes.flatMap((route, index) =>
      route.connectionName === hopName ? [index] : [],
    )
    if (indexes.length !== 1)
      throw new Error(
        `LengthMatchingSolver: lane hop "${hopName}" must identify exactly one route, got ${indexes.length}`,
      )
    return indexes[0]!
  })
}
