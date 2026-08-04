import type {
  DifferentialPair,
  HighDensityRoute,
  Obstacle,
  SimplifiedPcbTraces,
} from "../types"

export type PostProcessingGridConfig = {
  /** Fine grid step used throughout the board interior, in board units. */
  innerGridStep?: number
  /** Coarse grid step used in the outer perimeter, in board units. */
  outerGridStep?: number
  /** Width of the coarse perimeter band, in board units. */
  outerPerimeterWidth?: number
}

export type PostProcessingSolverParams = {
  hdRoutes: HighDensityRoute[]
  differentialPairs: DifferentialPair[]
  obstacles: Obstacle[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  allowViaInPad?: boolean
  routingGrid?: PostProcessingGridConfig
}

export type PostProcessingSolverOutput = {
  hdRoutes: HighDensityRoute[]
  postProcessingErrors?: PostProcessingError[]
}

export type PostProcessingError = {
  type: "post_processing_error"
  stage: string
  message: string
  connectionName?: string
  returnedRouteSource: "input-hd-routes"
}

/** Private simplified-trace model used by the coupled-routing algorithms. */
export type InternalPostProcessingParams = {
  simpleRouteJson: {
    layerCount: number
    allowViaInPad?: boolean
    obstacles: Obstacle[]
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
    differentialPairs: DifferentialPair[]
    traces: SimplifiedPcbTraces
  }
  routingGrid?: PostProcessingGridConfig
}

export type PostProcessingRouteBinding = {
  hdRouteIndex: number
  traceIndex: number
  internalConnectionName: string
}

export type PostProcessingModel = {
  params: InternalPostProcessingParams
  routeBindings: PostProcessingRouteBinding[]
  sourceHdRoutes: HighDensityRoute[]
}
