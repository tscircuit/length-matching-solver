import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-07/sample-07.srj.json"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib"

test("rejects length matching when close keepouts leave no room for a meander", () => {
  // SAFETY: This repository-owned JSON is an intentionally unsolvable narrow-corridor fixture. The cast restores JSON literals widened by TypeScript module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  expect(() => solver.solve()).toThrow(
    'linear regression exhausted all segment/tooth combinations for "corridor_n"',
  )
  expect(solver.solved).toBe(false)
})
