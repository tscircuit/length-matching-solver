export type RoutePoint = {
  x: number
  y: number
  z: number
  traceThickness?: number
  insideJumperPad?: boolean
  toNextSegmentType?: "through_obstacle"
}

export type HighDensityRoute = {
  connectionName: string
  rootConnectionName?: string
  traceThickness: number
  viaDiameter: number
  route: RoutePoint[]
  vias: Array<{ x: number; y: number }>
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
  route: SimplifiedPcbTraceRoutePoint[]
}

export type SimplifiedPcbTraces = SimplifiedPcbTrace[]

export type Obstacle = {
  obstacleId?: string
  componentId?: string
  type: "rect"
  layers: string[]
  zLayers?: number[]
  center: { x: number; y: number }
  width: number
  height: number
  ccwRotationDegrees?: number
  connectedTo: string[]
}
