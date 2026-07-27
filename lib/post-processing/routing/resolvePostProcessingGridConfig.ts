import type { PostProcessingGridConfig } from "../types"
import type { CompositeGridConfig } from "./types"

/** Resolve the optional public grid controls against the pair's adaptive inner step. */
export const resolvePostProcessingGridConfig = (input: {
  config?: PostProcessingGridConfig
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  defaultInnerGridStep: number
}): CompositeGridConfig => {
  const minimumExtent = Math.min(
    input.bounds.maxX - input.bounds.minX,
    input.bounds.maxY - input.bounds.minY,
  )
  const innerGridStep =
    input.config?.innerGridStep ?? input.defaultInnerGridStep
  const outerGridStep = input.config?.outerGridStep ?? innerGridStep * 4
  const outerPerimeterWidth =
    input.config?.outerPerimeterWidth ??
    Math.min(outerGridStep, minimumExtent / 4)

  if (!Number.isFinite(innerGridStep) || innerGridStep < 0.0001)
    throw new Error(
      "PostProcessingSolver: routingGrid.innerGridStep must be finite and at least 0.0001",
    )
  if (!Number.isFinite(outerGridStep) || outerGridStep <= innerGridStep)
    throw new Error(
      "PostProcessingSolver: routingGrid.outerGridStep must be finite and greater than innerGridStep",
    )
  if (
    !Number.isFinite(outerPerimeterWidth) ||
    outerPerimeterWidth <= 0 ||
    outerPerimeterWidth * 2 >= minimumExtent
  )
    throw new Error(
      "PostProcessingSolver: routingGrid.outerPerimeterWidth must be finite, positive, and less than half the smaller board extent",
    )
  const width = input.bounds.maxX - input.bounds.minX
  const height = input.bounds.maxY - input.bounds.minY
  const outerAxisXCount = Math.ceil(width / outerGridStep) + 4
  const outerAxisYCount = Math.ceil(height / outerGridStep) + 4
  const innerAxisXCount =
    Math.ceil((width - outerPerimeterWidth * 2) / innerGridStep) + 2
  const innerAxisYCount =
    Math.ceil((height - outerPerimeterWidth * 2) / innerGridStep) + 2
  const nodeCountUpperBound =
    outerAxisXCount * outerAxisYCount + innerAxisXCount * innerAxisYCount + 18
  if (nodeCountUpperBound > 250_000)
    throw new Error(
      "PostProcessingSolver: routingGrid exceeds the 250000-node composite-grid invariant limit",
    )

  return { innerGridStep, outerGridStep, outerPerimeterWidth }
}
