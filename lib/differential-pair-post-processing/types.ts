declare const domainIdentifierBrand: unique symbol

type DomainIdentifier<Name extends string> = string & {
  readonly [domainIdentifierBrand]: Name
}

export type DifferentialPairName = DomainIdentifier<"DifferentialPairName">
export type SourceTraceId = DomainIdentifier<"SourceTraceId">
export type PcbTraceId = DomainIdentifier<"PcbTraceId">
export type PcbViaId = DomainIdentifier<"PcbViaId">
export type PcbLayer = DomainIdentifier<"PcbLayer">
export type PcbRoutingObstacleId = DomainIdentifier<"PcbRoutingObstacleId">

export type PcbTraceWireRoutePoint = {
  route_type: "wire"
  x: number
  y: number
  width: number
  layer: PcbLayer
  start_pcb_port_id?: string
  end_pcb_port_id?: string
  is_terminal_escape?: boolean
  [metadata: string]: unknown
}

export type PcbTraceViaRoutePoint = {
  route_type: "via"
  x: number
  y: number
  from_layer: PcbLayer
  to_layer: PcbLayer
  hole_diameter?: number
  outer_diameter?: number
  [metadata: string]: unknown
}

export type PcbTraceThroughPadRoutePoint = {
  route_type: "through_pad"
  start: { x: number; y: number }
  end: { x: number; y: number }
  start_layer: PcbLayer
  end_layer: PcbLayer
  width: number
  [metadata: string]: unknown
}

export type PcbTraceRoutePoint =
  | PcbTraceWireRoutePoint
  | PcbTraceViaRoutePoint
  | PcbTraceThroughPadRoutePoint

export type PcbTraceForPostProcessing = {
  pcb_trace_id: PcbTraceId
  source_trace_id: SourceTraceId
  route: PcbTraceRoutePoint[]
  trace_length?: number
  [metadata: string]: unknown
}

export type PcbViaForPostProcessing = {
  pcb_via_id: PcbViaId
  x: number
  y: number
  outer_diameter: number
  hole_diameter: number
  layers: PcbLayer[]
  pcb_trace_id?: PcbTraceId
  source_trace_id?: SourceTraceId
  [metadata: string]: unknown
}

export type ResolvedDifferentialPair = {
  name: DifferentialPairName
  positiveSourceTraceId: SourceTraceId
  negativeSourceTraceId: SourceTraceId
  maxLengthSkew: number
}

export type RectPcbRoutingObstacle = {
  obstacle_id: PcbRoutingObstacleId
  type: "rect"
  layers: PcbLayer[]
  center: { x: number; y: number }
  width: number
  height: number
  ccwRotationDegrees?: number
  clearance?: number
  [metadata: string]: unknown
}

export type CirclePcbRoutingObstacle = {
  obstacle_id: PcbRoutingObstacleId
  type: "circle"
  layers: PcbLayer[]
  center: { x: number; y: number }
  radius: number
  clearance?: number
  [metadata: string]: unknown
}

export type PcbRoutingObstacle =
  | RectPcbRoutingObstacle
  | CirclePcbRoutingObstacle

export type PcbRoutingBoard = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type PcbRoutingDesignRules = {
  traceToTraceClearance: number
  traceToObstacleClearance: number
  viaToTraceClearance: number
  viaToObstacleClearance: number
  boardEdgeClearance: number
  viaHoleDiameter: number
  viaOuterDiameter: number
}

export type DifferentialPairRoutingFailureCategory =
  | "no_common_layer_route"
  | "spacing_bounds_unsatisfiable"
  | "paired_via_clearance_failed"
  | "length_skew_unsatisfied"
  | "terminal_escape_failed"
  | "obstacle_route_failed"
  | "iteration_limit_reached"
  | "unsupported_route_geometry"

export type DifferentialPairRoutingFailure = {
  category: DifferentialPairRoutingFailureCategory
  message: string
  positiveSourceTraceId: SourceTraceId
  negativeSourceTraceId: SourceTraceId
  layer?: PcbLayer
  viaPairBudget?: number
}

export type DifferentialPairSolveResult =
  | {
      status: "routed"
      differentialPairName: DifferentialPairName
      positivePcbTrace: PcbTraceForPostProcessing
      negativePcbTrace: PcbTraceForPostProcessing
      pcbVias: PcbViaForPostProcessing[]
    }
  | {
      status: "original_retained"
      differentialPairName: DifferentialPairName
      failure: DifferentialPairRoutingFailure
    }

export type DifferentialPairPostProcessingSolverParams = {
  pcbTraces: PcbTraceForPostProcessing[]
  pcbVias: PcbViaForPostProcessing[]
  differentialPairs: ResolvedDifferentialPair[]
  obstacles: PcbRoutingObstacle[]
  board: PcbRoutingBoard
  designRules: PcbRoutingDesignRules
  layerCount: number
  minCenterlineSpacing?: number
  maxCenterlineSpacing?: number
}

export type DifferentialPairPostProcessingSolverOutput = {
  pairResults: DifferentialPairSolveResult[]
}

export type ResolvedDifferentialPairPostProcessingParams = Omit<
  DifferentialPairPostProcessingSolverParams,
  "minCenterlineSpacing" | "maxCenterlineSpacing"
> & {
  minCenterlineSpacing: number
  maxCenterlineSpacing: number
}
