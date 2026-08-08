import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("accepts overlapping physical vias with distinct layer spans", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.layerCount = 3
  params.hdRoutes[0]!.route = [
    { x: 0, y: 2, z: 0 },
    { x: 0, y: 2, z: 1 },
    { x: 0, y: 2, z: 2 },
    { x: 10, y: 2, z: 2 },
    { x: 10, y: 2, z: 1 },
    { x: 10, y: 2, z: 0 },
  ]
  params.hdRoutes[0]!.vias = [
    { x: 0, y: 2, zLayers: [0, 1] },
    { x: 0, y: 2, zLayers: [1, 2] },
    { x: 10, y: 2, zLayers: [1, 2] },
    { x: 10, y: 2, zLayers: [0, 1] },
  ]

  const solver = new PostProcessingSolver(params)
  solver.solve()

  expect(solver.getOutput().hdRoutes).toHaveLength(params.hdRoutes.length)
})
