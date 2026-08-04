import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("reports a native via span that cannot be represented by its route transition", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.layerCount = 3
  params.hdRoutes[0]!.route = [
    { x: 0, y: 2, z: 0 },
    { x: 0, y: 2, z: 1 },
    { x: 10, y: 2, z: 1 },
  ]
  params.hdRoutes[0]!.vias = [{ x: 0, y: 2, zLayers: [0, 1, 2] }]
  const inputRoutes = structuredClone(params.hdRoutes)

  const output = new PostProcessingSolver(params).getOutput()

  expect(output.hdRoutes).toEqual(inputRoutes)
  expect(output.nonIdealRouteIssues).toEqual([
    expect.objectContaining({
      type: "post_processing_error",
      stage: "validation",
      message: expect.stringMatching(
        /via span incompatible with its layer transition/,
      ),
      returnedRouteSource: "input-hd-routes",
    }),
  ])
})
