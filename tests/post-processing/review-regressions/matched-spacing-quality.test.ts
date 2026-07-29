import { expect, test } from "bun:test"
import { getMinimumPairEdgeGap } from "../../../lib/post-processing/geometry/getMinimumPairEdgeGap"
import { solveDifferentialPair } from "../../../lib/post-processing/routing/solveDifferentialPair"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("prefers a requested centerline-distance range when rerouting a pair", () => {
  const params = createPostProcessingTestParams({
    simpleRouteJson: {
      differentialPairs: [
        {
          connectionNames: ["P", "N"],
          lengthTolerance: 0.01,
          minimumCenterlineDistance: 0.6,
          maximumCenterlineDistance: 1.6,
        },
      ],
    },
  })
  const { simpleRouteJson } = params
  const traces = structuredClone(simpleRouteJson.traces)
  const last = traces[1]!.route.at(-1)!
  if (last.route_type !== "wire") throw new Error("Expected endpoint wire")
  last.x = 9
  const result = solveDifferentialPair({
    pair: simpleRouteJson.differentialPairs[0]!,
    traces,
    obstacles: simpleRouteJson.obstacles,
    bounds: simpleRouteJson.bounds,
    layerCount: simpleRouteJson.layerCount,
  })
  expect(result.status).toBe("accepted")
  expect(result.candidate.centerlineDistance).toBeGreaterThanOrEqual(0.6)
  expect(result.candidate.centerlineDistance).toBeLessThanOrEqual(1.6)
  expect(result.candidate.edgeGap).toBeCloseTo(
    getMinimumPairEdgeGap(
      result.candidate.firstParsed,
      result.candidate.secondParsed,
    ),
    8,
  )
})
