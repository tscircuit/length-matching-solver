import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns input routes when pair members do not name one HD route", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.hdRoutes[0]!.connectionName = "P_SEGMENT_A"
  params.hdRoutes[0]!.rootConnectionName = "P"
  params.hdRoutes.push({
    ...structuredClone(params.hdRoutes[0]!),
    connectionName: "P_SEGMENT_B",
  })

  const output = new PostProcessingSolver(params).getOutput()

  expect(output.hdRoutes).toEqual(params.hdRoutes)
  expect(output.postProcessingErrors).toEqual([
    expect.objectContaining({
      stage: "validation",
      message:
        'PostProcessingSolver: differential pair connection "P" must resolve to exactly one HD route, got 0',
      connectionName: "P",
      returnedRouteSource: "input-hd-routes",
    }),
  ])
})
