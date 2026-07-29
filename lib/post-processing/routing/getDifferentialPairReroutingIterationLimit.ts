import type { PostProcessingSolverParams } from "../types"

/** Bound up to twenty grid searches per pair using the validated 250k-node limit. */
export const getDifferentialPairReroutingIterationLimit = (
  params: PostProcessingSolverParams,
): number => {
  const maximumGridNodeCount = 250_000
  const maximumDirectedEdgeCount = maximumGridNodeCount * 24 + 192
  const searchAttemptCountPerPair = 20
  const searchStateLimit =
    maximumDirectedEdgeCount * params.simpleRouteJson.layerCount + 1
  const limit =
    params.simpleRouteJson.differentialPairs.length *
    (750_020 + searchAttemptCountPerPair * searchStateLimit)
  if (!Number.isSafeInteger(limit))
    throw new Error(
      "PostProcessingSolver: derived rerouting iteration bound exceeds the safe integer range",
    )
  return Math.max(1, limit)
}
