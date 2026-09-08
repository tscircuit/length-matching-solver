import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib/PostProcessingSolver"
import type {
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "../../lib/post-processing/types"
import { createExistingTerminalClearanceComparison } from "./fixtures/createExistingTerminalClearanceComparison"

const getPairSkew = (
  routes: PostProcessingSolverOutput["hdRoutes"],
): number => {
  const lengths = routes.map((route) =>
    route.route.slice(1).reduce((length, point, pointIndex) => {
      const previous = route.route[pointIndex]!
      return length + Math.hypot(point.x - previous.x, point.y - previous.y)
    }, 0),
  )
  return Math.abs(lengths[0]! - lengths[1]!)
}

test("length matching accepts a legal meander beside existing terminal fanout", async () => {
  const fixtureUrl = new URL(
    "./fixtures/usb-mcu-existing-terminal-clearance.json",
    import.meta.url,
  )
  const params: PostProcessingSolverParams = await Bun.file(fixtureUrl).json()
  expect(getPairSkew(params.hdRoutes)).toBeGreaterThan(0.5)

  const solver = new PostProcessingSolver(params)
  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  expect(getPairSkew(output.hdRoutes)).toBeLessThanOrEqual(0.5)
  expect(
    output.postProcessingErrors.some(
      (error) => error.reason === "invalid-final-copper",
    ),
  ).toBe(false)
  await expect(
    createExistingTerminalClearanceComparison(params, output),
  ).toMatchGraphicsSvg(import.meta.path, { backgroundColor: "white" })
})
