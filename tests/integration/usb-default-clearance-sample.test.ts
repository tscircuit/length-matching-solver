import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-09/sample-09.srj.json"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib"

test("matches a USB pair with relaxed meanders in available space", () => {
  // SAFETY: This repository-owned JSON is shared with the Cosmos fixture. The cast restores literal tuple and obstacle discriminants widened by JSON module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  expect(solver.solved).toBe(true)
  const tunedRoute = solver.matchedHdRoutes[1]?.route
  if (!tunedRoute) throw new Error("Expected the USB D- route to be present")
  const baselineY = sampleProblem.hdRoutes[1]!.route[0]!.y
  const tuningPoints = tunedRoute.filter(
    (point) => Math.abs(point.y - baselineY) > 0.1,
  )
  const maximumExcursion = Math.max(
    ...tunedRoute.map((point) => Math.abs(point.y - baselineY)),
  )
  const occupiedBaselineLength =
    Math.max(...tuningPoints.map((point) => point.x)) -
    Math.min(...tuningPoints.map((point) => point.x))

  expect(maximumExcursion).toBeLessThan(1)
  expect(occupiedBaselineLength).toBeGreaterThan(6)
})
