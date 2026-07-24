import { correctLengthSkew } from "./routing/correctLengthSkew"
import { createRoutedPairCandidate } from "./routing/createRoutedPairCandidate"
import { findCoupledPath } from "./routing/findCoupledPath"
import type {
  PairLaneGeometry,
  Point,
  RoutedPairCandidate,
} from "./routing/types"
import type {
  DifferentialPairRoutingFailure,
  PcbTraceForPostProcessing,
  PcbTraceWireRoutePoint,
  PcbViaForPostProcessing,
  ResolvedDifferentialPair,
  ResolvedDifferentialPairPostProcessingParams,
} from "./types"
import { DifferentialPairInputError } from "./DifferentialPairInputError"
import { validateDifferentialPairCandidate } from "./validateDifferentialPairCandidate"
import { DifferentialPairDrcChecker } from "./validation/DifferentialPairDrcChecker"

type RoutedPair = {
  positivePcbTrace: PcbTraceForPostProcessing
  negativePcbTrace: PcbTraceForPostProcessing
  pcbVias: PcbViaForPostProcessing[]
}

export type DifferentialPairRoutingAttempt =
  | { status: "routed"; routedPair: RoutedPair }
  | { status: "failed"; failure: DifferentialPairRoutingFailure }

export const solveDifferentialPair = ({
  pair,
  params,
  transactionalPcbTraces,
  transactionalPcbVias,
}: {
  pair: ResolvedDifferentialPair
  params: ResolvedDifferentialPairPostProcessingParams
  transactionalPcbTraces: PcbTraceForPostProcessing[]
  transactionalPcbVias: PcbViaForPostProcessing[]
}): DifferentialPairRoutingAttempt => {
  const failure = (
    category: DifferentialPairRoutingFailure["category"],
    message: string,
    context: Partial<
      Pick<DifferentialPairRoutingFailure, "layer" | "viaPairBudget">
    > = {},
  ): DifferentialPairRoutingAttempt => ({
    status: "failed",
    failure: {
      category,
      message,
      positiveSourceTraceId: pair.positiveSourceTraceId,
      negativeSourceTraceId: pair.negativeSourceTraceId,
      ...context,
    },
  })
  const positiveMatches = transactionalPcbTraces.filter(
    (pcbTrace) => pcbTrace.source_trace_id === pair.positiveSourceTraceId,
  )
  const negativeMatches = transactionalPcbTraces.filter(
    (pcbTrace) => pcbTrace.source_trace_id === pair.negativeSourceTraceId,
  )
  if (positiveMatches.length !== 1 || negativeMatches.length !== 1) {
    return failure(
      "unsupported_route_geometry",
      "each pair member must resolve to exactly one PCB trace",
    )
  }
  const positiveOriginal = positiveMatches[0]!
  const negativeOriginal = negativeMatches[0]!
  if (
    positiveOriginal.route.some(
      (routePoint) => routePoint.route_type === "through_pad",
    ) ||
    negativeOriginal.route.some(
      (routePoint) => routePoint.route_type === "through_pad",
    )
  ) {
    return failure(
      "unsupported_route_geometry",
      "through-pad route geometry is not supported by coupled routing",
    )
  }
  const positiveWires = positiveOriginal.route.filter(
    (routePoint): routePoint is PcbTraceWireRoutePoint =>
      routePoint.route_type === "wire",
  )
  const negativeWires = negativeOriginal.route.filter(
    (routePoint): routePoint is PcbTraceWireRoutePoint =>
      routePoint.route_type === "wire",
  )
  const positiveStart = positiveWires[0]!
  const positiveEnd = positiveWires[positiveWires.length - 1]!
  const negativeStart = negativeWires[0]!
  const negativeEnd = negativeWires[negativeWires.length - 1]!
  const finalTerminalGap = Math.hypot(
    positiveEnd.x - negativeEnd.x,
    positiveEnd.y - negativeEnd.y,
  )
  if (finalTerminalGap > params.maxCenterlineSpacing + 1e-9) {
    throw new DifferentialPairInputError(
      "invalid_state",
      `DifferentialPairPostProcessingSolver: differential pair "${pair.name}" has final terminal gap ${finalTerminalGap} exceeding maximum centerline spacing ${params.maxCenterlineSpacing}`,
    )
  }
  if (
    positiveStart.layer !== negativeStart.layer ||
    positiveEnd.layer !== negativeEnd.layer
  ) {
    return failure(
      "no_common_layer_route",
      "pair members do not share a layer at both terminal stations",
    )
  }
  const positiveWidth = Math.max(...positiveWires.map((wire) => wire.width))
  const negativeWidth = Math.max(...negativeWires.map((wire) => wire.width))
  const effectiveMinimumSpacing = Math.max(
    params.minCenterlineSpacing,
    positiveWidth / 2 +
      negativeWidth / 2 +
      params.designRules.traceToTraceClearance,
  )
  if (effectiveMinimumSpacing > params.maxCenterlineSpacing) {
    return failure(
      "spacing_bounds_unsatisfiable",
      `effective minimum centerline spacing ${effectiveMinimumSpacing} exceeds maximum ${params.maxCenterlineSpacing}`,
    )
  }

  const originalStartMidpoint = {
    x: (positiveStart.x + negativeStart.x) / 2,
    y: (positiveStart.y + negativeStart.y) / 2,
  }
  const originalEndMidpoint = {
    x: (positiveEnd.x + negativeEnd.x) / 2,
    y: (positiveEnd.y + negativeEnd.y) / 2,
  }
  const spineVector = {
    x: originalEndMidpoint.x - originalStartMidpoint.x,
    y: originalEndMidpoint.y - originalStartMidpoint.y,
  }
  const spineLength = Math.hypot(spineVector.x, spineVector.y)
  if (spineLength <= 1e-9) {
    return failure(
      "terminal_escape_failed",
      "terminal midpoints do not define a nonzero routing spine",
    )
  }
  const spineDirection = {
    x: spineVector.x / spineLength,
    y: spineVector.y / spineLength,
  }
  const unsignedNormal = {
    x: -spineDirection.y,
    y: spineDirection.x,
  }
  const startLaneVector = {
    x: positiveStart.x - negativeStart.x,
    y: positiveStart.y - negativeStart.y,
  }
  const endLaneVector = {
    x: positiveEnd.x - negativeEnd.x,
    y: positiveEnd.y - negativeEnd.y,
  }
  const startOrientation =
    startLaneVector.x * unsignedNormal.x + startLaneVector.y * unsignedNormal.y
  const endOrientation =
    endLaneVector.x * unsignedNormal.x + endLaneVector.y * unsignedNormal.y
  if (
    Math.abs(startOrientation) > 1e-9 &&
    Math.abs(endOrientation) > 1e-9 &&
    Math.sign(startOrientation) !== Math.sign(endOrientation)
  ) {
    return failure(
      "terminal_escape_failed",
      "fixed terminals require positive and negative lanes to exchange sides",
    )
  }
  const orientationSign =
    Math.abs(startOrientation) > 1e-9
      ? Math.sign(startOrientation)
      : Math.abs(endOrientation) > 1e-9
        ? Math.sign(endOrientation)
        : 1
  const laneSideSign = orientationSign as 1 | -1
  const targetSpacing =
    (effectiveMinimumSpacing + params.maxCenterlineSpacing) / 2
  const laneOffset = {
    x: unsignedNormal.x * orientationSign * targetSpacing * 0.5,
    y: unsignedNormal.y * orientationSign * targetSpacing * 0.5,
  }
  const getLanePoint = (midpoint: Point, polarity: 1 | -1): Point => ({
    x: midpoint.x + laneOffset.x * polarity,
    y: midpoint.y + laneOffset.y * polarity,
  })
  const startNeedsEscape =
    Math.hypot(
      positiveStart.x - getLanePoint(originalStartMidpoint, 1).x,
      positiveStart.y - getLanePoint(originalStartMidpoint, 1).y,
    ) > 1e-8 ||
    Math.hypot(
      negativeStart.x - getLanePoint(originalStartMidpoint, -1).x,
      negativeStart.y - getLanePoint(originalStartMidpoint, -1).y,
    ) > 1e-8
  const endNeedsEscape =
    Math.hypot(
      positiveEnd.x - getLanePoint(originalEndMidpoint, 1).x,
      positiveEnd.y - getLanePoint(originalEndMidpoint, 1).y,
    ) > 1e-8 ||
    Math.hypot(
      negativeEnd.x - getLanePoint(originalEndMidpoint, -1).x,
      negativeEnd.y - getLanePoint(originalEndMidpoint, -1).y,
    ) > 1e-8
  const minimumEscapeDistance = Math.max(effectiveMinimumSpacing * 2, 0.5)
  if (
    (startNeedsEscape || endNeedsEscape) &&
    spineLength <
      minimumEscapeDistance *
        (Number(startNeedsEscape) + Number(endNeedsEscape))
  ) {
    return failure(
      "terminal_escape_failed",
      "insufficient route length to enter the centerline-spacing envelope",
    )
  }
  const maximumEscapeDistance =
    spineLength /
    Math.max(Number(startNeedsEscape) + Number(endNeedsEscape) + 1, 2)
  const escapeDistances = [0]
  if (startNeedsEscape || endNeedsEscape) {
    escapeDistances.length = 0
    for (
      let escapeDistance = minimumEscapeDistance;
      escapeDistance <= maximumEscapeDistance + 1e-9;
      escapeDistance += 0.25
    ) {
      escapeDistances.push(escapeDistance)
    }
    if (escapeDistances.length === 0) {
      escapeDistances.push(minimumEscapeDistance)
    }
  }

  const drcChecker = new DifferentialPairDrcChecker(
    params,
    positiveOriginal,
    negativeOriginal,
    [positiveStart, positiveEnd, negativeStart, negativeEnd],
    transactionalPcbTraces,
    transactionalPcbVias,
  )
  let lastRecoverableFailure: DifferentialPairRoutingAttempt | null = null
  let exploredStateCount = 0

  for (const escapeDistance of escapeDistances) {
    const startMidpoint = startNeedsEscape
      ? {
          x: originalStartMidpoint.x + spineDirection.x * escapeDistance,
          y: originalStartMidpoint.y + spineDirection.y * escapeDistance,
        }
      : originalStartMidpoint
    const endMidpoint = endNeedsEscape
      ? {
          x: originalEndMidpoint.x - spineDirection.x * escapeDistance,
          y: originalEndMidpoint.y - spineDirection.y * escapeDistance,
        }
      : originalEndMidpoint
    if (
      (endMidpoint.x - startMidpoint.x) * spineDirection.x +
        (endMidpoint.y - startMidpoint.y) * spineDirection.y <=
      1e-9
    ) {
      continue
    }
    const geometry: PairLaneGeometry = {
      laneOffset,
      laneSideSign,
      targetSpacing,
      positiveStart,
      negativeStart,
      positiveEnd,
      negativeEnd,
      startMidpoint,
      endMidpoint,
      startLayer: positiveStart.layer,
      endLayer: positiveEnd.layer,
      positiveWidth,
      negativeWidth,
      effectiveMinimumSpacing,
    }
    const pathSearch = findCoupledPath({
      pair,
      geometry,
      params,
      positiveOriginal,
      negativeOriginal,
      drcChecker,
    })
    exploredStateCount += pathSearch.exploredStateCount
    if (pathSearch.status === "failed") {
      lastRecoverableFailure = failure(
        pathSearch.hitIterationLimit
          ? "iteration_limit_reached"
          : positiveStart.layer !== positiveEnd.layer
            ? "no_common_layer_route"
            : "obstacle_route_failed",
        pathSearch.hitIterationLimit
          ? `coupled path search exceeded its bounded state budget after ${exploredStateCount} states`
          : "no DRC-valid coupled path was found for any supported paired-via budget",
      )
      continue
    }
    const candidate = createRoutedPairCandidate({
      pair,
      path: pathSearch.path,
      geometry,
      params,
      positiveOriginal,
      negativeOriginal,
      positiveOriginalStart: positiveStart,
      positiveOriginalEnd: positiveEnd,
      negativeOriginalStart: negativeStart,
      negativeOriginalEnd: negativeEnd,
    })
    const validateCandidate = (routedPairCandidate: RoutedPairCandidate) =>
      validateDifferentialPairCandidate({
        pair,
        params,
        geometry,
        candidate: routedPairCandidate,
        drcChecker,
      })
    let validation = validateCandidate(candidate)
    let routedCandidate = candidate
    if (
      validation.status === "failed" &&
      validation.failure.category === "length_skew_unsatisfied"
    ) {
      const correctedCandidate = correctLengthSkew({
        pair,
        candidate,
        params,
        isCandidateValid: (candidateToValidate) =>
          validateCandidate(candidateToValidate).status === "valid",
      })
      if (correctedCandidate) {
        routedCandidate = correctedCandidate
        validation = validateCandidate(correctedCandidate)
      }
    }
    if (validation.status === "failed") {
      lastRecoverableFailure = {
        status: "failed",
        failure: validation.failure,
      }
      continue
    }
    return {
      status: "routed",
      routedPair: {
        positivePcbTrace: {
          ...positiveOriginal,
          route: routedCandidate.positiveRoute,
          trace_length: validation.positiveLength,
        },
        negativePcbTrace: {
          ...negativeOriginal,
          route: routedCandidate.negativeRoute,
          trace_length: validation.negativeLength,
        },
        pcbVias: routedCandidate.pcbVias,
      },
    }
  }
  return (
    lastRecoverableFailure ??
    failure(
      "terminal_escape_failed",
      "no terminal escape distance leaves a nonempty coupled routing region",
    )
  )
}
