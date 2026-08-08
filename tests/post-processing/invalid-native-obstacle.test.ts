import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("rejects malformed native obstacle geometry at the public boundary", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.bounds = { minX: -500, maxX: 500, minY: -500, maxY: 500 }
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

  expect(() => new PostProcessingSolver(params)).toThrow(
    "PostProcessingSolver: obstacle declaration is invalid",
  )
})
