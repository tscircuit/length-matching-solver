import { parseSimplifiedPcbTrace } from "../model/parseSimplifiedPcbTrace"
import { hasInlineTerminalPair } from "./hasInlineTerminalPair"
import { DifferentialPairRoutingError } from "../errors/DifferentialPairRoutingError"
import type { ParsedTrace, Point } from "../model/internal-types"
import type { CandidateGeometryContext } from "../geometry/validateCandidateGeometry"
import type { DifferentialPairRoutingInput } from "./DifferentialPairRoutingSession"
import type { CoupledPathPoint } from "./types"

export type PairRoutingGeometry = {
  pair: DifferentialPairRoutingInput["pair"]
  routingGrid: DifferentialPairRoutingInput["routingGrid"]
  first: ParsedTrace
  second: ParsedTrace
  reverseSecond: boolean
  context: CandidateGeometryContext
  start: CoupledPathPoint
  end: CoupledPathPoint
  firstStart: CoupledPathPoint
  firstEnd: CoupledPathPoint
  secondStart: CoupledPathPoint
  secondEnd: CoupledPathPoint
  preferredSide: 1 | -1
  normal: Point
  spineDirection: Point
  spineLength: number
  bothEndsAreInline: boolean
  hasMixedTerminalOrientation: boolean
}

export function getPairRoutingGeometry(
  input: DifferentialPairRoutingInput,
): PairRoutingGeometry {
  const firstMatches = input.traces
    .map((trace, index) => ({ trace, index }))
    .filter(
      ({ trace }) => trace.connection_name === input.pair.connectionNames[0],
    )
  const secondMatches = input.traces
    .map((trace, index) => ({ trace, index }))
    .filter(
      ({ trace }) => trace.connection_name === input.pair.connectionNames[1],
    )
  if (firstMatches.length !== 1 || secondMatches.length !== 1)
    throw new DifferentialPairRoutingError({
      connectionNames: input.pair.connectionNames,
      reason: "trace-resolution-failure",
      message:
        "must resolve each connection_name to exactly one non-branching trace",
    })
  if (firstMatches[0]!.index === secondMatches[0]!.index)
    throw new DifferentialPairRoutingError({
      connectionNames: input.pair.connectionNames,
      reason: "trace-resolution-failure",
      message: "resolved both members to one trace",
    })

  let first: ParsedTrace
  let second: ParsedTrace
  try {
    first = parseSimplifiedPcbTrace(firstMatches[0]!.trace, input.layerCount)
    second = parseSimplifiedPcbTrace(secondMatches[0]!.trace, input.layerCount)
  } catch (error) {
    let message = String(error)
    if (error instanceof Error) message = error.message
    throw new DifferentialPairRoutingError({
      connectionNames: input.pair.connectionNames,
      reason: "invalid-routed-geometry",
      message: `has unsupported or invalid routed geometry: ${message}`,
    })
  }
  const firstStart = first.points[0]!
  const firstEnd = first.points.at(-1)!
  const normalSecondCost =
    Math.hypot(
      firstStart.x - second.points[0]!.x,
      firstStart.y - second.points[0]!.y,
    ) +
    Math.hypot(
      firstEnd.x - second.points.at(-1)!.x,
      firstEnd.y - second.points.at(-1)!.y,
    )
  const reversedSecondCost =
    Math.hypot(
      firstStart.x - second.points.at(-1)!.x,
      firstStart.y - second.points.at(-1)!.y,
    ) +
    Math.hypot(
      firstEnd.x - second.points[0]!.x,
      firstEnd.y - second.points[0]!.y,
    )
  const reverseSecond = reversedSecondCost + 1e-8 < normalSecondCost
  let secondStart = second.points[0]!
  let secondEnd = second.points.at(-1)!
  if (reverseSecond) [secondStart, secondEnd] = [secondEnd, secondStart]
  if (
    firstStart.layer !== secondStart.layer ||
    firstEnd.layer !== secondEnd.layer
  )
    throw new DifferentialPairRoutingError({
      connectionNames: input.pair.connectionNames,
      reason: "terminal-layer-mismatch",
      message: "does not have common paired layers at both terminal stations",
    })

  const start = {
    x: (firstStart.x + secondStart.x) / 2,
    y: (firstStart.y + secondStart.y) / 2,
    layer: firstStart.layer,
  }
  const end = {
    x: (firstEnd.x + secondEnd.x) / 2,
    y: (firstEnd.y + secondEnd.y) / 2,
    layer: firstEnd.layer,
  }
  const spineLength = Math.hypot(end.x - start.x, end.y - start.y)
  if (spineLength < 1e-6)
    throw new DifferentialPairRoutingError({
      connectionNames: input.pair.connectionNames,
      reason: "coincident-terminal-midpoints",
      message: "has coincident terminal-pair midpoints",
    })
  const normal = {
    x: -(end.y - start.y) / spineLength,
    y: (end.x - start.x) / spineLength,
  }
  const terminalDelta = {
    x: firstStart.x - secondStart.x,
    y: firstStart.y - secondStart.y,
  }
  let preferredSide: 1 | -1 = 1
  if (terminalDelta.x * normal.x + terminalDelta.y * normal.y < 0)
    preferredSide = -1
  const startPairIsInline = hasInlineTerminalPair(
    [firstStart, secondStart],
    normal,
  )
  const endPairIsInline = hasInlineTerminalPair([firstEnd, secondEnd], normal)
  const bothEndsAreInline = startPairIsInline && endPairIsInline
  const hasMixedTerminalOrientation = startPairIsInline !== endPairIsInline
  const spineDirection = { x: normal.y, y: -normal.x }
  const context: CandidateGeometryContext = {
    immutableTraces: input.traces.filter(
      (_, index) =>
        index !== firstMatches[0]!.index && index !== secondMatches[0]!.index,
    ),
    obstacles: input.obstacles,
    bounds: input.bounds,
    layerCount: input.layerCount,
    minTraceToPadEdgeClearance: input.minTraceToPadEdgeClearance,
  }
  return {
    pair: input.pair,
    routingGrid: input.routingGrid,
    first,
    second,
    reverseSecond,
    context,
    start,
    end,
    firstStart,
    secondStart,
    firstEnd,
    secondEnd,
    preferredSide,
    normal,
    spineLength,
    spineDirection,
    bothEndsAreInline,
    hasMixedTerminalOrientation,
  }
}
