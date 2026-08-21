import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"

test("reproduces dense RV1106G2 camera pair collision checks", async () => {
  const fixtureUrl = new URL(
    "../../../fixtures/rv1106g2-camera-post-processing/rv1106g2-camera-post-processing.json",
    import.meta.url,
  )
  const params = JSON.parse(
    await Bun.file(fixtureUrl).text(),
  ) as PostProcessingSolverParams
  const solver = new PostProcessingSolver(params)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.iterations).toBe(80_001)
  expect(
    solver.getOutput().postProcessingErrors.map((error) => error.reason),
  ).toEqual([
    "no-valid-candidate",
    "no-valid-candidate",
    "iteration-limit-exhausted",
  ])
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
