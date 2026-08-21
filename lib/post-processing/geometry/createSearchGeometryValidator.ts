import { getMinimumSegmentDistance } from "../../route-geometry"
import type { Obstacle, SimplifiedPcbTrace } from "../../types"
import type { CopperSegment, CopperVia, Point } from "../model/internal-types"
import { getTraceCopperGeometry } from "../model/getTraceCopperGeometry"
import type { CoupledPathPoint } from "../routing/types"
import { createCopperCollisionEntries } from "./createCopperCollisionEntries"
import { createObstacleCollisionEntries } from "./createObstacleCollisionEntries"
import { getLayerIndex } from "./getLayerIndex"
import { getTransitionLayers } from "./getTransitionLayers"

export type SearchGeometryValidator = {
  isEdgeValid: (start: CoupledPathPoint, end: CoupledPathPoint) => boolean
  isViaValid: (
    point: CoupledPathPoint,
    toLayer: string,
    direction: Point,
  ) => boolean
}

/** Build a conservative, reusable collision checker for coupled spine search. */
export const createSearchGeometryValidator = (input: {
  immutableTraces: SimplifiedPcbTrace[]
  obstacles: Obstacle[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  start: CoupledPathPoint
  end: CoupledPathPoint
  firstConnectionName: string
  secondConnectionName: string
  firstStartTerminal: Point
  firstEndTerminal: Point
  secondStartTerminal: Point
  secondEndTerminal: Point
  firstWidth: number
  secondWidth: number
  firstViaDiameter: number
  secondViaDiameter: number
  centerlineSpacing: number
  side: 1 | -1
  terminalFanout?: boolean
}): SearchGeometryValidator => {
  const immutableSegments: CopperSegment[] = []
  const immutableVias: CopperVia[] = []
  for (const trace of input.immutableTraces) {
    const copper = getTraceCopperGeometry(trace, input.layerCount)
    immutableSegments.push(...copper.segments)
    immutableVias.push(...copper.vias)
  }
  const obstacleCollisionEntries = createObstacleCollisionEntries({
    obstacles: input.obstacles,
    layerCount: input.layerCount,
  })
  const copperCollisionEntries = createCopperCollisionEntries({
    segments: immutableSegments,
    vias: immutableVias,
    layerCount: input.layerCount,
  })
  const samePoint = (left: Point, right: Point): boolean =>
    Math.hypot(left.x - right.x, left.y - right.y) <= 1e-8
  const pointToSegmentDistance = (
    point: Point,
    start: Point,
    end: Point,
  ): number => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const squared = dx * dx + dy * dy
    const t =
      squared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point.x - start.x) * dx + (point.y - start.y) * dy) / squared,
            ),
          )
    return Math.hypot(point.x - start.x - dx * t, point.y - start.y - dy * t)
  }
  const obstacleContains = (
    point: Point,
    obstacle: Obstacle,
    inflation: number,
  ): boolean => {
    const radians = (-(obstacle.ccwRotationDegrees ?? 0) * Math.PI) / 180
    const dx = point.x - obstacle.center.x
    const dy = point.y - obstacle.center.y
    const x = dx * Math.cos(radians) - dy * Math.sin(radians)
    const y = dx * Math.sin(radians) + dy * Math.cos(radians)
    return (
      Math.abs(x) <= obstacle.width / 2 + inflation &&
      Math.abs(y) <= obstacle.height / 2 + inflation
    )
  }
  const laneSegments = (
    start: CoupledPathPoint,
    end: CoupledPathPoint,
  ): CopperSegment[] => {
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (length === 0) return []
    const normal = {
      x:
        ((-(end.y - start.y) / length) * input.side * input.centerlineSpacing) /
        2,
      y:
        (((end.x - start.x) / length) * input.side * input.centerlineSpacing) /
        2,
    }
    const isStartTerminal = samePoint(start, input.start)
    const isEndTerminal = samePoint(end, input.end)
    const terminal: CopperSegment["terminal"] =
      isStartTerminal && isEndTerminal
        ? "both"
        : isStartTerminal
          ? "start"
          : isEndTerminal
            ? "end"
            : null
    const firstStart =
      isStartTerminal && input.terminalFanout
        ? input.firstStartTerminal
        : { x: start.x + normal.x, y: start.y + normal.y }
    const firstEnd =
      isEndTerminal && input.terminalFanout
        ? input.firstEndTerminal
        : { x: end.x + normal.x, y: end.y + normal.y }
    const secondStart =
      isStartTerminal && input.terminalFanout
        ? input.secondStartTerminal
        : { x: start.x - normal.x, y: start.y - normal.y }
    const secondEnd =
      isEndTerminal && input.terminalFanout
        ? input.secondEndTerminal
        : { x: end.x - normal.x, y: end.y - normal.y }
    return [
      {
        start: firstStart,
        end: firstEnd,
        layer: start.layer,
        width: input.firstWidth,
        connectionName: input.firstConnectionName,
        terminal,
      },
      {
        start: secondStart,
        end: secondEnd,
        layer: start.layer,
        width: input.secondWidth,
        connectionName: input.secondConnectionName,
        terminal,
      },
    ]
  }
  const segmentIsClear = (segment: CopperSegment): boolean => {
    const radius = segment.width / 2
    const inflation = radius + segment.width
    const layerIndex = getLayerIndex(segment.layer, input.layerCount)
    const segmentMinX = Math.min(segment.start.x, segment.end.x) - inflation
    const segmentMaxX = Math.max(segment.start.x, segment.end.x) + inflation
    const segmentMinY = Math.min(segment.start.y, segment.end.y) - inflation
    const segmentMaxY = Math.max(segment.start.y, segment.end.y) + inflation
    for (const point of [segment.start, segment.end]) {
      if (
        point.x - radius < input.bounds.minX ||
        point.x + radius > input.bounds.maxX ||
        point.y - radius < input.bounds.minY ||
        point.y + radius > input.bounds.maxY
      )
        return false
    }
    for (const obstacleCollisionEntry of obstacleCollisionEntries) {
      if (!obstacleCollisionEntry.layerIndexes.includes(layerIndex)) continue
      if (
        segmentMaxX < obstacleCollisionEntry.minX ||
        segmentMinX > obstacleCollisionEntry.maxX ||
        segmentMaxY < obstacleCollisionEntry.minY ||
        segmentMinY > obstacleCollisionEntry.maxY
      )
        continue
      const obstacle = obstacleCollisionEntry.obstacle
      const [startTerminal, endTerminal] =
        segment.connectionName === input.firstConnectionName
          ? [input.firstStartTerminal, input.firstEndTerminal]
          : [input.secondStartTerminal, input.secondEndTerminal]
      const progressesOutOfStart =
        obstacleContains(startTerminal, obstacle, 0) &&
        (obstacleContains(segment.start, obstacle, radius + segment.width) ||
          obstacleContains(segment.end, obstacle, radius + segment.width)) &&
        Math.hypot(
          segment.end.x - startTerminal.x,
          segment.end.y - startTerminal.y,
        ) >=
          Math.hypot(
            segment.start.x - startTerminal.x,
            segment.start.y - startTerminal.y,
          )
      const progressesIntoEnd =
        obstacleContains(endTerminal, obstacle, 0) &&
        (obstacleContains(segment.start, obstacle, radius + segment.width) ||
          obstacleContains(segment.end, obstacle, radius + segment.width)) &&
        Math.hypot(
          segment.end.x - endTerminal.x,
          segment.end.y - endTerminal.y,
        ) <=
          Math.hypot(
            segment.start.x - endTerminal.x,
            segment.start.y - endTerminal.y,
          )
      const exitsConnectedTerminal =
        obstacle.connectedTo.includes(segment.connectionName) &&
        (progressesOutOfStart || progressesIntoEnd)
      if (exitsConnectedTerminal) continue
      if (
        obstacleContains(segment.start, obstacle, inflation) ||
        obstacleContains(segment.end, obstacle, inflation)
      )
        return false
      const sampleCount = Math.max(
        2,
        Math.ceil(
          Math.hypot(
            segment.end.x - segment.start.x,
            segment.end.y - segment.start.y,
          ) / 0.2,
        ),
      )
      for (let index = 1; index < sampleCount; index++) {
        const t = index / sampleCount
        if (
          obstacleContains(
            {
              x: segment.start.x + (segment.end.x - segment.start.x) * t,
              y: segment.start.y + (segment.end.y - segment.start.y) * t,
            },
            obstacle,
            inflation,
          )
        )
          return false
      }
    }
    for (const copperCollisionEntry of copperCollisionEntries.segmentsByLayer[
      layerIndex
    ] ?? []) {
      const other = copperCollisionEntry.segment
      const required =
        segment.width / 2 +
        other.width / 2 +
        Math.max(segment.width, other.width)
      if (
        segmentMaxX + required < copperCollisionEntry.minX ||
        segmentMinX - required > copperCollisionEntry.maxX ||
        segmentMaxY + required < copperCollisionEntry.minY ||
        segmentMinY - required > copperCollisionEntry.maxY
      )
        continue
      if (
        getMinimumSegmentDistance(
          segment.start,
          segment.end,
          other.start,
          other.end,
        ) < required
      )
        return false
    }
    for (const copperCollisionEntry of copperCollisionEntries.viasByLayer[
      layerIndex
    ] ?? []) {
      const via = copperCollisionEntry.via
      const required = segment.width / 2 + via.diameter / 2 + segment.width
      if (
        segmentMaxX + required < copperCollisionEntry.minX ||
        segmentMinX - required > copperCollisionEntry.maxX ||
        segmentMaxY + required < copperCollisionEntry.minY ||
        segmentMinY - required > copperCollisionEntry.maxY
      )
        continue
      if (pointToSegmentDistance(via, segment.start, segment.end) < required)
        return false
    }
    return true
  }
  const viaIsClear = (via: CopperVia): boolean => {
    const radius = via.diameter / 2
    const inflation = radius + via.diameter
    const layerIndexes = via.layers.map((layer) =>
      getLayerIndex(layer, input.layerCount),
    )
    if (
      via.x - radius < input.bounds.minX ||
      via.x + radius > input.bounds.maxX ||
      via.y - radius < input.bounds.minY ||
      via.y + radius > input.bounds.maxY
    )
      return false
    for (const obstacleCollisionEntry of obstacleCollisionEntries) {
      if (
        !layerIndexes.some((layerIndex) =>
          obstacleCollisionEntry.layerIndexes.includes(layerIndex),
        )
      )
        continue
      if (
        via.x + inflation < obstacleCollisionEntry.minX ||
        via.x - inflation > obstacleCollisionEntry.maxX ||
        via.y + inflation < obstacleCollisionEntry.minY ||
        via.y - inflation > obstacleCollisionEntry.maxY
      )
        continue
      const obstacle = obstacleCollisionEntry.obstacle
      const exitsConnectedTerminal =
        via.terminal !== null &&
        obstacle.connectedTo.includes(via.connectionName) &&
        obstacleContains(via, obstacle, 0)
      if (!exitsConnectedTerminal && obstacleContains(via, obstacle, inflation))
        return false
    }
    for (const layerIndex of layerIndexes) {
      for (const copperCollisionEntry of copperCollisionEntries.segmentsByLayer[
        layerIndex
      ] ?? []) {
        const segment = copperCollisionEntry.segment
        const required =
          radius + segment.width / 2 + Math.max(via.diameter, segment.width)
        if (
          via.x + required < copperCollisionEntry.minX ||
          via.x - required > copperCollisionEntry.maxX ||
          via.y + required < copperCollisionEntry.minY ||
          via.y - required > copperCollisionEntry.maxY
        )
          continue
        if (pointToSegmentDistance(via, segment.start, segment.end) < required)
          return false
      }
    }
    for (const copperCollisionEntry of copperCollisionEntries.vias) {
      const other = copperCollisionEntry.via
      if (!other.layers.some((layer) => via.layers.includes(layer))) continue
      const required =
        radius + other.diameter / 2 + Math.max(via.diameter, other.diameter)
      if (
        via.x + required < copperCollisionEntry.minX ||
        via.x - required > copperCollisionEntry.maxX ||
        via.y + required < copperCollisionEntry.minY ||
        via.y - required > copperCollisionEntry.maxY
      )
        continue
      if (Math.hypot(via.x - other.x, via.y - other.y) < required) return false
    }
    return true
  }

  return {
    isEdgeValid: (start, end) =>
      start.layer === end.layer &&
      laneSegments(start, end).every(segmentIsClear),
    isViaValid: (point, toLayer, direction) => {
      const directionLength = Math.hypot(direction.x, direction.y)
      if (directionLength <= 1e-10)
        throw new Error(
          "PostProcessingSolver: cannot orient a coupled via on a zero-length spine",
        )
      const layers = getTransitionLayers(point.layer, toLayer, input.layerCount)
      const normal = {
        x:
          ((-direction.y / directionLength) *
            input.side *
            input.centerlineSpacing) /
          2,
        y:
          ((direction.x / directionLength) *
            input.side *
            input.centerlineSpacing) /
          2,
      }
      const terminal = samePoint(point, input.start)
        ? "start"
        : samePoint(point, input.end)
          ? "end"
          : null
      const laneVias: CopperVia[] = [
        {
          x: point.x + normal.x,
          y: point.y + normal.y,
          layers,
          diameter: input.firstViaDiameter,
          connectionName: input.firstConnectionName,
          terminal,
        },
        {
          x: point.x - normal.x,
          y: point.y - normal.y,
          layers,
          diameter: input.secondViaDiameter,
          connectionName: input.secondConnectionName,
          terminal,
        },
      ]
      return laneVias.every(viaIsClear)
    },
  }
}
