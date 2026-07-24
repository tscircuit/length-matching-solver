import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-06/sample-06.srj.json"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib"

test("matches both pairs in the tightly spaced four-row sample", () => {
  // SAFETY: This repository-owned JSON is the shared test and Cosmos fixture input. The cast restores literal tuple and obstacle discriminants widened by JSON module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver({
    ...params,
    minMeanderGap: 0.25,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.matchedHdRoutes[1]!.route.length).toBeGreaterThan(2)
  expect(solver.matchedHdRoutes[2]!.route.length).toBeGreaterThan(2)
})
