import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"

const MAX_EXPECTED_SEARCH_TIME_MS = 20_000
const MAX_EXPECTED_SEARCH_ITERATIONS = 25_000

test("bounds each dense RV1106G2 camera search attempt", async () => {
  const fixtureUrl = new URL(
    "../../../fixtures/rv1106g2-camera-post-processing/rv1106g2-camera-post-processing.json",
    import.meta.url,
  )
  const params = JSON.parse(
    await Bun.file(fixtureUrl).text(),
  ) as PostProcessingSolverParams
  const solver = new PostProcessingSolver(params)
  const searchStartedAt = performance.now()

  solver.solveUntilStage("fortyFiveDegreeSimplificationSolver")

  const searchElapsedMs = performance.now() - searchStartedAt
  const reroutingSolver = solver.differentialPairReroutingSolver
  expect(reroutingSolver?.solved).toBe(true)
  expect(reroutingSolver?.failed).toBe(false)
  expect(searchElapsedMs).toBeLessThan(MAX_EXPECTED_SEARCH_TIME_MS)
  expect(reroutingSolver?.iterations).toBeLessThan(
    MAX_EXPECTED_SEARCH_ITERATIONS,
  )
  expect(
    reroutingSolver?.getOutput().failures.map((failure) => failure.reason),
  ).toEqual(["no-valid-candidate", "no-valid-candidate", "no-valid-candidate"])
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
