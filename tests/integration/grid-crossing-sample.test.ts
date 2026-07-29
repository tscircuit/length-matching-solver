import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-13/sample-13.srj.json"
import { PostProcessingSolver } from "../../lib"
import {
  createPostProcessingParamsFromSimpleRouteJson,
  type PostProcessingSimpleRouteJsonFixture,
} from "../../fixtures/createPostProcessingParamsFromSimpleRouteJson"

test("grid crossing post-processing input crosses the blocker on bottom", () => {
  const params = createPostProcessingParamsFromSimpleRouteJson(
    sampleProblem as unknown as PostProcessingSimpleRouteJsonFixture,
  )
  const solver = new PostProcessingSolver(params)

  solver.solve()

  const output = solver.getOutput()
  expect(solver.solved).toBe(true)
  expect(output.hdRoutes.map((route) => route.connectionName)).toEqual([
    "grid_upper",
    "grid_lower",
    "grid_vertical",
  ])
  const reroutedPair = output.hdRoutes.slice(0, 2)
  expect(reroutedPair.map((route) => route.vias.length)).toEqual([2, 2])
  expect(
    reroutedPair
      .flatMap((route) => route.route)
      .some((point) => point.z === params.layerCount - 1),
  ).toBe(true)
  expect(output.hdRoutes[2]).toEqual(params.hdRoutes[2])
  expect(solver.visualize()).toBeTruthy()
})
