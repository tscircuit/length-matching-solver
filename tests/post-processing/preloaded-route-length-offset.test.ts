import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { getRouteLength } from "../../lib/route-geometry"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("includes immutable preloaded copper in final pair matching", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver({
    ...params,
    connectionLengthOffsets: { P: 2, N: 0 },
  })

  solver.solve()

  const output = solver.getOutput()
  const routeByName = new Map(
    output.hdRoutes.map((route) => [route.connectionName, route]),
  )
  const positiveLength = getRouteLength(routeByName.get("P")!) + 2
  const negativeLength = getRouteLength(routeByName.get("N")!)
  expect(output.postProcessingErrors).toEqual([])
  expect(Math.abs(positiveLength - negativeLength)).toBeLessThanOrEqual(0.01)
  expect(getRouteLength(routeByName.get("N")!)).toBeGreaterThan(
    getRouteLength(routeByName.get("P")!),
  )
})
