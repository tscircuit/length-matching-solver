/** Generate deterministic nominal pair spacings around an optional soft range. */
export const getCenterlineDistanceSamples = (input: {
  minimumCenterlineDistance?: number
  maximumCenterlineDistance?: number
  minimumPhysicalDistance: number
  legacyCenterlineDistances: number[]
}): number[] => {
  const {
    minimumCenterlineDistance: minimum,
    maximumCenterlineDistance: maximum,
  } = input
  if (minimum === undefined && maximum === undefined)
    return input.legacyCenterlineDistances
  const distanceSamples =
    minimum !== undefined && maximum !== undefined
      ? [
          (minimum + maximum) / 2,
          minimum,
          maximum,
          minimum - 0.25,
          maximum + 0.25,
        ]
      : minimum !== undefined
        ? [minimum, minimum + 0.25, minimum + 0.5, minimum - 0.25, minimum + 1]
        : [
            maximum!,
            maximum! - 0.25,
            maximum! - 0.5,
            maximum! + 0.25,
            maximum! - 1,
          ]
  const allSamples = [...distanceSamples, ...input.legacyCenterlineDistances]
  return allSamples.filter(
    (distance, index) =>
      distance > input.minimumPhysicalDistance &&
      allSamples.findIndex(
        (otherDistance) => Math.abs(otherDistance - distance) < 1e-8,
      ) === index,
  )
}
