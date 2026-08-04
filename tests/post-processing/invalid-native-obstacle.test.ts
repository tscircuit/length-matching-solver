import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("reports malformed native obstacle geometry at the public boundary", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.obstacles = [
    {
      type: "rect",
      layers: ["top"],
      center: { x: Number.NaN, y: 0 },
      width: -1,
      height: 1,
      connectedTo: [],
    },
  ]
  const inputRoutes = structuredClone(params.hdRoutes)

  const output = new PostProcessingSolver(params).getOutput()

  expect(output.hdRoutes).toEqual(inputRoutes)
  expect(output.postProcessingErrors).toEqual([
    expect.objectContaining({
      type: "post_processing_error",
      stage: "validation",
      message: "PostProcessingSolver: obstacle declaration is invalid",
      returnedRouteSource: "input-hd-routes",
    }),
  ])
})
