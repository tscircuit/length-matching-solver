import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("rejects a native via span that cannot be represented by its route transition", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.layerCount = 3
  params.hdRoutes[0]!.route = [
    { x: 0, y: 2, z: 0 },
    { x: 0, y: 2, z: 1 },
    { x: 10, y: 2, z: 1 },
  ]
  params.hdRoutes[0]!.vias = [{ x: 0, y: 2, zLayers: [0, 1, 2] }]

  expect(() => new PostProcessingSolver(params)).toThrow(
    /via span incompatible with its layer transition/,
  )
})
