import { DEFAULT_MIN_MEANDER_GAP } from "../length-matching/candidate/createMeanderCandidates"
import {
  createSearchGeometryValidator,
  type SearchGeometryValidator,
} from "../post-processing/geometry/createSearchGeometryValidator"
import { getLayerIndex } from "../post-processing/geometry/getLayerIndex"
import type { PostProcessingGridConfig } from "../post-processing/types"
import { resolvePostProcessingGridConfig } from "../post-processing/routing/resolvePostProcessingGridConfig"
import type {
  CoupledPathPoint,
  CoupledPathSearchInput,
} from "../post-processing/routing/types"
import type { ConnectionPoint, Obstacle, SimplifiedPcbTrace } from "../types"
import type { TraceRoutingConnection } from "./types"

const TRACE_ROUTING_INNER_GRID_STEP = 0.25

/**
 * Build a composite-grid search for one trace by collapsing both coupled
 * lanes of the pair search onto a single centerline.
 */
export const createTraceSearchInput = (input: {
  connection: TraceRoutingConnection
  fixedTraces: SimplifiedPcbTrace[]
  obstacles: Obstacle[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  minTraceToPadEdgeClearance?: number
  routingGrid?: PostProcessingGridConfig
}): CoupledPathSearchInput => {
  const { connection } = input
  const netIds = new Set(
    [
      connection.connectionName,
      connection.rootConnectionName,
      connection.start.pcb_port_id,
      connection.end.pcb_port_id,
      ...connection.connectedTo,
    ].filter((id): id is string => id !== undefined),
  )
  const getTerminal = (point: ConnectionPoint): CoupledPathPoint => {
    // Any declared layer of a multi-layer terminal is connected copper.
    const layer = "layer" in point ? point.layer : point.layers[0]
    if (layer === undefined || getLayerIndex(layer, input.layerCount) < 0)
      throw new Error(
        `TraceRoutingSolver: connection "${connection.connectionName}" has a terminal without a routable layer`,
      )
    return { x: point.x, y: point.y, layer }
  }
  const start = getTerminal(connection.start)
  const end = getTerminal(connection.end)
  const immutableTraces = input.fixedTraces.filter(
    (trace) =>
      !netIds.has(trace.pcb_trace_id) && !netIds.has(trace.connection_name),
  )
  // The validator lets a trace leave only obstacles connected to its name.
  const obstacles = input.obstacles.map((obstacle) =>
    (obstacle.obstacleId !== undefined && netIds.has(obstacle.obstacleId)) ||
    obstacle.connectedTo.some((id) => netIds.has(id))
      ? {
          ...obstacle,
          connectedTo: [...obstacle.connectedTo, connection.connectionName],
        }
      : obstacle,
  )
  const createValidator = (
    minTraceToPadEdgeClearance: number | undefined,
  ): SearchGeometryValidator =>
    createSearchGeometryValidator({
      immutableTraces,
      obstacles,
      bounds: input.bounds,
      layerCount: input.layerCount,
      minTraceToPadEdgeClearance,
      start,
      end,
      firstConnectionName: connection.connectionName,
      secondConnectionName: connection.connectionName,
      firstStartTerminal: start,
      firstEndTerminal: end,
      secondStartTerminal: start,
      secondEndTerminal: end,
      firstWidth: connection.traceThickness,
      secondWidth: connection.traceThickness,
      firstViaDiameter: connection.viaDiameter,
      secondViaDiameter: connection.viaDiameter,
      centerlineSpacing: 0,
      side: 1,
    })
  const validator = createValidator(input.minTraceToPadEdgeClearance)
  // Routed traces are later tuned with meanders centered on their straight
  // segments, so prefer paths that leave meander room beside other pads.
  const meanderRoomValidator = createValidator(
    (input.minTraceToPadEdgeClearance ?? connection.traceThickness) +
      Math.max(DEFAULT_MIN_MEANDER_GAP, connection.traceThickness * 2),
  )
  return {
    start,
    end,
    bounds: input.bounds,
    layerCount: input.layerCount,
    grid: resolvePostProcessingGridConfig({
      config: input.routingGrid,
      bounds: input.bounds,
      defaultInnerGridStep: TRACE_ROUTING_INNER_GRID_STEP,
    }),
    isEdgeValid: validator.isEdgeValid,
    getEdgePenalty: (edgeStart, edgeEnd) =>
      meanderRoomValidator.isEdgeValid(edgeStart, edgeEnd)
        ? 0
        : Math.hypot(edgeEnd.x - edgeStart.x, edgeEnd.y - edgeStart.y),
    isViaValid: validator.isViaValid,
  }
}
