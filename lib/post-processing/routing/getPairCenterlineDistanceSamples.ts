import type { DifferentialPair } from "../../types"
import type { ParsedTrace } from "../model/internal-types"
import { getCenterlineDistanceSamples } from "./getCenterlineDistanceSamples"

/** Include enough room for paired via copper when the terminals change layers. */
export function getPairCenterlineDistanceSamples(
  pair: DifferentialPair,
  first: ParsedTrace,
  second: ParsedTrace,
  includeViaSpacing = true,
): number[] {
  const changesLayer =
    includeViaSpacing && first.points[0]!.layer !== first.points.at(-1)!.layer
  const minimumDistance = changesLayer
    ? (first.viaDiameter + second.viaDiameter) / 2
    : (first.width + second.width) / 2
  const legacyCenterlineDistances = [0.75, 0.5, 1, 0.25, 1.25].map(
    (edgeGap): number => edgeGap + first.width / 2 + second.width / 2,
  )
  if (changesLayer)
    legacyCenterlineDistances.push(
      minimumDistance + Math.max(first.width, second.width) / 2,
      minimumDistance + Math.max(first.width, second.width),
    )
  return getCenterlineDistanceSamples({
    minimumCenterlineDistance: pair.minimumCenterlineDistance,
    maximumCenterlineDistance: pair.maximumCenterlineDistance,
    minimumPhysicalDistance: minimumDistance,
    legacyCenterlineDistances,
  }).filter((distance) => distance >= minimumDistance)
}
