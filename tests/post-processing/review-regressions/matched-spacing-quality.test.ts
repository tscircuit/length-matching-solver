import { expect, test } from "bun:test"
import { getMinimumPairEdgeGap } from "../../../lib/post-processing/geometry/getMinimumPairEdgeGap"
import { solveDifferentialPair } from "../../../lib/post-processing/routing/solveDifferentialPair"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("records spacing quality from final length-matched geometry", () => {
  const params = createPostProcessingTestParams()
  const traces = structuredClone(params.traces)
  const last = traces[1]!.route.at(-1)!
  if (last.route_type !== "wire") throw new Error("Expected endpoint wire")
  last.x = 9
  const result = solveDifferentialPair({
    pair: params.differentialPairs[0]!,
    traces,
    obstacles: params.obstacles,
    bounds: params.bounds,
    layerCount: params.layerCount,
  })
  expect(result.status).toBe("accepted")
  if (result.status !== "accepted") throw result.error
  expect(result.candidate.edgeGap).toBeCloseTo(
    getMinimumPairEdgeGap(
      result.candidate.firstParsed,
      result.candidate.secondParsed,
    ),
    8,
  )
})
