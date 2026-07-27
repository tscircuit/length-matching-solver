import type {
  DifferentialPair,
  Obstacle,
  SimplifiedPcbTraces,
} from "../types"

export type PostProcessingSolverParams = {
  traces: SimplifiedPcbTraces
  differentialPairs: DifferentialPair[]
  obstacles: Obstacle[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
}

export type PostProcessingSolverOutput = {
  traces: SimplifiedPcbTraces
  errors: Error[]
}
