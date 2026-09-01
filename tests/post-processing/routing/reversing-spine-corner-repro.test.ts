import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"

test("reproduces the RV1106G2 reversing differential-pair spine crash", async () => {
  const fixtureUrl = new URL(
    "../../../fixtures/rv1106g2-reversing-spine/rv1106g2-reversing-spine.json",
    import.meta.url,
  )
  const params = JSON.parse(
    await Bun.file(fixtureUrl).text(),
  ) as PostProcessingSolverParams
  const solver = new PostProcessingSolver(params)

  expect(() => solver.solve()).toThrow(
    "PostProcessingSolver: cannot offset a reversing spine corner",
  )
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
