import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns input routes when a valid board exceeds search-grid capacity", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.bounds = { minX: -500, maxX: 500, minY: -500, maxY: 500 }

  const solver = new PostProcessingSolver(params)
  const output = solver.getOutput()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(output.hdRoutes).toEqual(params.hdRoutes)
  expect(output.postProcessingErrors).toEqual([
    {
      type: "post_processing_error",
      stage: "differentialPairReroutingSolver",
      message:
        "PostProcessingSolver: valid input exceeds the 250000-node optimization grid capacity",
      reason: "grid-capacity-exhausted",
      returnedRouteSource: "input-hd-routes",
    },
  ])
})
