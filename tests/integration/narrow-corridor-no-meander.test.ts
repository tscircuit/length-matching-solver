import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-07/sample-07.srj.json"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib"

test("returns the original route and an error when no meander fits", () => {
  // SAFETY: This repository-owned JSON is an intentionally unsolvable narrow-corridor fixture. The cast restores JSON literals widened by TypeScript module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const output = solver.getOutput()
  expect(output.matchedHdRoutes).toEqual(params.hdRoutes)
  expect(output.errors).toEqual([
    {
      type: "length-matching-error",
      message:
        'LengthMatchingSolver: linear regression exhausted all segment/tooth combinations for "corridor_n"; required 2.0000mm',
      connectionNames: ["corridor_p", "corridor_n"],
      usedBestEffortRoute: false,
    },
  ])
})
