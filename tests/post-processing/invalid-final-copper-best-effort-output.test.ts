import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { PostProcessingConstraintError } from "../../lib/post-processing/errors/PostProcessingConstraintError"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("falls back to valid pre-matching geometry after invalid final copper", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver(params)
  while (
    !solver.hdRouteReconstructionSolver &&
    !solver.solved &&
    !solver.failed
  )
    solver.step()
  if (!solver.hdRouteReconstructionSolver || !solver.lengthMatchingSolver)
    throw new Error("Expected the reconstruction stage to start")
  solver.lengthMatchingSolver.matchedHdRoutes[0]!.route[0]!.x = 999
  solver.hdRouteReconstructionSolver._step = (): void => {
    throw new PostProcessingConstraintError({
      message: "PostProcessingSolver: final copper is invalid",
      connectionNames: ["P", "N"],
      reason: "invalid-final-copper",
    })
  }

  solver.solve()
  const output = solver.getOutput()

  expect(output.hdRoutes).not.toEqual(params.hdRoutes)
  expect(
    output.hdRoutes.every((route) =>
      route.route.every((point) => point.x !== 999),
    ),
  ).toBe(true)
  expect(output.postProcessingErrors[0]).toMatchObject({
    reason: "invalid-final-copper",
    returnedRouteSource: "best-effort-hd-routes",
  })
})
