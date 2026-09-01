import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"

test("handles an RV1106G2 reversing differential-pair spine", async () => {
  const fixtureUrl = new URL(
    "../../../fixtures/rv1106g2-reversing-spine/rv1106g2-reversing-spine.json",
    import.meta.url,
  )
  const params = JSON.parse(
    await Bun.file(fixtureUrl).text(),
  ) as PostProcessingSolverParams
  const solver = new PostProcessingSolver(params)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
