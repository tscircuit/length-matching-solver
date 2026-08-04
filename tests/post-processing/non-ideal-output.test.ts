import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns input routes and structured issues by default", () => {
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

  const solver = new PostProcessingSolver(params)
  const output = solver.getOutput()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(output).toEqual({
    hdRoutes: inputRoutes,
    nonIdealRouteIssues: [
      {
        type: "post_processing_error",
        stage: "validation",
        message:
          'PostProcessingSolver: HD route "P" has a via span incompatible with its layer transition',
        connectionName: "P",
        returnedRouteSource: "input-hd-routes",
      },
    ],
  })
})
