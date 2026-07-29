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

test("reroutes an oppositely-detoured pair together around a component", () => {
  // SAFETY: This repository-owned legacy SRJ is adapted to the flat HD API at the test edge.
  const params = createPostProcessingParamsFromSimpleRouteJson(
    sampleProblem as unknown as PostProcessingSimpleRouteJsonFixture,
  )
  const solver = new PostProcessingSolver(params)
  solver.solve()

  const output = solver.getOutput()
  const [positive, negative] = output.hdRoutes
  if (!positive || !negative)
    throw new Error("Expected both differential-pair traces")

  const positiveY = getRouteYAtX(positive, 5)
  const negativeY = getRouteYAtX(negative, 5)
  expect(Math.sign(positiveY)).toBe(Math.sign(negativeY))
  expect(Math.abs(positiveY - negativeY)).toBeGreaterThanOrEqual(0.7 - 1e-7)
  expect(Math.abs(positiveY - negativeY)).toBeLessThanOrEqual(1.2 + 1e-7)
})
