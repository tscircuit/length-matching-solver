import type {
  PcbTraceRoutePoint,
  PcbTraceWireRoutePoint,
  ResolvedDifferentialPair,
  ResolvedDifferentialPairPostProcessingParams,
} from "../types"
import type { RoutedPairCandidate } from "./types"
import { getPlanarRouteLength } from "./getPlanarRouteLength"

export const correctLengthSkew = ({
  pair,
  candidate,
  params,
  isCandidateValid,
}: {
  pair: ResolvedDifferentialPair
  candidate: RoutedPairCandidate
  params: ResolvedDifferentialPairPostProcessingParams
  isCandidateValid: (candidate: RoutedPairCandidate) => boolean
}): RoutedPairCandidate | null => {
  const positiveLength = getPlanarRouteLength(candidate.positiveRoute)
  const negativeLength = getPlanarRouteLength(candidate.negativeRoute)
  const lengthDifference = Math.abs(positiveLength - negativeLength)
  if (lengthDifference <= pair.maxLengthSkew + 1e-9) return candidate

  const positiveIsShorter = positiveLength < negativeLength
  const shorterRoute = positiveIsShorter
    ? candidate.positiveRoute
    : candidate.negativeRoute
  const longerRoute = positiveIsShorter
    ? candidate.negativeRoute
    : candidate.positiveRoute
  const requiredAddedLength = lengthDifference

  for (
    let routePointIndex = 1;
    routePointIndex < shorterRoute.length - 2;
    routePointIndex++
  ) {
    const shorterStart = shorterRoute[routePointIndex]
    const shorterEnd = shorterRoute[routePointIndex + 1]
    const longerStart = longerRoute[routePointIndex]
    const longerEnd = longerRoute[routePointIndex + 1]
    if (
      shorterStart?.route_type !== "wire" ||
      shorterEnd?.route_type !== "wire" ||
      longerStart?.route_type !== "wire" ||
      longerEnd?.route_type !== "wire" ||
      shorterStart.layer !== shorterEnd.layer ||
      longerStart.layer !== longerEnd.layer ||
      shorterStart.is_terminal_escape ||
      shorterEnd.is_terminal_escape ||
      longerStart.is_terminal_escape ||
      longerEnd.is_terminal_escape
    ) {
      continue
    }
    const segmentLength = Math.hypot(
      shorterEnd.x - shorterStart.x,
      shorterEnd.y - shorterStart.y,
    )
    const pairSeparation = Math.hypot(
      shorterStart.x - longerStart.x,
      shorterStart.y - longerStart.y,
    )
    const maximumTuningHeight = params.maxCenterlineSpacing - pairSeparation
    const minimumHalfPitch = Math.max(
      0.15,
      shorterStart.width + params.designRules.traceToTraceClearance,
    )
    const maximumToothCount = Math.floor(segmentLength / (minimumHalfPitch * 2))
    if (
      pairSeparation <= 1e-9 ||
      maximumTuningHeight <= 1e-9 ||
      maximumToothCount < 1
    ) {
      continue
    }
    const outwardDirection = {
      x: (shorterStart.x - longerStart.x) / pairSeparation,
      y: (shorterStart.y - longerStart.y) / pairSeparation,
    }
    for (let toothCount = 1; toothCount <= maximumToothCount; toothCount++) {
      const halfPitch = segmentLength / (toothCount * 2)
      const tuningHeightSquared =
        ((segmentLength + requiredAddedLength) / (toothCount * 2)) ** 2 -
        halfPitch ** 2
      if (tuningHeightSquared <= 0) continue
      const tuningHeight = Math.sqrt(tuningHeightSquared)
      if (tuningHeight > maximumTuningHeight + 1e-9) continue
      const shorterInsertions: PcbTraceWireRoutePoint[] = []
      const longerInsertions: PcbTraceWireRoutePoint[] = []
      for (
        let halfToothIndex = 1;
        halfToothIndex < toothCount * 2;
        halfToothIndex++
      ) {
        const progress = halfToothIndex / (toothCount * 2)
        const isToothPeak = halfToothIndex % 2 === 1
        shorterInsertions.push({
          route_type: "wire",
          x:
            shorterStart.x +
            (shorterEnd.x - shorterStart.x) * progress +
            (isToothPeak ? outwardDirection.x * tuningHeight : 0),
          y:
            shorterStart.y +
            (shorterEnd.y - shorterStart.y) * progress +
            (isToothPeak ? outwardDirection.y * tuningHeight : 0),
          width: shorterStart.width,
          layer: shorterStart.layer,
        })
        longerInsertions.push({
          route_type: "wire",
          x: longerStart.x + (longerEnd.x - longerStart.x) * progress,
          y: longerStart.y + (longerEnd.y - longerStart.y) * progress,
          width: longerStart.width,
          layer: longerStart.layer,
        })
      }
      const correctedShorterRoute: PcbTraceRoutePoint[] = [
        ...shorterRoute.slice(0, routePointIndex + 1),
        ...shorterInsertions,
        ...shorterRoute.slice(routePointIndex + 1),
      ]
      const correctedLongerRoute: PcbTraceRoutePoint[] = [
        ...longerRoute.slice(0, routePointIndex + 1),
        ...longerInsertions,
        ...longerRoute.slice(routePointIndex + 1),
      ]
      const correctedCandidate: RoutedPairCandidate = positiveIsShorter
        ? {
            ...candidate,
            positiveRoute: correctedShorterRoute,
            negativeRoute: correctedLongerRoute,
          }
        : {
            ...candidate,
            positiveRoute: correctedLongerRoute,
            negativeRoute: correctedShorterRoute,
          }
      if (isCandidateValid(correctedCandidate)) return correctedCandidate
    }
  }
  return null
}
