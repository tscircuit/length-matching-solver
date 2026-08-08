import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingGridConfig,
} from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("returns input routes for invalid composite routing-grid configuration", () => {
  const invalidConfigurations: PostProcessingGridConfig[] = [
    { innerGridStep: 0 },
    { innerGridStep: 0.00001 },
    { innerGridStep: 0.5, outerGridStep: 0.5 },
    { outerGridStep: Number.POSITIVE_INFINITY },
    { outerPerimeterWidth: 5 },
  ]
  for (const routingGrid of invalidConfigurations) {
    const { simpleRouteJson: _fixture, ...params } =
      createPostProcessingTestParams({ routingGrid })
    const output = new PostProcessingSolver(params).getOutput()

    expect(output.hdRoutes).toEqual(params.hdRoutes)
    expect(output.postProcessingErrors).toEqual([
      expect.objectContaining({
        stage: "validation",
        message: expect.stringMatching(/PostProcessingSolver: routingGrid/),
        returnedRouteSource: "input-hd-routes",
      }),
    ])
  }
})
