import type { RegressionAttempt } from "./internal-types"

/**
 * Score a meander from 0 to 100, where higher scores are gentler and more
 * compact. The score is deliberately relative: it ranks feasible ways to add
 * the same length instead of declaring a PCB-manufacturing rule.
 */
export const getMeanderQualityScore = (
  input: Pick<
    RegressionAttempt,
    | "addedLength"
    | "predictedToothDepths"
    | "segmentLength"
    | "heightProfile"
    | "toothCount"
    | "toothPitch"
  >,
): number => {
  const nonZeroDepths = input.predictedToothDepths.filter((depth) => depth > 0)
  if (nonZeroDepths.length === 0) return 0
  const maximumDepth = Math.max(...nonZeroDepths)
  const meanDepth =
    nonZeroDepths.reduce((total, depth) => total + depth, 0) /
    nonZeroDepths.length
  const depthVariation = Math.sqrt(
    nonZeroDepths.reduce(
      (total, depth) => total + (depth - meanDepth) ** 2,
      0,
    ) / nonZeroDepths.length,
  )
  const normalizedDepth = maximumDepth / input.toothPitch
  const depthPenalty = 45 * (normalizedDepth / (1 + normalizedDepth))
  const variationPenalty =
    input.heightProfile === "tapered"
      ? 0
      : Math.min(18, (depthVariation / meanDepth) * 18)
  const bendPenalty = 12 * (1 - 1 / input.toothCount)
  const detourPenalty =
    15 * Math.min(1, input.addedLength / input.segmentLength)
  return Math.max(
    0,
    100 - depthPenalty - variationPenalty - bendPenalty - detourPenalty,
  )
}
