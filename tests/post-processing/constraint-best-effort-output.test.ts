import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { PostProcessingConstraintError } from "../../lib/post-processing/errors/PostProcessingConstraintError"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns best geometry when final constraints cannot be met", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver(params)
  while (
    !solver.hdRouteReconstructionSolver &&
    !solver.solved &&
    !solver.failed
  )
    solver.step()
  if (!solver.hdRouteReconstructionSolver)
    throw new Error("Expected the reconstruction stage to start")
  solver.hdRouteReconstructionSolver._step = (): void => {
    throw new PostProcessingConstraintError(
      "PostProcessingSolver: final geometry exceeds the requested tolerance",
    )
  }

  solver.solve()
  const output = solver.getOutput()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(output.hdRoutes).not.toEqual(params.hdRoutes)
  expect(output.postProcessingErrors).toEqual([
    {
      type: "post_processing_error",
      stage: "hdRouteReconstructionSolver",
      message:
        "PostProcessingSolver: final geometry exceeds the requested tolerance",
      returnedRouteSource: "best-effort-hd-routes",
    },
  ])
})
