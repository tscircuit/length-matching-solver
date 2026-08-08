import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("returns input routes for duplicate differential pair membership", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const output = new PostProcessingSolver({
    ...params,
    differentialPairs: [
      { connectionNames: ["P", "N"], lengthTolerance: 0.01 },
      { connectionNames: ["N", "OTHER"], lengthTolerance: 0.01 },
    ],
  }).getOutput()

  expect(output.hdRoutes).toEqual(params.hdRoutes)
  expect(output.postProcessingErrors).toEqual([
    expect.objectContaining({
      stage: "validation",
      message: expect.stringMatching(
        /connection "N" belongs to multiple differential pairs/,
      ),
      connectionName: "N",
      returnedRouteSource: "input-hd-routes",
    }),
  ])
})
