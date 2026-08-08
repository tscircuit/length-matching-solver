import { getMinimumSegmentDistance } from "../../route-geometry/getMinimumSegmentDistance"
import type {
  PcbLayer,
  PcbRoutingObstacle,
  PcbTraceForPostProcessing,
  PcbTraceWireRoutePoint,
  PcbViaForPostProcessing,
  ResolvedDifferentialPairPostProcessingParams,
} from "../types"
import type { Point } from "../routing/types"

export type DifferentialPairDrcViolation = {
  category: "obstacle_route_failed" | "paired_via_clearance_failed"
  message: string
  layer?: PcbLayer
  viaPairBudget?: number
}

export class DifferentialPairDrcChecker {
  private readonly unrelatedPcbTraces: PcbTraceForPostProcessing[]
  private readonly unrelatedPcbVias: PcbViaForPostProcessing[]
  private readonly terminalPoints: Point[]

  constructor(
    private readonly params: ResolvedDifferentialPairPostProcessingParams,
    positiveOriginal: PcbTraceForPostProcessing,
    negativeOriginal: PcbTraceForPostProcessing,
    terminalPoints: Point[],
    transactionalPcbTraces: PcbTraceForPostProcessing[],
    transactionalPcbVias: PcbViaForPostProcessing[],
  ) {
    const pairPcbTraceIds = new Set([
      positiveOriginal.pcb_trace_id,
      negativeOriginal.pcb_trace_id,
    ])
    this.unrelatedPcbTraces = transactionalPcbTraces.filter(
      (pcbTrace) => !pairPcbTraceIds.has(pcbTrace.pcb_trace_id),
    )
    this.unrelatedPcbVias = transactionalPcbVias.filter(
      (pcbVia) =>
        !pcbVia.pcb_trace_id || !pairPcbTraceIds.has(pcbVia.pcb_trace_id),
    )
    this.terminalPoints = terminalPoints
  }

  getTraceSegmentViolation(
    start: PcbTraceWireRoutePoint,
    end: PcbTraceWireRoutePoint,
    isTerminalEscape: boolean,
  ): DifferentialPairDrcViolation | null {
    const traceRadius = Math.max(start.width, end.width) / 2
    const boardClearance =
      this.params.designRules.boardEdgeClearance + traceRadius
    for (const point of [start, end]) {
      if (
        point.x < this.params.board.minX + boardClearance ||
        point.x > this.params.board.maxX - boardClearance ||
        point.y < this.params.board.minY + boardClearance ||
        point.y > this.params.board.maxY - boardClearance
      ) {
        return {
          category: "obstacle_route_failed",
          message: "candidate route violates board-edge clearance",
          layer: start.layer,
        }
      }
    }

    for (const obstacle of this.params.obstacles) {
      if (!obstacle.layers.includes(start.layer)) continue
      const containedTerminalCount = this.terminalPoints.filter(
        (terminalPoint) =>
          this.pointIsInsideObstacle(terminalPoint, obstacle, traceRadius),
      ).length
      const terminalObstacle = isTerminalEscape && containedTerminalCount === 1
      if (
        !terminalObstacle &&
        this.segmentHitsObstacle(start, end, obstacle, traceRadius)
      ) {
        return {
          category: "obstacle_route_failed",
          message: `candidate route intersects obstacle "${obstacle.obstacle_id}"`,
          layer: start.layer,
        }
      }
    }

    for (const unrelatedPcbTrace of this.unrelatedPcbTraces) {
      for (const unrelatedSegment of this.getWireSegments(unrelatedPcbTrace)) {
        if (unrelatedSegment.start.layer !== start.layer) continue
        const unrelatedRadius =
          Math.max(unrelatedSegment.start.width, unrelatedSegment.end.width) / 2
        if (
          getMinimumSegmentDistance(
            start,
            end,
            unrelatedSegment.start,
            unrelatedSegment.end,
          ) <
          traceRadius +
            unrelatedRadius +
            this.params.designRules.traceToTraceClearance -
            1e-9
        ) {
          return {
            category: "obstacle_route_failed",
            message: `candidate route violates clearance to PCB trace "${unrelatedPcbTrace.pcb_trace_id}"`,
            layer: start.layer,
          }
        }
      }
    }

    for (const pcbVia of this.unrelatedPcbVias) {
      if (!pcbVia.layers.includes(start.layer)) continue
      if (
        getMinimumSegmentDistance(start, end, pcbVia, pcbVia) <
        traceRadius +
          pcbVia.outer_diameter / 2 +
          this.params.designRules.viaToTraceClearance -
          1e-9
      ) {
        return {
          category: "obstacle_route_failed",
          message: `candidate route violates clearance to PCB via "${pcbVia.pcb_via_id}"`,
          layer: start.layer,
        }
      }
    }
    return null
  }

  getViaPairViolation(
    positivePcbVia: PcbViaForPostProcessing,
    negativePcbVia: PcbViaForPostProcessing,
    effectiveMinimumSpacing: number,
    viaPairBudget: number,
  ): DifferentialPairDrcViolation | null {
    const viaSpacing = Math.hypot(
      positivePcbVia.x - negativePcbVia.x,
      positivePcbVia.y - negativePcbVia.y,
    )
    const minimumViaSpacing = Math.max(
      effectiveMinimumSpacing,
      positivePcbVia.outer_diameter / 2 +
        negativePcbVia.outer_diameter / 2 +
        this.params.designRules.traceToTraceClearance,
    )
    if (
      viaSpacing < minimumViaSpacing - 1e-9 ||
      viaSpacing > this.params.maxCenterlineSpacing + 1e-9
    ) {
      return {
        category: "paired_via_clearance_failed",
        message: "paired transition does not satisfy centerline spacing",
        viaPairBudget,
      }
    }

    for (const replacementPcbVia of [positivePcbVia, negativePcbVia]) {
      const viaRadius = replacementPcbVia.outer_diameter / 2
      if (
        replacementPcbVia.x <
          this.params.board.minX +
            this.params.designRules.boardEdgeClearance +
            viaRadius ||
        replacementPcbVia.x >
          this.params.board.maxX -
            this.params.designRules.boardEdgeClearance -
            viaRadius ||
        replacementPcbVia.y <
          this.params.board.minY +
            this.params.designRules.boardEdgeClearance +
            viaRadius ||
        replacementPcbVia.y >
          this.params.board.maxY -
            this.params.designRules.boardEdgeClearance -
            viaRadius
      ) {
        return {
          category: "paired_via_clearance_failed",
          message: "paired transition violates board-edge clearance",
          viaPairBudget,
        }
      }
      for (const obstacle of this.params.obstacles) {
        if (
          obstacle.layers.some((layer) =>
            replacementPcbVia.layers.includes(layer),
          ) &&
          this.pointIsInsideObstacle(
            replacementPcbVia,
            obstacle,
            viaRadius + this.params.designRules.viaToObstacleClearance,
          )
        ) {
          return {
            category: "paired_via_clearance_failed",
            message: `paired transition intersects obstacle "${obstacle.obstacle_id}"`,
            viaPairBudget,
          }
        }
      }
      for (const pcbVia of this.unrelatedPcbVias) {
        if (
          !pcbVia.layers.some((layer) =>
            replacementPcbVia.layers.includes(layer),
          )
        ) {
          continue
        }
        if (
          Math.hypot(
            pcbVia.x - replacementPcbVia.x,
            pcbVia.y - replacementPcbVia.y,
          ) <
          pcbVia.outer_diameter / 2 +
            viaRadius +
            this.params.designRules.viaToObstacleClearance -
            1e-9
        ) {
          return {
            category: "paired_via_clearance_failed",
            message: `paired transition violates clearance to PCB via "${pcbVia.pcb_via_id}"`,
            viaPairBudget,
          }
        }
      }
      for (const unrelatedPcbTrace of this.unrelatedPcbTraces) {
        for (const unrelatedSegment of this.getWireSegments(
          unrelatedPcbTrace,
        )) {
          if (
            !replacementPcbVia.layers.includes(unrelatedSegment.start.layer)
          ) {
            continue
          }
          const unrelatedRadius =
            Math.max(unrelatedSegment.start.width, unrelatedSegment.end.width) /
            2
          if (
            getMinimumSegmentDistance(
              unrelatedSegment.start,
              unrelatedSegment.end,
              replacementPcbVia,
              replacementPcbVia,
            ) <
            viaRadius +
              unrelatedRadius +
              this.params.designRules.viaToTraceClearance -
              1e-9
          ) {
            return {
              category: "paired_via_clearance_failed",
              message: `paired transition violates clearance to PCB trace "${unrelatedPcbTrace.pcb_trace_id}"`,
              viaPairBudget,
            }
          }
        }
      }
    }
    return null
  }

  private pointIsInsideObstacle(
    point: Point,
    obstacle: PcbRoutingObstacle,
    clearance: number,
  ): boolean {
    if (obstacle.type === "circle") {
      return (
        Math.hypot(point.x - obstacle.center.x, point.y - obstacle.center.y) <=
        obstacle.radius + (obstacle.clearance ?? 0) + clearance
      )
    }
    const rotationRadians = ((obstacle.ccwRotationDegrees ?? 0) * Math.PI) / 180
    const cosine = Math.cos(rotationRadians)
    const sine = Math.sin(rotationRadians)
    const relativeX = point.x - obstacle.center.x
    const relativeY = point.y - obstacle.center.y
    const localX = relativeX * cosine + relativeY * sine
    const localY = -relativeX * sine + relativeY * cosine
    return (
      Math.abs(localX) <=
        obstacle.width / 2 + (obstacle.clearance ?? 0) + clearance &&
      Math.abs(localY) <=
        obstacle.height / 2 + (obstacle.clearance ?? 0) + clearance
    )
  }

  private segmentHitsObstacle(
    start: Point,
    end: Point,
    obstacle: PcbRoutingObstacle,
    traceRadius: number,
  ): boolean {
    const clearance =
      traceRadius + this.params.designRules.traceToObstacleClearance
    if (obstacle.type === "circle") {
      return (
        getMinimumSegmentDistance(
          start,
          end,
          obstacle.center,
          obstacle.center,
        ) <=
        obstacle.radius + (obstacle.clearance ?? 0) + clearance
      )
    }
    const rotationRadians = ((obstacle.ccwRotationDegrees ?? 0) * Math.PI) / 180
    const cosine = Math.cos(rotationRadians)
    const sine = Math.sin(rotationRadians)
    const toLocal = (point: Point): Point => {
      const relativeX = point.x - obstacle.center.x
      const relativeY = point.y - obstacle.center.y
      return {
        x: relativeX * cosine + relativeY * sine,
        y: -relativeX * sine + relativeY * cosine,
      }
    }
    const localStart = toLocal(start)
    const localEnd = toLocal(end)
    const halfWidth = obstacle.width / 2 + (obstacle.clearance ?? 0) + clearance
    const halfHeight =
      obstacle.height / 2 + (obstacle.clearance ?? 0) + clearance
    let entry = 0
    let exit = 1
    const delta = {
      x: localEnd.x - localStart.x,
      y: localEnd.y - localStart.y,
    }
    for (const [origin, direction, minimum, maximum] of [
      [localStart.x, delta.x, -halfWidth, halfWidth],
      [localStart.y, delta.y, -halfHeight, halfHeight],
    ] as const) {
      if (Math.abs(direction) <= 1e-12) {
        if (origin < minimum || origin > maximum) return false
        continue
      }
      const first = (minimum - origin) / direction
      const second = (maximum - origin) / direction
      entry = Math.max(entry, Math.min(first, second))
      exit = Math.min(exit, Math.max(first, second))
      if (entry > exit) return false
    }
    return true
  }

  private getWireSegments(pcbTrace: PcbTraceForPostProcessing): Array<{
    start: PcbTraceWireRoutePoint
    end: PcbTraceWireRoutePoint
  }> {
    const segments: Array<{
      start: PcbTraceWireRoutePoint
      end: PcbTraceWireRoutePoint
    }> = []
    let lastWire: PcbTraceWireRoutePoint | undefined
    for (const routePoint of pcbTrace.route) {
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
}
