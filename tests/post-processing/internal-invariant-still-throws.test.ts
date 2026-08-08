import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("does not classify an internal invariant error as best effort", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver(params)
  while (!solver.lengthMatchingSolver && !solver.solved && !solver.failed)
    solver.step()
  if (!solver.lengthMatchingSolver)
    throw new Error("Expected the length-matching stage to start")
  solver.lengthMatchingSolver._step = (): void => {
    throw new Error("LengthMatchingSolver: internal route binding was lost")
  }

  expect(() => solver.solve()).toThrow(
    "LengthMatchingSolver: internal route binding was lost",
  )
  expect(solver.failed).toBe(true)
  expect(solver.solved).toBe(false)
  expect(() => solver.getOutput()).toThrow(/before the solver completed/)
})
