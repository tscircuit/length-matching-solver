import type {
  HighDensityRoute,
  Obstacle,
  SimplifiedPcbTraces,
  SimpleRouteConnection,
} from "../types"

/** Exact copper-hop memberships, independent of electrical roots. */
export type LengthMatchingPair = {
  connectionNames: [[string, ...string[]], [string, ...string[]]]
  /** Maximum absolute difference between summed planar lane lengths, in mm. */
  maxLengthSkewMm: number
  /** Optional ranking preferences used by the coupled postprocessor. */
  minimumCenterlineDistance?: number
  maximumCenterlineDistance?: number
}

/** Input geometry and tuning constraints for a differential-pair matching run. */
export type LengthMatchingSolverParams = {
  hdRoutes: HighDensityRoute[]
  originalConnections: SimpleRouteConnection[]
  differentialPairs?: LengthMatchingPair[]
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
  /** Fixed SRJ copper used for clearance only; never tuned or returned. */
  traces?: SimplifiedPcbTraces
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
