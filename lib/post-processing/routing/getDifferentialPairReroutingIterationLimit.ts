import type { InternalPostProcessingParams } from "../types"

export const MAXIMUM_REROUTING_ITERATIONS_PER_PAIR = 75_000
export const MAXIMUM_TOTAL_REROUTING_ITERATIONS = 80_000

/** Keep best-effort rerouting bounded when a large search cannot improve a pair. */
export const getDifferentialPairReroutingIterationLimit = (
  params: InternalPostProcessingParams,
): number => {
  const pairScaledLimit =
    params.simpleRouteJson.differentialPairs.length *
    MAXIMUM_REROUTING_ITERATIONS_PER_PAIR
  if (!Number.isSafeInteger(pairScaledLimit))
    throw new Error(
      "PostProcessingSolver: derived rerouting iteration bound exceeds the safe integer range",
    )
  const limit = Math.min(pairScaledLimit, MAXIMUM_TOTAL_REROUTING_ITERATIONS)
  return Math.max(1, limit)
}
