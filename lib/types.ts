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
