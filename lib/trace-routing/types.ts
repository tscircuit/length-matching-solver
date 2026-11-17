import type { PostProcessingGridConfig } from "../post-processing/types"
import type {
  ConnectionPoint,
  HighDensityRoute,
  Obstacle,
  SimplifiedPcbTraces,
} from "../types"

/** One unrouted two-terminal connection. */
export type TraceRoutingConnection = {
  connectionName: string
  /** Logical connection shared by every routed segment of a multi-point net. */
  rootConnectionName?: string
  /**
   * Ids electrically connected to this connection. Obstacles whose
   * `connectedTo` and fixed traces whose id or connection name appear here
   * belong to this connection's net.
   */
  connectedTo: string[]
  start: ConnectionPoint
  end: ConnectionPoint
  traceThickness: number
  viaDiameter: number
}

export type TraceRoutingSolverParams = {
  /** Routed in order; each routed trace is fixed copper for later connections. */
  connections: TraceRoutingConnection[]
  /** Fixed copper that routed traces must clear unless it shares their net. */
  traces?: SimplifiedPcbTraces
  obstacles: Obstacle[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  /** Board-declared trace-to-pad edge clearance in mm; defaults to trace width. */
  minTraceToPadEdgeClearance?: number
  routingGrid?: PostProcessingGridConfig
}

export type TraceRoutingSolverOutput = {
  hdRoutes: HighDensityRoute[]
}
