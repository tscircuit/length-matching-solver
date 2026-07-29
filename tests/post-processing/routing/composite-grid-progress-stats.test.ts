import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("reports monotonic progress and cumulative composite-search statistics", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams({
      routingGrid: {
        innerGridStep: 0.3,
        outerGridStep: 1.2,
        outerPerimeterWidth: 1.2,
      },
    })
  const solver = new PostProcessingSolver(params)
  let previousProgress = 0
  let maximumExplored = 0
  let observedGridNodeCount = 0

  while (!solver.solved) {
    solver.step()
    const progress = solver.computeProgress()
    expect(progress).toBeGreaterThanOrEqual(previousProgress)
    previousProgress = progress
    const stageStats = solver.differentialPairReroutingSolver?.stats
    const explored =
      typeof stageStats?.exploredNodeCount === "number"
        ? stageStats.exploredNodeCount
        : 0
    const gridNodes =
      typeof stageStats?.gridNodeCount === "number"
        ? stageStats.gridNodeCount
        : 0
    maximumExplored = Math.max(maximumExplored, explored)
    observedGridNodeCount = Math.max(observedGridNodeCount, gridNodes)
  }

  expect(previousProgress).toBe(1)
  expect(maximumExplored).toBeGreaterThan(0)
  expect(observedGridNodeCount).toBeGreaterThan(0)
})
