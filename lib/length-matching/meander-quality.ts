import type { RegressionAttempt } from "./internal-types"

/**
 * Score a meander from 0 to 100 using stackup-independent electrical-risk
 * proxies. Broad, shallow, distributed tuning wins over a concentrated
 * hairpin, while excessive bends and abrupt depth changes remain undesirable.
 * This ranks feasible geometry; it does not predict impedance or delay.
 */
export const getMeanderQualityScore = (
  input: Pick<
    RegressionAttempt,
    | "addedLength"
    | "predictedToothDepths"
    | "span"
    | "heightProfile"
    | "toothPitch"
  >,
): number => {
  const activeToothIndexes = input.predictedToothDepths.flatMap(
    (depth, toothIndex) => (depth > 0 ? [toothIndex] : []),
  )
  if (activeToothIndexes.length === 0) return 0
  const nonZeroDepths = activeToothIndexes.map(
    (toothIndex) => input.predictedToothDepths[toothIndex]!,
  )
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
  const firstActiveToothIndex = activeToothIndexes[0]!
  const lastActiveToothIndex = activeToothIndexes.at(-1)!
  const occupiedBaselineLength =
    (lastActiveToothIndex - firstActiveToothIndex + 1) * input.toothPitch
  const maximumAspectRatio = maximumDepth / (input.toothPitch / 2)
  const tuningDensity = input.addedLength / occupiedBaselineLength
  const aspectRatioPenalty =
    40 * (maximumAspectRatio / (1 + maximumAspectRatio))
  const densityPenalty = 30 * (tuningDensity / (1 + tuningDensity))
  const taperedWeights = input.predictedToothDepths.map((_, toothIndex) =>
    Math.sin(
      (Math.PI * (toothIndex + 1)) / (input.predictedToothDepths.length + 1),
    ),
  )
  const maximumTaperedWeight = Math.max(...taperedWeights)
  const profileError = Math.sqrt(
    input.predictedToothDepths.reduce((total, depth, toothIndex) => {
      const expectedDepth =
        (maximumDepth * taperedWeights[toothIndex]!) / maximumTaperedWeight
      return total + (depth - expectedDepth) ** 2
    }, 0) / input.predictedToothDepths.length,
  )
  const variationPenalty = Math.min(
    10,
    ((input.heightProfile === "tapered" ? profileError : depthVariation) /
      meanDepth) *
      10,
  )
  const bendPenalty = 2 * (nonZeroDepths.length - 1)
  const detourPenalty =
    7 * Math.min(1, input.addedLength / input.span.length)
  const score = Math.max(
    0,
    100 -
      aspectRatioPenalty -
      densityPenalty -
      variationPenalty -
      bendPenalty -
      detourPenalty,
  )
  return Math.round(score * 1_000_000) / 1_000_000
}
