import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns best-effort input when a pair member does not resolve", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  params.hdRoutes[0]!.connectionName = "P_SEGMENT_A"
  params.hdRoutes[0]!.rootConnectionName = "P"
  params.hdRoutes.push({
    ...structuredClone(params.hdRoutes[0]!),
    connectionName: "P_SEGMENT_B",
  })

  const solver = new PostProcessingSolver(params)
  solver.solve()
  const output = solver.getOutput()

  expect(output.hdRoutes).toEqual(params.hdRoutes)
  expect(output.postProcessingErrors).toContainEqual(
    expect.objectContaining({
      reason: "trace-resolution-failure",
      returnedRouteSource: "input-hd-routes",
    }),
  )
})
