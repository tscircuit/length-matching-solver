export type RoutePoint = {
  x: number
  y: number
  z: number
  traceThickness?: number
  pcb_port_id?: string
  insideJumperPad?: boolean
  toNextSegmentType?: "through_obstacle"
}

export type HighDensityRouteJumper = {
  route_type: "jumper"
  start: { x: number; y: number }
  end: { x: number; y: number }
  footprint: "0603" | "1206" | "1206x4_pair"
}

export type HighDensityRoute = {
  connectionName: string
  rootConnectionName?: string
  startPcbPortId?: string
  endPcbPortId?: string
  traceThickness: number
  viaDiameter: number
  route: RoutePoint[]
  vias: Array<{ x: number; y: number; zLayers?: number[] }>
  jumpers?: HighDensityRouteJumper[]
  regionId?: string
}

export type ConnectionPoint =
  | {
      x: number
      y: number
      layer: string
      pointId?: string
      pcb_port_id?: string
    }
  | {
      x: number
      y: number
      layers: string[]
      pointId?: string
      pcb_port_id?: string
    }

export type SimpleRouteConnection = {
  name: string
  rootConnectionName?: string
  mergedConnectionNames?: string[]
  isOffBoard?: boolean
  netConnectionName?: string
  nominalTraceWidth?: number
  pointsToConnect: ConnectionPoint[]
}

export type DifferentialPair = {
  connectionNames: [string, string]
  lengthTolerance: number
  /** Soft lower center-to-center spacing preference during rerouting and meander ranking. */
  minimumCenterlineDistance?: number
  /** Soft upper center-to-center spacing preference during rerouting and meander ranking. */
  maximumCenterlineDistance?: number
}

export type SimplifiedPcbTraceWireRoutePoint = {
  route_type: "wire"
  x: number
  y: number
  width: number
  layer: string
  start_pcb_port_id?: string
  end_pcb_port_id?: string
}

export type SimplifiedPcbTraceViaRoutePoint = {
  route_type: "via"
  x: number
  y: number
  from_layer: string
  to_layer: string
  via_diameter?: number
  via_hole_diameter?: number
}

export type SimplifiedPcbTraceJumperRoutePoint = {
  route_type: "jumper"
  start: { x: number; y: number }
  end: { x: number; y: number }
  footprint: "0603" | "1206" | "1206x4_pair"
  layer: string
}

export type SimplifiedPcbTraceThroughObstacleRoutePoint = {
  route_type: "through_obstacle"
  start: { x: number; y: number }
  end: { x: number; y: number }
  from_layer: string
  to_layer: string
  width: number
}

export type SimplifiedPcbTraceRoutePoint =
  | SimplifiedPcbTraceWireRoutePoint
  | SimplifiedPcbTraceViaRoutePoint
  | SimplifiedPcbTraceJumperRoutePoint
  | SimplifiedPcbTraceThroughObstacleRoutePoint

/** Structural copy of the autorouter's simplified PCB trace output. */
export type SimplifiedPcbTrace = {
  type: "pcb_trace"
  pcb_trace_id: string
  connection_name: string
  connectsTo?: string[]
  /** Internal HD-route via diameter retained while post-processing. */
  __postProcessingViaDiameter?: number
  route: SimplifiedPcbTraceRoutePoint[]
}

export type SimplifiedPcbTraces = SimplifiedPcbTrace[]

export type Obstacle = {
  obstacleId?: string
  componentId?: string
  /** Ovals are conservatively collision-checked as their bounding rectangle. */
  type: "rect" | "oval"
  layers: string[]
  zLayers?: number[]
  /** Canonicalized z-layer indexes used by autorouter internals. */
  __zLayers?: number[]
  center: { x: number; y: number }
  width: number
  height: number
  ccwRotationDegrees?: number
  connectedTo: string[]
}
