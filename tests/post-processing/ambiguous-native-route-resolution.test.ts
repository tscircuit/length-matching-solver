import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("requires pair members to directly name one HD route", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.hdRoutes[0]!.connectionName = "P_SEGMENT_A"
  params.hdRoutes[0]!.rootConnectionName = "P"
  params.hdRoutes.push({
    ...structuredClone(params.hdRoutes[0]!),
    connectionName: "P_SEGMENT_B",
  })

  expect(() => new PostProcessingSolver(params)).toThrow(
    'PostProcessingSolver: differential pair connection "P" must resolve to exactly one HD route, got 0',
  )
})
