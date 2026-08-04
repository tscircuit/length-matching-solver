import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns input routes and structured issues when non-ideal output is allowed", () => {
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

  const solver = new PostProcessingSolver({
    ...params,
    allowNonIdealOutput: true,
  })
  const defaultOutput = solver.getOutput()
  const outputWithIssues = solver.getOutput({
    includeNonIdealRouteIssues: true,
  })

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(defaultOutput).toEqual({ hdRoutes: inputRoutes })
  expect(outputWithIssues).toEqual({
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
