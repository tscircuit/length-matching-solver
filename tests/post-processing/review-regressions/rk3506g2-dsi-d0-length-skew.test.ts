import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"
import { buildObstacleGraphics } from "../../../lib/length-matching/visualization/build-obstacle-graphics"
import { buildRouteGraphics } from "../../../lib/length-matching/visualization/build-route-graphics"
import { createLengthMatchingColorTheme } from "../../../lib/length-matching/visualization/color-theme"
import type { LengthMatchingGraphics } from "../../../lib/length-matching/visualization/types"
import { getRouteLength } from "../../../lib/route-geometry"

test("snapshots the DSI_D0 length skew on the RK3506G2 board", async (): Promise<void> => {
  // Pipeline9's post-processing input from tscircuit/tscircuit-autorouter#4000.
  // All obstacles and routed geometry are retained. Pad aliases are scoped to
  // the four routes in that test batch.
  const fixtureUrl = new URL(
    "../fixtures/rk3506g2-dsi-d0-post-processing.json",
    import.meta.url,
  )
  const params: PostProcessingSolverParams = await Bun.file(fixtureUrl).json()
  const solver = new PostProcessingSolver(params)
  solver.solve()
  expect(solver.solved).toBe(true)

  const { hdRoutes } = solver.getOutput()
  expect(hdRoutes.map(({ connectionName }) => connectionName)).toEqual(
    params.hdRoutes.map(({ connectionName }) => connectionName),
  )
  const { connectionNames, lengthTolerance } = params.differentialPairs[0]!
  const [positive, negative] = connectionNames.map((name) =>
    getRouteLength(hdRoutes.find(({ connectionName }) => connectionName === name)!),
  )
  const skew = Math.abs(positive! - negative!)

  const theme = createLengthMatchingColorTheme({
    [connectionNames[0]]: "#1d4ed8",
    [connectionNames[1]]: "#9333ea",
    source_trace_172: "#64748b",
    source_trace_194: "#64748b",
  })
  const graphics: LengthMatchingGraphics = {
    lines: [],
    points: [],
    rects: [],
    circles: [],
  }
  buildObstacleGraphics({ ...params, theme, graphics })
  buildRouteGraphics({ routes: hdRoutes, theme, graphics })
  await expect({
    ...graphics,
    coordinateSystem: "cartesian",
    texts: [
      {
        x: 0,
        y: params.bounds.maxY + 3,
        text: `DSI_D0 skew ${skew.toFixed(3)} mm / ${lengthTolerance.toFixed(3)} mm limit`,
        fontSize: 2,
        color: skew <= lengthTolerance ? "#166534" : "#b91c1c",
      },
    ],
  }).toMatchGraphicsSvg(import.meta.path, { backgroundColor: "white" })
})
