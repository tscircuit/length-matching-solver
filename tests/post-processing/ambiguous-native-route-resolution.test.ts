import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("reports pair members that do not directly name one HD route", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.hdRoutes[0]!.connectionName = "P_SEGMENT_A"
  params.hdRoutes[0]!.rootConnectionName = "P"
  params.hdRoutes.push({
    ...structuredClone(params.hdRoutes[0]!),
    connectionName: "P_SEGMENT_B",
  })
  const inputRoutes = structuredClone(params.hdRoutes)

  const output = new PostProcessingSolver(params).getOutput()

  expect(output.hdRoutes).toEqual(inputRoutes)
  expect(output.postProcessingErrors).toEqual([
    expect.objectContaining({
      type: "post_processing_error",
      stage: "validation",
      message:
        'PostProcessingSolver: differential pair connection "P" must resolve to exactly one HD route, got 0',
      connectionName: "P",
      returnedRouteSource: "input-hd-routes",
    }),
  ])
})
