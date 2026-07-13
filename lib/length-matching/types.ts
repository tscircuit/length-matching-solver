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
  /** Minimum edge-to-edge spacing between adjacent meander traces. */
  minMeanderGap?: number
  /**
   * Minimum baseline-to-tooth centerline distance. Defaults per route to the
   * trace width plus minMeanderGap; an explicit value overrides that default.
   */
  minMeanderHeight?: number
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
