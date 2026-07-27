import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingGridConfig,
} from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("honors a custom composite grid while preserving exact deterministic endpoints", () => {
  const customGrid: PostProcessingGridConfig = {
    innerGridStep: 0.4,
    outerGridStep: 1.2,
    outerPerimeterWidth: 1.23456789,
  }
  const solve = (routingGrid?: PostProcessingGridConfig) => {
    const solver = new PostProcessingSolver(createPostProcessingTestParams(
      routingGrid ? { routingGrid } : {},
    ))
    let gridNodeCount = 0
    while (!solver.solved) {
      solver.step()
      const stageStats = solver.differentialPairReroutingSolver?.stats
      if (typeof stageStats?.gridNodeCount === "number")
        gridNodeCount = Math.max(gridNodeCount, stageStats.gridNodeCount)
    }
    return { output: solver.getOutput(), gridNodeCount }
  }
  const first = solve(customGrid)
  const second = solve(customGrid)
  const defaultGrid = solve()

  expect(first.output.errors).toHaveLength(0)
  expect(first.output.traces).toEqual(second.output.traces)
  expect(first.gridNodeCount).toBe(second.gridNodeCount)
  expect(first.gridNodeCount).not.toBe(defaultGrid.gridNodeCount)
  expect(first.output.traces[0]?.route[0]).toMatchObject({ x: 0, y: 2, layer: "top" })
  expect(first.output.traces[0]?.route.at(-1)).toMatchObject({ x: 10, y: 2, layer: "top" })
  expect(first.output.traces[1]?.route[0]).toMatchObject({ x: 0, y: -2, layer: "top" })
  expect(first.output.traces[1]?.route.at(-1)).toMatchObject({ x: 10, y: -2, layer: "top" })
})
