import { getMinimumSegmentDistance } from "../route-geometry"
import type { HighDensityRoute, RoutePoint } from "../types"
import { getLogicalConnectionName } from "./connection-routes"
import type { StraightRouteSpan } from "./straight-route-spans"

type CandidateRouteClearanceInput = {
  route: HighDensityRoute
  span: StraightRouteSpan
  meanderPoints: RoutePoint[]
  routedRoutes: HighDensityRoute[]
  obstacleMargin: number
}

const samePoint = (left: RoutePoint, right: RoutePoint): boolean =>
  left.x === right.x && left.y === right.y && left.z === right.z

const isSharedLogicalEndpoint = (
  candidatePoint: RoutePoint,
  otherStart: RoutePoint,
  otherEnd: RoutePoint,
): boolean =>
  samePoint(candidatePoint, otherStart) || samePoint(candidatePoint, otherEnd)

/** Check clearance against untouched route geometry and same-net sibling branches. */
export const isCandidateRouteClear = (
  input: CandidateRouteClearanceInput,
): boolean => {
  const connectionName = getLogicalConnectionName(input.route)
  const otherRouteChecks = input.routedRoutes.map((otherRoute) => ({
    otherRoute,
    sameRoute: otherRoute === input.route,
    sameConnection: getLogicalConnectionName(otherRoute) === connectionName,
    requiredDistance:
      input.route.traceThickness / 2 +
      otherRoute.traceThickness / 2 +
      input.obstacleMargin,
  }))
  const lastCandidateSegment = input.meanderPoints.length - 2
  for (
    let candidateIndex = 0;
    candidateIndex <= lastCandidateSegment;
    candidateIndex++
  ) {
    const start = input.meanderPoints[candidateIndex]!
    const end = input.meanderPoints[candidateIndex + 1]!
    const isFirstSegment = candidateIndex === 0
    const isLastSegment = candidateIndex === lastCandidateSegment
    for (const {
      otherRoute,
      sameRoute,
      sameConnection,
      requiredDistance,
    } of otherRouteChecks) {
      for (
        let otherIndex = 0;
        otherIndex < otherRoute.route.length - 1;
        otherIndex++
      ) {
        if (
          sameRoute &&
          otherIndex >= input.span.startIndex &&
          otherIndex < input.span.endIndex
        )
          continue
        if (
          sameRoute &&
          ((isFirstSegment && otherIndex === input.span.startIndex - 1) ||
            (isLastSegment && otherIndex === input.span.endIndex))
        )
          continue
        const otherStart = otherRoute.route[otherIndex]!
        const otherEnd = otherRoute.route[otherIndex + 1]!
        if (start.z !== otherStart.z || start.z !== otherEnd.z) continue
        if (
          sameConnection &&
          !sameRoute &&
          ((isFirstSegment &&
            isSharedLogicalEndpoint(start, otherStart, otherEnd)) ||
            (isLastSegment &&
              isSharedLogicalEndpoint(end, otherStart, otherEnd)))
        )
          continue
        if (
          getMinimumSegmentDistance(start, end, otherStart, otherEnd) <
          requiredDistance
        )
          return false
      }
    }
  }
  return true
}
