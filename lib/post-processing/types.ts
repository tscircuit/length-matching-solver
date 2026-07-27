import type { DifferentialPair, Obstacle, SimplifiedPcbTraces } from "../types"

export type PostProcessingGridConfig = {
  /** Fine grid step used throughout the board interior, in board units. */
  innerGridStep?: number
  /** Coarse grid step used in the outer perimeter, in board units. */
  outerGridStep?: number
  /** Width of the coarse perimeter band, in board units. */
  outerPerimeterWidth?: number
}

export type PostProcessingSolverParams = {
  traces: SimplifiedPcbTraces
  differentialPairs: DifferentialPair[]
  obstacles: Obstacle[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  routingGrid?: PostProcessingGridConfig
}

export type PostProcessingSolverOutput = {
  traces: SimplifiedPcbTraces
  errors: Error[]
}
