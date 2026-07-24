import { getMinimumSegmentDistance } from "../route-geometry/getMinimumSegmentDistance"
import { getPlanarRouteLength } from "./routing/getPlanarRouteLength"
import type { PairLaneGeometry, RoutedPairCandidate } from "./routing/types"
import type {
  DifferentialPairRoutingFailure,
  PcbTraceWireRoutePoint,
  ResolvedDifferentialPair,
  ResolvedDifferentialPairPostProcessingParams,
} from "./types"
import type { DifferentialPairDrcChecker } from "./validation/DifferentialPairDrcChecker"

export type DifferentialPairCandidateValidation =
  | {
      status: "valid"
      positiveLength: number
      negativeLength: number
    }
  | { status: "failed"; failure: DifferentialPairRoutingFailure }

export const validateDifferentialPairCandidate = ({
  pair,
  params,
  geometry,
  candidate,
  drcChecker,
}: {
  pair: ResolvedDifferentialPair
  params: ResolvedDifferentialPairPostProcessingParams
  geometry: PairLaneGeometry
  candidate: RoutedPairCandidate
  drcChecker: DifferentialPairDrcChecker
}): DifferentialPairCandidateValidation => {
  const failure = (
    category: DifferentialPairRoutingFailure["category"],
    message: string,
    context: Partial<
      Pick<DifferentialPairRoutingFailure, "layer" | "viaPairBudget">
    > = {},
  ): DifferentialPairCandidateValidation => ({
    status: "failed",
    failure: {
      category,
      message,
      positiveSourceTraceId: pair.positiveSourceTraceId,
      negativeSourceTraceId: pair.negativeSourceTraceId,
      ...context,
    },
  })
  const getWireSegments = (
    route: RoutedPairCandidate["positiveRoute"],
  ): Array<{
    start: PcbTraceWireRoutePoint
    end: PcbTraceWireRoutePoint
  }> => {
    const segments: Array<{
      start: PcbTraceWireRoutePoint
      end: PcbTraceWireRoutePoint
    }> = []
    let lastWire: PcbTraceWireRoutePoint | undefined
    for (const routePoint of route) {
      if (routePoint.route_type === "via") {
        lastWire = undefined
      } else if (routePoint.route_type === "wire") {
        if (lastWire && lastWire.layer === routePoint.layer) {
          segments.push({ start: lastWire, end: routePoint })
        }
        lastWire = routePoint
      }
    }
    return segments
  }
  const positiveSegments = getWireSegments(candidate.positiveRoute)
  const negativeSegments = getWireSegments(candidate.negativeRoute)

  for (const positiveSegment of positiveSegments) {
    const violation = drcChecker.getTraceSegmentViolation(
      positiveSegment.start,
      positiveSegment.end,
      Boolean(
        positiveSegment.start.is_terminal_escape ||
          positiveSegment.end.is_terminal_escape,
      ),
    )
    if (violation) {
      return failure(violation.category, violation.message, violation)
    }
  }
  for (const negativeSegment of negativeSegments) {
    const violation = drcChecker.getTraceSegmentViolation(
      negativeSegment.start,
      negativeSegment.end,
      Boolean(
        negativeSegment.start.is_terminal_escape ||
          negativeSegment.end.is_terminal_escape,
      ),
    )
    if (violation) {
      return failure(violation.category, violation.message, violation)
    }
  }

  for (const positiveSegment of positiveSegments) {
    for (const negativeSegment of negativeSegments) {
      if (positiveSegment.start.layer !== negativeSegment.start.layer) {
        continue
      }
      if (
        getMinimumSegmentDistance(
          positiveSegment.start,
          positiveSegment.end,
          negativeSegment.start,
          negativeSegment.end,
        ) <= 1e-9
      ) {
        return failure(
          "terminal_escape_failed",
          "candidate routes cross or overlap",
          { layer: positiveSegment.start.layer },
        )
      }
    }
  }

  if (candidate.positiveRoute.length !== candidate.negativeRoute.length) {
    throw new Error(
      `Differential pair "${pair.name}" candidate members lost station correspondence`,
    )
  }
  for (
    let routePointIndex = 0;
    routePointIndex < candidate.positiveRoute.length - 1;
    routePointIndex++
  ) {
    const positiveStart = candidate.positiveRoute[routePointIndex]
    const positiveEnd = candidate.positiveRoute[routePointIndex + 1]
    const negativeStart = candidate.negativeRoute[routePointIndex]
    const negativeEnd = candidate.negativeRoute[routePointIndex + 1]
    if (
      positiveStart?.route_type !== "wire" ||
      positiveEnd?.route_type !== "wire" ||
      negativeStart?.route_type !== "wire" ||
      negativeEnd?.route_type !== "wire" ||
      positiveStart.layer !== positiveEnd.layer ||
      negativeStart.layer !== negativeEnd.layer
    ) {
      continue
    }
    if (positiveStart.layer !== negativeStart.layer) {
      throw new Error(
        `Differential pair "${pair.name}" members occupy different layers at a coupled station`,
      )
    }
    const isTerminalEscape = Boolean(
      positiveStart.is_terminal_escape ||
        positiveEnd.is_terminal_escape ||
        negativeStart.is_terminal_escape ||
        negativeEnd.is_terminal_escape,
    )
    if (isTerminalEscape) continue
    const startDelta = {
      x: positiveStart.x - negativeStart.x,
      y: positiveStart.y - negativeStart.y,
    }
    const endDelta = {
      x: positiveEnd.x - negativeEnd.x,
      y: positiveEnd.y - negativeEnd.y,
    }
    const deltaChange = {
      x: endDelta.x - startDelta.x,
      y: endDelta.y - startDelta.y,
    }
    const deltaChangeLengthSquared = deltaChange.x ** 2 + deltaChange.y ** 2
    const minimumProgress =
      deltaChangeLengthSquared <= 1e-18
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              -(startDelta.x * deltaChange.x + startDelta.y * deltaChange.y) /
                deltaChangeLengthSquared,
            ),
          )
    const minimumDistance = Math.hypot(
      startDelta.x + deltaChange.x * minimumProgress,
      startDelta.y + deltaChange.y * minimumProgress,
    )
    const maximumDistance = Math.max(
      Math.hypot(startDelta.x, startDelta.y),
      Math.hypot(endDelta.x, endDelta.y),
    )
    if (
      minimumDistance < geometry.effectiveMinimumSpacing - 1e-8 ||
      maximumDistance > params.maxCenterlineSpacing + 1e-8
    ) {
      return failure(
        "spacing_bounds_unsatisfiable",
        `candidate centerline spacing spans ${minimumDistance} to ${maximumDistance}`,
        { layer: positiveStart.layer },
      )
    }
    if (startDelta.x * endDelta.x + startDelta.y * endDelta.y <= 0) {
      return failure(
        "terminal_escape_failed",
        "candidate changes positive/negative lane ordering",
        { layer: positiveStart.layer },
      )
    }
    const startMidpoint = {
      x: (positiveStart.x + negativeStart.x) / 2,
      y: (positiveStart.y + negativeStart.y) / 2,
    }
    const endMidpoint = {
      x: (positiveEnd.x + negativeEnd.x) / 2,
      y: (positiveEnd.y + negativeEnd.y) / 2,
    }
    const midpointMovement = {
      x: endMidpoint.x - startMidpoint.x,
      y: endMidpoint.y - startMidpoint.y,
    }
    if (Math.hypot(midpointMovement.x, midpointMovement.y) > 1e-9) {
      const expectedLaneDirection = {
        x: -midpointMovement.y * geometry.laneSideSign,
        y: midpointMovement.x * geometry.laneSideSign,
      }
      if (
        startDelta.x * expectedLaneDirection.x +
          startDelta.y * expectedLaneDirection.y <=
          0 ||
        endDelta.x * expectedLaneDirection.x +
          endDelta.y * expectedLaneDirection.y <=
          0
      ) {
        return failure(
          "terminal_escape_failed",
          "candidate exchanges positive and negative sides through a turn",
          { layer: positiveStart.layer },
        )
      }
    }
  }

  if (candidate.pcbVias.length % 2 !== 0) {
    throw new Error(
      `Differential pair "${pair.name}" candidate contains an unpaired via`,
    )
  }
  const viaPairBudget = candidate.pcbVias.length / 2
  for (
    let pcbViaIndex = 0;
    pcbViaIndex < candidate.pcbVias.length;
    pcbViaIndex += 2
  ) {
    const positivePcbVia = candidate.pcbVias[pcbViaIndex]!
    const negativePcbVia = candidate.pcbVias[pcbViaIndex + 1]!
    const violation = drcChecker.getViaPairViolation(
      positivePcbVia,
      negativePcbVia,
      geometry.effectiveMinimumSpacing,
      viaPairBudget,
    )
    if (violation) {
      return failure(violation.category, violation.message, violation)
    }
  }

  const positiveLength = getPlanarRouteLength(candidate.positiveRoute)
  const negativeLength = getPlanarRouteLength(candidate.negativeRoute)
  const lengthSkew = Math.abs(positiveLength - negativeLength)
  if (lengthSkew > pair.maxLengthSkew + 1e-9) {
    return failure(
      "length_skew_unsatisfied",
      `candidate length skew ${lengthSkew} exceeds ${pair.maxLengthSkew}; vias use zero planar length`,
      { viaPairBudget },
    )
  }
  return { status: "valid", positiveLength, negativeLength }
}
