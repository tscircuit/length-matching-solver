import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

const measure = (hdRoute: HighDensityRoute): number => {
  let total = 0
  for (let index = 0; index < hdRoute.route.length - 1; index++) {
    const start = hdRoute.route[index]!
    const end = hdRoute.route[index + 1]!
    if (start.z === end.z) total += Math.hypot(end.x - start.x, end.y - start.y)
  }
  return total
}

test("applies final geometry-checked matching within declared length tolerance", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const hdRoutes = structuredClone(params.hdRoutes)
  hdRoutes[1]!.route.at(-1)!.x = 9
  const solver = new PostProcessingSolver({ ...params, hdRoutes })
  solver.solve()
  const output = solver.getOutput()
  expect(
    Math.abs(measure(output.hdRoutes[0]!) - measure(output.hdRoutes[1]!)),
  ).toBeLessThanOrEqual(0.010001)
})
