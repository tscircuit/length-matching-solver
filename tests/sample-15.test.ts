import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-15/sample-15.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"
import { getRouteLength } from "../lib/route-geometry"

test("sample 15", () => {
  // SAFETY: This repository-owned JSON reproduces the short-segment dual-meander regression. The cast restores JSON literals widened by TypeScript module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  const originalLongerRoute = params.hdRoutes.find(
    (route) => route.connectionName === "source_trace_14",
  )
  const originalShorterRoute = params.hdRoutes.find(
    (route) => route.connectionName === "source_trace_13",
  )
  const matchedLongerRoute = solver.matchedHdRoutes.find(
    (route) => route.connectionName === "source_trace_14",
  )
  const matchedShorterRoute = solver.matchedHdRoutes.find(
    (route) => route.connectionName === "source_trace_13",
  )
  const pair = params.differentialPairs?.find(
    ({ connectionNames }) =>
      connectionNames.includes("source_trace_13") &&
      connectionNames.includes("source_trace_14"),
  )
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
  expect(solver.stats.mode).toBe("dual-meander")
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
