import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib/PostProcessingSolver"
import type { PostProcessingSolverParams } from "../../lib/post-processing/types"
import fixture from "./fixtures/core-declared-pad-clearance.json"
import { createDeclaredPadClearanceComparison } from "./fixtures/createDeclaredPadClearanceComparison"

test("post-processing honors declared pad clearance without changing legacy defaults", async () => {
  const params = fixture as unknown as PostProcessingSolverParams
  const legacySolver = new PostProcessingSolver(params)
  legacySolver.solve()
  expect(
    legacySolver
      .getOutput()
      .postProcessingErrors.some(
        (error) => error.reason === "invalid-final-copper",
      ),
  ).toBe(true)

  const solver = new PostProcessingSolver({
    ...params,
    minTraceToPadEdgeClearance: 0.1,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  expect(
    output.postProcessingErrors.some(
      (error) => error.reason === "invalid-final-copper",
    ),
  ).toBe(false)
  const lengths = output.hdRoutes.map((route, routeIndex) => {
    expect(route.route[0]).toEqual(params.hdRoutes[routeIndex]!.route[0])
    expect(route.route.at(-1)).toEqual(
      params.hdRoutes[routeIndex]!.route.at(-1),
    )
    return route.route.slice(1).reduce((length, point, pointIndex) => {
      const previous = route.route[pointIndex]!
      return length + Math.hypot(point.x - previous.x, point.y - previous.y)
    }, 0)
  })
  expect(Math.abs(lengths[0]! - lengths[1]!)).toBeLessThanOrEqual(0.05)
  await expect(
    createDeclaredPadClearanceComparison(
      params,
      legacySolver.getOutput(),
      output,
    ),
  ).toMatchGraphicsSvg(import.meta.path, { backgroundColor: "white" })
  for (const clearance of [-0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(
      () =>
        new PostProcessingSolver({
          ...params,
          minTraceToPadEdgeClearance: clearance,
        }),
    ).toThrow("minTraceToPadEdgeClearance")
  }
})
