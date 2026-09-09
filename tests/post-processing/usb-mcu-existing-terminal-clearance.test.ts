import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib/PostProcessingSolver"
import type {
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "../../lib/post-processing/types"
import { buildObstacleGraphics } from "../../lib/length-matching/visualization/build-obstacle-graphics"
import { buildRouteGraphics } from "../../lib/length-matching/visualization/build-route-graphics"
import { createLengthMatchingColorTheme } from "../../lib/length-matching/visualization/color-theme"
import type { LengthMatchingGraphics } from "../../lib/length-matching/visualization/types"

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
  const graphics: LengthMatchingGraphics = {
    lines: [],
    points: [],
    circles: [],
    rects: [],
  }
  const theme = createLengthMatchingColorTheme({
    source_net_0: "#dc2626",
    source_net_1: "#2563eb",
  })
  buildObstacleGraphics({ graphics, theme, ...params })
  buildRouteGraphics({ graphics, theme, routes: output.hdRoutes })
  await expect({
    ...graphics,
    coordinateSystem: "cartesian",
    texts: [
      { x: 0, y: 14, text: "USB length matching", fontSize: 0.7 },
      {
        x: 0,
        y: 12.8,
        text: `${getPairSkew(output.hdRoutes).toFixed(3)} mm skew / 0.500 mm limit`,
        fontSize: 0.6,
      },
    ],
  }).toMatchGraphicsSvg(import.meta.path, { backgroundColor: "white" })
})
