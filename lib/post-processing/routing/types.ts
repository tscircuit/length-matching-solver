import type { Point } from "../model/internal-types"

export type CoupledPathPoint = Point & { layer: string }

export type CoupledPathSearchInput = {
  start: CoupledPathPoint
  end: CoupledPathPoint
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  gridStep: number
  isEdgeValid: (
    start: CoupledPathPoint,
    end: CoupledPathPoint,
  ) => boolean
  isViaValid: (
    point: CoupledPathPoint,
    toLayer: string,
    direction: Point,
  ) => boolean
}
