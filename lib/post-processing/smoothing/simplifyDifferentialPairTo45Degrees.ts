import { getMinimumSegmentDistance } from "../../route-geometry"
import type {
  DifferentialPair,
  SimplifiedPcbTrace,
  SimplifiedPcbTraceWireRoutePoint,
  SimplifiedPcbTraces,
} from "../../types"
import { validateCandidateGeometry } from "../geometry/validateCandidateGeometry"
import { getSimplifiedTraceLength } from "../length-matching/getSimplifiedTraceLength"
import { parseSimplifiedPcbTrace } from "../model/parseSimplifiedPcbTrace"

const EPSILON = 1e-8

type Point = { x: number; y: number }
type PathOption = {
  points: Point[]
  usableStraightLength: number
  bendCount: number
  priority: number
}
type Span = { startIndex: number; endIndex: number; skippedPointCount: number }

/** Greedily replace the farthest valid same-layer spans with 45-degree paths. */
export const simplifyDifferentialPairTo45Degrees = (input: {
  traces: SimplifiedPcbTraces
  pair: DifferentialPair
  obstacles: Parameters<typeof validateCandidateGeometry>[2]["obstacles"]
  bounds: Parameters<typeof validateCandidateGeometry>[2]["bounds"]
  layerCount: number
  minTraceToPadEdgeClearance?: number
}): SimplifiedPcbTraces => {
  const pairName = input.pair.connectionNames.join("/")
  const indexes = input.pair.connectionNames.map((connectionName) =>
    input.traces
      .map((trace, index) => ({ trace, index }))
      .filter(({ trace }) => trace.connection_name === connectionName),
  )
  if (indexes[0]!.length !== 1 || indexes[1]!.length !== 1)
    throw new Error(
      `FortyFiveDegreeSimplificationSolver: pair ${pairName} must resolve to exactly two traces`,
    )
  const firstIndex = indexes[0]![0]!.index
  const secondIndex = indexes[1]![0]!.index
  if (firstIndex === secondIndex)
    throw new Error(
      `FortyFiveDegreeSimplificationSolver: pair ${pairName} resolved both members to one trace`,
    )

  const output = structuredClone(input.traces)
  const context = {
    immutableTraces: output.filter(
      (_, index) => index !== firstIndex && index !== secondIndex,
    ),
    obstacles: input.obstacles,
    bounds: input.bounds,
    layerCount: input.layerCount,
    minTraceToPadEdgeClearance: input.minTraceToPadEdgeClearance,
  }
  const getMaximumInteriorPairSeparation = (
    traces: SimplifiedPcbTraces,
  ): number => {
    const first = parseSimplifiedPcbTrace(traces[firstIndex]!, input.layerCount)
    const second = parseSimplifiedPcbTrace(
      traces[secondIndex]!,
      input.layerCount,
    )
    let maximumSeparation = 0
    for (const [segments, otherSegments] of [
      [first.segments, second.segments],
      [second.segments, first.segments],
    ] as const) {
      for (const segment of segments) {
        if (segment.terminal !== null) continue
        const sameLayerSegments = otherSegments.filter(
          (other) => other.layer === segment.layer,
        )
        if (sameLayerSegments.length === 0)
          throw new Error(
            `FortyFiveDegreeSimplificationSolver: pair ${pairName} lost common-layer interior copper`,
          )
        maximumSeparation = Math.max(
          maximumSeparation,
          Math.min(
            ...sameLayerSegments.map((other) =>
              getMinimumSegmentDistance(
                segment.start,
                segment.end,
                other.start,
                other.end,
              ),
            ),
          ),
        )
      }
    }
    return maximumSeparation
  }
  const getMinimumInteriorPairEdgeGap = (
    traces: SimplifiedPcbTraces,
  ): number | null => {
    const first = parseSimplifiedPcbTrace(traces[firstIndex]!, input.layerCount)
    const second = parseSimplifiedPcbTrace(
      traces[secondIndex]!,
      input.layerCount,
    )
    let minimumGap = Number.POSITIVE_INFINITY
    for (const [segments, otherSegments] of [
      [first.segments, second.segments],
      [second.segments, first.segments],
    ] as const) {
      for (const segment of segments) {
        if (segment.terminal !== null) continue
        for (const other of otherSegments) {
          if (other.layer !== segment.layer) continue
          minimumGap = Math.min(
            minimumGap,
            getMinimumSegmentDistance(
              segment.start,
              segment.end,
              other.start,
              other.end,
            ) -
              segment.width / 2 -
              other.width / 2,
          )
        }
      }
    }
    return Number.isFinite(minimumGap) ? minimumGap : null
  }
  const validatePairGeometry = (traces: SimplifiedPcbTraces): boolean => {
    const first = parseSimplifiedPcbTrace(traces[firstIndex]!, input.layerCount)
    const second = parseSimplifiedPcbTrace(
      traces[secondIndex]!,
      input.layerCount,
    )
    return validateCandidateGeometry(first, second, context)
  }
  if (!validatePairGeometry(output))
    throw new Error(
      `FortyFiveDegreeSimplificationSolver: rerouted pair ${pairName} has invalid complete copper before simplification`,
    )
  const exactCenterlineSpacingIsRequired =
    input.pair.maxUncoupledLength !== undefined &&
    input.pair.minimumCenterlineDistance !== undefined &&
    input.pair.maximumCenterlineDistance !== undefined &&
    Math.abs(
      input.pair.minimumCenterlineDistance -
        input.pair.maximumCenterlineDistance,
    ) <= EPSILON
  // Independent 45-degree span replacement can retain minimum clearance while
  // separating the members across the middle of a long segment. Keep the
  // coupled rerouter's geometry when the caller requested one exact spacing.
  if (exactCenterlineSpacingIsRequired) return output

  const initialFirst = parseSimplifiedPcbTrace(
    output[firstIndex]!,
    input.layerCount,
  )
  const initialSecond = parseSimplifiedPcbTrace(
    output[secondIndex]!,
    input.layerCount,
  )
  const initialLengthDifference = Math.abs(
    getSimplifiedTraceLength(initialFirst) -
      getSimplifiedTraceLength(initialSecond),
  )
  const initialMinimumInteriorPairEdgeGap =
    getMinimumInteriorPairEdgeGap(output)
  const preferredMaximumCenterSpacing =
    input.pair.maximumCenterlineDistance ??
    1 + initialFirst.width / 2 + initialSecond.width / 2
  const maximumInteriorPairSeparation = Math.min(
    getMaximumInteriorPairSeparation(output),
    preferredMaximumCenterSpacing,
  )
  const validatePair = (traces: SimplifiedPcbTraces): boolean => {
    if (!validatePairGeometry(traces)) return false
    if (
      getMaximumInteriorPairSeparation(traces) >
      maximumInteriorPairSeparation + EPSILON
    )
      return false
    const minimumInteriorPairEdgeGap = getMinimumInteriorPairEdgeGap(traces)
    return (
      initialMinimumInteriorPairEdgeGap === null ||
      minimumInteriorPairEdgeGap === null ||
      minimumInteriorPairEdgeGap >= initialMinimumInteriorPairEdgeGap - EPSILON
    )
  }

  const createPathOptions = (start: Point, end: Point): PathOption[] => {
    const dx = Math.abs(end.x - start.x)
    const dy = Math.abs(end.y - start.y)
    const signX = end.x >= start.x ? 1 : -1
    const signY = end.y >= start.y ? 1 : -1
    const candidates: Point[][] = []
    const horizontalThenDiagonal = {
      x: end.x - signX * dy,
      y: start.y,
    }
    if (
      (horizontalThenDiagonal.x - start.x) * signX >= -EPSILON &&
      (horizontalThenDiagonal.x - end.x) * signX <= EPSILON
    )
      candidates.push([start, horizontalThenDiagonal, end])
    const verticalThenDiagonal = {
      x: start.x,
      y: end.y - signY * dx,
    }
    if (
      (verticalThenDiagonal.y - start.y) * signY >= -EPSILON &&
      (verticalThenDiagonal.y - end.y) * signY <= EPSILON
    )
      candidates.push([start, verticalThenDiagonal, end])
    const diagonalThenStraight = {
      x: start.x + signX * Math.min(dx, dy),
      y: start.y + signY * Math.min(dx, dy),
    }
    candidates.push([start, diagonalThenStraight, end])

    return candidates
      .map((points, priority) => {
        const uniquePoints = points.filter(
          (point, index) =>
            index === 0 ||
            Math.hypot(
              point.x - points[index - 1]!.x,
              point.y - points[index - 1]!.y,
            ) > EPSILON,
        )
        const segmentLengths = uniquePoints.slice(0, -1).map((point, index) => {
          const next = uniquePoints[index + 1]!
          const segmentDx = Math.abs(next.x - point.x)
          const segmentDy = Math.abs(next.y - point.y)
          return {
            length: Math.hypot(segmentDx, segmentDy),
            straight:
              segmentDx <= EPSILON || segmentDy <= EPSILON
                ? Math.hypot(segmentDx, segmentDy)
                : 0,
          }
        })
        return {
          points: uniquePoints,
          usableStraightLength: Math.max(
            0,
            ...segmentLengths.map((segment) => segment.straight),
          ),
          bendCount: Math.max(0, uniquePoints.length - 2),
          priority,
        }
      })
      .filter(
        (option, optionIndex, options) =>
          options.findIndex(
            (other) =>
              JSON.stringify(other.points) === JSON.stringify(option.points),
          ) === optionIndex,
      )
      .sort(
        (left, right) =>
          right.usableStraightLength - left.usableStraightLength ||
          left.bendCount - right.bendCount ||
          left.priority - right.priority,
      )
  }

  const createSpans = (trace: SimplifiedPcbTrace): Span[] => {
    const spans: Span[] = []
    for (
      let startIndex = 0;
      startIndex < trace.route.length - 1;
      startIndex++
    ) {
      const start = trace.route[startIndex]
      if (start?.route_type !== "wire") continue
      for (
        let endIndex = trace.route.length - 1;
        endIndex >= startIndex + 1;
        endIndex--
      ) {
        // Terminal geometry sets the copper's pad egress. Replacing a
        // terminal-adjacent span can create a short orthogonal spike there.
        if (startIndex === 0 || endIndex === trace.route.length - 1) continue
        const end = trace.route[endIndex]
        if (end?.route_type !== "wire" || end.layer !== start.layer) continue
        const middle = trace.route.slice(startIndex + 1, endIndex)
        if (
          middle.some(
            (entry) =>
              entry.route_type !== "wire" || entry.layer !== start.layer,
          )
        )
          continue
        spans.push({
          startIndex,
          endIndex,
          skippedPointCount: endIndex - startIndex - 1,
        })
      }
    }
    return spans.sort(
      (left, right) =>
        right.skippedPointCount - left.skippedPointCount ||
        left.startIndex - right.startIndex ||
        right.endIndex - left.endIndex,
    )
  }

  const createReplacement = (
    trace: SimplifiedPcbTrace,
    span: Span,
    option: PathOption,
  ): SimplifiedPcbTrace => {
    const start = trace.route[
      span.startIndex
    ] as SimplifiedPcbTraceWireRoutePoint
    const end = trace.route[span.endIndex] as SimplifiedPcbTraceWireRoutePoint
    const width = Math.max(start.width, end.width)
    const intermediateWires: SimplifiedPcbTraceWireRoutePoint[] = option.points
      .slice(1, -1)
      .map((point) => ({
        route_type: "wire",
        ...point,
        width,
        layer: start.layer,
      }))
    return {
      ...trace,
      route: [
        ...trace.route.slice(0, span.startIndex + 1),
        ...intermediateWires,
        ...trace.route.slice(span.endIndex),
      ],
    }
  }

  for (const traceIndex of [firstIndex, secondIndex]) {
    let changed = true
    while (changed) {
      changed = false
      const trace = output[traceIndex]!
      for (const span of createSpans(trace)) {
        const start = trace.route[
          span.startIndex
        ] as SimplifiedPcbTraceWireRoutePoint
        const end = trace.route[
          span.endIndex
        ] as SimplifiedPcbTraceWireRoutePoint
        const originalSpan = trace.route.slice(
          span.startIndex,
          span.endIndex + 1,
        ) as SimplifiedPcbTraceWireRoutePoint[]
        const originalIs45Degree = originalSpan
          .slice(0, -1)
          .every((point, index) => {
            const next = originalSpan[index + 1]!
            const dx = Math.abs(next.x - point.x)
            const dy = Math.abs(next.y - point.y)
            return (
              dx <= EPSILON || dy <= EPSILON || Math.abs(dx - dy) <= EPSILON
            )
          })
        for (const option of createPathOptions(start, end)) {
          if (option.points.length >= originalSpan.length && originalIs45Degree)
            continue
          const replacement = createReplacement(trace, span, option)
          const candidate = [...output]
          candidate[traceIndex] = replacement
          if (JSON.stringify(replacement.route) === JSON.stringify(trace.route))
            continue
          if (validatePair(candidate)) {
            output[traceIndex] = replacement
            changed = true
            break
          }

          const otherTraceIndex =
            traceIndex === firstIndex ? secondIndex : firstIndex
          const otherTrace = output[otherTraceIndex]!
          const correspondingSpan = createSpans(otherTrace).find(
            (otherSpan) =>
              otherSpan.startIndex === span.startIndex &&
              otherSpan.endIndex === span.endIndex,
          )
          if (!correspondingSpan) continue
          const otherStart = otherTrace.route[
            correspondingSpan.startIndex
          ] as SimplifiedPcbTraceWireRoutePoint
          const otherEnd = otherTrace.route[
            correspondingSpan.endIndex
          ] as SimplifiedPcbTraceWireRoutePoint
          for (const otherOption of createPathOptions(otherStart, otherEnd)) {
            const otherReplacement = createReplacement(
              otherTrace,
              correspondingSpan,
              otherOption,
            )
            const atomicCandidate = [...candidate]
            atomicCandidate[otherTraceIndex] = otherReplacement
            if (!validatePair(atomicCandidate)) continue
            output[traceIndex] = replacement
            output[otherTraceIndex] = otherReplacement
            changed = true
            break
          }
          if (changed) break
        }
        if (changed) break
      }
    }
  }
  if (!validatePair(output))
    throw new Error(
      `FortyFiveDegreeSimplificationSolver: pair ${pairName} produced invalid complete copper`,
    )
  const finalFirst = parseSimplifiedPcbTrace(
    output[firstIndex]!,
    input.layerCount,
  )
  const finalSecond = parseSimplifiedPcbTrace(
    output[secondIndex]!,
    input.layerCount,
  )
  const finalLengthDifference = Math.abs(
    getSimplifiedTraceLength(finalFirst) -
      getSimplifiedTraceLength(finalSecond),
  )
  // Commit smoothing atomically only when it preserves the pair's differential
  // length; otherwise the regular matcher would have to undo smoothing quality.
  if (
    Math.abs(finalLengthDifference - initialLengthDifference) >
    input.pair.lengthTolerance + EPSILON
  )
    return structuredClone(input.traces)
  return output
}
