import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"

const MAX_EXPECTED_SEARCH_TIME_MS = 45_000

test("completes dense RV1106G2 camera search in under 45 seconds", async () => {
  const fixtureUrl = new URL(
    "../../../fixtures/rv1106g2-camera-post-processing/rv1106g2-camera-post-processing.json",
    import.meta.url,
  )
  const params = JSON.parse(
    await Bun.file(fixtureUrl).text(),
  ) as PostProcessingSolverParams
  const solver = new PostProcessingSolver(params)
  const searchStartedAt = performance.now()

  solver.solve()

  const searchElapsedMs = performance.now() - searchStartedAt
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(searchElapsedMs).toBeLessThan(MAX_EXPECTED_SEARCH_TIME_MS)
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
