import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-01/sample-01.srj.json"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../lib"

test("matches a shorter route using a regression-predicted square meander", () => {
  // SAFETY: This repository-owned JSON is the shared test and Cosmos fixture input. The cast restores literal tuple and obstacle discriminants widened by JSON module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.matchedHdRoutes[1]!.route).toHaveLength(6)
  expect(solver.matchedHdRoutes[1]!.route[2]!.y).toBeCloseTo(-3)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
