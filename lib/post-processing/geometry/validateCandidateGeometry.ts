import { getObstacleLayerIndexes } from "../../obstacles/getObstacleLayerIndexes"
import { getMinimumSegmentDistance } from "../../route-geometry"
import type { Obstacle, SimplifiedPcbTrace } from "../../types"
import type {
  CopperSegment,
  CopperVia,
  ParsedTrace,
  Point,
} from "../model/internal-types"
import { getTraceCopperGeometry } from "../model/getTraceCopperGeometry"
import { getLayerIndex } from "./getLayerIndex"
import { segmentTouchesInflatedObstacle } from "./segmentTouchesInflatedObstacle"

export type CandidateGeometryContext = {
  immutableTraces: SimplifiedPcbTrace[]
  obstacles: Obstacle[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  minTraceToPadEdgeClearance?: number
}

/** Validate complete replacement copper against bounds, obstacles, and immutable copper. */
export const validateCandidateGeometry = (
  first: ParsedTrace,
  second: ParsedTrace,
  context: CandidateGeometryContext,
): boolean => {
  const EPSILON = 1e-7

  const rotateIntoObstacle = (point: Point, obstacle: Obstacle): Point => {
    const radians = (-(obstacle.ccwRotationDegrees ?? 0) * Math.PI) / 180
    const dx = point.x - obstacle.center.x
    const dy = point.y - obstacle.center.y
    return {
      x: dx * Math.cos(radians) - dy * Math.sin(radians),
      y: dx * Math.sin(radians) + dy * Math.cos(radians),
    }
  }

  const pointToSegmentDistance = (
    point: Point,
    start: Point,
    end: Point,
  ): number => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const progress =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point.x - start.x) * dx + (point.y - start.y) * dy) /
                lengthSquared,
            ),
          )
    return Math.hypot(
      point.x - (start.x + progress * dx),
      point.y - (start.y + progress * dy),
    )
  }

  const isObstacleOnLayer = (
    obstacle: Obstacle,
    layer: string,
    layerCount: number,
  ): boolean => {
    const layerIndex = getLayerIndex(layer, layerCount)
    return getObstacleLayerIndexes(obstacle, layerCount).includes(layerIndex)
  }

  const getImmutableCopper = (
    traces: SimplifiedPcbTrace[],
    layerCount: number,
  ): { segments: CopperSegment[]; vias: CopperVia[] } => {
    const segments: CopperSegment[] = []
    const vias: CopperVia[] = []
    for (const trace of traces) {
      const copper = getTraceCopperGeometry(trace, layerCount)
      segments.push(...copper.segments)
      vias.push(...copper.vias)
    }
    return { segments, vias }
  }

  const isSegmentValid = (
    segment: CopperSegment,
    context: CandidateGeometryContext,
    immutableCopper: ReturnType<typeof getImmutableCopper>,
  ): boolean => {
    const radius = segment.width / 2
    if (
      segment.start.x - radius < context.bounds.minX - EPSILON ||
      segment.start.x + radius > context.bounds.maxX + EPSILON ||
      segment.start.y - radius < context.bounds.minY - EPSILON ||
      segment.start.y + radius > context.bounds.maxY + EPSILON ||
      segment.end.x - radius < context.bounds.minX - EPSILON ||
      segment.end.x + radius > context.bounds.maxX + EPSILON ||
      segment.end.y - radius < context.bounds.minY - EPSILON ||
      segment.end.y + radius > context.bounds.maxY + EPSILON
    )
      return false
    for (const obstacle of context.obstacles) {
      if (!isObstacleOnLayer(obstacle, segment.layer, context.layerCount))
        continue
      const terminalPoints =
        segment.terminal === "both"
          ? [segment.start, segment.end]
          : segment.terminal === "start"
            ? [segment.start]
            : segment.terminal === "end"
              ? [segment.end]
              : []
      const exitsConnectedTerminalObstacle =
        obstacle.connectedTo.includes(segment.connectionName) &&
        terminalPoints.some((terminalPoint) => {
          const localTerminal = rotateIntoObstacle(terminalPoint, obstacle)
          return (
            Math.abs(localTerminal.x) <= obstacle.width / 2 + EPSILON &&
            Math.abs(localTerminal.y) <= obstacle.height / 2 + EPSILON
          )
        })
      if (
        !exitsConnectedTerminalObstacle &&
        segmentTouchesInflatedObstacle(
          segment,
          obstacle,
          radius + (context.minTraceToPadEdgeClearance ?? segment.width),
        )
      )
        return false
    }
    for (const other of immutableCopper.segments) {
      if (other.layer !== segment.layer) continue
      const requiredDistance =
        segment.width / 2 +
        other.width / 2 +
        Math.max(segment.width, other.width)
      if (
        getMinimumSegmentDistance(
          segment.start,
          segment.end,
          other.start,
          other.end,
        ) <
        requiredDistance - EPSILON
      )
        return false
    }
    for (const via of immutableCopper.vias) {
      if (!via.layers.includes(segment.layer)) continue
      const requiredDistance =
        segment.width / 2 + via.diameter / 2 + segment.width
      if (
        pointToSegmentDistance(via, segment.start, segment.end) <
        requiredDistance - EPSILON
      )
        return false
    }
    return true
  }

  const isViaValid = (
    via: CopperVia,
    context: CandidateGeometryContext,
    immutableCopper: ReturnType<typeof getImmutableCopper>,
  ): boolean => {
    const radius = via.diameter / 2
    if (
      via.x - radius < context.bounds.minX - EPSILON ||
      via.x + radius > context.bounds.maxX + EPSILON ||
      via.y - radius < context.bounds.minY - EPSILON ||
      via.y + radius > context.bounds.maxY + EPSILON
    )
      return false
    for (const obstacle of context.obstacles) {
      if (
        !via.layers.some((layer) =>
          isObstacleOnLayer(obstacle, layer, context.layerCount),
        )
      )
        continue
      const local = rotateIntoObstacle(via, obstacle)
      const exitsConnectedTerminalObstacle =
        via.terminal !== null &&
        obstacle.connectedTo.includes(via.connectionName) &&
        Math.abs(local.x) <= obstacle.width / 2 + EPSILON &&
        Math.abs(local.y) <= obstacle.height / 2 + EPSILON
      if (
        !exitsConnectedTerminalObstacle &&
        Math.abs(local.x) <= obstacle.width / 2 + radius + via.diameter &&
        Math.abs(local.y) <= obstacle.height / 2 + radius + via.diameter
      )
        return false
    }
    for (const segment of immutableCopper.segments) {
      if (!via.layers.includes(segment.layer)) continue
      const requiredDistance =
        radius + segment.width / 2 + Math.max(via.diameter, segment.width)
      if (
        pointToSegmentDistance(via, segment.start, segment.end) <
        requiredDistance - EPSILON
      )
        return false
    }
    for (const other of immutableCopper.vias) {
      if (!other.layers.some((layer) => via.layers.includes(layer))) continue
      const requiredDistance =
        radius + other.diameter / 2 + Math.max(via.diameter, other.diameter)
      if (
        Math.hypot(via.x - other.x, via.y - other.y) <
        requiredDistance - EPSILON
      )
        return false
    }
    return true
  }

  const membersRemainSeparate = (
    first: ParsedTrace,
    second: ParsedTrace,
  ): boolean => {
    for (const firstSegment of first.segments) {
      for (const secondSegment of second.segments) {
        if (firstSegment.layer !== secondSegment.layer) continue
        const minimumDistance = firstSegment.width / 2 + secondSegment.width / 2
        if (
          getMinimumSegmentDistance(
            firstSegment.start,
            firstSegment.end,
            secondSegment.start,
            secondSegment.end,
          ) <
          minimumDistance - EPSILON
        )
          return false
      }
    }
    for (const [vias, segments] of [
      [first.vias, second.segments],
      [second.vias, first.segments],
    ] as const) {
      for (const via of vias) {
        for (const segment of segments) {
          if (!via.layers.includes(segment.layer)) continue
          if (
            pointToSegmentDistance(via, segment.start, segment.end) <
            via.diameter / 2 + segment.width / 2 - EPSILON
          )
            return false
        }
      }
    }
    for (const firstVia of first.vias) {
      for (const secondVia of second.vias) {
        if (!firstVia.layers.some((layer) => secondVia.layers.includes(layer)))
          continue
        if (
          Math.hypot(firstVia.x - secondVia.x, firstVia.y - secondVia.y) <
          firstVia.diameter / 2 + secondVia.diameter / 2 - EPSILON
        )
          return false
      }
    }
    return true
  }

  const hasSelfCollision = (parsed: ParsedTrace): boolean => {
    for (
      let firstIndex = 0;
      firstIndex < parsed.segments.length;
      firstIndex++
    ) {
      const firstSegment = parsed.segments[firstIndex]!
      for (
        let secondIndex = firstIndex + 2;
        secondIndex < parsed.segments.length;
        secondIndex++
      ) {
        const secondSegment = parsed.segments[secondIndex]!
        if (firstSegment.layer !== secondSegment.layer) continue
        const interveningLength = parsed.segments
          .slice(firstIndex + 1, secondIndex)
          .reduce(
            (total, segment) =>
              total +
              Math.hypot(
                segment.end.x - segment.start.x,
                segment.end.y - segment.start.y,
              ),
            0,
          )
        // Nearby tessellated curve segments belong to one continuous copper turn;
        // only test portions separated by enough centerline travel to be nonlocal.
        if (
          interveningLength <=
          firstSegment.width + secondSegment.width + EPSILON
        )
          continue
        if (
          getMinimumSegmentDistance(
            firstSegment.start,
            firstSegment.end,
            secondSegment.start,
            secondSegment.end,
          ) <
          firstSegment.width / 2 + secondSegment.width / 2 - EPSILON
        )
          return true
      }
    }
    for (const via of parsed.vias) {
      for (const segment of parsed.segments) {
        if (!via.layers.includes(segment.layer)) continue
        const touchesViaEndpoint =
          Math.hypot(via.x - segment.start.x, via.y - segment.start.y) <=
            EPSILON ||
          Math.hypot(via.x - segment.end.x, via.y - segment.end.y) <= EPSILON
        if (
          !touchesViaEndpoint &&
          pointToSegmentDistance(via, segment.start, segment.end) <
            via.diameter / 2 + segment.width / 2 - EPSILON
        )
          return true
      }
    }
    return false
  }

  const immutableCopper = getImmutableCopper(
    context.immutableTraces,
    context.layerCount,
  )
  if (
    !membersRemainSeparate(first, second) ||
    hasSelfCollision(first) ||
    hasSelfCollision(second)
  )
    return false
  for (const parsed of [first, second]) {
    if (
      parsed.segments.some(
        (segment) => !isSegmentValid(segment, context, immutableCopper),
      ) ||
      parsed.vias.some((via) => !isViaValid(via, context, immutableCopper))
    )
      return false
  }
  return true
}
