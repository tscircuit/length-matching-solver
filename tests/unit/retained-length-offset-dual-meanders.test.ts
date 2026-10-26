import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-10/sample-10.srj.json"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
  type Obstacle,
} from "../../lib"
import { getRouteLength } from "../../lib/route-geometry"

test("validates complete lengths when both carriers need minimum-height meanders", (): void => {
  const params: LengthMatchingSolverParams = {
    ...sampleProblem,
    obstacles: sampleProblem.obstacles.map(
      (obstacle): Obstacle => ({
        ...obstacle,
        type: "rect",
      }),
    ),
    differentialPairs: [
      {
        connectionNames: ["small_gap_p", "small_gap_n"],
        lengthTolerance: 0.01,
      },
    ],
    fixedLengthByConnectionName: { small_gap_n: 0.02 },
  }
  const solver = new LengthMatchingSolver(params)
  solver.solve()

  expect(solver.solved).toBe(true)
  const [positive, negative] = solver.getOutput().matchedHdRoutes
  const [originalPositive, originalNegative] = params.hdRoutes
  if (!positive || !negative || !originalPositive || !originalNegative)
    throw new Error("Expected both small-gap carrier routes")
  expect(getRouteLength(positive)).toBeGreaterThan(
    getRouteLength(originalPositive),
  )
  expect(getRouteLength(negative)).toBeGreaterThan(
    getRouteLength(originalNegative),
  )
  expect(
    Math.abs(getRouteLength(positive) - getRouteLength(negative) - 0.02),
  ).toBeLessThanOrEqual(0.01)
})
