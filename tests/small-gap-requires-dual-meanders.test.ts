import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-10/sample-10.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"
import { getRouteLength } from "../lib/route-geometry"

test("matches a small gap by adding valid meanders to both pair members", () => {
  // SAFETY: This repository-owned JSON is the small-gap fixture. The cast restores JSON literals widened by TypeScript module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  const pair = params.differentialPairs?.[0]
  const originalLongerRoute = params.hdRoutes.find(
    (route) => route.connectionName === "small_gap_p",
  )
  const originalShorterRoute = params.hdRoutes.find(
    (route) => route.connectionName === "small_gap_n",
  )
  const matchedLongerRoute = solver.matchedHdRoutes.find(
    (route) => route.connectionName === "small_gap_p",
  )
  const matchedShorterRoute = solver.matchedHdRoutes.find(
    (route) => route.connectionName === "small_gap_n",
  )
  if (
    !originalLongerRoute ||
    !originalShorterRoute ||
    !matchedLongerRoute ||
    !matchedShorterRoute
  )
    throw new Error("Expected both small-gap routes to be present")
  if (!pair) throw new Error("Expected the small-gap differential pair")
  expect(solver.solved).toBe(true)
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
