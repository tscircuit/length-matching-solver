import type {
  DifferentialPair,
  HighDensityRoute,
  Obstacle,
  SimpleRouteConnection,
} from "../types"

/** Input geometry and tuning constraints for a differential-pair matching run. */
export type LengthMatchingSolverParams = {
  hdRoutes: HighDensityRoute[]
  originalConnections: SimpleRouteConnection[]
  differentialPairs?: DifferentialPair[]
  maximumMeanderDepth?: number
  minimumToothPitch?: number
  maxToothCount?: number
  obstacles?: Obstacle[]
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  obstacleMargin?: number
  layerCount?: number
  colorMap?: Record<string, string>
}

/** Routed geometry after every requested differential pair has been matched. */
export type LengthMatchingSolverOutput = {
  matchedHdRoutes: HighDensityRoute[]
}
