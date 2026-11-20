import { expect, test } from "bun:test"
import {
  createPostProcessingParamsFromSimpleRouteJson,
  type PostProcessingSimpleRouteJsonFixture,
} from "../../../fixtures/createPostProcessingParamsFromSimpleRouteJson"
import { PostProcessingSolver } from "../../../lib"
import { buildObstacleGraphics } from "../../../lib/length-matching/visualization/build-obstacle-graphics"
import { buildRouteGraphics } from "../../../lib/length-matching/visualization/build-route-graphics"
import { createLengthMatchingColorTheme } from "../../../lib/length-matching/visualization/color-theme"
import type { LengthMatchingGraphics } from "../../../lib/length-matching/visualization/types"
import { getRouteLength } from "../../../lib/route-geometry"

test("snapshots the DSI_D0 pad escape on the RK3506G2 layout", async (): Promise<void> => {
  // DSI_D0 copper and all board obstacles captured at Pipeline9 post-processing.
  const fixtureUrl = new URL(
    "./fixtures/rk3506g2-dsi-d0-escape.srj.json",
    import.meta.url,
  )
  const srj: PostProcessingSimpleRouteJsonFixture & {
    minTraceToPadEdgeClearance: number
  } = await Bun.file(fixtureUrl).json()
  const params = {
    ...createPostProcessingParamsFromSimpleRouteJson(srj),
    minTraceToPadEdgeClearance: srj.minTraceToPadEdgeClearance,
  }
  const solver = new PostProcessingSolver(params)
  solver.solve()
  const { hdRoutes, postProcessingErrors } = solver.getOutput()
  const [positive, negative] = hdRoutes
  if (!positive || !negative)
    throw new Error("Expected both captured DSI_D0 traces")

  const skew = Math.abs(getRouteLength(positive) - getRouteLength(negative))
  const { lengthTolerance } = srj.differentialPairs[0]!
  const status = postProcessingErrors.length
    ? postProcessingErrors.map(({ reason }) => reason).join(", ")
    : "Post-processing accepted"
  const theme = createLengthMatchingColorTheme({
    [positive.connectionName]: "#1d4ed8",
    [negative.connectionName]: "#7e22ce",
  })
  const graphics: LengthMatchingGraphics = {
    lines: [],
    points: [],
    rects: [],
    circles: [],
  }
  const bounds = { minX: -2, maxX: 10, minY: -2, maxY: 24 }
  const obstacles = srj.obstacles.filter(
    ({ center, width, height }) =>
      center.x + width / 2 >= bounds.minX &&
      center.x - width / 2 <= bounds.maxX &&
      center.y + height / 2 >= bounds.minY &&
      center.y - height / 2 <= bounds.maxY,
  )
  buildObstacleGraphics({
    obstacles,
    bounds,
    layerCount: srj.layerCount,
    theme,
    graphics,
  })
  buildRouteGraphics({ routes: hdRoutes, theme, graphics })
  await expect({
    ...graphics,
    coordinateSystem: "cartesian",
    texts: [
      { x: 4, y: 26, text: "RK3506G2 DSI_D0 · U1 to JLCD", fontSize: 1 },
      {
        x: 4,
        y: 24.8,
        text:
          "Skew " +
          skew.toFixed(3) +
          " mm / " +
          lengthTolerance.toFixed(3) +
          " mm limit",
        fontSize: 0.73,
        color: skew <= lengthTolerance ? "#166534" : "#b91c1c",
      },
      { x: 4, y: -3.2, text: status, fontSize: 0.55 },
    ],
  }).toMatchGraphicsSvg(import.meta.path, { backgroundColor: "white" })
})
