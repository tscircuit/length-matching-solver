import type { RegressionAttempt } from "../internal-types"

const ADDITIONAL_SEGMENT_PENALTY = 3

/** Compare plans without allowing extra segments to inflate a summed score. */
export const getMeanderPlanQualityScore = (
  attempts: Pick<RegressionAttempt, "qualityScore">[],
): number => {
  if (attempts.length === 0)
    throw new Error("LengthMatchingSolver: cannot score an empty meander plan")
  const meanQuality =
    attempts.reduce((total, attempt) => total + attempt.qualityScore, 0) /
    attempts.length
  return meanQuality - ADDITIONAL_SEGMENT_PENALTY * (attempts.length - 1)
}
