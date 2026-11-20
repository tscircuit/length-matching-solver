import type { DifferentialPair, SimplifiedPcbTrace } from "../../types"
import type { CandidateGeometryContext } from "../geometry/validateCandidateGeometry"
import type { ParsedTrace, Point } from "../model/internal-types"
import type { PostProcessingGridConfig } from "../types"

export type DifferentialPairRoutingInput = {
  pair: DifferentialPair
  traces: SimplifiedPcbTrace[]
  obstacles: CandidateGeometryContext["obstacles"]
  bounds: CandidateGeometryContext["bounds"]
  layerCount: number
  minTraceToPadEdgeClearance?: number
  routingGrid?: PostProcessingGridConfig
  reserveRowFanoutIteration?: () => boolean
}

export type PreparedPair = {
  first: ParsedTrace
  second: ParsedTrace
  reverseSecond: boolean
  terminalFanout: boolean
  context: CandidateGeometryContext
  attempts: Array<{
    edgeGap: number
    side: 1 | -1
    input: CoupledPathSearchInput
  }>
}

export type CoupledPathPoint = Point & { layer: string }

export type CompositeGridConfig = {
  innerGridStep: number
  outerGridStep: number
  outerPerimeterWidth: number
}

export type CoupledPathSearchInput = {
  start: CoupledPathPoint
  end: CoupledPathPoint
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  grid: CompositeGridConfig
  isEdgeValid: (start: CoupledPathPoint, end: CoupledPathPoint) => boolean
  isViaValid: (
    point: CoupledPathPoint,
    toLayer: string,
    direction: Point,
  ) => boolean
}
