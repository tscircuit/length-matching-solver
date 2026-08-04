import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-15/sample-15.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"
import { getRouteLength } from "../lib/route-geometry"

test("matches short pair segments by adding meanders to both routes", () => {
  // SAFETY: This repository-owned JSON reproduces the short-segment dual-meander regression. The cast restores JSON literals widened by TypeScript module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  const originalLongerRoute = params.hdRoutes[0]
  const originalShorterRoute = params.hdRoutes[1]
  const matchedLongerRoute = solver.matchedHdRoutes[0]
  const matchedShorterRoute = solver.matchedHdRoutes[1]
  const pair = params.differentialPairs?.[0]
  if (
    !originalLongerRoute ||
    !originalShorterRoute ||
    !matchedLongerRoute ||
    !matchedShorterRoute ||
    !pair
  )
    throw new Error("Expected both short-segment differential-pair routes")
  expect(getRouteLength(matchedLongerRoute)).toBeGreaterThan(
    getRouteLength(originalLongerRoute),
  )
  expect(getRouteLength(matchedShorterRoute)).toBeGreaterThan(
    getRouteLength(originalShorterRoute),
  )
  expect(
    Math.abs(
      getRouteLength(matchedLongerRoute) - getRouteLength(matchedShorterRoute),
    ),
  ).toBeLessThanOrEqual(pair.lengthTolerance)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
