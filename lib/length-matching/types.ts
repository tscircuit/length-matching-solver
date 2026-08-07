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
  /**
   * Minimum edge-to-edge spacing between adjacent meander traces. Defaults per
   * route to the greater of 0.3mm and twice the trace width.
   */
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

/** A recoverable failure encountered while matching one differential pair. */
export type LengthMatchingError = {
  type: "length-matching-error"
  message: string
  connectionNames?: [string, string]
  usedBestEffortRoute: boolean
}

/** Best-effort routed geometry and every recoverable matching error. */
export type LengthMatchingSolverOutput = {
  matchedHdRoutes: HighDensityRoute[]
  errors: LengthMatchingError[]
}
