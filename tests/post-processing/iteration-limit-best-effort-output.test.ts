import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns best geometry when optimization exhausts its iterations", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver(params)
  while (!solver.lengthMatchingSolver && !solver.solved && !solver.failed)
    solver.step()
  if (!solver.lengthMatchingSolver)
    throw new Error("Expected the length-matching stage to start")
  solver.lengthMatchingSolver.MAX_ITERATIONS =
    solver.lengthMatchingSolver.iterations + 1

  solver.solve()
  const output = solver.getOutput()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(output.hdRoutes).not.toEqual(params.hdRoutes)
  expect(output.postProcessingErrors).toEqual([
    {
      type: "post_processing_error",
      stage: "lengthMatchingSolver",
      message: "LengthMatchingSolver ran out of iterations",
      reason: "iteration-limit-exhausted",
      returnedRouteSource: "best-effort-hd-routes",
    },
  ])
})
