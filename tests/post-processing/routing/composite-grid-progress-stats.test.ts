import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("reports monotonic progress and cumulative composite-search statistics", () => {
  const solver = new PostProcessingSolver(createPostProcessingTestParams({
    routingGrid: {
      innerGridStep: 0.3,
      outerGridStep: 1.2,
      outerPerimeterWidth: 1.2,
    },
  }))
  let previousProgress = 0
  let maximumExplored = 0
  let observedGridNodeCount = 0

  while (!solver.solved) {
    solver.step()
    const progress = solver.computeProgress()
    expect(progress).toBeGreaterThanOrEqual(previousProgress)
    previousProgress = progress
    const explored = typeof solver.stats.exploredNodeCount === "number"
      ? solver.stats.exploredNodeCount
      : 0
    const gridNodes = typeof solver.stats.gridNodeCount === "number"
      ? solver.stats.gridNodeCount
      : 0
    maximumExplored = Math.max(maximumExplored, explored)
    observedGridNodeCount = Math.max(observedGridNodeCount, gridNodes)
  }

  expect(previousProgress).toBe(1)
  expect(maximumExplored).toBeGreaterThan(0)
  expect(observedGridNodeCount).toBeGreaterThan(0)
})
