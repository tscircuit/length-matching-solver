import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-11/sample-11.srj.json"
import { type HighDensityRoute, PostProcessingSolver } from "../../lib"
import {
  createPostProcessingParamsFromSimpleRouteJson,
  type PostProcessingSimpleRouteJsonFixture,
} from "../../fixtures/createPostProcessingParamsFromSimpleRouteJson"

const getRouteYAtX = (hdRoute: HighDensityRoute, x: number): number => {
  for (let index = 0; index < hdRoute.route.length - 1; index++) {
    const start = hdRoute.route[index]
    const end = hdRoute.route[index + 1]
    if (!start || !end || start.z !== end.z) continue
    if ((x - start.x) * (x - end.x) > 0 || start.x === end.x) continue
    const progress = (x - start.x) / (end.x - start.x)
    return start.y + (end.y - start.y) * progress
  }
  throw new Error(`Expected ${hdRoute.connectionName} to cross x=${x}`)
}

test("conservatively reroutes a differential pair around an oval obstacle", () => {
  const simpleRouteJson = structuredClone(
    sampleProblem,
  ) as unknown as PostProcessingSimpleRouteJsonFixture
  const obstacle = simpleRouteJson.obstacles[0]
  if (!obstacle) throw new Error("Expected the central obstacle")
  obstacle.type = "oval"
  const params = createPostProcessingParamsFromSimpleRouteJson(simpleRouteJson)

  expect(params.obstacles[0]?.type).toBe("oval")
  const solver = new PostProcessingSolver(params)
  solver.solve()

  const crossingYs = solver
    .getOutput()
    .hdRoutes.map((hdRoute) => getRouteYAtX(hdRoute, obstacle.center.x))
  expect(Math.sign(crossingYs[0]!)).toBe(Math.sign(crossingYs[1]!))
  for (const y of crossingYs)
    expect(Math.abs(y - obstacle.center.y)).toBeGreaterThan(obstacle.height / 2)
})
