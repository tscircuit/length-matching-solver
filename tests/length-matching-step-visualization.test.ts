import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-01/sample-01.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"

test("renders distinct geometry for pair selection, acceptance, and completion", () => {
  // SAFETY: This repository-owned fixture is exercised by the solver regression test. The cast restores JSON literals widened by TypeScript module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.step()
  expect(solver.visualize().lines).toHaveLength(3)

  solver.step()
  expect(solver.visualize().lines).toHaveLength(31)

  solver.step()
  expect(solver.visualize().lines).toHaveLength(29)
})
