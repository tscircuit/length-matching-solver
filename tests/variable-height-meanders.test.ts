import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-03/sample-03.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"
import { getRouteLength } from "../lib/route-geometry"

test("scales independently clearance-limited tooth heights", () => {
  // SAFETY: This repository-owned JSON is the sample fixture input. The cast restores literal tuple and obstacle discriminants widened by JSON module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  const longerRoute = solver.matchedHdRoutes[0]!
  const matchedRoute = solver.matchedHdRoutes[1]!
  const offBaselinePoints = matchedRoute.route.filter(
    (point) => Math.abs(point.y + 2) > 0.0001,
  )
  const distinctHeights = new Set(
    offBaselinePoints.map((point) => Math.abs(point.y + 2).toFixed(4)),
  )
  expect(solver.solved).toBe(true)
  expect(distinctHeights.size).toBeGreaterThan(1)
  expect(getRouteLength(matchedRoute)).toBeCloseTo(
    getRouteLength(longerRoute),
    3,
  )
})
