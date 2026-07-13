import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-01/sample-01.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"

test("renders distinct geometry for pair selection, scoring, and completion", () => {
  // SAFETY: This repository-owned fixture is exercised by the solver regression test. The cast restores JSON literals widened by TypeScript module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.step()
  expect(solver.visualize().lines).toHaveLength(3)

  solver.step()
  expect(solver.visualize().lines).toHaveLength(4)

  for (
    let index = 0;
    index < 100 && solver.matchedHdRoutes[1]!.route.length === 2;
    index++
  )
    solver.step()
  expect(solver.matchedHdRoutes[1]!.route.length).toBeGreaterThan(2)
  expect(solver.visualize().lines.length).toBeGreaterThan(3)

  solver.solve()
  expect(solver.visualize().lines.length).toBeGreaterThan(3)
})
