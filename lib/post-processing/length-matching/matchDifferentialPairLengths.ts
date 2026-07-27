import type { DifferentialPair, SimplifiedPcbTraceWireRoutePoint } from "../../types"
import { getMinimumPairEdgeGap } from "../geometry/getMinimumPairEdgeGap"
import { validateCandidateGeometry, type CandidateGeometryContext } from "../geometry/validateCandidateGeometry"
import type { PairCandidate } from "../model/internal-types"
import { parseSimplifiedPcbTrace } from "../model/parseSimplifiedPcbTrace"
import { getSimplifiedTraceLength } from "./getSimplifiedTraceLength"

/** Add one exact triangular detour to the shorter member and recheck all copper. */
export const matchDifferentialPairLengths = (input: {
  candidate: PairCandidate
  pair: DifferentialPair
  context: CandidateGeometryContext
}): PairCandidate | null => {
  const firstLength = getSimplifiedTraceLength(input.candidate.firstParsed)
  const secondLength = getSimplifiedTraceLength(input.candidate.secondParsed)
  const difference = Math.abs(firstLength - secondLength)
  if (difference <= input.pair.lengthTolerance + 1e-8)
    return {
      ...input.candidate,
      edgeGap: getMinimumPairEdgeGap(
        input.candidate.firstParsed,
        input.candidate.secondParsed,
      ),
    }
  const shorterIsFirst = firstLength < secondLength
  const shorter = shorterIsFirst ? input.candidate.first : input.candidate.second
  const segmentIndexes: Array<{ index: number; length: number }> = []
  for (let index = 0; index < shorter.route.length - 1; index++) {
    const start = shorter.route[index]
    const end = shorter.route[index + 1]
    if (
      start?.route_type !== "wire" ||
      end?.route_type !== "wire" ||
      start.layer !== end.layer
    ) continue
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (length > 0.5) segmentIndexes.push({ index, length })
  }
  segmentIndexes.sort((left, right) => right.length - left.length || left.index - right.index)

  for (const segment of segmentIndexes) {
    const start = shorter.route[segment.index] as SimplifiedPcbTraceWireRoutePoint
    const end = shorter.route[segment.index + 1] as SimplifiedPcbTraceWireRoutePoint
    const height = Math.sqrt(
      Math.max(0, ((segment.length + difference) ** 2 - segment.length ** 2) / 4),
    )
    const normal = {
      x: -(end.y - start.y) / segment.length,
      y: (end.x - start.x) / segment.length,
    }
    for (const side of [1, -1]) {
      const detour: SimplifiedPcbTraceWireRoutePoint = {
        route_type: "wire",
        x: (start.x + end.x) / 2 + normal.x * height * side,
        y: (start.y + end.y) / 2 + normal.y * height * side,
        width: Math.max(start.width, end.width),
        layer: start.layer,
      }
      const replacement = {
        ...shorter,
        route: [
          ...shorter.route.slice(0, segment.index + 1),
          detour,
          ...shorter.route.slice(segment.index + 1),
        ],
      }
      const parsed = parseSimplifiedPcbTrace(replacement, input.context.layerCount)
      const firstParsed = shorterIsFirst ? parsed : input.candidate.firstParsed
      const secondParsed = shorterIsFirst ? input.candidate.secondParsed : parsed
      if (!validateCandidateGeometry(firstParsed, secondParsed, input.context)) continue
      const finalDifference = Math.abs(
        getSimplifiedTraceLength(firstParsed) - getSimplifiedTraceLength(secondParsed),
      )
      if (finalDifference > input.pair.lengthTolerance + 1e-7)
        throw new Error(
          `PostProcessingSolver: fitted meander for ${input.pair.connectionNames.join("/")} has unexpected length error ${finalDifference}`,
        )
      return {
        ...input.candidate,
        ...(shorterIsFirst ? { first: replacement } : { second: replacement }),
        firstParsed,
        secondParsed,
        edgeGap: getMinimumPairEdgeGap(firstParsed, secondParsed),
        bendCount: input.candidate.bendCount + 2,
      }
    }
  }
  return null
}
