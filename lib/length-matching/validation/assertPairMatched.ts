import type { HighDensityRoute, SimpleRouteConnection } from "../../types"
import { getConnectionLength } from "../connection-routes"
import { LengthMatchingConstraintError } from "../errors/LengthMatchingConstraintError"
import type { LengthMatchingPair } from "../types"
import { validatePair } from "./validatePair"

/** Recompute coverage and skew from committed output before declaring success. */
export const assertPairMatched = (
  pair: LengthMatchingPair,
  originalConnections: SimpleRouteConnection[],
  routes: HighDensityRoute[],
  layerCount: number,
  pairIndex: number,
): void => {
  const indexes = validatePair(
    pair,
    originalConnections,
    routes,
    layerCount,
    pairIndex,
  )
  const lengths = indexes.map((lane): number =>
    getConnectionLength(routes, lane),
  )
  const skew = Math.abs(lengths[0]! - lengths[1]!)
  if (!Number.isFinite(skew) || skew > pair.maxLengthSkewMm)
    throw new LengthMatchingConstraintError(
      pairIndex,
      "unmet-skew",
      `lane lengths ${lengths.join("/")}mm exceed maxLengthSkewMm ${pair.maxLengthSkewMm}mm (skew ${skew}mm)`,
    )
}
