import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("improves a far-apart same-layer pair toward preferred edge spacing", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver(params)
  solver.solve()
  const { hdRoutes } = solver.getOutput()
  const firstInterior = hdRoutes[0]!.route[1]!
  const secondInterior = hdRoutes[1]!.route[1]!
  const centerDistance = Math.hypot(
    firstInterior.x - secondInterior.x,
    firstInterior.y - secondInterior.y,
  )
  const firstWidth = firstInterior.traceThickness ?? hdRoutes[0]!.traceThickness
  const secondWidth =
    secondInterior.traceThickness ?? hdRoutes[1]!.traceThickness
  const edgeGap = centerDistance - (firstWidth + secondWidth) / 2
  expect(edgeGap).toBeGreaterThanOrEqual(0.5)
  expect(edgeGap).toBeLessThanOrEqual(1.000001)
})
