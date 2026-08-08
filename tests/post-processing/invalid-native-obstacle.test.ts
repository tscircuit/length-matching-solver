import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns input routes when native obstacle geometry is malformed", () => {
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

  const output = new PostProcessingSolver(params).getOutput()

  expect(output.hdRoutes).toEqual(params.hdRoutes)
  expect(output.postProcessingErrors).toEqual([
    expect.objectContaining({
      stage: "validation",
      message: "PostProcessingSolver: obstacle declaration is invalid",
      returnedRouteSource: "input-hd-routes",
    }),
  ])
})
