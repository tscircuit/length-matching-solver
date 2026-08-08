import type { InternalPostProcessingParams } from "../types"

export const MAXIMUM_REROUTING_ITERATIONS_PER_PAIR = 100_000

/** Keep best-effort rerouting bounded when a large search cannot improve a pair. */
export const getDifferentialPairReroutingIterationLimit = (
  params: InternalPostProcessingParams,
): number => {
  const limit =
    params.simpleRouteJson.differentialPairs.length *
    MAXIMUM_REROUTING_ITERATIONS_PER_PAIR
  if (!Number.isSafeInteger(limit))
    throw new Error(
      "PostProcessingSolver: derived rerouting iteration bound exceeds the safe integer range",
    )
  return Math.max(1, limit)
}
