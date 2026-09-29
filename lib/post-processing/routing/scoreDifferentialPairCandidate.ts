import type { DifferentialPair } from "../../types"
import type { PairCandidate } from "../model/internal-types"
import { getSimplifiedTraceLength } from "../length-matching/getSimplifiedTraceLength"

const CENTERLINE_DISTANCE_PENALTY_PER_MM = 100

export function scoreDifferentialPairCandidate(
  candidate: PairCandidate,
  pair: DifferentialPair,
): number {
  const hasCenterlineDistancePreference =
    pair.minimumCenterlineDistance !== undefined ||
    pair.maximumCenterlineDistance !== undefined
  const spacingPenalty = hasCenterlineDistancePreference
    ? Math.max(
        0,
        (pair.minimumCenterlineDistance ?? Number.NEGATIVE_INFINITY) -
          candidate.centerlineDistance,
      ) *
        CENTERLINE_DISTANCE_PENALTY_PER_MM +
      Math.max(
        0,
        candidate.centerlineDistance -
          (pair.maximumCenterlineDistance ?? Number.POSITIVE_INFINITY),
      ) *
        CENTERLINE_DISTANCE_PENALTY_PER_MM
    : candidate.edgeGap < 0.5
      ? (0.5 - candidate.edgeGap) * CENTERLINE_DISTANCE_PENALTY_PER_MM
      : candidate.edgeGap > 1
        ? (candidate.edgeGap - 1) * CENTERLINE_DISTANCE_PENALTY_PER_MM
        : 0
  return (
    spacingPenalty +
    getSimplifiedTraceLength(candidate.firstParsed) +
    getSimplifiedTraceLength(candidate.secondParsed) +
    candidate.bendCount * 0.15 +
    candidate.viaPairCount * 8
  )
}
