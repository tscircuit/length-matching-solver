import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns input routes for an ambiguous native via span", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.layerCount = 3
  params.hdRoutes[0]!.route = [
    { x: 0, y: 2, z: 0 },
    { x: 0, y: 2, z: 1 },
    { x: 10, y: 2, z: 1 },
  ]
  params.hdRoutes[0]!.vias = [{ x: 0, y: 2, zLayers: [0, 1, 2] }]

  const output = new PostProcessingSolver(params).getOutput()

  expect(output.hdRoutes).toEqual(params.hdRoutes)
  expect(output.postProcessingErrors).toEqual([
    expect.objectContaining({
      stage: "validation",
      message: expect.stringMatching(
        /via span incompatible with its layer transition/,
      ),
      returnedRouteSource: "input-hd-routes",
    }),
  ])
})
