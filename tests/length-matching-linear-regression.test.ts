import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-01/sample-01.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"
import { getRouteLength } from "../lib/route-geometry"

test("matches a shorter route using a length-fitted curved meander", () => {
  // SAFETY: This repository-owned JSON is the shared test and Cosmos fixture input. The cast restores literal tuple and obstacle discriminants widened by JSON module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.matchedHdRoutes[1]!.route.length).toBeGreaterThan(6)
  expect(
    Math.min(...solver.matchedHdRoutes[1]!.route.map((point) => point.y)),
  ).toBeGreaterThan(-3)
  expect(getRouteLength(solver.matchedHdRoutes[1]!)).toBeCloseTo(
    getRouteLength(solver.matchedHdRoutes[0]!),
    3,
  )
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
