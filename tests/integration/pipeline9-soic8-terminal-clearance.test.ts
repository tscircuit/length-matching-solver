import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib/PostProcessingSolver"
import type { PostProcessingSolverParams } from "../../lib/post-processing/types"
import input from "../fixtures/pipeline9-soic8-length-matching.json"

test("matches Pipeline9 SOIC8 routes beside their own terminal pads", () => {
  const solver = new PostProcessingSolver(
    input as unknown as PostProcessingSolverParams,
  )
  solver.solve()

  const output = solver.getOutput()
  const lengths = output.hdRoutes.map((route) =>
    route.route.slice(1).reduce((length, point, index) => {
      const previousPoint = route.route[index]!
      return (
        length +
        Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y)
      )
    }, 0),
  )
  expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(0.05)
  expect(
    output.postProcessingErrors.some(
      (error) => error.reason === "invalid-final-copper",
    ),
  ).toBe(false)
  for (const [index, route] of output.hdRoutes.entries()) {
    expect(route.route[0]).toEqual(input.hdRoutes[index]!.route[0])
    expect(route.route.at(-1)).toEqual(input.hdRoutes[index]!.route.at(-1))
  }
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
