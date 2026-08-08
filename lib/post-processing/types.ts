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
  routingGrid?: PostProcessingGridConfig
}

export type PostProcessingSolverOutput = {
  hdRoutes: HighDensityRoute[]
  /** Empty when post-processing completed ideally. */
  postProcessingErrors: PostProcessingError[]
}

export type PostProcessingError = {
  type: "post_processing_error"
  stage: string
  message: string
  connectionName?: string
  connectionNames?: [string, string]
  reason?: string
  returnedRouteSource: "input-hd-routes" | "best-effort-hd-routes"
}

/** Private simplified-trace model used by the coupled-routing algorithms. */
export type InternalPostProcessingParams = {
  simpleRouteJson: {
    layerCount: number
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
