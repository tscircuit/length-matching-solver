import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("finalizes summary state when the incrementally searched final pair completes", () => {
  const solver = new PostProcessingSolver(createPostProcessingTestParams())
  solver.solve()
  expect(solver.iterations).toBeGreaterThan(1)
  expect(solver.solved).toBe(true)
  expect(solver.getStageStats()).toMatchObject({
    differentialPairReroutingSolver: { completed: true },
    fortyFiveDegreeSimplificationSolver: { completed: true },
    lengthMatchingSolver: { completed: true },
    simplifiedTraceReconstructionSolver: { completed: true },
  })
  expect(solver.stats).toEqual({
    phase: "complete",
    acceptedPairCount: 1,
    retainedPairCount: 0,
  })
  expect(solver.computeProgress()).toBe(1)
})
