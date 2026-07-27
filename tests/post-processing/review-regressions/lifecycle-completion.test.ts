import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("finalizes summary state in the same step as the final pair", () => {
  const solver = new PostProcessingSolver(createPostProcessingTestParams())
  solver.step()
  expect(solver.solved).toBe(true)
  expect(solver.stats).toEqual({
    phase: "complete",
    acceptedPairCount: 1,
    retainedPairCount: 0,
  })
  expect(solver.computeProgress()).toBe(1)
})
