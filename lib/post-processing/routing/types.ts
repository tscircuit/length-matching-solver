import type { Point } from "../model/internal-types"

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
  /** Search every reachable state instead of the optimizer's per-attempt cap. */
  exploreEntireGraph?: boolean
  isEdgeValid: (start: CoupledPathPoint, end: CoupledPathPoint) => boolean
  /** Extra nonnegative cost for a valid edge; absent means no penalty. */
  getEdgePenalty?: (start: CoupledPathPoint, end: CoupledPathPoint) => number
  isViaValid: (
    point: CoupledPathPoint,
    toLayer: string,
    direction: Point,
  ) => boolean
}
